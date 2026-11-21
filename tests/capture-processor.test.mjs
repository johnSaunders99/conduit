import fs from 'node:fs';
import vm from 'node:vm';
import {expect,it} from 'vitest';

function worklet(rate){
 const messages=[];
 let Registered;
 vm.runInNewContext(fs.readFileSync('src/features/voice/reference/capture-processor.js','utf8'),{
   AudioWorkletProcessor:class{port={postMessage:m=>messages.push(m)}},
   Float32Array,sampleRate:rate,registerProcessor:(name,klass)=>{expect(name).toBe('conduit-reference');Registered=klass}
 });
 return {processor:new Registered(),messages};
}
it('emits a mono recording, peak and RMS without monitoring; manual stop flushes a partial chunk',()=>{
 const {processor:p,messages}=worklet(48000);
 const left=new Float32Array([.4,1,.2]),right=new Float32Array([.2,-.2,.4]);
 const speakers=[[new Float32Array(3)]];
 expect(p.process([[left,right]],speakers)).toBe(true);
 expect(messages).toEqual([]);
 p.port.onmessage({data:'stop'});
 expect(messages).toHaveLength(2);expect(messages[0].peak).toBe(1);
 expect(messages[0].level).toBeCloseTo(Math.sqrt(.34/3));
 [0.3,0.4,0.3].forEach((v,i)=>expect(messages[0].data[i]).toBeCloseTo(v));
 expect([...speakers[0][0]]).toEqual([0,0,0]);expect(messages[1]).toEqual({finished:true});
 expect(p.process([[left,right]],speakers)).toBe(false);
});
it('enforces a 20-second maximum even without a window timer',()=>{
 const {processor:p,messages}=worklet(1000);
 const input=new Float32Array(128).fill(.12);
 let loops=0;
 while(p.process([[input]]))expect(++loops).toBeLessThan(157);
 expect(messages.at(-1)).toEqual({finished:true});
 expect(messages.slice(0,-1).reduce((n,x)=>n+x.data.length,0)).toBe(20000);
});