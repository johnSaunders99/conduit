import {lazyChunk} from '../../ui/ChunkRecovery';
import {trackColor} from '../../content/catalog';
import { TrackArt } from '../../ui/TrackArt';
import { voiceDefaults } from '../voice/types';
import { tone, unlockTones } from '../voice/tones';
import LabNotice from './LabNotice';
import LazyWorkspace from '../sql/LazyWorkspace';
import {  Suspense, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Check, ExternalLink, Headphones, Terminal } from 'lucide-react';
import { useWork } from '../../ui/context';
import { Empty, Pill, CheckList, levels } from '../../ui/common';
import { blockers, available } from '../../lib/planner';
import { loadBody } from '../../content/loader';
import type { Body, ManualPractice, Lesson as LessonType } from '../../content/types';
import { openLesson, completeLesson, db, mutate } from '../../db';
import { shuffled } from '../../lib/scheduler';
const LessonVoice=lazyChunk(()=>import('../voice/LessonVoice'),false);
function PracticeBox({
  task
}: {
  task: ManualPractice;
}) {
  const {
      data
    } = useWork(),
    saved = data.practice.find(p => p.taskId === task.id) ?? {
      taskId: task.id,
      notes: '',
      status: task.checks.map(() => false)
    };
  const update = (f: (r: typeof saved) => typeof saved) => mutate(async () => db.practice.put(f((await db.practice.get(task.id)) ?? saved)));
  return <section className="practice inset">
      <div className="eyebrow"><Terminal size={16} />動手做 · {task.minutes} 分</div>
      <h3>{task.title}</h3>
      <ol>{task.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
      <CheckList list={task.checks} checked={saved.status} toggle={i => update(r => ({
      ...r,
      status: task.checks.map((_, j) => j === i ? !r.status[j] : !!r.status[j])
    }))} />
      <label className="field">練習筆記<textarea defaultValue={saved.notes} onBlur={e => {
        const notes = e.target.value;
        if (notes !== saved.notes) void update(r => ({
          ...r,
          notes
        }));
      }} /></label>
      {task.solution && <details>
        <summary>參考做法</summary>
        {task.solutionHtml ? <div className="prose" dangerouslySetInnerHTML={{
        __html: task.solutionHtml
      }} /> : <pre className="wrap">{task.solution}</pre>}
      </details>}
    </section>;
}
export default function LessonPage() {
  const {
      id
    } = useParams(),
    {
      cat,
      done
    } = useWork(),
    [allow, set] = useState(false),
    l = cat.lessons.find(x => x.id === id);
  if (!l || l.status !== 'ready') return <Empty>{l ? '這堂課的內容正在準備中。' : '找不到這堂課。'}</Empty>;
  const bs = blockers(l, cat, done);
  if (bs.length && !allow && !done.has(l.id)) return <section className="panel">
      <Pill track={cat.modules.find(m => m.id === l.module)!.track} />
      <h1>{l.title}</h1>
        {l.subtitle&&<p className="lesson-subtitle">{l.subtitle}</p>}
      <p>建議先完成：{bs.map(id => [...cat.modules, ...cat.lessons].find(x => x.id === id)?.title).join('、')}</p>
      <div className="actions">
        <Link className="button" to="/map">回學習地圖</Link>
        <button onClick={() => set(true)}>仍要開始</button>
      </div>
    </section>;
  return <Reader key={l.id} lesson={l} />;
}
function Reader({
  lesson: l
}: {
  lesson: LessonType;
}) {
  const {
      cat,
      data,
      s,
      day,
      done,
      notify
    } = useWork(),
    [body, setBody] = useState<Body | null>(null),
    [err, setErr] = useState(''),
    [revealed, reveal] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [voiceOpen,setVoiceOpen]=useState(false),[voiceStart,setVoiceStart]=useState<number>(),[filled,fill]=useState(false),
    ref = useRef<HTMLDivElement>(null),
    heading=useRef<HTMLElement>(null),animation=useRef<IntersectionObserver>(),
    saveY = useRef(0);
  const m = cat.modules.find(x => x.id === l.module)!,
    cs = cat.concepts.filter(c => c.lessonId === l.id),
    checks = cs.slice(0, 4),
    pg = data.lessonProgress.find(p => p.lessonId === l.id),
    answers = pg?.quizResult ?? {},voice=s.voice??voiceDefaults;
  useEffect(()=>()=>animation.current?.disconnect(),[]);
  useEffect(() => {
    let live = true;
    openLesson(l.id).then(() => db.lessonProgress.get(l.id)).then(p => {
      saveY.current = p?.scrollY ?? 0;
      return loadBody(l.id);
    }).then(b => {
      if (live) setBody(b);
    }).catch(() => {
      if (live) setErr('課文未能開啟，請回地圖重試。');
    });
    return () => {
      live = false;
    };
  }, [l.id]);
  useLayoutEffect(() => {
    if (!body) return;
    window.scrollTo(0, saveY.current);
    let y = saveY.current,
      t: ReturnType<typeof setTimeout>,
      changed = false;
    const save = () => {
      if (changed) {
        changed = false;
        void mutate(() => db.lessonProgress.update(l.id, {
          scrollY: y
        }));
      }
    };
    const scroll = () => {
      y = Math.max(0, window.scrollY);
      changed = true;
      clearTimeout(t);
      t = setTimeout(save, 400);
    };
    window.addEventListener('scroll', scroll);
    return () => {
      window.removeEventListener('scroll', scroll);
      clearTimeout(t);
      save();
    };
  }, [body, l.id]);
  async function answer(id: string, ok: boolean) {
    if((s.voice??voiceDefaults).sounds)tone(ok?'correct':'wrong');
    await mutate(async () => {
      const p = await db.lessonProgress.get(l.id);
      if (p) await db.lessonProgress.update(l.id, {
        quizResult: {
          ...p.quizResult,
          [id]: ok
        }
      });
    });
  }
  const next = data.dayPlans.find(x => x.day === day)?.items.find(id => id !== l.id && !done.has(id)) ?? available(cat, done, s.focus).find(x => x.id !== l.id)?.id;
  if (err) return <Empty>{err}</Empty>;
  if (!body) return <p>正在翻開課文…</p>;
  function jump(id: string) {
    if(voice.sectioned&&id.startsWith('section-'))ref.current?.dispatchEvent(new CustomEvent('conduit:lesson-jump',{detail:{id}}));
    else document.getElementById(id)?.scrollIntoView({
      block: 'start'
    });
  }
  return <div className="reader-grid">
      <article className="reader" onClick={async e => {
      const target=e.target as HTMLElement;
      const b = target.closest<HTMLButtonElement>('button[data-copy]');
      if(!voiceOpen&&voice.engine!=='off'&&!target.closest('a,button,input,textarea')&&!getSelection()?.toString()){
        const sentence=target.closest<HTMLElement>('.sg[data-sg]');
        if(sentence&&ref.current?.contains(sentence)){setVoiceStart(Number(sentence.dataset.sg));setVoiceOpen(true)}
      }
      if (b) {
        try {
          await navigator.clipboard.writeText(b.closest('.codebox')?.querySelector('code')?.textContent ?? '');
          notify('程式碼已複製。');
        } catch {
          notify('無法使用剪貼簿，請選取程式碼複製。');
        }
      }
    }}>
        <div className="crumb"><Link to="/map">{cat.tracks.find(t => t.id === m.track)?.title}</Link> › <Link to={'/module/' + m.id}>{m.title}</Link></div>
        <header className={'lesson-heading channel-band tone-'+trackColor(cat,m.track)} ref={heading}>
          <TrackArt cat={cat} track={m.track} variant="band"/>
          <div className="lesson-heading-copy">
            <div className="eyebrow">第 {String(l.order).padStart(2, '0')} 堂　 /　學習筆記</div>
            <h1>{l.title}</h1>
            {l.subtitle&&<p className="lesson-subtitle">{l.subtitle}</p>}
          </div>
          {voice.engine!=='off'&&<button type="button" className="lesson-read" aria-pressed={voiceOpen} title="也可以點選課文句子開始朗讀" onClick={()=>{setVoiceStart(undefined);setVoiceOpen(v=>!v)}}><Headphones size={17}/>朗讀</button>}
          <svg className={'completion-channel'+(filled?' filling':'')} aria-hidden="true" viewBox="0 0 100 4" preserveAspectRatio="none"><path d="M0 2H42l3-1h55" pathLength="100"/><path d="M0 2H42l3-1h55" pathLength="100"/></svg>
        </header>
        <p className="muted lesson-facts">預計 {l.minutes} 分 · {levels[l.level]} · {cs.length} 個知識點</p>
        <div className="objectives" id="objectives">
          <b>學習目標</b>
          <ul>{l.objectives.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="prose lesson-prose" ref={ref} dangerouslySetInnerHTML={{
        __html: body.html
      }} />
        {(voiceOpen||voice.sectioned)&&<Suspense fallback={voiceOpen?<p className="muted">正在準備朗讀…</p>:null}><LessonVoice lessonId={l.id} body={ref} initial={voiceStart} open={voiceOpen&&voice.engine!=='off'} onClose={()=>setVoiceOpen(false)}/></Suspense>}
        <hr />
        <h2>重點回顧</h2>
        {cs.map(c => <details key={c.id}>
          <summary>{c.prompt}</summary>
          <p>{c.answer}</p>
        </details>)}
        <h2>小測驗</h2>
        <p>先選答案，再看解說。這是第一次排程的參考，不是考試。</p>
        {checks.map((c, i) => <section className="quiz-block" key={c.id}>
          <span className="eyebrow">自我檢查　{String(i + 1).padStart(2, '0')}</span>
          <h3>{c.mcq?.question ?? c.prompt}</h3>
          {answers[c.id] !== undefined ? <p className="feedback">
            <b>{answers[c.id] ? '答對了。' : '再記一次。'}</b>
            {c.mcq?.explain ?? c.answer}
          </p> : c.mcq ? <div className="choices">{shuffled(c.mcq.options, l.id + c.id).map(o => <button key={o} onClick={() => answer(c.id, o === c.mcq!.options[c.mcq!.answer])}>{o}</button>)}</div> : revealed.includes(c.id) ? <><p>{c.answer}</p><button onClick={() => answer(c.id, false)}>還不熟</button> <button onClick={() => answer(c.id, true)}>記得了</button></> : <button onClick={() => reveal([...revealed, c.id])}>顯示答案</button>}
        </section>)}
        <h2 id="practice">動手做</h2>
        <LabNotice lab={body.labNote}/>
        {l.practice.map(t => t.kind==='sql'?<section className="panel lesson-sql" key={t.id}><div className="eyebrow">SQL 練習　/　{t.minutes} 分</div><h3>{t.title}</h3><LazyWorkspace exercise={t} dataset={cat.datasets.find(d=>d.id===t.dataset)!} source="lesson"/></section>:<PracticeBox key={t.id} task={t} />)}
        <h2 id="resources">延伸資源</h2>
        {l.resources.length ? l.resources.map(r => <a className="resource" key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
          {r.kind === 'video' ? <Headphones /> : <BookOpen />}
          <span>
            <b>
              {r.required ? '★ ' : ''}
              {r.title}
            </b>
            <small>{r.lang === 'en' ? 'EN' : r.lang.startsWith('zh') ? '中' : '其他'} · {r.minutes} 分　{r.note}</small>
          </span>
          <ExternalLink size={14} />
        </a>) : <p>這堂課不需要額外資源。</p>}
        <footer className="panel">
          {l.practice.some(t=>t.kind==='sql')&&<p>SQL 題 {l.practice.filter(t=>t.kind==='sql'&&data.sqlAttempts.some(a=>a.exerciseId===t.id&&a.passed)).length}/{l.practice.filter(t=>t.kind==='sql').length} 通過</p>}
          <div className="actions">
            {pg?.status === 'done' ? <>
              <b><Check size={16} /> 已完成這堂</b>
              {next && <Link className="button" to={'/lesson/' + next}>下一堂 →</Link>}
            </> : <button className="primary" disabled={busy || checks.some(c => answers[c.id] === undefined)} onClick={async () => {
            setBusy(true);
            try {
              if(voice.sounds)unlockTones();
              await completeLesson(l, cat, day, s);
              setVoiceOpen(false);
              if(voice.sounds)tone('done');
              const header=heading.current;
              if(header&&!s.reduceMotion&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
                const observer=new IntersectionObserver(([e])=>{
                  if(e.isIntersecting){fill(true);observer.disconnect()}
                },{threshold:.6});
                animation.current=observer;observer.observe(header);
                header.scrollIntoView({block:'center',behavior:'smooth'});
              }else fill(true);
              notify('這堂完成了，知識點已加入複習。');
            } finally {
              setBusy(false);
            }
          }}>完成這堂</button>}
            <Link to="/today">回到今天</Link>
          </div>
          {pg?.status !== 'done' && checks.some(c => answers[c.id] === undefined) && <small>完成上方的小測驗，即可記錄這堂課。</small>}
        </footer>
      </article>
      <aside className="outline">
        <div className="eyebrow">本堂目錄</div>
        <button onClick={() => jump('objectives')}>學習目標</button>
        {body.outline.map(h => <button key={h.id} className={h.level === 3 ? 'indent' : ''} onClick={() => jump(h.id)}>{h.text}</button>)}
        <button onClick={()=>jump('practice')}>動手做</button>
        <button onClick={() => jump('resources')}>延伸資源 · {l.resources.length}</button>
        <hr />
        <b>學習目標</b>
        <ul>{l.objectives.map(o => <li key={o}>{o}</li>)}</ul>
        {l.resources.length > 0 && <>
          <b>延伸閱讀</b>
          {l.resources.map(r => <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a>)}
        </>}
      </aside>
    </div>;
}
