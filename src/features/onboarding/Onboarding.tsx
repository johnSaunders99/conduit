import {catalogIndex,skipModules} from '../../content/catalog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Blocks, Layers3, Route } from 'lucide-react';
import { useWork } from '../../ui/context';
import { Amount, Projection, Title } from '../../ui/common';
import { Trail } from '../../ui/Trail';
import type { Focus } from '../../lib/model';
import { db, mutate, settingsUpdate } from '../../db';
import { now } from '../../lib/clock';
export default function Onboarding() {
  const {
      cat,data,
      s
    } = useWork(),
    nav = useNavigate(),
    [step, set] = useState(0),
    [role, setRole] = useState(s.role??''),
    [level, setLevel] = useState(0),
    [budget, setBudget] = useState(s.budget),
    [skip, setSkip] = useState<string[]>([]),
    [test, setTest] = useState(''),
    [responses, respond] = useState<Record<string, number>>({});
  async function finish(apply: boolean) {
    if (apply) await mutate(async () => {
      for (const l of cat.lessons.filter(l => level > 0 && l.status==='ready' && skip.includes(l.module))) {
        const old = await db.lessonProgress.get(l.id);
        if (!old || old.status === 'started') await db.lessonProgress.put({
          lessonId: l.id,
          startedAt: now().toISOString(),
          scrollY: 0,
          quizResult: {},
          ...old,
          status: 'skipped',
          completedAt: now().toISOString()
        });
      }
    });
    await settingsUpdate(apply ? {
      ...(!data.settings.length?{tracks:cat.tracks.map(t=>t.id)}:{}),
      role:role||undefined,
      budget,
      onboarded: true
    } : {
      ...(!data.settings.length?{tracks:cat.tracks.map(t=>t.id)}:{}),
      onboarded: true
    });
    nav('/today', {
      replace: true
    });
  }
  const index=catalogIndex(cat);
  const tests=(index.rows.get(test)??[]).flatMap(r=>r.lesson.concepts).slice(0,5).map(id=>index.concepts.get(id)!);
  return <div className="onboard">
      <Title k="起步指南" title="替你的渠成選個起點" sub="不用一次決定所有事。每天的份量，都可以再調整。" action={<button className="ghost" onClick={() => finish(false)}>略過設定</button>} />
      <div className="welcome-art">
        <Trail />
      </div>
      <section className="panel">
        <div className="eyebrow">首次設定　{Math.min(step + 1, 3)} / 3</div>
        <div className="step-line">{[0, 1, 2].map(n => <i className={step >= n ? 'on' : ''} key={n} />)}</div>
        {step === 0 ? <>
          <h2>你想往哪裡走？</h2>
          <p>選一個想靠近的職位。統計會先顯示這個目標的準備度。</p>
          <div className="goal-grid">{[...cat.roles,{id:'',title:'還不確定',summary:'先學共同基礎，再選方向。'}].map(r=><button key={r.id} aria-pressed={role===r.id} onClick={()=>setRole(r.id)}><Route/><b>{r.title}</b><small>{r.summary}</small></button>)}</div>
        </> : step === 1 ? <>
          <h2>你從哪個位置開始？</h2>
          <div className="chips">{['完全零基礎', '寫過一點程式', '有開發經驗'].map((v, i) => <button key={v} aria-pressed={level === i} onClick={() => setLevel(i)}>{v}</button>)}</div>
          {level > 0 && skipModules(cat).map(m => <div className="row" key={m.id}>
            <label><input type="checkbox" checked={skip.includes(m.id)} onChange={e => setSkip(e.target.checked ? [...skip, m.id] : skip.filter(x => x !== m.id))} /> {m.title} · 已會，跳過</label>
            <button onClick={() => setTest(test === m.id ? '' : m.id)}>先做能力檢查</button>
          </div>)}
          {level > 0 && test && <div className="inset">
            <h3>能力檢查 · {tests.length} 題</h3>
            {tests.map(c => <fieldset key={c.id}>
              <legend>{c.mcq?.question ?? c.prompt}</legend>
              {c.mcq ? c.mcq.options.map((o, i) => <label key={o}><input type="radio" name={c.id} checked={responses[c.id] === i} onChange={() => respond({
                ...responses,
                [c.id]: i
              })} /> {o} </label>) : <details>
                <summary>先回想，再對照答案</summary>
                <p>{c.answer}</p>
              </details>}
              {c.mcq && responses[c.id] !== undefined && <p>
                {responses[c.id] === c.mcq.answer ? '答對了。' : '再看一下。'}
                {c.mcq.explain}
              </p>}
            </fieldset>)}
            {!tests.length && <p>這個模組還沒有知識點，可依學習目標判斷是否跳過。</p>}
          </div>}
        </> : step === 2 ? <>
          <h2>每天大概能學多久？</h2>
          <Amount value={budget} onChange={setBudget} />
        </> : <>
          <h2>起點準備好了。</h2>
          <Projection budget={budget} skipped={level > 0 ? skip : []} />
          <p>一段一段，把數據接通。</p>
        </>}
        <footer className="actions">
          {step > 0 && <button onClick={() => set(step - 1)}>上一步</button>}
          <button className="primary" onClick={() => step < 3 ? set(step + 1) : finish(true)}>{step === 3 ? '前往今天' : '下一步'} <ArrowRight size={16} /></button>
        </footer>
      </section>
    </div>;
}
