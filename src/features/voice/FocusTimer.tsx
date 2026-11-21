import {useEffect,useState} from 'react';
import {Timer} from 'lucide-react';
import {tone,unlockTones} from './tones';

export function useFocusTimer(enabled:boolean,notify:(message:string)=>void){
  const [until,set]=useState<number>(),[left,setLeft]=useState(25*60);
  useEffect(()=>{if(!enabled){set(undefined);setLeft(25*60);return}if(!until)return;
    const tick=()=>{const seconds=Math.max(0,Math.ceil((until-Date.now())/1000));setLeft(seconds);if(seconds===0){set(undefined);tone('focus');notify('休息 5 分鐘')}};
    const id=setInterval(tick,500);return()=>clearInterval(id);
  },[enabled,until,notify]);
  return {left,running:!!until,toggle:()=>{if(until){set(undefined);setLeft(25*60)}else{unlockTones();setLeft(25*60);set(Date.now()+25*60_000)}}};
}
export function FocusTimer({timer}:{timer:ReturnType<typeof useFocusTimer>}){
  return <div className="focus-timer">
    <b><Timer size={16}/>專注計時</b>
    <span role="timer" aria-label="專注剩餘時間">{Math.floor(timer.left/60)}:{String(timer.left%60).padStart(2,'0')}</span>
    <button type="button" onClick={timer.toggle}>{timer.running?'停止':'開始'}</button>
    {timer.left===0&&!timer.running&&<small>休息 5 分鐘</small>}
  </div>;
}
