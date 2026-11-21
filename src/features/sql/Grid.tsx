import type {Cell,ResultSet} from '../../lib/sqlGrade';

export function displaySqlValue(value:Exclude<Cell,null>,type:string):{text:string;title?:string}{
  const full=String(value);
  if(typeof value!=='number'||(type!=='DOUBLE'&&type!=='FLOAT'))return {text:full};
  const fixed=value.toFixed(6);
  const rounded=fixed.replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1');
  return {text:rounded==='-0'?'0':rounded,title:full};
}

export function Grid({result,ms}:{result:ResultSet;ms:number}){
  const count=result.rowCount??result.rows.length;
  return <div className="sql-result">
    <div className="sql-caption"><b>查詢結果</b><span>{count} 列 · {ms} ms{count>500?' · 顯示前 500 列':''}</span></div>
    <div className="sql-scroll" role="region" aria-label="查詢結果" tabIndex={0}>
      <table>
        <thead><tr>{result.columns.map((c,i)=><th key={i} scope="col">{c.name}<small>{c.type}</small></th>)}</tr></thead>
        <tbody>{result.rows.slice(0,500).map((r,i)=><tr key={i}>{r.map((v,j)=>{
          const type=result.columns[j].type,numeric=typeof v==='number'||typeof v==='bigint'||type.startsWith('DECIMAL(');
          if(v===null)return <td key={j} className={numeric?'numeric':''}><span className="sql-null">NULL</span></td>;
          const {text,title}=displaySqlValue(v,type);
          return <td key={j} className={numeric?'numeric':''} title={title}>{text}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    {!result.rows.length&&<p className="muted">沒有符合條件的列。</p>}
  </div>;
}
