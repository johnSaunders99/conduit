import path from 'node:path';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';

export const defaultAudioDir='F:\\ConduitTTS\\audio';
const types={'.ogg':'audio/ogg','.opus':'audio/ogg','.webm':'audio/webm','.mp3':'audio/mpeg','.wav':'audio/wav'};
const part=s=>typeof s==='string'&&/^[a-z0-9][-_.a-z0-9]*$/i.test(s)&&!s.endsWith('.')&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s);
const inside=(dir,file)=>{const rel=path.relative(dir,file);return !!rel&&!path.isAbsolute(rel)&&rel.split(path.sep)[0]!=='..'};
export function validAudioFile(file){
  return typeof file==='string'&&file.split('/').every(part)&&Object.hasOwn(types,path.extname(file).toLowerCase());
}
export function validateManifest(raw,id){
  if(!raw||raw.voiceId!==id||!part(id)||!['voiceLabel','engine','version'].every(k=>typeof raw[k]==='string'&&raw[k].trim())||!raw.items||typeof raw.items!=='object'||Array.isArray(raw.items))return null;
  const items=Object.fromEntries(Object.entries(raw.items).filter(([key,x])=>/^[a-f0-9]{20}$/.test(key)&&validAudioFile(x?.file)&&Number.isFinite(x.ms)&&x.ms>0).map(([k,{file,ms}])=>[k,{file,ms}]));
  return {voiceId:id,voiceLabel:raw.voiceLabel,engine:raw.engine,version:raw.version,items};
}
async function voicePath(root,id){
  if(!part(id))return null;
  const p=await fs.realpath(path.join(root,id));
  return inside(root,p)&&(await fs.stat(p)).isDirectory()?p:null;
}
async function filePath(dir,name){
  const p=await fs.realpath(path.join(dir,name));
  if(!inside(dir,p))return null;
  const info=await fs.stat(p);return info.isFile()?{p,size:info.size}:null;
}
async function man(dir,id){
  const file=await filePath(dir,'manifest.json');
  return file&&file.size<=32*1024*1024?validateManifest(JSON.parse(await fs.readFile(file.p,'utf8')),id):null;
}
const safe=async(f,other=null)=>{try{return await f()}catch{return other}};
export function rangeFor(h,size){
  const m=/^bytes=(\d*)-(\d*)$/.exec(h);
  if(!m||!size||(!m[1]&&!m[2]))return null;
  const a=m[1]!==''?Number(m[1]):Math.max(0,size-Number(m[2]));
  const b=m[1]!==''&&m[2]!==''?Math.min(size-1,Number(m[2])):size-1;
  return Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&a<=b&&a<size?[a,b]:null;
}
export async function serveAudio(req,res,route,audioDir){
  const fail=(status,headers={})=>{res.writeHead(status,{'Cache-Control':'no-store',...headers});res.end()};
  if(!['GET','HEAD'].includes(req.method))return fail(405,{Allow:'GET, HEAD'});
  const json=value=>{
    const body=JSON.stringify(value);
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);
  };
  const root=await safe(async()=>{
    const p=await fs.realpath(audioDir);return (await fs.stat(p)).isDirectory()?p:null;
  });
  if(route==='/api/audio'){
    const names=root?await safe(()=>fs.readdir(root,{withFileTypes:true}),[]):[];
    const voices=[];
    for(const {name} of names.filter(e=>e.isDirectory()&&part(e.name)).sort((a,b)=>a.name.localeCompare(b.name))){
      const dir=await safe(()=>voicePath(root,name));
      const m=dir&&await safe(()=>man(dir,name));
      if(m){const {items,...meta}=m;voices.push(meta)}
    }
    return json({found:!!root,voices});
  }
  const [, , id, ...parts]=route.split('/');
  const name=parts.join('/');
  if(!id||!name||name.endsWith('/'))return fail(404);
  if(!part(id)||!parts.every(part))return fail(403);
  const dir=root&&await safe(()=>voicePath(root,id));
  if(!dir)return fail(404);
  if(name==='manifest.json'){
    const m=await safe(()=>man(dir,id));
    return m?json(m):fail(404);
  }
  if(!validAudioFile(name))return fail(404);
  const file=await safe(()=>filePath(dir,name));
  if(!file)return fail(404);
  const {p,size}=file;
  const range=req.headers.range?rangeFor(req.headers.range,size):undefined;
  if(range===null)return fail(416,{'Content-Range':'bytes */'+size,'Accept-Ranges':'bytes'});
  const [start,end]=range??[0,size-1];
  const headers={'Content-Type':types[path.extname(name).toLowerCase()],'Content-Length':range?end-start+1:size,
    'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
  if(range)headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
  res.writeHead(range?206:200,headers);
  if(req.method==='HEAD'||!size)return res.end();
  await pipeline(createReadStream(p,range?{start,end}:{}),res).catch(()=>{if(!res.destroyed)res.destroy()});
}