---
id: bd-bench-02
module: bd-bench
order: 2
title: 冷熱快取
subtitle: 第二次變快可能不是改對了
status: ready
minutes: 35
level: 3
prereqs:
  - bd-bench-01
objectives:
  - 分開紀錄應用首次、快取填充與快取重讀的時間
  - 說明 Spark 快取清除不等於作業系統冷讀
tags:
  - 快取
  - 暖身
  - 持久化
  - 冷熱讀取
resources:
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Caching Data，確認快取與解除方式。
  - title: Apache Spark：Web UI
    url: https://spark.apache.org/docs/latest/web-ui.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看 Storage 頁怎麼確認快取已物化。
concepts:
  - id: bd-bench-02-levels
    prompt: Spark 解除快取，能宣稱下一次是磁碟冷讀嗎？
    answer: 不能；作業系統、儲存端或讀取器仍可能保留快取。
    mcq:
      options:
        - 能，所有層同時清除
        - 不能，只清理對應的 Spark 快取
        - 能，只要等 1 秒
        - 能，等上一個任務完成即可
      answer: 1
      explain: 這些快取不共享同一套失效規則。
    interview:
      question: 同一查詢第二次快一倍，你怎麼交代原因？
      points:
        - 區分快取層和暖身
        - 報告填充與命中各自時間
        - 看物化與執行計畫
      answer: 我先只說第二次較快。接著分開做無應用快取、填充和重讀，核對計畫是不是用了快取；沒有控制作業系統和儲存端，就不會叫作物理冷讀。
  - id: bd-bench-02-fill
    prompt: 呼叫 cache() 後尚未做任何動作，能算已填充嗎？
    answer: 通常不能；先做會讀取該計畫的動作，再確認已物化。
    mcq:
      options:
        - 可以，呼叫時已有全部結果
        - 不能，要先觸發執行
        - 可以，只要數據量小
        - 不能，必須關掉工作階段
      answer: 1
      explain: 快取宣告和實際填入是兩個時間點。
  - id: bd-bench-02-reuse
    prompt: 何時快取成本最值得採用？
    answer: 昂貴中間結果會被多次重用，且填充、維護和記憶體代價低於省下時間時。
    mcq:
      options:
        - 只有一次查詢而且很簡單
        - 不論流量，只要記憶體剩 1 MB
        - 重用多次且收益大於填充及記憶體代價
        - 結果會不停變動但沒有失效規則
      answer: 2
      explain: 快取交易的是佔用與重算時間，不是免費加速。
  - id: bd-bench-02-breakeven
    prompt: 未快取每次 8 秒、填充加首次查詢 12 秒、重讀 3 秒；至少查幾次才有收益？
    answer: 2 次：不快取 16 秒，快取 15 秒；收益很小，仍要度量波動與記憶體代價。
practice:
  - id: bd-bench-02-p1
    kind: code
    title: 保存首次、填充與重讀計時
    minutes: 14
    steps:
      - 執行 cache_probe.py，保存 4 種標籤的原始秒數與兩個中位數。
      - 保留計畫輸出；把 source 改成 100000 筆再比較，先檢查 assert 預期。
    checks:
      - 每一輪同樣輸出 1 列且金額 9900000；縮小後應是 4950000，需同步改驗算值。
      - 報告寫的是應用首次與快取，不寫磁碟冷讀。
---

## 快的是你的修改，還是上一輪留下的東西？

上午第一次查報表很慢，再按一次快多了。第二次可能不用再初始化引擎，也可能使用 Spark 保存的中間結果，或碰到作業系統的頁面快取（page cache）。快取（cache）是保留可重用結果，以記憶體或儲存交換時間；暖身（warm-up）範圍更廣，還包括程序初始化及即時編譯。只看秒數無法分辨快在哪一層，報告應寫你真的控制了什麼。

下面刻意不讀磁碟檔。比較「應用內首次、不使用 Spark 快取重跑、快取填充、快取重讀」。填充要付初始化中間結果的代價，不能只公布重讀秒數。如果每天管道只跑一次，即使命中很快，也可能一點利益都沒有。對常用報表則可再問：重用幾次才攤平填充？中間結果被另一個工作擠出時怎麼辦？

## 在一個本機工作階段做分組

同上一堂的 WSL 2、Spark 4.3.0、JDK 21、Python 3.11 以上和 4 GB 可用 RAM。在 `/mnt/c/dev/conduit-lab/bench` 存 `cache_probe.py`。`source.cache()` 標記中間結果；第一次讀會填充，最後 `unpersist(blocking=True)` 等待對應快取移除。印出快取階段的計畫供核對。

```python
from statistics import median
from time import perf_counter
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.getOrCreate()
try:
    source = spark.range(200_000, numPartitions=2).select((F.col("id") % 100).alias("amount"))
    def run(which):
        query = source.agg(F.sum("amount"))
        start = perf_counter()
        result = query.collect()
        elapsed = perf_counter() - start
        assert len(result) == 1 and result[0][0] == 9_900_000
        print(which, round(elapsed, 4))
        return elapsed
    run("first_no_cache")
    warm_no_cache = [run("warm_no_cache") for _ in range(3)]
    source.cache()
    try:
        run("fill_cache")
        reads = [run("reuse_cache") for _ in range(3)]
        source.agg(F.sum("amount")).explain()
        print("medians", median(warm_no_cache), median(reads))
    finally:
        source.unpersist(blocking=True)
finally:
    spark.stop()
```

```bash
spark-submit --master 'local[2]' --driver-memory 2g cache_probe.py
```

對照計畫裡保存後的掃描，通常可見 `InMemoryTableScan`。此例沒有計時工作階段啟動，也沒有量磁碟冷讀；如果要比較兩種快取策略，請各自重啟多輪再反轉順序，避免把後跑的優勢算給方案。不關閉整台機器的快取，也不把快取保留到其他任務。

## 算一下快取何時回本

用獨立的假設數字練習：無快取每次 8 秒；首次填充並查詢用 12 秒；重讀每次 3 秒。一次查詢，快取多花 4 秒；兩次查詢，無快取是 16 秒，快取是 15 秒；但節省的 1 秒可能小於環境波動。若只有一個日結工作會讀這張中間表，先不要加快取。若 20 張報表都用同一份中間結果，再確認快取是否留得住、多久要刷新，以及換班後讀到舊內容的風險。把實測秒數代入同樣算式，別把案例數字當作你的成果。

如果 Storage 頁顯示只保留部分分區，一次重讀可能同時用到已保存與重算的部分；不要把它當成完整命中。可從查詢計畫、Storage 頁及相同動作的執行證據交叉檢查。環境一變，當初優勢可能消失，所以將使用時段、同時任務與中間結果大小記在測試旁。這讓下一位同事能分辨「重讀較快」究竟支持保留這張表，還是只表示那一輪的引擎已暖起來。

當來源更新時，另讀或重建相應計畫；不要把相同查詢字串當成相同輸入版本。

## 常見錯誤
- 第一次快取查詢反而慢 → 包含填充 → 和重讀分開寫，不把第一次當異常丟掉。
- 說已冷讀但只是清 Spark 快取 → 另有系統與儲存層 → 標註「Spark 未快取」。
- 快取越加越多 → 中間表擠壓其他工作 → 量重用次數、大小與失效時點。
