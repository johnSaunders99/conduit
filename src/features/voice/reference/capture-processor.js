class ReferenceCapture extends AudioWorkletProcessor {
  constructor(){
    super();
    this.next=new Float32Array(2048);
    this.used=0;
    this.peak=0;
    this.energy=0;
    this.done=false;
    // Hard cap in the render thread, even if the window's timer is throttled.
    this.max=20*sampleRate;
    this.samples=0;
    this.port.onmessage=({data})=>{if(data==='stop')this.finish()};
  }
  flush(){
    if(!this.used)return;
    const data=this.used===this.next.length?this.next:this.next.slice(0,this.used);
    this.port.postMessage({data,peak:this.peak,level:Math.sqrt(this.energy/this.used)},[data.buffer]);
    this.next=new Float32Array(2048);
    this.used=this.peak=this.energy=0;
  }
  finish(){
    if(this.done)return;
    this.done=true;
    this.flush();
    this.port.postMessage({finished:true});
  }
  process([input]){
    if(this.done)return false;
    if(!input?.length)return true;
    for(let i=0;i<input[0].length;i++){
      let mono=0;
      for(const track of input){mono+=track[i]/input.length;this.peak=Math.max(this.peak,Math.abs(track[i]))}
      this.next[this.used++]=mono;
      this.energy+=mono*mono;
      if(this.used===this.next.length)this.flush();
      if(++this.samples>=this.max){this.finish();return false}
    }
    // Deliberately leave the output silent; no microphone monitoring or feedback.
    return true;
  }
}
registerProcessor('conduit-reference',ReferenceCapture);
