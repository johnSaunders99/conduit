import fs from 'node:fs';
import path from 'node:path';
import {inspect,source,diagnostics} from './content.mjs';
import {segmentLeaves,audioRoot} from './speech.mjs';
import {validateManifest} from '../server/audio.mjs';

const [command,...args]=process.argv.slice(2);
const option=(name)=>{
  const i=args.indexOf(name);
  if(i!==-1&&(!args[i+1]||args[i+1].startsWith('--')))throw Error(name+' 需要指定路徑');
  return i<0?undefined:args[i+1];
};
const r=inspect(source(args));
if(r.errors.length){diagnostics(r);throw Error('教材檢查未通過')}
const modules=[...r.index.modules].sort((a,b)=>{
  const order=r.index.path.recommended;
  const pos=id=>order.includes(id)?order.indexOf(id):Infinity;
  return pos(a.id)-pos(b.id)||a.order-b.order||a.id.localeCompare(b.id);
});
const batches=modules.map((m,i)=>({id:m.id,title:m.title,pathOrder:i+1,rows:[]}));
const lessons=new Map();
for(const m of batches){
  for(const l of r.index.lessons.filter(l=>l.module===m.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))){
    const {concepts,sql,interviews}=r.cardsSpeech;
    const data=[r.speech[l.id],...r.deck.concepts.filter(c=>c.lessonId===l.id).flatMap(c=>[concepts[c.id],interviews[c.id]]),
      ...r.sql.exercises.filter(e=>e.lessonId===l.id).map(e=>sql[e.id]),
      ...r.deck.interviews.flatMap(b=>b.questions.filter(q=>q.lesson===l.id).map(q=>interviews[q.id]))];
    const rows=[...segmentLeaves(data)].map(s=>({s,lessonId:l.id}));m.rows.push(...rows);lessons.set(l.id,m);
  }
}
const extra=[...r.deck.interviews.flatMap(b=>b.questions.filter(q=>!lessons.has(q.lesson)).map(q=>r.cardsSpeech.interviews[q.id])),
  ...r.sql.exercises.filter(e=>!lessons.has(e.lessonId)).map(e=>r.cardsSpeech.sql[e.id]),r.cardsSpeech.optionLetters];
batches.push({id:'shared',title:'共用語句與未對應課堂的題目',pathOrder:batches.length+1,rows:[...segmentLeaves(extra)].map(s=>({s,lessonId:null}))});
const unique=new Set();
if(command==='export'){
  const out=path.resolve(option('--out')??'F:\\ConduitTTS\\work\\segments.jsonl');
  const lines=batches.flatMap(({pathOrder,rows})=>rows.flatMap(({s,lessonId})=>{
    const {key,speak,kind,emotion}=s;
    if(unique.has(key))return [];unique.add(key);
    const polyphones=r.lexicon.polyphones.filter(p=>speak.includes(p.text));
    return [JSON.stringify({key,speak,kind,lessonId,pathOrder,emotion,...(polyphones.length?{polyphones}:{})})];
  }));
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,lines.join('\n')+'\n');console.log(lines.length+' 句 → '+out);
}else if(command==='status'){
  const manifest=option('--manifest');
  const voice=option('--voice');
  if(!manifest&&(!args.includes('--voice')||!/^[a-z0-9][-_.a-z0-9]*$/i.test(voice??'')))throw Error('請指定 --manifest <檔案> 或 --voice <voiceId>');
  const raw=JSON.parse(fs.readFileSync(manifest??path.join(process.env.CONDUIT_AUDIO_DIR??audioRoot,voice,'manifest.json'),'utf8'));
  const m=validateManifest(raw,raw.voiceId);
  if(!m)throw Error('聲線清單格式不符');
  const covered=keys=>[...keys].filter(k=>Object.hasOwn(m.items,k)).length;
  console.log(m.voiceLabel+' · '+m.engine);
  for(const {id,title,rows} of batches){
    const keys=new Set(rows.map(({s})=>s.key));for(const k of keys)unique.add(k);
    console.log(id+' '+title+'：'+covered(keys)+' / '+keys.size);
  }
  console.log('全課程（不重複）：'+covered(unique)+' / '+unique.size);
}else throw Error('請使用 export 或 status');
