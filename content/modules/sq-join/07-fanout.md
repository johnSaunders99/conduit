---
id: sq-join-07
module: sq-join
order: 7
title: 多對多膨脹
subtitle: 連兩次之後金額怎會翻倍
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-06
objectives:
- 量出連接前後每單的列數
- 分開聚合品項及退款
- 用同一張單對照原額與退款
tags:
- fanout
- 粒度
- 金額對帳
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀連接的配對規則，追蹤一單對多列。
- title: Hive SQL：JOIN
  url: https://hive.apache.org/docs/latest/language/languagemanual-joins/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Hive 多表連接範例，檢查每段配對鍵。
concepts:
- id: sq-join-07-fanout
  prompt: 一張單有 2 個品項、3 筆退款，按訂單號直接接兩張明細會得到幾列？
  answer: 6 列；每個品項配上 3 筆退款，每筆退款也出現兩次。
  mcq:
    options:
    - 5 列
    - 3 列
    - 1 列
    - 6 列
    answer: 3
    explain: 同鍵兩側所有組合相乘，不是相加，也不會自動保持一單一列。
- id: sq-join-07-grain
  prompt: 要交付一張單一列的金額報表，應在何時聚合？
  answer: 品項與退款先各自按 order_id 算出一單一列，再以訂單號接到訂單。
  mcq:
    options:
    - 先各自聚合到一單一列
    - 先全部接在一起再各自 SUM
    - 先按會員聚合，再接回每筆明細
    - 只對輸出做 DISTINCT
    answer: 0
    explain: 已被配對複製的數值，之後 SUM 仍會重複加。
  interview:
    question: 為什麼 SUM(DISTINCT 金額) 不是一般解法？
    points:
    - 區分數值相同與同一事件
    - 提出按業務鍵預聚合
    - 用單筆對帳
    answer: 兩件商品可以各賣 90 元；去重金額會少算。我會分別按訂單號加總實際品項與退款，再接回訂單，挑一張有多筆的單逐筆對。
- id: sq-join-07-left
  prompt: 訂單查不到退款時，如何保留原訂單並顯示退款為 0？
  answer: 從訂單左連接退款合計，在輸出對退款合計使用 COALESCE(..., 0)。
  mcq:
    options:
    - 把原訂單刪除
    - 左連接後補 0
    - 內連接後補 0
    - 用 COUNT(*) 代替 SUM
    answer: 1
    explain: 只有訂單列被保留，才有地方顯示 0；COALESCE 不會造出被刪掉的列。
- id: sq-join-07-audit
  prompt: 總金額突然放大，你先查哪裡？
  answer: 挑一個已知有多筆明細的訂單，核對連接前後每張表的列數與鍵。
  interview:
    question: 如何跟對帳同事說明定位步驟？
    points:
    - 挑已知訂單
    - 記錄每步列數
    - 找到被複製的一側
    answer: 先不看全月總額。我會挑 1007，寫下品項幾列和退款幾列，再列出連接後的退款編號；如果同一退款出現兩次，就知道是哪一步放大的。
practice:
- kind: sql
  category: [join, reconcile]
  title: 量出兩張單的重複配對
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    只看 1007、1021。以 order_id 內連接 order_items 與 refunds，輸出實際配對總數 `pair_count`、不同明細行號數 `line_count`、不同退款編號數 `refund_count`。

    只輸出以下欄位，欄序固定：`order_id`、`pair_count`、`line_count`、`refund_count`。

    排序：`order_id` 升序。
  solution: |
    SELECT i.order_id, COUNT(*) AS pair_count, COUNT(DISTINCT i.line_no) AS line_count,
           COUNT(DISTINCT r.refund_id) AS refund_count
    FROM order_items AS i JOIN refunds AS r ON i.order_id = r.order_id
    WHERE i.order_id IN (1007, 1021)
    GROUP BY i.order_id
    ORDER BY i.order_id;
  explain: |
    1007 有 2 個品項和 1 次退款；1021 有 1 個品項和 2 次退款。兩張單都配出 2 列，但重複的來源剛好相反。
  hints:
  - 同一份配對用三種 COUNT 看它的粒度。
  - 不同的行號與退款編號各自計數。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-07-fanout
  - sq-join-07-audit
  - sq-join-01-match
  tags:
  - fanout
  - 對帳
  id: sq-join-07-p1
- kind: sql
  category: [join, reconcile]
  title: 交付已付款訂單淨額
  minutes: 11
  level: 3
  dataset: shop
  prompt: |
    只列已付款的訂單。以件數乘成交單價後加總為 `gross_amount`，所有退款加總（沒退款視為 0）為 `refund_amount`，相減得 `net_amount`。每張單一列。

    只輸出以下欄位，欄序固定：`order_id`、`gross_amount`、`refund_amount`、`net_amount`。

    排序：`order_id` 升序。
  solution: |
    SELECT o.order_id, g.gross_amount, COALESCE(r.refund_amount, 0) AS refund_amount,
           g.gross_amount - COALESCE(r.refund_amount, 0) AS net_amount
    FROM orders AS o
    JOIN (SELECT order_id, SUM(qty * unit_price) AS gross_amount
          FROM order_items GROUP BY order_id) AS g ON o.order_id = g.order_id
    LEFT JOIN (SELECT order_id, SUM(amount) AS refund_amount
               FROM refunds GROUP BY order_id) AS r ON o.order_id = r.order_id
    WHERE o.status = 'paid'
    ORDER BY o.order_id;
  explain: |
    1007 的同一筆退款不能算兩遍；1021 的同一品項也不能算兩遍。先各算一單一列，再接回主表，才不會靠 DISTINCT 金額誤消同額的不同事件。
  hints:
  - 分別做兩個一單一列的括號查詢。
  - 訂單不一定有退款。
  - 在相減前先把缺失的退款合計變成 0。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-07-grain
  - sq-join-07-left
  - sq-join-02-count
  tags:
  - fanout
  - 粒度
  - 金額對帳
  id: sq-join-07-p2
---

財務問：「退款表沒有新數據，為什麼報表的退款變多了？」查詢保留了一單多品項，又在同一筆結果接上退款。兩側都按訂單號配對，於是某張單的同一筆退款被複製到每一項，再被加總多次。這種連接膨脹（join fanout）比明顯的語法錯誤更難發現：程式沒有報錯，金額卻變了。

## 先寫每層的一列是什麼

- 明細：一列一個訂單內行號；同個訂單可以有多行。
- 退款：一列一次退款；同個訂單可以分次退。
- 報表：目標是一列一單。有兩張明細表時，各用 `SELECT order_id, SUM(...) ... GROUP BY order_id` 先壓到一單一列，再接回 `orders`。必要時左接退款表，最後才把缺失的退款合計補零。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT i.order_id, i.line_no, r.refund_id, i.qty * i.unit_price AS line_amount, r.amount
FROM order_items AS i JOIN refunds AS r ON i.order_id = r.order_id
WHERE i.order_id IN (1007, 1021)
ORDER BY i.order_id, i.line_no, r.refund_id;
```

單 1007 原本有 2 個品項和 1 筆退款；退款 1 被複製了兩次，直接加退款會把 10 元變成 20 元。單 1021 原本只有一個品項、但有 2 筆退款；這次變成品項金額 90 元被加了兩遍。把兩張單並排看，你就會知道錯的不只是某一欄加總：兩側都有可能在各自的訂單上被放大。

若一張單同時有 2 個品項、3 次退款，會得 6 組。若沒有退款且用左連接，左側品項仍存在，只是每行配到空欄。即使加總結果碰巧未變，也不能以此證明粒度正確。用 `COUNT(*)` 比對每張單在每層的列數，從第一個超出預期的步驟追，而不是拿全月總數猜原因。

DuckDB、Hive SQL、Spark SQL、MySQL 的同鍵配對都可能放大列數。換到 Hive 或 Spark，執行策略可能不同，但改策略不會把錯的業務粒度變對；括號查詢內的聚合先釐清。下一模組[〈多層 CTE〉](#/lesson/sq-compose-05)會把兩段聚合與最後對帳各自命名，讓同事能從同一段查詢切換檢查位置。

## 用兩個反例驗成品

算淨額時，1007 的退款必須是 10 元，不是 20 元；1021 的原額應是 90 元、退款應是 15 元，所以淨額是 75 元。這兩個反例分別測「右側退款有沒有被重複計算」和「左側成交金額有沒有被重複計算」。只選一張恰好各一筆的訂單會讓兩種錯法一起矇混過關。

接著挑 1001，一張無退款的付款單。這張單仍要在成品中，退款合計為 0；把退款表改成內連接，就會整張消失。再核對成品列數是否等於已付款且有明細的訂單數。這一組檢查比只比總額更容易追錯：某些單多算、另一些單消失，總額甚至可能相互抵消。不用把總額差額攤回各單，也能指出是哪個配對步驟需要修復。

對帳表應同時留下原額、退款與淨額，別只留相減結果。

## 常見錯誤

- 事後按 order_id 分組仍太大 → 放大發生在分組之前；預聚合後再連。
- 用 `SUM(DISTINCT amount)` 修補 → 兩筆不同退款也可能同額；依事件記錄加總。
- 無退款的訂單不見 → 改以訂單為主做左連接，確定該單在輸出後才補零。
