import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';
import { expect, it, vi, afterEach, beforeEach } from 'vitest';
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(message => {
    throw Error(String(message));
  });
});
afterEach(() => vi.restoreAllMocks());
import {assembleCatalog} from '../src/content/catalog';
import { inspect } from '../tools/content.mjs';
import { Context, type Workspace } from '../src/ui/context';
import type { Catalog } from '../src/content/types';
import { defaults, type Data } from '../src/lib/model';
import { MapPage, ModulePage } from '../src/features/map/Map';
import Today from '../src/features/today/Today';
import { ReviewPage, Session } from '../src/features/review/Review';
import Onboarding from '../src/features/onboarding/Onboarding';
import {CloseDay} from '../src/features/today/CloseDay';
import {newCard} from '../src/lib/scheduler';
import Projects from '../src/features/projects/Projects';
import Stats from '../src/features/stats/Stats';
import Bank from '../src/features/bank/Bank';
import Help from '../src/features/help/Help';
import LabNotice from '../src/features/lesson/LabNotice';
import SettingsPage from '../src/features/settings/Settings';
import Recorder from '../src/features/voice/reference/Recorder';
import script from '../src/features/voice/reference/script.json';
const r = inspect('fixtures/content'),
  cat: Catalog = {
    ...r.index,sqlCategories:r.sql.categories,...r.sql,glossary:r.glossary,
    concepts: r.deck.concepts,
    questions: r.deck.interviews.flatMap(s => s.questions.map(q => ({
      ...q,
      track: s.track
    })))
  },
  data: Data = {
    settings: [defaults],
    lessonProgress: [],
    cards: [], sqlAttempts:[],sqlDrafts:[],
    reviewLogs: [],
    dayPlans: [],
    dayStats: [],
    practice: [],
    projects: [],
    interviewAnswers: []
  },
  w: Workspace = {
    cat,
    data,
    s: defaults,
    day: '2026-11-20',
    done: new Set(),
    notify: () => {}
  };
function render(el: ReactElement, path = '/', route = '*', work = w) {
  return renderToStaticMarkup(<StaticRouter location={path}>
      <Context.Provider value={work}>
        <Routes>
          <Route path={route} element={el} />
        </Routes>
      </Context.Provider>
    </StaticRouter>);
}
it.each([[<Onboarding />, '還不確定'], [<Today />, '檔案與資料夾：替筆記找個家'], [<MapPage />, '搜尋學習地圖'], [<ReviewPage />, '完成第一堂課後'], [<Session />, '回到今天'], [<Projects />, '一頁工程筆記'], [<Stats />, '最近 26 週'], [<Bank />, '練這題'], [<SettingsPage />, '匯入備份']] as const)('renders the relevant next action in a fixture page', (el, text) => {
  expect(render(el)).toContain(text);
});
it('close panel shows all six totals, all six cards, explicit fallback coverage and tomorrow-specific scope wording',()=>{
 const lesson=cat.lessons.find(l=>l.id==='fd-demo-01-files')!,cards=cat.concepts.filter(c=>c.lessonId===lesson.id).map(c=>newCard(c,w.day,new Date(w.day+'T17:00:00'),3,.9))
 const html=render(<CloseDay closing choice={{format:'interview',scope:'yesterday',tracks:defaults.tracks}} setChoice={()=>{}} setBudget={()=>{}} save={async()=>{}} close={()=>{}}/>,'/today','*',{...w,data:{...data,cards}})
 expect(html.match(/role="radio"/g)).toHaveLength(6)
 for(const label of ['專注分鐘','完成堂數','複習次數','記得率','連續天數','今天學到的知識點','只複習今天學的','3 個中 1 個有面試題，其餘用閃卡','收工，明天見'])expect(html).toContain(label)
 expect(html).not.toContain('<select')
});
it('module view exposes stubs but does not offer to schedule them', () => {
  const html = render(<ModulePage />, '/module/ai-demo', '/module/:id');
  expect(html.match(/內容準備中/g)).toHaveLength(2);
  expect(html.match(/>加入今天</g)).toHaveLength(1);
});
it('opens a standalone question in interview mode without requiring a card', () => {
  const q = cat.questions[0],
    html = render(<Session />, '/session?q=' + q.id);
  expect(html).toContain(q.question);
  expect(html).toContain('對照參考答案');
});
it('composer and saved plan both offer useful alternatives when no ready lesson remains',()=>{
 const done=new Set(cat.lessons.filter(l=>l.status==='ready').map(l=>l.id))
 const plan={day:w.day,budget:defaults.budget,focus:defaults.focus,format:defaults.format,scope:defaults.scope,tracks:defaults.tracks,items:[],reviewIds:[],reviewDone:[],createdAt:'2026-11-20T10:00:00Z'}
 for(const dayPlans of [[],[plan]]){const html=render(<Today/>,'/today','*',{...w,done,data:{...data,dayPlans}})
 for(const t of ['下一批課程還在準備中','提前複習','作品里程碑','到題庫練一題'])expect(html).toContain(t)}
});
it('composer takes yesterday’s format and amount, not the global defaults', () => {
  const p = {
    day: '2026-11-19',
    items: [],
    reviewDone: [],
    reviewIds: [],
    createdAt: '2026-11-19T10:00:00Z',
    closedAt: '2026-11-19T11:00:00Z',
    focus: defaults.focus,
    budget: defaults.budget,
    scope: defaults.scope,
    format: defaults.format,
    tracks: defaults.tracks,
    nextReview: {
      day: w.day,
      format: 'interview' as const,
      scope: 'yesterday' as const,
      tracks: defaults.tracks,
      budget: {
        mode: 'count' as const,
        value: 1
      }
    }
  };
  const html = render(<Today />, '/today', '*', {
    ...w,
    data: {
      ...data,
      dayPlans: [p]
    }
  });
  expect(html).toContain('今天的複習 · 模擬面試 ／ 只複習昨天學的');
  expect(html).toContain('＋ 新課 1 堂');
});

it('paginates after filtering and clamps stale page numbers',()=>{
  const questions=Array.from({length:119},(_,i)=>({...cat.questions[0],id:'q'+i,question:'問題-'+i,track:i<65?'base' as const:'query' as const,module:i<65?'fd-demo':'fs-demo'}))
  const work={...w,cat:{...cat,questions}}
  const page=(q:string)=>render(<Bank/>,'/bank'+q,'*',work)
  expect(page('').match(/>練這題| 練這題/g)).toHaveLength(50)
  const last=page('?page=3');expect(last.match(/ 練這題/g)).toHaveLength(19);expect(last).toContain('問題-118');expect(last).not.toContain('問題-99<')
  const filtered=page('?track=base&module=fd-demo&page=999')
  expect(filtered.match(/ 練這題/g)).toHaveLength(15);expect(filtered).toContain('問題-64');expect(filtered).not.toContain('問題-65<')
  expect(page('?track=query&module=fd-demo')).toContain('沒有符合條件')
});
it('shows the project shelf, individual workspaces and direct milestone links',()=>{
  const base=cat.projects[0], projects=Array.from({length:8},(_,i)=>({...base,id:'p'+i,title:'作品 '+i}))
  const work={...w,cat:{...cat,projects}}, page=(q:string)=>render(<Projects/>,'/projects'+q,'*',work)
  expect(page('').match(/class="panel stripe project-tile/g)).toHaveLength(8);expect(page('')).not.toContain('<textarea')
  for(const q of ['?project=p5','?milestone=p5:'+base.milestones[0].id]){
    const detail=page(q);expect(detail).toContain('id="milestone-p5:'+base.milestones[0].id+'"');expect(detail).toContain('作品筆記');expect(detail).not.toContain('id="milestone-p0:');
  }
});

it('renders a compiled, offline guide and links to it from Settings',()=>{
  const html=render(<Help/>)
  expect(html).toContain('<h1>使用說明</h1>');expect(html).toContain('啟動渠成.cmd');expect(html).toContain('C:\\dev\\conduit-lab')
  for(const text of ['閃卡回想','選擇題','模擬面試','動手練習','混合','取代並還原','Ctrl+Z'])expect(html).toContain(text)
  expect(render(<SettingsPage/>)).toContain('href="/help"')
});

it('renders path-ordered module groups and links each concept question back to its module',()=>{
  const fs=r.index.modules.find(m=>m.id==='fs-demo')
  const other={...fs,id:'fs-z',title:'下一個模組',order:0}
  const testCat=assembleCatalog({...r.index,tracks:[...r.index.tracks].reverse(),modules:[other,...r.index.modules],path:{recommended:['cr-demo','fs-demo','fs-z','fd-demo','ai-demo','sq-lab']}},r.deck)
  const work={...w,cat:testCat}, bank=render(<Bank/>,'/bank','*',work)
  expect([...bank.matchAll(/<optgroup label="([^"]+)"/g)].map(m=>m[1])).toEqual(testCat.tracks.map(t=>t.short))
  const group=bank.match(/<optgroup label="產品">([\s\S]*?)<\/optgroup>/)![1]
  expect([...group.matchAll(/option value="([^"]+)"/g)].map(m=>m[1])).toEqual(['fs-demo','fs-z'])
  const links=[...bank.matchAll(/class="bank-module" href="\/module\/([^"]+)">([^<]+)<\/a>/g)]
  expect(links.map(m=>m[1])).toEqual(testCat.questions.filter(q=>q.conceptId).map(q=>q.module))
  for(const [,id,title] of links)expect(title).toBe(testCat.modules.find(m=>m.id===id)!.title)
  expect(bank).toContain('<small>獨立題組</small>'+r.deck.interviews[0].title)
  const stats=render(<Stats/>,'/stats','*',work)
  expect([...stats.matchAll(/href="\/module\/([^"]+)"/g)].map(m=>m[1])).toEqual(testCat.path.recommended)
  const review=render(<ReviewPage/>,'/review','*',work)
  expect([...review.matchAll(/class="panel stripe tone-([^"]+)"/g)].map(m=>m[1])).toEqual(testCat.tracks.map(t=>t.color))
})
it('keeps suggestions short and finds exact and partial tags outside the most frequent suggestions',()=>{
  const qs=Array.from({length:120},(_,i)=>({...cat.questions[0],id:'q'+i,tags:['共同','常用-'+(i%20),i<118?'tag-'+i:'罕見-'+i]}))
  const work={...w,cat:{...cat,questions:qs}}, page=(suffix:string)=>render(<Bank/>,'/bank'+suffix,'*',work)
  const list=(html:string)=>html.match(/<datalist[^>]*>([\s\S]*?)<\/datalist>/)![1]
  const initial=list(page(''));expect(initial.match(/<option/g)).toHaveLength(12);expect(initial.startsWith('<option value="共同"')).toBe(true)
  expect(initial).not.toContain('罕見-118')
  const partial=page('?tagQuery='+encodeURIComponent('罕見'))
  expect([...partial.matchAll(/href="\/session\?q=([^"]+)"/g)].map(m=>m[1])).toEqual(['q118','q119'])
  expect(list(partial)).toContain('罕見-118')
  const exact=page('?tag='+encodeURIComponent('罕見-119'))
  expect(exact).toContain('/session?q=q119"');expect(exact).not.toContain('/session?q=q118"')
})
it('repeats the standalone set heading when a filtered page starts midway through its set',()=>{
  const qs=Array.from({length:54},(_,i)=>({...cat.questions[0],id:'q'+i,set:{id:'set',title:'情境面談'}}))
  const page=render(<Bank/>,'/bank?page=2','*',{...w,cat:{...cat,questions:qs}})
  expect(page.match(/<h2 class="bank-set">/g)).toHaveLength(1)
  expect(page).toContain('<small>獨立題組</small>情境面談</h2>')
  expect(page.match(/ 練這題/g)).toHaveLength(4)
})

it('labels earlier scheduled prerequisites when adding, but uses real completion on the saved checklist',()=>{
  const [first,second,third]=cat.lessons.filter(l=>l.module==='fd-demo').sort((a,b)=>a.order-b.order)
  const plan={day:w.day,budget:defaults.budget,focus:defaults.focus,format:defaults.format,scope:defaults.scope,tracks:defaults.tracks,items:[first.id],reviewIds:[],reviewDone:[],createdAt:w.day+'T08:00:00Z'}
  const work={...w,data:{...data,dayPlans:[plan]}}
  expect(render(<ModulePage/>,'/module/fd-demo','/module/:id',work)).toContain('今天稍早已排入：'+first.title)
  const saved={...work,data:{...data,dayPlans:[{...plan,items:[first.id,second.id,third.id]}]}}
  const page=(done:Set<string>)=>render(<Today/>,'/today','*',{...saved,done})
  const outOfOrder=page(new Set([second.id]))
  expect(outOfOrder).toContain('建議先完成：'+first.title)
  expect(outOfOrder).not.toContain('建議先完成：'+second.title)
  for(const lesson of [first,second,third])expect(outOfOrder).toContain('href="/lesson/'+lesson.id+'"')
  expect(page(new Set([first.id,second.id]))).not.toContain('建議先完成：')
})

it('shows SQL coverage with a CJK–Latin space after rendering the interpolated label',()=>{
  const ids=[cat.exercises[0].concepts[0],cat.lessons.find(l=>l.id==='fd-demo-01-files')!.concepts[0]];
  const cards=ids.map(id=>newCard(cat.concepts.find(c=>c.id===id)!,w.day,new Date(w.day+'T17:00:00'),3,.9));
  const html=render(<CloseDay closing choice={{format:'sql',scope:'yesterday',tracks:defaults.tracks}}
    setChoice={()=>{}} setBudget={()=>{}} save={async()=>{}} close={()=>{}}/>, '/today','*',{...w,data:{...data,cards}});
  expect(html).toContain('2 個中 1 個有 SQL 題');
  expect(html).not.toContain('有SQL');
});
it('renders the glossary as an ordered jump list with an accessible trailing lesson link and only distinct variants',()=>{
  const entries=[
    {id:'zero',term:'零值',en:'zero',cn:'零值',tw:'零值',short:'讀數是零。',tags:[]},
    {id:'column',term:'欄位',en:'column',cn:'字段',tw:'欄位',aliases:['欄位','字段名'],short:'表中的欄。',lesson:'sq-lab-01-counter',tags:['數據表']},
  ];
  const html=render(<Bank/>,'/bank?tab=terms','*',{...w,cat:{...cat,glossary:entries}});
  expect(html).toContain('依英文首字母跳轉');
  expect(html).toMatch(/aria-controls="[^"]+-term-column">C<\/button>/);
  expect(html.indexOf('>column<')).toBeLessThan(html.indexOf('>zero<'));
  expect(html).toContain('大陸：字段 · 別名：字段名');
  expect(html).not.toContain('台灣：欄位');expect(html).not.toContain('大陸：零值');
  expect(html).toContain('href="/lesson/sq-lab-01-counter"');
});
it('shows an assisted SQL pass as passed but not as a first-check success',()=>{
  const exerciseId=cat.exercises[0].id;
  const html=render(<Stats/>,'/stats','*',{...w,data:{...data,sqlAttempts:[{
    exerciseId,id:'a',day:w.day,ts:w.day+'T14:00:00Z',sql:'SELECT 1',passed:true,checks:1,
    usedHint:false,viewedSolution:true,ms:20,source:'playground',
  }]}});
  expect(html).toContain('1 / 6<small>已通過題目');
  expect(html).toContain('0%<small>近 30 天首次檢查通過率');
});

it('shows recurring SQL mistakes by category, with tag fallback only for uncategorised exercises',()=>{
  const tagged=cat.exercises[0],legacy={...cat.exercises[1],category:undefined,tags:['舊標籤']};
  const failed=(exerciseId:string)=>({
    exerciseId,id:exerciseId,day:w.day,ts:w.day+'T14:00:00Z',sql:'SELECT 1',passed:false,checks:1,
    usedHint:false,viewedSolution:false,ms:20,source:'playground' as const
  });
  const html=render(<Stats/>,'/stats','*',{...w,cat:{...cat,exercises:[tagged,legacy]},data:{...data,sqlAttempts:[failed(tagged.id),failed(legacy.id)]}});
  expect(html).toContain('最常答錯');
  expect(html).toContain('選擇欄位 · 1 次');
  expect(html).toContain('舊標籤 · 1 次');
  expect(html).not.toContain('投影 · 1 次');
});

it('renders the optional laboratory notice with the listed tool names and the narrower verification boundary',()=>{
  const lab=r.bodies['fd-demo-01-files'].labNote;
  expect(render(<LabNotice />)).toBe('');
  const html=render(<LabNotice lab={lab}/>);
  expect(html).toContain('實驗驗證範圍');
  expect(html).toContain('未能實際執行（WSL 2 Ubuntu、Docker）');
  expect(html).toContain(lab.note);
});
it('shows the optional teaching link next to practice on a standalone question',()=>{
  const html=render(<Bank/>,'/bank');
  expect(html).toMatch(/href="\/session\?q=iv-evidence-1"[^]*?練這題<\/a><a[^>]+href="\/lesson\/fd-demo-01-files">回到課程<\/a>/);
  expect(html.match(/>回到課程</g)).toHaveLength(1);
});
it('documents staged lab setup and counts the SQL and glossary assets in About',()=>{
  const help=render(<Help/>,'/help');
  for(const copy of ['實驗環境','Python','VS Code','Git for Windows','fd-linux','WSL 2 Ubuntu','fd-docker','Docker Desktop','fd-java','JDK','8 GB','8 行、2 列','DuckDB','不必上網']){
    expect(help).toContain(copy);
  }
  const settings=render(<SettingsPage />,'/settings');
  for(const count of ['6 道 SQL 題','6 個術語','2 個數據集'])expect(settings).toContain(count);
});

it('renders the display-font switch, large study bands and track progress without requiring an audio pack',()=>{
  expect(render(<SettingsPage/>)).toContain('標題字體');
  const map=render(<MapPage/>);
  expect(map).toContain('track-art-card');expect(map).toContain('module-channel');
  const module=render(<ModulePage/>,'/module/fd-demo','/module/:id');
  expect(module).toContain('channel-band module-band');expect(module).toContain('channel-flow');
  expect(render(<Today/>)).toContain('channel-band today-band');
});
it('keeps the complete prescribed script and the consent gate visible without opening a microphone',()=>{
  const ref=render(<Recorder/>,'/voice');
  for(const line of script)expect(ref).toContain(line.text);
  expect(ref.match(/class="panel reference-line"/g)).toHaveLength(10);
  expect(ref).toContain('每種語氣至少一段 5–8 秒');expect(ref).toContain('用我的聲音');
  expect(ref).toContain('我同意使用我的聲音');
  expect(ref.match(/<button type="button" disabled=""/g)).toHaveLength(10);
  expect(ref).not.toContain('<audio');
});
