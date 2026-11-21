import {it,expect} from 'vitest';
import {gradeSql,type Cell,type ResultSet} from '../src/lib/sqlGrade';
import {sqlRating} from '../src/lib/sqlProgress';
const col=(name:string,type='Int32')=>({name,type});
const table=(rows:Cell[][],columns=[col('id')]):ResultSet=>({columns,rows});
it('reports width, then optional case-insensitive column names, then row count',()=>{
  const r=table([[1]]);
  expect(gradeSql(table([[1,2]],[col('a'),col('b')]),r).message).toContain('你的結果 2 欄');
  expect(gradeSql(table([[1]],[col('x')]),r).passed).toBe(true);
  expect(gradeSql(table([[1]],[col('ID')]),r,{columnNames:true}).passed).toBe(true);
  expect(gradeSql(table([[1]],[col('x')]),r,{columnNames:true}).message).toContain('欄名');
  expect(gradeSql(table([]),r).message).toContain('你 0 列，答案 1 列');
});
it('accepts multiset reordering, counts duplicate rows once and shows only learner rows',()=>{
  const r=table([[1],[2],[2],[null]]);
  expect(gradeSql(table([[2],[1],[null],[2]]),r).passed).toBe(true);
  expect(gradeSql(table([[2],[1],[null],[2]]),r,{ordered:true}).message).toBe('第 1 列開始順序不同');
  expect(gradeSql(table([[1],[1],[1],[null]]),r)).toMatchObject({passed:false,message:'有 2 列不在答案裡',examples:[[1],[1]]});
});
it('keeps NULL, booleans and strings distinct and limits examples to three',()=>{
  expect(gradeSql(table([[null],[true],['01'],['X']]),table([['NULL'],[1],[1],['x']])).examples).toHaveLength(3);
});
it('compares BIGINT, DOUBLE and near-zero and large values with configured tolerance',()=>{
  expect(gradeSql(table([[12n],[0.0000001],[1000000.4]]),table([[12],[0],[1000000]])).passed).toBe(true);
  expect(gradeSql(table([[1.1]]),table([[1]]),{tolerance:0.001}).passed).toBe(false);
  expect(gradeSql(table([[9007199254740993n]]),table([[9007199254740992]]),{tolerance:0}).passed).toBe(false);
});
it('finds a matching permutation when tolerance intervals overlap',()=>{
  expect(gradeSql(table([[0.05],[0]]),table([[0],[0.14]]),{tolerance:.1}).passed).toBe(true);
});
it('normalises DATE and TIMESTAMP representations without parsing arbitrary VARCHAR values',()=>{
  expect(gradeSql(table([[new Date('2026-01-02Z')]],[col('day','Date32')]),table([['2026-01-02T00:00:00Z']],[col('time','Timestamp')])).passed).toBe(true);
  expect(gradeSql(table([['1']],[col('x','Utf8')]),table([[1]])).passed).toBe(false);
});
it('accepts an empty reference only when explicitly allowed; state probes follow identical checks',()=>{
  expect(gradeSql(table([]),table([])).passed).toBe(false);
  expect(gradeSql(table([]),table([]),{allowEmpty:true}).passed).toBe(true);
  expect(gradeSql(table([[9]]),table([[9]]),{mode:'state'}).passed).toBe(true);
  expect(gradeSql(table([[null]]),table([[9]]),{mode:'state'}).passed).toBe(false);
});
it.each([['pass',0,false,false,3],['pass',1,false,false,3],['pass',2,false,false,2],['pass',0,true,false,2],['pass',0,false,true,1],['solution',0,false,false,1],['giveup',0,false,false,1],['skip',2,true,true,null]] as const)('maps %s / %d failures / hint %s / viewed %s', (out,fails,hint,viewed,want)=>expect(sqlRating(out,fails,hint,viewed)).toBe(want));
