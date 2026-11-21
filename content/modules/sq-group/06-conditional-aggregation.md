---
id: sq-group-06
module: sq-group
order: 6
title: 條件聚合
subtitle: 同一張日報並排付款與取消
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-05
objectives:
- 用 CASE 搭配 COUNT 或 SUM 在同一組算多種指標
- 保留只有付款、沒有取消的日子並顯示已知零
- 區分訂單取消數和退款金額的來源
tags:
- 條件聚合
- case
- count
- sum
- filter
resources:
- title: Aggregate Functions
  url: https://duckdb.org/docs/stable/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看聚合 FILTER 與 count 的缺值規則。
- title: Spark SQL GROUP BY Clause
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-groupby.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 Spark SQL 的 FILTER 放在聚合呼叫後。
concepts:
- id: sq-group-06-count
  prompt: COUNT(CASE WHEN 條件 THEN 1 END) 如何只數命中列？
  answer: 命中輸出 1，未命中為 NULL；COUNT 只數有值。
  mcq:
    question: 如果加上 ELSE 0，COUNT 會怎樣？
    options:
    - 只數命中列
    - 只數未命中列
    - 命中與未命中都會數
    - 一定報錯
    answer: 2
    explain: 1 與 0 都不是 NULL；想用 1 加 0 要改用 SUM。
- id: sq-group-06-sum
  prompt: 用 SUM 算命中列數時，未命中該回什麼？
  answer: 可回數字 0：有輸入但整組未命中時，合計是已知的 0。
  mcq:
    question: 一個有 2 筆付款、0 筆取消的日組，取消計數應是多少？
    options:
    - '0'
    - 'NULL'
    - '2'
    - 整組不應顯示
    answer: 0
    explain: 只要日組有輸入，SUM 的兩個 0 得 0，或用 COUNT 忽略兩個 NULL。
- id: sq-group-06-scope
  prompt: 何時不能先 WHERE status = 'paid'？
  answer: 同一份結果若還要算取消，先只保留付款會使取消列無法參與任何聚合。
  mcq:
    question: 同一天要看付款與取消，日期指定後，哪種輸入可支援兩個指標？
    options:
    - 兩個狀態都保留，用 CASE 在各指標判斷
    - 只留付款，再由 COUNT 還原取消
    - 只留取消，再把付款寫成 0
    - 兩種狀態分別去掉再做分組
    answer: 0
    explain: 共用 WHERE 濾掉的列不會進任何指標。
- id: sq-group-06-money
  prompt: 退款金額和取消訂單張數能對成同一個指標嗎？
  answer: 不能；退款是一筆入帳金額，取消是訂單狀態。退款表同一張單還可能分次退款。
  interview:
    question: 日報上的取消數每天都為零，要先查什麼？
    answer: 先查 WHERE 有沒有只保留付款。如果要同時算付款與取消，日期可在 WHERE 篩，兩個狀態要留給各自的 CASE，再找一日確有取消的例子試跑。
    points:
    - 共同篩選只排掉所有指標都不需要的列
    - 用有取消與無取消的組各驗一次
practice:
- id: sq-group-06-p1
  kind: sql
  category: [aggregate, pivot]
  title: 營業日狀態雙欄
  minutes: 5
  level: 1
  dataset: shop
  prompt: 在 `orders` 取 2026-01-17 到 2026-01-20（含）。按日輸出 `order_date`、`paid_orders`、`cancelled_orders`，依此欄序和日期升冪；有訂單但沒有某狀態時，該狀態的張數為 0。
  starter: 'SELECT '
  solution: |
    SELECT order_date,
           SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
    FROM orders
    WHERE order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-20'
    GROUP BY order_date
    ORDER BY order_date;
  explain: 18 日有 1 張付款及 1 張取消；17 日有 2 張付款及 0 張取消。不能先篩掉任何一種，再填出看似合理的零列。
  hints:
  - 同時保留兩種狀態
  - SUM 可以把每筆的 1 或 0 加總
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-06-sum
  - sq-group-06-scope
  - sq-expr-03-first
  - sq-group-03-key
  tags:
  - 條件聚合
  - case
  - count
- id: sq-group-06-p2
  kind: sql
  category: [aggregate]
  title: 退款分門檻核對表
  minutes: 7
  level: 2
  dataset: shop
  prompt: 在 `refunds` 取 2026-01-25 至 2026-02-09（含）。每個有退款的入帳日一列；依序輸出 `refund_date`、`refund_rows`（退款筆數）、`large_rows`（金額至少 10 元的筆數）、`large_amount`（這些筆的金額總和，無則 0）。依 `refund_date` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT refund_date,
           COUNT(*) AS refund_rows,
           COUNT(CASE WHEN amount >= 10 THEN 1 END) AS large_rows,
           SUM(CASE WHEN amount >= 10 THEN amount ELSE 0 END) AS large_amount
    FROM refunds
    WHERE refund_date BETWEEN DATE '2026-01-25' AND DATE '2026-02-09'
    GROUP BY refund_date
    ORDER BY refund_date;
  explain: 1 月 28 日有 5 元退款，仍要顯示該日，但 `large_rows` 與 `large_amount` 都是 0。先在 WHERE 剔除小額退款會漏整天。
  hints:
  - 門檻只限制兩個大額指標
  - COUNT 若用 CASE，不加 ELSE 0
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-06-count
  - sq-group-06-sum
  - sq-group-06-money
  - sq-group-02-unit
  - sq-group-04-phase
  tags:
  - 條件聚合
  - case
  - count
---

## 同一批列，回答兩個問題

營運要看的不是「每天付款有幾張」一欄，而是同一天並排付款與取消。先篩掉取消的做法不再適合，因為查詢裡就沒有取消列了。條件聚合（conditional aggregation）讓每個聚合各自決定如何接納同一批輸入。日期是共用條件，付款與取消則是不同欄的各自條件。

## 語法速查

- `SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`：付款列給 1，其他給 0，再加總。
- `COUNT(CASE WHEN status = 'paid' THEN 1 END)`：付款列給 1，其他給 NULL，再數有值列。刻意不寫 `ELSE 0`。
- `SUM(CASE WHEN amount >= 10 THEN amount ELSE 0 END)`：達門檻時加該筆金額，不達時加零；這是金額，不是筆數。
- DuckDB 也能寫 `COUNT(*) FILTER (WHERE status = 'paid')`，把條件放在單一聚合上，而不是整個查詢的 `WHERE`。

數據集：`shop`。同時輸出三個數以核對：

```sql
SELECT order_date, COUNT(*) AS total_orders,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_orders,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
FROM orders
WHERE order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
GROUP BY order_date
ORDER BY order_date;
```

18 日是總數 2、付款 1、取消 1；17 和 19 日都是 2、2、0。這個表的狀態只有兩種，因此兩種計數應加回總數。若來源後來多了待付款，這個等式就需要加上新狀態，不能把差額都歸咎於查詢。若某日完全沒有訂單，分組不會發明一列；與有訂單但某種狀態為零是兩種情況。本堂用有輸入的日組驗證零。

## 同一種寫法，不代表同一個業務口徑

一筆取消單是訂單狀態；一次退款是在某日入帳的一筆金額。同一已付款訂單可能分兩筆退款。要交付退款報表，應以退款表的 `refund_date` 和 `amount` 計算，不能把取消張數當成退款筆數。這次先各自算清楚；下個階段若要求同表對帳，會在[多對多膨脹](#/lesson/sq-join-07)用多筆明細和多次退款示範為何不能直接接上就加總。

**換引擎怎麼說：**Spark SQL 支援聚合後的 `FILTER (WHERE …)`；MySQL 可用本堂的 `SUM(CASE …)` 或 `COUNT(CASE …)`。移植到沒有 FILTER 的引擎時，重點是讓未命中行在 COUNT 變 NULL、在需要已知零的 SUM 變 0，不是任意把兩種寫法替換。

把日期只留 18 日，再逐列寫下兩個指標各收到什麼。一張付款在付款 COUNT 交出 1，在取消 SUM 交出 0；另一張取消在付款 COUNT 交出 NULL，在取消 SUM 交出 1。合併後兩個值都是 1。改成付款 COUNT 的未命中值也回 0，這次就會錯算成 2。這個反例說明兩個函式的差別和付款狀態本身無關。

退款有另一種驗法：有一筆 5 元的 1 月 28 日，金額門檻為 10 元時，大額筆數和大額合計都是 0，但總退款筆數仍是 1。若門檻放在整個查詢的 WHERE，連那個日期也不見了。先說哪些群組報表該保留，再說每個指標該收哪些數；兩件事分開，查到零才知道是沒有命中，還是整天未入選。若只是為一個指標出表，可以用 WHERE 限定它；多欄合併不是一律禁止篩選，而是每一個被刪掉的輸入要對所有欄都無用。

## 常見錯誤

- **每種狀態都顯示總訂單數** → COUNT 的 ELSE 寫了 0 → 省略 ELSE 或改用 SUM 加 1 與 0。
- **取消永遠為 0** → WHERE 先排除了取消 → 共用篩選只限制日期。
- **退款合計變成退款筆數** → SUM 加了固定 1 → 在符合時加 `amount`。
