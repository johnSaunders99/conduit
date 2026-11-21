import {syntaxHighlighting,HighlightStyle,defaultHighlightStyle} from '@codemirror/language';
import {useEffect,useRef} from 'react';
import {basicSetup} from 'codemirror';
import {EditorView,keymap} from '@codemirror/view';
import {EditorState,Prec} from '@codemirror/state';
import {indentWithTab} from '@codemirror/commands';
import {sql,StandardSQL} from '@codemirror/lang-sql';
import type {Dataset} from '../../content/types';
// Keep CodeMirror's syntax categories, mixing their ink with the current theme
// instead of applying a fixed light-theme palette on a dark editing surface.
const ink=HighlightStyle.define(defaultHighlightStyle.specs.map(rule=>rule.color?
  {...rule,color:'color-mix(in srgb,'+rule.color+' 36%,var(--text))'}:rule));
export default function Editor({value,change,dataset,run,check}:{value:string;change:(s:string)=>void;dataset:Dataset;run:()=>void;check?:()=>void}){
  const host=useRef<HTMLDivElement>(null),view=useRef<EditorView>(),actions=useRef({change,run,check});actions.current={change,run,check};
  useEffect(()=>{
    const v=new EditorView({parent:host.current!,state:EditorState.create({doc:value,extensions:[
      Prec.highest(keymap.of([{key:'Ctrl-Shift-Enter',run:()=>{actions.current.check?.();return true}},{key:'Ctrl-Enter',run:()=>{actions.current.run();return true}},
        {key:'Escape',run:()=>{const work=host.current?.closest<HTMLElement>('.sql-work');(work?.querySelector<HTMLButtonElement>('[data-run]:not(:disabled)')??work)?.focus();return true},stopPropagation:true},indentWithTab])),
      syntaxHighlighting(ink),basicSetup,sql({dialect:StandardSQL,schema:Object.fromEntries(dataset.tables.map(t=>[t.name,t.columns.map(c=>c.name)]))}),EditorView.lineWrapping,
      EditorView.contentAttributes.of({'aria-label':'SQL 編輯器',spellcheck:'false'}),
      EditorView.updateListener.of(u=>{if(u.docChanged)actions.current.change(u.state.doc.toString())})
    ]})});view.current=v;return ()=>{v.destroy();view.current=undefined};
  },[dataset]);
  useEffect(()=>{const v=view.current;if(v&&v.state.doc.toString()!==value)v.dispatch({changes:{from:0,to:v.state.doc.length,insert:value}})},[value]);
  return <div className="sql-editor" ref={host} onMouseDownCapture={e=>{
    const v=view.current,target=e.target as HTMLElement;
    if(!v||e.button!==0||target.closest('.cm-tooltip,.cm-panel'))return;
    const end=v.state.doc.length,scroller=v.scrollDOM,box=scroller.getBoundingClientRect();
    // Preserve native gutter, line selection and scrollbar gestures; only claim
    // the frame or unused space below the last rendered line.
    const inside=e.clientX<box.left+scroller.clientWidth&&e.clientY<box.top+scroller.clientHeight;
    if(target!==host.current&&(!inside||e.clientY<v.documentTop+v.lineBlockAt(end).bottom))return;
    e.preventDefault();e.stopPropagation();
    v.dispatch({selection:{anchor:end},scrollIntoView:true});
    v.focus();
  }}/>;
}
