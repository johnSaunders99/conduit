import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {Link} from 'react-router-dom';
import {Headphones,Pause,Play,SkipBack,SkipForward,X,ArrowRight,ChevronDown,Mic} from 'lucide-react';
import {voiceUpdate} from '../../db';
import {useWork} from '../../ui/context';
import {loadLesson} from './assets';
import {useNarration} from './useNarration';
import {speechSpeed,voiceDefaults,type LessonSpeech} from './types';

export default function LessonVoice({lessonId,body,open,onClose,initial}:{lessonId:string;body:RefObject<HTMLDivElement>;open:boolean;onClose:()=>void;initial?:number}){
  const {s}=useWork(),prefs=s.voice??voiceDefaults;
  const [lesson,setLesson]=useState<LessonSpeech|null>(null),[error,setError]=useState(false);
  const [n,setN]=useState(-1),[part,setPart]=useState(0);
  const started=useRef(false);
  const {playback,failed,start,stop,pause,resume}=useNarration(prefs);
  const {state,label}=playback,segments=lesson?.segments??[],sections=lesson?.sections??[];
  const key='conduit.voice.position.'+lessonId;
  useEffect(()=>{
    let live=true;
    loadLesson(lessonId).then(v=>{if(!live)return;
      const saved=readPosition(key,v.segments.length);
      setN(saved);setPart(v.segments[saved]?.part??0);setLesson(v);
    }).catch(()=>{if(live)setError(true)});
    return()=>{live=false};
  },[lessonId,key]);
  function remember(i:number){
    if(i<0||i>=segments.length)return;
    setN(i);setPart(segments[i].part??0);
    try{localStorage.setItem(key,String(i))}catch{/* Reading still works without storage. */}
  }
  function from(i:number,ignoreLead=false){
    const next=Math.min(segments.length-1,Math.max(0,i));
    if(next<0)return;
    remember(next);
    const first=ignoreLead&&segments[next]?.kind==='code-lead'?next+1:next;
    const queue=segments.slice(first).filter(x=>prefs.pauseCode||x.kind!=='code-lead');
    if(queue.length)start(queue,{onSegment:x=>remember(x.n),pauseCode:prefs.pauseCode});
    else{stop();remember(next)}
  }
  useEffect(()=>{
    if(!open){started.current=false;stop();return}
    if(lesson&&!started.current){started.current=true;from(initial??n)}
  },[lesson,open]);
  const focused=open&&prefs.highlight&&n>=0&&['playing','loading','paused','blocked'].includes(state);
  useLayoutEffect(()=>{
    const node=body.current;if(!node)return;
    const parts=node.querySelectorAll<HTMLElement>('[data-part]');
    const span=n<0?null:node.querySelector('.sg[data-sg="'+n+'"]');
    parts.forEach((x,i)=>{x.hidden=prefs.sectioned&&i!==part});
    node.classList.toggle('speech-focus',focused);
    node.style.setProperty('--speech-dim',String(prefs.dim/100));
    if(focused)span?.classList.add('sg-current');
    return()=>{span?.classList.remove('sg-current');node.classList.remove('speech-focus');parts.forEach(x=>{x.hidden=false})};
  },[body,lesson,n,part,focused,prefs.dim,prefs.sectioned]);
  useEffect(()=>{
    if(!open||n<0||!['playing','blocked'].includes(state))return;
    const el=body.current?.querySelector<HTMLElement>('.sg[data-sg="'+n+'"]');
    if(!el)return;
    const y=el.getBoundingClientRect().top;
    if(y<innerHeight*.23||y>innerHeight*.40){
      window.scrollTo({top:Math.max(0,window.scrollY+y-innerHeight/3),
        behavior:s.reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
  },[n,open,state,body,s.reduceMotion]);
  function selectPart(i:number,anchor?:string){
    if(!sections[i])return;
    if(open){stop();remember(sections[i].start)}
    else setPart(i);
    requestAnimationFrame(()=>{const target=anchor?document.getElementById(anchor):body.current?.querySelector('[data-part="'+i+'"]');target?.scrollIntoView({block:'start'})});
  }
  useEffect(()=>{
    const node=body.current;if(!node)return;
    const jump=(e:Event)=>{const {id}= (e as CustomEvent<{id:string}>).detail;
      const t=document.getElementById(id)?.closest<HTMLElement>('[data-part]');
      if(t)selectPart(Number(t.dataset.part),id);
    };
    const click=(e:MouseEvent)=>{
      const target=e.target as HTMLElement;
      if(!open||target.closest('a,button,input,textarea')||getSelection()?.toString())return;
      const sp=target.closest<HTMLElement>('.sg[data-sg]');
      if(sp)from(Number(sp.dataset.sg));
    };
    node.addEventListener('click',click);node.addEventListener('conduit:lesson-jump',jump);
    return()=>{node.removeEventListener('click',click);node.removeEventListener('conduit:lesson-jump',jump)};
  });
  const move=(by:number)=>{if(n+by>=0&&n+by<segments.length)from(n+by)};
  const toggle=()=>state==='playing'?pause():state==='paused'?resume():state==='loading'?stop():from(n,state==='blocked');
  const speed=(speed:number)=>voiceUpdate({speed:speechSpeed(speed)});
  const faster=(delta:number)=>voiceUpdate(v=>({speed:speechSpeed(v.speed+delta)}));
  useEffect(()=>{
    if(!open)return;
    const keydown=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||(e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable],dialog,[role="dialog"]'))return;
      const actions:Record<string,()=>unknown>={k:toggle,j:()=>move(-1),l:()=>move(1),',':()=>faster(-.1),'.':()=>faster(.1)};
      const action=actions[e.key.toLowerCase()];if(action){e.preventDefault();if(!e.repeat)action()}
    };
    window.addEventListener('keydown',keydown);
    return()=>window.removeEventListener('keydown',keydown);
  });
  const media=navigator.mediaSession;
  const usesMedia=open&&!!media&&['playing','paused','blocked'].includes(state);
  useEffect(()=>{
    if(!usesMedia)return;
    if(typeof MediaMetadata!=='undefined')media.metadata=new MediaMetadata({title:document.querySelector('.reader h1')?.textContent??'渠成朗讀',artist:'渠成'});
    return()=>{media.metadata=null;media.playbackState='none'};
  },[usesMedia,media]);
  useEffect(()=>{
    if(!usesMedia)return;
    media.playbackState=state==='playing'?'playing':'paused';
    const handlers:Partial<Record<MediaSessionAction,()=>void>>={play:()=>{if(state!=='playing')toggle()},pause,previoustrack:()=>move(-1),nexttrack:()=>move(1),stop};
    const bind=(name:MediaSessionAction,handler:MediaSessionActionHandler|null)=>{try{media.setActionHandler(name,handler)}catch{/* Optional on this browser. */}};
    for(const [name,fn] of Object.entries(handlers))bind(name as MediaSessionAction,fn);
    return()=>{for(const name of Object.keys(handlers))bind(name as MediaSessionAction,null)};
  });
  return <>
    {prefs.sectioned&&sections.length>0&&<div className="lesson-sections">
      <progress value={part+1} max={sections.length} aria-label="本課段落進度"/>
      <div className="between"><small>{part+1} / {sections.length} · {sections[part]?.title}</small>
        <div className="actions"><button type="button" disabled={part===0} onClick={()=>selectPart(part-1)}>上一段</button>
        <button type="button" disabled={part>=sections.length-1} onClick={()=>selectPart(part+1)}>下一段 <ArrowRight size={14}/></button></div>
      </div>
    </div>}
    {open&&<div className="lesson-player" role="group" aria-label="課文朗讀控制" style={{'--spoken-progress':segments.length?((n+1)/segments.length*100)+'%':'0%'} as CSSProperties}>
      <div className="player-progress" aria-hidden="true"/>
      <div className="player-buttons">
        <button type="button" title="上一句（J）" aria-label="上一句" disabled={n<=0} onClick={()=>move(-1)}><SkipBack size={16}/></button>
        <button type="button" className="primary" title="播放／暫停（K）" disabled={!segments.length} onClick={toggle}>{state==='playing'?<Pause size={16}/>:<Play size={16}/>} {state==='playing'?'暫停':state==='loading'?'停止':state==='blocked'?'繼續':'播放'}</button>
        <button type="button" title="下一句（L）" aria-label="下一句" disabled={n>=segments.length-1} onClick={()=>move(1)}><SkipForward size={16}/></button>
      </div>
      <details className="player-label player-voice">
        <summary><Headphones size={15}/><span aria-live="polite">{error?'未能載入朗讀內容。':failed?'無法播放這一句。':state==='blocked'?'程式碼暫停 · 看完後按「繼續」':label||'正在準備聲線…'}</span>
          {segments.length>0&&<small>{n+1}/{segments.length}</small>}<ChevronDown size={13}/></summary>
        <div className="voice-popover"><Link to="/voice" onClick={stop}><Mic size={16}/>錄製我的聲線</Link>
          <Link to="/settings" onClick={stop}>朗讀設定</Link></div>
      </details>
      <label className="player-speed">速度 <select aria-label="朗讀速度" value={prefs.speed} onChange={e=>void speed(+e.target.value)}>{Array.from({length:9},(_,i)=>.8+i/10).map(s=><option key={s} value={+s.toFixed(1)}>{s.toFixed(1)}×</option>)}</select></label>
      <button type="button" title="關閉朗讀" aria-label="關閉朗讀" onClick={()=>{stop();onClose()}}><X size={16}/></button>
    </div>}
  </>;
}
function readPosition(k:string,length:number){try{const v=Number(localStorage.getItem(k));return Number.isInteger(v)&&v>=0&&v<length?v:0}catch{return 0}}
