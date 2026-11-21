import type {SqlCheck} from '../content/types';
export type Cell=number|bigint|string|Date|boolean|null;
export type ResultSet={rowCount?:number;columns:{name:string;type:string}[];rows:Cell[][]};
export type Verdict={passed:boolean;message:string;examples?:Cell[][]};
function canonical(v:Cell,type:string):Cell {
  if(v===null)return null;
  // Exact decimal text is for display; comparisons retain the existing numeric tolerance.
  if(typeof v==='string'&&type.startsWith('DECIMAL('))return Number(v);
  if(v instanceof Date || /^(date|timestamp)/i.test(type)){
    const date=v instanceof Date?v:new Date(typeof v==='number'?v:String(v));
    if(Number.isFinite(+date))return date.toISOString();
  }
  return v;
}
const numeric=(v:Cell):v is number|bigint=>typeof v==='number'||typeof v==='bigint';
function same(a:Cell,b:Cell,tol:number){
  if(a===b)return true;
  if(!numeric(a)||!numeric(b))return false;
  if(tol===0&&(typeof a==='bigint'||typeof b==='bigint'))return a==b;
  const x=Number(a),y=Number(b);
  return Number.isNaN(x)&&Number.isNaN(y)||Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=tol*Math.max(1,Math.abs(x),Math.abs(y));
}
export function gradeSql(actual:ResultSet, expected:ResultSet, check:SqlCheck={}):Verdict {
  const fail=(message:string,examples?:Cell[][])=>({passed:false,message,examples});
  if(actual.columns.length!==expected.columns.length)return fail('欄位數不同：你的結果 '+actual.columns.length+' 欄，答案 '+expected.columns.length+' 欄');
  if(check.columnNames){const i=actual.columns.findIndex((v,k)=>v.name.toLowerCase()!==expected.columns[k].name.toLowerCase());if(i>=0)return fail('第 '+(i+1)+' 欄的欄名不符，請對照題目。')}
  if(actual.rows.length!==expected.rows.length)return fail('列數不同：你 '+actual.rows.length+' 列，答案 '+expected.rows.length+' 列');
  if(!expected.rows.length&&!check.allowEmpty)return fail('參考結果為空，請檢查題目設定。');
  const norm=(s:ResultSet)=>s.rows.map(r=>r.map((v,i)=>canonical(v,s.columns[i].type)));
  const a=norm(actual),b=norm(expected), tol=check.tolerance??1e-6;
  const eq=(i:number,j:number)=>a[i].every((x,k)=>same(x,b[j][k],tol));
  const first=a.findIndex((_,i)=>!eq(i,i));
  if(first>=0){
    // Consume duplicates once. When two tolerance intervals overlap, find an
    // augmenting path rather than letting a greedy near-match steal the only fit.
    const owner=new Int32Array(b.length).fill(-1),miss:Cell[][]=[];let count=0;
    for(let i=0;i<a.length;i++){
      const free=b.findIndex((_,j)=>owner[j]<0&&eq(i,j));
      if(free>=0){owner[free]=i;continue}
      const queue=[i],prev=new Map<number,[number,number]>(),seen=new Set<number>([i]);let matched=false;
      for(let k=0;k<queue.length&&!matched;k++){
        let x=queue[k];
        for(let j=0;j<b.length;j++){
          const y=owner[j];if(seen.has(y)||!eq(x,j))continue;
          if(y<0){owner[j]=x;while(x!==i){const [parent,edge]=prev.get(x)!;owner[edge]=parent;x=parent}matched=true;break}
          seen.add(y);prev.set(y,[x,j]);queue.push(y)
        }
      }
      if(!matched){count++;if(miss.length<3)miss.push(actual.rows[i])}
    }
    if(count)return fail('有 '+count+' 列不在答案裡',miss);
    if(check.ordered)return fail('第 '+(first+1)+' 列開始順序不同');
  }
  return {passed:true,message:'通過'};
}
