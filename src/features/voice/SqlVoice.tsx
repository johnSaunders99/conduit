import {useEffect,useRef,useState} from 'react';
import {Volume2,Square} from 'lucide-react';
import {useWork} from '../../ui/context';
import {loadCards} from './assets';
import {useNarration} from './useNarration';
import {voiceDefaults} from './types';

export default function SqlVoice({id}:{id:string}){
  const {s}=useWork(),prefs=s.voice??voiceDefaults,{playback,failed,start,stop}=useNarration(prefs);
  const [loading,set]=useState(false),[error,err]=useState(false),generation=useRef(0);
  useEffect(()=>()=>{generation.current++},[id]);
  const playing=loading||['playing','loading'].includes(playback.state);
  async function speak(){
    if(playing){generation.current++;set(false);stop();return}
    const token=++generation.current;set(true);err(false);
    try{
      const cards=await loadCards();if(generation.current!==token)return;
      const prompt=cards.sql[id]?.prompt; if(prompt?.length)start(prompt);else err(true);
    }catch{if(generation.current===token)err(true)}finally{if(generation.current===token)set(false)}
  }
  return <div className="short-voice">
    <button type="button" onMouseDown={e=>{if(document.activeElement?.closest('.cm-editor'))e.preventDefault()}} onClick={()=>void speak()}>{playing?<Square size={14}/>:<Volume2 size={16}/>} {playing?'停止朗讀':'朗讀題目'}</button>
    <small role="status">{error||failed?'未能播放，仍可閱讀題目。':playing?playback.label:''}</small>
  </div>;
}
