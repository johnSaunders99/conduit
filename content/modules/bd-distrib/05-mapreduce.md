---
module: "bd-distrib"
id: "bd-distrib-05"
order: 5
title: "MapReduce"
subtitle: "先局部加總再合併"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-distrib-04"
objectives:
  - "將訂單轉為鍵值對後做兩段加總"
  - "說明為何局部平均不能直接平均"
tags:
  - "Map"
  - "Reduce"
  - "Combiner"
  - "局部聚合"
resources:
  - title: "MapReduce Tutorial"
    url: "https://hadoop.apache.org/docs/r3.5.0/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Mapper、Reducer 與 Combiner 出現的時機。"
concepts:
  - id: "bd-distrib-05-map"
    prompt: "Mapper 在訂單小計的例子輸出什麼？"
    answer: "每張訂單輸出一對分組鍵與待聚合的數值，如會員編號與金額。"
    mcq:
      question: "要算會員總額，Mapper 最合適輸出什麼？"
      options:
        - "檔名與列數"
        - "會員鍵與金額"
        - "金額與會員鍵"
        - "分區號與整個檔案"
      answer: 1
      explain: "會員是分組鍵，金額才是待加總的數值。"
  - id: "bd-distrib-05-merge"
    prompt: "Combiner 為何可用於整數金額 SUM？"
    answer: "局部小計仍可用同樣的加法合併，且合併次序不改結果。"
    mcq:
      question: "區 A 為 1 筆、平均 100；區 B 為 3 筆、平均 20。總平均是多少？"
      options:
        - "60"
        - "20"
        - "40"
        - "120"
      answer: 2
      explain: "總額 160 除以 4 筆為 40。60 是沒有依筆數加權的局部平均。"
    interview:
      question: "如何讓平均值可以在 Map 端局部合併？"
      points:
        - "保留總和與筆數"
        - "分別加總後才相除"
        - "不依賴 Combiner 一定執行"
      answer: "我每份輸出總和與筆數，將兩者分別相加，最後才相除。就算 Combiner 沒跑，原始紀錄可視為金額和 1，也能走同一個合併方法。"
  - id: "bd-distrib-05-shuffle"
    prompt: "Mapper 各看一段輸入，Reducer 怎麼看齊同鍵？"
    answer: "中間結果按鍵經 Shuffle 分派，同鍵交給同一個減縮端。"
practice:
  - id: "bd-distrib-05-lab"
    kind: "hands-on"
    title: "留下局部與最終小計"
    minutes: 10
    steps:
      - "在 bd-distrib 存成 mr_totals.py 並執行"
      - "把鍵 7 的一筆金額從 20 改成 25，再跑一次"
      - "在結果旁寫出局部平均直接合併的反例"
    checks:
      - "初始總額為鍵 7 的 150 與鍵 9 的 40"
      - "改動後只有鍵 7 變為 155"
---

## 一張訂單先變成一對數值

兩個門市各交一段訂單，營運要的是會員總額，不是門市總額。MapReduce 把這類工作拆成兩段：Map（映射）從每段輸入產生鍵值對；Reduce（歸約；大陸也稱規約）收到同一鍵的一組值，再算出該組結果。以會員 7 的一張 30 元訂單為例，Mapper 交出 `7 → 30`；如果不同輸入也交了 `7 → 100`，最後必須由同一個負責鍵 7 的 Reducer 合併。

![兩個輸入各算小計，合流後才得全量](assets/bd-distrib-mapreduce.svg)

中間的重新分派叫數據交換（shuffle，本課也直接寫 Shuffle）：依映射把同鍵送到同一處並讓接收端可按鍵成組。Hadoop MapReduce 的中間鍵還會排序；這和報表最後要求的全域排序是兩件事。[下一堂](#/lesson/bd-distrib-06)會估搬運量及哪個分區容易拖慢整批。

## 什麼能先算，什麼不能

Combiner（局部合併器）可在 Map 端先把同鍵小計合起來，少送中間紀錄；引擎不保證一定使用它，因此 Reducer 必須能接原始值，也能接局部值。整數金額加法符合這個條件。加總局部平均則不對：一店 1 張、平均 100 元；另一店 3 張、平均 20 元。直接平均是 60 元，真正答案是 `(100 + 60) / (1 + 3) = 40` 元。讓每份保留 `總額, 筆數`，最後才相除，就能安全分段。

單個門市已經能說「會員 7 在我店買多少」，它沒有全公司的訂單，所以局部輸出不能直接當成全域結果。若業務口徑改成「唯一會員數」，也不能把各門市的唯一人數直接相加：同一個人可能逛兩間店。先問「局部結果保留的資訊夠不夠合併」，再問如何讓它跑快。

## 單機重演合併

將程式存為 `C:\dev\conduit-lab\bd-distrib\mr_totals.py`，在其資料夾執行 `py mr_totals.py`；預留 0.25 GB RAM。這是機制模擬，不啟動 Hadoop，不量網路吞吐。
```python
from collections import defaultdict

inputs = [[(7, 100), (9, 40)], [(7, 30), (7, 20)]]
received = defaultdict(list)
for source in inputs:
    partial = defaultdict(int)
    for user_id, amount in source:
        partial[user_id] += amount
    print("map", dict(partial))
    for user_id, subtotal in partial.items():
        received[user_id].append(subtotal)

print("reduce", {key: sum(received[key]) for key in sorted(received)})
```

保留兩行 `map` 輸出與一行 `reduce`。應看見鍵 7 在兩個小計都出現，但最終只有一列 150，鍵 9 則為 40。若把單一輸入的訂單挪到另一份、不改內容，全域答案應不變；這個不變量比「這次印了幾行」更能驗證拆分沒有改口徑。

### 用中間紀錄數衡量是否值得

這個例子原始有 4 對鍵值，第二個輸入有兩筆會員 7，局部加總後只多送一對小計；第一個輸入兩鍵不同，沒有減少。記錄「送出 3 對，結果 2 對」而不是報告「少算了一筆訂單」：送出的單位是中間紀錄，最終小計仍含全部原始訂單。若整批每個 Mapper 看到的鍵都不同，局部合併也省不了多少搬運。

同樣的規則可用於最小值：每份先保留自己的最小值，再挑這些值中的最小者。如果要找精確中位數，局部中位數不夠；你必須另保留可用來重建整體分佈的資訊，不能只改最後一個算式。這是面試時判斷「可不可以先在 Map 合併」的起點。

## 常見錯誤

- 每個輸入都交出鍵 7 的最終答案 → 沒有合流 → 再按鍵合併。
- 平均 100 與 20 得 60 → 忘記人數或訂單數 → 合併總和與筆數。
- 不開 Combiner 就算錯 → 把可選優化當必要邏輯 → 讓 Reducer 也能接原始值。
