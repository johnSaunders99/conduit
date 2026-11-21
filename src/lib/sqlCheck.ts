import type {Exercise} from '../content/types';
import {gradeSql,type Cell,type ResultSet} from './sqlGrade';

// Keep column positions: an object keyed by name loses repeated SELECT columns.
type ArrowType={toString():string;precision?:number;scale?:number};
type ArrowTable={
  numRows:number;schema:{fields:readonly {name:string;type:ArrowType}[]};
  getChildAt:(i:number)=>{type:ArrowType;get:(i:number)=>unknown}|null
};
const sqlNames:Readonly<Record<string,string>>=Object.freeze({
  Utf8:'VARCHAR',LargeUtf8:'VARCHAR',Bool:'BOOLEAN',
  Int8:'TINYINT',Int16:'SMALLINT',Int32:'INTEGER',Int64:'BIGINT',
  Uint8:'UTINYINT',Uint16:'USMALLINT',Uint32:'UINTEGER',Uint64:'UBIGINT',
  Float32:'FLOAT',Float64:'DOUBLE',Binary:'BLOB',LargeBinary:'BLOB',Null:'NULL'
});
function sqlType(arrow:string,type?:ArrowType):string{
  if(arrow.startsWith('Decimal[')&&type?.precision!==undefined&&type.scale!==undefined)return 'DECIMAL('+type.precision+','+type.scale+')';
  if(arrow.startsWith('Date'))return 'DATE';
  if(arrow.startsWith('Timestamp<')){
    if(arrow.includes(', '))return 'TIMESTAMPTZ';
    if(arrow.includes('NANOSECOND'))return 'TIMESTAMP_NS';
    if(arrow.includes('MILLISECOND'))return 'TIMESTAMP_MS';
    if(arrow.includes('<SECOND>'))return 'TIMESTAMP_S';
    return 'TIMESTAMP';
  }
  if(arrow.startsWith('Time'))return 'TIME';
  if(arrow.startsWith('Interval'))return 'INTERVAL';
  if(arrow.startsWith('List<'))return sqlType(arrow.slice(5,-1))+'[]';
  if(arrow.startsWith('Struct<'))return 'STRUCT';
  if(arrow.startsWith('Map<'))return 'MAP';
  return Object.hasOwn(sqlNames,arrow)?sqlNames[arrow]:arrow;
}
// Arrow Decimal128 is a signed, little-endian sequence of 32-bit words.
// Render from the integer coefficient so neither scale nor significant digits are lost.
function decimalText(words:Uint32Array,scale:number):string{
  let value=0n;
  for(let i=words.length-1;i>=0;--i)value=(value<<32n)|BigInt(words[i]);
  value=BigInt.asIntN(words.length*32,value);
  const digits=(value<0n?-value:value).toString().padStart(scale+1,'0');
  return (value<0n?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
export function resultSet(table:ArrowTable,limit=Infinity):ResultSet{
  const vectors=table.schema.fields.map((field,i)=>{
    const vector=table.getChildAt(i);
    // DuckDB's exported field metadata can conflate duplicate names; the
    // positional vector still has the correct physical type and scale.
    const type=vector?.type??field.type,arrow=String(type);
    return {vector,column:{name:field.name,type:sqlType(arrow,type)},scale:arrow.startsWith('Decimal[')?type.scale:undefined};
  });
  const columns=vectors.map(v=>v.column);
  return {columns,rowCount:table.numRows,rows:Array.from({length:Math.min(table.numRows,limit)},(_,i)=>vectors.map(({vector,scale,column:{type}})=>{
    const x=vector?.get(i);if(x==null)return null;
    if(scale!==undefined&&x instanceof Uint32Array)return decimalText(x,scale);
    if(type==='DATE'||type.startsWith('TIMESTAMP'))return new Date(Number(x)).toISOString();
    return typeof x==='object'?String(x):x as Cell;
  }))};
}
// Each invocation of fresh starts with just the dataset. A state probe runs on the
// same connection as its mutation, not on a third, accidentally pristine database.
export async function checkExercise(ex:Exercise,sql:string,fresh:(statement:string,probe?:string)=>Promise<ResultSet>){
  const probe=ex.check.mode==='state'?ex.check.query:undefined;
  const actual=await fresh(sql,probe);
  let expected:ResultSet;
  try{expected=await fresh(ex.solution,probe)}catch{throw Error('參考結果未能產生，請檢查教材設定。')}
  return {actual,verdict:gradeSql(actual,expected,ex.check)};
}
