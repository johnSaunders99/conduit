---
id: cr-internals-02
module: cr-internals
order: 2
title: Hive 分區與小檔
subtitle: 用掃描檔案數支持判斷
status: ready
minutes: 25
level: 4
prereqs:
  - cr-internals-01
objectives:
  - 區分 Hive 表分區選取與分區內小檔成本
  - 用檔數、讀量及任務時長驗收整理成效
tags:
  - Hive
  - 分區裁剪
  - 小檔案
  - 檔案開啟
resources:
  - title: Apache Hive：DDL
    url: https://hive.apache.org/docs/latest/language/languagemanual-ddl/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Partitioned Tables 及分區位置。
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 用 openCostInBytes 理解開檔的固定代價。
concepts:
  - id: cr-internals-02-two
    prompt: Hive 查詢只命中一個分區，為什麼仍可能慢？
    answer: 該分區內可能有大量小檔，查詢仍要承擔列舉、開檔及切分調度。
    mcq:
      options:
        - 一定不會慢，因為只查一個分區
        - 小檔仍會有開啟與調度成本
        - 只能是網路完全中斷
        - 這表示所有 Hive 分區都在記憶體裡
      answer: 1
      explain: 分區索引與檔案布局是不同層；檔案也不必然各對應一個任務。
  - id: cr-internals-02-test
    prompt: 同樣讀 240 MB，從 120 檔降為 3 檔，如何確認加速？
    answer: 對同窗口、同欄位及相同快取條件重跑，比掃描檔、耗時與正確性。
    mcq:
      options:
        - 只比較 Parquet 壓縮率
        - 只確認檔案變少，不跑查詢
        - 固定查詢比檔數、耗時與結果
        - 改成更大日期窗口後比時間
      answer: 2
      explain: 檔數下降不是速度實測；相同結果才能公平比較。
    interview:
      question: Hive 小檔是怎麼形成的，你先修讀端還是寫端？
      points:
        - 高頻寫入及並行寫出的來源
        - 先知道讀的是哪些分區與檔
        - 比較上游輸出控制和下游合併
      answer: 我會先在同一分區看檔數、大小分布與任務啟動時間。緊急時可在驗算後整理熱區；若每次排程又寫出大量小檔，我會從寫入頻率與輸出分區數處理，不讓合併一直救火。
  - id: cr-internals-02-cost
    prompt: 把整表只輸出一個大檔，是通用解嗎？
    answer: 不是；可能讓寫入或後續讀取平行度太低，也可能超出分區整理需求。
    mcq:
      options:
        - 是，任何大小都最好只有一檔
        - 不是，需平衡檔案數和可平行性
        - 是，檔頭不含欄位
        - 不是，Hive 不能有大檔
      answer: 1
      explain: 合理大小依引擎、工作負載及讀寫模式決定。
practice:
  - id: cr-internals-02-p1
    kind: explain
    title: 留下同分區的前後對照
    minutes: 8
    steps:
      - 在 C:\dev\conduit-lab\interview\hive-layout.md 對照甲乙的檔數、大小、位元組、口徑與要測的時間。
      - 替守住同一日報表設一個停止重寫的條件。
    checks:
      - 120 個 2 MB 和 3 個 80 MB 都是 240 MB；沒有預報固定加速百分比。
      - 核對兩案逐鍵結果後才談效能，並交代上游如何減少新小檔。
---

## 已裁成一天，還要開 120 次檔嗎？

Hive 分區（partition）把同一業務切點的數據放在可定位的區域；用分區鍵過濾，可以先避開其他日子的路徑。接著引擎還要列舉當天的檔，打開檔案、取得結構或統計，再決定切分。HDFS 的名稱節點（NameNode）維護檔案與區塊元數據；大量小檔也增加其元數據管理負擔。若是物件儲存，則要考慮請求與列舉。這兩種儲存環境不同，但共同點是檔案的固定成本不等於要解碼的總位元組。

承接[〈Hive SQL 與分區裁剪〉](#/lesson/bd-hive-02)與[〈小檔案合併〉](#/lesson/bd-hive-07)：即使掃同一日，也可能因微批次太頻繁、每次輸出分區太多，留下數百個很小的檔。不能直接把檔數當任務數，引擎可能把數個小檔整成一個讀取切分，一個大檔也可能可平行讀。要在運行計畫確認它怎麼處理。

## 怎樣驗證，而不先猜一個加速比例？

案例甲：一天命中 120 個 2 MB 檔。案例乙：整理成 3 個 80 MB 檔。假設壓縮後總量剛好相同，都是 240 MB。固定營業日、查詢欄位、引擎設定與快取規則，再測候選分區、掃描檔數、位元組、任務啟動和耗時分布，並保留逐鍵結果。這個例子不要求啟動 Hive；可以拿自己在前面 Hive 或 DuckDB 裁剪課留下的計畫，圈出真正看得到的欄位。若只有模擬數字，就不要說量到了效能。

修讀端可能降低開檔壓力，但治本常是調整寫入頻率、目標檔大小或並行度。合併只針對受影響分區，先盤點讀者與原始輸入，驗算後再發布；表格式的重寫與保留另見[〈合併與小檔整理〉](#/lesson/bd-lake-04)。不要把手動複製覆蓋當所有 Hive 管理表都能安全使用的維護方式。

## 用一個查詢驗兩個彼此獨立的變數

如果甲乙不只是檔數不同，還換了壓縮、分區鍵或快取狀態，你就無法用這次時間差估開檔成本。先保留欄位及過濾不變，只換一個分區內的檔案布局；讀不到同一口徑的逐鍵結果就不要發布。接著重新看一個跨日查詢：若兩天都該被選中，不能因為其中一天檔太多就從結果排除。碰到已對外服務的表，先給舊輸出保留可讀入口，在測試區準備比較結果，確認下游依契約讀取後才換版。這樣即使加速不明顯，也還留有能找出原因和回到原狀的道路。

若確認開檔不是主要時間，把結果留在報告，改量解碼或後續計算；不為了證明整理有用就重挑樣本。

## 常見錯誤
- 命中一日就說已調好 → 沒看日內檔案 → 比掃描檔及分布。
- 120 檔就等於 120 任務 → 忽略引擎切分 → 從計畫核對。
- 小檔合併後立刻重寫整表 → 超出熱點範圍 → 先對受影響分區分批試做。
