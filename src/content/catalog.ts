import type {Catalog, Concept, Lesson, Question, TrackId} from './types'

export const skipModules=(cat:Catalog)=>catalogIndex(cat).ordered.filter(m=>m.track===cat.tracks[0]?.id||m.skippable)
export const trackColor=(cat:Catalog,id:string)=>cat.tracks.find(t=>t.id===id)?.color??'slate'
export const focusOptions=(cat:Catalog):Record<string,string>=>Object.fromEntries([['recommended','跟著建議'],...[...cat.tracks].sort((a,b)=>Number(a.career)-Number(b.career)).map(t=>[t.id,t.short])])
type Index = Omit<Catalog, 'concepts'|'questions'|'datasets'|'exercises'|'sqlCategories'|'glossary'>
type SqlDeck=Pick<Catalog,'exercises'|'datasets'>&{categories?:Catalog['sqlCategories']}
type Deck = {concepts:Concept[]; interviews:{id:string;title:string;track:TrackId;questions:Omit<Question,'track'|'set'>[]}[]}
function buildIndex(cat:Catalog) {
  const concepts = new Map(cat.concepts.map(c=>[c.id,c]))
  const lessons = new Map(cat.lessons.map(l=>[l.id,l]))
  const trackOrder=cat.tracks.map(t=>t.id)
  const terms=new Map<string,string[]>()
  for(const g of cat.glossary??[])if(g.lesson)terms.set(g.lesson,[...(terms.get(g.lesson)??[]),g.term,g.en,g.cn??'',g.tw??'',...(g.aliases??[])])
  const rows = new Map<string,{lesson:Lesson;text:string}[]>()
  for(const l of cat.lessons){
    const text=[l.title,l.subtitle,...(terms.get(l.id)??[]),...l.objectives,...l.tags,...l.concepts.map(id=>concepts.get(id)?.prompt)].filter(Boolean).join(' ').toLowerCase()
    const group=rows.get(l.module)??[]
    group.push({lesson:l,text});rows.set(l.module,group)
  }
  for (const group of rows.values()) group.sort((a,b)=>a.lesson.order-b.lesson.order || a.lesson.id.localeCompare(b.lesson.id))
  const modules=new Map(cat.modules.map(m=>[m.id,[m.title,m.subtitle].filter(Boolean).join(' ').toLowerCase()]))
  const pathRank=new Map((cat.path.recommended??[]).map((id,i)=>[id,i]))
  const ordered=[...cat.modules].sort((a,b)=>(pathRank.get(a.id)??Infinity)-(pathRank.get(b.id)??Infinity)
    || trackOrder.indexOf(a.track)-trackOrder.indexOf(b.track)||a.order-b.order||a.id.localeCompare(b.id))
  const tracks=cat.tracks
  const orderedLessons=ordered.flatMap(m=>(rows.get(m.id)??[]).map(r=>r.lesson))
  const moduleById=new Map(ordered.map(m=>[m.id,m]))
  const positions=new Map(ordered.flatMap(m=>[m.id,...(rows.get(m.id)??[]).map(r=>r.lesson.id)]).map((id,i)=>[id,i]))
  return {concepts,lessons,rows,modules,ordered,tracks,orderedLessons,moduleById,positions}
}
const cache=new WeakMap<Catalog,ReturnType<typeof buildIndex>>()
export function catalogIndex(cat:Catalog){let index=cache.get(cat);if(!index){index=buildIndex(cat);cache.set(cat,index)}return index}
export function curriculumTitle(cat:Catalog,id:string) {
  const index=catalogIndex(cat)
  return index.lessons.get(id)?.title ?? index.moduleById.get(id)?.title ?? id
}
export function inPathOrder(cat:Catalog, ids:string[]) {
  const {positions}=catalogIndex(cat)
  return [...ids].sort((a,b)=>(positions.get(a)??Infinity)-(positions.get(b)??Infinity))
}
export function assembleCatalog(index:Index,deck:Deck,sql:SqlDeck={exercises:index.lessons.flatMap(l=>l.practice.filter(t=>t.kind==="sql")),datasets:[]},glossary:Catalog["glossary"]=[]):Catalog {
  const tasks=new Map(sql.exercises.map(e=>[e.id,e]))
  const {exercises,datasets,categories:sqlCategories=[]}=sql;
  const cat:Catalog={...index,exercises,datasets,sqlCategories,glossary,lessons:index.lessons.map(l=>({...l,practice:l.practice.map(t=>tasks.get(t.id)??t)})),concepts:deck.concepts,questions:[]}
  const {orderedLessons,concepts}=catalogIndex(cat)
  for(const lesson of orderedLessons) for(const id of lesson.concepts) {
    const c=concepts.get(id)
    if(c?.interview) cat.questions.push({...c.interview,id:c.id,conceptId:c.id,track:c.trackId,module:c.moduleId,tags:c.tags})
  }
  for(const bank of deck.interviews) {
    const set={id:bank.id,title:bank.title}
    for(const q of bank.questions) cat.questions.push({...q,track:bank.track,set})
  }
  return cat
}
export function searchModules(cat:Catalog,track:TrackId|'all',query:string){
  const idx=catalogIndex(cat),q=query.trim().toLowerCase()
  return idx.ordered.flatMap(m=>{
    if(track!=='all'&&m.track!==track)return []
    const rows=idx.rows.get(m.id)??[], hits=q?rows.filter(r=>r.text.includes(q)).map(r=>r.lesson):[]
    return !q||idx.modules.get(m.id)?.includes(q)||hits.length?[{m,rows,hits}]:[]
  })
}
