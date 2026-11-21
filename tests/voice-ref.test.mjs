import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {createServer,listen} from '../server/serve.mjs';
import {maxRefBytes} from '../server/voice-ref.mjs';
import {scratch} from './scratch.mjs';
import script from '../src/features/voice/reference/script.json';
import {encodeReference,referenceRate} from '../src/features/voice/reference/wav';

let box,server,base,root,folder;
const url=id=>base+'/api/voice-ref'+(id?'/'+id:'');
const wav=(seconds,amplitude=.2)=>Buffer.from(encodeReference(new Float32Array(seconds*referenceRate).fill(amplitude)));
const put=(id,body,headers={})=>fetch(url(id),{method:'PUT',headers:{'Content-Type':'audio/wav',...headers},body});
const list=async()=>await(await fetch(url())).json();
beforeEach(async()=>{
  box=scratch();root=path.join(box.dir,'tts');folder=path.join(root,'ref','learner');
  const old=process.env.CONDUIT_TTS_DIR;
  try{
    process.env.CONDUIT_TTS_DIR=root;
    server=createServer({dataDir:path.join(box.dir,'state'),audioDir:path.join(box.dir,'audio')});
  }finally{if(old===undefined)delete process.env.CONDUIT_TTS_DIR;else process.env.CONDUIT_TTS_DIR=old}
  base='http://127.0.0.1:'+(await listen(server,0)).port;
});
afterEach(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));box.clean()});
it('publishes the whitelisted recording with its exact transcript, supports playback and deletes both',async()=>{
  expect(await list()).toEqual({items:[]});
  await expect(fs.access(root)).rejects.toThrow();
  const r=await put('01',wav(6));
  expect(r.status).toBe(200);expect(await r.json()).toEqual({id:'01',duration:6});
  expect(await fs.readFile(path.join(folder,'01.txt'),'utf8')).toBe(script[0].text);
  expect(await list()).toEqual({items:[{id:'01',duration:6}]});
  const clip=await fetch(url('01'));
  expect(clip.headers.get('content-type')).toBe('audio/wav');
  expect(Buffer.from(await clip.arrayBuffer()).equals(wav(6))).toBe(true);
  expect((await fetch(url('01'),{method:'DELETE'})).status).toBe(200);
  expect((await fetch(url('01'))).status).toBe(404);expect(await list()).toEqual({items:[]});
  expect(await fs.readdir(folder)).toEqual([]);
});
it('checks loopback origins, whitelist, path decoding and methods before creating any files',async()=>{
  for(const id of ['99','01.wav','%2e%2e%2f01','01%5c02','01%3aevil','01%00','01/02','01%252f02']){
    const actual=await new Promise((resolve,reject)=>{
      const request=http.request(base,{method:'PUT',path:'/api/voice-ref/'+id,headers:{'Content-Type':'audio/wav'}},res=>{res.resume();resolve(res.statusCode)});
      request.on('error',reject);request.end(wav(.01));
    });
    expect(actual,id).toBe(404);
  }
  expect((await put('01',wav(.01),{Origin:'https://example.invalid'})).status).toBe(403);
  expect((await fetch(url('01'),{method:'POST'})).status).toBe(405);
  await expect(fs.access(root)).rejects.toThrow();
});
it('enforces the 5 MB bound for declared and streamed bodies, and rejects invalid PCM',async()=>{
  expect((await put('01',Buffer.alloc(maxRefBytes+1))).status).toBe(413);
  const r=await new Promise((resolve,reject)=>{
    const request=http.request(url('01'),{method:'PUT',headers:{'Content-Type':'audio/wav'}},res=>{res.resume();resolve(res.statusCode)});
    request.on('error',reject);request.write(Buffer.alloc(maxRefBytes));request.end(Buffer.from('x'));
  });
  expect(r).toBe(413);
  const altered=wav(1);altered.writeUInt32LE(48000,24);
  expect((await put('01',altered)).status).toBe(400);
  expect((await put('01',wav(1),{'Content-Type':'text/plain'})).status).toBe(415);
  await expect(fs.access(root)).rejects.toThrow();
});
it('commits complete replacements even when PUTs overlap; invalid requests leave the committed pair alone',async()=>{
  const a=wav(3,.08), b=wav(4,-.4);
  expect((await put('01',a)).status).toBe(200);
  const [second,third]=await Promise.all([put('01',b),put('01',a)]);
  expect(second.status).toBe(200);expect(third.status).toBe(200);
  const {items:[{duration}]}=await list();
  const bytes=await fs.readFile(path.join(folder,'01.wav'));
  expect(bytes.equals(duration===3?a:b)).toBe(true);
  expect((await put('01',Buffer.alloc(300))).status).toBe(400);
  expect((await fs.readFile(path.join(folder,'01.wav'))).equals(bytes)).toBe(true);
  expect(await fs.readFile(path.join(folder,'01.txt'),'utf8')).toBe(script[0].text);
  expect((await fs.readdir(folder)).sort()).toEqual(['01.txt','01.wav']);
  // Files were served over HTTP just above; release leaf entries before removing the temp tree on Windows.
  await fs.unlink(path.join(folder,'01.wav'));await fs.unlink(path.join(folder,'01.txt'));
});
it('rejects linked recording directories and refuses a blocked destination without publishing a transcript',async()=>{
  const external=path.join(box.dir,'unrelated');await fs.mkdir(external);
  await fs.mkdir(root);await fs.symlink(external,path.join(root,'ref'),'junction');
  expect((await put('01',wav(3))).status).toBe(403);
  expect((await fetch(url())).status).toBe(403);
  expect(await fs.readdir(external)).toEqual([]);
  await fs.unlink(path.join(root,'ref'));
  await fs.mkdir(path.join(folder,'01.wav'),{recursive:true});
  expect((await put('01',wav(3))).status).toBe(403);
  expect(await fs.readdir(folder)).toEqual(['01.wav']);
  expect(await list()).toEqual({items:[]});
});
