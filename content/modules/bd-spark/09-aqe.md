---
module: "bd-spark"
id: "bd-spark-09"
order: 9
title: "AQE 與傾斜調校"
subtitle: "拿執行前後計畫找證據"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-08"
objectives:
  - "比較 AQE 查詢的執行前與執行後計畫"
  - "區分合併小分區與拆分過重 JOIN 分區"
tags:
  - "AQE"
  - "adaptive plan"
  - "skew join"
  - "shuffle coalesce"
resources:
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Adaptive Query Execution 的合併與傾斜連接小節。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "在 SQL 頁找執行後的實體計畫。"
concepts:
  - id: "bd-spark-09-runtime"
    prompt: "AQE 使用的資訊比初始計畫多了什麼？"
    answer: "能取得中間查詢階段的執行時統計，例如實際 Shuffle 分區大小。"
    mcq:
      question: "最能判斷 AQE 是否真的調整某查詢的是什麼？"
      options:
        - "只確認 enabled=true"
        - "比執行前與完成後計畫及任務指標"
        - "查表名有沒有日期"
        - "只看總列數"
      answer: 1
      explain: "設定表示允許，計畫與執行指標才顯示是否調整。"
  - id: "bd-spark-09-coalesce"
    prompt: "合併小分區和拆偏斜分區在解什麼？"
    answer: "前者降低太多小任務的開銷；後者把過重的連接工作拆為較小份。"
    mcq:
      question: "工作只有許多極小分區，沒有超大長尾。AQE 的哪種優化更對症？"
      options:
        - "合併 Shuffle 後的小分區"
        - "將每個分區都拆得更小"
        - "用預設字串補所有空鍵"
        - "直接略過熱鍵對應列"
      answer: 0
      explain: "題目是固定開銷，不是缺鍵或熱鍵拆分。"
    interview:
      question: "Spark 開了 AQE，熱門商品仍拖尾，你怎麼查？"
      points:
        - "對照 final plan 是否拆分"
        - "看分區大小、中位數及閾值"
        - "確認問題是支援的 JOIN 還是聚合熱鍵"
      answer: "我會對照最終計畫與慢任務讀量。可能沒跨閾值，也可能是 AQE 的 skew-join 不處理的聚合熱鍵；後者通常先看預聚合或有驗收的加鹽。"
  - id: "bd-spark-09-correctness"
    prompt: "AQE 的目標是改計算方式還是改結果？"
    answer: "改實體執行方式；用相同的數據口徑驗回傳結果不變。"
practice:
  - id: "bd-spark-09-lab"
    kind: "hands-on"
    title: "保存 AQE 的兩個計畫"
    minutes: 10
    steps:
      - "在 bd-spark 執行 aqe_lab.py"
      - "把 action 前後的 explain 與 SQL UI 記在同一份筆記"
      - "從階段比實際分區任務，不要求這個小例子觸發 skew join"
    checks:
      - "四個鍵各 200 列"
      - "可辨識初始與最終計畫，記下合併是否發生及依據"
---

## 估錯了可以在執行中調整

規劃日報時，引擎只有表的預估大小；第一段交換跑完後，才知道每個分區實際有多少數據。自適應查詢執行（adaptive query execution，AQE）可在某些查詢階段（query stage）完成後，用執行時統計調整下游計畫。這不是每列來了就重新選一次 SQL，也不改你要求的 JOIN 或聚合語意。

常見變化有三種：多個很小的 Shuffle 分區可合併，少開任務；若執行時發現某側很小，適用時可改選廣播連接；對支援的傾斜 JOIN（skew join），過重分區可拆開，必要時複製對應側的數據。判定傾斜通常同時看絕對大小與相對中位數倍數，不能因某鍵多幾列就預期會觸發。聚合單鍵過大也不能拿 JOIN 的優化當萬靈丹。

![初始計畫、執行時統計、調整後計畫](assets/bd-spark-aqe.svg)

## 用小數據看合併，不假裝量到極端傾斜

在 WSL 的 `bd-spark` 存 `aqe_lab.py`，執行 `.venv/bin/python aqe_lab.py`，預留 3 GB RAM。用過量的初始交換分區和很小的輸入觀察合併，保留執行前後計畫。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Adaptive Plan")
try:
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
    spark.conf.set("spark.sql.adaptive.coalescePartitions.parallelismFirst", "false")
    spark.conf.set("spark.sql.shuffle.partitions", "16")
    rows = spark.range(0, 800, 1, 4).select((F.col("id") % 4).alias("k"))
    report = rows.groupBy("k").count()
    print("Before:")
    report.explain()
    result = sorted((r.k, r["count"]) for r in report.collect())
    assert result == [(0, 200), (1, 200), (2, 200), (3, 200)]
    print("After:", result)
    report.explain()
    print(spark.sparkContext.uiWebUrl)
    input("Compare the final plan and SQL metrics: ")
finally:
    spark.stop()
```

完成同一個 DataFrame 的動作再看計畫，通常可看見 `AdaptiveSparkPlan` 以及已完成的計畫和合併讀取標記，名稱依版本而異；必要時查 SQL UI 的確切任務數。若沒改，記下沒有改動的實際畫面，而不是硬說一定觸發。用兩份結果核對口徑，調校目標才有意義。

### 為什麼不把所有分區都切小？

假設交換分區中位數只有 4 MiB，單一分區卻有 600 MiB。這個分區遠大於其他分區，仍要看實際的相對倍數與絕對門檻，同時確認連接類型和當前計畫支援拆分。若只是 2 MiB 對 1 MiB，即使倍數看來大，拆成許多任務的固定成本也可能高於收益。沒有中間輸出計數前，不能把鍵頻率直接換成儲存大小；窄列和寬列壓縮後大小也不相同。

本堂先收集初始計畫，再讓動作跑完，最後讀同一個計畫物件。若改成先對一份表 `count()` 再看不同的 `report`，那次工作可能不是你想看的那個查詢。到了 SQL UI 確認作業名稱、查詢時間和執行後的節點，再和終端紀錄相對。把「是否發現最終計畫」、「是否合併了小區」分成兩欄，避免用第一條代替第二條。

如果數據真正偏在一個聚合鍵，優先縮小中間結果或在能保持口徑時局部聚合。若是連接的一個分區過大，還要量拆分多出的複製成本與最慢任務是否縮短；這比只看工作總時間更能說明 AQE 的代價。

也把數據量、交換分區設定和實測結果寫在同一頁。

## 常見錯誤

- 看見 AQE 已啟用就說消除了傾斜 → 啟用不代表條件成立 → 讀最終計畫與最大分區。
- 用這個小範例證明生產提速 → 此處只看計畫變化 → 真實工作要量耗時和交換量。
- 改數據口徑換更短時間 → 比到不同計算 → 固定輸入與期望輸出。
