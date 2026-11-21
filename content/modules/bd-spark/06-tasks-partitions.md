---
module: "bd-spark"
id: "bd-spark-06"
order: 6
title: "Task 與分區數"
subtitle: "檔案數不等於核心數"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-05"
objectives:
  - "把單階段輸入分區數和對應任務數連起來"
  - "區分同時執行的槽位與任務總數"
tags:
  - "partition count"
  - "task parallelism"
  - "local slots"
  - "spark_partition_id"
resources:
  - title: "Spark Cluster Mode Overview"
    url: "https://spark.apache.org/docs/latest/cluster-overview.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "對照每個 Stage 的 Task 與分區。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "讀 Stage Detail 的任務與耗時分布。"
concepts:
  - id: "bd-spark-06-unit"
    prompt: "一個 Stage 的 Task 為何通常以分區為單位？"
    answer: "每個任務執行此階段的一份分區數據；分區可並行，但要有可用工作槽。"
    mcq:
      question: "local[2] 有 8 個該階段任務，如何完成？"
      options:
        - "必須升級為八台機器"
        - "最多同時跑兩個，其他等槽位"
        - "一個任務處理所有分區"
        - "只執行前兩個"
      answer: 1
      explain: "同時能力是 2，總工作仍有 8 個。"
  - id: "bd-spark-06-files"
    prompt: "輸入只有一個檔案，就一定只有一個 Task 嗎？"
    answer: "不一定；讀取器可能切分大檔，或合併多個小檔到同一掃描分區，要看格式和計畫。"
    mcq:
      question: "64 個小 Parquet 檔，如何確認實際掃描任務數？"
      options:
        - "取檔案數 64"
        - "取 CPU 核心數"
        - "以目錄分區數代替"
        - "讀實際掃描階段的任務數"
      answer: 3
      explain: "檔案、目錄分區、計算分區和工作槽是不同層。"
    interview:
      question: "把分區加倍會讓 Spark 一定更快嗎？"
      points:
        - "平行槽位是上限"
        - "小任務有排程成本"
        - "比較長尾與交換位元組"
      answer: "不一定。加分區可能減輕每個任務，但若工作槽位沒變，只是多幾輪排程。我會看任務耗時分布和數據量，避免把已有的小工作切得更碎。"
  - id: "bd-spark-06-output"
    prompt: "為何分區號通常不應作業務識別碼？"
    answer: "它由目前計畫分派，重分區或引擎策略變更後可能不同。"
practice:
  - id: "bd-spark-06-lab"
    kind: "hands-on"
    title: "對照 2 和 6 個輸入分區"
    minutes: 9
    steps:
      - "在同一 WSL 資料夾執行 task_lab.py"
      - "記下兩次每個分區的列數，並找到各自 Stage 的任務數"
      - "用一句話說明為何 6 個任務不會同時起跑"
    checks:
      - "都是 24 列"
      - "原輸入分區由 2 個各 12 列變為 6 個各 4 列"
---

## 工作有幾份，與能同時做幾份不同

把 24 列訂單交給兩個工作槽，可以切成 2 或 6 個計算分區。通常一個 Stage 針對每份分區安排一個任務；任務總數不是同時執行數。`local[2]` 最多同時跑 2 個工作執行緒，若接到 6 個任務便分幾輪。一次任務重試又叫一次嘗試（attempt）；看 UI 時，不要把嘗試筆數全當不同的輸入分區。

一個 Parquet 檔的數據可被劃分來平行處理，多個極小檔也可能合進同一掃描分區。這要看格式能否切分、檔案大小和讀取設定。日期目錄是儲存層的分區，讀取後仍可能用完全不同的計算分區。到了 Shuffle，下游又由交換配置決定分區，不能拿其任務數回推最初讀了幾個檔案。

## 用確定可控的輸入觀察分區

`spark.range(start, end, step, numPartitions)` 可直接控制生成的分區，右端不含。`spark_partition_id()` 可為每列標記當時運算的分區號；它不是穩定的業務鍵。本堂用它配上 `GROUP BY` 統計輸入分區，分組本身會產生一個額外的交換階段，觀察 UI 時找含 `Range` 的上游。

在 WSL `bd-spark` 存成 `task_lab.py`，執行 `.venv/bin/python task_lab.py`，預留 3 GB RAM。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Task Slots")
try:
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    for n in (2, 6):
        source = spark.range(0, 24, 1, n)
        part = source.select(F.spark_partition_id().alias("part"))
        counts = part.groupBy("part").count()
        values = sorted((r.part, r["count"]) for r in counts.collect())
        print(n, values)
        assert len(values) == n and sum(count for _, count in values) == 24
    print(spark.sparkContext.uiWebUrl)
    input("Compare the two upstream stages: ")
finally:
    spark.stop()
```

先找 `2 × 12`，再找 `6 × 4`。邏輯輸入相同，只變切法；程式執行的先後也有暖機差異，不能從這個微型例子挑生產分區數。若真實工作多數分區極小，任務啟動、交換與寫檔的固定成本會相對高；若有一份極大，則先判斷是熱鍵還是整體分區太少。

### 數分區的順序

記錄時先留兩個欄：來源見到的分區數與處理它的 Stage。然後再記下一輪下游交換的分區數；本例下游分組預設另有 4 個交換分區，不能因輸入是 2 或 6 就猜下游同樣多。實際操作先在 SQL 頁定位含 `Range` 的分支，確認它和你正在看的 Stage 是同一次計算，再打開任務明細。

若要交給同事一個分區數建議，至少一起交代輸入大小、每任務典型工作量、長尾和可用資源。例如 6 個相近大小的任務在 2 個槽上大致分三輪；若改成 2 個，一輪雖少但每個任務更重。「更少輪」與「更短時間」之間還隔著每個任務的固定成本和實際讀取量，不能只靠一個算式決定。

檔案讀取則另有一組限制。壓縮後不可分割的一個大文本檔可能難以並行，而大型欄式檔能否切分受到格式與讀取器支援。先看掃描任務，而不是照平均每檔一個去排整個工作。若觀察到少數任務特別重，先分辨是檔案形狀、某一個鍵，還是非數據因素。

將兩輪來源和下游的任務數分開保存，讓別人能重做。

## 常見錯誤

- Task 數當主機數 → 一台可以處理多個 Task → 分開看資源槽位與工作總數。
- 看見 6 個輸出任務就說 6 個來源檔 → 可能已過 Shuffle → 先找到掃描 Stage。
- 用分區號當主鍵 → 更換計畫會改路由 → 使用穩定的來源識別碼。
