---
module: "bd-distrib"
id: "bd-distrib-06"
order: 6
title: "Shuffle 與傾斜"
subtitle: "多數商品都流向同一節點"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-distrib-05"
objectives:
  - "從各分區負載找出 Shuffle 長尾"
  - "用兩階段加總拆熱鍵並證明總額不變"
tags:
  - "Shuffle"
  - "skew"
  - "salting"
  - "長尾"
resources:
  - title: "MapReduce Tutorial"
    url: "https://hadoop.apache.org/docs/r3.5.0/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Shuffle、Sort 及按鍵分派的說明。"
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Skew Join，認識以實際分區大小判斷過重。"
concepts:
  - id: "bd-distrib-06-exchange"
    prompt: "Shuffle 搬的是什麼，為什麼要搬？"
    answer: "搬中間數據，使原本散在不同輸入的同鍵能由同一接收端合併。"
    mcq:
      question: "哪個動作最明確需要按鍵重分配未按鍵分佈的數據？"
      options:
        - "各輸入只選兩欄"
        - "將每筆金額乘 2"
        - "按會員求全量總額"
        - "刪掉各輸入的取消單"
      answer: 2
      explain: "逐列操作不需要其他輸入；全量按鍵合併需要交換。"
  - id: "bd-distrib-06-tail"
    prompt: "如何區分單一分區傾斜與所有分區都太大？"
    answer: "比較相同階段任務的輸入列數或 Shuffle Read 與耗時分布，看是否少數遠大於其餘。"
    mcq:
      question: "大多數任務 12 秒，少數耗時 4 分鐘且讀取量遠高於其他任務。先驗證什麼？"
      options:
        - "慢任務對應分區是否特別大"
        - "所有節點都缺記憶體"
        - "一定要廣播最大表"
        - "必須永久保留重試結果"
      answer: 0
      explain: "長尾伴隨讀量差異應先查負載不均，不直接定因於硬體或指定優化。"
    interview:
      question: "Spark 的 Shuffle 最慢區佔總量七成，你會先做什麼？"
      points:
        - "比較任務讀量與耗時"
        - "確認熱鍵而非只看平均"
        - "選能保正確的預聚合或拆熱鍵"
      answer: "我從 Stage 找讀量與耗時的離群值，再用鍵頻率確認。若是加總先做局部小計；若單鍵仍過重，以穩定鹽值拆開，最後按原鍵合回並核對總額。"
  - id: "bd-distrib-06-salt"
    prompt: "拆分熱鍵後，為什麼要再按原鍵聚合？"
    answer: "每個加鹽鍵只含原鍵的一部分，第二段才能恢復原口徑。"
  - id: "bd-distrib-06-fanout"
    prompt: "熱鍵的兩側各有上萬列時，加鹽能讓 JOIN 結果變少嗎？"
    answer: "不會改變應有的配對，只可能把正確的配對工作分散到多份。"
    mcq:
      question: "一個等值鍵左側 3 列、右側 2 列，正確拆鍵後有幾筆配對？"
      options:
        - "2"
        - "3"
        - "6"
        - "5"
      answer: 2
      explain: "正確分配要保留原本 3 × 2 筆配對，工作分佈不是口徑。"
practice:
  - id: "bd-distrib-06-lab"
    kind: "hands-on"
    title: "留下拆鍵前後的負載與總額"
    minutes: 10
    steps:
      - "在 bd-distrib 執行 skew.py"
      - "比較兩次最大分區並保存各分區列數"
      - "說明第二段怎樣把鍵 7 合回來"
    checks:
      - "最大分區從 80 降到 30"
      - "鍵 7 最終是 80，總列數仍是 100"
---

## 交接時才知道誰最忙

Shuffle（數據交換）把中間數據按目的分區搬運。即使每份輸入一開始都只有 25 列，按商品鍵合流後，接收端也可能一區 80 列、兩區各 10 列。數據傾斜（data skew）是分區負載不均；長尾（straggler tail）是大多數任務已結束、整個階段卻仍在等少數任務。真實系統的搬運可能經網路、本地磁碟或記憶體；在單機也會有交換，不代表一定有跨機流量。

先找證據：同階段比較任務負責的輸入量、交換讀量、耗時和磁碟溢寫（spill，把暫存內容轉寫至磁碟）。若慢的那幾個讀量也特別大，按鍵頻率查是哪個鍵；若讀量相近卻一直是同一台機器慢，改查節點資源或反覆失敗。只看整段平均耗時，兩種情況都可能被藏起來。

## 先局部聚合，再判斷要不要拆鍵

若只做可合併的整數 SUM，優先考慮[〈MapReduce〉](#/lesson/bd-distrib-05)的局部小計，因為它直接減少要搬的數量。若仍需將熱鍵拆開，可加鹽（salting）：用另一個穩定值，例如原始訂單識別碼，把原鍵分成多個臨時鍵。先依「原鍵、鹽值」算小計，再依「原鍵」合總；少了第二段，報表就會多出互不相同的小計列。

![熱鍵拆給四個接收方，再合回原鍵](assets/bd-distrib-skew.svg)

不是每種運算都能照搬。平均值要保留總和和筆數；連接兩張表時，不能兩邊獨立亂加鹽，不然應該配對的列會錯過。之後在[〈Hive 數據傾斜〉](#/lesson/bd-hive-08)練空鍵與熱門鍵，在[〈AQE 與傾斜調校〉](#/lesson/bd-spark-09)再看引擎怎麼處理。今天固定每筆工作成本相同，只量列數，不預測節省多少秒。

## 對照最重的一區

將下列程式存至 `C:\dev\conduit-lab\bd-distrib\skew.py`，從該資料夾執行 `py skew.py`，預留 0.25 GB RAM。這裡直接指定接收方，沒有把它冒充為引擎的真實雜湊。
```python
from collections import Counter

rows = [(7, i) for i in range(80)] + [(9, i) for i in range(20)]
before = Counter(1 if key == 7 else 0 for key, _ in rows)
after = Counter()
partials = Counter()
for key, row_id in rows:
    part = row_id % 4 if key == 7 else row_id % 2
    after[part] += 1
    partials[key, part] += 1

totals = Counter()
for (key, _), count in partials.items():
    totals[key] += count
print(sorted(before.items()), sorted(after.items()), sorted(totals.items()))
assert totals == Counter({7: 80, 9: 20})
```

確認最重區從 80 降到 30，再比較兩次總量都為 100。若把熱鍵的接收方改成常數，會重現長尾的前置條件；這不是速度測試，也沒有模擬第二段的網路開銷。

### 看最大負載，而不是數分區

粗略估算時，若每列成本一樣且一次工作槽只接一組，單階段不可能早於最重組完成。80 列拆成 4 份各 20 列後，鍵 9 的 20 列在前兩個接收方各加 10 列，最大就變 30，不是 20。真實工作裡固定開銷、可用工作槽和分區相撞都會影響結果，接著才值得量秒數。

高負載也可能是結果本身大。若某個鍵在連接左右各有一萬列，正確的逐列配對可能真的需要一億列。加鹽能分攤工作，卻不會消除合法輸出；若報表只需要按鍵加總，可先確認能否在連接前各自聚合，才有機會減少工作本身。

## 常見錯誤

- 只增加分區就期待拆開同鍵 → 原鍵映射未變 → 查熱鍵並評估分段合併。
- 鹽值用了同一個熱門鍵的雜湊 → 每列鹽仍相同 → 改用穩定的列級識別碼。
- 每個小計各交一行 → 少了合回原鍵 → 先驗唯一粒度與全表總計。
