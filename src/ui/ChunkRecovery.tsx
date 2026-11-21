import {Component,lazy,useSyncExternalStore,type ComponentType,type ReactNode} from 'react';
import {chunkRecovery,isChunkLoadError,loadAppChunk} from '../lib/chunkRecovery';

export function lazyChunk<T extends ComponentType<any>>(loader:()=>Promise<{default:T}>,reloadOnNavigation=true){
  return lazy(()=>loadAppChunk(loader,reloadOnNavigation));
}
export function ChunkBanner({onReload}:{onReload:()=>void}){
  return <div className="notice chunk-notice" role="status">
    <span>渠成已更新，重新載入以繼續</span>
    <button type="button" onClick={onReload}>重新載入</button>
  </div>;
}
export function ChunkNotice(){
  const visible=useSyncExternalStore(chunkRecovery.subscribe,chunkRecovery.visible,()=>false);
  return visible?<ChunkBanner onReload={()=>window.location.reload()}/>:null;
}
export class ChunkBoundary extends Component<{children:ReactNode;route:string},{crashed:boolean;error?:unknown;route:string}>{
  state:{crashed:boolean;error?:unknown;route:string}={crashed:false,route:this.props.route};
  static getDerivedStateFromProps({route}:{route:string},state:{route:string}){
    return route===state.route?null:{route,crashed:false,error:undefined};
  }
  static getDerivedStateFromError(error:unknown){return {crashed:true,error}}
  componentDidCatch(error:unknown){chunkRecovery.report(error)}
  render(){
    if(!this.state.crashed)return this.props.children;
    if(isChunkLoadError(this.state.error))return null; // The main layout and update notice stay mounted.
    throw this.state.error;
  }
}
