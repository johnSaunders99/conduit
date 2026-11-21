import {it,expect} from 'vitest';
import type {SqlAttempt} from '../src/lib/model';
import {firstSqlPassRate,sqlRating} from '../src/lib/sqlProgress';

const day='2026-11-20',from='2026-10-22';
const attempt=(exerciseId:string,changes:Partial<SqlAttempt>={}):SqlAttempt=>({
  id:exerciseId,exerciseId,day,ts:day+'T12:00:00Z',sql:'SELECT 1',passed:true,checks:1,
  usedHint:false,viewedSolution:false,ms:1,source:'playground',...changes
});

it.each([[{usedHint:true},2],[{viewedSolution:true},1],[{usedHint:true,viewedSolution:true},1]] as const)(
  'assistance %j disqualifies a first-check pass and changes the review suggestion',
  (e,grade)=>{
    const a=attempt('assisted',e);
    expect(firstSqlPassRate([a],from,day)).toBe(0);
    expect(sqlRating('pass',0,a.usedHint,a.viewedSolution)).toBe(grade);
  },
);
it('uses the earliest logged check per exercise; retries never turn an assisted or failed check into a first pass',()=>{
  const attempts=[
    attempt('assisted',{ts:day+'T12:01:00Z'}),
    attempt('failed',{ts:day+'T12:01:00Z',checks:2}),
    attempt('assisted',{usedHint:true}),
    attempt('failed',{passed:false}),
    attempt('clean'),
    attempt('late-import',{checks:2}),
    attempt('older',{day:'2026-10-21',ts:'2026-10-21T12:00:00Z'}),
    attempt('older'),
  ];
  expect(firstSqlPassRate(attempts,from,day)).toBe(25);
  expect(firstSqlPassRate([],from,day)).toBeNull();
});
