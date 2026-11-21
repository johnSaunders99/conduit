import {lazyChunk} from '../../ui/ChunkRecovery';
import LazyWorkspace from '../sql/LazyWorkspace';
import {catalogIndex,trackColor} from '../../content/catalog';
import {  Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, X, CornerDownLeft, RotateCcw } from 'lucide-react';
import type { Grade } from 'ts-fsrs';
import { useWork } from '../../ui/context';
import { CheckList, Empty, formats, Pill, Title } from '../../ui/common';
import {InlineConfirm,cancelWithEscape} from '../../ui/InlineConfirm';
import {ReviewPicker} from '../../ui/ReviewPicker';
import {usedSlots} from '../../lib/reviewPlan';
import {repeatAfter,sessionQueue} from '../../lib/relearning';
import { Forecast } from '../../ui/charts';
import { now, wall, shiftDay, studyDay } from '../../lib/clock';
import { estimate, present, queue, quizRating, interviewRating, shuffled, taskRating, type ReviewItem } from '../../lib/scheduler';
import type { Choice } from '../../lib/model';
import { rate, undoRating, type Undo } from '../../db';
import { voiceDefaults } from '../voice/types';
import { tone } from '../voice/tones';
const ReviewVoice=lazyChunk(()=>import('../voice/ReviewVoice'));
export function ReviewPage() {
  const {
      data,
      cat,
      day,
      s
    } = useWork(),
    nav = useNavigate(),
    [ch, set] = useState<Choice>({
      format: s.format,
      scope: s.scope,
      tracks: s.tracks
    });
  const used = usedSlots(data,day),
    nowAt = now(),
    q = queue(data.cards, ch, nowAt, s, false, used),
    ahead = queue(data.cards, ch, nowAt, s, true, used);
  function start(a: boolean) {
    const params = new URLSearchParams({
      format: ch.format,
      scope: ch.scope,
      tracks: ch.tracks.join(','),
      ahead: a ? '1' : '0'
    });
    nav('/session?' + params);
  }
  return <>
      <Title k="記憶練習　 /　間隔複習" title="複習" sub="把昨天的理解，練成明天還能想起的知識。" />
      <div className="track-grid review-tracks">{catalogIndex(cat).tracks.map(t => <div className={'panel stripe tone-' + t.color} key={t.id}>
          <Pill track={t.id} />
          <strong className="figure">{data.cards.filter(c => c.trackId === t.id && !c.suspended && +c.card.due <= +nowAt).length}</strong>
          <small>目前到期</small>
        </div>)}</div>
      <section className="panel">
        <h2>安排一輪複習</h2>
        <ReviewPicker value={ch} onChange={set} spacious />
        <p>本輪 {q.ids.length} 個知識點 · 約 {Math.ceil(estimate(present(q.ids, ch, cat, day, s.weights)))} 分鐘</p>
        {q.carry > 0 && <p>還有 {q.carry} 個延到明天</p>}
        {q.ids.length ? <button className="primary" onClick={() => start(false)}>開始複習 <ArrowRight size={16} /></button> : ahead.ids.length ? <>
          <p>這個範圍目前沒有到期的知識點。</p>
          <button onClick={() => start(true)}>提前複習</button>
        </> : <Empty>{used >= s.cap ? '今天已達複習上限，明天再接著走。' : data.cards.length ? '所選範圍沒有知識點，可以換個範圍。' : '完成第一堂課後，知識點就會出現在這裡。'}</Empty>}
      </section>
      <Forecast />
    </>;
}
const grades = [1, 2, 3, 4] as const,
  labels = ['', '忘了', '困難', '記得', '輕鬆'];
export function Session() {
  const {
      data,
      cat,
      day,
      s
    } = useWork(),
    [params] = useSearchParams(),
    nav = useNavigate(),
    question = cat.questions.find(q => q.id === params.get('q'));
  const [run] = useState(() => {
    const p = data.dayPlans.find(x => x.day === day),
      usePlan = params.get('plan') === '1' && p,
      opts = {
        format: params.get('format') ?? s.format,
        scope: params.get('scope') ?? s.scope,
        tracks: cat.tracks.filter(t => params.get('tracks')?.split(',').includes(t.id)).map(t => t.id)
      } as Choice,
      choose = usePlan || opts;
    const used = usedSlots(data,day),
      ids = usePlan ? usePlan.reviewIds.filter(id => !usePlan.reviewDone.includes(id)).slice(0, Math.max(0, s.cap - used)) : queue(data.cards, choose, now(), s, params.get('ahead') === '1', used).ids;
    const fallbackIds=params.get('uncovered')?.split(',')??[];
    const requested=params.has('uncovered')?fallbackIds.filter(id=>data.cards.some(c=>c.conceptId===id&&!c.suspended)).slice(0,Math.max(0,s.cap-used)):ids;
    const items: ReviewItem[] = question ? [{
      ids: question.conceptId ? [question.conceptId] : [],
      format: 'interview'
    }] : present(requested, choose, cat, day, s.weights);
    return {
      items,uncovered:choose.format==='sql'?ids.filter(id=>!items.some(i=>i.ids.includes(id))):[],
      day,
      started: wall(),
      seed: now().toISOString()
    };
  });
  const [i, setI] = useState(0),
    [ended, end] = useState(false),
    [exitPending,askExit]=useState(false),summaryHeading=useRef<HTMLHeadingElement>(null),
    [suggest,suggestSql]=useState<Grade>(),
    [revealed, reveal] = useState(false),
    [chosen, choose] = useState<number | null>(null),
    [text, type] = useState(''),
    [ticks, tick] = useState<boolean[]>([]),
    [since, start] = useState(wall),
    [history, record] = useState<{
      u: Undo;
      g: Grade | null;
      n: number;
      retry:boolean;
      repeat?:ReviewItem;
    }[]>([]),
    [canUndo, enableUndo] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const items=sessionQueue(run.items,history), item = items[i],
    c = cat.concepts.find(c => c.id === item?.ids[0]),
    iv = question ?? c?.interview,
    mcq = c?.mcq,
    opts = mcq ? shuffled(mcq.options.map((_, i) => i), run.seed + c?.id + ':' + i) : [],
    isEnd = ended || !item,
    coverage = iv ? ticks.filter(Boolean).length / iv.points.length : 0;
  const voice=s.voice??voiceDefaults;
  function chooseAnswer(n:number){choose(n);if(voice.sounds&&mcq)tone(n===mcq.answer?'correct':'wrong')}
  useEffect(()=>{if(isEnd&&history.length&&voice.sounds)tone('done')},[isEnd]);
  function clear() {
    suggestSql(undefined);reveal(false);
    choose(null);
    type('');
    tick([]);
    start(wall());
  }
  async function act(g: Grade | null) {
    if (lock.current || !item) return;
    lock.current = true;
    setBusy(true);
    if(voice.sounds&&g!==null&&item.format!=='quiz'&&item.format!=='sql')tone(g===1?'wrong':'correct');
    try {
      const qid = question?.id ?? c?.id,
        ans = item.format === 'interview' && qid ? {
          questionId: qid,
          text,
          coverage
        } : undefined,
        u = await rate(item.ids, g, item.format, wall() - since, run.day, s, ans, !!item.relearning);
      record(h => [...h, {
        u,
        g,
        n: question ? 1 : u.logs.length,
        retry:!!item.relearning,
        repeat:repeatAfter(item,g,u.cards.map(c=>c.conceptId),!!question)
      }]);
      enableUndo(true);
      setI(i + 1);
      setElapsed(wall() - run.started);
      clear();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function undo() {
    const last = history.at(-1);
    if (!canUndo || !last || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await undoRating(last.u);
      record(history.slice(0, -1));
      setI(Math.max(0, i - 1));
      end(false);
      enableUndo(false);
      clear();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function exit() {
    if (isEnd) {
      nav('/today');
      return;
    }
    if(!lock.current)askExit(true);
  }
  function finishEarly(){
    if(lock.current)return;
    setElapsed(wall() - run.started);
    end(true);
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (document.querySelector('dialog[open]') || e.repeat) return;
      const el = e.target as HTMLElement;
      if(el.isContentEditable||e.defaultPrevented||el.closest('.inline-confirm'))return;
      if(exitPending){
        cancelWithEscape(e,()=>askExit(false));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
        return;
      }
      if (el.matches('textarea,select,input:not([type=checkbox]):not([type=radio])')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void undo();
        return;
      }
      if (isEnd || busy || e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key.toLowerCase(),
        j = /^[1-5]$/.test(k) ? Number(k) - 1 : 'abcde'.indexOf(k);
      if(item.format==='sql'&&suggest&&/^[1-4]$/.test(k)){e.preventDefault();void act(Number(k) as Grade);return}
      if (item.format === 'quiz' && mcq && chosen === null && j >= 0 && j < opts.length) {
        e.preventDefault();
        chooseAnswer(opts[j]);
        return;
      }
      if ((k === ' ' || k === 'enter') && !revealed && ['flashcard', 'interview'].includes(item.format) && el.tagName !== 'BUTTON') {
        e.preventDefault();
        reveal(true);
      } else if (revealed && /^[1-4]$/.test(k) && ['flashcard', 'interview'].includes(item.format)) {
        e.preventDefault();
        void act(Number(k) as Grade);
      } else if (item.format === 'hands-on' && /^[1-4]$/.test(k)) {
        e.preventDefault();
        void act(([3, 2, 1, null] as const)[Number(k) - 1]);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(()=>{if(ended)summaryHeading.current?.focus()},[ended]);
  const retries=history.filter(h=>h.retry&&h.g!==null).reduce((n,h)=>n+h.n,0);
  const assessed = history.filter(h => !h.retry&&h.g !== null),
    n = assessed.reduce((n, h) => n + h.n, 0),
    good = assessed.reduce((n, h) => n + (h.g !== 1 ? h.n : 0), 0);
  const cards = data.cards.filter(c => history.some(h => h.u.cards.some(x => x.conceptId === c.conceptId))),
    dist = [0, 0, 0];
  for (const c of cards) {
    const d = studyDay(c.card.due, s.dayStartHour);
    dist[d <= run.day ? 0 : d <= shiftDay(run.day, 7) ? 1 : 2]++;
  }
  const rateButtons = (suggest?: Grade) => <div className="rating">{grades.map(g => <button key={g} className={'grade g' + g + (g === suggest ? ' suggested' : '')} onClick={() => act(g)} disabled={busy}>
        <kbd>{g}</kbd>
        {labels[g]}
        {g === suggest && <small>建議</small>}
      </button>)}</div>;
  const track=question?.track??c?.trackId??cat.modules.find(m=>m.id===item?.exercise?.moduleId)?.track;
  return <div className={'session'+(track?' tone-'+trackColor(cat,track):'')}>
      <div className="session-top">
        <span className="brand"><img src={import.meta.env.BASE_URL+"conduit.svg"} width="24" height="24" alt=""/>渠成</span>
        <span>{isEnd ? '複習回顧' : formats[item.format]}　·　{isEnd ? i : Math.min(i + 1, items.length)} / {items.length}</span>
        {isEnd?<button onClick={exit}>離開</button>:<InlineConfirm
          label="結束" confirmLabel="確定結束" message="已完成的評分會保留。"
          open={exitPending} disabled={busy} onOpenChange={askExit} onConfirm={finishEarly}/>}
      </div>
      <div className="progress-track review-channel" role="progressbar" aria-label="本輪複習進度" aria-valuemin={0} aria-valuemax={items.length||1} aria-valuenow={Math.min(i,items.length)}>
        <i style={{
        width: (items.length ? 100 * i / items.length : 0) + '%'
      }} />
      </div>
      {isEnd ? <section className="panel review-card">
        <span className="eyebrow">本輪回顧</span>
        <h1 ref={summaryHeading} tabIndex={-1}>{items.length ? '這一輪，練好了。' : '目前沒有待複習的題目'}</h1>
        <div className="metrics">
          <strong>
            {n}
            <small>首次評分</small>
          </strong>
          <strong>
            {n ? Math.round(good / n * 100) + '%' : '—'}
            <small>首次記得率</small>
          </strong>
          <strong>
            {Math.round(elapsed / 1000)}
            <small>經過秒數</small>
          </strong>
        </div>
        {!!run.uncovered.length&&<p>另有 {run.uncovered.length} 個到期知識點沒有 SQL 題。 <Link className="button" to={'/session?format=flashcard&uncovered='+encodeURIComponent(run.uncovered.join(','))}>現在用閃卡複習</Link></p>}
        <p className="retry-summary">再次練習 {retries} 個知識點／題，不重複計入首次評分。</p>
        <h3 className="next-due-heading">下一次到期</h3>
        <p>今天 {dist[0]} 個　·　一週內 {dist[1]} 個　·　更晚 {dist[2]} 個</p>
        <div className="actions">
          <Link className="button primary" to="/today">回到今天</Link>
          {canUndo && <button onClick={undo}>復原最後評分</button>}
        </div>
      </section> : <>
        <section key={i} className="panel review-card review-track">
          <div className="between">
            <div className="eyebrow">記憶練習　 /　{String(i + 1).padStart(2, '0')}</div>
            {(question || c) && <Pill track={question?.track ?? c!.trackId} />}
          </div>
          {item.relearning&&<span className="retry-flag">再練一次</span>}
          {item.fallback&&<p className="fallback-note">這個知識點沒有{item.fallback==='interview'?'面試題':item.fallback==='quiz'?'選擇題':'練習任務'}，改用閃卡</p>}
          {item.format==='sql'&&item.exercise?<><h1>{item.exercise.title}</h1><small>這道題涵蓋 {item.ids.length} 個知識點</small>
            <LazyWorkspace exercise={item.exercise} dataset={cat.datasets.find(d=>d.id===item.exercise!.dataset)!} source="review" onSuggest={g=>suggestSql(prev=>prev===1?1:g)}/>
            {suggest?rateButtons(suggest):<button onClick={()=>suggestSql(1)}>放棄這題</button>} <button onClick={()=>act(null)}>略過，不評分</button>
          </>:item.format === 'hands-on' && item.task ? <>
            <h1>{item.task.title}</h1>
            <small>{item.task.minutes} 分 · 一次複習 {item.ids.length} 個知識點</small>
            <ol>{item.task.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            <CheckList list={item.task.checks} checked={ticks} toggle={i => tick(item.task!.checks.map((_, j) => j === i ? !ticks[j] : !!ticks[j]))} />
            <div className="chips">{(['done', 'partial', 'failed', 'skip'] as const).map((v, i) => <button key={v} disabled={busy} onClick={() => act(taskRating(v))}>{['完成', '部分完成', '做不出來', '略過'][i]}</button>)}</div>
          </> : item.format === 'quiz' && mcq ? <>
            <h1>{mcq.question ?? c?.prompt}</h1>
            {voice.engine!=='off'&&c&&<Suspense fallback={null}><ReviewVoice id={c.id} mode="quiz" order={opts} answer={chosen!==null}/></Suspense>}
            <div className="choices">{opts.map((v, j) => <button key={v} className={chosen===null?'':v===mcq.answer?'correct':v===chosen?'wrong':''} disabled={chosen !== null} onClick={() => chooseAnswer(v)}>
                <kbd>{String.fromCharCode(65 + j)}</kbd>
                {mcq.options[v]}{chosen!==null&&(v===mcq.answer?<Check size={18} aria-label="正確答案"/>:v===chosen?<X size={18} aria-label="答錯了"/>:null)}
              </button>)}</div>
            {chosen !== null && <div className="reveal">
              <b>{chosen === mcq.answer ? '答對了。' : '再看一次：' + mcq.options[mcq.answer]}</b>
              <p>{mcq.explain}</p>
              <div className="actions">
                <button className="primary" disabled={busy} onClick={() => act(quizRating(chosen === mcq.answer))}>記錄並繼續</button>
                {chosen === mcq.answer && <button className="text-btn" onClick={() => act(quizRating(true, true))}>其實是猜的</button>}
              </div>
            </div>}
          </> : item.format === 'interview' && iv ? <>
            <h1>{iv.question}</h1>
            <Suspense fallback={null}><ReviewVoice id={(question?.id??c?.id)!} mode="interview" answer={revealed} onTime={()=>reveal(true)}/></Suspense>
            <label className="field">寫下你的回答（可略過）<textarea value={text} onChange={e => type(e.target.value)} readOnly={revealed} /></label>
            {revealed ? <div className="reveal">
              <h3>你的回答提到了哪些要點？</h3>
              <CheckList list={iv.points} checked={ticks} toggle={i => tick(iv.points.map((_, j) => j === i ? !ticks[j] : !!ticks[j]))} />
              <p className="reference-answer">
                <b>參考答案</b>
                <br />
                {iv.answer}
              </p>
              {rateButtons(interviewRating(coverage))}
            </div> : <button className="primary" onClick={() => reveal(true)}>對照參考答案 <CornerDownLeft size={15} /></button>}
          </> : <>
            <h1>{c?.prompt}</h1>
            {voice.engine!=='off'&&c&&<Suspense fallback={null}><ReviewVoice id={c.id} mode="flashcard" answer={revealed}/></Suspense>}
            {revealed ? <div className="reveal">
              <span className="eyebrow">答案</span>
              <p>{c?.answer}</p>
              {rateButtons()}
            </div> : <>
              <p>先在心裡說一次，再翻開答案。</p>
              <button className="primary" onClick={() => reveal(true)}>顯示答案 <CornerDownLeft size={15} /></button>
            </>}
          </>}
        </section>
        <div className="hint-row">
          <span>{item.format==='sql'?'Ctrl+Enter 執行 · Ctrl+Shift+Enter 檢查':item.format === 'quiz' ? 'A–E 或 1–5 選答案' : item.format === 'hands-on' ? '1–4 記錄練習' : 'Space 顯示答案 · 1–4 評分'}　·　Esc 結束</span>
          <button className="ghost" disabled={!canUndo || busy} onClick={undo}><RotateCcw size={14} /> 復原 Ctrl+Z</button>
        </div>
      </>}
    </div>;
}
