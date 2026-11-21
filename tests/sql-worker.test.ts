import {it,expect,vi} from 'vitest';
import {Worker as Thread} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {inspect} from '../tools/content.mjs';
const require=createRequire(import.meta.url);
// Run the production workspace controller. Only bundle resolution, Web Worker
// transport and same-origin dataset fetch are adapted for this Node test.
vi.mock('@duckdb/duckdb-wasm',async()=>{
  const {createRequire}=await import('node:module'),req=createRequire(import.meta.url);
  return {...req('@duckdb/duckdb-wasm'),selectBundle:async()=>({
    mainWorker:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs'),
    mainModule:req.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm')
  })};
});
it('runs and grades via a real WASM worker, reuses it across workspaces and recovers after stopping an active query',async()=>{
  const threads:Thread[]=[];
  class LocalWorker extends EventTarget{
    thread:Thread;
    constructor(file:string){
      super();this.thread=new Thread(`
        const {workerData,parentPort}=require('node:worker_threads');
        globalThis.postMessage=(message,transfer)=>parentPort.postMessage(message,transfer);
        require(workerData);parentPort.on('message',data=>globalThis.onmessage({data}));`,{eval:true,workerData:file});
      threads.push(this.thread);this.thread.on('message',data=>this.dispatchEvent(Object.assign(new Event('message'),{data})));
      this.thread.on('error',e=>this.dispatchEvent(Object.assign(new Event('error'),{message:e.message})));
    }
    postMessage(message:unknown,transfer?:ArrayBuffer[]){this.thread.postMessage(message,transfer)}
    terminate(){return this.thread.terminate()}
  }
  const src='fixtures/content',fixture=inspect(src),fetchSetup=vi.fn(async(url:string)=>{
    const id=url.split('/').at(-1)!;return new Response(readFileSync(src+'/datasets/'+id.slice(0,-4)+'/setup.sql'));
  });
  vi.stubGlobal('Worker',LocalWorker);vi.stubGlobal('fetch',fetchSetup);
  try{
    const {job,ready}=await import('../src/features/sql/engine');
    const [a,b]=await Promise.all([ready(),ready()]);expect(a).toBe(b);
    const run=(sql:string,exercise?:typeof fixture.sql.exercises[number],ctl=new AbortController())=>job('bench',exercise?.dataset??'shop',sql,exercise,ctl.signal);
    expect((await run('SELECT * FROM orders')).actual.rowCount).toBe(5);
    const decimals=(await run('SELECT amount FROM orders WHERE amount=20.50 OR amount=0 ORDER BY amount')).actual;
    expect(decimals.columns[0].type).toBe('DECIMAL(8,2)');expect(decimals.rows).toEqual([['0.00'],['20.50']]);
    await run('CREATE TEMP TABLE scratch AS SELECT 7 AS n');expect((await run('SELECT n FROM scratch')).actual.rows).toEqual([[7]]);
    const ex=fixture.sql.exercises[0];expect((await run('SELECT city FROM orders',ex)).verdict?.passed).toBe(false);
    expect((await run('SELECT order_id FROM orders',ex)).verdict?.passed).toBe(true);
    const state=fixture.sql.exercises.find(e=>e.check.mode==='state');
    expect((await run(state.solution,state)).verdict?.passed).toBe(true);
    expect(threads).toHaveLength(1);expect(fetchSetup).toHaveBeenCalledTimes(2);
    const ctl=new AbortController(),pending=run('SELECT SUM(sqrt(i)) FROM range(1000000000) t(i)',undefined,ctl);
    const timer=setTimeout(()=>ctl.abort(),60);
    try{await expect(pending).rejects.toThrow('停止')}finally{clearTimeout(timer)}
    expect((await run('SELECT COUNT(*) FROM orders')).actual.rows).toEqual([[5n]]);
    expect(threads).toHaveLength(2);expect(fetchSetup).toHaveBeenCalledTimes(2);
  }finally{await Promise.all(threads.map(t=>t.terminate()));vi.unstubAllGlobals()}
},30000);
