---
module: "bd-spark"
id: "bd-spark-05"
order: 5
title: "Job 與 Stage"
subtitle: "在哪個邊界必須搬數據"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-04"
objectives:
  - "用 DAG 與 UI 把 Job 切成 Shuffle 前後的 Stage"
  - "指出 Exchange 與任務讀寫交換數據的關係"
tags:
  - "DAG"
  - "job"
  - "stage"
  - "Exchange"
resources:
  - title: "Spark Cluster Mode Overview"
    url: "https://spark.apache.org/docs/latest/cluster-overview.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "讀 Job、Stage、Task 三個定義。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "在 Stages 讀 Shuffle Read 與 Shuffle Write。"
concepts:
  - id: "bd-spark-05-boundary"
    prompt: "窄相依與寬相依如何影響 Stage 切分？"
    answer: "窄相依的運算通常能在同階段串接；需重分配時，通常以 Shuffle 把產生端和消費端切開。"
    mcq:
      question: "哪種計畫節點最直接提示分區間要重新分配？"
      options:
        - "Filter"
        - "Project"
        - "Shuffle Exchange"
        - "Range"
      answer: 2
      explain: "過濾與投影通常可在原分區做；Shuffle Exchange 會重新分配。"
  - id: "bd-spark-05-job"
    prompt: "動作和 Job 數為何不是永遠一對一？"
    answer: "動作需要執行結果，但廣播、子查詢或 AQE 等細節可能產生多個 Job。"
    mcq:
      question: "一個 show 出現不只一個 Job，怎樣理解？"
      options:
        - "不代表你寫了多個動作；檢查實體計畫和 UI"
        - "所有轉換其實都立即執行"
        - "程式一定重複啟動"
        - "有幾個 Job 就有幾台機器"
      answer: 0
      explain: "工作個數受引擎策略和取樣影響，不能直接映射到程式行數或機器數。"
    interview:
      question: "Spark UI 顯示 Stage 很多，如何找最值得看的邊界？"
      points:
        - "用 SQL 計畫對上 Exchange"
        - "比較各階段讀寫量與耗時"
        - "查是不是小量可避免的交換或不可避免的鍵合流"
      answer: "我先對上 SQL 計畫和 Stage，找出有明顯 Shuffle 讀寫的邊界，再看是否切了不必要的全域排序或能先聚合。但如果同鍵原本散開，正確計算本身就可能需要交換。"
  - id: "bd-spark-05-dag"
    prompt: "DAG 描述的是什麼？"
    answer: "描述要完成輸出時，各步驟或階段對前序輸出的相依關係。"
  - id: "bd-spark-05-metrics"
    prompt: "上游寫 Shuffle 和下游讀 Shuffle 是同一個觀察點嗎？"
    answer: "不是；它們分別位於生產與消費交換數據的階段。"
    mcq:
      question: "想定位下游分區是不是特別重，先看什麼？"
      options:
        - "上游程式行數"
        - "應用名稱"
        - "計畫中的表別名"
        - "下游各 Task 的 Shuffle Read"
      answer: 3
      explain: "負載離群要在同階段逐任務比較，而不是只看整批總量。"
practice:
  - id: "bd-spark-05-lab"
    kind: "hands-on"
    title: "標記一個交換邊界"
    minutes: 10
    steps:
      - "在 WSL 的 bd-spark 執行 stages_lab.py"
      - "保存計畫與 Spark UI 的相應階段"
      - "圈出一個有 Shuffle Write 與一個有 Shuffle Read 的階段"
    checks:
      - "按鍵彙總每鍵得 30 列"
      - "可在圖上畫出部分聚合、Exchange、最終聚合的方向"
---

## 不是每一行都開一個階段

在每一份訂單只留下必要欄、過濾和加減欄值，通常可以在同一份數據一路做完。不必等別份數據，稱窄相依（narrow dependency）：一個下游分區只依賴少量且固定關聯的上游分區，各上游分區通常不必把同一份結果散給許多下游。當我們要依會員做全量小計，分散在各處的同鍵得碰面，通常形成寬相依（wide dependency）與一次 Shuffle。上游先產生交換輸出，下游才能按新的分區讀取。

![Stage 邊界在需要交換的地方，不是每一行程式](assets/bd-spark-stages.svg)

Spark 把完成某次計算所需的相依關係排成有向無環圖（directed acyclic graph，DAG）。Job 是一次由執行需求觸發的作業；它由若干相依的 Stage 組成。Stage 內的 Task 針對不同分區做同一段工作。兩個階段可因交換形成前後依賴；不同分支的 Stage 也可能各自準備，並非符合一條固定長度的線。一次動作可能涉及多個 Job，不用靠數程式行判這三層。

## 把計畫上的 Exchange 對到 UI

在 WSL 的 `bd-spark` 存 `stages_lab.py`，執行 `.venv/bin/python stages_lab.py`，預留 3 GB RAM。這輪關掉自適應查詢執行（AQE；執行中依統計改計畫，見[第 9 堂](#/lesson/bd-spark-09)），讓邊界容易對照。程式只取 4 列小計。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Shuffle Stage")
try:
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    source = spark.range(0, 120, 1, 4)
    keyed = source.select((F.col("id") % 4).alias("user_id"))
    totals = keyed.groupBy("user_id").count()
    totals.explain("formatted")
    print(sorted((row.user_id, row["count"]) for row in totals.collect()))
    print(spark.sparkContext.uiWebUrl)
    input("Compare the plan with Stages, then press Enter: ")
finally:
    spark.stop()
```

應有 4 個會員鍵各 30 列。先在計畫找部分聚合、`Exchange`、最終聚合，再到 UI 看哪一個 Stage 寫 Shuffle、哪一個讀。即使在單機，分區間仍要重新安排數據；不能把每個 Exchange 都解讀成跨機位元組。若計畫看到 `BroadcastExchange`，那是另一種搬運，不能和此處按鍵 Shuffle 一概而論。

### 看交換的「方向」，再看有多重

將圖上的箭頭先用一句話讀出來：每個上游可先在自己的數據裡找相同會員，產生局部小計；同一會員因此仍可能在數份局部結果出現。分區接收方等到交換輸出準備好，再把屬於自己的鍵合完。如果在聚合前保留了一個其實用不到的大字串欄，中間數據可能會比只需小計時大。物理計畫可以告訴你這個欄是否真的還在交換邊界，不能只從原本程式碼判斷。

量效能時，可先問三件事：交換後分區大小是否均衡、數據是否溢寫、最慢任務是搬運還是計算。把它們對到同一個階段和同一批輸入，才能比改動前後。若某個階段還在等上游寫好，並不是已分配的任務一直在全速運算。查單一階段時間不夠時就回到工作的相依圖，沿真正卡住的路徑往前找。

不做彙總的替代對照是先只選鍵並做逐列轉換，保留數據切法。和有全域按鍵小計的程式相比，這次不需要把同鍵放在一起；可用來查出哪個需求讓交換變必要。

## 常見錯誤

- filter、select 各算一個 Stage → 沒有交換依賴可在一段串接 → 以計畫和 UI 為準。
- Stage 多就認為一定慢 → 忽略搬運量與等待 → 量最重階段再決策。
- 按總秒數猜長尾 → 不知道是哪一段 → 先圈出交換讀寫，再點 Task 明細。
