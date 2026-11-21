import {inspect,source,diagnostics,contentOptions} from './content.mjs';
import {executeSqlChecks} from './sql-content.mjs';
const args=process.argv.slice(2),src=source(args),report=inspect(src,contentOptions(args));
if(!args.includes('--no-sql'))await executeSqlChecks(report);
diagnostics(report);
console.log('內容來源：'+src+'；'+report.index.counts.lessons+' 堂課、'+report.sql.datasets.length+' 個數據集、'+report.sql.exercises.length+' 道 SQL 題。');
if(report.errors.length)process.exitCode=1;
