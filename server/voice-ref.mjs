import fs from 'node:fs/promises';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const lines=JSON.parse(readFileSync(new URL('../src/features/voice/reference/script.json',import.meta.url),'utf8'));
const script=new Map(lines.map(l=>[l.id,l.text]));
export const defaultTtsDir='F:\\ConduitTTS';
export const maxRefBytes=5_000_000;
const rate=32_000;
const absent=e=>e.code==='ENOENT';
const lstat=async p=>fs.lstat(p).catch(e=>{if(absent(e))return null;throw e});
const within=(dir,file)=>{const rel=path.relative(dir,file);return !!rel&&!path.isAbsolute(rel)&&rel.split(path.sep)[0]!=='..'};
const forbidden=()=>Object.assign(Error('Voice reference path must be a regular local directory or file'),{code:'VOICE_PATH'});

function wavDuration(b,size){
  if(b.length<44||size<=44||size>maxRefBytes||size%2||b.toString('ascii',0,4)!=='RIFF'||b.readUInt32LE(4)!==size-8||
    b.toString('ascii',8,16)!=='WAVEfmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==1||b.readUInt16LE(22)!==1||
    b.readUInt32LE(24)!==rate||b.readUInt32LE(28)!==rate*2||b.readUInt16LE(32)!==2||b.readUInt16LE(34)!==16||
    b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==size-44)return null;
  return (size-44)/2/rate;
}

async function directory(root,create){
  if(create)await fs.mkdir(root,{recursive:true});
  const base=await fs.realpath(root).catch(e=>{if(absent(e))return null;throw e});
  if(!base)return null;
  let dir=base;
  for(const part of ['ref','learner']){
    dir=path.join(dir,part);
    if(create){await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e})}
    const st=await lstat(dir);
    if(!st)return null;
    if(!st.isDirectory()||st.isSymbolicLink()||!within(base,await fs.realpath(dir)))throw forbidden();
  }
  return dir;
}

async function regular(file){
  const st=await lstat(file);
  if(st&&!st.isFile())throw forbidden();
  return st;
}
async function info(dir,id){
  const wav=path.join(dir,id+'.wav'),txt=path.join(dir,id+'.txt');
  try{
    const a=await regular(wav),t=await regular(txt);
    if(!a||!t||t.size!==Buffer.byteLength(script.get(id))||await fs.readFile(txt,'utf8')!==script.get(id))return null;
    const fd=await fs.open(wav,'r');
    let duration;
    try{const header=Buffer.alloc(44);const {bytesRead}=await fd.read(header,0,44,0);duration=wavDuration(header.subarray(0,bytesRead),a.size)}
    finally{await fd.close()}
    return duration===null?null:{id,duration};
  }catch(e){if(e.code==='VOICE_PATH'||absent(e))return null;throw e}
}

async function atomic(file,body){
  const temp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,body,{flag:'wx'});await fs.rename(temp,file)}
  finally{await fs.unlink(temp).catch(e=>{if(!absent(e))throw e})}
}
async function save(dir,id,bytes){
  const wav=path.join(dir,id+'.wav'),txt=path.join(dir,id+'.txt');
  await regular(wav);
  const hadTranscript=!!await regular(txt);
  // A WAV is the commit marker. On replacement, the transcript is invariant for the same line.
  await atomic(txt,script.get(id));
  try{await atomic(wav,bytes)}
  catch(e){if(!hadTranscript)await fs.unlink(txt).catch(()=>{});throw e}
}

export function voiceReference(root){
  let queue=Promise.resolve();
  const serialize=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job};
  return async function route(req,res,url,reply){
    const collection=url==='/api/voice-ref';
    const id=collection?null:url.slice('/api/voice-ref/'.length);
    if(!collection&&!script.has(id))return reply(404,{error:'找不到這段試錄稿'});
    const method=req.method;
    if(!(collection?method==='GET':['GET','PUT','DELETE'].includes(method))){
      res.setHeader('Allow',collection?'GET':'GET, PUT, DELETE');return reply(405,{error:'方法不符'});
    }
    try{
      if(method==='PUT'){
        if(!/^audio\/wav(?:\s*;|$)/i.test(req.headers['content-type']??''))return reply(415,{error:'請使用 WAV 錄音'});
        const tooLarge=()=>reply(413,{error:'錄音不能超過 5 MB'});
        if(Number(req.headers['content-length'])>maxRefBytes){req.resume();return tooLarge()}
        const chunks=[];let size=0;
        for await(const buf of req){size+=buf.length;if(size>maxRefBytes)return tooLarge();chunks.push(buf)}
        const bytes=Buffer.concat(chunks,size),duration=wavDuration(bytes,size);
        if(duration===null)return reply(400,{error:'錄音格式須為單聲道 PCM16 WAV（32 kHz）'});
        await serialize(async()=>save(await directory(root,true),id,bytes));
        return reply(200,{id,duration});
      }
      if(method==='DELETE'){
        await serialize(async()=>{
          const dir=await directory(root,false);if(!dir)return;
          const files=['.wav','.txt'].map(ext=>path.join(dir,id+ext));
          const status=await Promise.all(files.map(regular));
          for(const [i,file] of files.entries())if(status[i])await fs.unlink(file);
        });
        return reply(200,{ok:true});
      }
      const data=await serialize(async()=>{
        const dir=await directory(root,false);
        if(collection)return {items:dir?(await Promise.all([...script.keys()].map(id=>info(dir,id)))).filter(Boolean):[]};
        return dir&&await info(dir,id)?fs.readFile(path.join(dir,id+'.wav')):null;
      });
      if(collection)return reply(200,data);
      if(!data)return reply(404,{error:'尚未儲存錄音'});
      res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(data);
    }catch(e){
      return reply(e.code==='VOICE_PATH'?403:500,{error:e.code==='VOICE_PATH'?'錄音資料夾不允許使用連結':'無法存取本機錄音，請確認錄音資料夾可用'});
    }
  };
}
