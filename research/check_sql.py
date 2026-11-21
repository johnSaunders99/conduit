"""Supplementary native DuckDB probe, not the app SQL compatibility check.

Use npm.cmd run check:content to validate against the bundled DuckDB-WASM.
For this probe, use a DuckDB-only venv; metadata uses the base Python PyYAML.
"""
import json,subprocess,sys
from pathlib import Path
import duckdb
ROOT=Path(__file__).resolve().parents[1]
def main():
 base=getattr(sys,'_base_executable',sys.executable)
 manifest=json.loads(subprocess.check_output([base,'-B',str(ROOT/'research/check_skeleton.py'),'--sql-manifest']))
 setups={};print('DuckDB',duckdb.__version__)
 for i,d in sorted(manifest['datasets'].items()):
  setups[i]=Path(d['path']).read_text(encoding='utf8');total=0
  with duckdb.connect(':memory:') as c:
   c.execute(setups[i]);assert {x[0] for x in c.execute('SHOW TABLES').fetchall()}=={t['name'] for t in d['tables']},i
   for t in d['tables']:
    name=t['name'];actual=c.execute(f'DESCRIBE "{name}"').fetchall()
    assert [(r[0],r[1]) for r in actual]==[(col['name'],col['type']) for col in t['columns']],name
    n=c.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0];assert n>0;total+=n;print(f'  {i}.{name}: {n} rows')
   assert total<=5000;print(f'  {i}: {total} rows total')
 for t in manifest['tasks']:
  with duckdb.connect(':memory:') as c:
   c.execute(setups[t['dataset']]);out=c.execute(t['solution']);check=t.get('check',{})
   result=out.fetchall()
   if 'query' in check:
    checked=c.execute(check['query']).fetchall()
    if check.get('mode','result')=='state':result=checked
   n=len(result);assert n or check.get('allowEmpty',False),t['id'];print(f"  {t['id']}: {n} {'row' if n==1 else 'rows'}")
 print(f"PASS: {len(setups)} datasets match declared schemas; {len(manifest['tasks'])} reference solutions executed on fresh databases.")
if __name__=='__main__':main()
