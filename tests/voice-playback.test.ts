import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {narrate,stop,pause,resume} from '../src/features/voice/narrator';
import {pickVoice} from '../src/features/voice/assets';
import {clipFor,optionSequence,voiceDefaults,type CardsSpeech,type Manifest,type Segment} from '../src/features/voice/types';

const spoken:Utterance[]=[],audio:Clip[]=[];
const synth={
  getVoices:()=>[
    {voiceURI:'web',name:'Online',lang:'zh-TW',localService:false},
    {voiceURI:'other',name:'Other',lang:'zh-CN',localService:true},
    {voiceURI:'a',name:'Hanhan',lang:'zh-TW',localService:true},
    {voiceURI:'b',name:'Yating',lang:'zh-TW',localService:true},
    {voiceURI:'c',name:'Microsoft Zhiwei - Chinese (Traditional, Taiwan)',lang:'zh-TW',localService:true},
  ],
  speak:vi.fn((u:Utterance)=>spoken.push(u)),pause:vi.fn(),resume:vi.fn(),cancel:vi.fn(),
  speaking:true,pending:false,paused:false,
};
class Utterance {
  voice?:SpeechSynthesisVoice; rate=1;lang='';
  onend:(()=>void)|null=null;onerror:(()=>void)|null=null;
  constructor(readonly text:string){}
}
class Clip {
  onplaying:(()=>void)|null=null;onended:(()=>void)|null=null;onerror:(()=>void)|null=null;
  playbackRate=1;pause=vi.fn();play=vi.fn(async()=>{});load=vi.fn();removeAttribute=vi.fn();
  constructor(readonly src:string){audio.push(this)}
}
const id=Symbol(),other=Symbol();
const a:Segment={speak:'第一句。',key:'a',n:0,text:'第一句。',kind:'sentence'};
const b:Segment={speak:'第二句。',key:'b',n:1,text:'第二句。',kind:'sentence',english:{speak:'第二句，B。',key:'b-en'}};
const pack:Manifest={voiceId:'narrator',voiceLabel:'曉晴',engine:'mock',version:'1',items:{a:{file:'01/a.opus',ms:300}}};
const job=(queue:Segment[],prefs=voiceDefaults)=>({id,queue,prefs,interviewer:false,pauseCode:true,onState:vi.fn(),onSegment:vi.fn(),done:vi.fn()});
beforeEach(()=>{
  spoken.length=audio.length=0;
  vi.stubGlobal('speechSynthesis',synth);vi.stubGlobal('SpeechSynthesisUtterance',Utterance);vi.stubGlobal('Audio',Clip);vi.stubGlobal('window',new EventTarget());
});
afterEach(()=>{stop(id);stop(other);vi.unstubAllGlobals();vi.clearAllMocks()});
const settled=async()=>{await Promise.resolve();await Promise.resolve()};
it('chooses the offline male Taiwan voice by default, keeps the interviewer male, respects explicit selections',()=>{
  const zhiwei='Microsoft Zhiwei - Chinese (Traditional, Taiwan)';
  expect(pickVoice('',false)?.name).toBe(zhiwei);expect(pickVoice('',true)?.name).toBe(zhiwei);
  expect(pickVoice('a',false)?.name).toBe('Hanhan');expect(pickVoice('a',true)?.name).toBe('Yating');
  expect(pickVoice('web',false)?.name).toBe('Online');expect(clipFor(a,pack,'system')).toBeNull();
});
it('plays one prerecorded segment and falls back to one system utterance for the next key',async()=>{
  const j=job([a,b],{...voiceDefaults,english:true});
  narrate(j,Promise.resolve({manifest:pack,alternate:false}));await settled();
  expect(audio[0].src).toBe('/audio/narrator/01/a.opus');expect(spoken).toHaveLength(0);
  audio[0].onplaying?.();expect(j.onState).toHaveBeenLastCalledWith({state:'playing',label:'預錄聲線：曉晴'});
  pause(id);expect(audio[0].pause).toHaveBeenCalled();resume(id);
  audio[0].onended?.();
  expect(spoken).toHaveLength(1);expect(spoken[0].text).toBe('第二句，B。');
  expect(j.onState).toHaveBeenLastCalledWith({state:'playing',label:'系統聲線：Microsoft Zhiwei - Chinese (Traditional, Taiwan)'});
  spoken[0].onend?.();expect(j.done).toHaveBeenCalledWith('end');
});
it('retries missing media only before playback has begun, then keeps segment engines separate',async()=>{
  const j=job([a,b]);narrate(j,Promise.resolve({manifest:pack,alternate:false}));await settled();
  audio[0].onerror?.();expect(spoken[0].text).toBe(a.speak);spoken[0].onend?.();expect(spoken[1].text).toBe(b.speak);
  stop(id);const k=job([a]);narrate(k,Promise.resolve({manifest:pack,alternate:false}));await settled();
  audio[1].onplaying?.();audio[1].onerror?.();expect(spoken).toHaveLength(2);expect(k.done).toHaveBeenCalledWith('unavailable');
});
it('waits after a code lead and cancels old segments on navigation or another owner',async()=>{
  const f=job([{...a,kind:'code-lead'},b],{...voiceDefaults,engine:'system'});
  narrate(f);spoken[0].onend?.();expect(f.done).toHaveBeenCalledWith('blocked');expect(spoken).toHaveLength(1);
  let release!:(p:{manifest:Manifest;alternate:boolean})=>void;
  const old=job([a]);narrate(old,new Promise(r=>{release=r}));
  const next={...job([b],{...voiceDefaults,engine:'system'}),id:other,interviewer:true};narrate(next);
  release({manifest:pack,alternate:false});await settled();
  expect(old.done).toHaveBeenCalledWith('interrupted');expect(audio).toHaveLength(0);
  expect(spoken[1].rate).toBe(.95);expect(spoken[1].voice?.name).toBe('Microsoft Zhiwei - Chinese (Traditional, Taiwan)');
  stop(other);expect(spoken[1].onend).toBeNull();
});
it('announces choice letters in the shuffled visual order without reading the explanation early',()=>{
  const mcq={question:[a],options:[[a],[b]],explain:[{...a,text:'解說'}]};
  const letters=Array.from('AB',text=>[{...a,text}]);
  expect(optionSequence({optionLetters:letters} as CardsSpeech,mcq,[1,0]).map(x=>x.text)).toEqual([a.text,'A',b.text,'B',a.text]);
});
