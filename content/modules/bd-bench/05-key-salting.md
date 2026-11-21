---
id: bd-bench-05
module: bd-bench
order: 5
title: 鍵分布與加鹽
subtitle: 拆熱門鍵後總和不能變
status: ready
minutes: 35
level: 3
prereqs:
  - bd-bench-04
objectives:
  - 用穩定鹽值拆分熱門鍵
  - 用兩階段聚合還原每鍵總量
  - 寫出由局部總和與筆數合成的平均
tags:
  - 加鹽
  - 數據傾斜
  - 兩階段聚合
  - 加權平均
resources:
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看 AQE 的傾斜連接處理及適用邊界。
concepts:
  - id: bd-bench-05-salt
    prompt: 為何不能用 user_id 自己當該會員的鹽？
    answer: 同一會員所有列會得到同一鹽，熱門鍵並沒有被拆開。
    mcq:
      options:
        - 會得到相同鹽，不能拆開
        - 會漏掉所有冷門會員
        - 只會改列名
        - 不能在 GROUP BY 中分組
      answer: 0
      explain: 鹽值需由同鍵內會改變、可穩定重算的識別值導出。
  - id: bd-bench-05-merge
    prompt: 第一段按會員與鹽加總後，第二段如何交付會員總額？
    answer: 去掉鹽，用會員分組重加第一段的總額。
    mcq:
      options:
        - 取局部總和的最大值
        - 拿局部平均再平均
        - 依會員重加局部總和
        - 依鹽值重加局部總和
      answer: 2
      explain: 合併後的粒度仍是一會員一列，不能讓鹽留在輸出鍵。
    interview:
      question: 準備對一張熱門會員表加鹽，你先查什麼？
      points:
        - 確認鍵頻率及任務讀量
        - 區分聚合與連接
        - 驗正確性與額外傳輸
      answer: 我會先找是同一會員特別多列，還是某台工作者特別慢。若是可拆的聚合，先小範圍按鹽聚合再重加，驗逐鍵結果與 Shuffle 量；若是連接，另處理小側匹配，不能兩側各自亂加鹽。
  - id: bd-bench-05-mean
    prompt: 各鹽桶筆數不同，怎麼得出全體平均？
    answer: 把各桶總和相加，再除以各桶筆數之和。
    mcq:
      options:
        - 平均各桶平均值
        - 直接用最熱桶的平均
        - 局部總和相加除以局部筆數總和
        - 局部總和相加除以鹽桶數
      answer: 2
      explain: 桶的權重取決於筆數，不是每桶等重。
  - id: bd-bench-05-distinct
    prompt: 兩個鹽桶分別去重計數，為什麼不能直接把兩個數相加？
    answer: 同一個被計數的值可能出現在兩個鹽桶，加總仍會重複計入。
practice:
  - id: bd-bench-05-p1
    kind: explain
    title: 保存熱門會員的拆分核對
    minutes: 8
    steps:
      - 在 SQL 練習場完成本課兩題，保存會員 1 的總單數與總金額到 salting.md。
      - 另核對會員 1 的 4 個桶是否都使用，以及訂單 1011 為何不能算入。
    checks:
      - 會員 1 的已付款訂單在 4 個鹽桶皆有分布，合併後仍只有 1 列。
      - 結果不計取消單，且未將桶平均直接平均。
  - id: bd-bench-05-p2
    kind: sql
    category: [aggregate]
    title: 拆開後還原會員訂單數
    minutes: 7
    dataset: shop
    prompt: |
      在 `orders` 只看 `status = 'paid'`。只對會員 1 依 `order_id % 4` 拆桶，其餘會員鹽值為 0；先按會員與鹽值計數再合回。輸出 `user_id`, `order_count`，按 `user_id` 遞增。
    solution: |
      WITH salted AS (
        SELECT user_id, CASE WHEN user_id = 1 THEN order_id % 4 ELSE 0 END AS salt
        FROM orders WHERE status = 'paid'
      ), partial AS (
        SELECT user_id, salt, COUNT(*) AS n FROM salted GROUP BY user_id, salt
      )
      SELECT user_id, SUM(n) AS order_count FROM partial GROUP BY user_id ORDER BY user_id;
    explain: |
      外層 `SUM(n)` 加回桶裡已有的訂單數，`COUNT(*)` 只會得到桶數。DuckDB 判等只能驗結果；直接分組也會通過，練習時請保留兩段寫法。這裡的非負整數可用 `%`，Spark 有負數時可考慮 `pmod`。
    hints:
      - 先替熱門會員算一個穩定鹽值。
      - 外層回答一個會員，不是會員加鹽。
    check:
      ordered: true
      columnNames: true
    concepts:
      - bd-bench-05-salt
      - bd-bench-05-merge
      - sq-group-01-rows
    tags:
      - 加鹽
      - 分組聚合
  - id: bd-bench-05-p3
    kind: sql
    category: [aggregate, join]
    title: 合併總額與明細平均
    minutes: 8
    dataset: shop
    prompt: |
      用 `orders`、`order_items`，只納入已付款單。每明細金額是 `qty * unit_price`；對會員 1 以訂單 ID 除以 4 的餘數分桶，其餘為 0。先算局部金額與明細列數，再合為每會員。輸出 `user_id`, `total_amount`, `avg_line_amount`，最後一欄保留 2 位小數，依 `user_id` 遞增。
    solution: |
      WITH partial AS (
        SELECT o.user_id, CASE WHEN o.user_id = 1 THEN o.order_id % 4 ELSE 0 END AS salt,
               SUM(i.qty * i.unit_price) AS subtotal, COUNT(*) AS n
        FROM orders o JOIN order_items i ON i.order_id = o.order_id
        WHERE o.status = 'paid'
        GROUP BY o.user_id, salt
      )
      SELECT user_id, SUM(subtotal) AS total_amount,
             ROUND(SUM(subtotal) / SUM(n), 2) AS avg_line_amount
      FROM partial GROUP BY user_id ORDER BY user_id;
    explain: |
      平均的是明細列金額，不是訂單金額。若直接平均各鹽桶的 AVG，小桶被給了和大桶相同的權重。DuckDB 的 `/` 在這裡回傳非整數商；移植到會做整數除法的方言時明確轉型。
    hints:
      - 在第一階段保留 `SUM` 和 `COUNT`。
      - 到外層才執行除法。
    check:
      ordered: true
      columnNames: true
    concepts:
      - bd-bench-05-merge
      - bd-bench-05-mean
      - bd-bench-01-baseline
      - sq-group-08-weights
    tags:
      - 加權平均
      - 連接後聚合
---

## 拆開同一個鍵，再把答案合回來

一個大型會員有大量訂單。按 `user_id` 分組時，同一鍵送到同一目標分區，可能令某任務的傳輸與聚合特別重；這是數據傾斜（data skew）。先用逐任務讀量和鍵頻率證明確有偏斜，不能看見一個慢任務就修改鍵。對可分解的加總，加鹽（key salting）是先給該鍵多個子鍵，平行處理後再把局部結果合回來。

例如會員 1 有訂單 1001、1005、1006、1010。用 `order_id % 4` 作鹽值，得到 1、1、2、2。每個鹽桶整批加總，最後按原會員把兩桶重新相加。它不是保證四等分的雜湊；真實鍵先看位數或測試雜湊後分布。若只用會員本身做鹽，原本很熱的鍵仍落同一桶。若引擎已有局部聚合、負載不重，加一層分組反而可能更慢。

## 在同一份訂單上驗對，別把結果當叢集壓測

開本課 SQL 題的 `shop` 數據集（不需外部服務，可用 RAM 1 GB）。基本形式分三步：準備要聚合的列（保留原鍵與貢獻值），以 `GROUP BY user_id, salt` 算局部總量，再以 `GROUP BY user_id` 合併。先數訂單表的一單一列；再算成交金額時，連接後是一單多列，要以每筆明細的價乘量加總，局部同時保留各桶的明細列數。原始數據集的取消訂單仍有明細，不能把它算成成交。

總和可相加；平均要保留 `SUM` 與 `COUNT`，到最後才除。若需求是平均訂單額，應先還原一單一列，不可拿明細列數當分母。對精確去重計數，各桶可能包含同一個被數的值，直接加局部去重數也會錯。把這些反例放進問題，比單獨背「兩階段聚合」更有用。

分散式連接是另一道題：若左側把一個鍵攤到多個鹽桶，右側須按設計補足匹配，不能獨立任意加鹽。Spark 的自適應查詢執行可以處理一些偏斜連接，先查計畫與策略能否解決；這裡的 DuckDB 練習只檢查數學等價，不量 Spark Shuffle。

## 再想一個不能用同一規則合併的量

假設 A 桶有 9 條明細、平均 20 元，B 桶只有 1 條、平均 100 元。直接平均是 60 元；相加 180 與 100，再除以 10，才是 28 元。這不是四捨五入誤差，而是少了對每列同重的約束。驗證會員總額時，也同時保留排除取消單的證據，避免在拆鍵前少寫一項條件，最後看見結構正確就算通過。若和未加鹽的對照相同，代表數學驗收過了；是否需付另一層重分布，要拿實際多工作者負載另量。

在作品裡把「結果相等」與「在叢集上的效能待量」寫成兩句，不混用驗證範圍。

## 常見錯誤
- 最熱會員鹽值永遠相同 → 鹽由會員 ID 自己產生 → 改用可變的穩定列識別值。
- 輸出還有多筆同會員 → 第二階段仍按鹽分組 → 去鹽後再聚合。
- 平均值偏高 → 直接平均桶平均 → 相加總和和筆數後再除。
