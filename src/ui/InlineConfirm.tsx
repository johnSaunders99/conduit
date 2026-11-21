import {useEffect,useRef,type RefObject} from 'react';

type Props={
  label:string;confirmLabel:string;message?:string;open:boolean;disabled?:boolean;
  onOpenChange:(open:boolean)=>void;onConfirm:()=>void;afterConfirm?:RefObject<HTMLElement>;
};
export function cancelWithEscape(e:Pick<KeyboardEvent,'key'|'preventDefault'|'stopPropagation'>,dismiss:()=>void){
  if(e.key!=='Escape')return false;
  e.preventDefault();e.stopPropagation();dismiss();
  return true;
}

export function InlineConfirm({label,confirmLabel,message,open,disabled,onOpenChange,onConfirm,afterConfirm}:Props){
  const trigger=useRef<HTMLButtonElement>(null),cancel=useRef<HTMLButtonElement>(null);
  const wasOpen=useRef(false),confirmed=useRef(false);
  useEffect(()=>{
    if(open)cancel.current?.focus({preventScroll:true});
    else if(wasOpen.current){
      const target=confirmed.current?(afterConfirm?.current??trigger.current):trigger.current;
      target?.focus({preventScroll:!confirmed.current||!afterConfirm?.current});
      confirmed.current=false;
    }
    wasOpen.current=open;
  },[open,afterConfirm]);
  if(!open)return <button type="button" ref={trigger} disabled={disabled} onClick={()=>onOpenChange(true)}>{label}</button>;
  return <span className="inline-confirm" role="group" aria-label={label} onKeyDown={e=>cancelWithEscape(e,()=>onOpenChange(false))}>
    {message&&<small className="confirm-note">{message}</small>}
    <button type="button" className="primary" disabled={disabled} onClick={()=>{
      confirmed.current=true;onOpenChange(false);onConfirm();
    }}>{confirmLabel}</button>
    <button type="button" className="ghost" ref={cancel} onClick={()=>onOpenChange(false)}>取消</button>
  </span>;
}
