---
id: sq-db-04
module: sq-db
order: 4
title: DML 與交易
subtitle: 扣庫存和寫訂單要一起完成
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-03
objectives:
- 寫出有目標條件的 INSERT、UPDATE 與 DELETE
- 用交易一起提交或回退扣庫存與登記兩個寫入
tags:
- 交易
- 回退
- DML
resources:
- title: PostgreSQL：交易入門
  url: https://www.postgresql.org/docs/current/tutorial-transactions.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 BEGIN、COMMIT、ROLLBACK 的成組例子。
- title: DuckDB：交易語句
  url: https://duckdb.org/docs/current/sql/statements/transactions
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看顯式起訖，以及同批多語句的行為。
- title: DuckDB：工作階段變數
  url: https://duckdb.org/docs/current/sql/statements/set_variable
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 看如何以查詢設定變數並取回值。
concepts:
- id: sq-db-04-dml
  prompt: UPDATE 與 DELETE 共用哪一道安全檢查？
  answer: 先用相同的 WHERE 跑 SELECT，核對要動的列，再執行寫入。
  mcq:
    options:
    - 預覽相同的 WHERE
    - 先刪再查
    - 不加 WHERE 讓引擎自行判斷
    - 用 ORDER BY 選第一列即可
    answer: 0
    explain: 寫入不加條件可能影響所有列；排序不等於篩選。
- id: sq-db-04-atomic
  prompt: 庫存已扣、登記失敗時，怎麼避免只成功一半？
  answer: 把兩次寫入放進同一交易，任一步失敗便回退，不提交半份結果。
  mcq:
    options:
    - 兩步分別提交
    - 兩步在同一交易內一起回退
    - 第一步使用自動提交
    - 只重做扣庫存
    answer: 1
    explain: 已提交的操作不能靠回退另一個交易復原。
  interview:
    question: 如何處理庫存不足或寫入失敗？
    answer: 我會開交易，讓 UPDATE 只匹配庫存足夠的那一列，查影響列數。只有匹配成功才補寫登記並提交；不足或失敗就回退，不能讓重試再扣一次。
    points:
    - 同一交易
    - 驗證影響列數
    - 任何一步失敗不得提交
- id: sq-db-04-rollback
  prompt: 回退後查到舊庫存代表什麼？
  answer: 同一交易中的未提交更改被撤銷；先前別的已提交交易並沒有被撤銷。
  mcq:
    options:
    - 撤銷所有歷史訂單
    - 重新執行扣庫存
    - 只有仍未提交的變更撤銷
    - 把變更發給其他連線
    answer: 2
    explain: 回退的範圍是所在交易，不是整張表的歷史。
practice:
- id: sq-db-04-p1
  kind: sql
  category: [ddl]
  title: 提交扣庫存與發貨登記
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    新建 lab_ship(product_id INTEGER, shipped_qty INTEGER)。在一個交易內讓 products 的商品 101 扣 2 件，並在 lab_ship 插入 (101, 2)，再提交；不可改其他商品。系統輸出 product_id、stock、shipped_qty，依 product_id 升冪，未登記的 shipped_qty 為 NULL。
  solution: |
    CREATE TABLE lab_ship (product_id INTEGER, shipped_qty INTEGER);
    BEGIN;
    UPDATE products SET stock = stock - 2 WHERE product_id = 101 AND stock >= 2;
    INSERT INTO lab_ship VALUES (101, 2);
    COMMIT;
  explain: |
    只對 101 更新並一起提交。本題已知足夠；真實流程先驗證 UPDATE 有影響 1 列才登記，否則需要回退。
  hints:
  - 用 WHERE 限制目標
  - 用 BEGIN 和 COMMIT 包住兩步
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      SELECT p.product_id, p.stock, s.shipped_qty FROM products p LEFT JOIN lab_ship s USING (product_id) ORDER BY p.product_id;
  concepts:
  - sq-db-04-dml
  - sq-db-04-atomic
  tags:
  - 交易
  - 回退
  - DML
- id: sq-db-04-p2
  kind: sql
  category: [ddl]
  title: 回退錯誤取消與退款刪除
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    開一個交易，將訂單 1021 改為 cancelled，並從 refunds 刪掉該單全部退款，回退前以 SET VARIABLE 分別把該單的狀態及退款列數存入 during_status、during_refund_count，再回退。系統輸出 order_id、status、refund_count、refund_amount、in_tx_status、in_tx_refund_count，依 order_id 升冪（含無退款訂單，refund_amount 為 NULL；交易中兩欄僅在 1021 顯示）。
  solution: |
    BEGIN;
    UPDATE orders SET status = 'cancelled' WHERE order_id = 1021;
    DELETE FROM refunds WHERE order_id = 1021;
    SET VARIABLE during_status = (SELECT status FROM orders WHERE order_id = 1021);
    SET VARIABLE during_refund_count = (SELECT COUNT(*) FROM refunds WHERE order_id = 1021);
    ROLLBACK;
  explain: |
    1021 原本有兩筆退款，回退應保留兩筆及原狀態。只把狀態改回來不會救回退款列。工作階段變數還能讓狀態檢查確認交易中的取消狀態和 0 筆退款。
  hints:
  - 確保兩句都有相同目標
  - 用兩個查詢記下回退前的狀態和筆數，再回退
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      SELECT o.order_id, o.status, COUNT(r.refund_id) AS refund_count, SUM(r.amount) AS refund_amount,
             CASE WHEN o.order_id = 1021 THEN getvariable('during_status') END AS in_tx_status,
             CASE WHEN o.order_id = 1021 THEN getvariable('during_refund_count') END AS in_tx_refund_count
      FROM orders o LEFT JOIN refunds r USING (order_id)
      GROUP BY o.order_id, o.status ORDER BY o.order_id;
  concepts:
  - sq-db-04-atomic
  - sq-db-04-rollback
  tags:
  - 交易
  - 回退
  - DML
---

茶舖要出貨 2 件：一處扣庫存，另一處登記發貨。假如第一句成功、第二句失敗，系統就少了 2 件卻找不到憑證。這次不先追求快，而是讓兩次寫入共享同一個成敗結果。

## 三種寫入，加一條交易邊界

數據操作語言（data manipulation language，DML）在本課指寫入列的語句：

- `INSERT INTO 表 (欄, …) VALUES (值, …)` 新增列；明列欄名比靠欄位位置可靠。
- `UPDATE 表 SET 欄 = 值 WHERE 條件` 修改已存在的列；可把新值寫成舊值減變動量。
- `DELETE FROM 表 WHERE 條件` 刪除整列；不是把指定欄位清空。

交易（transaction；也稱事務）是一起完成的工作單位。`BEGIN` 開交易，`COMMIT` 確認提交，`ROLLBACK` 撤銷未提交的操作。原子性（atomicity）是「全部生效或都不生效」，不是每次只有一個人能寫。在自動提交（autocommit）的連線，不要期待下一句失敗能撤銷上一句已單獨提交的成功。

## 看清交易前、交易中、交易後

在 SQL 練習場選 `shop`，執行整段先觀察交易中的扣減。最後回退後會顯示 8 件；若想看中途的 6 件，在本機 DuckDB 同一連線把每句分開執行。在本機 PostgreSQL 或 MySQL 的 InnoDB 練習庫也能跑以下示範：先在交易外建立並插入 `lab_tx_stock`，再執行這段交易，不需匯入正式數據。

```sql
CREATE TABLE lab_tx_stock (product_id INTEGER PRIMARY KEY, stock INTEGER);
INSERT INTO lab_tx_stock VALUES (101, 8);
BEGIN;
UPDATE lab_tx_stock SET stock = stock - 2 WHERE product_id = 101 AND stock >= 2;
SELECT stock AS during_stock FROM lab_tx_stock WHERE product_id = 101;
ROLLBACK;
SELECT stock AS after_stock FROM lab_tx_stock WHERE product_id = 101;
```

這道條件同時檢查商品和餘量。實務上如果更新 0 列，不應繼續寫出貨登記；應區分找不到商品與庫存不足，並回退。若寫入報錯，也別以為所有引擎都已替你把整筆交易撤銷：明確執行回退，再查狀態。兩個人同時扣同一商品可能打架，之後在[〈隔離級別〉](#/lesson/sq-db-05)會細講。

## 把兩次觀察都留下

真實值班紀錄要區分「沒有嘗試過」與「確實寫了，但撤銷了」。下面的 SQL 題會用 DuckDB 的工作階段變數（session variable）記兩個交易中看到的值：先寫入兩個變更，再用 `SET VARIABLE 名稱 = (查詢)` 存下一格結果，回退後以 `getvariable('名稱')` 讀取。它只用來驗證示範過程，不是數據庫裡可交接的稽核表；換連線就不能靠它追查。你應同時看到交易中取消且無退款，以及回退後的已付款與兩筆退款。

## 常見錯誤

- 所有商品都扣 2 件 → 沒有目標篩選 → 寫入前先用相同的條件跑查詢，確認只有一列。
- 回退了卻少庫存 → 扣庫存早已單獨提交 → 先開交易，再做兩個動作。
- 已扣但沒有登記 → 操作第二步失敗仍提交 → 失敗回退，記錄原因再重試。
- 改回訂單狀態卻少兩筆退款 → 手動補一欄無法撤銷別表刪除 → 讓所有動作在同一交易內。

## 方言與面試

DuckDB 的 `BEGIN` 和 PostgreSQL 一樣可開交易；MySQL 也常寫 `START TRANSACTION`。MySQL 要確認實際用的是支援交易的 InnoDB，且不能把許多一般 DDL 夾在這類交易中，因為它們可能隱式提交。把中途狀態和最後狀態一起交出來，比只展示最後看到的舊庫存更能證明你真的做過回退。
