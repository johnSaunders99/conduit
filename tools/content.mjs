import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { markLesson, makeSpeech, cardSpeech, segmentLeaves, voiceVersion } from './speech.mjs';
const {
  join,
  basename,
  relative,
  resolve
} = path;
export function source(args = []) {
  const i = args.indexOf('--src');
  if (i >= 0 && !args[i + 1]) throw Error('--src 需要目錄');
  return resolve(i >= 0 ? args[i + 1] : process.env.CONDUIT_CONTENT || (fs.existsSync('content/tracks.yaml') ? 'content' : 'fixtures/content'));
}
const simp = '这们时个为么说对发会过还学习网络数库软应设计码认识题务资储环线节点书车门问听见长话语讲读记错实战练级进阶场处页组编复测选择项输础资标验显览态间单顺顾愿虑广扩链权访显示图阶层义类传执检请归扫启闭断开关创删载拟态调试译释转换历绩简历档导览顾频率预测缓冲区线绕续继统综维纳级绝终绘缩绿红纸组结给绳纠纷纤纪纺纹纱绕缝绑绪绣绵绞绩绊缆练缀缘缔编缕缴缚缠缤缥缩绽缸证诊词评订讨议讯训讲诠诵诫误诲诱谋谅谊谜谨谦谢谣谱贝负财贡货贩贪贫购贮贯贵贷费贺贼贾贿赂资赚赛赞赠赡赵赶趋跃践踪辆轮轨轰轴轻轿辈辉辑辐辖辙辞迟迁违连迩迈运远适递逻遗邮邻酝酿释钟钢钉钓钞钝钠钙钾铁铃铜银铭铅铝锅键锐锤锥锯镜镀镇镊镭闯闰闲闷闸闹闻阁阀阅阔队阳阴阵阶际陆陈险随隐难雏雾霁顶顷顽顿颁颂预颅领颇颈颊颓颖颗额颠颤风飘飞饥饭饮饲饱饼饿馆馈馒马驭驯驳驴驶驹驻驼驾骂骄骆验骑骗骚骤鱼鲜鲨鲸鸟鸡鸣鸥鸭鸽鹅鹤麦黄齐齿龄龟龙';
const simplified = new Set([...simp].filter(c => !'显示缸辞适率'.includes(c)));
const arr = x => Array.isArray(x) ? x : [];
const present = x => typeof x === 'string' && x.trim().length > 0;
// Inventory regular files only. Hidden directories and links are never followed.
function inventory(src, warn) {
  const found = new Set(), moduleDirs = [];
  function walk(rel) {
    for (const entry of fs.readdirSync(join(src, rel), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const key = rel ? rel + '/' + entry.name : entry.name;
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
        warn(key, entry.isDirectory() ? '已忽略隱藏資料夾' : '已忽略非教材檔案');
      } else if (entry.isDirectory()) {
        if (rel === 'modules') moduleDirs.push(entry.name);
        walk(key);
      } else if (entry.isFile()) found.add(key);
    }
  }
  if (fs.existsSync(src)) walk('');
  return {found,moduleDirs};
}
export const contentOptions=args=>({strictCategories:args.includes('--strict-categories')||!args.includes('--lenient')});
export function inspect(src, {strictCategories=true}={}) {
  const errors = [],
    warnings = [],
    tracks = [],
    roles = [],
    modules = [],
    lessons = [],
    concepts = [],
    projects = [],
    interviews = [],
    bodies = {}, speech = {},
    fileOf = new Map(),
    seen = new Set(),
    practice = [],
    graph = new Map();
  const err = (f, m) => errors.push([f, m]),
    warn = (f, m) => warnings.push([f, m]);
  const {found,moduleDirs} = inventory(src,warn), consumed = new Set(), assets = new Set(), links = [];
  const files = (dir,ext) => [...found].filter(f=>f.startsWith(dir+'/') && !f.slice(dir.length+1).includes('/') && f.endsWith(ext)).sort();
  const read = f => {
    if (!found.has(f)) throw Error('找不到教材檔案 ' + f);
    consumed.add(f);
    return fs.readFileSync(join(src,f),'utf8');
  };
  const collect = (result, f) => {
    for (const a of result.assets) {
      if (found.has(a)) assets.add(a); else err(f, '找不到本機素材 ' + a);
    }
    for (const href of result.links) links.push([f,href]);
  };
  const yaml = p => {
    try {
      return YAML.parse(read(p));
    } catch (e) {
      err(p, e.message);
      return null;
    }
  };
  const lexFile='speech/lexicon.yaml';
  const lexicon=found.has(lexFile)?yaml(lexFile):{terms:{SQL:'S Q L'},polyphones:[]};
  const mapping=(x,keyValid=present)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.entries(x).every(([k,v])=>keyValid(k)&&present(v));
  const validLex=mapping(lexicon?.terms)&&Array.isArray(lexicon.polyphones)&&lexicon.polyphones.every(p=>present(p?.text)&&present(p?.pinyin))&&new Set(lexicon.polyphones.map(p=>p.text)).size===lexicon.polyphones.length;
  const validParts=lexicon?.identifierParts===undefined||mapping(lexicon.identifierParts,k=>/^[a-z]+$/.test(k));
  if(!validLex)err(lexFile,'讀音詞典需要 terms 字典與不重複的 polyphones 清單');
  if(!validParts)err(lexFile,'identifierParts 須使用小寫英文字母鍵與非空白讀音');
  const make=makeSpeech(validLex?lexicon.terms:{},validParts?lexicon?.identifierParts:undefined);
  const list = f => {
    const v = yaml(f);
    if (!Array.isArray(v)) err(f, '必須是清單');
    return arr(v);
  };
  const id = (o, f) => {
    if (!present(o.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id)) err(f, '識別碼格式不符');
    if (seen.has(o.id)) err(f, '重複識別碼 ' + o.id);
    seen.add(o.id);
    fileOf.set(o.id, f);
  };
  const subtitle=(o,f)=>{if(o.subtitle===undefined)return;if(typeof o.subtitle!=='string')err(f,'副標題必須是字串');else if([...o.subtitle].length>30)warn(f,'副標題超過 30 字，建議 26 字以內')};
  const positive = (n, f) => {
    if (!(typeof n === 'number' && Number.isFinite(n) && n > 0)) err(f, '分鐘數必須大於零');
  };
  const hz = (s, f) => {
    let hits = [...new Set([...s].filter(c => simplified.has(c)))];
    if (hits.length) warn(f, '疑似簡體字：' + hits.join('、'));
  };
  const points = (q, f) => {
    if (!Array.isArray(q.points) || q.points.length < 2 || q.points.length > 6 || !q.points.every(present)) err(f, '面試要點須有 2–6 項');
  };
  tracks.push(...list('tracks.yaml'));
  roles.push(...list('roles.yaml'));
  const pathData = found.has('path.yaml') ? yaml('path.yaml') : {
    recommended: []
  };
  const datasets=[], exercises=[], setups={}, glossary=found.has('glossary.yaml')?list('glossary.yaml'):[];
  const slug=v=>present(v)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
  function unique(rows,file) {
    if(rows.some(x=>!x || !slug(x.id)) || new Set(rows.map(x=>x?.id)).size!==rows.length) err(file,'識別碼無效或重複');
  }
  unique(tracks,'tracks.yaml');unique(roles,'roles.yaml');unique(glossary,'glossary.yaml');
  for(const folder of new Set([...found].filter(f=>/^datasets\/[^/]+\/(dataset\.yaml|setup\.sql)$/.test(f)).map(f=>f.split('/')[1]))) {
    const dir='datasets/'+folder, file=dir+'/dataset.yaml', ds=yaml(file);
    if(!ds)continue;
    datasets.push(ds);hz(JSON.stringify(ds),file);
    if(!slug(ds.id)||ds.id!==folder||!present(ds.title)||!present(ds.summary)||!arr(ds.tables).length)err(file,'數據集識別碼或說明不符');
    const names=new Set();
    for(const t of arr(ds.tables)) {
      if(!present(t.name)||names.has(t.name)||!arr(t.columns).length||arr(t.columns).some(c=>!present(c.name)||!present(c.type)||!present(c.note))||new Set(arr(t.columns).map(c=>c.name)).size!==arr(t.columns).length)err(file,'數據表或欄位定義不符');
      names.add(t.name);
    }
    try {
      const script=read(dir+'/setup.sql'); setups[ds.id]=script;
      if(Buffer.byteLength(script)>400*1024||!script.trim()||/\b(random|now)\s*\(/i.test(script))err(dir+'/setup.sql','請提供確定性的建表數據，最多 400 KB');
    }catch(e){err(dir+'/setup.sql',e.message)}
  }
  unique(datasets,'datasets');
  const categoryFile='sql-categories.yaml', categories=new Map();
  for(const c of found.has(categoryFile)?list(categoryFile):[]){
    if(!c||!slug(c.id)||!present(c.label)||!Number.isFinite(c.order)||(c.summary!==undefined&&!present(c.summary))){
      err(categoryFile,'分類須提供識別碼、名稱與數字順序，摘要可省略');
      continue;
    }
    if(categories.has(c.id)){
      err(categoryFile,'重複的 SQL 分類：'+c.id);
      continue;
    }
    const {id,label,order,summary}=c;
    categories.set(id,{id,label,order,...(summary===undefined?{}:{summary}),count:0});
    hz([label,summary].join(' '),categoryFile);
  }
  for (const d of moduleDirs) {
    const dir = 'modules/' + d, mf = dir + '/module.yaml', lessonFiles = files(dir, '.md');
    // A folder of editor leftovers is not itself a malformed module.
    if (!found.has(mf) && !lessonFiles.length) continue;
    const m = yaml(mf);
    if (!m) continue;
    id(m, mf);subtitle(m,mf);
    modules.push(m);
    if (m.id !== d) err(mf, '資料夾與模組不符');
    for (const f of lessonFiles) {
      const s = read(f).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      const match = s.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
      if (!match) {
        err(f, '缺少前置數據');
        continue;
      }
      let l;
      try {
        l = YAML.parse(match[1]);
        if (!l) throw Error('空白前置數據');
      } catch (e) {
        err(f, e.message);
        continue;
      }
      const body = match[2].trim(),
        ready = l.status === 'ready';
      id(l, f);subtitle(l,f);
      if (l.module !== d || !String(l.id).startsWith(d + '-')) err(f, '課程識別碼或所屬模組不符');
      positive(l.minutes, f);
      if (!['ready', 'stub', 'draft'].includes(l.status)) err(f, '未知課程狀態');
      if (ready && (!arr(l.objectives).length || !body || arr(l.concepts).length < 3)) err(f, '就緒課程缺少目標、正文或三個知識點');
      const ct = body.replace(/```[\s\S]*?```/g, '').match(/\p{Script=Han}/gu)?.length ?? 0;
      if (ready && (ct < 600 || ct > 1800)) warn(f, '正文漢字數 ' + ct + '（建議 600–1800）');
      if (ready && !arr(l.practice).length) warn(f, '尚無練習');
      if (ready && l.level >= 2 && !arr(l.concepts).some(c => c.interview)) warn(f, '尚無面試問答');
      for (const r of arr(l.resources)) {
        let good = false;
        try {
          good = ['http:', 'https:'].includes(new URL(r.url).protocol);
        } catch {}
        if (!good || !['doc', 'video', 'course', 'book', 'article', 'paper', 'repo', 'interactive', 'tool'].includes(r.kind) || !['en', 'zh-Hant', 'zh-Hans', 'other'].includes(r.lang) || !/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) err(f, '資源網址或分類、語言、查核日期有誤');
        positive(r.minutes, f);
      }
      for (const c of arr(l.concepts)) {
        id(c, f);
        if (!present(c.prompt) || !present(c.answer)) err(f, '知識點缺少問答');
        if (c.mcq) {
          const {
            options,
            answer,
            explain
          } = c.mcq;
          if (!Array.isArray(options) || options.length < 3 || options.length > 5 || new Set(options.map(x => String(x).trim())).size !== options.length || !Number.isInteger(answer) || answer < 0 || answer >= options.length || !present(explain)) err(f, '選擇題選項、解答或解說有誤');
        }
        if (c.interview) points(c.interview, f);
        concepts.push({
          ...c,
          trackId: m.track,
          lessonId: l.id,
          moduleId: d,
          tags: l.tags ?? []
        });
      }
      for (const t of arr(l.practice)) {
        id(t, f);
        positive(t.minutes, f);
        if(t.kind==='sql') {
          if(t.category===undefined){
            (strictCategories?err:warn)(f,'缺少 SQL 分類：'+t.id);
          }else if(!Array.isArray(t.category)||t.category.length<1||t.category.length>2||new Set(t.category).size!==t.category.length||!t.category.every(slug)){
            err(f,'SQL 題須指定 1–2 個不同的分類識別碼：'+t.id);
          }else for(const id of t.category){
            const category=categories.get(id);
            if(category)category.count++;
            else err(f,'未知 SQL 分類 '+id+'：'+t.id);
          }
          const rules=t.check??{};
          if(!String(t.id).startsWith(l.id+'-')||![t.title,t.prompt,t.solution,t.explain].every(present)||
            !datasets.some(ds=>ds.id===t.dataset)||!arr(t.concepts).length||new Set(arr(t.concepts)).size!==t.concepts.length||!Array.isArray(t.tags)||!t.tags.every(present)||
            !Array.isArray(t.hints??[])||arr(t.hints).length>3||!arr(t.hints).every(present)||
            !Number.isInteger(t.level??l.level)||(t.level??l.level)<1||(t.level??l.level)>4||
            !['result','state'].includes(rules.mode??'result')||(rules.mode==='state'&&!present(rules.query))||
            (rules.tolerance!==undefined&&!(Number.isFinite(rules.tolerance)&&rules.tolerance>=0))||
            ['ordered','columnNames','allowEmpty'].some(k=>rules[k]!==undefined&&typeof rules[k]!=='boolean'))err(f,'SQL 題設定有誤：'+t.id);
          Object.assign(t,{lessonId:l.id,moduleId:d,level:t.level??l.level,hints:t.hints??[],check:{mode:'result',ordered:false,columnNames:false,tolerance:1e-6,allowEmpty:false,...rules}});
          for(const field of ['prompt','explain']){const result=render(String(t[field]??''),f,err);t[field+'Html']=result.html;collect(result,f)}
          t.solutionCodeHtml=highlightCode(String(t.solution??''),'sql');
          exercises.push(t);
        } else if (t.solution) {
          const solution = render(t.solution, f, err);
          t.solutionHtml = solution.html;
          collect(solution,f);
        }
        practice.push(t);
      }
      const result = render(body, f, err, make);
      speech[l.id]=result.speech;
      collect(result,f);
      bodies[l.id] = {
        id: l.id,
        html: result.html,
        practice: arr(l.practice),
        outline: result.outline
      };
      hz(s, f);
      lessons.push({
        ...l,
        concepts: arr(l.concepts).map(c => c.id),
        prereqs: arr(l.prereqs),
        resources: arr(l.resources),
        tags: arr(l.tags),
        practice: arr(l.practice)
      });
    }
  }
  for (const [dir, dest] of [['projects', projects], ['interview', interviews]]) for (const f of files(dir, '.yaml')) {
    const o = yaml(f);
    if (!o) continue;
    id(o, f);
    hz(JSON.stringify(o), f);
    if (dir === 'interview') for (const q of arr(o.questions)) {
      id(q, f);
      points(q, f);
    }
    dest.push(o);
  }
  const ids = xs => new Set(xs.map(x => x.id)),
    T = ids(tracks),
    M = ids(modules),
    L = ids(lessons),
    R = ids(roles),
    P = ids(projects);
  for (const [file,href] of links) {
    const [,kind,target] = href.match(/^#\/(lesson|module)\/([^?#]*)/);
    if (!(kind === 'lesson' ? L : M).has(target)) err(file, '找不到內部連結 ' + href);
  }
  const notesFile='lab-notes.yaml',noted=new Set();
  for(const row of found.has(notesFile)?list(notesFile):[]){
    if(!row||!slug(row.lesson)||!Array.isArray(row.tools)||!row.tools.length||!row.tools.every(slug)||new Set(row.tools).size!==row.tools.length||
      !present(row.note)||[...row.note].length>60){
      err(notesFile,'實驗註記須包含課程、不同的工具識別碼，及 60 字以內的說明');continue;
    }
    const {lesson,tools,note}=row;
    if(!L.has(lesson)){err(notesFile,'找不到實驗註記課程 '+lesson);continue}
    if(noted.has(lesson)){err(notesFile,'重複的實驗註記課程 '+lesson);continue}
    noted.add(lesson);bodies[lesson].labNote={lesson,tools,note};hz(note,notesFile);
  }
  const readyLessons=new Set(lessons.filter(l=>l.status==='ready').map(l=>l.id));
  for(const bank of interviews)for(const q of arr(bank.questions)){
    if(q.lesson!==undefined&&!readyLessons.has(q.lesson))err(fileOf.get(q.id),'面試題 '+q.id+' 的課程不可開啟：'+q.lesson);
  }
  for (const f of found) if (!consumed.has(f) && !assets.has(f)) warn(f,'已忽略非教材檔案');
  const refs = (f, vs, set) => arr(vs).forEach(v => {
    if (!set.has(v)) err(f, '未知參照 ' + v);
  });
  if(tracks.length<3||tracks.length>6||tracks.filter(t=>t.career===true).length!==1||new Set(tracks.map(t=>t.prefix)).size!==tracks.length)err('tracks.yaml','請定義 3–6 條路線、不同前綴與一條求職路線');
  for(const t of tracks)if(!slug(t.prefix)||typeof t.career!=='boolean'||!['stone','indigo','teal','amber','vermilion','slate'].includes(t.color)||!present(t.title)||!present(t.short)||t.id==='recommended')err('tracks.yaml','路線前綴、名稱、顏色或求職標記不符');
  if(roles.length<1||roles.length>4)err('roles.yaml','請定義 1–4 個角色');
  for(const ex of exercises)refs(fileOf.get(ex.id),ex.concepts,ids(concepts));
  for(const g of glossary){
    if(![g.term,g.en,g.short].every(present)||[...String(g.short)].length>80||!Array.isArray(g.aliases??[])||!arr(g.aliases).every(present)||!Array.isArray(g.tags)||!g.tags.every(present))err('glossary.yaml','術語格式不符');
    if(g.lesson)refs('glossary.yaml',[g.lesson],L);
    hz(JSON.stringify(g),'glossary.yaml');
  }
  refs('path.yaml', pathData?.recommended, M);
  for (const r of roles) {
    for (const s of arr(r.skills)) refs('roles.yaml', s.modules, M);
  }
  for (const t of [...projects, ...interviews]) {
    refs(fileOf.get(t.id), [t.track], T);
    refs(fileOf.get(t.id), t.modules, M);
  }
  for (const m of modules) {
    const f = fileOf.get(m.id);
    refs(f, [m.track], T);
    if(!m.id.startsWith(tracks.find(t=>t.id===m.track)?.prefix+'-'))err(f,'模組前綴與路線不符');
    if(m.skippable!==undefined&&typeof m.skippable!=='boolean')err(f,'可跳過標記不符');
    refs(f, m.prereqs, M);
    refs(f, m.roles, R);
    if (m.project) refs(f, [m.project], P);
    if (!lessons.some(l => l.module === m.id && l.status === 'ready')) warn(f, '模組尚無就緒課程');
    graph.set(m.id, [...arr(m.prereqs), ...lessons.filter(l => l.module === m.id).map(l => l.id)]);
  }
  for (const l of lessons) {
    refs(fileOf.get(l.id), l.prereqs, L);
    graph.set(l.id, [...l.prereqs, ...arr(modules.find(m => m.id === l.module)?.prereqs)]);
  }
  const done = new Set(),
    vis = new Set();
  function visit(n) {
    if (vis.has(n)) {
      err(fileOf.get(n), '先修條件形成循環 ' + n);
      return;
    }
    if (done.has(n)) return;
    vis.add(n);
    for (const v of graph.get(n) ?? []) visit(v);
    vis.delete(n);
    done.add(n);
  }
  for (const n of graph.keys()) visit(n);
  for (const [f, items] of [['tracks.yaml', tracks], ['roles.yaml', roles]]) hz(JSON.stringify(items), f);
  for (const m of modules) hz(JSON.stringify(m), fileOf.get(m.id));
  const counts = {
    tracks: tracks.length,
    modules: modules.length,
    lessons: lessons.length,
    ready: lessons.filter(l => l.status === 'ready').length,
    concepts: concepts.length,
    practice: practice.length,
    projects: projects.length,
    questions: interviews.flatMap(i => i.questions).length + concepts.filter(c => c.interview).length
  };
  const index = {
    tracks,
    roles,
    path: pathData ?? {
      recommended: []
    },
    modules,
    lessons,
    projects,
    counts
  };
  const sql={exercises,datasets,categories:[...categories.values()].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))};
  const hash = createHash('sha256').update(JSON.stringify([index, concepts, interviews, bodies,sql.categories,datasets,setups,glossary]));
  for (const asset of [...assets].sort()) hash.update(asset).update(fs.readFileSync(join(src,asset)));
  return {
    errors,
    warnings,
    index: {
      ...index,
      version: hash.digest('hex').slice(0, 12)
    },
    deck: {
      concepts,
      interviews
    },
    sql,setups,glossary,speech,lexicon,cardsSpeech:errors.length?null:cardSpeech(concepts,interviews,exercises,make),
    bodies,
    assets: [...assets].sort()
  };
}
function highlightCode(code,lang,escape){
  return lang&&hljs.getLanguage(lang)?hljs.highlight(code,{language:lang,ignoreIllegals:true}).value:(escape??new MarkdownIt().utils.escapeHtml)(code);
}
function render(s, f, err, make) {
  const md = new MarkdownIt({
      html: false,
      linkify: false
    }),
    tokens = md.parse(s, {}),
    outline = [],
    assets = [], links = [];
  const esc = md.utils.escapeHtml;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open' && ['h2', 'h3'].includes(t.tag)) {
      const id = 'section-' + (outline.length + 1);
      t.attrSet('id', id);
      outline.push({
        id,
        level: Number(t.tag[1]),
        text: tokens[i + 1].content
      });
    }
    if (t.type === 'blockquote_open') {
      const inline = tokens[i + 2],
        first = inline?.children?.[0];
      const m = first?.content.match(/^\[!(TIP|NOTE|WARN)\]\s*/);
      if (m) {
        t.attrSet('class', 'callout ' + m[1].toLowerCase());
        first.content = first.content.slice(m[0].length);
        t.attrSet('data-label', {
          TIP: '小提示',
          NOTE: '筆記',
          WARN: '請留意'
        }[m[1]]);
      }
    }
    for (const c of t.children ?? []) {
      if (c.type !== 'image' && c.type !== 'link_open') continue;
      const image = c.type === 'image', attr = image ? 'src' : 'href', href = c.attrGet(attr) ?? '';
      if (image || href.startsWith('assets/')) {
        let file;
        try { file = decodeURIComponent(href.split(/[?#]/)[0]); } catch {}
        if (!file?.startsWith('assets/') || file.split('/').some(part => !part || part.startsWith('.') || /[\\:]/.test(part))) {
          err(f, '素材須為本機 assets 檔案');
        } else {
          assets.push(file);
          c.attrSet(attr,'./content/' + href);
          if(image&&/\.(svg|png)$/i.test(file))c.attrJoin('class','lesson-diagram');
        }
      }
      if (!image && /^#\/(lesson|module)\//.test(href)) links.push(href);
      if (!image && !href.startsWith('#')) {
        c.attrSet('target','_blank');
        c.attrSet('rel','noopener noreferrer');
      }
    }
  }
  md.renderer.rules.fence = (ts, i) => {
    const t = ts[i],
      lang = t.info.trim().split(/\s+/)[0];
    if (!lang) err(f, '程式碼區塊缺少語言');
    const code=highlightCode(t.content,lang,esc);
    return `<div class="codebox"><div><span>${esc(lang)}</span><button type="button" data-copy>複製程式碼</button></div><pre><code>${code}</code></pre></div>`;
  };
  const marked=make?markLesson(tokens,make,esc):null;
  return {
    html: md.renderer.render(marked?.tokens??tokens, md.options, {}),
    speech:marked&&{segments:marked.segments,sections:marked.sections},
    outline,
    links,
    assets
  };
}
export function diagnostics(r) {
  for (const [label, xs] of [['警告', r.warnings], ['錯誤', r.errors]]) {
    for (const f of new Set(xs.map(x => x[0]))) console.log(label + ' ' + f + '\n  ' + xs.filter(x => x[0] === f).map(x => x[1]).join('\n  '));
  }
}
export function buildContent(src, out = resolve('public/content'), options) {
  const r = inspect(src, options);
  diagnostics(r);
  if (r.errors.length) throw Error('內容未通過檢查');
  fs.mkdirSync(join(out, 'lessons'), {
    recursive: true
  });
  const put = (p, o) => fs.writeFileSync(join(out, p), JSON.stringify(o));
  put('index.json', {...r.index,lessons:r.index.lessons.map(l=>({...l,practice:l.practice.map(t=>t.kind==='sql'?{id:t.id,kind:t.kind}:t)}))});
  put('concepts.json', r.deck);
  put('sql.json', r.sql);put('glossary.json',r.glossary);
  fs.mkdirSync(join(out,'datasets'),{recursive:true});
  for(const [id,text] of Object.entries(r.setups))fs.writeFileSync(join(out,'datasets',id+'.sql'),text);
  for (const b of Object.values(r.bodies)) put('lessons/' + b.id + '.json', b);
  // A rebuild must not ship a removed lesson or a previously referenced asset.
  const keep = new Set([...Object.keys(r.bodies).map(id=>'lessons/'+id+'.json'),...r.assets]);
  const prune = (dir) => {
    const base = join(out,dir);
    if (!fs.existsSync(base)) return;
    for (const e of fs.readdirSync(base,{withFileTypes:true})) {
      const key = dir+'/'+e.name;
      if (e.isDirectory()) prune(key);
      else if (!keep.has(key)) fs.unlinkSync(join(out,key));
    }
  };
  for(const id of Object.keys(r.setups))keep.add('datasets/'+id+'.sql');
  prune('datasets');
  prune('assets');
  prune('lessons');
  fs.mkdirSync(join(out,'speech'),{recursive:true});
  const putSpeech=(id,value)=>{const p='speech/'+id+'.json';put(p,value);keep.add(p)};
  for(const [id,lesson] of Object.entries(r.speech))putSpeech(id,lesson);
  putSpeech('cards',r.cardsSpeech);
  const keys=[...new Set([...segmentLeaves([r.speech,r.cardsSpeech])].map(s=>s.key))].sort();
  putSpeech('index',{voiceVersion,keys});
  prune('speech');
  for (const asset of r.assets) {
    fs.mkdirSync(path.dirname(join(out,asset)),{recursive:true});
    fs.copyFileSync(join(src,asset),join(out,asset));
  }
  console.log('內容來源：'+src+'；'+r.index.counts.lessons+' 堂課、'+r.index.counts.concepts+' 個知識點、'+r.sql.exercises.length+' 道 SQL 題。');
  return r;
}
