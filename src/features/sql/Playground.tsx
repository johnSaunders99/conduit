import {useId,useMemo,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ChevronDown,Database,Shuffle,Search} from 'lucide-react';
import {useWork} from '../../ui/context';
import {Title} from '../../ui/common';
import {catalogIndex} from '../../content/catalog';
import LazyWorkspace from './LazyWorkspace';
import {defaultPracticeFilters,loadCollapsed,practiceList,saveCollapsed,type PracticeFilters,type PracticeGroup,type StatusFilter} from './practiceList';

const statusOptions:Record<StatusFilter,string>={available:'可練（已學到）',all:'全部','not-done':'未做',passed:'已通過',retry:'需重練'};

export function ModuleGroups({groups,selected,collapsed,autoOpen,onToggle}:{
  groups:PracticeGroup[];selected?:string;collapsed:ReadonlySet<string>;autoOpen:boolean;onToggle:(id:string,open:boolean)=>void;
}){
  const id=useId(),[closedWhileFiltered,setClosedWhileFiltered]=useState(new Set<string>());
  return <div className="lab-groups">{groups.map(({module,rows,passed,total})=>{
    const open=!(autoOpen?closedWhileFiltered:collapsed).has(module.id),panelId=id+'-'+module.id;
    return <section key={module.id}>
      <h3><button type="button" className="lab-group-title" aria-expanded={open} aria-controls={panelId}
        onClick={()=>{
          if(autoOpen){
            const next=new Set(closedWhileFiltered);if(open)next.add(module.id);else next.delete(module.id);
            setClosedWhileFiltered(next);
          }
          onToggle(module.id,!open);
        }}>
        <ChevronDown size={15}/><span><strong>{module.title}</strong><small>{passed} / {total} 已通過</small></span>
      </button></h3>
      <div id={panelId} hidden={!open}>{open&&rows.map(({exercise:e,state,available})=><Link key={e.id} className="lab-row" aria-current={selected===e.id?'page':undefined} to={'/sql/'+e.id}>
        <b>{e.title}</b><span><i aria-label={'難度 '+e.level}>{'●'.repeat(e.level)+'○'.repeat(4-e.level)}</i> {e.tags.join(' · ')}</span>
        <small>{state}{!available&&'　·　還沒學到'}</small>
      </Link>)}</div>
    </section>;
  })}</div>;
}

export default function Playground(){
  const {cat,data,day}=useWork(),{id}=useParams(),nav=useNavigate(),[params]=useSearchParams(),free=params.get('tab')==='free';
  const [filters,setFilters]=useState<PracticeFilters>(defaultPracticeFilters),[collapsed,setCollapsed]=useState(()=>loadCollapsed());
  const [ds,pick]=useState(cat.datasets[0]?.id??'');
  const idx=catalogIndex(cat),selected=cat.exercises.find(e=>e.id===id),dataset=cat.datasets.find(d=>d.id===(free?ds:selected?.dataset));
  const list=useMemo(()=>practiceList(cat,data,day,filters),[cat,data,day,filters]);
  const {module,level,categories,status,search}=filters,query=search.trim().toLowerCase();
  const autoOpen=!!(module||level||categories.length||query||status!=='available'&&status!=='all');
  const filterKey=JSON.stringify([module,level,categories,status,query]);
  function change<K extends keyof PracticeFilters>(key:K,value:PracticeFilters[K]){setFilters(f=>({...f,[key]:value}))}
  function toggleGroup(id:string,open:boolean){
    const next=new Set(collapsed);if(open)next.delete(id);else next.add(id);
    setCollapsed(next);saveCollapsed(next);
  }
  return <><Title k="數據工作桌　 /　SQL LAB" title="SQL 練習場" sub="從一個問題開始。寫下查詢，用數據核對你的想法。"/>
    <nav className="lab-tabs" aria-label="練習模式"><Link aria-current={!free?'page':undefined} to="/sql">題目練習</Link><Link aria-current={free?'page':undefined} to="/sql?tab=free">自由練習</Link></nav>
    {free?<article className="panel free-lab"><label className="field">選擇數據集<select value={ds} onChange={e=>pick(e.target.value)}>{cat.datasets.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
      {dataset?<><p>{dataset.summary}</p><LazyWorkspace key={ds} dataset={dataset} source="playground"/></>:<p>還沒有可用的數據集。</p>}</article>:
    <div className={'lab-layout '+(selected?'lab-detail':'lab-index')}>
      <aside className="panel lab-list">
        <div className="sql-caption"><b>題目索引</b><span role="status">{list.matches.length} / {cat.exercises.length} 題</span></div>
        <label className="search"><Search size={15}/><input type="search" aria-label="搜尋 SQL 題目" placeholder="搜尋題名或標籤" value={search} onChange={e=>change('search',e.target.value)}/></label>
        <div className="lab-filters">
          <label className="field lab-module-filter">模組<select value={module} onChange={e=>change('module',e.target.value)}>
            <option value="">全部</option>{list.modules.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
          </select></label>
          {!!cat.sqlCategories.length&&<fieldset className="lab-categories"><legend>分類</legend><div className="lab-category-chips">
            {cat.sqlCategories.map(c=>{
              const chosen=categories.includes(c.id),count=list.categoryCounts.get(c.id)??0;
              return <button type="button" key={c.id} title={c.summary} aria-pressed={chosen} disabled={!chosen&&count===0}
                onClick={()=>change('categories',chosen?categories.filter(id=>id!==c.id):[...categories,c.id])}>{c.label} <small>{count}</small></button>;
            })}
          </div></fieldset>}
          <label className="field">難度<select value={level} onChange={e=>change('level',e.target.value)}><option value="">全部</option>
            {[1,2,3,4].map(v=><option key={v} value={v}>等級 {v}</option>)}
          </select></label>
          <label className="field">狀態<select value={status} onChange={e=>change('status',e.target.value as StatusFilter)}>
            {Object.entries(statusOptions).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <button type="button" disabled={!list.random.length} onClick={()=>nav('/sql/'+list.random[Math.floor(Math.random()*list.random.length)].id)}><Shuffle size={14}/>隨機一題</button>
        {!list.matches.length&&<div className="lab-empty">
          {list.emptyAvailable&&list.firstLesson?<><p>完成第一堂含 SQL 題的課，題目就會出現在這裡</p>
            <Link className="button primary" to={'/lesson/'+list.firstLesson.id}>前往第一堂 SQL 課 →</Link></>:<>
            <p>沒有符合的題目，試試其他篩選條件。</p>
            {(autoOpen||status!=='available')&&<button type="button" onClick={()=>setFilters(defaultPracticeFilters)}>清除篩選</button>}
          </>}
        </div>}
        {!!list.matches.length&&!list.random.length&&<small>目前的篩選下，沒有已完成課程的未通過題目。</small>}
        <ModuleGroups key={filterKey} groups={list.groups} selected={id} collapsed={collapsed} autoOpen={autoOpen} onToggle={toggleGroup}/>
      </aside>
      <article className="panel lab-sheet">{selected&&dataset?<><Link className="back-list" to="/sql">← 題目索引</Link><div className="eyebrow">SQL 練習　 /　等級 {selected.level}</div>
        <h2>{selected.title}</h2><p className="lab-links"><Link to={'/module/'+selected.moduleId}>{idx.moduleById.get(selected.moduleId)?.title}</Link><Link to={'/lesson/'+selected.lessonId}>回到課程 →</Link></p>
        <LazyWorkspace key={selected.id} exercise={selected} dataset={dataset} source="playground"/></>:
        <div className="lab-start"><Database/><h2>{id?'找不到這道題目':list.emptyAvailable?'從課程開始':'先選一道題目'}</h2>
          <p>{list.emptyAvailable?'也可以將狀態切到「全部」，先瀏覽練習。':'從左側選一道題，預覽數據表、執行查詢並檢查答案。'}</p>
          {list.matches[0]&&<Link className="button primary" to={'/sql/'+list.matches[0].id}>試試「{list.matches[0].title}」 →</Link>}
        </div>}</article></div>}
    </>;
}
