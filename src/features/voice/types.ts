export type VoiceSettings={
  engine:'pack'|'system'|'off'; systemVoice:string; speed:number; autoReview:boolean;
  highlight:boolean; dim:number; english:boolean; pauseCode:boolean; sectioned:boolean;
  interviewSeconds:60|90|120; sounds:boolean; focusTimer:boolean;
};
export const voiceDefaults:VoiceSettings={
  engine:'pack',systemVoice:'',speed:1,autoReview:false,highlight:true,dim:55,english:false,
  pauseCode:true,sectioned:false,interviewSeconds:90,sounds:false,focusTimer:false,
};
export const speechSpeed=(n:number)=>Math.min(1.6,Math.max(.8,Math.round(n*10)/10));
export type Spoken={speak:string;key:string};
export type Segment=Spoken&{n:number;kind:string;text:string;part?:number;english?:Spoken};
export type LessonSpeech={segments:Segment[];sections:{title:string;anchor:string|null;start:number}[]};
export type CardsSpeech={
  optionLetters:Segment[][];
  concepts:Record<string,{prompt:Segment[];answer:Segment[];mcq?:{question:Segment[];options:Segment[][];explain:Segment[]}}>;
  interviews:Record<string,{question:Segment[];points:Segment[];reference:Segment[]}>;
  sql:Record<string,{prompt:Segment[];explain:Segment[]}>;
};
export type VoiceInfo={voiceId:string;voiceLabel:string;engine:string;version:string};
export type Manifest=VoiceInfo&{items:Record<string,{file:string;ms:number}>};
export const selectSpeech=(seg:Segment,english:boolean)=>english&&seg.english?seg.english:seg;
export function clipFor(seg:Spoken,pack:Manifest|null,engine:VoiceSettings['engine']){
  const item=engine==='pack'&&pack&&Object.hasOwn(pack.items,seg.key)?pack.items[seg.key]:null;
  return item?{url:'/audio/'+encodeURIComponent(pack!.voiceId)+'/'+item.file.split('/').map(encodeURIComponent).join('/'),label:'預錄聲線：'+pack!.voiceLabel,ms:item.ms}:null;
}
export const optionSequence=(cards:CardsSpeech,mcq:NonNullable<CardsSpeech['concepts'][string]['mcq']>,order:number[])=>
  [...mcq.question,...order.flatMap((v,j)=>[...(cards.optionLetters[j]??[]),...(mcq.options[v]??[])])];