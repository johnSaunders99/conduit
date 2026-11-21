import {defineConfig,normalizePath} from 'vite'
import react from '@vitejs/plugin-react'
import MarkdownIt from 'markdown-it'
import {gzipSync} from 'node:zlib'

export default defineConfig({
  base:'./',
  cacheDir:process.env.CONDUIT_TASK_TAG && /^[a-z0-9-]+$/.test(process.env.CONDUIT_TASK_TAG) ? '.cache/'+process.env.CONDUIT_TASK_TAG+'/vite' : undefined,
  plugins:[react(),{
    name:'conduit-initial-budget',apply:'build',
    generateBundle(_,bundle){
      const visited=new Set<string>();let bytes=0;
      const visit=(name:string)=>{
        if(visited.has(name))return;visited.add(name)
        const chunk=bundle[name];if(!chunk||chunk.type!=='chunk')return
        if(Object.keys(chunk.modules).some(id=>/\/node_modules\/(?:@duckdb\/|@codemirror\/|codemirror\/)/.test(normalizePath(id))))this.error('今天的初始模組不可包含 SQL 引擎或編輯器。')
        bytes+=gzipSync(chunk.code).length;chunk.imports.forEach(visit)
      }
      for(const c of Object.values(bundle))if(c.type==='chunk'&&c.isEntry)visit(c.fileName)
      if(bytes>300000)this.error('初始 JavaScript 超過 300 kB gzip。')
      console.log('初始 JavaScript：'+bytes+' 位元組（gzip），不含 SQL 引擎與編輯器。')
    }
  }, {
    name:'conduit-guide',
    enforce:'pre',
    transform(source,id) {
      if (normalizePath(id).endsWith('/docs/guide.md')) {
        return 'export default '+JSON.stringify(new MarkdownIt({html:false}).render(source))
      }
    }
  }],
  server:{host:'127.0.0.1'},
  test:{include:['tests/**/*.test.{ts,tsx,mjs}']}
})
