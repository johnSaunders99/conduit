import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {claimSessionReload,createChunkRecovery,isChunkLoadError,loadChunk,observePreload} from '../src/lib/chunkRecovery';
import {ChunkBanner,ChunkBoundary} from '../src/ui/ChunkRecovery';

const stale=new TypeError('Failed to fetch dynamically imported module: http://127.0.0.1:4320/assets/Playground-old.js');
function harness(shared=new Map<string,string>()){
  let address='#/today',clock=100;
  const reload=vi.fn();
  const storage={getItem:(k:string)=>shared.get(k)??null,setItem:(k:string,v:string)=>{shared.set(k,v)}};
  const state=createChunkRecovery({address:()=>address,now:()=>clock,claimReload:()=>claimSessionReload(storage),reload});
  return {state,reload,storage,go:(v:string)=>{address=v},tick:(ms:number)=>{clock+=ms}};
}
it('notifies from Vite preloads without cancelling the real rejection, and unregisters',()=>{
  const {state,reload}=harness(),target=new EventTarget(),listener=vi.fn();
  const stop=observePreload(target,state),unsubscribe=state.subscribe(listener);
  const css=Object.assign(new Event('vite:preloadError',{cancelable:true}),{payload:new Error('Unable to preload CSS for /assets/new.css')});
  expect(target.dispatchEvent(css)).toBe(true);
  expect(css.defaultPrevented).toBe(false);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(state.visible()).toBe(true);
  target.dispatchEvent(css);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  unsubscribe();stop();
  expect(isChunkLoadError(new Error('SQL query failed'))).toBe(false);
  expect(harness().state.report(new Error('component code failed'))).toBe(false);
});
it('reloads the destination once on a navigational lazy failure, even if a Vite event arrived first',async()=>{
  const shared=new Map<string,string>(),{state,reload,go}=harness(shared),target=new EventTarget();
  const stop=observePreload(target,state);
  go('#/voice');
  await expect(loadChunk(async()=>{
    target.dispatchEvent(Object.assign(new Event('vite:preloadError'),{payload:stale}));
    throw stale;
  },state)).rejects.toBe(stale);
  expect(state.visible()).toBe(true);
  expect(reload).toHaveBeenCalledTimes(1);
  await expect(loadChunk(async()=>{throw stale},state)).rejects.toBe(stale);
  expect(reload).toHaveBeenCalledTimes(1);
  stop();
  const next=harness(shared);
  next.go('#/voice'); // Even a second navigation in the reloaded document cannot loop.
  await expect(loadChunk(async()=>{throw stale},next.state)).rejects.toBe(stale);
  expect(next.state.visible()).toBe(true);
  expect(next.reload).not.toHaveBeenCalled();
});
it('does not auto-reload an initial route, a late interaction, or a chunk from a route already left',async()=>{
  const {state,reload,go,tick}=harness();
  await expect(loadChunk(async()=>{throw stale},state)).rejects.toBe(stale);
  go('#/sql');
  state.request();
  tick(9_000);
  await expect(loadChunk(async()=>{throw stale},state)).rejects.toBe(stale);
  go('#/settings');
  let reject!:(e:unknown)=>void;
  const pending=loadChunk(()=>new Promise((_,r)=>{reject=r}),state);
  go('#/today');reject(stale);
  await expect(pending).rejects.toBe(stale);
  expect(state.visible()).toBe(true);
  expect(reload).not.toHaveBeenCalled();
});
it('does not auto-reload optional narration or when session storage cannot prevent a loop',async()=>{
  const {state,reload,go}=harness();
  go('#/lesson/first');
  await expect(loadChunk(async()=>{throw stale},state,false)).rejects.toBe(stale);
  expect(reload).not.toHaveBeenCalled();
  expect(claimSessionReload({getItem:()=>null,setItem:()=>{throw new Error('storage blocked')}})).toBe(false);
  expect(claimSessionReload({getItem:()=>{throw new Error('storage blocked')},setItem:()=>{}})).toBe(false);
});
it('retains the app shell and offers a manual reload regardless of navigation',()=>{
  const html=renderToStaticMarkup(<><ChunkBanner onReload={()=>{}}/><ChunkBoundary route="a"><p>原頁面</p></ChunkBoundary></>);
  expect(html).toContain('渠成已更新，重新載入以繼續');
  expect(html).toContain('<button type="button">重新載入</button>');
  expect(html).toContain('原頁面');
});
