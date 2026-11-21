import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Compass, Layers, FlaskConical, AlertTriangle, ListChecks} from 'lucide-react';

export const voiceVersion='conduit-tw-2';
export const audioRoot='F:\\ConduitTTS\\audio';
// The cache namespace is fixed so packs made before M7 still match identical speech.
const speechKeyNamespace='conduit-tw-1';
const numeral='零一二三四五六七八九';
const digits=(s,zero='〇')=>[...s].map(c=>c==='0'?zero:numeral[Number(c)]).join('');
function integer(s){
  if(s.length>12||/^0\d/.test(s))return digits(s);
  const groups=s.match(/.{1,4}(?=(?:.{4})*$)/g)??[];
  let out='',gap=false;
  groups.forEach((g,i)=>{
    if(!Number(g)){if(out)gap=true;return}
    if(out&&(gap||g.startsWith('0')))out+='零';
    gap=false;let zero=false;
    [...g].forEach((c,j)=>{
      const p=g.length-j-1;
      if(c==='0'){zero=true;return}
      if(zero&&/[1-9]/.test(g.slice(0,j)))out+='零';
      zero=false;out+=(c==='1'&&p===1&&!out?'':numeral[Number(c)])+['','十','百','千'][p];
    });
    out+=['','萬','億'][groups.length-i-1];
  });
  return out||'零';
}
const decimal=s=>{
  const [a,b]=s.replaceAll(',','').split('.');
  return integer(a)+(b?'點'+digits(b,'零'):'');
};
const countUnits='個張列欄筆條次項件本份位台臺套人層階種冊名組段字題行間批輪級步堂箱束杯封則枚顆片頁歲週天年時分秒元升克斤米度倍成';
const simplerCounts=new Set(countUnits);
const unitCN='(?:小時|分鐘|毫秒|微秒|奈秒|公斤|公尺|公分|毫米|公里|位元|公升|'+
  '['+countUnits+'月號樓日])';
const unitEN='(?:[KMGT]i?B|PB|B|bytes?|bits?|rows?|records?|items?|m?s|min|hours?|k?Hz|MHz|GHz|px|kg|km)(?!\\w)';
const numberSource='(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const quantity=new RegExp('(?<![\\w.])('+numberSource+')(\\s*)('+unitCN+'|'+unitEN+')','gi');
const number=new RegExp('(?<![\\w.])('+numberSource+')(?!\\w|\\.\\d)','g');
const percent=new RegExp('(?<![\\w.])('+numberSource+')\\s*[%％]','g');
const year=/(?<![\w.])(\d{4})\s*年/g;
const monthSource='(?:0?[1-9]|1[0-2])',daySource='(?:0?[1-9]|[12]\\d|3[01])';
const isoDate=new RegExp('(?<![\\w.])(\\d{4})([-/])('+monthSource+')\\2('+daySource+')(?!\\w|[-/.]\\d)','g');
const chineseDate=new RegExp('(?<![\\w.])(\\d{4})\\s*年\\s*('+monthSource+')\\s*月\\s*('+daySource+')\\s*日','g');
const sayDate=(y,m,d)=>digits(y)+'年'+integer(String(Number(m)))+'月'+integer(String(Number(d)))+'日';
const hhmm=/(?<![\w\d:])(?:(凌晨|早上|上午|中午|下午|傍晚|晚上)\s*)?([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?![\w\d:])/g;
function sayTime(part,h,m,s){
  // Do not infer a day period for a bare 24-hour time.
  const hour=part&&Number(h)>12?Number(h)-12:Number(h);
  const start=(part??'')+(hour===2?'兩':integer(String(hour)))+'點';
  if(part&&Number(m)===30&&!s)return start+'半';
  const minute=Number(m)||s?integer(String(Number(m)))+'分':'';
  return start+minute+(s?integer(String(Number(s)))+'秒':'');
}

const escapeRE=s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
const keywords=/(?<!\w)(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|GROUP\s+BY|ORDER\s+BY|PARTITION\s+BY|HAVING|AS|AND|OR|NOT|NULL|WITH|UNION(?:\s+ALL)?|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|DISTINCT|LIMIT|OFFSET|OVER|INSERT|UPDATE|DELETE|DROP|ASC|DESC|BETWEEN|IN|ON|CREATE|TABLE|MERGE|EXISTS|ROW_NUMBER|RANK|DENSE_RANK)(?!\w)/g;
const patterns=new WeakMap();
const partLookups=new WeakMap();
function dictionary(terms){
  if(!patterns.has(terms)){
    const lookup=new Map(Object.entries(terms).map(([k,v])=>[k.toLowerCase(),v]));
    const names=[...lookup.keys()].sort((a,b)=>b.length-a.length);
    const matcher=names.length?new RegExp('(?<!\\w)(?:'+names.map(escapeRE).join('|')+')(?!\\w)','gi'):null;
    patterns.set(terms,{matcher,lookup});
  }
  return patterns.get(terms);
}
const empty=Object.freeze({});
function identifier(word,parts,terms){
  // These are SQL function keywords, not compound column names.
  if(word==='row_number'||word==='dense_rank')return word.replace('_',' ');
  const code=/^([a-z])(\d+)$/i.exec(word);
  if(code&&code[1].toLowerCase()!=='v'){
    const n=code[2];
    return code[1].toUpperCase()+(n.length>=4?digits(n):integer(n));
  }
  const pieces=word.replace(/([A-Z]+)([A-Z][a-z])/g,'$1_$2').replace(/([a-z\d])([A-Z])/g,'$1_$2').split(/_+/).filter(Boolean);
  const expand=x=>parts.get(x.toLowerCase())??terms.get(x.toLowerCase())??x;
  if(pieces.length>1)return pieces.map(expand).join('、');
  return word==='n'?expand(word):word;
}
export function normalise(input,lexicon=empty,readEnglish=false,identifierParts=empty){
  const held=[];
  const keep=s=>'\uE000'+String.fromCharCode(0xe100+held.push(s)-1)+'\uE001';
  let s=input.replace(/(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*)/gu,'').replace(/[\uFE0F\u200D]/g,'');
  s=s.replace(/[(（]([^()（）]*)[)）]/g,(m,t,offset)=>!readEnglish&&/[A-Za-z]/.test(t)&&!/\p{Script=Han}/u.test(t)&&!(m[0]==='('&&/\b(?:COUNT|DISTINCT|SUM|AVG|MIN|MAX|COALESCE|ROUND|CAST|VARCHAR|LOWER|UPPER|LAG|LEAD|ARRAY|COUNT_IF|[a-z]\w*)$/.test(s.slice(0,offset)))&&(offset>0||offset+m.length<s.length)?'':m);
  s=s.replace(/https?:\/\/[^\s<>"「」『』，。；！？、）)]+/gi,m=>{
    try{
      const url=new URL(m.replace(/[.!?]+$/,''));
      const host=/^(?:localhost|127\.0\.0\.1)$/.test(url.hostname)?'本機':url.hostname.replace(/^www\./,'');
      return keep(host+(url.port?'，連接埠'+digits(url.port):''))+(m.match(/[.!?]+$/)?.[0]??'');
    }catch{return m}
  });
  s=s.replace(/\b([A-Z]):[\\/](?:[\w.-]+[\\/])*[\w.-]+/gi,(m,d)=>{
    const p=m.slice(3).split(/[\\/]/);return keep(d.toUpperCase()+'槽'+p.slice(0,-1).join('、')+(p.length>1?'底下的':'')+p.at(-1));
  });
  s=s.replace(isoDate,(_,y,sep,m,d)=>keep(sayDate(y,m,d)))
    .replace(chineseDate,(_,y,m,d)=>keep(sayDate(y,m,d)))
    .replace(year,(_,y)=>keep(digits(y)+'年'));
  s=s.replace(/((?:連接埠|(?<!\w)port)\s*[:：]?\s*|(?<=localhost|127\.0\.0\.1):)(\d{2,5})(?!\w)/gi,(_,p,n)=>keep((p===':'?'，':'')+'連接埠'+digits(n)))
    .replace(/(?<![\w.])(?:localhost|127\.0\.0\.1)(?![\w.])/g,()=>keep('本機'));
  s=s.replace(hhmm,(_,part,h,m,sec)=>keep(sayTime(part,h,m,sec)));
  s=s.replace(/(?:版本\s*|(?<![\w.]))v?(\d+(?:\.\d+){2,})(?!\w|\.\d)/gi,(_,v)=>keep('版本'+v.split('.').map(integer).join('點')))
    .replace(/(?:版本\s*v?|(?<!\w)v)(\d+\.\d+)(?!\w|\.\d)/gi,(_,v)=>keep('版本'+decimal(v)));
  s=s.replace(/第\s*(\d+)(?!\d|\.\d)/g,(_,n)=>keep('第'+integer(n.replace(/^0+(?=\d)/,''))));
  s=s.replace(percent,(_,v)=>keep('百分之'+decimal(v)));
  s=s.replace(quantity,(_,v,gap,unit)=>{
    const usesLiang=unit.length===1?simplerCounts.has(unit):/^[\p{Script=Han}]+$/u.test(unit);
    // A ticket suffix is an identifier, not a count of tickets.
    const plain=v.replace(/^0+(?=\d)/,'');
    const value=unit==='號'&&/^\d{4,}$/.test(v)?digits(v):plain==='2'&&usesLiang?'兩':decimal(plain);
    return keep(value+gap+unit);
  });
  s=s.replace(number,(_,v)=>keep(/^\d{4,}$/.test(v)?digits(v):decimal(v)));
  const {matcher,lookup}=dictionary(lexicon);
  s=s.replace(keywords,m=>m.toLowerCase());
  if(matcher)s=s.replace(matcher,m=>keep(lookup.get(m.toLowerCase())));
  if(!partLookups.has(identifierParts))partLookups.set(identifierParts,new Map(Object.entries(identifierParts).map(([k,v])=>[k.toLowerCase(),v])));
  const parts=partLookups.get(identifierParts);
  s=s.replace(/(?<!\w)_*[A-Za-z][\w]*(?!\w)/g,word=>identifier(word,parts,lookup));
  return s
    .replace(/(?<=\w)[(（]\s*([^()（）]*)[)）]/g,' $1')
    .replace(/[（）()]/g,'，')
    .replace(/>=|≤|<=|≥|!=|<>|→|←|⇒|×|÷|＝|=|\+/g,m=>({'≥':'大於等於','>=':'大於等於','≤':'小於等於','<=':'小於等於','!=':'不等於','<>':'不等於','→':'到','←':'往回到','⇒':'所以','×':'乘以','÷':'除以','＝':'等於','=':'等於','+':'加上'})[m])
    .replace(/\uE000(.)\uE001/gu,(_,c)=>held[c.charCodeAt(0)-0xe100])
    .replace(/\s+/g,' ')
    .replace(/(?<=\p{Script=Han}) (?=[\p{Script=Han}A-Za-z\d])|(?<=[A-Za-z\d]) (?=\p{Script=Han})/gu,'')
    .replace(/^[，、；\s]+|[，、\s]+$/g,'')
    .replace(/[\s，]+(?=[，。；：！？、])/g,'').trim();
}
export const speechKey=speak=>createHash('sha256').update(speechKeyNamespace+'\0'+speak).digest('hex').slice(0,20);
const sentenceEnd=/[。！？!?]+[」』”’）)]*|\.(?=\s|$)/gu;
const splitText=s=>{
  const result=[];let start=0;
  for(const m of s.matchAll(sentenceEnd)){const end=m.index+m[0].length;result.push([s.slice(start,end),true]);start=end}
  if(start<s.length)result.push([s.slice(start),false]);
  return result;
};
export const makeSpeech=(lexicon=empty,identifierParts=empty)=>(text,kind,n,extra={})=>{
  const speak=normalise(text,lexicon,false,identifierParts),read=normalise(text,lexicon,true,identifierParts);
  return {n,kind,text,speak:speak||read,key:speechKey(speak||read),...(read&&speak&&read!==speak?{english:{speak:read,key:speechKey(read)}}:{}),...extra};
};
const languages={sql:'SQL',python:'Python',py:'Python',powershell:'PowerShell',ps1:'PowerShell',yaml:'YAML',yml:'YAML',java:'Java',bash:'Shell',sh:'Shell',json:'JSON',text:'文字',plaintext:'文字',txt:'文字',mermaid:'流程圖',dockerfile:'Dockerfile',javascript:'JavaScript',js:'JavaScript',ts:'TypeScript'};
const icons=[[/為什麼|為何|學習目標/,Compass],[/概念|原理/,Layers],[/範例|實例|演練/,FlaskConical],[/錯誤|陷阱|注意/,AlertTriangle],[/小結|總結|重點回顧/,ListChecks]];
const spokenText=t=>t.type==='softbreak'||t.type==='hardbreak'?' ':['text','code_inline','image'].includes(t.type)?t.content:'';
const raw=(t,content,type='html_inline')=>{const x=new t.constructor(type,'',0);x.content=content;return x};
const span=n=>'<span class="sg" data-sg="'+n+'">';
export function markLesson(tokens,make,escape){
  const segments=[],sections=[],result=[];let part=-1,ctx=[],encourage=false,headingCount=0;
  const opening=(title,anchor)=>{
    if(part>=0)result.push(raw(tokens[0],'</section>\n','html_block'));
    part++;sections.push({title,anchor,start:segments.length});
    result.push(raw(tokens[0],'<section class="speech-part" data-part="'+part+'">\n','html_block'));
  };
  const add=(text,kind)=>{const seg=make(text.trim(),kind,segments.length,{part,emotion:encourage?'encourage':'narrate'});if(!seg.speak)return null;segments.push(seg);return seg.n};
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t.type==='heading_open'&&t.tag==='h2'&&!ctx.length){
      const title=tokens[i+1].children.map(spokenText).join('');
      encourage=/小結|總結/.test(title);opening(title,t.attrGet('id'));
      const end=tokens.findIndex((next,j)=>j>i&&next.type==='heading_open'&&next.tag==='h2'&&next.level===0);
      const example=tokens.slice(i+2,end<0?undefined:end).some(next=>next.type==='fence');
      const Icon=icons.find(([p])=>p.test(title))?.[1]??(headingCount===0?Compass:example?FlaskConical:Layers);
      headingCount++;
      tokens[i+1].speechIcon=renderToStaticMarkup(createElement(Icon,{size:19,className:'section-icon','aria-hidden':true}));
    }else if(part<0)opening('導讀',null);
    if(t.type==='fence'||t.type==='code_block'||t.type==='table_open'){
      const table=t.type==='table_open',lang=t.info.trim().split(/\s+/)[0].toLowerCase();
      const text=table?'下面是一張對照表。':lang==='sql'?'下面是一段 SQL，先看畫面上的查詢。':'下面是一段 '+((languages[lang]??lang)||'程式碼')+'，先看畫面上的內容。';
      const n=add(text,table?'table-lead':'code-lead');
      if(n!==null)result.push(raw(t,'<div class="speech-lead">'+span(n)+escape(text)+'</span></div>\n','html_block'));
    }
    if(t.nesting===1)ctx.push(t.type);
    if(t.type==='inline'&&!ctx.includes('table_open')){
      const kind=ctx.includes('heading_open')?'heading':ctx.includes('blockquote_open')?'callout':ctx.includes('list_item_open')?'list':'sentence';
      const children=[];let group=[],nesting=0,text='';
      const flush=()=>{
        const n=add(text,kind);
        if(n===null)children.push(...group);else children.push(raw(t,span(n)),...group,raw(t,'</span>'));
        group=[];text='';
      };
      for(const c of t.children){
        if(c.type==='text'&&!nesting&&kind!=='heading'){
          for(const [value,end] of splitText(c.content)){const copy=new c.constructor('text','',0);copy.content=value;group.push(copy);text+=value;if(end)flush()}
        }else{
          group.push(c);text+=spokenText(c);nesting+=c.nesting;
          if(c.nesting<0&&!nesting&&kind!=='heading'&&/[。！？!?][」』”’）)]*$/.test(text))flush();
        }
      }
      flush();
      if(t.speechIcon)children.unshift(raw(t,t.speechIcon));
      t.children=children;
    }
    if(t.type==='table_open')result.push(raw(t,'<div class="table-scroll" tabindex="0" role="region" aria-label="表格">','html_block'));
    result.push(t);
    if(t.type==='table_close')result.push(raw(t,'</div>','html_block'));
    if(t.nesting===-1)ctx.pop();
  }
  if(part>=0)result.push(raw(tokens[0],'</section>\n','html_block'));
  return {tokens:result,segments,sections};
}
export function cardSpeech(concepts,interviews,exercises,make){
  const segment=(text,kind,emotion)=>splitText(String(text??'').replace(/^\s*(?:[-*]|\d+[.)])\s+/gm,'').replace(/[\x60*]/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')).filter(([v])=>v.trim()).map(([v],n)=>make(v.trim(),kind,n,{emotion})).filter(s=>s.speak);
  const answer=(v,kind='answer')=>segment(v,kind,'explain');
  const ask=(v,kind='question')=>segment(v,kind,'ask');
  return {
    optionLetters:Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,Math.max(0,...concepts.map(c=>c.mcq?.options.length??0))),x=>ask(x+'。','option')),
    concepts:Object.fromEntries(concepts.map(c=>[c.id,{prompt:ask(c.prompt,'prompt'),answer:answer(c.answer),...(c.mcq?{mcq:{question:ask(c.mcq.question),options:c.mcq.options.map(o=>ask(o,'option')),explain:answer(c.mcq.explain,'explain')}}:{})}])),
    interviews:Object.fromEntries([...interviews.flatMap(b=>b.questions),...concepts.filter(c=>c.interview).map(c=>({...c.interview,id:c.id}))].map(q=>[q.id,{question:ask(q.question),points:(q.points??[]).flatMap((p,i)=>answer('第'+(i+1)+'點，'+p,'point')),reference:answer(q.reference??q.answer,'reference')}])),
    sql:Object.fromEntries(exercises.map(e=>[e.id,{prompt:ask(e.prompt,'sql-prompt'),explain:answer(e.explain,'explain')}]))
  };
}
export function* segmentLeaves(object){
  if(!object||typeof object!=='object')return;
  if(typeof object.key==='string'&&typeof object.speak==='string'){yield object;if(object.english)yield {...object,...object.english,english:undefined};return}
  for(const x of Object.values(object))yield* segmentLeaves(x);
}