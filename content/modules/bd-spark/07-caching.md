---
module: "bd-spark"
id: "bd-spark-07"
order: 7
title: "快取與持久化"
subtitle: "只留下真的會重用的結果"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-06"
objectives:
  - "物化一份可重用的 DataFrame 並找到 Storage 記錄"
  - "釋放快取後確認結果不變"
tags:
  - "cache"
  - "persist"
  - "unpersist"
  - "Storage"
resources:
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Caching Data，對照計畫和記憶體取捨。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "讀 Storage Tab 與已持久化的分區。"
concepts:
  - id: "bd-spark-07-materialize"
    prompt: "呼叫 cache 後為何 Storage 不一定立刻有內容？"
    answer: "cache 標記持久化，一般要後續動作實際計算才把分區存起來。"
    mcq:
      question: "只呼叫 cache，未做任何動作，能確定什麼？"
      options:
        - "已要求快取，但還沒證明分區已算完"
        - "全部已寫成數倉表"
        - "未來任何查詢都不會再掃"
        - "應用重啟也能讀到"
      answer: 0
      explain: "標記不等於物化；快取也不是耐久輸出。"
  - id: "bd-spark-07-reuse"
    prompt: "什麼樣的中間結果比較值得快取？"
    answer: "多次重用、重算成本高、可在資源限制下容納，且不用長期持有。"
    mcq:
      question: "同一份清洗昂貴、接下來有 3 個報表重用。較合理做法是？"
      options:
        - "快取每一張原始表"
        - "永不釋放已快取結果"
        - "快取共用清洗結果並用完釋放"
        - "把不可重用的末端輸出全快取"
      answer: 2
      explain: "快取放在共用結果才可能省下重算，使用完可回收資源。"
    interview:
      question: "怎麼證明 cache 幫到了第二個查詢？"
      points:
        - "確認首次動作物化"
        - "讀 Storage 或 InMemoryTableScan"
        - "核對結果和多次同條件的計時"
      answer: "我先讓第一個動作填滿想重用的分區，再驗第二個計畫是否從快取讀。只比首次和第二次秒數會混進 JVM 暖機，我會分開記證據和計時。"
  - id: "bd-spark-07-release"
    prompt: "unpersist() 是否刪除原始數據？"
    answer: "不刪來源，只移除這份計畫的持久化結果；之後可能依原計畫重算。"
practice:
  - id: "bd-spark-07-lab"
    kind: "hands-on"
    title: "保留物化、重用、釋放三個時點"
    minutes: 10
    steps:
      - "在 bd-spark 執行 cache_lab.py"
      - "第一個提示在 Storage 記下已快取的分區"
      - "從計畫找 InMemoryTableScan，第二個提示再看已釋放"
    checks:
      - "兩次使用快取與釋放後皆為 10000 列，total 為 99990000"
      - "釋放前後的 Storage 記錄不同"
---

## 重用才值得留下

每天要從同一份清洗後的訂單產生金額總表、即時值班摘要和異常追查。若共用清洗結果很貴，三次都重新掃描不合算。快取（cache）保留已算出的分區；持久化（persistence）在 Spark 語境中是將中間結果保留於指定儲存等級（storage level），例如記憶體不足時可使用磁碟。兩者都不是把數據發布到數據倉庫，也不保證重啟後還在。

`cache()` 選預設儲存等級；`persist(level)` 可指定；`unpersist(blocking=True)` 釋放並等移除完成。標記快取不等於算完所有分區，等動作物化（materialize，真的算出內容）後再確認。若只有小範圍的動作，未必觸及全部分區。快取的代價不只占記憶體：還有第一次填入、可能的磁碟占用，以及移除後重新計算。輸入只讀一次時通常不用快取。

## 看見儲存與計畫的變化

在 WSL `bd-spark` 存 `cache_lab.py`，執行 `.venv/bin/python cache_lab.py`，預留 3 GB RAM。本堂只證明用了快取，不以小數據承諾速度收益。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Cache Lifecycle")
try:
    clean = spark.range(0, 10000, 1, 4).select(
        "id", (F.col("id") * 2).alias("amount"))
    clean.cache()
    def audit():
        return clean.agg(F.count("*").alias("rows_n"), F.sum("amount").alias("total"))
    expected = (10000, 99990000)
    assert tuple(audit().first()) == expected
    print(spark.sparkContext.uiWebUrl, expected)
    input("Inspect Storage after materialization: ")
    again = audit()
    again.explain("formatted")
    print(tuple(again.first()))
    clean.unpersist(blocking=True)
    print(tuple(audit().first()))
    input("Inspect Storage after release: ")
finally:
    spark.stop()
```

兩次檢查點中間的計畫應有 `InMemoryTableScan` 或對應快取掃描；釋放後仍可依原計畫算出相同值。此例先核對總額，不以快取存在取代結果驗證。量真實節省時將填入成本與重用分開，還要看是否擠掉原本更需要的快取。

### 一次掃描的成本，和重用的成本

如果同一中間結果只被一個報表讀一次，可以直接讓計畫選出所需欄並過濾。多加快取，反而要額外把中間數據存下來。若三份報表都從已清洗的當日分區出發，清洗是固定且較昂貴的工作，才值得比較「各做三次」與「先做一次再讀三次」。比較也要包含第一次填入，不可只取快取變熱後的時間當改善幅度。

先以自己需要的欄與日期縮小要保留的數據。若你先把全年全欄存起來，再從中選昨天，快取空間和掃描歷史成本可能掩蓋好處。若真正會重用的範圍很小，把穩定可共享的清洗步驟放在快取前，報表專用的過濾則留在它後面再做。選擇哪個節點以三份報表共同所需為準。

應用跑了幾小時後，有些分區可能因資源壓力移出，之後再算或改從磁碟讀。到 Storage 查居住狀態，而不是看到程式碼還有 `cache()` 就當記憶體一定充足。若幾個不同的批次要穩定重用同一結果，應考慮正式中間表和版本管理，而非要求某個 Spark 應用永不關閉。

本例的檢查刻意用同一聚合且驗讀回值；若下次比較的查詢改用不同分組或日期，先恢復等價輸入，避免把查詢本身的改變誤判成快取效果。

## 常見錯誤

- 只寫 cache 就要看完整的 Storage → 尚未物化 → 跑會涵蓋所需分區的動作。
- 第一輪慢、第二輪快就宣布加速倍數 → 暖機或其他快取可能影響 → 查計畫並重複對照。
- 長時間保留不再用的結果 → 把記憶體借給過去的工作 → 用完 unpersist。
