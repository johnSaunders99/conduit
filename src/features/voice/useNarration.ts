import {useCallback,useEffect,useRef,useState} from 'react';
import {narrate,pause,playbackSpeed,prepare,resume,stop,type Playback,type AudioChoice} from './narrator';
import type {Segment,VoiceSettings} from './types';
export function useNarration(prefs:VoiceSettings,interviewer=false){
  const id=useRef(Symbol()), p=useRef<Promise<AudioChoice>>(), live=useRef(true);
  const [playback,set]=useState<Playback>({state:'idle',label:''}),[failed,error]=useState(false);
  useEffect(()=>{live.current=true;return()=>{live.current=false;stop(id.current)}},[]);
  useEffect(()=>{p.current=prepare(prefs,interviewer);return()=>stop(id.current)},[prefs.engine,interviewer]);
  useEffect(()=>playbackSpeed(id.current,prefs.speed),[prefs.speed]);
  const start=useCallback((queue:Segment[],options:{
    onSegment?:(s:Segment)=>void; onEnd?:()=>void; onInterrupted?:()=>void; pauseCode?:boolean
  }={})=>{
    error(false);
    narrate({id:id.current,queue,prefs,interviewer,pauseCode:!!options.pauseCode,onState:s=>{if(live.current)set(s)},
      onSegment:options.onSegment??(()=>{}),done:r=>{
        if(!live.current)return;
        if(r==='unavailable')error(true);
        if(r==='end'||r==='unavailable')options.onEnd?.();
        if(r==='interrupted')options.onInterrupted?.();
      }},p.current);
  },[prefs,interviewer]);
  return {playback,failed,start,pause:()=>pause(id.current),resume:()=>resume(id.current),stop:()=>stop(id.current)};
}
