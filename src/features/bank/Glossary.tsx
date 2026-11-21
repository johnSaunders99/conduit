import {useId,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import type {Term} from '../../content/types';
import {useWork} from '../../ui/context';

const letters=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
function variants(g:Term){
  const term=g.term.trim(),different=(s?:string)=>s?.trim()&&s.trim()!==term;
  const aliases=[...new Set(g.aliases?.map(s=>s.trim()).filter(different))];
  return [different(g.cn)&&'大陸：'+g.cn,different(g.tw)&&'台灣：'+g.tw,aliases.length?'別名：'+aliases.join('、'):null].filter(Boolean).join(' · ');
}
export default function Glossary(){
  const {cat}=useWork(),[q,search]=useState(''),[tag,select]=useState(''),prefix=useId();
  const terms=useMemo(()=>[...cat.glossary].sort((a,b)=>a.en.localeCompare(b.en,'en')),[cat.glossary]);
  const needle=q.trim().toLowerCase();
  const rows=terms.filter(g=>(!tag||g.tags.includes(tag))&&[g.term,g.en,g.cn,g.tw,g.short,...(g.aliases??[])].join(' ').toLowerCase().includes(needle));
  const first=new Map<string,string>();
  const id=(term:string)=>prefix+'-term-'+term;
  for(const g of rows){
    const letter=g.en.trim().slice(0,1).toUpperCase();
    if(!first.has(letter))first.set(letter,id(g.id));
  }
  function jump(target:string){
    const row=document.getElementById(target);
    row?.focus({preventScroll:true});
    row?.scrollIntoView({block:'start'});
  }
  return <>
    <div className="panel fields">
      <label className="field">搜尋術語<input type="search" placeholder="中文、英文或別名" value={q} onChange={e=>search(e.target.value)}/></label>
      <label className="field">標籤<select value={tag} onChange={e=>select(e.target.value)}><option value="">全部</option>{[...new Set(cat.glossary.flatMap(g=>g.tags))].map(t=><option key={t}>{t}</option>)}</select></label>
    </div>
    <nav className="glossary-index" aria-label="依英文首字母跳轉">
      {letters.map(letter=>{const target=first.get(letter);return target?
        <button type="button" key={letter} aria-controls={target} onClick={()=>jump(target)}>{letter}</button>:
        <span aria-hidden="true" key={letter}>{letter}</span>})}
    </nav>
    <p role="status">{rows.length} 個術語 · 依英文排序</p>
    {rows.length>0?<ul className="glossary-list">{rows.map(g=>{
      const detail=variants(g), lesson=cat.lessons.find(l=>l.id===g.lesson);
      return <li key={g.id} id={id(g.id)} tabIndex={-1}>
        <div className="glossary-head">
          <h2>{g.term} <span lang="en">{g.en}</span></h2>
          {lesson&&<Link to={'/lesson/'+lesson.id} aria-label={'閱讀課程：'+lesson.title}>課程 →</Link>}
        </div>
        <p>{g.short}</p>
        {detail&&<small className="glossary-variants">{detail}</small>}
      </li>;
    })}</ul>:<p>沒有符合的術語。試試別名，或清除篩選。</p>}
  </>;
}
