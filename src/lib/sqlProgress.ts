import type {SqlAttempt} from './model';
import type {Exercise,SqlCategory} from '../content/types';

function assistance(usedHint:boolean,viewedSolution:boolean){
  return viewedSolution?'solution':usedHint?'hint':'none';
}

export function sqlRating(outcome:'pass'|'solution'|'giveup'|'skip',failed:number,usedHint:boolean,viewedSolution=false){
  const help=assistance(usedHint,viewedSolution);
  return outcome==='skip'?null:outcome!=='pass'||help==='solution'?1:help==='hint'||failed>=2?2:3;
}

export function firstSqlPassRate(attempts:readonly SqlAttempt[],from:string,through:string){
  const first=new Map<string,SqlAttempt>();
  for(const a of attempts){
    const prior=first.get(a.exerciseId);
    if(!prior||a.ts<prior.ts||(a.ts===prior.ts&&a.checks<prior.checks))first.set(a.exerciseId,a);
  }
  const recent=[...first.values()].filter(a=>a.day>=from&&a.day<=through);
  const passed=recent.filter(a=>a.passed&&a.checks===1&&assistance(a.usedHint,a.viewedSolution)==='none').length;
  return recent.length?Math.round(100*passed/recent.length):null;
}

export function sqlFailureTopics(attempts:readonly SqlAttempt[],exercises:ReadonlyMap<string,Exercise>,categories:readonly SqlCategory[]){
  const names=new Map(categories.map(c=>[c.id,c.label])),failures=new Map<string,number>();
  for(const a of attempts){
    const ex=exercises.get(a.exerciseId);
    if(a.passed||!ex)continue;
    const topics=ex.category?.length?ex.category.map(id=>names.get(id)??id):ex.tags;
    for(const label of new Set(topics))failures.set(label,(failures.get(label)??0)+1);
  }
  return [...failures].sort((a,b)=>b[1]-a[1]).slice(0,5);
}
