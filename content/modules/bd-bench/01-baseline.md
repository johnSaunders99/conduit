---
id: bd-bench-01
module: bd-bench
order: 1
title: 基準負載與固定輸入
subtitle: 只改一個條件再比較
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
  - 固定輸入公式、執行範圍與輸出驗收
  - 交替比較兩種 Shuffle 分區數並保存逐次結果
tags:
  - 基準負載
  - 固定輸入
  - Shuffle
  - 中位數
resources:
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 查 Shuffle 分區數與 AQE 如何干擾比較。
  - title: Apache Spark：Web UI
    url: https://spark.apache.org/docs/latest/web-ui.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 對照 SQL 計畫與 Stages 的指標。
concepts:
  - id: bd-bench-01-baseline
    prompt: 比較 Shuffle 分區數前要固定什麼？
    answer: 固定輸入、查詢、版本、機器、快取規則和其他設定，先驗兩份輸出相同。
    mcq:
      options:
        - 固定輸入與其他條件
        - 使用兩個不同營業日
        - 只固定輸出欄位名
        - 只保留最快一次
      answer: 0
      explain: 輸入與狀態不固定，就不能把時間差歸因給分區數。
    interview:
      question: 調完分區速度差很多，你怎麼讓同事重現？
      points:
        - 寫下輸入切點與分布
        - 交替多次並區分暖身
        - 核對結果與執行計畫
      answer: 我會把輸入切點、筆數、鍵分布和版本寫進紀錄，固定查詢和執行範圍，交替跑兩案並留原始樣本。先核對逐鍵結果，再看計畫與 Shuffle 實際分區。
  - id: bd-bench-01-action
    prompt: 為何不能只計時 Spark 的 groupBy() 呼叫？
    answer: 它通常只組計畫，需觸發動作並等結果回來才量到執行。
    mcq:
      options:
        - 它每次都同步掃描數據
        - 它只組計畫，應量動作
        - 它只會執行在存放檔案的磁碟
        - 它等於寫出查詢結果
      answer: 1
      explain: 惰性求值會把實際工作延後。
  - id: bd-bench-01-confound
    prompt: 先連跑 A 三次再連跑 B 三次有什麼風險？
    answer: 後做的方案可能吃到暖身或其他環境變化，與方案效果混在一起。
    mcq:
      options:
        - 沒有風險，A 和 B 筆數相同
        - 只有輸出順序可能不同
        - 順序可能混入暖身效果
        - 跑三次不能算中位數
      answer: 2
      explain: 交替與暖身不能去掉所有噪音，但可降低順序偏差。
practice:
  - id: bd-bench-01-p1
    kind: code
    title: 留一份可重現的對照紀錄
    minutes: 15
    steps:
      - 執行 baseline.py，把原始秒數與各設定中位數寫入 baseline.md。
      - 寫下執行引擎版本、local[2]、關閉 AQE 與不主動清系統快取。
    checks:
      - 每次有 32 組，合計 200000 筆及 9900000 元；逐鍵和驗算相等。
      - 報告只比較本機這份負載，不必報出固定勝方。
---

## 三分鐘變兩分鐘，先問是不是同一份工作

昨天凌晨的數倉工作跑 3 分鐘，今天調整分區後跑 2 分鐘。若今天少了一半訂單，或讀到已被系統快取的檔案，不能宣布調校成功。基準負載（benchmark workload）要讓別人重建同一份輸入與相同動作；先定義「這次算對了沒有」，才有資格比較「快多少」。

依[〈Task 與分區數〉](#/lesson/bd-spark-06)的觀念，重分布（shuffle）把同一聚合鍵送到相應分區。分區少會讓單一任務工作變多；分區多則可能增加啟動與調度。自適應查詢執行（adaptive query execution，AQE）還能在執行時合併部分分區。在這個受控實驗刻意關閉 AQE，目的是只比較設定值；不能把它當成調校正式作業的通則。

## 在相同數據上輪流跑 A、B

Windows 的 WSL 2 進 `/mnt/c/dev/conduit-lab/bench`，需已備 Spark 4.3.0、JDK 21、Python 3.11 以上，可用 RAM 4 GB。存 `baseline.py`。範例用固定範圍合成 200,000 筆，不讀外部檔、沒有亂數。`collect()` 收回 32 個彙總結果，從動作開始計時，逐鍵檢查放在計時之外。後處理確認不在計時範圍，也不會在兩組間變動。

```python
from collections import Counter, defaultdict
from statistics import median
from time import perf_counter
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.config("spark.sql.adaptive.enabled", "false").getOrCreate()
try:
    source = spark.range(200_000, numPartitions=2)
    source = source.select((F.col("id") % 32).alias("store"),
                           (F.col("id") % 100).alias("amount"))
    counts, totals = Counter(), Counter()
    for i in range(200_000):
        counts[i % 32] += 1
        totals[i % 32] += i % 100
    expected = {k: (counts[k], totals[k]) for k in counts}
    samples = defaultdict(list)
    for i, n in enumerate((4, 16, 4, 16, 16, 4, 4, 16)):
        spark.conf.set("spark.sql.shuffle.partitions", n)
        query = source.groupBy("store").agg(F.count("*").alias("n"), F.sum("amount").alias("total"))
        start = perf_counter()
        rows = query.collect()
        elapsed = perf_counter() - start
        assert {r.store: (r.n, r.total) for r in rows} == expected
        print("warmup" if i < 2 else "measured", n, round(elapsed, 4))
        if i >= 2:
            samples[n].append(elapsed)
    for n in sorted(samples):
        print("partitions", n, "median_seconds", median(samples[n]))
finally:
    spark.stop()
```

```bash
spark-submit --master 'local[2]' --driver-memory 2g baseline.py
```

每個設定先暖身一次，再各記 3 次；樣本少時請留原始值。結論可以是「這台單機、這個切點，差別小於組內波動，不選勝方」。沒有讀檔意味著量不到儲存成本，也不必為了測試去動系統快取。下一堂[〈冷熱快取〉](#/lesson/bd-bench-02)再把第一次與重複讀取拆開報告。

## 開跑前先填完基準卡

- **輸入切點：** 本例是整數 ID 0 到 199999，門市為 ID 除以 32 的餘數，金額為 ID 除以 100 的餘數。真實作業改填到期日、快照 ID、時間窗和鍵分布，不可只記路徑。
- **量測邊界：** 收集完成才停錶，建立工作階段、暖身、逐鍵核對都另記。若目標是使用者總等待，再加入引擎啟動、排程及發布；不要用此例的秒數代替。
- **可變條件：** 每輪只改分區數，固定同一份輸入與本機工作者。其他人程序同時跑或筆電降頻時，記為環境差異，不因較慢就任意拿掉。

需要交接時，把每次秒數、順序和結果一起留下。中位數可以降低單一突發的影響，但 3 次仍不足以穩定估高分位；如果 B 較快 0.1 秒、兩組各自波動 0.3 秒，就先寫無法分辨，再想是否值得擴大實驗。還可用計畫驗 `Exchange` 的目標分區數，並記第一階段仍由 2 個來源分區工作。即使 B 真的較快，範例鍵分布均勻、輸出很小；高偏斜或大量掃檔可能改變結論。要替換正式設定，先加一個包含真實熱鍵和檔案數的代表性負載。

批次報告不只填勝方：請把兩組原始輸出和核對方式放在同一份紀錄，方便下一次重跑。

## 常見錯誤
- 結果變快但少一組 → 只比總額 → 逐鍵比筆數及金額。
- 分區設 16 卻沒跑到 16 個任務 → 忽略執行中調整 → 核對計畫與 AQE 設定。
- 執行秒數無法重現 → 忘了記是否暖身 → 留次序、環境與原始樣本。
