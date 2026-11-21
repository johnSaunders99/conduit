import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {Grid,displaySqlValue} from '../src/features/sql/Grid';
import {gradeSql,type ResultSet} from '../src/lib/sqlGrade';

it('caps floating display at six places, trims zeros and keeps the full result in a tooltip',()=>{
  const result:ResultSet={columns:[
    {name:'average',type:'DOUBLE'},{name:'ratio',type:'FLOAT'},{name:'amount',type:'DECIMAL(8,2)'},{name:'count',type:'BIGINT'}
  ],rows:[[16.916666666666668,1.25000001,'20.50',9007199254740993n]]};
  const html=renderToStaticMarkup(<Grid result={result} ms={1}/>);
  expect(html).toContain('title="16.916666666666668">16.916667</td>');
  expect(html).toContain('title="1.25000001">1.25</td>');
  expect(html).toContain('<td class="numeric">20.50</td>');
  expect(html).toContain('<td class="numeric">9007199254740993</td>');
  expect(displaySqlValue(-0.00000001,'DOUBLE')).toEqual({text:'0',title:'-1e-8'});
  expect(displaySqlValue(1.5e30,'DOUBLE').text).toBe('1.5e+30');
  expect(displaySqlValue(Infinity,'DOUBLE').text).toBe('Infinity');
});
it('does not round the query results the grader receives',()=>{
  const a=16.916666666666668,b=16.9166667,columns=[{name:'x',type:'DOUBLE'}];
  expect(displaySqlValue(a,'DOUBLE').text).toBe(displaySqlValue(b,'DOUBLE').text);
  expect(gradeSql({columns,rows:[[a]]},{columns,rows:[[b]]},{tolerance:0}).passed).toBe(false);
  expect(gradeSql({columns,rows:[[a]]},{columns,rows:[[b]]}).passed).toBe(true);
});
