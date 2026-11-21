import type {CardsSpeech,LessonSpeech,Manifest,VoiceInfo} from './types';

async function json<T>(url:string,signal?:AbortSignal):Promise<T>{
  const r=await fetch(url,{signal});if(!r.ok)throw Error(String(r.status));return r.json();
}
function content<T>(name:string){return json<T>(import.meta.env.BASE_URL+'content/speech/'+name+'.json')}
let cards:Promise<CardsSpeech>|undefined;
export const loadCards=()=>cards??=(content<CardsSpeech>('cards').catch(e=>{cards=undefined;throw e}));
export const loadLesson=(id:string)=>content<LessonSpeech>(encodeURIComponent(id));
export const loadKeys=()=>content<{keys:string[]}>('index');
const packCache=new Map<string,{until:number;data:Promise<Manifest|null>}>();
let discovery:{until:number;data:Promise<{found:boolean;voices:VoiceInfo[]}>}|undefined;
async function discover(){
  try{const v=await json<{found:boolean;voices:VoiceInfo[]}>('/api/audio',AbortSignal.timeout(2500));if(Array.isArray(v.voices))return v}catch{/* Static or offline app */}
  return {found:false,voices:[]};
}
export function packs(fresh=false){
  if(fresh||!discovery||discovery.until<Date.now())discovery={until:Date.now()+30000,data:discover()};
  return discovery.data;
}
export function loadPack(voiceId:string,fresh=false){
  const cached=packCache.get(voiceId);if(!fresh&&cached&&cached.until>Date.now())return cached.data;
  const data=json<Manifest>('/audio/'+encodeURIComponent(voiceId)+'/manifest.json',AbortSignal.timeout(2500)).catch(()=>null);
  packCache.set(voiceId,{until:Date.now()+30000,data});
  return data;
}
export async function choosePack(interviewer=false){
  const {voices}=await packs();
  const main=voices.find(v=>v.voiceId==='narrator')??voices[0];
  const second=voices.find(v=>v.voiceId==='interviewer'&&v!==main)??voices.find(v=>v!==main);
  const voice=interviewer?second??main:main;
  const manifest=voice?await loadPack(voice.voiceId):null;
  return {manifest,alternate:!!second&&interviewer};
}
export function systemVoices(){
  return (globalThis.speechSynthesis?.getVoices()??[]).filter(v=>/^zh(?:-|_)/i.test(v.lang)).sort((a,b)=>
    Number(isTaiwan(b))-Number(isTaiwan(a))||Number(isMale(b))-Number(isMale(a))||Number(b.localService)-Number(a.localService)||a.name.localeCompare(b.name));
}
const isTaiwan=(v:SpeechSynthesisVoice)=>/^(?:zh[-_](?:hant[-_])?tw)$/i.test(v.lang);
// The learner chose a male narrator (2026-11-20): prefer male Taiwan voices (Windows Zhiwei, Edge YunJhe) by default.
const isMale=(v:SpeechSynthesisVoice)=>/zhiwei|yunjhe|(?<!fe)male\b/i.test(v.name);
export function pickVoice(uri:string,alternate:boolean){
  const v=systemVoices(),tw=v.filter(isTaiwan),local=tw.filter(x=>x.localService);
  const main=v.find(x=>x.voiceURI===uri)??local[0];
  return alternate?(local.find(x=>x!==main&&isMale(x)===isMale(main))??main):main;
}
export function activeTick(){window.dispatchEvent(new Event('conduit:study-activity'))}
