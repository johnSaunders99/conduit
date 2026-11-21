export const referenceRate=32_000;

// In 10 ms windows, require at least 20 ms above the noise floor before treating it as speech.
export function trimSilence(samples:Float32Array,rate:number,keep=.2){
  const step=Math.max(1,Math.round(rate*.01));
  let first=-1,last=-1,run=0;
  for(let i=0;i<samples.length;i+=step){
    const end=Math.min(i+step,samples.length);let energy=0;
    for(let j=i;j<end;j++)energy+=samples[j]*samples[j];
    if(energy/(end-i)>=.012**2){run++;if(run>=2){if(first<0)first=i-(run-1)*step;last=end}}
    else run=0;
  }
  if(first<0)return new Float32Array();
  const pad=Math.round(keep*rate);
  return samples.slice(Math.max(0,first-pad),Math.min(samples.length,last+pad));
}

export function encodeReference(samples:Float32Array):ArrayBuffer{
  const bytes=new ArrayBuffer(44+samples.length*2),out=new DataView(bytes);
  const tag=(at:number,s:string)=>{for(let i=0;i<s.length;i++)out.setUint8(at+i,s.charCodeAt(i))};
  tag(0,'RIFF');out.setUint32(4,bytes.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');
  out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,1,true);
  out.setUint32(24,referenceRate,true);out.setUint32(28,referenceRate*2,true);out.setUint16(32,2,true);out.setUint16(34,16,true);
  tag(36,'data');out.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){
    const x=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;
    out.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);
  }
  return bytes;
}
