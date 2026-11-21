import {Info} from 'lucide-react';
import type {LabNote} from '../../content/types';

const toolNames=new Map(Object.entries({
  wsl:'WSL 2 Ubuntu', docker:'Docker', vmstat:'vmstat', curl:'curl.exe', pandas:'pandas',
  'jdk-17':'JDK 17', 'jdk-21':'JDK 21', 'jdk-25':'JDK 25', maven:'Maven', junit:'JUnit',
  hive:'Hive', spark:'Spark', iceberg:'Iceberg', 'duckdb-cli':'DuckDB CLI',
  kafka:'Kafka', flink:'Flink', clickhouse:'ClickHouse', airflow:'Airflow', dolphinscheduler:'DolphinScheduler',
  datax:'DataX', seatunnel:'SeaTunnel', sqoop:'Sqoop', debezium:'Debezium', canal:'Canal', 'dbt-cli':'dbt CLI',
  postgresql:'PostgreSQL', mysql:'MySQL', 'cloud-console':'雲端主控台', bigquery:'BigQuery',
  snowflake:'Snowflake', redshift:'Redshift', dataworks:'DataWorks', maxcompute:'MaxCompute',
  databricks:'Databricks', delta:'Delta Lake', kubernetes:'Kubernetes'
}));

export default function LabNotice({lab}:{lab?:LabNote}){
  if(!lab)return null;
  const tools=lab.tools.map(tool=>toolNames.get(tool)??tool).join('、');
  return <aside className="lab-notice" aria-label="實驗驗證範圍">
    <div><Info size={16} aria-hidden="true"/><strong>實驗驗證範圍</strong></div>
    <p>這堂的本機實驗依官方文件撰寫，編寫環境未能實際執行（{tools}）。若版本或輸出不同，以官方文件為準，並把差異記在練習筆記。</p>
    <small>{lab.note}</small>
  </aside>;
}
