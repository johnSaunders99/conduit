---
id: cr-internals-01
module: cr-internals
order: 1
title: Spark Shuffle 與長尾
subtitle: 從任務分布提出第二種解釋
status: ready
minutes: 25
level: 4
prereqs: []
objectives:
  - 畫出 Spark 中同鍵數據被重分布到下一階段的過程
  - 用任務讀量及工作節點位置區分傾斜與資源問題
tags:
  - Spark
  - Shuffle
  - 數據傾斜
  - Stage
resources:
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 AQE 的分區合併和傾斜連接。
  - title: Apache Spark：Web UI
    url: https://spark.apache.org/docs/latest/web-ui.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 找單個 Stage 的 Shuffle、溢寫與任務位置。
concepts:
  - id: cr-internals-01-boundary
    prompt: 為什麼按鍵聚合會形成 Spark 的階段邊界？
    answer: 同一鍵的部份結果須被搬運到相容的目標分區；下游任務依賴多個上游分區。
    mcq:
      options:
        - 每個函式都形成階段
        - 同鍵數據需要重新分派
        - 所有程式都依單一順序
        - 讀取任務只能使用一個執行器
      answer: 1
      explain: 窄依賴可在同一階段接續，跨分區重分布需要 Shuffle。
  - id: cr-internals-01-tail
    prompt: 最慢的任務讀量接近其他，但集中同一工作節點，下一步是什麼？
    answer: 優先比較該節點的溢寫、讀取等待、垃圾回收和資源競爭，別先斷言鍵偏斜。
    mcq:
      options:
        - 先看受影響節點及同階段其他任務
        - 立即加鹽
        - 一律倍增分區數
        - 直接判定是 JOIN 鍵重複
      answer: 0
      explain: 讀量不偏時，環境原因是能被立即檢驗的替代假設。
    interview:
      question: Spark Shuffle 後只剩一個任務跑不完，你先查什麼？
      points:
        - 以 Stage 和逐任務指標定位
        - 比讀量及鍵頻率以判斷傾斜
        - 按證據選小改動並核對結果
      answer: 我會先找慢的是哪個 Stage，對比讀量、溢寫和它在哪個節點跑。若有一個鍵集中又讀得特別多，我才試 AQE 或拆鍵；如果讀量相似而慢都集中一台，就先查該台資源。
  - id: cr-internals-01-broadcast
    prompt: 廣播小表可以避免什麼，又新增什麼代價？
    answer: 在適用的連接中避免為連接重新分布大側，但每個相應執行器需能負擔小表。
    mcq:
      options:
        - 避免所有查詢 Shuffle
        - 避免任何網路流量
        - 避免為這次連接搬大側，需負擔小表
        - 避免所有工作者使用記憶體
      answer: 2
      explain: 廣播也要傳輸並持有小側，不能當成適合所有數據量的固定答案。
practice:
  - id: cr-internals-01-p1
    kind: explain
    title: 留兩種長尾診斷而非背一種解答
    minutes: 9
    steps:
      - 把案例甲乙、預期指標與可推翻的觀察存到 C:\dev\conduit-lab\interview\shuffle-note.md。
      - 30 秒口述一個改善及一個反例。
    checks:
      - 甲先核對熱門鍵；乙先查共同節點資源。
      - 沒有用同一種加鹽或增加分區同時回答甲乙。
---

## 為什麼彙總要搬數據？

在[〈Job 與 Stage〉](#/lesson/bd-spark-05)學過，階段（stage）由能連續處理的一組任務構成。要按門市合計時，來源分區各有門市 A；就算先在各分區局部聚合，同一門市的片段也要送往相容的目標分區，再做最終彙總。重分布（shuffle）多出分桶、序列化、寫出與讀取中間結果的代價，數據可能跨工作者傳輸。證據通常從 SQL 計畫的交換節點（exchange）和相應 Stage 的 Shuffle 指標開始找，而不是從哪個檔名最大猜起。

![Spark 上游按鍵分桶，同鍵在下游同一分區，熱門鍵可能形成長尾](assets/cr-internals-shuffle.svg)

若某個門市佔多數，鍵分布可能讓其中一個分區累積太多工作，稱為數據傾斜（data skew）。另外，即使輸入均可分，較慢的磁碟、記憶體壓力或垃圾回收也可能拖長任務。先記下兩套相反觀測，再選下一個測試，避免找到紅點就把所有長尾通稱為傾斜。

## 白板上換兩組觀察

- **甲：** 同階段多數任務 2 秒且讀 40 MB，慢任務 90 秒、讀 1.2 GB，且含高度集中的門市鍵。先驗鍵分布和輸出，再比較 AQE（自適應查詢執行）的傾斜連接與人工拆鍵。若是聚合而非連接，兩段加總可測，詳見[〈鍵分布與加鹽〉](#/lesson/bd-bench-05)；兩者不能混成同一操作。
- **乙：** 慢任務讀 38–45 MB，分布接近，卻都在同一節點並有明顯溢寫。先看同機資源與其他任務；這不排除所有鍵問題，但加鹽不是第一個測試。

這些是示意數字。若目標是較小的維度連接，可以衡量廣播（broadcast）是否在記憶體容許下避免搬大側；要確認引擎真的採用策略，不能只在白板上寫了它。實作報告保留原查詢、逐鍵結果和階段讀量。市場研究 `research/market-report.md` 列的中國大陸數開面經有 Spark 連接題，這裡練的是可追問的第二種解釋，不是宣稱面試固定考這道。

## 再追一層：同一個處置為什麼只適合其中一種？

若甲做的是連接，先看交換前後的兩側大小，再查 AQE 是否採用傾斜連接處理，或小側能否廣播；不同連接型態與大小可能令同一策略失效。如果改寫後輸出各鍵筆數和原版不同，先停在正確性，不報加速。乙則先看同節點上別的作業是否也出現等待，必要時對同一批固定輸入換節點重跑，只有結果仍跟節點走才支持資源假設。把這個可驗的分界寫進口述稿：現在是觀察到相關，不等同已確認根因。

若缺少節點位置紀錄，就標成待補，不從時間最長的工作自行猜。

## 常見錯誤
- 看見 90 秒就判斷加鹽 → 沒證明為鍵分布 → 先對照讀量與節點。
- 說廣播沒有任何 Shuffle → 混淆單次連接與整條計畫 → 指出被省的是哪次交換。
- 調完只比耗時 → 可能改變連接覆蓋 → 還要驗結果與未匹配鍵。
