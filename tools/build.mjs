import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {buildContent,contentOptions,source} from './content.mjs'
import {inputs,retainAssets} from './freshness.mjs'
import {buildFonts,generatedFonts} from './subset-font.mjs'
const args=process.argv.slice(2),src=source(args),stamp=inputs(process.cwd(),src)
const content=buildContent(src,undefined,contentOptions(args))
retainAssets(stamp,content.assets)
if(args.includes('--refresh-font')){
 buildFonts(content)
 for(const name of generatedFonts){const s=fs.statSync(name);stamp.inputs[name]=[s.mtimeMs,s.size]}
 // Match the traversal order even if generated files were absent before the first build.
 const order=inputs(process.cwd(),src,new Set(Object.keys(stamp.inputs))).inputs
 stamp.inputs=Object.fromEntries([...Object.keys(order),...Object.keys(stamp.inputs).filter(k=>!Object.hasOwn(order,k))]
   .filter(k=>Object.hasOwn(stamp.inputs,k)).map(k=>[k,stamp.inputs[k]]))
}
const require=createRequire(import.meta.url)
for(const [pkg,bin,args] of [['typescript','bin/tsc',['--noEmit']],['vite','bin/vite.js',['build']]]){
 const file=path.resolve(path.dirname(require.resolve(pkg+'/package.json')),bin)
 const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)
}
fs.copyFileSync('docs/guide.md','使用說明.md')
// Capture inputs before compiling; a concurrent edit will invalidate this successful build.
fs.writeFileSync('dist/.build-stamp.json',JSON.stringify(stamp))
