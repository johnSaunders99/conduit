import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StaticRouter} from 'react-router-dom/server';
import {inspect} from '../tools/content.mjs';
import {assembleCatalog} from '../src/content/catalog';
import {defaults,type Data,type SqlAttempt} from '../src/lib/model';
import {Context} from '../src/ui/context';
import Playground,{ModuleGroups} from '../src/features/sql/Playground';
import {defaultPracticeFilters as base,loadCollapsed,practiceList,saveCollapsed} from '../src/features/sql/practiceList';

const report=inspect('fixtures/content'),cat=assembleCatalog(report.index,report.deck,report.sql,report.glossary);
const e=cat.exercises;
const day='2026-11-20',ts=day+'T12:00:00Z';
const attempts=(exerciseId:string,passed:boolean):SqlAttempt=>({
  id:exerciseId,exerciseId,passed,day,ts,sql:'SELECT 1',checks:1,usedHint:false,viewedSolution:false,ms:12,source:'playground'
});
const progress=(lessonId:string,status:'done'|'skipped'|'started')=>({lessonId,status,startedAt:ts,scrollY:0,quizResult:{}});
const plan=(day:string,items:string[])=>({day,items,reviewIds:[],reviewDone:[],createdAt:ts,
  budget:defaults.budget,focus:defaults.focus,format:defaults.format,scope:defaults.scope,tracks:[]});
const empty:Data={
  settings:[],lessonProgress:[],cards:[],reviewLogs:[],dayPlans:[],dayStats:[],practice:[],projects:[],interviewAnswers:[],sqlAttempts:[],sqlDrafts:[]
};
const moved=(i:number,lessonId:string)=>{
  const l=cat.lessons.find(l=>l.id===lessonId)!;
  return {...e[i],lessonId,moduleId:l.module};
};
const sample={...cat,exercises:[e[0],e[1],moved(2,'fd-demo-02-paths'),moved(3,'fs-demo-01-headings'),moved(4,'ai-demo-01-inference'),moved(5,'fd-demo-03-values')]};
const data={...empty,lessonProgress:[progress(e[0].lessonId,'done'),progress('fd-demo-03-values','skipped')],
  dayPlans:[plan(day,['fd-demo-02-paths']),plan('2026-11-19',['ai-demo-01-inference'])],
  sqlAttempts:[attempts(e[0].id,true),attempts(e[3].id,false)]};

it('defaults to completed or planned today plus attempted; all retains unreached rows',()=>{
  const available=practiceList(sample,data,day,base);
  expect(available.matches.map(x=>x.id)).toEqual(e.slice(0,4).map(x=>x.id));
  expect(available.groups.flatMap(g=>g.rows).every(r=>r.available)).toBe(true);
  const all=practiceList(sample,data,day,{...base,status:'all'});
  expect(all.groups.flatMap(g=>g.rows.filter(r=>!r.available).map(r=>r.exercise.id)).sort()).toEqual([e[4].id,e[5].id].sort());
  expect(all.groups.flatMap(g=>g.rows).find(r=>r.exercise.id===e[3].id)?.state).toBe('需重練');
});
it('counts facets before category selection and unions selected categories without duplicating exercises',()=>{
  const list=practiceList(sample,data,day,{...base,categories:['selection','ordering','aggregation']});
  expect(list.matches.map(x=>x.id)).toEqual(e.slice(0,4).map(x=>x.id));
  expect(Object.fromEntries(list.categoryCounts)).toEqual({selection:2,ordering:1,aggregation:2,nulls:1});
  const narrower=practiceList(sample,data,day,{...base,module:e[0].moduleId,level:'1',categories:['ordering'],search:e[1].tags[0]});
  expect(narrower.matches.map(x=>x.id)).toEqual([e[1].id]);
  expect(narrower.random.map(x=>x.id)).toEqual([e[1].id]);
  expect(narrower.groups[0]).toMatchObject({passed:1,total:2});
  expect(Object.fromEntries(narrower.categoryCounts)).toEqual({selection:1,ordering:1});
});
it('random picks never bypass search, category, difficulty, status or completed-lesson eligibility',()=>{
  for(const f of [{search:'not-a-tag'},{categories:['aggregation']},{level:'3'},{status:'passed' as const},{module:'fd-demo'}]){
    expect(practiceList(sample,data,day,{...base,...f}).random).toEqual([]);
  }
  const all=practiceList(sample,data,day,{...base,status:'all'});
  expect(all.random.map(x=>x.id)).toEqual([e[1].id]);
});
it('renders the default empty state with a real link to the first SQL lesson and no locked rows',()=>{
  const html=renderToStaticMarkup(<StaticRouter location="/sql"><Context.Provider value={{cat,data:empty,s:defaults,day,done:new Set(),notify:()=>{}}}><Playground/></Context.Provider></StaticRouter>);
  expect(html).toContain('value="available" selected="">可練（已學到）');
  expect(html).toContain('完成第一堂含 SQL 題的課，題目就會出現在這裡');
  expect(html).toContain('href="/lesson/sq-lab-01-counter"');
  expect(html).toContain('aria-pressed="false" disabled="">選擇欄位 <small>0</small>');
  expect(html).not.toContain('還沒學到');
});
it('remembers per-module choices and opens matching groups when a filter is applied',()=>{
  let stored:string|null=null;
  saveCollapsed(new Set([e[0].moduleId]),()=>({setItem:(_,v)=>{stored=v}}));
  const collapsed=loadCollapsed(()=>({getItem:()=>stored}));
  expect([...collapsed]).toEqual([e[0].moduleId]);
  const {groups}=practiceList(sample,data,day,{...base,module:e[0].moduleId});
  const render=(autoOpen:boolean)=>renderToStaticMarkup(<StaticRouter><ModuleGroups groups={groups} collapsed={collapsed} autoOpen={autoOpen} onToggle={()=>{}}/></StaticRouter>);
  expect(render(false)).toContain('aria-expanded="false"');
  expect(render(false)).not.toContain('/sql/'+e[1].id);
  expect(render(true)).toContain('aria-expanded="true"');
  expect(render(true)).toContain('/sql/'+e[1].id);
  expect(render(true)).toContain('1 / 2 已通過');
  expect([...collapsed]).toEqual([e[0].moduleId]);
});
it('continues with empty preferences on unavailable or corrupt storage',()=>{
  const blocked=()=>{throw Error('Storage disabled')};
  expect(loadCollapsed(blocked).size).toBe(0);
  expect(loadCollapsed(()=>({getItem:()=>'{corrupt'})).size).toBe(0);
  expect(loadCollapsed(()=>({getItem:()=>JSON.stringify([1,'bad id','sq-lab'])}))).toEqual(new Set(['sq-lab']));
  expect(()=>saveCollapsed(new Set(['sq-lab']),blocked)).not.toThrow();
});
