import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {AudioLines, Mic} from 'lucide-react';
import {voiceUpdate} from '../../db';
import {useWork} from '../../ui/context';
import {loadKeys,loadPack,packs,systemVoices} from './assets';
import {speechSpeed,voiceDefaults,type VoiceSettings} from './types';

export default function VoiceSettingsPanel(){
  const {s}=useWork(),v=s.voice??voiceDefaults;
  const [voices,setVoices]=useState(systemVoices),[status,setStatus]=useState<{found:boolean;labels:string[];total?:number;count?:number}>();
  useEffect(()=>{
    const update=()=>setVoices(systemVoices()),synth=globalThis.speechSynthesis;
    synth?.addEventListener('voiceschanged',update);update();
    return()=>synth?.removeEventListener('voiceschanged',update);
  },[]);
  useEffect(()=>{
    let live=true;
    const scan=async()=>{
      const info=await packs(true);
      const voice=info.voices.find(x=>x.voiceId==='narrator')??info.voices[0];
      const [keys,pack]=await Promise.all([loadKeys().catch(()=>null),voice?loadPack(voice.voiceId,true):null]);
      if(live)setStatus({found:info.found,labels:info.voices.map(x=>x.voiceLabel),total:keys?.keys.length,count:keys?.keys.filter(k=>pack&&Object.hasOwn(pack.items,k)).length});
    };
    void scan();return()=>{live=false};
  },[]);
  const put=<K extends keyof VoiceSettings>(k:K,val:VoiceSettings[K])=>void voiceUpdate({[k]:val});
  const toggles:[keyof Pick<VoiceSettings,'autoReview'|'highlight'|'sectioned'|'sounds'|'focusTimer'>,string][]=[
    ['autoReview','自動朗讀複習題'],['highlight','跟讀高亮'],['sectioned','分段閱讀'],['sounds','答題與完成提示音'],['focusTimer','顯示 25 分鐘專注計時']];
  const fmt=new Intl.NumberFormat('zh-TW');
  return <section className="panel settings voice-settings">
    <div className="between voice-settings-top"><h2><AudioLines size={20}/> 朗讀</h2><Link className="button" to="/voice"><Mic size={16}/>錄製我的聲線</Link></div>
    <div className="fields">
      <label className="field">播放方式<select value={v.engine} onChange={e=>put('engine',e.target.value as VoiceSettings['engine'])}>
        <option value="pack">預錄聲線優先</option><option value="system">只用系統聲線</option><option value="off">關閉</option>
      </select></label>
      <label className="field">系統聲線<select value={voices.some(x=>x.voiceURI===v.systemVoice)?v.systemVoice:''} onChange={e=>put('systemVoice',e.target.value)}>
        <option value="">自動選擇（優先使用離線台灣華語）</option>
        {voices.map(x=><option key={x.voiceURI} value={x.voiceURI}>{x.name} · {x.lang} · {x.localService?'離線':'可能需網路'}</option>)}
      </select></label>
      <label className="field">速度 · {v.speed.toFixed(1)}×<input type="range" min=".8" max="1.6" step=".1" value={v.speed} onChange={e=>put('speed',speechSpeed(+e.target.value))}/></label>
      <label className="field">其餘文字亮度 · {v.dim}%<input type="range" min="0" max="100" step="1" value={v.dim} onChange={e=>put('dim',+e.target.value)}/></label>
      <label className="field">括號英文<select value={v.english?'read':'skip'} onChange={e=>put('english',e.target.value==='read')}><option value="skip">略過</option><option value="read">讀出</option></select></label>
      <label className="field">程式碼段落<select value={v.pauseCode?'pause':'skip'} onChange={e=>put('pauseCode',e.target.value==='pause')}><option value="pause">停下，等我繼續</option><option value="skip">略過</option></select></label>
      <label className="field">模擬面試作答時間<select value={v.interviewSeconds} onChange={e=>put('interviewSeconds',+e.target.value as VoiceSettings['interviewSeconds'])}>{[60,90,120].map(n=><option key={n} value={n}>{n} 秒</option>)}</select></label>
    </div>
    <div className="voice-toggles">{toggles.map(([k,text])=><label className="toggle" key={k}><input type="checkbox" checked={v[k]} onChange={e=>put(k,e.target.checked)}/>{text}</label>)}</div>
    <p className="muted"><b>預錄音檔資料夾</b> · {!status?'正在檢查…':status.found?'已找到':'尚未找到'}
      {status?.labels.length?' · '+status.labels.join('、'):status?.found?' · 尚無可用聲線':''}
      {status?.total!==undefined&&<> · 主聲線已生成 {fmt.format(status.count??0)} / {fmt.format(status.total)} 句</>}</p>
    <small>沒有預錄音檔時，會改用所選系統聲線。選用需網路的聲線時，瀏覽器可能會將朗讀文字送至聲線服務。</small>
  </section>;
}
