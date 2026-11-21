import processorUrl from './capture-processor.js?url&no-inline';
import {encodeReference,referenceRate,trimSilence} from './wav';
export type Take={wav:Blob;duration:number};
export type Capture={stop:()=>void;result:Promise<Take>};

export async function capture(signal:AbortSignal,meter:(level:number,peak:number)=>void):Promise<Capture>{
  const ctx=new AudioContext();
  let stream:MediaStream|undefined,tap:AudioWorkletNode|undefined,source:MediaStreamAudioSourceNode|undefined;
  let closed=false,timeout:ReturnType<typeof setTimeout>;
  const cleanup=()=>{
    if(closed)return;closed=true;clearTimeout(timeout);
    stream?.getTracks().forEach(track=>track.stop());
    source?.disconnect();tap?.disconnect();tap?.port.close();
    void ctx.close().catch(()=>{});
  };
  signal.addEventListener('abort',cleanup,{once:true});
  try{
    await ctx.resume();
    stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:{ideal:1},autoGainControl:false,echoCancellation:false,noiseSuppression:false},video:false});
    if(signal.aborted){stream.getTracks().forEach(track=>track.stop());throw new DOMException('Cancelled','AbortError')}
    await ctx.audioWorklet.addModule(processorUrl);
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const sampleRate=ctx.sampleRate,frames:Float32Array[]=[];
    tap=new AudioWorkletNode(ctx,'conduit-reference');
    source=ctx.createMediaStreamSource(stream);
    const stop=()=>tap?.port.postMessage('stop');
    let requestStop=stop;
    signal.removeEventListener('abort',cleanup);
    const result=new Promise<Take>((resolve,reject)=>{
      const abort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'))};
      const fail=()=>{signal.removeEventListener('abort',abort);cleanup();reject(new Error('未能完成錄音，請再試一次。'))};
      const finish=async()=>{
        signal.removeEventListener('abort',abort);cleanup();
        try{const take=await prepareTake(frames,sampleRate);
          if(signal.aborted)reject(new DOMException('Cancelled','AbortError'));else resolve(take);
        }catch(e){reject(e)}
      };
      signal.addEventListener('abort',abort,{once:true});
      tap!.onprocessorerror=fail;
      tap!.port.onmessage=({data})=>{
        if(closed)return;
        if(data.finished){void finish();return}
        if(data.data instanceof Float32Array){frames.push(data.data);meter(data.level,data.peak)}
      };
      // A timer also ends a capture if the microphone stops providing frames.
      requestStop=()=>{if(closed)return;clearTimeout(timeout);stop();timeout=setTimeout(fail,2_000)};
      timeout=setTimeout(requestStop,20_200);
      // Audio graph is quiet; an output connection keeps it processing in Chromium.
      source!.connect(tap!);tap!.connect(ctx.destination);
    });
    return {stop:requestStop,result};
  }catch(e){cleanup();throw e}
  finally{signal.removeEventListener('abort',cleanup)}
}

async function prepareTake(frames:Float32Array[],rate:number):Promise<Take>{
  const input=new Float32Array(frames.reduce((n,f)=>n+f.length,0));
  let at=0;for(const chunk of frames){input.set(chunk,at);at+=chunk.length}
  let samples=trimSilence(input,rate);
  if(!samples.length)throw Error('沒有收到清楚的聲音。請靠近麥克風再錄一次。');
  if(rate!==referenceRate){
    const offline=new OfflineAudioContext(1,Math.max(1,Math.round(samples.length*referenceRate/rate)),referenceRate);
    const buffer=offline.createBuffer(1,samples.length,rate);buffer.getChannelData(0).set(samples);
    const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();
    samples=(await offline.startRendering()).getChannelData(0);
  }
  return {wav:new Blob([encodeReference(samples)],{type:'audio/wav'}),duration:samples.length/referenceRate};
}
