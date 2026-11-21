import {describe,expect,it} from 'vitest';
import {encodeReference,referenceRate,trimSilence} from '../src/features/voice/reference/wav';
import {pageTitle} from '../src/lib/pageTitle';

describe('reference audio',()=>{
  it('encodes little-endian mono PCM16 at 32 kHz, clips overflow and preserves the full signed range',()=>{
    const bytes=encodeReference(Float32Array.from([-2,-.5,0,.5,2,NaN]));
    const view=new DataView(bytes),ascii=(a:number,b:number)=>String.fromCharCode(...new Uint8Array(bytes).slice(a,b));
    expect(ascii(0,4)).toBe('RIFF');expect(ascii(8,16)).toBe('WAVEfmt ');expect(ascii(36,40)).toBe('data');
    expect(view.getUint32(4,true)).toBe(48);expect(view.getUint32(40,true)).toBe(12);
    expect(view.getUint16(20,true)).toBe(1);expect(view.getUint16(22,true)).toBe(1);
    expect(view.getUint32(24,true)).toBe(referenceRate);expect(view.getUint32(28,true)).toBe(64000);
    expect(view.getUint16(32,true)).toBe(2);expect(view.getUint16(34,true)).toBe(16);
    expect(Array.from({length:6},(_,i)=>view.getInt16(44+i*2,true))).toEqual([-32768,-16384,0,16384,32767,0]);
  });
  it('keeps 0.2 seconds at both ends, preserves pauses within speech, and ignores isolated clicks',()=>{
    const rate=1000,x=new Float32Array(4000);
    x.fill(.06,1000,1500);x.fill(.07,2100,3000);x[50]=1;x[3700]=1;
    const y=trimSilence(x,rate);
    expect(y.length).toBe(2400);expect(y[0]).toBe(0);expect(y[200]).toBeCloseTo(.06);expect(y[850]).toBe(0);
    expect(y[2100]).toBeCloseTo(.07);expect(y.at(-1)).toBe(0);
    expect(trimSilence(new Float32Array(1000),rate)).toHaveLength(0);
  });
  it('does not manufacture padding when speech meets either recording boundary',()=>{
    const x=new Float32Array(1000).fill(.2);
    expect([...trimSilence(x,1000)]).toEqual([...x]);
  });
});
it('uses the actual module, lesson and exercise titles in tabs and labels the voice recorder',()=>{
  const cat={modules:[{id:'m',title:'數據管道'}],lessons:[{id:'l',title:'聚合'}],exercises:[{id:'q',title:'去重'}]} as Parameters<typeof pageTitle>[1];
  expect(pageTitle('/module/m',cat)).toBe('數據管道 · 渠成');
  expect(pageTitle('/lesson/l',cat)).toBe('聚合 · 渠成');
  expect(pageTitle('/sql/q',cat)).toBe('去重 · 渠成');
  expect(pageTitle('/voice',cat)).toBe('錄製我的聲線 · 渠成');
  expect(pageTitle('/today',cat,'今天')).toBe('今天 · 渠成');
});
