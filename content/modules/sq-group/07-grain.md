---
id: sq-group-07
module: sq-group
order: 7
title: 分組粒度
subtitle: 先確認每列是一張單還是一筆退款
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-06
objectives:
- 寫出輸入與輸出的粒度，並選對分組鍵
- 用同一批退款驗證每單與每日的合計能互核
- 用明細列數、訂單張數和商品件數拆解指標
tags:
- 粒度
- 分組鍵
- 訂單明細
- 對帳
resources:
- title: GROUP BY Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/groupby
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看聚合後每組一列的基本規則。
- title: Spark SQL GROUP BY Clause
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-groupby.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照多分組鍵與 GROUPING SETS 介紹。
- title: MySQL GROUP BY Modifiers
  url: https://dev.mysql.com/doc/refman/8.4/en/group-by-modifiers.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 查 WITH ROLLUP 的層級小計。
concepts:
- id: sq-group-07-grain
  prompt: 退款表每筆退款一列，想變成每張有退款的單一列，分組鍵是什麼？
  answer: 原訂單鍵 order_id。
  mcq:
    question: 要出一張單一列的退款合計，哪個鍵組合正確？
    options:
    - order_id
    - refund_id
    - refund_date
    - order_id, refund_date
    answer: 0
    explain: 同一單可能不同日分次退款；把日期加進鍵就會分裂。
- id: sq-group-07-reconcile
  prompt: 按訂單和退款日得到不同列數，什麼情況下合計應一樣？
  answer: 同一批明細、同一個可加總金額、每筆只進一組。
  mcq:
    question: 同批退款按訂單或日期各加總一次，哪個一定一致？
    options:
    - 列數
    - 每組平均值
    - 各組金額再加總的總額
    - 各組去重訂單數再相加
    answer: 2
    explain: 金額在本例可加；不同鍵改變組數，平均與去重不可直接加。
- id: sq-group-07-lines
  prompt: 在 order_items 用 COUNT(*) 得到的是什麼？
  answer: 明細列數。數張單用訂單鍵；數件數用 qty 加總。
  mcq:
    question: 訂單 1001 有明細 3 件與 1 件。數兩列得到的 2 代表什麼？
    options:
    - 成交商品件數
    - 明細列數
    - 不同訂單張數
    - 兩筆退款事件
    answer: 1
    explain: 一張單可有多列，每列也可有多件，不能互換單位。
- id: sq-group-07-multi
  prompt: 何時應同時按日期與訂單分組？
  answer: 需要每個有退款的日與訂單搭配一列時；只要整張訂單一列就不要加日期。
  interview:
    question: 退款合計正常，退款訂單數卻偏高，你會怎麼查？
    answer: 我先寫下來源一列是退款事件，不是訂單。挑一張分兩天退款的單，看是否在日報被算兩次。金額可以跨日加，但全期退款訂單數要以整期的 order_id 去重。
    points:
    - 說清退款事件和原訂單的粒度
    - 區分可加金額與不可直接加的人數或訂單數
practice:
- id: sq-group-07-p1
  kind: sql
  category: [aggregate, model]
  title: 每張有退款的訂單摘要
  minutes: 5
  level: 1
  dataset: shop
  prompt: 只查 `refunds` 中退款日 2026-01-25 至 2026-01-29（含）。每張在這段期間有退款的訂單一列，欄序為 `order_id`、`refund_events`（筆數）、`refund_yuan`（合計元），依 `order_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT order_id, COUNT(*) AS refund_events, SUM(amount) AS refund_yuan
    FROM refunds
    WHERE refund_date BETWEEN DATE '2026-01-25' AND DATE '2026-01-29'
    GROUP BY order_id
    ORDER BY order_id;
  explain: 1021 在兩天各退款一筆，仍應是一列 2 筆、15 元。若把 refund_date 加進分組鍵就會拆成兩列。
  hints:
  - 日期用來篩選，不一定用來分組
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-07-grain
  - sq-group-07-multi
  - sq-group-02-unit
  - sq-group-03-key
  tags:
  - 粒度
  - 分組鍵
  - 訂單明細
- id: sq-group-07-p2
  kind: sql
  category: [aggregate, model]
  title: 按單價核對件數與訂單數
  minutes: 7
  level: 2
  dataset: shop
  prompt: 從 `order_items` 選訂單 1001 到 1009（含），按成交單價（元）分組。依序輸出 `unit_price`、`line_rows`（明細列數）、`order_count`（不同訂單數）、`units_sold`（件數合計）。依 `units_sold` 降冪，同件數按 `unit_price` 升冪。只核對指定單號，不另連接其他表。
  starter: 'SELECT '
  solution: |
    SELECT unit_price, COUNT(*) AS line_rows,
           COUNT(DISTINCT order_id) AS order_count, SUM(qty) AS units_sold
    FROM order_items
    WHERE order_id BETWEEN 1001 AND 1009
    GROUP BY unit_price
    ORDER BY units_sold DESC, unit_price ASC;
  explain: 一筆明細可能多件，一張單也可能有兩筆同價明細。1007 的兩筆同為 60 元，在 60 元那組是 2 列、1 張單、4 件。
  hints:
  - 同單價的明細放一組
  - 分別計列、不同單號及件數
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-07-lines
  - sq-group-07-grain
  - sq-group-05-entity
  - sq-read-03-tie
  tags:
  - 粒度
  - 分組鍵
  - 訂單明細
- id: sq-group-07-p3
  kind: sql
  category: [aggregate, model]
  title: 同批退款改看每日入帳
  minutes: 6
  level: 2
  dataset: shop
  prompt: 只查 `refunds` 中退款日 2026-01-25 至 2026-01-29（含）。每個有退款的入帳日一列；欄序是 `refund_date`、`refund_events`（筆數）、`refund_yuan`（合計元），依 `refund_date` 升冪。和第一題小計互核。
  starter: 'SELECT '
  solution: |
    SELECT refund_date, COUNT(*) AS refund_events, SUM(amount) AS refund_yuan
    FROM refunds
    WHERE refund_date BETWEEN DATE '2026-01-25' AND DATE '2026-01-29'
    GROUP BY refund_date
    ORDER BY refund_date;
  explain: 25、28、29 日各一筆，金額 10、5、10 元；加回 25 元，和按訂單的 15、10 元相同，但不能將日報列數當成退款單數。
  hints:
  - 只換分組鍵
  - 日期篩選應跟第一題完全相同
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-07-reconcile
  - sq-group-07-multi
  - sq-read-08-inclusive
  tags:
  - 粒度
  - 分組鍵
  - 訂單明細
---

## 每一列代表什麼，先寫在報表頂端

會計拿到兩份退款摘要，列數不同，但金額一樣。其中一張按原訂單，一張按入帳日，都可以正確。粒度（grain）是「一列代表的事物」；台灣也稱顆粒度。本堂在同一批退款上用兩種分組方式，親手核出相同總額和不同列數。換粒度是換問題，不是替輸出美化版面。

## 分組鍵速查

- `GROUP BY refund_id`：每次退款一列；在此表該鍵本來就唯一。
- `GROUP BY order_id`：每張在範圍內有退款的原訂單一列。
- `GROUP BY refund_date`：每個有退款入帳的日子一列。
- `GROUP BY order_id, refund_date`：每個實際發生的訂單與入帳日組合一列。不能稱作一張原訂單一列，只是每張單在每一天的摘要。

數據集：`shop`。先按訂單核對 1 月 25 到 29 日的退款：

```sql
SELECT order_id, COUNT(*) AS refund_events, SUM(amount) AS refund_yuan
FROM refunds
WHERE refund_date BETWEEN DATE '2026-01-25' AND DATE '2026-01-29'
GROUP BY order_id
ORDER BY order_id;
```

1021 有 2 筆、15 元，1028 有 1 筆、10 元；共 2 列、25 元。同一批輸入換成按 `refund_date`，25、28、29 日各一列，金額分別為 10、5、10 元；仍共 25 元。每一筆退款只進一組，換分組方式不會把它加兩次。若結果不相同，先驗證兩份查詢的時間範圍與輸入，再判斷是不是某步把明細重複了。不能拿「每日有退款訂單數」相加當全期退款訂單數，因為 1021 跨兩天。

## 從單內明細核對其他指標

另一張 `order_items` 每列是單內一個行號。訂單 1001 的兩列合計 4 件：數列得到 2，數件數得到 4，數訂單得到 1。三個數字都對，但要和欄名承諾同一件事。若先把它和分次退款直接接在一起，兩邊可能重複；之後在[多對多膨脹](#/lesson/sq-join-07)會細講如何先把兩邊各自整理成要交付的粒度。現在先做到每張報表能明說自己沒接任何其他來源。

**換引擎怎麼說：**這堂明寫普通 `GROUP BY` 鍵，Hive SQL、Spark SQL、MySQL 都能分別產出兩份小計。若要一個查詢同時出兩種粒度，Spark SQL 可用 `GROUPING SETS` 列出不同聚合組合；MySQL 的 `WITH ROLLUP` 是按指定鍵順序加層級小計，不等於任意分組組合。面試先給分開的查詢，表明每一列代表什麼。

寫對帳查詢前，可以用一句短話定義三層：原表每筆退款一列、訂單表每個原單一列、日報每個入帳日一列。若同一個欄名在兩張表都叫「退款數」，它可能在一張表指事件數，另一張表指有退款的單數。先把欄名改成對應單位，再做兩份核對：一份把事件數加回原表筆數，另一份以全期原訂單鍵去重。這兩個驗證不能互相替代。粒度寫得越明確，越容易和別人判定對帳差異；「每月」說的是範圍，仍須知道每列單位。

## 常見錯誤

- **一張單拆成多列** → 分組鍵帶了入帳日 → 要每單一列就只按原單號分。
- **拿 3 列日報對 2 張退款單** → 將兩種輸出當同一種事物 → 按相同單位核對 25 元合計。
- **件數和訂單數一樣** → 將 COUNT 當各種量的通用算法 → 將件數加總，訂單鍵則做去重計數。
