---
id: bd-lake-02
module: bd-lake
order: 2
title: Iceberg 快照
subtitle: 指定昨天的版本查一次
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-01
objectives:
  - 讀取 Iceberg 快照清單並取得快照 ID
  - 以同一個彙總核對目前與更正前版本
tags:
  - Iceberg
  - 快照
  - 時間旅行
  - 快照保留
resources:
  - title: Apache Iceberg：Spark 查詢
    url: https://iceberg.apache.org/docs/latest/spark-queries/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Time Travel 與 snapshots 元數據表。
  - title: Apache Iceberg：Spark 快速入門
    url: https://iceberg.apache.org/spark-quickstart/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看本機 Hadoop 目錄與對應引擎依賴。
concepts:
  - id: bd-lake-02-snapshot
    prompt: 快照 ID 和業務日期有什麼不同？
    answer: ID 定位表的已提交狀態；業務日是列上的時間，可在不同快照重複出現。
    mcq:
      options:
        - ID 就是營業日
        - ID 等於最新的訂單號
        - 同一營業日可存在多個快照
        - ID 是檔名的排序
      answer: 2
      explain: 補數會改變同一營業日的內容，因此不能用日期代替版本。
  - id: bd-lake-02-asof
    prompt: 要重現昨日已發出的報表，應固定什麼？
    answer: 固定輸入的快照 ID、查詢與參數；若依賴其他表，也要固定相應版本。
    mcq:
      options:
        - 只固定欄名
        - 每次讀目前版本
        - 只保存查詢耗時
        - 固定查詢、輸入快照與參數
      answer: 3
      explain: 同樣查詢可能因輸入版本或參數改變而有不同結果。
    interview:
      question: 讓你調查昨天和今天的金額為什麼差 15，你先做什麼？
      points:
        - 比較同口徑不同快照
        - 核對逐鍵差異
        - 提到版本保留
      answer: 我會找兩次輸入的快照 ID，用同一營業日、同一口徑重算，再逐訂單找那 15 元的差異。若舊快照過期，我會說無法從現表直接重現，改查保存的輸出或備份。
  - id: bd-lake-02-rollback
    prompt: 讀舊快照會回復目前表嗎？
    answer: 不會，時間旅行只是讀取；回退是改變表目前指標的另一個動作。
    mcq:
      options:
        - 不會，只是切換本次讀取版本
        - 會，所有讀者立即看舊版
        - 會，並刪除後續檔
        - 只要使用了 SUM 就會
      answer: 0
      explain: 讀取不改表；不要為了對帳把共用表回退。
  - id: bd-lake-02-retention
    prompt: 只保存快照 ID，保證 90 天後能查到原報表嗎？
    answer: 不保證；還要保留可讀快照、所需檔案與查詢參數。
practice:
  - id: bd-lake-02-p1
    kind: hands-on
    title: 保存更正前後的金額證據
    minutes: 14
    steps:
      - 執行 snapshots.py，把 old_id 及兩個總額記入 snapshots-note.md。
      - 用輸出的 latest_id 再查一次，寫下結果與預測。
    checks:
      - 舊版 100 元，目前 115 元，最新 ID 的查詢同為 115 元。
      - 記錄說明這是 WSL 2 本機目錄，不是物件儲存故障測試。
---

## 更正後，還能解釋昨天寄出的數字嗎？

門市早上寄出 100 元的日報，下午補一筆 15 元。只查現在的表會得到 115 元，不能回答「早上怎麼算」。時間旅行（time travel）讓查詢指定仍受保留的快照，沿它指向的清單選檔；選的是表的提交狀態，不是訂單的營業日，也不是多複製一張完整的表。兩個版本可以共用未變更的檔案，因此也不能按照檔案日期自行拼出舊版。

## 真正建一次本機 Iceberg 表

在 Windows 用 WSL 2 Ubuntu，從 `C:\dev\conduit-lab\lake` 對應的 `/mnt/c/dev/conduit-lab/lake` 執行。需要 Spark 4.1.x（建議 4.1.4；沿用[〈本機 Spark 與工作階段〉](#/lesson/bd-spark-01)的本機模式觀念）、JDK 21、Python 3.11 以上 和 4 GB 可用 RAM；Spark 與 Iceberg 的相依組合固定在插件支援的 Spark 4.1／Scala 2.13／Iceberg 1.12.0。先確認 WSL 內 `spark-submit --version` 與 `java -version`，不要把 Windows 的 Java 版本當成 WSL 的。初次提交需要連到 Maven 下載對應套件。不開 HDFS 或遠端伺服器；暫存目錄會自動清除。

存為 `snapshots.py`。這個 Python 範例內的 SQL 是 Spark + Iceberg 方言，不貼到本課的 DuckDB 編輯器。`.snapshots` 是元數據表，`VERSION AS OF` 是這個組合可用的指定版本寫法。

```python
from tempfile import TemporaryDirectory
from pyspark.sql import SparkSession

with TemporaryDirectory(prefix="conduit-snapshots-") as warehouse:
    spark = (SparkSession.builder
             .config("spark.sql.catalog.lab", "org.apache.iceberg.spark.SparkCatalog")
             .config("spark.sql.catalog.lab.type", "hadoop")
             .config("spark.sql.catalog.lab.warehouse", f"file://{warehouse}")
             .getOrCreate())
    try:
        spark.sql("CREATE NAMESPACE lab.demo")
        spark.sql("CREATE TABLE lab.demo.sales (id INT, amount INT) USING iceberg")
        spark.sql("INSERT INTO lab.demo.sales VALUES (1, 100)")
        old_id = spark.table("lab.demo.sales.snapshots").first().snapshot_id
        spark.sql("INSERT INTO lab.demo.sales VALUES (2, 15)")
        latest_id = spark.table("lab.demo.sales.snapshots").filter(f"parent_id = {old_id}").first().snapshot_id
        old = spark.sql(
            f"SELECT SUM(amount) FROM lab.demo.sales VERSION AS OF {old_id}"
        ).first()[0]
        current = spark.sql("SELECT SUM(amount) FROM lab.demo.sales").first()[0]
        print("snapshot", old_id, "old", old, "current", current, "latest_id", latest_id)
        assert (old, current) == (100, 115)
    finally:
        spark.stop()
```

```bash
spark-submit --master 'local[2]' --driver-memory 2g   --packages org.apache.iceberg:iceberg-spark-runtime-4.1_2.13:1.12.0   snapshots.py
```

若加入多個提交，請用快照的父子關係或確切選中的 ID，而不是用 ID 數值大小判定前後。沒有 Spark 時可先根據上一堂的可見清單手算：舊快照指向 100 元，新版再加 15 元；手算不能證明實際連接器能讀表。

## 把對帳線索留在快照 ID 旁邊

這個工作目錄是暫存倉，程式離開後就刪除。印出的快照 ID 是本次執行的證據，不是下次啟動還能查的永久網址；要比較最新 ID，在 `spark.stop()` 前把版本查詢改成用 `latest_id`，和目前表對照。真實日報應記錄本次計算使用的持久表名、快照 ID、查詢版本、營業日範圍與時區。若報表同時用到有歷史的折扣表，也要固定折扣版本：只固定訂單仍可能隨折扣更正而變動。

假如 100 與 115 是你真的跑到的兩個數字，下一步不要只交差額 15；逐訂單核對是新來一筆 15、同鍵更正 15，或兩種更正碰巧抵銷。這堂的差異是新增一筆而非更新既有列。版本可讀只是重現的必要條件；想完全重現當時畫面，還要把營業日、時區及口徑帶回去。若稽核要求保存 90 天，就不能只給舊版 7 天；也可保存獨立的已發報表副本，但它不替代逐鍵查證。需要根據欄名讀更早的檔案時，之後在[〈結構與分區演進〉](#/lesson/bd-lake-03)細講。

倘若舊表已過期，先記下找過的表名與版本，查當時輸出的存檔或備份；目前金額不能回推早班到底用了哪些輸入。這也是為何保存策略應跟報表的使用期限經常對照。

## 常見錯誤
- 昨日快照讀不回來 → 版本已過期 → 在設定保留窗前確認稽核期限。
- 為了查舊額把目前表回退 → 把讀取當成狀態變更 → 改用指定版本查詢。
- 表讀出兩個數字就認定計算無誤 → 尚未核對口徑 → 固定同一彙總與所有輸入版本。
