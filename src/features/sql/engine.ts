import * as duck from '@duckdb/duckdb-wasm';
import mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type {Exercise} from '../../content/types';
import {resultSet,checkExercise} from '../../lib/sqlCheck';

const bundles={mvp:{mainModule:mvp,mainWorker:mvpWorker},eh:{mainModule:eh,mainWorker:ehWorker}};
type Runtime={db:duck.AsyncDuckDB;lost:Promise<never>;opened:boolean;owner?:string;connection?:duck.AsyncDuckDBConnection};
let opening:Promise<Runtime>|undefined,active:Runtime|undefined,progress=0;
const listeners=new Set<(n:number)=>void>();
function report(n:number){progress=n;listeners.forEach(f=>f(n))}
export function listen(f:(n:number)=>void){listeners.add(f);f(progress);return ()=>{listeners.delete(f)}}
function discard(rt:Runtime,status:number){
  if(active!==rt)return;
  active=undefined;opening=undefined;void rt.db.terminate();report(status);
}
async function boot():Promise<Runtime>{
  report(0);
  const bundle=await duck.selectBundle(bundles),worker=new Worker(bundle.mainWorker!);
  const db=new duck.AsyncDuckDB(new duck.VoidLogger(),worker);
  let rejectLost!:(e:Error)=>void;
  const lost=new Promise<never>((_,reject)=>{rejectLost=reject});
  const rt:Runtime={db,lost,opened:false};active=rt;
  worker.addEventListener('error',()=>{discard(rt,-2);rejectLost(Error('SQL 工作程序已停止。請重新啟動引擎。'))},{once:true});
  await Promise.race([lost,db.instantiate(bundle.mainModule,null,p=>report(p.bytesTotal?Math.min(99,Math.round(100*p.bytesLoaded/p.bytesTotal)):0))]);
  report(100);return rt;
}
export function ready(){return opening??=boot().catch(e=>{if(active)discard(active,-2);else opening=undefined;throw e})}
const setups=new Map<string,Promise<string>>();
function setup(id:string){
  let entry=setups.get(id);
  if(!entry){entry=fetch(import.meta.env.BASE_URL+'content/datasets/'+encodeURIComponent(id)+'.sql').then(r=>{if(!r.ok)throw Error('無法讀取數據集。');return r.text()}).catch(e=>{setups.delete(id);throw e});setups.set(id,entry)}
  return entry;
}

// A single connection preserves temporary tables and transactions across Run.
// Switching workspaces, resetting or checking starts a new in-memory database.
async function connection(rt:Runtime,key:string,seed:string,fresh:boolean){
  if(!fresh&&rt.owner===key&&rt.connection)return rt.connection;
  rt.owner=undefined;
  if(rt.connection){await rt.connection.close();rt.connection=undefined}
  if(rt.opened)await rt.db.reset();
  await rt.db.open({path:':memory:',query:{castDecimalToDouble:false,castBigIntToDouble:false}});
  rt.opened=true;
  const c=await rt.db.connect();rt.connection=c;
  await c.query('SET enable_external_access=false');await c.query(seed);
  rt.owner=key;return c;
}
let tail=Promise.resolve();
export function job(key:string,dataset:string,sql:string,exercise:Exercise|undefined,signal:AbortSignal){
  const task=tail.then(async()=>{
    if(signal.aborted)throw Error('查詢已停止。');
    const rt=await ready(),seed=await setup(dataset);
    if(signal.aborted)throw Error('查詢已停止。');
    let rejectStop!:(e:Error)=>void;
    const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});
    const stop=()=>{discard(rt,-1);rejectStop(Error('查詢已停止。下次執行將重新載入數據集。'))};
    signal.addEventListener('abort',stop,{once:true});
    async function run(text:string,fresh:boolean,probe?:string){
      const c=await connection(rt,key,seed,fresh);
      if(probe)await c.query(text);
      return resultSet(await c.query(probe??text),exercise?Infinity:500);
    }
    const operation=async()=>{
      if(!exercise)return {actual:await run(sql,false),verdict:undefined};
      try{return await checkExercise(exercise,sql,(text,probe)=>run(text,true,probe))}
      finally{rt.owner=undefined} // Never expose the reference database to the next Run.
    };
    try{return await Promise.race([rt.lost,operation(),stopped])}finally{signal.removeEventListener('abort',stop)}
  });
  tail=task.then(()=>{},()=>{});return task;
}
