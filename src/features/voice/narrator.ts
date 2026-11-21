import {choosePack,pickVoice,activeTick,systemVoices} from './assets';
import {clipFor,selectSpeech,type Manifest,type Segment,type VoiceSettings} from './types';

export type Playback={state:'idle'|'loading'|'playing'|'paused'|'blocked';label:string};
type Controls={stop:()=>void;pause:()=>void;resume:()=>void;speed:(n:number)=>void};
type Result='end'|'unavailable'|'blocked'|'interrupted';
export type AudioChoice={manifest:Manifest|null;alternate:boolean};
type Job={id:symbol;queue:Segment[];prefs:VoiceSettings;interviewer:boolean;onState:(s:Playback)=>void;
  onSegment:(s:Segment)=>void;done:(result:Result)=>void;index:number;pauseCode:boolean;status:Playback['state'];label:string;
  current?:Controls;pack?:Manifest|null;alternate?:boolean;recorded?:boolean;timer?:ReturnType<typeof setInterval>};
let active:Job|undefined;
const update=(j:Job,state:Playback['state'],label=j.label)=>{
  if(active!==j)return;
  clearInterval(j.timer);
  if(state==='playing'){activeTick();j.timer=setInterval(activeTick,25_000)}
  j.status=state;j.label=label;j.onState({state,label});
};
function end(j:Job,result:Result){
  if(active!==j)return;
  update(j,result==='blocked'?'blocked':'idle');active=undefined;j.current?.stop();j.done(result);
}
export function stop(id:symbol){if(active?.id===id)end(active,'interrupted')}
export function playbackSpeed(id:symbol,speed:number){if(active?.id===id){active.prefs={...active.prefs,speed};active.current?.speed(rate(active))}}
const rate=(j:Job)=>j.prefs.speed*(j.interviewer&&!(j.alternate&&j.recorded) ? .95 : 1);
export function pause(id:symbol){const j=active;if(j?.id===id&&j.status==='playing'){j.current?.pause();update(j,'paused')}}
export function resume(id:symbol){const j=active;if(j?.id===id&&j.status==='paused'&&j.current){update(j,'playing');j.current.resume()}}
export function prepare(prefs:VoiceSettings,interviewer=false){if(prefs.engine!=='off')systemVoices();return prefs.engine==='pack'?choosePack(interviewer).catch(()=>({manifest:null,alternate:false})):Promise.resolve({manifest:null,alternate:false})}
export function narrate(input:Pick<Job,'id'|'queue'|'prefs'|'interviewer'|'onState'|'onSegment'|'done'|'pauseCode'>,manifest?:Promise<AudioChoice>){
  if(active)end(active,'interrupted');
  const j:Job={...input,index:0,status:'loading',label:''};active=j;update(j,'loading');
  if(!j.queue.length||j.prefs.engine==='off')return end(j,'unavailable');
  if(j.prefs.engine==='system'){play(j);return}
  void (manifest??prepare(j.prefs,j.interviewer)).then(({manifest,alternate})=>{if(active===j){j.pack=manifest;j.alternate=alternate;play(j)}});
}
function play(j:Job){
  if(active!==j)return;
  const seg=j.queue[j.index];
  if(!seg)return end(j,'end');
  j.onSegment(seg);
  const spoken=selectSpeech(seg,j.prefs.english),clip=clipFor(spoken,j.pack??null,j.prefs.engine);
  const advance=()=>{
    if(active!==j)return;
    j.current?.stop();j.current=undefined;
    if(seg.kind==='code-lead'&&j.pauseCode)return end(j,'blocked');
    j.index++;play(j);
  };
  const system=()=>{
    if(active!==j)return;
    j.recorded=false;
    const synth=globalThis.speechSynthesis;
    if(!synth||!globalThis.SpeechSynthesisUtterance)return end(j,'unavailable');
    const voice=pickVoice(j.prefs.systemVoice,j.interviewer), u=new SpeechSynthesisUtterance(spoken.speak);
    u.lang=voice?.lang??'zh-TW';if(voice)u.voice=voice;
    u.rate=rate(j);u.onend=advance;u.onerror=()=>end(j,'unavailable');
    let timer:ReturnType<typeof setTimeout>;
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>end(j,'unavailable'),Math.max(20000,spoken.speak.length*450))};
    j.current={stop:()=>{clearTimeout(timer);u.onend=u.onerror=null;if(synth.speaking||synth.pending||synth.paused)synth.cancel()},
      pause:()=>{clearTimeout(timer);synth.pause()},resume:()=>{arm();synth.resume()},speed:()=>{/* The next segment takes the new rate. */}};
    try{if(synth.paused)synth.resume();synth.speak(u);arm();update(j,'playing','系統聲線：'+(voice?.name??'台灣華語（預設）'))}catch{end(j,'unavailable')}
  };
  if(!clip||!globalThis.Audio)return system();
  j.recorded=true;
  const audio=new Audio(clip.url);
  let heard=false,token=0,timer:ReturnType<typeof setTimeout>;
  const failed=()=>{
    if(active!==j)return;
    j.current?.stop();j.current=undefined;
    if(heard)end(j,'unavailable');else system();
  };
  const start=()=>{
    clearTimeout(timer);timer=setTimeout(failed,Math.max(12000,clip.ms/rate(j)+12000));
    const current=++token;
    void audio.play().catch(()=>{if(current===token)failed()});
  };
  audio.playbackRate=rate(j);
  audio.onplaying=()=>{heard=true;update(j,'playing',clip.label)};
  audio.onended=advance;audio.onerror=failed;
  j.current={stop:()=>{++token;clearTimeout(timer);audio.onplaying=audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load()},
    pause:()=>{++token;clearTimeout(timer);audio.pause()},resume:start,speed:n=>{audio.playbackRate=n}};
  update(j,'loading',clip.label);start();
}
