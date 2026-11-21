export function Trail({flow=false}:{flow?:boolean}){
  return <svg className="trail-art" viewBox="0 0 480 160" fill="none" aria-hidden="true">
    <defs><pattern id="desk-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" stroke="currentColor" strokeWidth=".5" opacity=".4"/></pattern></defs>
    <rect width="480" height="160" fill="url(#desk-grid)"/>
    <g stroke="currentColor" opacity=".58">{[0,1,2,3,4].map(i=><g key={i} transform={'translate(0 '+(i*3)+')'}><path d="M0 16H100C150 16 157 78 220 78H480M0 128H92C147 128 169 78 220 78M0 68H65C112 68 140 82 194 80"/></g>)}</g>
    {flow&&<path className="channel-flow" d="M0 16H100C150 16 157 78 220 78H480" pathLength="100" vectorEffect="non-scaling-stroke"/>}
    <g fill="var(--bg)" stroke="var(--brand)" strokeWidth="2">{[[92,16],[92,128],[242,84],[370,84]].map(([x,y])=><circle key={x+':'+y} cx={x} cy={y} r="4"/>)}</g>
  </svg>
}
