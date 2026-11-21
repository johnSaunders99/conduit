---
id: sq-metrics-06
module: sq-metrics
order: 6
title: 複合指標與分母
subtitle: 退款率應除筆數還是金額
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-05
objectives:
- 分別計算按筆退款率與按金額退款率
- 在同 cohort、粒度與截止點比較分子和分母
tags:
- 退款率
- 分母
- 零分母
resources:
- title: dbt：比率指標
  url: https://docs.getdbt.com/docs/build/metrics-overview
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 numerator 和 denominator 的分開定義。
- title: MySQL：算術運算
  url: https://dev.mysql.com/doc/refman/8.4/en/arithmetic-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 核對除號、DIV 與除零。
concepts:
- id: sq-metrics-06-units
  prompt: 退過款的訂單數除以成交金額，是不是退款率？
  answer: 不是常用退款率；分子分母單位不一致。用單數除單數，或金額除金額。
  mcq:
    options:
    - 用兩個越大的數越準
    - 用所有退款筆數代替退款訂單
    - 配對相同單位
    - 兩種退款率必定相等
    answer: 2
    explain: 這兩個率各有問題要答，不應混成「張／元」。
- id: sq-metrics-06-cohort
  prompt: 1 月銷售中後來退過款的單，分母要用什麼？
  answer: 1 月同一批合格的已付款訂單，退款則在約定截止前歸回原單。
  mcq:
    options:
    - 全歷史訂單
    - 1 月退款事件數
    - 1 月每筆退款的金額
    - 同一批 1 月已付款訂單
    answer: 3
    explain: 率應基於共同母群（cohort），不能分子分母各挑不同日期口徑。
  interview:
    question: 營運看到退款率升高，你如何先確認數字？
    answer: 先問是在看退單率還是退款金額率，核對都是下單日的同一批訂單，且用相同退款截止點。逐單先聚合分次退款，再查看是否分母變小，而不是退款真的變多。
    points:
    - 區分筆數與金額
    - 同母群、同截止點
    - 零分母及分次退款
- id: sq-metrics-06-zero
  prompt: 已確認這天沒有任何成交，退款率要寫 0 嗎？
  answer: 分母為 0，率沒有定義，應保留 NULL 或用業務標記；有成交但沒有退款時率才是 0。
  mcq:
    options:
    - 分母為零時未定義
    - 一律填 0
    - 一律填 100%
    - 把分母設為 1
    answer: 0
    explain: 分母沒有樣本不是零退款率，不能用填值誤導。
practice:
- id: sq-metrics-06-p1
  kind: sql
  category: [model, aggregate]
  title: 算同一天有退款的訂單比例
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    以 2026-01-23 的 paid 訂單為分母；分子為至少有一筆退款的訂單數，使用共用數據的所有退款。輸出 paid_orders、refunded_orders、order_refund_rate（比例 0 至 1，不捨入），單列不需排序。
  solution: |
    WITH returned AS (SELECT DISTINCT order_id FROM refunds)
    SELECT COUNT(*) AS paid_orders, COUNT(r.order_id) AS refunded_orders,
           CAST(COUNT(r.order_id) AS DOUBLE) / NULLIF(COUNT(*), 0) AS order_refund_rate
    FROM orders o LEFT JOIN returned r USING (order_id)
    WHERE o.order_date = DATE '2026-01-23' AND o.status = 'paid';
  explain: |
    這天有 2 張已付單，1021 雖退了兩次仍只是一張；率是 1/2。用退款行數當分子就會誤算。
  hints:
  - 先把已退款訂單變成一單一列
  - 保留沒有退過的訂單
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-06-units
  - sq-metrics-06-cohort
  tags:
  - 退款率
  - 分母
  - 零分母
- id: sq-metrics-06-p2
  kind: sql
  category: [model, missing-values]
  title: 保留無成交日，算有截點的金額率
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    要比較 2026-01-12、01-23 兩個下單日。僅計 paid；品項金額為 qty × unit_price，退款只計 refund_date 早於 2026-01-29 的列，歸回原單。無銷售時金額顯示 0 且率 NULL。輸出 sales_day、gross_amount、refund_amount、amount_refund_rate（不捨入），依 sales_day 升冪。
  solution: |
    WITH days(sales_day) AS (VALUES (DATE '2026-01-12'), (DATE '2026-01-23')),
    gross AS (
     SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
    ), returned AS (
     SELECT order_id, SUM(amount) AS amount FROM refunds
     WHERE refund_date < DATE '2026-01-29' GROUP BY order_id
    ), daily AS (
     SELECT d.sales_day, COALESCE(SUM(g.gross),0) AS gross_amount,
            COALESCE(SUM(r.amount),0) AS refund_amount
     FROM days d LEFT JOIN orders o ON o.order_date = d.sales_day AND o.status = 'paid'
     LEFT JOIN gross g ON g.order_id = o.order_id
     LEFT JOIN returned r ON r.order_id = o.order_id
     GROUP BY d.sales_day
    )
    SELECT sales_day, gross_amount, refund_amount,
           CAST(refund_amount AS DOUBLE) / NULLIF(gross_amount,0) AS amount_refund_rate
    FROM daily ORDER BY sales_day;
  explain: |
    1 月 23 日用 15/780。1 月 12 日保留，兩筆金額為 0，率是 NULL。若忘了先將兩端聚合，退款會在多行品項上重複。
  hints:
  - 獨立建立日期清單
  - 退款和成交先各自聚合到訂單
  - 以 NULLIF 保護零分母
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-06-zero
  - sq-metrics-06-cohort
  - sq-metrics-06-units
  - sq-metrics-04-average
  tags:
  - 退款率
  - 分母
  - 零分母
---

營運問「退款率是多少？」對同一批單，按單數算可能是 50%，按金額算不到 2%。兩個結果可以同時正確，前提是知道分子和分母各是什麼。今天要交付兩個能用手算核對的比率，還要保留沒有成交的一天。

## 先用文字寫兩條公式

複合指標（composite metric）用已有指標再運算，例如把分子除以分母。上一堂的派生指標是在原子指標上加時間或業務條件。在這兩堂用這組名稱，避免把「只改篩選」和「用兩個指標相除」混為一談。

- 退單率（order refund rate）＝ 退過款的不同訂單數 ÷ 已付款訂單數。一次或分次退款，都只令該訂單計入一次。
- 退款金額率（amount refund rate）＝ 這批訂單的退款合計 ÷ 這批訂單的成交額合計。不是每日比率再平均，也不是退款件數除以成交額。
- 同批母群（cohort）要對齊：若分母是 1 月 23 日下單且已付的單，分子也只能取同一批單，在明定截止點前的退款。按入帳日統計當天退款是另一個問題。

在 `shop`，1 月 23 日的 1020、1021 共兩張已付單；1021 有 10 元與 5 元兩次退款。因此按單是 1/2，不是 2/2。成交總額是 780 元，按金額是 15/780。下面先查退款事件與訂單的單位差，並不是直接算整張報表。

```sql
SELECT COUNT(*) AS refund_rows, COUNT(DISTINCT order_id) AS refunded_orders,
       SUM(amount) AS refund_amount
FROM refunds WHERE order_id IN (1020, 1021);
```

## 零分母不代表零比率

以 `NULLIF(分母, 0)` 將零分母變為缺值，讓率也回 NULL。若分母大於零且分子為零，率才是 0。若是來源還沒到齊，更不能先填 0；之後在[〈空集合與預期零值〉](#/lesson/sq-audit-05)會把合法零和未收齊分開。先把分子、分母、率三欄一起留在報表，值班的人才能看到究竟是哪邊在變。用百分比顯示時才乘 100 或用介面格式，不要在儲存和展示各乘一次。

## 金額歸屬要先選一個時鐘

若週一賣一筆單，週四才退款，用下單日歸屬便會更新週一的銷售批次；用入帳日則會在週四看到退款現金流。這兩張報表都可以存在，卻不是用兩套時鐘各挑一半來組同一個率。作為驗收，先用短截止點算一次，再將截止後移，核對原先的成交分母是否相同、退款分子增加是否符合入帳明細。若分子比成交額還多，先檢查樣本的退款認列規則與是否重複相接，不應強制把率截在百分之百。

日後營運改用退款入帳日看現金流，應另做指標或清楚改名字。保留兩份查詢的日期欄與單位，不能將只算今天退款的金額直接和今天成交額相除，然後與按單歸屬的率混在同一走勢。

## 常見錯誤

- 同一單退兩次被算兩張 → 以退款事件數當分子 → 用訂單鍵去重。
- 同一份報表金額加倍 → 明細和退款直接接後求和 → 先逐單各自聚合。
- 沒成交也顯示 0% → 將未定義的率直接補零 → 先用 `NULLIF` 區分。

## 方言與面試

DuckDB 的整數 `/` 可得小數，PostgreSQL 的整數除法會截斷；移植時明確轉成適當小數型別。MySQL 用 `/` 而非 `DIV`，Spark SQL 也應先明寫零分母策略，不靠模式設定決定會報錯或回缺值。選引擎之前，先把率的定義和上述兩個手算值交給同事。
