---
id: sq-audit-05
module: sq-audit
order: 5
title: 空集合與預期零值
subtitle: 沒有異常與沒有輸入不同
status: ready
minutes: 30
level: 2
prereqs:
- sq-audit-04
objectives:
- 用 COUNT 與 SUM 分辨空輸入、空值和零
- 從批次完成狀態與各日計數產出三種結果
tags:
- 空集合
- 補零
- 批次完成
resources:
- title: Spark SQL：聚合與 NULL
  url: https://spark.apache.org/docs/latest/sql-ref-null-semantics.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 COUNT、SUM 在空輸入中的差異。
- title: Spark SQL：內建函式
  url: https://spark.apache.org/docs/latest/sql-ref-functions-builtin.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 查 COUNT、SUM、COALESCE 的定義。
concepts:
- id: sq-audit-05-aggregate
  prompt: 沒有符合的退款列時，不分組的 COUNT(*) 和 SUM(amount) 各回什麼？
  answer: 聚合查詢仍回 1 列；COUNT(*) 為 0，SUM 為 NULL。
  mcq:
    options:
    - 0 列
    - 1 列，COUNT 為 0、SUM 為 NULL
    - 兩欄都是 0
    - 兩欄都是 NULL
    answer: 1
    explain: COUNT 數列；SUM 在沒有非空值時並不宣告總額為零。
- id: sq-audit-05-manifest
  prompt: 來源還沒交齊時，應不應把未見到的取消單顯示為 0？
  answer: 不應；標記待到齊，保留缺值。收齊後沒符合事件才可依口徑填 0。
  mcq:
    options:
    - 只要 COUNT 為 0 就宣告正常
    - NULL 等於零，兩者應相同
    - 完整後才能判定零
    - 有任一單就一定到齊
    answer: 2
    explain: 必須從獨立的批次完成訊號確認分母或來源範圍。
  interview:
    question: 日報顯示 0 筆異常，怎麼知道不是上游沒來？
    answer: 我會同時看預期批次有沒有交齊，必要時比入庫列數和截止點。若未到齊就標成 pending，不發布 0；如果確實完整但沒有異常，才交零值並留核對紀錄。
    points:
    - 獨立完成訊號
    - 未到齊保留待確認
    - 合法零值才發布
- id: sq-audit-05-outercount
  prompt: 日期左連接訂單，無匹配日期用 COUNT(*) 為何得到 1？
  answer: 左表的日期列仍在，右欄只是補空；應計數右表的非空鍵。
  mcq:
    options:
    - SUM 會把 NULL 變成 1
    - COUNT 一律最小值為 1
    - ORDER BY 增加一列
    - 左側保留一列，改數右鍵
    answer: 3
    explain: 預期日期是刻度，不是每個日期必定有一筆訂單。
practice:
- id: sq-audit-05-p1
  kind: sql
  category: [reconcile, missing-values]
  title: 觀察沒有退款的總計
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    只查訂單 1001 在 refunds 的數據。不分組輸出 1 列，欄位依序為 refund_rows（所有退款列數）、refund_amount（未補零的 SUM），只有一列不需排序。
  solution: |
    SELECT COUNT(*) AS refund_rows, SUM(amount) AS refund_amount
    FROM refunds WHERE order_id = 1001;
  explain: |
    這是 0 筆、金額 NULL 的聚合列，不是空結果。若加 GROUP BY order_id 並且沒有輸入，整個結果會沒有列。
  hints:
  - 不要 GROUP BY
  - 不要先 COALESCE
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-05-aggregate
  tags:
  - 空集合
  - 補零
  - 批次完成
- id: sq-audit-05-p2
  kind: sql
  category: [reconcile, missing-values]
  title: 區分正常零、觀察值和待到齊
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    以 2026-01-12、01-13、01-18 為預期日期，完成狀態依序為否、是、是。對 orders 算每日期取消單數；未到齊即使查無單也輸出 NULL 和 pending，已到齊且沒有取消單輸出 0 和 zero，有取消單輸出列數和 observed。輸出 business_day、cancelled_orders、day_state，依 business_day 升冪。
  solution: |
    WITH wanted(business_day, complete) AS (
     VALUES (DATE '2026-01-12', FALSE), (DATE '2026-01-13', TRUE), (DATE '2026-01-18', TRUE)
    )
    SELECT w.business_day,
           CASE WHEN w.complete THEN COUNT(o.order_id) END AS cancelled_orders,
           CASE WHEN NOT w.complete THEN 'pending'
                WHEN COUNT(o.order_id) = 0 THEN 'zero' ELSE 'observed' END AS day_state
    FROM wanted w LEFT JOIN orders o ON o.order_date = w.business_day AND o.status = 'cancelled'
    GROUP BY w.business_day, w.complete ORDER BY w.business_day;
  explain: |
    日期是左表，取消條件放在 ON 而不是 WHERE；COUNT 右表鍵才不會把補空列當訂單。完成旗標用題內給的清單，不從查到幾筆猜。
  hints:
  - 先用日期清單保留 3 日
  - 計右側非空訂單鍵
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-05-manifest
  - sq-audit-05-outercount
  - sq-audit-05-aggregate
  tags:
  - 空集合
  - 補零
  - 批次完成
---

營運看到退款顯示 0，以為沒有異常。值班同事卻說來源批次沒進來。兩件事不應用同一個數字表示：到齊才有資格宣告零，否則只是目前沒有觀測到。今天輸出一列狀態，讓報表讀者知道該信、還是該等。

## 先分三種空

- 空結果（empty result）：查詢回 0 列。沒有符合條件的事件，或來源還沒送，外觀看起來都可能一樣。
- 空值（NULL）：有一列，但欄位沒有可用值。不分組聚合時，空輸入的 `COUNT(*)` 是 0、`SUM` 是 NULL；若有輸入但金額全空，`SUM` 也會是 NULL。
- 預期零值（expected zero）：已確認來源完整，在已知條件下沒有符合的事件。這時「0 筆」才能成為可發布的結果。

在 `shop` 試下面的查詢。訂單 1001 沒有退款，結果仍有一列。如果要知道有沒有其他正規數字，再拿已知有兩筆退款的 1021 做對照。不要把查詢工具回的一列當成有一筆退款。

```sql
SELECT COUNT(*) AS refund_rows, SUM(amount) AS refund_amount
FROM refunds WHERE order_id = 1001;
```

## 先接預期日期，再根據輸入完整性補零

用日期清單當左表，左連接當天的取消單；條件放連接中，避免把沒有單的日期去掉。接著數右表非空的訂單鍵。最後另接批次完成狀態（batch completeness）：例如入庫清冊明列預期檔案已全部交齊，或所有來源標記已到相同截止點。清冊的完成與否不能用結果同一欄來推導。

你最後要看見三種結果：應報但未到齊，狀態待確認且金額或次數空著；已到齊且沒事件，才報合法零；已到齊且有事件，報觀察值。即使有部分可用的數據，仍可能是未完成，不要把有幾筆等同於收齊。把「完整」的規則和數字一起寫進交接，報表發出後才有根據重算。

## 用三筆交接格式驗口徑

試著為昨天列出「日期、狀態、計數」三欄，再做一個已到齊有異常的正例，和一個來源未到齊的反例。沒有完整訊號卻有一兩筆取消也不能發布成確定值；它可以放在內部觀察面板，別與正式值混用。若來源確認到齊但是加總欄全空，應找欄位是否失效，不宜僅靠零值顯示掩蓋。這就區分了「批次層是否完整」與「欄位層是否可用」。在值班交接裡把兩個判斷及截止點寫開，收到追加的內容才知道哪一天要重算。

讀者因此能區分應等待的狀態。

## 常見錯誤

- 日報少一個日期 → 在 `WHERE` 排除了右側 NULL → 改在 `ON` 篩選。
- 沒單也出現 1 → 數了左側保留的日期列 → 數右側訂單鍵。
- 沒到齊顯示 0 → 過早 `COALESCE` → 先判斷到齊，再決定是否顯示零。

## 方言與面試

Spark SQL、MySQL 跟 DuckDB 在此處的 `COUNT(*)` 與 `SUM` 有同樣的空輸入區別。條件聚合移植到 MySQL 時，可用 `CASE WHEN` 來表達，不要照抄 DuckDB 的聚合 `FILTER` 語法。面試時先交代獨立的完成訊號，再解釋補零怎麼做；單靠 SQL 補值無法補出沒收到的數據。
