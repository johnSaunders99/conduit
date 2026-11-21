import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';

const adjacency=/(?:\p{Script=Han}[A-Za-z0-9]|[A-Za-z0-9]\p{Script=Han})/u;
// Exempt only exact, intentional literals as "relative/filename.tsx:literal".
// Punctuation and quoted forms (e.g. 「SQL」) already break adjacency.
const allowlist=new Set<string>([]);

function* sources(dir:string):Generator<string>{
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())yield* sources(path);
    else if(/\.tsx?$/.test(entry.name))yield path;
  }
}

it('keeps a space between Han characters and Latin letters or digits in UI literals',()=>{
  const failures:string[]=[];
  for(const path of sources('src')){
    const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
    function scan(node:ts.Node){
      if(ts.isStringLiteralLike(node)||ts.isJsxText(node)||ts.isTemplateLiteralToken(node)){
        const text=node.text;
        if(adjacency.test(text)&&!allowlist.has(path.replaceAll('\\','/')+':'+text)){
          const {line}=source.getLineAndCharacterOfPosition(node.getStart(source));
          failures.push(path+':'+(line+1)+' '+JSON.stringify(text));
        }
      }
      ts.forEachChild(node,scan);
    }
    scan(source);
  }
  expect(failures).toEqual([]);
});
