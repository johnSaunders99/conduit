import {lazyChunk} from '../../ui/ChunkRecovery';
import {Suspense,useEffect,useId,useRef,useState} from 'react';
import {Database,Play,CheckCheck,Lightbulb} from 'lucide-react';
import type {Dataset,Exercise} from '../../content/types';
import {useWork} from '../../ui/context';
import {db,mutate} from '../../db';
import {now} from '../../lib/clock';
import type {SqlAttempt} from '../../lib/model';
import type {ResultSet,Verdict} from '../../lib/sqlGrade';
import {sqlRating} from '../../lib/sqlProgress';
import {InlineConfirm,cancelWithEscape} from '../../ui/InlineConfirm';
import type {Grade} from 'ts-fsrs';
import {ready,listen,job} from './engine';
import Editor from './Editor';
import {Grid} from './Grid';
import {voiceDefaults} from '../voice/types';
import {tone} from '../voice/tones';
const SqlVoice=lazyChunk(()=>import('../voice/SqlVoice'));

export type WorkspaceProps={dataset:Dataset;exercise?:Exercise;source:SqlAttempt['source'];onSuggest?:(g:Grade)=>void};
export default function Workspace({dataset,exercise:ex,source,onSuggest}:WorkspaceProps){
  const {s,data,day,notify}=useWork(), key=ex?.id??'free:'+dataset.id, viewId=useId(),
    draft=data.sqlDrafts.find(d=>d.key===key),
    [text,setText]=useState(draft?.text??ex?.starter??''),[percent,setPercent]=useState(0),[bootError,setBootError]=useState(''),[retry,setRetry]=useState(0),
    [generation,setGeneration]=useState(0),[checks,setChecks]=useState(0),[fails,setFails]=useState(0),[hints,showHints]=useState(0),[solution,showSolution]=useState(false),
    [pending,ask]=useState<'answer'|'reset'|null>(null),solutionHeading=useRef<HTMLHeadingElement>(null),
    [output,setOutput]=useState<ResultSet>(),[verdict,setVerdict]=useState<Verdict>(),[error,setError]=useState(''),[ms,setMs]=useState(0),
    [busy,setBusy]=useState(false),[slow,setSlow]=useState(false), active=useRef<AbortController>(),live=useRef(true),
    draftTimer=useRef<ReturnType<typeof setTimeout>>(),pendingText=useRef<string>();
  function flush(){
    clearTimeout(draftTimer.current);
    const value=pendingText.current;if(value===undefined)return;
    pendingText.current=undefined;
    void mutate(async()=>db.sqlDrafts.put({...await db.sqlDrafts.get(key),key,text:value,updatedAt:new Date().toISOString()})).catch(()=>notify('草稿未能儲存，請保留編輯器中的文字。'));
  }
  function edit(value:string){setText(value);pendingText.current=value;clearTimeout(draftTimer.current);draftTimer.current=setTimeout(flush,300)}
  useEffect(()=>{live.current=true;const hide=()=>{if(document.hidden)flush()};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',flush);
    return ()=>{live.current=false;active.current?.abort();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',flush);flush()}},[key]);
  useEffect(()=>{let mounted=true;const off=listen(setPercent);setBootError('');ready().catch(e=>{if(mounted)setBootError(String(e.message??e))});return ()=>{mounted=false;off()}},[retry]);
  useEffect(()=>{if(percent===-1)setRetry(n=>n+1);if(percent===-2)setBootError("SQL 工作程序已停止。")},[percent]);
  async function run(mode:'run'|'check'|'preview',query=text){
    if(active.current||(!query.trim()&&mode!=='preview'))return;
    const ctl=new AbortController();active.current=ctl;setBusy(true);setSlow(false);setError('');setOutput(undefined);setVerdict(undefined);flush();
    const timer=setTimeout(()=>setSlow(true),10000),start=performance.now(),checking=mode==='check'&&ex, n=checks+1;
    let passed=false,executed=false;
    try{
      const result=await job(key+':'+viewId+':'+generation,dataset.id,query,checking||undefined,ctl.signal);
      if(!live.current)return;
      setOutput(result.actual);setVerdict(result.verdict);passed=!!result.verdict?.passed;executed=true;
    }catch(e){if(live.current)setError(e instanceof Error?e.message:String(e))}
    finally{
      clearTimeout(timer);const elapsed=Math.round(performance.now()-start);
      try{
        if(checking&&!ctl.signal.aborted){
          await mutate(async()=>{
            await db.sqlAttempts.add({id:crypto.randomUUID(),exerciseId:ex.id,day,ts:now().toISOString(),sql:query,passed,checks:n,usedHint:hints>0,viewedSolution:solution,ms:elapsed,source});
            if(passed){const old=await db.practice.get(ex.id);await db.practice.put({taskId:ex.id,notes:old?.notes??'',status:[true]})}
          });
          if(live.current){if((s.voice??voiceDefaults).sounds)tone(passed?'correct':'wrong');setChecks(n);if(passed)onSuggest?.(sqlRating('pass',fails,hints>0,solution)!);else setFails(f=>f+1)}
        }else if(!ex&&mode==='run'&&!ctl.signal.aborted){
          await mutate(async()=>{const old=await db.sqlDrafts.get(key);await db.sqlDrafts.put({key,text:old?.text??query,updatedAt:new Date().toISOString(),history:[query,...(old?.history??[])].slice(0,20)})});
        }
      }catch{if(live.current)notify('這次紀錄未能儲存。')}
      finally{active.current=undefined;if(live.current){setBusy(false);setSlow(false);setMs(elapsed);if(!executed&&ctl.signal.aborted)setRetry(v=>v+1)}}
    }
  }
  function answer(){
    if(!ex)return;
    showSolution(true);onSuggest?.(sqlRating('solution',fails,hints>0)!);
  }
  function reset(){
    edit(ex?.starter??'');setOutput(undefined);setError('');setVerdict(undefined);setGeneration(n=>n+1);
  }
  const canRun=percent===100&&!busy&&!bootError&&!pending, auto=s.hintAfter>0&&fails>=s.hintAfter&&!hints&&!!ex?.hints.length;
  return <section className="sql-work" tabIndex={-1} aria-label={ex?.title??'自由練習'} onKeyDown={e=>{
    if(e.target instanceof HTMLElement&&!e.target.isContentEditable&&pending)cancelWithEscape(e,()=>ask(null));
  }}>
    {ex&&<><div className="sql-prompt prose" dangerouslySetInnerHTML={{__html:ex.promptHtml}}/>{(s.voice??voiceDefaults).engine!=='off'&&<Suspense fallback={null}><SqlVoice key={ex.id} id={ex.id}/></Suspense>}</>}
    <div className="schema"><div className="sql-caption"><b><Database size={14}/> 數據表</b><span>{dataset.title}</span></div>
      {dataset.tables.map(t=><details key={t.name} open={dataset.tables.length===1||undefined}><summary><code>{t.name}</code> · {t.summary}</summary>
        <dl>{t.columns.map(c=><div key={c.name}><dt>{c.name}</dt><dd><code>{c.type}</code> {c.note}</dd></div>)}</dl>
        <button className="text-btn" disabled={!canRun} onClick={()=>run('preview','SELECT * FROM "'+t.name.replaceAll('"','""')+'" LIMIT 5')}>預覽 5 列</button>
      </details>)}</div>
    <div className="sql-caption"><b>SQL 編輯器</b><span>DuckDB · 本機執行</span></div>
    <Editor dataset={dataset} value={text} change={edit} run={()=>{if(canRun)void run('run')}} check={ex?()=>{if(canRun)void run('check')}:undefined}/>
    <div className="sql-tools"><button data-run disabled={!canRun||!text.trim()} onClick={()=>run('run')}><Play size={14}/> 執行 <kbd>Ctrl+Enter</kbd></button>
      {ex&&<><button className="primary" disabled={!canRun||!text.trim()} onClick={()=>run('check')}><CheckCheck size={16}/> 檢查答案</button>
      {!!ex.hints.length&&<button disabled={busy||hints>=ex.hints.length} onClick={()=>showHints(h=>h+1)}><Lightbulb size={14}/>提示 ({hints}/{ex.hints.length})</button>}
      <InlineConfirm label="看解答" confirmLabel={source==='review'?'確定看解答（記為忘了）':'確定看解答'}
        open={pending==='answer'} disabled={busy||solution||pending==='reset'} onOpenChange={open=>ask(open?'answer':null)} onConfirm={answer} afterConfirm={solutionHeading}/></>}
      <InlineConfirm label="重設" confirmLabel="確定重設" message="編輯器與數據表會回到起始狀態，已記錄的檢查會保留。"
        open={pending==='reset'} disabled={busy||pending==='answer'} onOpenChange={open=>ask(open?'reset':null)} onConfirm={reset}/></div>
    <div role="status" aria-live="polite">
    {percent<100&&!bootError&&<p>正在啟動 SQL 引擎… <progress aria-label="引擎載入進度" max={100} value={percent||undefined}/></p>}
    {busy&&<p>{slow?'查詢超過 10 秒，可能少了 JOIN 條件？':'正在執行…'} {slow&&<button onClick={()=>active.current?.abort()}>停止</button>}</p>}
    {bootError&&<div className="sql-error">引擎未能啟動：{bootError} <button onClick={()=>setRetry(n=>n+1)}>重試</button></div>}
    {error&&<div className="sql-error"><b>查詢未完成</b><pre>{error}</pre></div>}
    {verdict&&<div className={verdict.passed?'sql-pass sql-pass-fill':'sql-error'}><b>{verdict.message}</b>{verdict.passed?<><small>第 {checks} 次檢查 · {ms} ms</small>{!solution&&<div className="prose" dangerouslySetInnerHTML={{__html:ex!.explainHtml}}/>}</>:verdict.examples?.map((r,i)=><pre key={i}>{r.map(v=>v===null?'NULL':String(v)).join('　│　')}</pre>)}</div>}
    {auto&&<p>要換個角度試試嗎？ <button onClick={()=>showHints(1)}>打開第一個提示</button></p>}
    </div>
    {hints>0&&<ol className="sql-hints">{ex?.hints.slice(0,hints).map((h,i)=><li key={i}>{h}</li>)}</ol>}
    {solution&&ex&&<div className="inset sql-solution">
      <h4 ref={solutionHeading} tabIndex={-1}>參考解答</h4>
      <div className="codebox"><pre>{ex.solutionCodeHtml===undefined?<code>{ex.solution}</code>:<code dangerouslySetInnerHTML={{__html:ex.solutionCodeHtml}}/>}</pre></div>
      <div className="prose" dangerouslySetInnerHTML={{__html:ex.explainHtml}}/>
    </div>}
    {output&&<Grid result={output} ms={ms}/>}
    {!ex&&!!draft?.history?.length&&<details><summary>最近查詢（{draft.history.length}）</summary>{draft.history.map((q,i)=><button className="query-history" key={i} onClick={()=>edit(q)}>{q}</button>)}</details>}
  </section>;
}
