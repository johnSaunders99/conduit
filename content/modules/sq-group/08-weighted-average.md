---
id: sq-group-08
module: sq-group
order: 8
title: 加權平均
subtitle: 不能直接平均每日客單價
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-07
objectives:
- 由各組的分子與分母重算整體平均
- 用一組筆數不相等的日期驗證不能直接平均每日平均
- 用有值的權重與 NULLIF 處理空分母
tags:
- 加權平均
- sum
- 平均的平均
- 分子分母
resources:
- title: Aggregate Functions
  url: https://duckdb.org/docs/stable/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 weighted_avg 與普通 avg 的輸入規則。
- title: MySQL Arithmetic Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/arithmetic-functions.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 核對除法結果類型與零分母行為。
concepts:
- id: sq-group-08-weights
  prompt: 為什麼不應直接把每日客單價再平均？
  answer: 不同日的訂單張數不同；整體客單價要用總金額除總訂單數。
  mcq:
    question: 一天 1 張共 100 元，另一天 3 張共 180 元，整體客單價多少？
    options:
    - 80 元
    - 140 元
    - 60 元
    - 70 元
    answer: 3
    explain: 100 與 60 的普通平均是 80；整體是 280 除 4，給每張單同樣權重。
- id: sq-group-08-unit
  prompt: 每列是成交品項，算每件平均單價的分母是什麼？
  answer: 件數總和，而不是明細列數。
  mcq:
    question: 一列 3 件每件 45 元，另一列 1 件每件 90 元，每件平均是多少？
    options:
    - 67.5 元
    - 56.25 元
    - 112.5 元
    - 225 元
    answer: 1
    explain: 先分別乘件數後加總為 225 元，再除 4 件。
- id: sq-group-08-null
  prompt: 某組單價缺值且要排除，對應的件數仍應進分母嗎？
  answer: 不應；沒有參與分子的數據也不能當成分母的權重，除非口徑明訂缺值為零。
  mcq:
    question: 一組單價未知，規格排除該組。計每件均價時怎麼處理它的件數？
    options:
    - 只進分母
    - 只進分子
    - 一律用 0 元代入
    - 不進兩邊，依同一個有效條件篩選
    answer: 3
    explain: 只加分母會隱含沒計金額卻參與平均，令均價偏低。
- id: sq-group-08-save
  prompt: 日報應保留哪兩個欄位，讓之後能重算期間平均？
  answer: 未先捨入的合計和值對應的樣本數，例如總金額與訂單張數。
  interview:
    question: 昨天有一單，今天有三單，主管要求取兩天「平均」。你怎麼確認？
    answer: 我先問要每個營業日同等權重，還是每張訂單同等權重。前者可以平均兩個日均；算整體客單價，我會用合計金額除張數，並保留這兩個小計方便覆核。
    points:
    - 先問平均的單位
    - 能重算不等權重結果
practice:
- id: sq-group-08-p1
  kind: sql
  category: [aggregate, expression]
  title: 每件成交價核對
  minutes: 5
  level: 1
  dataset: shop
  prompt: 用 `order_items` 的 1001 號訂單交付一列，按欄序輸出 `total_amount`（元金額）、`total_units`（件數）、`avg_unit_price`（每件平均成交價，元，不捨入；零分母為 NULL）。不排序。
  starter: 'SELECT '
  solution: |
    SELECT SUM(qty * unit_price) AS total_amount,
           SUM(qty) AS total_units,
           SUM(qty * unit_price) / NULLIF(SUM(qty), 0) AS avg_unit_price
    FROM order_items
    WHERE order_id = 1001;
  explain: 兩列分別貢獻 135 元及 90 元，共 4 件；225 除以 4 是 56.25。直接平均兩個單價會把 3 件和 1 件當成相同權重。
  hints:
  - 分子加總明細金額
  - 分母加總件數
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-08-unit
  - sq-group-08-null
  - sq-group-02-unit
  - sq-expr-08-zero
  tags:
  - 加權平均
  - sum
  - 平均的平均
- id: sq-group-08-p2
  kind: sql
  category: [aggregate]
  title: 退款日平均的核對小計
  minutes: 5
  level: 1
  dataset: shop
  prompt: 在 `refunds` 只取 2026-02-08 和 2026-02-12。每個退款日一列，依此欄序輸出 `refund_date`、`refund_total`（退款元金額合計）、`refund_rows`（有金額的退款筆數）、`avg_refund`（平均每筆退款元金額，不捨入）。依 `refund_date` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT refund_date, SUM(amount) AS refund_total,
           COUNT(amount) AS refund_rows, AVG(amount) AS avg_refund
    FROM refunds
    WHERE refund_date IN (DATE '2026-02-08', DATE '2026-02-12')
    GROUP BY refund_date
    ORDER BY refund_date;
  explain: 8 日有 2 筆共 15 元，12 日有 1 筆共 10 元。先存下小計與筆數，避免只交付 7.5 與 10 而無法正確合併。
  hints:
  - 分組後保留分子與分母
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-08-weights
  - sq-group-08-save
  - sq-group-03-key
  - sq-group-01-rows
  tags:
  - 加權平均
  - sum
  - 平均的平均
- id: sq-group-08-p3
  kind: sql
  category: [aggregate]
  title: 重算兩天的平均每筆退款
  minutes: 7
  level: 2
  dataset: shop
  prompt: 只用 `refunds` 的 2026-02-08 和 2026-02-12 計算兩日合併後每筆退款的平均金額。依次輸出 `total_refund`（元合計）、`refund_count`（有金額的筆數）、`weighted_refund_avg`（每筆退款的平均元金額，不捨入；零分母為 NULL），只交付一列，不排序。
  starter: 'SELECT '
  solution: |
    SELECT SUM(amount) AS total_refund, COUNT(amount) AS refund_count,
           SUM(amount) / NULLIF(COUNT(amount), 0) AS weighted_refund_avg
    FROM refunds
    WHERE refund_date IN (DATE '2026-02-08', DATE '2026-02-12');
  explain: 兩日一起是 25 元、3 筆，約 8.3333 元；8.75 是兩個日期同權重的平均。先用前題小計手算，再用整批明細核回。
  hints:
  - 不同日期筆數不等
  - 合併時把分子、分母分別加總
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-08-weights
  - sq-group-08-null
  - sq-group-08-save
  - sq-expr-08-division
  tags:
  - 加權平均
  - sum
  - 平均的平均
---

## 一天一票，還是一張訂單一票？

第一天只有 1 張單，金額 100 元；第二天有 3 張，合計 180 元。每天客單價分別 100 元與 60 元，兩個日期各給一票，平均是 80 元。但問題若是「這兩天每張單平均多少」，應是 280 除 4，得到 70 元。數字不同並非誰算術錯了，而是平均的對象變了。加權平均（weighted average）按每個值代表的份量來算；份量稱為權重（weight）。

## 算式速查

- 對明細單價與件數：`SUM(qty * unit_price) / NULLIF(SUM(qty), 0)`。每件同樣重要，每列不一定同樣重要。
- 對每日金額與張數：先加總各日金額，再除以各日張數合計。若手邊只有已捨入的每日平均，乘回張數可能得不到原金額。
- 問平均每筆已知金額，用有值的筆數當分母。若單價未知而且口徑排除未知，那筆的件數也不應進分母。
- 跨組合併要留未先捨入的分子、分母；報表要的捨入在最後做。分母是 0 時，先轉 NULL，不誤報平均為零。

數據集：`shop`。用一張已知有兩筆明細的單驗算：

```sql
SELECT SUM(qty * unit_price) AS total_amount,
       SUM(qty) AS total_units,
       SUM(qty * unit_price) / NULLIF(SUM(qty), 0) AS avg_unit_price
FROM order_items
WHERE order_id = 1001;
```

小杯 3 件，每件 45 元，濾網 1 件，每件 90 元，應得 225 元、4 件、每件 56.25 元。`AVG(unit_price)` 給 67.5 元，是把兩個品項的單價各算一票。再驗證極端情況：若兩列件數都剛好是 1，兩種寫法會相同，所以測試不能只放單件訂單，否則看不出分母用錯。報表欄名要說明是每件、每項還是每張單。

## 日報要留下什麼，月報才算得回來

在退款題，2 月 8 日有 5、10 元兩筆，2 月 12 日只有 10 元一筆。每天各算一次平均得到 7.5、10，再普通平均是 8.75；用總額除總筆數則是 25 除 3。先看日小計，再跑合併查詢，比較兩個值。將來若只有每日摘要，只要保留 15 元與 2 筆、10 元與 1 筆，就能重算。不必把每天的比率平均，也不能只用每日平均而丟掉分母。之後在 [CTE 命名步驟](#/lesson/sq-compose-04) 再把每日小計接到期間查詢。

**換引擎怎麼說：**DuckDB 提供 `weighted_avg(value, weight)`，但面試把兩個 SUM 寫出來，更容易讓人核對口徑，也移植到 MySQL 時不依賴同名函式。移植時不寫 `DIV` 或 `//`，而且要核對輸入類型、零分母與缺值權重，不能只比較一個碰巧整除的樣本。

若主管真的要「平均一個營業日的客單價」，也先說清楚沒有訂單的日子怎麼處理，不能自動補 0 元再平均。沒有樣本和觀察到平均為 0 是不同狀態。評估兩種定義時，用不同筆數的兩天來驗證；如果每一天單量剛好相同，報表兩種算法會得一樣的值，無法證明採用的是正確口徑。

## 常見錯誤

- **小量日期影響太大** → 對每天均值各給一票 → 每筆同權重時應用總額除總筆數。
- **未知項目拉低平均** → 權重留在分母但單價不在分子 → 先對齊有值範圍。
- **月平均與明細重算差一點** → 用捨入後的日平均乘回筆數 → 保留未捨入的分子與分母。
