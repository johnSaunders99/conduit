import {it,expect} from 'vitest';
import MarkdownIt from 'markdown-it';
import YAML from 'yaml';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspect} from '../tools/content.mjs';
import {makeSpeech,markLesson,normalise,segmentLeaves,speechKey,voiceVersion} from '../tools/speech.mjs';
import {scratch} from './scratch.mjs';

const {terms:lex,identifierParts}=YAML.parse(fs.readFileSync('content/speech/lexicon.yaml','utf8'));
const speak=(text,english=false)=>normalise(text,lex,english,identifierParts);
it.each([
  ['使用 SQL（Structured Query Language）和 DuckDB (embedded database)。','使用S Q L和Duck D B。'],
  ['確認  DuckDB、use    table 與 2026 年','確認Duck D B、use table與二〇二六年'],
  ['ORDER BY、COUNT(DISTINCT user_id)','order by、count distinct user、I D'],
  ['3.5 GB、128MB、1,024 筆、0.25%','三點五GB、一百二十八MB、一千零二十四筆、百分之零點二五'],
  ['2026-11-20 09:05:02，v1.3.2，連接埠 5432','二〇二六年十一月二十日九點五分二秒，版本一點三點二，連接埠五四三二'],
  ['C:\\dev\\conduit-lab → https://www.example.com/docs?q=3','C槽dev底下的conduit-lab到example.com'],
  ['http://127.0.0.1:4320/help、port 8080','本機，連接埠四三二〇、連接埠八〇八〇'],
  ['數量 ≥ 2 ✅，dbt 👩‍💻。','數量大於等於二，D B T。'],
  ['2026-02-04、2026 年 2 月 4 日、2026 年 02 月 04 日、2026/2/4','二〇二六年二月四日、二〇二六年二月四日、二〇二六年二月四日、二〇二六年二月四日'],
  ['04:00、14:30、下午 2:30、下午 14:30、上午 4:00','四點、十四點三十分、下午兩點半、下午兩點半、上午四點'],
  ['第 2、2 個、2 張、2 月、2 號、2 樓、2 日、2 個月、2 小時','第二、兩個、兩張、二月、二號、二樓、二日、兩個月、兩小時'],
  ['3.5、12%、v1.3.2、9092、ID 0123、port 9092、2026年、2000 列、2048MB','三點五、百分之十二、版本一點三點二、九〇九二、I D〇一二三、連接埠九〇九二、二〇二六年、二千列、二千零四十八MB'],
  ['2 號、9092 號、第 02 章、02 筆','二號、九〇九二號、第二章、兩筆'],
  ['目前使用 v1.3.2. 版本 4.0.0。','目前使用版本一點三點二. 版本四點零點零。'],
  ['寫 event_id、product_id、line_no、refund_amount、shop_avg、item_n','寫event、I D、product、I D、line、number、refund、amount、shop、average、item、N'],
  ['讀 totalAmt、itemQty、HTTPStatusCode、ROW_NUMBER()；n 是數量。','讀total、amount、item、quantity、H T T P、Status、Code、row number；N是數量。'],
  ['只輸出 e50、e51、e90、O01、E0012','只輸出E五十、E五十一、E九十、O〇一、E〇〇一二'],
  ['No rows，AVG(amount) 與 shop_avg。','No rows，avg amount與shop、average。'],
  ['數據、列、欄、一行、執行、重送、調度、長期、增長、得先、便宜。','數據、列、欄、一行、執行、重送、調度、長期、增長、得先、便宜。'],
])('normalises %s for Taiwan Mandarin', (input,want)=>expect(speak(input)).toBe(want));
it('changes only spoken text and keys, not SQL identifiers or number spacing shown to the learner',()=>{
  const display='取 event_id 在 2026 年 2 月 4 日 的 2 筆數據。';
  const r=makeSpeech(lex,identifierParts)(display,'sql-prompt',4);
  expect(r.text).toBe(display);
  expect(r.speak).toBe('取event、I D在二〇二六年二月四日的兩筆數據。');
  expect(r.key).not.toBe(speechKey('取 event id 在 2026 年 2 月 4 日 的 二 筆數據。'));
  expect(voiceVersion).toBe('conduit-tw-2');
});
it('keeps authored text, supplies distinct English keys and deduplicates equal spoken text',()=>{
  const make=makeSpeech(lex),a=make('欄位（column）。','heading',0),b=make('欄位。','sentence',8);
  expect(a).toMatchObject({text:'欄位（column）。',speak:'欄位。',key:b.key,english:{speak:'欄位，column。'}});
  expect(a.english.key).toBe(speechKey(a.english.speak));
  expect(a.english.key).not.toBe(a.key);
  expect(speechKey('欄位。')).toBe('9e1d219a53f89c9692e1');
  expect(make('SQL','heading',0).key).toBe(make('sql','question',37).key);
});
it('wraps complete inline trees, headings, list items and callouts; never splits table or fence markup',()=>{
  const md=new MarkdownIt({html:false});
  const source='## 核心概念\n\n先看 **粗體。** 再看 [連結](https://example.com) 和 \x60a.b\x60。最後一句。\n\n- 項目一。項目二。\n\n> 注意事項。\n\n| 欄 |\n| -- |\n| 不朗讀儲存格 |\n\n\x60\x60\x60python\nprint("do not read")\n\x60\x60\x60\n\n## 小結\n\n很好。';
  const marked=markLesson(md.parse(source,{}),makeSpeech(lex),md.utils.escapeHtml);
  const html=md.renderer.render(marked.tokens,md.options,{});
  expect(html).toContain('<span class="sg" data-sg="1">先看 <strong>粗體。</strong></span>');
  expect(html).toContain('<span class="sg" data-sg="2"> 再看 <a href="https://example.com">連結</a> 和 <code>a.b</code>。</span>');
  expect(html).toMatch(/<li><span class="sg"[^>]*>項目一。<\/span><span class="sg"[^>]*>項目二。<\/span><\/li>/);
  expect(html).toMatch(/<blockquote>\n<p><span class="sg"[^>]*>注意事項。<\/span><\/p>/);
  expect(html.match(/<table>[\s\S]*?<\/table>/)?.[0]).not.toContain('class="sg"');
  expect(html.match(/<pre>[\s\S]*?<\/pre>/)?.[0]).not.toContain('class="sg"');
  expect(html).toContain('class="lucide lucide-layers section-icon"');
  expect(marked.segments.map(s=>s.kind)).toEqual(['heading','sentence','sentence','sentence','list','list','callout','table-lead','code-lead','heading','sentence']);
  expect(marked.segments[8].speak).toContain('Python');
  expect(marked.segments.at(-1)).toMatchObject({part:1,emotion:'encourage'});
  expect(marked.sections.map(s=>s.start)).toEqual([0,9]);
  expect([...html.matchAll(/data-sg="(\d+)"/g)].map(m=>Number(m[1]))).toEqual(marked.segments.map(s=>s.n));
  const stack=[];
  for(const [,close,tag] of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)){
    if(['br','img','hr'].includes(tag))continue;
    if(close)expect(stack.pop()).toBe(tag);else stack.push(tag);
  }
  expect(stack).toEqual([]);
});
it('indexes all card variants, with an interview packet for standalone and embedded questions',()=>{
  const r=inspect('fixtures/content');
  expect(r.errors).toEqual([]);
  for(const [id,c] of Object.entries(r.cardsSpeech.concepts)){
    expect(c.prompt.length*c.answer.length,id).toBeGreaterThan(0);
    if(c.mcq)expect(c.mcq.question.length*c.mcq.explain.length*c.mcq.options.length,id).toBeGreaterThan(0);
  }
  for(const q of r.deck.interviews.flatMap(b=>b.questions)){
    const v=r.cardsSpeech.interviews[q.id];expect(v.question.length*v.points.length*v.reference.length).toBeGreaterThan(0);
  }
  for(const c of r.deck.concepts.filter(c=>c.interview))expect(r.cardsSpeech.interviews[c.id].reference.length).toBeGreaterThan(0);
  for(const [id,s] of Object.entries(r.cardsSpeech.sql))expect(s.prompt.length*s.explain.length,id).toBeGreaterThan(0);
});
it('exports all the unique authored and shared keys in path order; coverage excludes stale keys',()=>{
  const box=scratch();
  try{
    const out=path.join(box.dir,'segments.jsonl'),manifest=path.join(box.dir,'manifest.json');
    const run=(command,...args)=>execFileSync(process.execPath,['tools/speech-cli.mjs',command,'--src','fixtures/content',...args],{encoding:'utf8'});
    run('export','--out',out);
    const rows=fs.readFileSync(out,'utf8').trimEnd().split('\n').map(JSON.parse);
    const r=inspect('fixtures/content'),expected=new Set([...segmentLeaves([r.speech,r.cardsSpeech])].map(s=>s.key));
    expect(rows.length).toBe(expected.size);
    expect(new Set(rows.map(x=>x.key))).toEqual(expected);
    expect(rows[0].lessonId).toBe(r.index.lessons.filter(x=>x.module===r.index.path.recommended[0]).sort((a,b)=>a.order-b.order)[0].id);
    expect(rows.map(r=>r.pathOrder)).toEqual(rows.map(r=>r.pathOrder).sort((a,b)=>a-b));
    expect(rows.some(r=>r.lessonId===null&&r.kind==='option')).toBe(true);
    fs.writeFileSync(manifest,JSON.stringify({voiceId:'test',voiceLabel:'測試聲線',engine:'mock',version:'1',items:{[rows[0].key]:{file:'signal.wav',ms:240},['0'.repeat(20)]:{file:'old.wav',ms:240}}}));
    expect(run('status','--manifest',manifest)).toContain('全課程（不重複）：1 / '+expected.size);
  }finally{box.clean()}
},15000);
