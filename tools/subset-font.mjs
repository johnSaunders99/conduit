import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const ascii=Array.from({length:95},(_,i)=>String.fromCodePoint(i+32)).join('');
const walk=(dir,f)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,f);else if(e.isFile())f(p)}};
function uiTitles(){
  const text=[];
  walk('src',file=>{
    if(!file.endsWith('.tsx'))return;
    const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const read=n=>{
      if(ts.isStringLiteralLike(n)||ts.isJsxText(n)||ts.isTemplateLiteralToken(n))text.push(n.text.trim());
      else if(ts.isJsxElement(n))n.children.forEach(read);
      else ts.forEachChild(n,read);
    };
    const visit=n=>{
      if(ts.isJsxElement(n)&&['h1','h2'].includes(n.openingElement.tagName.getText(ast)))n.children.forEach(read);
      if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(ast)==='Title'){
        for(const attr of n.attributes.properties)if(ts.isJsxAttribute(attr)&&attr.name.getText(ast)==='title'&&attr.initializer)read(attr.initializer);
      }
      ts.forEachChild(n,visit);
    };
    visit(ast);
  });
  return text;
}
export const generatedFonts=['public/fonts/conduit-ui.woff2','public/fonts/conduit-curriculum.woff2','public/fonts/LICENSE-OFL.txt','src/styles/display-fonts.css'];

export function buildFonts(curriculum){
  const work=path.resolve('.cache/fonts');
  const source=path.join(work,'NotoSerifTC.ttf'),license=path.join(work,'OFL.txt');
  const python=path.join(work,'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  if(![source,license,python].every(f=>fs.existsSync(f)))throw Error('請先備妥字型原檔、授權及 fontTools 虛擬環境；請見 docs/fonts.md。');
  const from=xs=>new Set(xs.map(x=>String(x??'').normalize('NFC')).join('').replace(/[\r\n\t]/g,''));
  const ui=from([ascii,...uiTitles()]);
  const authored=from([...curriculum.index.modules,...curriculum.index.lessons,...curriculum.index.projects,...curriculum.sql.exercises].map(x=>x.title)
    .concat(Object.values(curriculum.speech).flatMap(s=>s.sections.filter(x=>x.anchor).map(x=>x.title))));
  for(const c of ui)authored.delete(c);
  const list=path.join(work,'characters.json');
  fs.writeFileSync(list,JSON.stringify({ui:[...ui].join(''),curriculum:[...authored].join('')}));
  const child=spawnSync(python,['-B','tools/subset-font.py',source,license,list],{stdio:'inherit'});
  if(child.status!==0)throw child.error??Error('標題字型子集產生失敗');
}
