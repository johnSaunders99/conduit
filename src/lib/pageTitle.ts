import type {Catalog} from '../content/types';

export function pageTitle(path:string,cat:Pick<Catalog,'modules'|'lessons'|'exercises'>,navLabel?:string){
  const [,route,id]=path.split('/');
  const title=route==='module'?(cat.modules.find(x=>x.id===id)?.title??'模組'):
    route==='lesson'?(cat.lessons.find(x=>x.id===id)?.title??'課程筆記'):
    route==='sql'&&id?(cat.exercises.find(x=>x.id===id)?.title??'SQL 練習場'):
    ({voice:'錄製我的聲線',help:'使用說明',session:'複習練習',onboarding:'首次設定'} as Record<string,string>)[route]??navLabel??'學習手帳';
  return title+' · 渠成';
}
