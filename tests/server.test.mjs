import { beforeEach, afterEach, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createServer, listen } from '../server/serve.mjs';
import { scratch } from './scratch.mjs';
let box, dir, dist, server, url, sim, audioDir;
const payload = v => ({
  app: 'conduit',
  schemaVersion: 2,
  data: {
    settings: [{
      dayStartHour: 4
    }],
    lessonProgress:[],cards:[],reviewLogs:[],dayPlans:[],dayStats:[],practice:[],projects:[],interviewAnswers:[],sqlAttempts:[],
    sqlDrafts:[{key:'free:shop',text:String(v),updatedAt:'2026-11-20T12:00:00Z'}]
  }
});
const put = (v, headers = {}) => fetch(url + '/api/state', {
  method: 'PUT',
  headers: {
    'content-type': 'application/json',
    ...headers
  },
  body: JSON.stringify(payload(v))
});
beforeEach(async () => {
  box = scratch();
  dir = path.join(box.dir, 'isolated-state');
  dist = path.join(box.dir, 'dist');
  audioDir=path.join(box.dir,'audio');
  await fs.mkdir(dist);
  await fs.writeFile(path.join(dist, 'index.html'), 'study desk');
  await fs.writeFile(path.join(dist,'local.wasm'),new Uint8Array([0,97,115,109]));
  await fs.writeFile(path.join(dist, 'entry.js'), 'void 0');
  sim = new Date('2026-11-20T12:00:00');
  server = createServer({
    dist,
    dataDir: dir, audioDir,
    limit: 512,
    clock: () => sim
  });
  const addr = await listen(server, 0);
  url = 'http://127.0.0.1:' + addr.port;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  box.clean();
});
it('binds loopback only and reports its configured data directory', async () => {
  expect(server.address().address).toBe('127.0.0.1');
  expect(await (await fetch(url + '/api/health')).json()).toEqual({
    ok: true,
    dataDir: dir
  });
  expect((await fetch(url + '/api/state')).status).toBe(404);
  await expect(fs.access(dir)).rejects.toThrow();
});
it('serves the SPA fallback and real MIME types, but not missing scripts', async () => {
  expect(await (await fetch(url + '/study')).text()).toBe('study desk');
  expect((await fetch(url+'/local.wasm')).headers.get('content-type')).toBe('application/wasm');
  expect((await fetch(url + '/entry.js')).headers.get('content-type')).toBe('text/javascript');
  expect((await fetch(url + '/missing.js')).status).toBe(404);
});
it('atomically replaces state and keeps the first daily checkpoint', async () => {
  expect((await put(1)).status).toBe(200);
  expect((await put(2)).status).toBe(200);
  expect(await (await fetch(url + '/api/state')).json()).toEqual(payload(2));
  expect(JSON.parse(await fs.readFile(path.join(dir, 'backups', '2026-11-20.json'), 'utf8'))).toEqual(payload(1));
  expect((await fs.readdir(dir)).sort()).toEqual(['backups', 'state.json']);
});
it('keeps 30 backup days and honours the study-day boundary', async () => {
  for (let i = 0; i < 32; i++) {
    sim = new Date(2026, 0, i + 1, 3);
    expect((await put(i)).status).toBe(200);
  }
  const files = await fs.readdir(path.join(dir, 'backups'));
  expect(files).toHaveLength(30);
  expect(files.sort()[0]).toBe('2026-01-02.json');
  expect(files.at(-1)).toBe('2026-01-31.json');
});
it('rejects a body over the limit without replacing the good state', async () => {
  await put('keep');
  expect((await put('z'.repeat(600))).status).toBe(413);
  expect(await (await fetch(url + '/api/state')).json()).toEqual(payload('keep'));
});
it('limits streamed bodies without a content-length', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request(url + '/api/state', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json'
      }
    }, r => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on('error', reject);
    req.write('z'.repeat(300));
    req.end('z'.repeat(300));
  });
  expect(status).toBe(413);
});
it('rejects wrong MIME, malformed JSON, invalid envelope and foreign origins', async () => {
  expect((await put(1, {
    'content-type': 'text/plain'
  })).status).toBe(415);
  for (const body of ['broken', 'null', '{}']) expect((await fetch(url + '/api/state', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json'
    },
    body
  })).status).toBe(400);
  expect((await put(1, {
    Origin: 'https://example.invalid'
  })).status).toBe(403);
});

it('rejects an incomplete SQL snapshot without replacing the previous one',async()=>{
  await put('keep');
  const broken=payload('lose');delete broken.data.sqlDrafts;
  const res=await fetch(url+'/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(broken)});
  expect(res.status).toBe(400);expect(await(await fetch(url+'/api/state')).json()).toEqual(payload('keep'));
});

it('discovers only valid voice packs and sanitises manifest items',async()=>{
  expect(await(await fetch(url+'/api/audio')).json()).toEqual({found:false,voices:[]});
  const key='1'.repeat(20),bad='2'.repeat(20),dir=path.join(audioDir,'narrator');
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({voiceId:'narrator',voiceLabel:'曉晴',engine:'mock',version:'1',items:{[key]:{file:'01/a.opus',ms:123},[bad]:{file:'../escape.wav',ms:120}}}));
  await fs.mkdir(path.join(audioDir,'incomplete'));
  expect(await(await fetch(url+'/api/audio')).json()).toEqual({found:true,voices:[{voiceId:'narrator',voiceLabel:'曉晴',engine:'mock',version:'1'}]});
  expect((await(await fetch(url+'/audio/narrator/manifest.json')).json()).items).toEqual({[key]:{file:'01/a.opus',ms:123}});
  expect((await fetch(url+'/audio/incomplete/manifest.json')).status).toBe(404);
});
it('serves audio MIME, exact partial bytes and HEAD, without paths outside the voice folder',async()=>{
  const voice=path.join(audioDir,'narrator'),outside=path.join(box.dir,'outside');
  await fs.mkdir(path.join(voice,'01'),{recursive:true});await fs.mkdir(outside);
  await fs.writeFile(path.join(outside,'secret.wav'),'not audio');
  await fs.symlink(outside,path.join(voice,'escape'),'junction');
  const formats={ogg:'audio/ogg',opus:'audio/ogg',webm:'audio/webm',mp3:'audio/mpeg',wav:'audio/wav'};
  for(const [ext,mime] of Object.entries(formats)){
    await fs.writeFile(path.join(voice,'01','test.'+ext),'0123456789');
    const file=url+'/audio/narrator/01/test.'+ext;
    const res=await fetch(file);
    expect(res.headers.get('content-type')).toBe(mime);expect(res.headers.get('accept-ranges')).toBe('bytes');expect(await res.text()).toBe('0123456789');
  }
  const file=url+'/audio/narrator/01/test.wav';
  const partial=await fetch(file,{headers:{Range:'bytes=2-5'}});
  expect(partial.status).toBe(206);expect(partial.headers.get('content-range')).toBe('bytes 2-5/10');expect(await partial.text()).toBe('2345');
  const end=await fetch(file,{headers:{Range:'bytes=-3'}});expect(await end.text()).toBe('789');
  const head=await fetch(file,{method:'HEAD',headers:{Range:'bytes=6-'}});
  expect(head.status).toBe(206);expect(head.headers.get('content-length')).toBe('4');expect(await head.text()).toBe('');
  for(const Range of ['bytes=21-','bytes=5-2','bytes=0-1,4-5','bytes=-0']){
    const invalid=await fetch(file,{headers:{Range}});expect(invalid.status).toBe(416);expect(invalid.headers.get('content-range')).toBe('bytes */10');
  }
  for(const route of ['/audio','/audio/narrator/','/audio/narrator/01/','/audio/narrator/escape/secret.wav','/audio/narrator/not-a-track.txt']){
    expect((await fetch(url+route)).status).toBe(404);
  }
  for(const route of ['/audio/narrator/..%2foutside%2fsecret.wav','/audio/narrator/%5coutside/secret.wav','/audio/narrator/01/test.wav%3Asecret']){
    const status=await new Promise((resolve,reject)=>{http.get(url,{path:route},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});
    expect(status).toBe(403);
  }
  expect((await fetch(file,{method:'PUT',body:'other'})).status).toBe(405);
  expect(await(await fetch(file)).text()).toBe('0123456789');
  // Release Windows directory entries individually; recursive cleanup must never follow a junction.
  await fs.unlink(path.join(voice,'escape'));
  for(const ext of Object.keys(formats))await fs.unlink(path.join(voice,'01','test.'+ext));
});
