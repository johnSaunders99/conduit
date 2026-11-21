---
id: sq-compose-04
module: sq-compose
order: 4
title: CTE 命名步驟
subtitle: 先算訂單再算會員
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-03
objectives:
- 命名可以被後續查詢引用的中間結果
- 識別 CTE 的單一陳述式範圍
- 先聚合品項再算會員消費
tags:
- cte
- with
- 中間結果
- 粒度
resources:
- title: DuckDB：WITH 子句
  url: https://duckdb.org/docs/stable/sql/query_syntax/with
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀單個 CTE 範例及物化說明。
- title: Hive SQL：CTE
  url: https://hive.apache.org/docs/latest/language/common-table-expression/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Hive CTE 的位置與範圍限制。
concepts:
- id: sq-compose-04-name
  prompt: CTE 為查詢新增了什麼？
  answer: 一個只在本句可引用的具名查詢結果，並未自行建立永久數據表。
  mcq:
    options:
    - 本句內可用的中間結果名稱
    - 永久數據表
    - 新的數據庫
    - 帶索引的實體複本
    answer: 0
    explain: WITH 能拆開推理步驟，不能當作 CREATE TABLE。
  interview:
    question: CTE 一定比子查詢更快嗎？
    points:
    - 先說明可讀性價值
    - 區分語意與引擎計畫
    - 用執行計畫或測量
    answer: 不一定。我用 CTE 讓一單一列的合計可以命名。是否重算或先算後保存要看引擎與計畫；需要比較時，我會用相同輸入測量。
- id: sq-compose-04-scope
  prompt: WITH 結束的分號下一句，能直接 SELECT FROM 該名稱嗎？
  answer: 不能。名稱只在同一陳述式內；要保留就需另建表或檢視。
  mcq:
    options:
    - 只能在下一句查一次
    - 不能，分號結束後範圍結束
    - 可以，在這個連線永遠有效
    - 可以，名稱和實體表一樣
    answer: 1
    explain: CTE 不是連線級的暫存表，也不是全域名稱。
- id: sq-compose-04-order-grain
  prompt: 要算每位會員的已付款消費，何時能放心 SUM 每單金額？
  answer: 先確保每張付款單只配上一列訂單金額，才以會員分組。
  mcq:
    options:
    - 只要對金額使用 DISTINCT
    - 只要最後依金額排序
    - 每張付款單只配一份合計後
    - 接到每項明細與退款後
    answer: 2
    explain: 一單一列才知道某單的金額不會被再次乘上明細數。
practice:
- kind: sql
  category: [cte, aggregate]
  title: 替每張單算一份品項合計
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    用 WITH 為訂單明細的聚合命名，輸出每張有明細訂單的款項合計 `order_amount`（件數乘成交單價加總）。

    只輸出以下欄位，欄序固定：`order_id`、`order_amount`。

    排序：`order_id` 升序。
  solution: |
    WITH order_amounts AS (
      SELECT order_id, SUM(qty * unit_price) AS order_amount
      FROM order_items GROUP BY order_id
    )
    SELECT order_id, order_amount FROM order_amounts
    ORDER BY order_id;
  explain: |
    CTE 的結果一單一列，外層直接取。若仍按行號分組，1001 的 225 元會被拆成兩列。
  hints:
  - 先寫括號內的分組。
  - WITH 後緊接讀取中間結果的 SELECT。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-04-name
  - sq-compose-04-scope
  - sq-join-07-grain
  tags:
  - cte
  - 訂單合計
  id: sq-compose-04-p1
- kind: sql
  category: [cte, aggregate]
  title: 會員的已付款消費
  minutes: 9
  level: 2
  dataset: shop
  prompt: |
    按會員加總已付款訂單的成交金額，先由明細算每單件數乘成交單價的合計，再接 orders。只列有付款單的會員，不扣退款。總額命名 `paid_amount`。

    只輸出以下欄位，欄序固定：`user_id`、`paid_amount`。

    排序：`paid_amount` 由高到低，同額按 `user_id` 升序。
  solution: |
    WITH order_amounts AS (
      SELECT order_id, SUM(qty * unit_price) AS order_amount
      FROM order_items GROUP BY order_id
    )
    SELECT o.user_id, SUM(a.order_amount) AS paid_amount
    FROM orders AS o JOIN order_amounts AS a ON o.order_id = a.order_id
    WHERE o.status = 'paid'
    GROUP BY o.user_id
    ORDER BY paid_amount DESC, o.user_id;
  explain: |
    先算一單一個合計，再確認該單是否付款。若把已取消但有明細的訂單納入，會員的總額會偏高；本題不扣退款。
  hints:
  - 第一層的鍵是 order_id，最後報表的鍵才是 user_id。
  - 付款狀態不在明細表。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-04-order-grain
  - sq-compose-04-name
  - sq-join-01-filter
  tags:
  - cte
  - 會員消費
  id: sq-compose-04-p2
---

原本一大段查詢同時寫品項、付款和會員彙總。總金額錯了，接手的人不知道要在哪裡先停下來看。這堂把「每張單的金額」先取個看得懂的名稱，再讓會員表用它。你最後可交出一張消費報表，也能指出報表算錯時要先看哪一層。

## 命名不是存檔

公用表運算式（common table expression，CTE；也稱公共表表達式；台灣亦稱通用資料表運算式）的基本形式是 `WITH name AS (SELECT ...) SELECT ... FROM name`。其脈絡有三部分：

1. `WITH name AS ( ... )` 定義一個具名中間結果。名稱用業務結果，例如 `order_amounts`。
2. 括號裡是一個完整的查詢：選欄、定義分組鍵，算出後面會用的欄位。
3. 外層查詢像讀一張表一樣讀它；中間不要加分號。最後的分號才結束整句，也結束這個名稱的範圍。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
WITH order_amounts AS (
  SELECT order_id, SUM(qty * unit_price) AS order_amount
  FROM order_items GROUP BY order_id
)
SELECT order_id, order_amount FROM order_amounts
WHERE order_id IN (1001, 1002)
ORDER BY order_id;
```

拿 1001 驗算：3 件乘 45 元，加 1 件乘 90 元，共 225 元；1002 則應為 910 元。這是每單合計，不是商品標價，也不是退款後淨額。可先用有訂單號範圍的外層查詢檢查兩張單；確認後改去接 `orders`，再算會員合計。每層都用一句話說出一列的含義，便不必靠數字大小猜是否重複計算。

CTE 不等於實體暫存表，也不保證只掃一次。同一個查詢能否被展開或先算後留作中間結果，是引擎執行策略；這裡先用它改善可讀性。Hive SQL 支援句首的普通 CTE，但其手冊不支援在子查詢區塊裡放 `WITH`。要把這題搬到 Hive、Spark SQL 或 MySQL，本課句首的形式比為每個子查詢另開 `WITH` 更容易重用。下一堂[〈多層 CTE〉](#/lesson/sq-compose-05)會在同一個 WITH 下列出多個步驟。

## 把一個複雜問題拆成兩句業務話

第一句是「每張單的成交金額等於各行件數乘成交單價的總和」；第二句是「只合計付款單，再依會員加總」。分開寫下這兩句，會員條件便不會誤加到明細另一路，取消單也不會因為有品項就算進會員消費。第一個中間結果並不需要會員欄；一份足以讓下游配對的訂單號和金額就夠了，其他欄位等接主表時再拿。

不用先猜報表最終會列出幾位會員，只要先用 1001、1002 檢查握在手上的一單一列中間結果是否正確。接完這層之後，挑一位多次付款的會員，從原表列出其付款單號再與合計逐張對。若合計偏大，要不就是條件納入不該進來的單，要不就是同一單在連接後超過一列。這兩種錯用中間結果很好區分。

若分享這段查詢，就在名稱旁註明「尚未判斷付款、不扣退款」。接手人可能想重用這個合計去處理取消單，留下這些條件比只叫它第一步更實用。

## 常見錯誤

- 外層找不到 CTE 名稱 → 檢查括號後是否過早加了分號。
- 一張單有多個合計 → 看內層是否多按了商品或行號分組。
- 以為跑完 CTE 就能在新查詢讀它 → CTE 不持久；這次用最末 SELECT 留下可看的結果。
