import {it,expect} from 'vitest';
import {inspect} from '../tools/content.mjs';
import {assembleCatalog,searchModules,skipModules,focusOptions} from '../src/content/catalog';
import {present,estimate,newCard} from '../src/lib/scheduler';
import {reviewPreview,tomorrowCutoff} from '../src/lib/reviewPlan';
import {defaults,type Choice} from '../src/lib/model';
const r=inspect('fixtures/content'),cat=assembleCatalog(r.index,r.deck,r.sql,r.glossary),ch:Choice={format:'sql',scope:'due',tracks:[]};
it('uses catalog order, independent roles, first-track foundations and explicit skippable modules',()=>{
  expect(cat.tracks).toHaveLength(5);expect(Object.keys(focusOptions(cat))).toEqual(['recommended','base','query','flow','sky','jobs']);
  expect(cat.roles.map(r=>r.id)).toEqual(['warehouse','streaming']);
  expect(skipModules(cat).map(m=>m.id)).toEqual(['fd-demo','fs-demo']);
  const swapped={...cat,tracks:[cat.tracks[2],...cat.tracks.filter((_,i)=>i!==2)]};expect(skipModules(swapped).map(m=>m.id)).toEqual(['fs-demo','ai-demo']);
});
it('exposes alias and local terminology in map search',()=>{
  for(const q of ['缺值','projection','資料表'])expect(searchModules(cat,'all',q)[0].hits[0].id).toBe('sq-lab-01-counter');
});
it('picks maximum due coverage first and never double-rates or substitutes uncovered concepts',()=>{
  const ids=['order-count','order-sort','order-project','headings-role'],items=present(ids,ch,cat,'day',defaults.weights);
  expect(items[0].ids.length).toBe(2);expect(items.flatMap(i=>i.ids).sort()).toEqual(ids.slice(0,3).sort());
  expect(estimate(items)).toBe(items.reduce((n,i)=>n+i.exercise!.minutes,0));
  const mixed=present(ids,{...ch,format:'mixed'},cat,'day',[0,0,0,1]);expect(mixed.find(i=>i.ids.includes('headings-role'))?.format).toBe('flashcard');
});
it('tomorrow SQL coverage is concepts covered, not the number of exercises or all due cards',()=>{
  const day='2026-11-20',ids=['order-project','order-sort','headings-role'],cards=cat.concepts.filter(c=>ids.includes(c.id)).map(c=>newCard(c,day,new Date(day+'T12:00:00'),3,.9));
  const sql=reviewPreview(cards,ch,cat,tomorrowCutoff(day,4),'2026-11-21',defaults,0).formats.find(f=>f.format==='sql');
  expect(sql).toMatchObject({covered:2,count:3,minutes:4});
});
