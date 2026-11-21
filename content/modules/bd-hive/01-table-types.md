---
module: "bd-hive"
id: "bd-hive-01"
order: 1
title: "內外部表與目錄"
subtitle: "刪表前先確認誰擁有檔案"
minutes: 30
level: 2
status: "ready"
prereqs: []
objectives:
  - "從表定義判讀表型別和檔案位置"
  - "在隔離資料夾刪除練習表並確認檔案去留"
tags:
  - "managed table"
  - "external table"
  - "Metastore"
  - "LOCATION"
resources:
  - title: "Hive DDL Manual"
    url: "https://hive.apache.org/docs/latest/language/languagemanual-ddl/"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "對照內部表、外部表與刪表的檔案行為。"
  - title: "Spark Hive Tables"
    url: "https://spark.apache.org/docs/latest/sql-data-sources-hive-tables.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "讀本機 Metastore 與數倉目錄如何建立。"
  - title: "PySpark Installation"
    url: "https://spark.apache.org/docs/latest/api/python/getting_started/install.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "確認本機 PySpark 的 Python 和 Java 需求。"
concepts:
  - id: "bd-hive-01-owner"
    prompt: "內部表與外部表的差異首先該問什麼？"
    answer: "問誰負責數據檔案的生命週期，而非表放在什麼磁碟。"
    mcq:
      question: "一般 Hive 外部表未啟用清除設定，DROP TABLE 預期改變什麼？"
      options:
        - "原地刪除所有數據檔"
        - "先移除目錄的表定義，不刪底層檔"
        - "移轉檔案給其他表"
        - "只清空欄名但留下表"
      answer: 1
      explain: "一般外部表保留檔；仍要查清除設定及表格式例外。"
  - id: "bd-hive-01-catalog"
    prompt: "中繼目錄與 Parquet 檔分別留著什麼？"
    answer: "目錄保存表結構、位置等描述；檔案保存查詢要讀的記錄。"
    mcq:
      question: "另一個服務已持有數據檔，你只要用表名查它，先確認哪一項？"
      options:
        - "表名有沒有含日期"
        - "是否由較快的磁碟讀"
        - "表格共有幾欄"
        - "位置與刪表是否會清理檔案"
      answer: 3
      explain: "檔案由誰管理是刪表安全邊界；表名、磁碟速度、欄數都不能證明。"
    interview:
      question: "接手舊 Hive 表，要刪前查什麼？"
      points:
        - "看 Type、Location、表屬性及格式"
        - "確認下游與檔案擁有人"
        - "用隔離副本試刪"
      answer: "我用 DESCRIBE FORMATTED 查類型與位置，再核對 purge 屬性及表格式。若目錄被多人使用，先確認下游與所有權；只在隔離副本演練。"
  - id: "bd-hive-01-sandbox"
    prompt: "DuckDB 建表題能證明 Hive 刪表會保留檔案嗎？"
    answer: "不能；它只驗表結構或查詢，檔案生命週期要在實際 Hive 或明示的 Spark 目錄環境查證。"
  - id: "bd-hive-01-purge"
    prompt: "為什麼外部表刪除前也要檢查表屬性？"
    answer: "某些清除設定、引擎或表格式可能讓刪除表定義同時清理底層檔。"
    mcq:
      question: "看到 Type 是 EXTERNAL，下面哪一項還要查？"
      options:
        - "表格式、清除屬性與共用路徑"
        - "表名用了幾個字"
        - "金額欄的平均值"
        - "有幾列取消訂單"
      answer: 0
      explain: "EXTERNAL 只是第一個訊號；數據生命週期仍需核對設定與擁有人。"
practice:
  - id: "bd-hive-01-lab"
    kind: "hands-on"
    title: "留下刪表前後的檔案清單"
    minutes: 13
    steps:
      - "在 WSL 按正文建立專用 PySpark 環境與表目錄"
      - "執行 layout.sql 並記下兩個表的 Type 和 Location"
      - "用 find 列出刪表後剩餘的 Parquet 檔"
    checks:
      - "練習內部表檔案不再可見"
      - "external_seed 仍有原始 Parquet 檔"
  - id: "bd-hive-01-p1"
    kind: "sql"
    category: [ddl]
    title: "建立已付款訂單快照表"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "以 `orders` 中 `status = 'paid'` 的列建立 `lab_paid_snapshot`。新表欄位依序為整數 `order_id`、日期 `order_date`。題目檢查新表內容：所有已付款訂單各一列，按 `order_id` 由小到大核對。不要改來源表。"
    solution: |
      CREATE TABLE lab_paid_snapshot AS
      SELECT order_id, order_date FROM orders WHERE status = 'paid';
    explain: "以查詢建立表（CTAS）把選出的內容存下。`CREATE VIEW` 只存定義，本題會檢查物件是不是表，仍不能驗證實體檔案；Hive/Spark 的表所有權由各自目錄和表設定決定。"
    hints:
      - "先把篩選兩欄的 SELECT 單獨跑通"
      - "用 CREATE TABLE 表名 AS 接查詢"
    check:
      ordered: true
      columnNames: true
      mode: "state"
      query: |
        SELECT order_id, order_date FROM lab_paid_snapshot
        WHERE typeof(order_id) = 'INTEGER' AND typeof(order_date) = 'DATE'
          AND EXISTS (SELECT 1 FROM information_schema.tables
                      WHERE table_name = 'lab_paid_snapshot' AND table_type = 'BASE TABLE')
        ORDER BY order_id;
      allowEmpty: false
    concepts:
      - "bd-hive-01-catalog"
      - "sq-read-02-filter"
    tags:
      - "CTAS"
      - "快照表"
  - id: "bd-hive-01-p2"
    kind: "sql"
    category: [aggregate]
    title: "盤點來源訂單狀態"
    minutes: 4
    level: 2
    dataset: "shop"
    prompt: "在 `orders` 中每個狀態一列。輸出 `status`、`order_count`（該狀態全部訂單數），欄名與欄序照此，按 `status` 升序。"
    solution: "SELECT status, COUNT(*) AS order_count FROM orders GROUP BY status ORDER BY status;"
    explain: "來源盤點包括取消單；套用快照的付款篩選會漏掉要對照的狀態。同一個查詢可用於 Hive SQL。"
    hints:
      - "分組依據是狀態，而非日期"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-01-catalog"
      - "sq-group-03-key"
    tags:
      - "來源盤點"
---

## 表名不是檔案擁有權

上游依約把原始訂單檔放在共享目錄，分析師給它一個容易查的表名；另一張報表表是分析師自己寫出的。兩張表都能 `SELECT`，但刪除時的責任不同。Hive 是用表與 SQL 讀取數倉檔案的系統。中繼目錄（catalog）提供表名、欄型別和位置；Hive Metastore（中繼數據服務）保存並提供這些描述，而真正的列由儲存中的檔案提供。

![同一個目錄層管表定義，但兩種表有不同刪除責任](assets/bd-hive-ownership.svg)

內部表（managed table，亦稱受管理表）通常由數倉管理檔案生命週期；一般外部表（external table）只把表描述接到外部數據位置，`DROP TABLE` 通常只移除表定義。不要憑這句就刪共享表：Hive 的 `external.table.purge` 等屬性及表格式整合可能改變清除行為，目錄也可能被別人直接讀。先查 `DESCRIBE FORMATTED` 的類型、位置和屬性。

## 用本機目錄觀察，不開 Hive 服務

以下是 **Spark SQL 的 Hive-style 目錄實驗**，不是 Hive 4 伺服器。Spark 本機模式加內嵌 Derby 中繼庫，不用另起 HDFS、Tez 或 HiveServer2；用於觀察檔案責任比整套服務省資源。在 WSL 2 Ubuntu，這堂與稍後的[本機 Spark 課](#/lesson/bd-spark-01)使用相同版本：Spark 4.3.0、JDK 21、Python 3.11 以上及 `venv`，`java -version` 應顯示所選 JDK，`JAVA_HOME` 指向該 JDK 根目錄。練習預留 3 GB RAM，不與其他大數據服務同跑。下列 `python3` 需符合版本；若不同，先用已安裝且符合版本的直譯器建立虛擬環境。

若尚未準備環境，Ubuntu 24.04 可用 `sudo apt update` 後由學習者執行 `sudo apt install python3-venv openjdk-21-jdk`。這是一次性的 Ubuntu 套件安裝；已裝相容版本就跳過。若電腦有多個 JDK，先用 `update-alternatives --list javac` 找到 21 或 17 的完整路徑，將 `JAVA_HOME` 設成該路徑拿掉結尾的 `/bin/javac`，再用 `"$JAVA_HOME/bin/java" -version` 確認。此設定至少要在執行練習的同一個終端生效。

```bash
mkdir -p /mnt/c/dev/conduit-lab/bd-hive
cd /mnt/c/dev/conduit-lab/bd-hive
python3 -m venv .venv
.venv/bin/python -m pip install pyspark==4.3.0
```

若練習檔在 D 槽，把 `/mnt/c` 換成 `/mnt/d`（實際路徑不留空格）。將下列存為本資料夾的 `hive_lab.py`，後續 Hive 實驗共用。這個小讀取器只適用課內 SQL（不處理字串內的分號）。
```python
from pathlib import Path
import sys
from pyspark.sql import SparkSession

root = Path.cwd().as_uri()
spark = (SparkSession.builder.master("local[2]").appName("Conduit Hive Lab")
         .config("spark.sql.warehouse.dir", root + "/warehouse")
         .config("spark.sql.shuffle.partitions", "4")
         .enableHiveSupport().getOrCreate())
try:
    sql = Path(sys.argv[1]).read_text(encoding="utf-8").replace("{{ROOT}}", root)
    for item in sql.split(";"):
        if item.strip():
            spark.sql(item.strip()).show(truncate=False)
finally:
    spark.stop()
```

**Spark SQL 語法速查**：`CREATE TABLE … USING PARQUET AS SELECT …` 建表並存結果；`LOCATION` 明指定檔案位置；`DESCRIBE EXTENDED` 可看 Type 與 Location；`DROP TABLE` 移除表。這和 Hive 的 `CREATE EXTERNAL TABLE … STORED AS PARQUET LOCATION …` 不是同一種拼法。只在剛建好的練習空間，將以下存為 `layout.sql`：
```spark-sql
CREATE TABLE lab_managed USING PARQUET AS SELECT 101 AS order_id;
CREATE TABLE lab_external USING PARQUET LOCATION '{{ROOT}}/external_seed'
AS SELECT 101 AS order_id;
DESCRIBE EXTENDED lab_managed;
DESCRIBE EXTENDED lab_external;
DROP TABLE lab_managed;
DROP TABLE lab_external;
```

在同一資料夾執行 `.venv/bin/python hive_lab.py layout.sql`，再執行 `find warehouse external_seed -name '*.parquet'`。保留 Type 與路徑：內部表的檔案應被移除，外部位置的檔案仍在。這支腳本只做第一次；若想再演練，另開空白練習資料夾，避免用非空路徑重建外部表。第一次啟動較久，先讓它完成再開另一個應用；同一個內嵌 Derby 不適合多程序一起寫。

### 交接時註明誰可以清理

你可以在表清單加上兩欄：「刪表是否預期刪檔」與「底層路徑誰擁有」。上游持有的路徑即使只被一張表引用，也不表示分析師有權清走；另一方面，內部表的舊版本若是回復所需，不能只靠表名恢復。試把正式目錄只讀查照和本堂的試刪區分開來：正式工作先看定義與依賴，再用練習快照驗證；沒有看到完整保留策略就不動底層目錄。

記下兩個物件的檔案位置，即使表名刪除後仍可用該路徑重找。

## 常見錯誤

- 看到目錄在數倉下就當內部表 → 路徑不足以判型別 → 核對 Type 和表屬性。
- DuckDB 檢查通過就推論檔案仍在 → 檢查只有查詢結果 → 用隔離目錄看實體檔。
- 共用目錄上試刪 → 依賴及清除規則未確認 → 僅用專用的臨時表與位置。
