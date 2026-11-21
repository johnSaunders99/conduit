import { it, expect, describe, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { execFileSync, spawnSync } from 'node:child_process';
import { inspect, buildContent, contentOptions, source } from '../tools/content.mjs';
import { scratch } from './scratch.mjs';
let box, src;
beforeEach(() => {
  box = scratch();
  src = path.join(box.dir, 'src');
  fs.cpSync('fixtures/content', src, {
    recursive: true
  });
});
afterEach(() => box.clean());
const lesson = 'modules/fd-demo/01-files.md';
const read = p => fs.readFileSync(path.join(src, p), 'utf8');
const write = (p, t) => fs.writeFileSync(path.join(src, p), t);
function change(p, fn) {
  const data = YAML.parse(read(p));
  fn(data);
  write(p, YAML.stringify(data));
}
function edit(fn, bodyFn = b => b) {
  const [, head, body] = read(lesson).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/),
    l = YAML.parse(head);
  fn(l);
  write(lesson, '---\n' + YAML.stringify(l) + '---\n' + bodyFn(body));
}
it('compiles fixture counts, lazy bodies, image, table, callouts, code, stable outline', () => {
  const out = path.join(box.dir, 'out'),
    r = buildContent(src, out),
    b = r.bodies['fd-demo-01-files'];
  expect(r.index.counts).toMatchObject({
    modules: 5,
    ready: 8,
    lessons: 11,
    concepts: 24,
    projects: 1,
    questions: 11
  });
  expect(r.warnings).toEqual([]);
  expect(r.errors).toEqual([]);
  for (const needle of ['<table>', 'data-copy', '<img', './content/assets/worktree.svg', 'callout tip', 'id="section-1"']) expect(b.html).toContain(needle);
  expect(b.outline.some(x => x.level === 3)).toBe(true);
  expect(r.index.lessons[0]).not.toHaveProperty('html');
  expect(fs.existsSync(path.join(out, 'assets/worktree.svg'))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(out, 'lessons', b.id + '.json')))).toEqual(b);
  expect(inspect(src).index.version).toBe(r.index.version);
});
it('validates optional subtitles without altering their text',()=>{
  edit(l=>l.subtitle=42);expect(inspect(src).errors.some(([,msg])=>msg.includes('副標題必須是字串'))).toBe(true)
  edit(l=>l.subtitle='字'.repeat(30));change('modules/fd-demo/module.yaml',m=>m.subtitle='路'.repeat(31))
  const r=inspect(src);expect(r.errors).toEqual([]);expect(r.warnings.filter(([,msg])=>msg.includes('副標題'))).toEqual([['modules/fd-demo/module.yaml','副標題超過 30 字，建議 26 字以內']])
  expect(r.index.lessons.find(l=>l.id==='fd-demo-01-files').subtitle).toHaveLength(30)
});
it('explicit source wins over environment variable', () => {
  const old = process.env.CONDUIT_CONTENT;
  try {
    process.env.CONDUIT_CONTENT = src;
    expect(source([])).toBe(src);
    expect(source(['--src', 'fixtures/content'])).toBe(path.resolve('fixtures/content'));
  } finally {
    if (old) process.env.CONDUIT_CONTENT = old;else delete process.env.CONDUIT_CONTENT;
  }
});
describe('validator rejects invalid authored material', () => {
  it.each([['duplicate lesson', () => write('modules/fd-demo/99-copy.md', read(lesson)), '重複識別碼'], ['duplicate module', () => change('modules/fs-demo/module.yaml', m => m.id = 'fd-demo'), '重複識別碼'], ['duplicate concept', () => edit(l => l.concepts[1].id = l.concepts[0].id), '重複識別碼'], ['duplicate practice', () => edit(l => l.practice.push(l.practice[0])), '重複識別碼'], ['duplicate project', () => write('projects/p2.yaml', read('projects/proj-notebook.yaml')), '重複識別碼'], ['duplicate bank question', () => change('interview/iv-evidence.yaml', s => s.questions[1].id = s.questions[0].id), '重複識別碼'], ['unknown track', () => change('modules/fd-demo/module.yaml', m => m.track = 'unknown'), '未知參照'], ['unknown module', () => edit(l => l.module = 'missing'), '所屬模組'], ['unknown module prerequisite', () => change('modules/fd-demo/module.yaml', m => m.prereqs = ['missing']), '未知參照'], ['unknown lesson prerequisite', () => edit(l => l.prereqs = ['missing']), '未知參照'], ['unknown project', () => change('modules/fd-demo/module.yaml', m => m.project = 'missing'), '未知參照'], ['unknown role', () => change('modules/fd-demo/module.yaml', m => m.roles = ['missing']), '未知參照'], ['unknown skill module', () => change('roles.yaml', r => r[0].skills[0].modules = ['missing']), '未知參照'], ['unknown path module', () => change('path.yaml', p => p.recommended.push('missing')), '未知參照'], ['module cycle', () => change('modules/fd-demo/module.yaml', m => m.prereqs = ['fs-demo']), '循環'], ['lesson cycle', () => edit(l => l.prereqs = [l.id]), '循環'], ['cross-level cycle', () => edit(l => l.prereqs = ['fs-demo-01-headings']), '循環'], ['bad lesson prefix', () => edit(l => l.id = 'other-id'), '識別碼或所屬模組'], ['missing objectives', () => edit(l => l.objectives = []), '就緒課程'], ['missing body', () => edit(() => {}, () => ''), '就緒課程'], ['too few concepts', () => edit(l => l.concepts.length = 2), '就緒課程'], ['too few options', () => edit(l => l.concepts[0].mcq.options.length = 2), '選擇題'], ['too many options', () => edit(l => l.concepts[0].mcq.options.push('d', 'e', 'f')), '選擇題'], ['duplicate options', () => edit(l => l.concepts[0].mcq.options[1] = l.concepts[0].mcq.options[0]), '選擇題'], ['answer outside range', () => edit(l => l.concepts[0].mcq.answer = 8), '選擇題'], ['too few interview points', () => edit(l => l.concepts[0].interview.points = []), '面試要點'], ['too many bank points', () => change('interview/iv-evidence.yaml', s => s.questions[0].points = Array(7).fill('項目')), '面試要點'], ['non-http resource', () => edit(l => l.resources[0].url = 'file:demo'), '資源網址'], ...['kind', 'lang', 'checked'].map(key => ['missing resource ' + key, () => edit(l => delete l.resources[0][key]), '資源網址']), ['non-positive minutes', () => edit(l => l.minutes = 0), '分鐘數'], ['missing fence language', () => edit(() => {}, body => body.replace('```text', '```')), '缺少語言']])('%s', (_, mutate, word) => {
    mutate();
    expect(inspect(src).errors.some(([, e]) => e.includes(word))).toBe(true);
  });
});
it('reports grouped warnings and exits nonzero when validation fails', () => {
  edit(l => {
    l.practice = [];
    l.level = 2;
    l.concepts.forEach(c => delete c.interview);
    l.minutes = 0;
  }, () => '这是短文');
  const r = spawnSync(process.execPath, ['tools/check-content.mjs', '--src', src], {
    encoding: 'utf8'
  });
  expect(r.status).toBe(1);
  for (const t of ['警告 ' + lesson, '疑似簡體字', '尚無練習', '正文漢字數', '尚無面試問答', '錯誤 ' + lesson]) expect(r.stdout).toContain(t);
});

it('resolves links by route after all lessons are known, including links inside solutions',()=>{
  edit(l=>{l.practice[0].solution='[找模組](#/module/not-a-module)'},b=>b+'\n[下一堂](#/lesson/fs-demo-01-headings) [錯誤類型](#/lesson/fd-demo) [模組](#/module/fs-demo) `[範例](#/lesson/no-example)`')
  const r=inspect(src)
  expect(r.errors).toEqual([[lesson,'找不到內部連結 #/module/not-a-module'],[lesson,'找不到內部連結 #/lesson/fd-demo']])
  expect(r.bodies['fd-demo-01-files'].html).toContain('<a href="#/lesson/fs-demo-01-headings">')
})
it('warns about author scratch and copies only referenced visible assets, including solution links',()=>{
  const out=path.join(box.dir,'output'), file='assets/練習 表.txt'
  write(file,'練習');edit(l=>l.practice[0].solution='[下載](assets/%E7%B7%B4%E7%BF%92%20%E8%A1%A8.txt)')
  const first=buildContent(src,out)
  expect(first.errors).toEqual([]);expect(fs.existsSync(path.join(out,file))).toBe(true)
  fs.mkdirSync(path.join(src,'modules/.archive'));write('modules/.archive/broken.md','ignored')
  write('assets/orphan.svg','not an image');write('editor.tmp','temporary')
  fs.mkdirSync(path.join(src,'modules/editor'));write('modules/editor/notes.bak','temporary')
  const r=inspect(src)
  expect(r.index.version).toBe(first.index.version);expect(r.errors).toEqual([])
  for(const f of ['modules/.archive','modules/editor/notes.bak','assets/orphan.svg','editor.tmp'])expect(r.warnings.map(([name])=>name)).toContain(f)
  edit(l=>l.practice[0].solution='不再使用附件')
  buildContent(src,out)
  for(const f of [file,'assets/orphan.svg','editor.tmp'])expect(fs.existsSync(path.join(out,f))).toBe(false)
})
it('rejects hidden or missing lesson assets rather than copying them',()=>{
  fs.mkdirSync(path.join(src,'assets/.hidden'));write('assets/.hidden/test.svg','test')
  edit(()=>{},b=>b+'\n![圖](assets/.hidden/test.svg) [附件](assets/missing.txt)')
  const r=inspect(src);expect(r.errors.map(x=>x[1])).toEqual(['素材須為本機 assets 檔案','找不到本機素材 assets/missing.txt'])
})

it('emits dataset scripts, rendered exercise order and six searchable terms',()=>{
  const out=path.join(box.dir,'out'),r=buildContent(src,out),get=id=>JSON.parse(fs.readFileSync(path.join(out,id),'utf8'));
  const sql=get('sql.json'),tasks=get('lessons/sq-lab-01-counter.json').practice;
  expect(sql.datasets.length).toBe(2);expect(get('glossary.json')).toHaveLength(6);
  expect(tasks[1].kind).toBe('explain');expect(tasks.map(t=>t.id)).toEqual(r.index.lessons.find(l=>l.id==='sq-lab-01-counter').practice.map(t=>t.id));
  expect(tasks.filter(t=>t.kind==='sql').map(t=>t.id)).toEqual(sql.exercises.map(e=>e.id));
  expect(sql.exercises[0].solutionCodeHtml).toContain('hljs-keyword');
  expect(tasks[0].solutionCodeHtml).toBe(sql.exercises[0].solutionCodeHtml);
  expect(sql.exercises.every(t=>t.promptHtml.includes('<p>')&&t.explainHtml.includes('<p>'))).toBe(true);
  expect(fs.readFileSync(path.join(out,'datasets/shop.sql'),'utf8')).toBe(r.setups.shop);
});
it('rejects broken track, exercise, dataset and glossary references without starting SQL',()=>{
  change('tracks.yaml',ts=>ts[0].career=true);
  change('datasets/shop/dataset.yaml',ds=>ds.id='meters');
  change('glossary.yaml',gs=>{gs[1].id=gs[0].id;gs[0].lesson='nowhere'});
  edit(l=>l.practice.push({id:l.id+'-bad',kind:'sql',minutes:2,dataset:'missing',hints:['a','b','c','d'],concepts:['absent'],tags:[]}));
  const result=inspect(src);
  for(const needle of ['一條求職','數據集識別碼','重複','未知參照 nowhere','SQL 題設定','未知參照 absent'])expect(result.errors.some(([,s])=>s.includes(needle))).toBe(true);
});
it('actually runs setup, reference and state probes; --no-sql bypasses execution only',async()=>{
  const {executeSqlChecks}=await import('../tools/sql-content.mjs');
  const r=inspect(src);r.setups.shop='CREATE TABL broken';r.sql.exercises.find(e=>e.check.mode==='state').check.query='SELECT missing_column FROM readings';
  r.sql.exercises.find(e=>e.dataset==='meters'&&e.check.mode==='result').solution='SELECT * FROM readings WHERE false';
  r.sql.datasets.find(d=>d.id==='meters').tables[0].columns[0].name='wrong';
  await executeSqlChecks(r);
  expect(r.errors.map(x=>x[0])).toEqual(expect.arrayContaining(['datasets/shop/setup.sql','sq-lab-01-counter-p4','sq-lab-01-counter-p5']));
  expect(r.warnings.some(([,s])=>s.includes('建表結果不同'))).toBe(true);
  write('datasets/shop/setup.sql','SELECT invalid_column');
  const fast=spawnSync(process.execPath,['tools/check-content.mjs','--src',src,'--no-sql']);
  expect(fast.status).toBe(0);
},30000);

const sqlLesson='modules/sq-lab/01-counter.md';
function editExercise(fn){
  const [,head,body]=read(sqlLesson).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const l=YAML.parse(head);fn(l.practice[0]);
  write(sqlLesson,'---\n'+YAML.stringify(l)+'---\n'+body);
}
it('compiles ordered SQL categories with global counts including zero and preserves one or two memberships',()=>{
  const out=path.join(box.dir,'out'),r=buildContent(src,out,{strictCategories:true});
  const s=JSON.parse(fs.readFileSync(path.join(out,'sql.json'),'utf8'));
  expect(r.warnings).toEqual([]);
  expect(s.categories.map(c=>[c.id,c.count])).toEqual([
    ['selection',2],['ordering',1],['aggregation',2],['nulls',2],['deduplication',1],['data-changes',1],['joins',0]
  ]);
  expect(s.categories[0].summary).toContain('欄位');
  expect(s.exercises[1].category).toEqual(['ordering','selection']);
  change('sql-categories.yaml',c=>c[0].label='分組聚合');
  expect(inspect(src).index.version).not.toBe(r.index.version);
});
it('rejects missing categories by default in checks and builds; --lenient restores drafting warnings',()=>{
  editExercise(t=>delete t.category);
  const cmd=['tools/check-content.mjs','--src',src,'--no-sql'];
  const strict=spawnSync(process.execPath,cmd,{encoding:'utf8'}), lenient=spawnSync(process.execPath,[...cmd,'--lenient'],{encoding:'utf8'});
  expect(strict.status).toBe(1);expect(strict.stdout).toContain('錯誤 '+sqlLesson);expect(strict.stdout).toContain('缺少 SQL 分類');
  expect(lenient.status).toBe(0);expect(lenient.stdout).toContain('警告 '+sqlLesson);expect(lenient.stdout).toContain('缺少 SQL 分類');
  const out=path.join(box.dir,'out');
  expect(()=>buildContent(src,out)).toThrow('內容未通過檢查');
  expect(fs.existsSync(out)).toBe(false);
  expect(buildContent(src,out,contentOptions(['--lenient'])).warnings).toContainEqual([sqlLesson,expect.stringContaining('缺少 SQL 分類')]);
  expect(contentOptions(['--strict-categories','--lenient']).strictCategories).toBe(true);
},12000);
it.each([
  [['unknown'],'未知 SQL 分類 unknown'],['selection','1–2 個不同'],[[],'1–2 個不同'],
  [['ordering','ordering'],'1–2 個不同'],[['selection','nulls','joins'],'1–2 個不同']
])('rejects malformed or unknown SQL category membership %j even in transition mode',(category,error)=>{
  editExercise(t=>t.category=category);
  expect(inspect(src,contentOptions(['--lenient'])).errors).toContainEqual([sqlLesson,expect.stringContaining(error)]);
});
it('rejects malformed or duplicate taxonomy rows',()=>{
  change('sql-categories.yaml',rows=>{rows.push(rows[0],{id:'Invalid',label:'錯誤',order:'first'})});
  const messages=inspect(src).errors.filter(([file])=>file==='sql-categories.yaml').map(([,message])=>message);
  expect(messages).toEqual([expect.stringContaining('重複的 SQL 分類'),expect.stringContaining('分類須提供')]);
});

it('compiles a lab note only into its lesson body and carries the teaching link in the standalone question deck',()=>{
  const out=path.join(box.dir,'out'),r=buildContent(src,out),json=f=>JSON.parse(fs.readFileSync(path.join(out,f+'.json'),'utf8'));
  expect(json('lessons/fd-demo-01-files').labNote).toMatchObject({lesson:'fd-demo-01-files',tools:['wsl','docker']});
  expect(json('lessons/sq-lab-01-counter')).not.toHaveProperty('labNote');
  expect(json('concepts').interviews[0].questions[0].lesson).toBe('fd-demo-01-files');
  expect(json('concepts').interviews[0].questions[1]).not.toHaveProperty('lesson');
  expect(json('index').lessons[0]).not.toHaveProperty('labNote');
  change('lab-notes.yaml',rows=>rows[0].note='驗證範圍已更新。');
  expect(inspect(src).index.version).not.toBe(r.index.version);
});
it('validates lab-note lesson IDs, uniqueness, tools and the 60-character limit',()=>{
  change('lab-notes.yaml',rows=>rows.push(
    {...rows[0]}, {...rows[0],lesson:'not-a-lesson'},
    {...rows[0],lesson:'sq-lab-01-counter',tools:[]},
    {...rows[0],lesson:'sq-lab-01-counter',note:'驗'.repeat(61)}
  ));
  expect(inspect(src).errors).toEqual([
    ['lab-notes.yaml','重複的實驗註記課程 fd-demo-01-files'],
    ['lab-notes.yaml','找不到實驗註記課程 not-a-lesson'],
    ...Array.from({length:2},()=>['lab-notes.yaml',expect.stringContaining('60 字以內')])
  ]);
});
it('rejects a standalone interview lesson that is unknown or not ready',()=>{
  const f='interview/iv-evidence.yaml';
  change(f,set=>{set.questions[0].lesson='unknown-lesson';set.questions[1].lesson='ai-demo-02-next'});
  const errors=inspect(src).errors;
  expect(errors).toHaveLength(2);expect(errors.every(([file,message])=>file===f&&message.includes('的課程不可開啟'))).toBe(true);
});
it('marks only SVG and PNG lesson images, including asset URLs with a fragment',()=>{
  fs.writeFileSync(path.join(src,'assets','demo.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aargAAAAASUVORK5CYII=','base64'));
  write('assets/demo.gif','preview');
  edit(()=>{},b=>b+'\n![小圖](assets/demo.png#preview) ![動圖](assets/demo.gif)');
  const html=inspect(src).bodies['fd-demo-01-files'].html;
  expect(html).toMatch(/<img[^>]+worktree\.svg[^>]+class="lesson-diagram"/);
  expect(html).toMatch(/<img[^>]+demo\.png#preview[^>]+class="lesson-diagram"/);
  expect(html).not.toMatch(/<img[^>]+demo\.gif[^>]+class="lesson-diagram"/);
});
