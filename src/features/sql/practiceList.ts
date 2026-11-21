import {catalogIndex} from '../../content/catalog';
import type {Catalog,Exercise,Module} from '../../content/types';
import type {Data,SqlAttempt} from '../../lib/model';

export type StatusFilter='available'|'all'|'not-done'|'passed'|'retry';
export interface PracticeFilters {module:string; level:string; categories:string[]; status:StatusFilter; search:string}
export const defaultPracticeFilters:PracticeFilters={module:'',level:'',categories:[],status:'available',search:''};
type PracticeState='未做'|'已通過'|'需重練';
interface PracticeRow {exercise:Exercise; state:PracticeState; available:boolean}
export interface PracticeGroup {module:Module; rows:PracticeRow[]; passed:number; total:number}

export function practiceList(cat:Catalog,data:Pick<Data,'lessonProgress'|'dayPlans'|'sqlAttempts'|'cards'>,day:string,filters:PracticeFilters){
  const idx=catalogIndex(cat);
  const completed=new Set(data.lessonProgress.filter(p=>p.status==='done').map(p=>p.lessonId));
  const planned=new Set(data.dayPlans.find(p=>p.day===day)?.items??[]);
  const latest=new Map<string,SqlAttempt>(),passed=new Set<string>();
  for(const a of data.sqlAttempts){
    const prev=latest.get(a.exerciseId);
    if(!prev||a.ts>prev.ts||(a.ts===prev.ts&&a.checks>=prev.checks))latest.set(a.exerciseId,a);
    if(a.passed)passed.add(a.exerciseId);
  }
  const weak=new Set(data.cards.filter(c=>!c.suspended&&(c.card.state===3||c.card.lapses>0)).map(c=>c.conceptId));
  const state=(e:Exercise):PracticeState=>latest.get(e.id)?.passed===false||e.concepts.some(c=>weak.has(c))?'需重練':passed.has(e.id)?'已通過':'未做';
  const statuses={'not-done':'未做',passed:'已通過',retry:'需重練'};
  const needle=filters.search.trim().toLowerCase(),categories=new Set(filters.categories);
  const categoryCounts=new Map<string,number>(),totals=new Map<string,{passed:number;total:number}>(),visible=new Map<string,PracticeRow[]>();
  const random:Exercise[]=[],matches:Exercise[]=[];
  let availableCount=0;
  const exerciseLessons=new Set<string>();
  for(const e of cat.exercises){
    exerciseLessons.add(e.lessonId);
    const total=totals.get(e.moduleId)??{passed:0,total:0};
    total.total++;
    if(passed.has(e.id))total.passed++;
    totals.set(e.moduleId,total);
    const available=completed.has(e.lessonId)||planned.has(e.lessonId)||latest.has(e.id);
    if(available)availableCount++;
    const status=state(e);
    if((filters.module&&e.moduleId!==filters.module)||(filters.level&&e.level!==Number(filters.level)))continue;
    if(filters.status==='available'?!available:filters.status!=='all'&&status!==statuses[filters.status])continue;
    if(needle&&![e.title,...e.tags,idx.moduleById.get(e.moduleId)?.title].join(' ').toLowerCase().includes(needle))continue;
    for(const c of e.category??[])categoryCounts.set(c,(categoryCounts.get(c)??0)+1);
    if(categories.size&&!e.category?.some(c=>categories.has(c)))continue;
    const rows=visible.get(e.moduleId)??[];
    rows.push({exercise:e,state:status,available});
    visible.set(e.moduleId,rows);
    matches.push(e);
    if(completed.has(e.lessonId)&&!passed.has(e.id))random.push(e);
  }
  const groups:PracticeGroup[]=idx.ordered.flatMap(module=>{
    const rows=visible.get(module.id);
    return rows?.length?[{module,rows,...totals.get(module.id)!}]:[];
  });
  const firstLesson=idx.orderedLessons.find(l=>l.status==='ready'&&exerciseLessons.has(l.id));
  return {
    groups,categoryCounts,matches,random,firstLesson,
    modules:idx.ordered.filter(m=>totals.has(m.id)),
    emptyAvailable:filters.status==='available'&&availableCount===0,
  };
}

const collapseKey='conduit.sql.collapsed.v1';
// Use a getter so we can guard both access to localStorage and operations on it.
export function loadCollapsed(storage:()=>Pick<Storage,'getItem'>=()=>window.localStorage){
  try{
    const data:unknown=JSON.parse(storage().getItem(collapseKey)??'[]');
    return new Set<string>(Array.isArray(data)?data.filter((id):id is string=>typeof id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)):[]);
  }catch{return new Set<string>()}
}
export function saveCollapsed(ids:ReadonlySet<string>,storage:()=>Pick<Storage,'setItem'>=()=>window.localStorage){
  try{storage().setItem(collapseKey,JSON.stringify([...ids]))}catch{/* The list still works without persistent storage. */}
}
