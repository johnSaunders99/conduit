import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const name=s=>'"'+s.replaceAll('"','""')+'"';

// Run trusted local curriculum on the same WASM VM as the browser, with external I/O disabled.
export async function executeSqlChecks(report) {
  if(report.errors.length || !report.sql.datasets.length) return;
  const d=require('@duckdb/duckdb-wasm/blocking');
  const bundle=id=>({mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-'+id+'.wasm')});
  const db=await d.createDuckDB({mvp:bundle('mvp'),eh:bundle('eh')},new d.VoidLogger(),d.NODE_RUNTIME);
  await db.instantiate();
  function fresh(setup,fn) {
    db.open({path:':memory:'});
    const c=db.connect();
    try {
      c.query("SET enable_external_access=false");
      c.query(setup); return fn(c);
    } finally {c.close(); db.reset()}
  }
  for(const ds of report.sql.datasets) {
    const file='datasets/'+ds.id+'/setup.sql', setup=report.setups[ds.id];
    try {
      fresh(setup,c=>{
        const meta=c.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='main' ORDER BY table_name,ordinal_position").toArray();
        const expected=ds.tables.flatMap(t=>t.columns.map(col=>[t.name,col.name,col.type]));
        const sig=parts=>parts.map(c=>String(c).trim().toLowerCase().replace(/\s+/g,'')).join(':');
        if(meta.map(r=>sig([r.table_name,r.column_name,r.data_type])).sort().join('|')!==expected.map(sig).sort().join('|'))
          report.warnings.push([file,'宣告的數據表、欄位或類型與建表結果不同']);
        let total=0;
        for(const t of new Set(meta.map(r=>r.table_name))) total+=Number(c.query('SELECT count(*) AS n FROM '+name(t)).get(0).n);
        if(total>5000) report.errors.push([file,'總列數不可超過 5,000']);
      });
    } catch(e) {report.errors.push([file,'無法建立數據集：'+e.message]);continue}
    for(const ex of report.sql.exercises.filter(e=>e.dataset===ds.id)) {
      try {fresh(setup,c=>{
        let result=c.query(ex.solution);
        if(ex.check.mode==='state')result=c.query(ex.check.query);
        if(!result.numRows&&!ex.check.allowEmpty)throw Error('參考結果沒有任何列');
      })} catch(e){report.errors.push([ex.id,'參考解答檢查失敗：'+e.message])}
    }
  }
}
