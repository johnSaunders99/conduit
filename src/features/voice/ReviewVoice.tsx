import {useEffect,useRef,useState} from 'react';
import {Volume2,Square,TimerReset} from 'lucide-react';
import {useWork} from '../../ui/context';
import {loadCards} from './assets';
import {optionSequence,voiceDefaults,type CardsSpeech} from './types';
import {useNarration} from './useNarration';

export default function ReviewVoice({id,mode,answer,order=[],onTime}:{id:string;mode:'flashcard'|'quiz'|'interview';answer:boolean;order?:number[];onTime?:()=>void}){
  const {s}=useWork(),prefs=s.voice??voiceDefaults,interview=mode==='interview';
  const {playback,failed,start,stop}=useNarration(prefs,interview);
  const [cards,set]=useState<CardsSpeech>(),[error,failedLoad]=useState(false);
  const [deadline,setDeadline]=useState<number>(),[left,setLeft]=useState(0);
  const played=useRef(false),answerPlayed=useRef(false),timeout=useRef(onTime);
  timeout.current=onTime;
  useEffect(()=>{let live=true;loadCards().then(v=>{if(live)set(v)}).catch(()=>{if(live)failedLoad(true)});return()=>{live=false}},[]);
  const data=cards?.concepts[id], iv=cards?.interviews[id], mcq=data?.mcq;
  const question=interview?iv?.question:mode==='quiz'&&mcq&&cards?optionSequence(cards,mcq,order):data?.prompt;
  const reply=interview?iv?.points:mode==='quiz'?mcq?.explain:data?.answer;
  function begin(){
    setLeft(prefs.interviewSeconds);setDeadline(Date.now()+prefs.interviewSeconds*1000);
  }
  function prompt(){
    if(interview&&!answer){
      setDeadline(undefined);
      if(question?.length&&prefs.engine!=='off')start(question,{onEnd:begin});
      else begin();
    }else if(question?.length)start(question);
  }
  useEffect(()=>{
    if(!cards||answer||played.current||!prefs.autoReview||prefs.engine==='off')return;
    played.current=true;prompt();
  },[cards,answer,prefs.autoReview,prefs.engine]);
  useEffect(()=>{
    if(!answer||!cards||answerPlayed.current)return;
    answerPlayed.current=true;setDeadline(undefined);stop();
    if(reply?.length&&prefs.engine!=='off')start(reply);
  },[answer,cards]);
  useEffect(()=>{
    if(!deadline||answer)return;
    const tick=()=>{const n=Math.max(0,Math.ceil((deadline-Date.now())/1000));setLeft(n);if(!n){setDeadline(undefined);timeout.current?.()}};
    const id=setInterval(tick,250);return()=>clearInterval(id);
  },[deadline,answer]);
  const playing=['loading','playing'].includes(playback.state);
  return <div className="short-voice">
    {interview&&!answer?<><button type="button" disabled={playing||!!deadline} onClick={prompt}>{deadline?<TimerReset size={16}/>:<Volume2 size={16}/>} {deadline?'作答中':prefs.engine==='off'?'開始計時':'朗讀並開始模擬'}</button>
      {deadline&&<span role="timer" aria-label="作答剩餘秒數">{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</span>}
      {!deadline&&<small>作答 {prefs.interviewSeconds} 秒 · 不需要麥克風</small>}</>:prefs.engine!=='off'&&!playing?<button type="button" disabled={!cards} onClick={()=>answer?(reply?.length&&start(reply)):prompt()}><Volume2 size={16}/>{answer?(interview?'朗讀要點':'朗讀解說'):'朗讀題目'}</button>:null}
    {playing&&<button type="button" onClick={stop}><Square size={14}/>停止朗讀</button>}
    {interview&&answer&&prefs.engine!=='off'&&iv?.reference.length&&!playing?<button type="button" onClick={()=>start(iv.reference)}><Volume2 size={16}/>朗讀參考答案</button>:null}
    <small role="status">{error?'未能載入朗讀內容。':failed?'未能播放，仍可閱讀題目。':playing?playback.label:''}</small>
  </div>;
}
