import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Check,Mic,ShieldCheck,Square} from 'lucide-react';
import {Title} from '../../../ui/common';
import {InlineConfirm} from '../../../ui/InlineConfirm';
import {capture,type Take,type Capture} from './capture';
import script from './script.json';

const tones=[['calm','平靜講解','像平常教人，把轉折說清楚。'],['warm','溫暖鼓勵','放鬆一點，不用刻意提高音量。'],['formal','正式提問','像在面試，句尾保留提問的語氣。']] as const;
type Saved={id:string;duration:number;revision?:number};
type Draft=Take&{clipped:boolean};
type Phase='requesting'|'recording'|'finishing';
type Active={id:string;abort:AbortController;capture?:Capture;clipped:boolean};
const endpoint=(id?:string)=>'/api/voice-ref'+(id?'/'+id:'');
async function request<T>(id?:string,options?:RequestInit):Promise<T>{
  const res=await fetch(endpoint(id),options);
  if(!res.ok||!res.headers.get('content-type')?.includes('application/json')){
    const problem=await res.json().catch(()=>null);
    throw Error(problem?.error??'無法連到本機錄音服務。請用「啟動渠成.cmd」開啟。');
  }
  return res.json();
}
function Clip({blob,url,label}:{blob?:Blob;url?:string;label:string}){
  const [preview,set]=useState('');
  useEffect(()=>{
    if(!blob)return;
    const temp=URL.createObjectURL(blob);set(temp);return()=>URL.revokeObjectURL(temp);
  },[blob]);
  const src=blob?preview:url;
  return src?<audio aria-label={label} src={src} controls preload="none"/>:null;
}
const durationOK=(n:number)=>n>=3&&n<=10;
const target=(n:number)=>n>=5&&n<=8;
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
function recordError(e:unknown){
  if(e instanceof DOMException){
    if(e.name==='NotAllowedError'||e.name==='SecurityError')return '麥克風權限未開啟。請在瀏覽器允許這個本機網頁使用麥克風後再試。';
    if(e.name==='NotFoundError'||e.name==='NotReadableError')return '找不到可用的麥克風，或麥克風正被其他程式使用。';
    return '無法使用麥克風。請確認裝置可用後再試。';
  }
  return message(e);
}
export default function Recorder(){
  const page=useRef<HTMLDivElement>(null),active=useRef<Active>(),live=useRef(true);
  const [consent,setConsent]=useState(false),[status,setStatus]=useState<'loading'|'ready'|'failed'>('loading');
  const [saved,setSaved]=useState<Record<string,Saved>>({}),[drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [phase,setPhase]=useState<{id:string;name:Phase}>(),[level,setLevel]=useState(0),[clipped,setClipped]=useState(false);
  const [notice,setNotice]=useState<{text:string;error?:boolean}>(),[pending,setPending]=useState<string>(),[deleteId,setDelete]=useState<string>();
  async function refresh(){
    setStatus('loading');setNotice(undefined);
    try{
      const r=await request<{items:Saved[]}>();
      if(!Array.isArray(r.items))throw Error('無法讀取錄音清單。');
      if(live.current){setSaved(Object.fromEntries(r.items.map(item=>[item.id,item])));setStatus('ready')}
    }catch(e){if(live.current){setStatus('failed');setNotice({text:message(e),error:true})}}
  }
  useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;active.current?.abort.abort();active.current=undefined}},[]);
  async function record(id:string){
    if(!consent||active.current||pending||status!=='ready')return;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioWorkletNode||!globalThis.AudioContext){
      setNotice({text:'這個瀏覽器不支援本機錄音。請在 Chrome 或 Edge 用啟動檔開啟。',error:true});return;
    }
    page.current?.querySelectorAll('audio').forEach(a=>a.pause());
    const job:Active={id,abort:new AbortController(),clipped:false};
    active.current=job;setLevel(0);setClipped(false);setNotice(undefined);setPhase({id,name:'requesting'});
    try{
      job.capture=await capture(job.abort.signal,(level,peak)=>{
        if(active.current!==job)return;
        setLevel(Math.min(1,Math.sqrt(level)));
        if(peak>=.985&&!job.clipped){job.clipped=true;setClipped(true)}
      });
      if(active.current!==job)return;
      setPhase({id,name:'recording'});
      const take=await job.capture.result;
      if(active.current===job){
        setDrafts(current=>({...current,[id]:{...take,clipped:job.clipped}}));
        setNotice({text:'試錄已完成。先試聽，再選擇是否儲存。'});
      }
    }catch(e){if(active.current===job)setNotice({text:recordError(e),error:true})}
    finally{if(active.current===job){active.current=undefined;setPhase(undefined);setLevel(0)}}
  }
  function stop(){
    const job=active.current;if(!job)return;
    if(!job.capture){job.abort.abort();active.current=undefined;setPhase(undefined);return}
    setPhase({id:job.id,name:'finishing'});job.capture.stop();
  }
  async function persist(id:string){
    const draft=drafts[id];if(!draft||pending||active.current||!consent)return;
    setPending(id);setNotice(undefined);
    try{
      const info=await request<Saved>(id,{method:'PUT',headers:{'Content-Type':'audio/wav'},body:draft.wav});
      if(live.current){
        setSaved(v=>({...v,[id]:{...info,revision:(v[id]?.revision??0)+1}}));setDrafts(v=>{const copy={...v};delete copy[id];return copy});
        setNotice({text:'已儲存在這台電腦。'});
      }
    }catch(e){if(live.current)setNotice({text:message(e),error:true})}
    finally{if(live.current)setPending(undefined)}
  }
  async function remove(id:string){
    if(pending||active.current)return;
    setPending(id);setDelete(undefined);setNotice(undefined);
    try{
      await request(id,{method:'DELETE'});
      if(live.current){setSaved(v=>{const copy={...v};delete copy[id];return copy});setNotice({text:'已刪除儲存的錄音。'})}
    }catch(e){if(live.current)setNotice({text:message(e),error:true})}
    finally{if(live.current)setPending(undefined)}
  }
  const complete=tones.map(([tone])=>script.some(line=>line.tone===tone&&saved[line.id]&&target(saved[line.id].duration)));
  return <div className="reference-page" ref={page}>
    <Title k="聲線工作桌　/　試錄" title="錄製我的聲線" sub="用自己的語氣，錄下幾段清楚的台灣華語。"/>
    <section className="panel reference-consent" aria-labelledby="reference-consent">
      <ShieldCheck size={23} aria-hidden="true"/>
      <div><h2 id="reference-consent">錄音只留在這台電腦</h2>
        <p>儲存後，錄音和試錄稿會放在 <code>F:\ConduitTTS\ref\learner\</code>（預設位置），只用來合成渠成的課程語音。可以在這裡逐段刪除。</p>
        <label className="toggle"><input type="checkbox" checked={consent} disabled={!!phase||!!pending} onChange={e=>setConsent(e.target.checked)}/>我同意使用我的聲音，並允許這次錄音。</label>
      </div>
    </section>
    <div className="reference-status" aria-live="polite">
      {status==='loading'&&<p>正在查看本機錄音…</p>}
      {notice&&<p className={notice.error?'reference-warning':''}>{notice.text}</p>}
      {status==='failed'&&<button type="button" onClick={()=>void refresh()}>重新連線</button>}
    </div>
    {tones.map(([tone,label,nudge])=><section key={tone} className={'reference-tone reference-'+tone}>
      <div className="reference-section-title"><h2>{label}</h2><p>{nudge}</p></div>
      <div className="reference-grid">{script.filter(line=>line.tone===tone).map(({id,text})=>{
        const here=phase?.id===id?phase.name:undefined,draft=drafts[id],old=saved[id];
        return <article key={id} className="panel reference-line" aria-labelledby={'ref-'+id}>
          <div className="between"><span className="index">{id}</span><small>{label}</small></div>
          <p id={'ref-'+id} className="reference-transcript">{text}</p>
          <div className="actions">
            {here?<button type="button" className="primary" disabled={here==='finishing'} onClick={stop}><Square size={14}/>
              {here==='requesting'?'取消等待麥克風':here==='finishing'?'正在整理錄音…':'停止錄音'}</button>:
              <button type="button" disabled={!consent||!!phase||!!pending||status!=='ready'} onClick={()=>void record(id)}>
                <Mic size={15}/>{draft||old?'重新錄音':'錄音'}</button>}
          </div>
          {here==='recording'&&<div className="reference-meter"><small>麥克風音量</small><meter min={0} max={1} value={level} aria-label="麥克風音量"/>
            <small>最長 20 秒</small></div>}
          {(here&&clipped||!here&&draft?.clipped)&&<small className="reference-warning" role="status">有爆音。請離麥克風遠一點再錄。</small>}
          {!here&&draft&&<div className="reference-take">
            <small>未儲存試錄 · {draft.duration.toFixed(1)} 秒</small>
            {!durationOK(draft.duration)&&<small className="reference-warning">不在建議的 3–10 秒範圍內。</small>}
            <Clip blob={draft.wav} label={'試聽未儲存錄音 '+id}/>
            <button type="button" className="primary" disabled={!consent||!!phase||!!pending} onClick={()=>void persist(id)}>{old?'取代已儲存錄音':'儲存錄音'}</button>
          </div>}
          {!here&&old&&<div className="reference-take">
            <small><Check size={14}/> 已儲存 · {old.duration.toFixed(1)} 秒</small>
            {!durationOK(old.duration)&&<small className="reference-warning">不在建議的 3–10 秒範圍內。</small>}
            <Clip key={old.revision??0} url={endpoint(id)} label={'播放已儲存錄音 '+id}/>
            <InlineConfirm open={deleteId===id} onOpenChange={open=>setDelete(open?id:undefined)} label="刪除錄音" confirmLabel="確認刪除" message="這段已儲存的錄音和試錄稿會從本機刪除。" disabled={!!phase||!!pending} onConfirm={()=>void remove(id)}/>
          </div>}
        </article>;
      })}</div>
    </section>)}
    <section className="panel reference-check">
      <h2>每種語氣至少一段 5–8 秒</h2>
      <ul>{tones.map(([,label],i)=><li key={label}><span className={complete[i]?'reference-ok':''}>{complete[i]?'已完成':'待完成'}</span>{label}</li>)}</ul>
      <p>錄好後，告訴 Claude「用我的聲音」即可重新生成。</p>
      <Link to="/settings">回到設定</Link>
    </section>
  </div>;
}
