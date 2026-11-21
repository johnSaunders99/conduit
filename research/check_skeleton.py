"""Validate the published Conduit curriculum with Python + PyYAML. No app build or writes."""
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
from datetime import date
import csv,json,re,sys,yaml
ROOT=Path(__file__).resolve().parents[1]
APP_LINK=re.compile(r'#/((?:lesson|sql|module))/([a-z0-9-]+)')
PLACEHOLDERS=('用自己的例子解釋','選讀本題','指出一個看似合理、卻會多算或漏算的寫法','用含邊界值的小表')
# A preview must point forward; review links and cross-references may point back.
PREVIEW=re.compile(r'(?:之後在|稍後在|日後在|留到|下一(?:堂|節|課|模組))[^\n。；]{0,35}\[[^\]]+\]\(#/lesson/([a-z0-9-]+)\)')

C=ROOT/'content';R=ROOT/'research'
def read(p):return yaml.safe_load(p.read_text('utf-8-sig'))
def front(p):
 s=p.read_text('utf-8-sig');assert s.startswith('---\n'),p
 _,f,b=s.split('---\n',2);return yaml.safe_load(f),b
def rows(n):
 with (R/n).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def req(o,keys,label):
 for k in keys.split():assert k in o and o[k] is not None,(label,'missing',k)
def seq(o,lo,hi=10**6):return isinstance(o,list) and lo<=len(o)<=hi
def cycle(g):
 done=set();active=set()
 def visit(v):
  assert v in g,('unresolved prerequisite',v)
  assert v not in active,('prerequisite cycle',v)
  if v in done:return
  active.add(v)
  for w in g[v]:visit(w)
  active.remove(v);done.add(v)
 for v in g:visit(v)
def manifest():
 tasks=[];ds={}
 for p in sorted((C/'datasets').glob('*/dataset.yaml')):
  d=read(p);ds[d['id']]=dict(path=str(p.with_name('setup.sql')),tables=d['tables'])
 for p in sorted((C/'modules').glob('*/*.md')):
  d,_=front(p)
  tasks.extend(t for t in d['practice'] if t['kind']=='sql')
 return dict(datasets=ds,tasks=tasks)
if __name__=='__main__' and '--sql-manifest' in sys.argv:
 print(json.dumps(manifest(),ensure_ascii=True));sys.exit(0)
def main():
 # High-frequency asymmetric glyphs; shared forms such as 台、后、里、干、几 are intentionally absent.
 bad=set('这们过进还远运边达连选递逻书画习买卖产亲仅从仓仪众优会传伪储关兴养刚创剧办务动劳区华协单历压县双发变叙号听响团围国图场块坚声处备头奖学宝实审宽宾对寻导将层属师库应废开张弹归当录彻径忆忧怀态总恶惊惧惩惯战户执扩扫扬扰护报拟拨择挥损换据摄摆敌数断无旧时显暂机权条来极标栈栏树样档桥检楼气汇汉沟泻泽测涨渐温湾湿滤灭灯灵点炼热独环现电盐监盘码础碍积称稳穷窃竖竞笔筛签简类紧约级纪纲纳纵纷纸纹线练组细织终经结绘给络统继绩绪续维综绿编缘缩缴网罗职联节获虑补装见观规视览觉计订认让训议讯记讲许论设访证评识诉诊词译试询该详语误说请诺读课谈谋负财责败账货质购贮贵贸费资车轨转轮软轴轻载较辅辑输辖辩鉴钥钱链销锁错键镜长门闭问闲间闸阅阈队阳阴阵阶际陆陈险隐难页顶项顺须顾预领频题颜额风飞饮马驾验鲜鸟齐齿龙')
 def scan(s,path):
  hits=set(s)&bad;assert not hits,(path,'simplified', ''.join(sorted(hits)))
 parsed=set()
 def y(p):parsed.add(p);d=read(p);scan(p.read_text('utf-8-sig'),p);return d
 ids=set()
 def ident(s):
  assert isinstance(s,str) and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',s) and s not in ids,('bad/duplicate id',s);ids.add(s)
 tracks=y(C/'tracks.yaml');roles=y(C/'roles.yaml');path=y(C/'path.yaml')['recommended']
 assert 3<=len(tracks)<=6 and sum(t['career'] for t in tracks)==1
 tr={};prefixes=set();track_names=set()
 for t in tracks:
  req(t,'id title short prefix color career summary',t);ident(t['id']);assert t['prefix'] not in prefixes and t['color'] in 'stone indigo teal amber vermilion slate'.split();prefixes.add(t['prefix']);tr[t['id']]=t;track_names.update((t['id'],t['title'],t['short']))
 ri={r['id'] for r in roles};assert 2<=len(roles)<=4
 mods={};mg={};less={};lg={};by=Counter();stage=Counter();moduleminutes=Counter();links=[];previews=[];covered=[];qcount=0;tasks=[];cids=set();ready=set();rs=rows('resource-checks.csv');ledger={r['url']:r for r in rs};used=Counter();assert len(ledger)==len(rs)
 for p in sorted((C/'modules').glob('*/module.yaml')):
  m=y(p);req(m,'id track stage order title subtitle summary outcomes prereqs roles hours',p);i=m['id'];ident(i);assert p.parent.name==i and i.startswith(tr[m['track']]['prefix']+'-') and m['stage'] in range(5) and set(m['roles'])<=ri and m['roles'];mods[i]=m;mg[i]=m['prereqs']
 assert all(len(m['title'])<=18 and len(m['subtitle'])<=26 for m in mods.values())
 cycle(mg);assert len(path)==len(set(path))==len(mods) and set(path)==set(mods);assert all(path.index(p)<path.index(i) for i,ps in mg.items() for p in ps)
 for r in roles:
  req(r,'id title summary skills',r);ident(r['id']);assert r['skills']
  for s in r['skills']:
   req(s,'id title weight modules',s);ident(s['id']);assert s['weight'] in [1,2,3] and s['modules'] and set(s['modules'])<=mods.keys() and all(r['id'] in mods[i]['roles'] for i in s['modules'])
 categories=y(C/'sql-categories.yaml');assert seq(categories,18,24)
 cat_ids=set()
 for category in categories:
  req(category,'id label order','sql-categories.yaml')
  cid=category['id'];assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',cid) and cid not in cat_ids and category['label'],category
  cat_ids.add(cid)
 assert [c['order'] for c in categories]==list(range(1,len(categories)+1))
 cat_usage=Counter()
 datasets={}
 for p in (C/'datasets').glob('*/dataset.yaml'):
  d=y(p);req(d,'id title summary tables',p);i=d['id'];ident(i);assert i==p.parent.name and d['tables'];datasets[i]=d
  names=set()
  for t in d['tables']:
   req(t,'name summary columns',p);assert t['columns'] and t['name'] not in names;names.add(t['name'])
   assert len({col['name'] for col in t['columns']})==len(t['columns'])
   for col in t['columns']:req(col,'name type note',p)
  setup=p.with_name('setup.sql');assert setup.is_file() and setup.stat().st_size<=400000;assert not re.search(r'\b(random|now|uuid)\s*\(',setup.read_text('utf8'),re.I)
 assert {'shop','events','hr','logins'}<=datasets.keys()
 for p in sorted(C.glob('modules/*/*.md')):
  d,b=front(p);raw=p.read_text('utf-8-sig');scan(raw,p);req(d,'id module order title subtitle status minutes level prereqs objectives tags resources concepts practice',p);i=d['id'];mid=d['module'];ident(i);assert mid in mods and i.startswith(mid+'-') and p.parent.name==mid and 20<=d['minutes']<=40 and 1<=d['level']<=4 and seq(d['objectives'],2,5) and d['tags'];less[i]=d;lg[i]=d['prereqs'];m=mods[mid];by[m['track']]+=1;stage[m['stage']]+=1;moduleminutes[mid]+=d['minutes']
  assert re.fullmatch(fr'{d["order"]:02d}-[a-z0-9]+(?:-[a-z0-9]+)*\.md',p.name),p
  assert len(d['title'])<=18 and len(d['subtitle'])<=26 and d['id'].startswith(mid+'-') and d['objectives'][0].strip(),i
  assert not any(word in raw for word in PLACEHOLDERS),(i,'placeholder')
  assert not track_names.intersection(d['tags']),(i,'track-name tag')
  links.extend((i,*m.groups()) for m in APP_LINK.finditer(raw))
  previews.extend((i,target) for target in PREVIEW.findall(b))
  assert seq(d['resources'],1,4)
  for r in d['resources']:
   req(r,'title url kind lang minutes required checked note',i);u=r['url']
   assert urlparse(u).scheme=='https' and r['lang'] in ('en','zh-Hant','zh-Hans','other'),(i,u)
   assert r['kind'] in 'doc video course book article paper repo interactive tool'.split() and type(r['required'])==bool and r['minutes']>0,(i,u)
   date.fromisoformat(str(r['checked']));used[u]+=1
   # v2 ledger is a snapshot, not a claim that later vetted batch URLs were independently checked here.
   if u in ledger:assert str(r['checked'])>=ledger[u]['checked'] and ledger[u]['verification'] in ('200','web'),(i,u)
  assert d['status']=='ready' and seq(d['concepts'],3,6) and d['practice'] and 800<=len(re.findall(r'[\u3400-\u9fff]',re.sub(r'\x60{3}.*?\x60{3}','',b,flags=re.S)))<=1800,i;ready.add(i)
  assert seq(d['tags'],2,5) and all(len(r['note'])<=40 and not r['note'].startswith('選讀本題') for r in d['resources']),i
  errors=re.search(r'(?m)^## (?:方言與)?常見錯誤$\n([\s\S]*?)(?=^## |\Z)',b)
  assert errors and 2<=len(bullets:=re.findall(r'^- (.+)$',errors[1],re.M))<=4,i
  for c in d['concepts']:
   req(c,'id prompt answer',i);ident(c['id']);cids.add(c['id'])
   if 'mcq' in c:
    q=c['mcq'];req(q,'options answer explain',i);assert 3<=len(q['options'])==len(set(q['options']))<=5 and type(q['answer']) is int and 0<=q['answer']<len(q['options']);qcount+=1
   if 'interview' in c:req(c['interview'],'question points answer',i)
  for t in d['practice']:
   req(t,'id title kind minutes',i);ident(t['id']);assert t['id'].startswith(i+'-') and t['minutes']>0
   if t['kind']=='sql':
    req(t,'dataset prompt solution explain hints check concepts tags',i);assert t['dataset'] in datasets and seq(t['concepts'],1) and seq(t['hints'],0,3) and t['tags'] and t['check'].get('mode','result') in ('result','state')
    if t['check'].get('mode')=='state':assert t['check'].get('query')
    assert 1<=t.get('level',d['level'])<=4,t['id']
    c=t.get('category');assert seq(c,1,2) and len(c)==len(set(c)) and set(c)<=cat_ids,(i,t['id'],'category')
    cat_usage.update(c)
    for flag in ('ordered','columnNames','allowEmpty'):
     if flag in t['check']:assert type(t['check'][flag]) is bool,(i,flag)
    tasks.append(t);covered+=t['concepts']
   else:req(t,'steps checks',i);assert t['steps'] and t['checks'] and t['kind'] in ['code','hands-on','read','build','explain']
 cycle(lg);assert set(covered)<=cids and set(cat_usage)==cat_ids
 allowed={'lesson':less,'module':mods,'sql':{t['id'] for t in tasks}}
 for i,kind,target in links:assert target in allowed[kind],(i,'app link',kind,target)
 rank={i:(path.index(d['module']),d['order']) for i,d in less.items()}
 for i,target in previews:assert rank[i]<rank[target],(i,'preview is not later',target)
 for i,ps in lg.items():
  for p in ps:assert rank[p]<rank[i],(i,'lesson prerequisite is not earlier',p)
 # Combined dependency graph includes all lessons of each prerequisite module.
 combined={i:list(v)+[j for j,d in less.items() if d['module'] in mg[less[i]['module']]] for i,v in lg.items()};cycle(combined)
 for i,m in mods.items():
  ls=[x for x in less.values() if x['module']==i];assert 3<=len(ls)<=14 and sorted(x['order'] for x in ls)==list(range(1,len(ls)+1)) and m['hours']==((moduleminutes[i]+15)//30)/2,(i,m['hours'],moduleminutes[i])
 sqlmod=next(i for i in path if tr[mods[i]['track']]['prefix']=='sq')
 assert ready==set(less)
 for i in ready:
  if mods[less[i]['module']]['track']==mods[sqlmod]['track']:
   assert any(t['kind']=='sql' for t in less[i]['practice']),(i,'SQL lesson without SQL practice')
 proj=0
 for p in C.glob('projects/*.yaml'):
  d=y(p);req(d,'id track title summary why modules level hours milestones showcase',p);ident(d['id']);assert d['track'] in tr and d['modules'] and set(d['modules'])<=mods.keys() and d['milestones'];proj+=1
  for m in d['milestones']:req(m,'id title checks',p);ident(m['id']);assert m['checks']
 count=0;banks=set()
 for p in C.glob('interview/*.yaml'):
  d=y(p);req(d,'id title track questions',p);ident(d['id']);banks.add(d['id']);assert d['track'] in tr and len(d['questions'])>=10
  for q in d['questions']:req(q,'id question points answer tags',p);ident(q['id']);assert seq(q['points'],2,6) and q['tags'] and q['answer'];count+=1
 assert {'iv-behavioral','iv-sql-scenarios','iv-dw-modeling','iv-bigdata-internals','iv-pipeline-design','iv-troubleshooting','iv-java-basics'}<=banks
 gl=y(C/'glossary.yaml')
 gl_ids=set();gl_en=set()
 for z in gl:
  req(z,'id term en aliases cn tw short tags',z)
  gid=z['id'];en=z['en'].strip().casefold()
  assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',gid) and gid not in gl_ids and en and en not in gl_en,z
  assert z.get('lesson') in less and 0<len(z['short'])<=80 and z['tags'],z
  gl_ids.add(gid);gl_en.add(en)
 reuse=rows('reuse-map.csv');assert len({r['conduit_lesson_id'] for r in reuse})==len(reuse)
 for x in reuse:assert less[x['conduit_lesson_id']]['status']=='ready' and x['stackway_lesson_id'].startswith(('fd-','cr-')) and not x['stackway_lesson_id'].startswith('fd-sql-') and x['changes']
 assert set(C.rglob('*.yaml'))==parsed and not list(C.rglob('*.yml')) and set(C.rglob('*.md'))==set(C.glob('modules/*/*.md'))
 # Check remaining content texts, including the dataset setup files and SVG captions.
 for p in C.rglob('*'):
  if p.is_file() and p.suffix in {'.sql','.svg'}:scan(p.read_text('utf-8-sig'),p)
 jobs=rows('jobs.csv');ev=rows('job-evidence.csv');jurls={j['url'] for j in jobs};assert len(jurls)==len(jobs)==len(ev) and jurls=={e['url'] for e in ev};ej={e['url']:e for e in ev}
 for j in jobs:
  e=ej[j['url']];assert e['window_evidence'] and set(j['skills'].split(';'))==set(filter(None,(e['core_or_duty']+';'+e['preferred_only']).split(';')))
 markets=Counter(j['market'] for j in jobs)
 assert markets['中國大陸']>=35 and markets['香港']>=10 and markets['台灣']>=8 and sum(markets[s] for s in ['新加坡','美國','跨國遠端'])>=12 and len(jobs)>=70
 assert 340<=len(less)<=440 and by[mods[sqlmod]['track']]>=45 and len(gl)>=120 and 6<=proj<=9
 print(f'PASS: {len(parsed)} YAML files; {len(less)} lesson frontmatters; {len(ids)} unique IDs; reference, combined graph, path, resource and script checks clean.')
 print('LESSON FILES: NN-slug names match order; ready metadata and common-error lists checked.')
 print('TRACK',dict(by));print('STAGE',dict(sorted(stage.items())));print(f'MODULES {len(mods)}; LESSON HOURS {sum(moduleminutes.values())/60:.2f}; READY {len(ready)}; STUB {len(less)-len(ready)}')
 print(f'READY concepts={len(cids)} mcq={qcount} SQL={len(tasks)}; PROJECTS={proj}; BANKS={len(banks)} questions={count}; GLOSSARY={len(gl)}; DATASETS={len(datasets)}')
 print(f'RESOURCES distinct={len(used)} placements={sum(used.values())}; {len(set(used)&ledger.keys())} URLs in v2 ledger; REUSE={len(reuse)}; HAN scan={len(bad)} unambiguous glyphs')
 print(f'LINKS {len(links)}; FORWARD PREVIEWS {len(previews)}; SQL CATEGORIES {len(cat_ids)} / {sum(cat_usage.values())} assignments')
 print('JOBS',len(jobs),dict(markets))
if __name__=='__main__':main()
