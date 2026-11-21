const chunkErrorMessage=/(?:failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading (?:css )?chunk .+ failed|unable to preload css)/i;
export function isChunkLoadError(error:unknown){
  if(typeof error==='string')return chunkErrorMessage.test(error);
  return !!error&&typeof error==='object'&&(
    ('name' in error&&error.name==='ChunkLoadError')||
    ('message' in error&&typeof error.message==='string'&&chunkErrorMessage.test(error.message))
  );
}

const retryKey='conduit:lazy-reload-once';
const navigationGraceMs=8_000;
type Host={
  address:()=>string;
  now:()=>number;
  claimReload:()=>boolean;
  reload:()=>void;
};
type Request={address:string;navigation:boolean};
export function createChunkRecovery(host:Host){
  let observed=host.address(),navigatedAt=-Infinity,visible=false,reloading=false;
  const listeners=new Set<()=>void>();
  return {
    visible:()=>visible,
    subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},
    // Capture the navigation at request time; a rejection may arrive several seconds later.
    request():Request {
      const address=host.address(),now=host.now();
      if(address!==observed){observed=address;navigatedAt=now}
      return {address,navigation:now-navigatedAt<=navigationGraceMs};
    },
    report(error:unknown,request?:Request){
      if(!isChunkLoadError(error))return false;
      if(!visible){visible=true;for(const fn of listeners)fn()}
      if(request?.navigation&&request.address===host.address()&&!reloading&&host.claimReload()){
        reloading=true;host.reload();
      }
      return true;
    }
  };
}
export type Recovery=ReturnType<typeof createChunkRecovery>;
export function claimSessionReload(storage:Pick<Storage,'getItem'|'setItem'>){
  try{
    if(storage.getItem(retryKey)!==null)return false;
    storage.setItem(retryKey,'1');return true;
  }catch{
    // Without a persistent guard a reload could loop. Keep the manual button.
    return false;
  }
}
export function observePreload(target:EventTarget,recovery:Recovery){
  const onError=(event:Event)=>{recovery.report((event as Event&{payload?:unknown}).payload)};
  target.addEventListener('vite:preloadError',onError);
  return ()=>target.removeEventListener('vite:preloadError',onError);
}
export async function loadChunk<T>(load:()=>Promise<T>,recovery:Recovery,reloadOnNavigation=true):Promise<T>{
  const request=recovery.request();
  try{return await load()}catch(error){
    recovery.report(error,reloadOnNavigation?request:undefined);
    // Keep the rejection so React's boundary receives the real error, not a missing module.
    throw error;
  }
}

export const chunkRecovery=createChunkRecovery({
  address:()=>typeof window==='undefined'?'':window.location.hash,
  now:()=>Date.now(),
  claimReload:()=>{try{return claimSessionReload(window.sessionStorage)}catch{return false}},
  reload:()=>window.location.reload()
});
export const loadAppChunk=<T,>(load:()=>Promise<T>,reloadOnNavigation=true)=>loadChunk(load,chunkRecovery,reloadOnNavigation);
