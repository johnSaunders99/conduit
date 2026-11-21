import {beforeAll,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {inspect} from '../tools/content.mjs';
import type {Exercise} from '../src/content/types';
import {checkExercise,resultSet} from '../src/lib/sqlCheck';
const require=createRequire(import.meta.url),duck=require('@duckdb/duckdb-wasm/blocking'),r=inspect('fixtures/content');
const exercises=r.sql.exercises as Exercise[];
let engine:Awaited<ReturnType<typeof duck.createDuckDB>>;
beforeAll(async()=>{
  const bundle=(id:string)=>({mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-'+id+'.wasm')});
  engine=await duck.createDuckDB({mvp:bundle('mvp'),eh:bundle('eh')},new duck.VoidLogger(),duck.NODE_RUNTIME);
  await engine.instantiate();
},30000);
const fresh=(id:string)=>async(statement:string,probe?:string)=>{
  engine.open({path:':memory:',query:{castDecimalToDouble:false,castBigIntToDouble:false}});
  const c=engine.connect();try{
    c.query('SET enable_external_access=false');c.query(r.setups[id]);
    if(probe)c.query(statement);
    return resultSet(c.query(probe??statement));
  }finally{c.close();engine.reset()}
};
it('executes, fails, passes with equivalent non-reference SQL and keeps learner examples private',async()=>{
  const ex=exercises[0],run=fresh(ex.dataset);
  expect((await run('SELECT * FROM orders')).rows).toHaveLength(5);
  const wrong=await checkExercise(ex,'SELECT city FROM orders',run);
  expect(wrong.verdict).toMatchObject({passed:false,message:'有 5 列不在答案裡'});expect(wrong.verdict.examples).toHaveLength(3);
  expect((await checkExercise(ex,'SELECT order_id AS different_name FROM orders ORDER BY order_id DESC',run)).verdict.passed).toBe(true);
});
it('checks UPDATE by probing separate clean copies; prior checks and experiments cannot leak state',async()=>{
  const ex=exercises.find(e=>e.check.mode==='state')!,run=fresh(ex.dataset);
  expect((await checkExercise(ex,'UPDATE readings SET litres=9',run)).verdict.passed).toBe(false);
  expect((await checkExercise(ex,'UPDATE readings SET litres=coalesce(litres,9)',run)).verdict.passed).toBe(true);
  expect((await run('SELECT litres FROM readings WHERE litres IS NULL')).rows).toEqual([[null]]);
});
it('shares the browser Arrow adapter for decimals, BIGINT, dates, timestamps, booleans, NULL and duplicate column names',async()=>{
  const run=fresh('shop'),res=await run("SELECT amount, count(*) OVER (), DATE '2026-01-02', TIMESTAMP '2026-01-02 12:30:45', true AS x, NULL AS x FROM orders ORDER BY order_id LIMIT 1");
  expect(res.columns.map(c=>c.type)).toEqual(['DECIMAL(8,2)','BIGINT','DATE','TIMESTAMP','BOOLEAN','INTEGER']);
  expect(res.columns.slice(-2).map(c=>c.name)).toEqual(['x','x']);
  expect(res.rows[0]).toEqual(['20.50',5n,'2026-01-02T00:00:00.000Z','2026-01-02T12:30:45.000Z',true,null]);
  const ex=exercises.find(e=>e.id.endsWith('-p4'))!;
  expect((await checkExercise(ex,'SELECT 12.66667',fresh(ex.dataset))).verdict.passed).toBe(true);
});
it('never exposes reference query text on a broken reference',async()=>{
  await expect(checkExercise({...exercises[0],solution:'SELECT unknown_column FROM orders'},'SELECT 1',fresh('shop'))).rejects.toThrow('參考結果未能產生，請檢查教材設定。');
});

it('maps scalar SQL types and renders signed, zero, nullable and decimals beyond double precision exactly',async()=>{
  const run=fresh('shop');
  const res=await run("SELECT 'A' txt, 1::INTEGER i, 1::DOUBLE dbl, -20.50::DECIMAL(8,2) n, 0::DECIMAL(8,2) z, NULL::DECIMAL(8,2) x, 123456789012345678901234567890.00100::DECIMAL(35,5) big");
  expect(res.columns.map(c=>c.type)).toEqual(['VARCHAR','INTEGER','DOUBLE','DECIMAL(8,2)','DECIMAL(8,2)','DECIMAL(8,2)','DECIMAL(35,5)']);
  expect(res.rows[0]).toEqual(['A',1,1,'-20.50','0.00',null,'123456789012345678901234567890.00100']);
});
it('still grades an exact decimal against the equivalent double or other scale',async()=>{
  const run=fresh('shop'),ex={...exercises[0],solution:'SELECT amount FROM orders WHERE amount=20.50'};
  expect((await checkExercise(ex,'SELECT 20.500001::DOUBLE',run)).verdict.passed).toBe(true);
  expect((await checkExercise(ex,'SELECT 20.5000::DECIMAL(10,4)',run)).verdict.passed).toBe(true);
  expect((await checkExercise(ex,"SELECT '20.50'",run)).verdict.passed).toBe(false);
});
