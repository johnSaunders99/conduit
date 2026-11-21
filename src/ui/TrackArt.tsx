import type {Catalog,TrackId} from '../content/types';
import {trackColor} from '../content/catalog';

// Five channel studies, from a single intake to an outgoing network.
const drawings=[
  {lines:'M2 32H31Q43 32 51 24T71 16H110 M2 40H31Q45 40 55 31T74 24H110 M15 24H30Q38 24 46 16T60 8H97',nodes:[[30,32],[73,24],[94,16]]},
  {lines:'M3 11H30L49 25H77L105 10 M3 24H30L49 25 M3 37H30L49 25 M77 25L105 39 M67 13V36',nodes:[[30,11],[30,37],[49,25],[77,25],[105,39]]},
  {lines:'M2 25H22Q32 4 45 11T69 33Q84 48 96 25H110 M13 37H29Q40 37 50 24T70 15Q85 15 92 25 M41 6V39 M74 7V42',nodes:[[22,25],[45,11],[70,15],[96,25]]},
  {lines:'M3 15H24L36 26H57L75 10H109 M3 36H24L36 26 M57 26L75 41H109 M75 10V41 M90 10V41 M75 25H109',nodes:[[36,26],[57,26],[75,10],[90,25],[90,41]]},
  {lines:'M3 39H25L43 25H63L88 7H111 M3 29H22L38 16H55L71 6 M63 25H85L105 21 M43 25L60 40H85L105 33',nodes:[[25,39],[43,25],[63,25],[88,7],[105,33]]},
];
export function TrackArt({cat,track,small=false,variant='glyph'}:{cat:Catalog;track:TrackId;small?:boolean;variant?:'glyph'|'band'|'card'}){
  const d=drawings[Math.max(0,cat.tracks.findIndex(t=>t.id===track))%drawings.length];
  return <svg className={'track-art tone-'+trackColor(cat,track)+(small?' track-art-small':'')+' track-art-'+variant} viewBox="0 0 114 48" aria-hidden="true" focusable="false">
    <path d="M4 45h106M4 4h106" stroke="currentColor" strokeOpacity=".16" strokeDasharray="2 4"/>
    <path d={d.lines} stroke="currentColor" fill="none" strokeWidth="1.05" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    {variant==='band'&&<path className="channel-flow" d={d.lines.split(' M')[0]} pathLength="100" fill="none" vectorEffect="non-scaling-stroke"/>}
    {d.nodes.map(([x,y],i)=><circle key={x+':'+y} cx={x} cy={y} r={i%2?2.2:1.6} fill={i%2?'var(--surface)':'currentColor'} stroke="currentColor" vectorEffect="non-scaling-stroke"/>)}
  </svg>;
}
