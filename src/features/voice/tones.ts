let ctx:AudioContext|undefined;
type Tone='correct'|'wrong'|'done'|'focus';
export function unlockTones(){
  if(!globalThis.AudioContext)return;
  try{ctx??=new AudioContext();if(ctx.state==='suspended')void ctx.resume().catch(()=>{})}catch{/* Audio is optional. */}
}
export function tone(kind:Tone){
  unlockTones();const ac=ctx;if(!ac)return;
  const notes={correct:[523,659],wrong:[392,330],done:[440,554,659],focus:[440,523,440]}[kind];
  for(const [i,hz] of notes.entries()){
    const start=ac.currentTime+.02+i*.12, osc=ac.createOscillator(),gain=ac.createGain();osc.frequency.value=hz;osc.type='sine';
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.055,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+.22);
    osc.connect(gain);gain.connect(ac.destination);osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(start);osc.stop(start+.23);
  }
}
