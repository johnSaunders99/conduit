---
id: sq-db-05
module: sq-db
order: 5
title: 隔離級別
subtitle: 兩個收銀台讀到誰的餘額
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-04
objectives:
- 從兩次讀取辨認髒讀、不可重複讀與幻讀
- 在本機 PostgreSQL 兩個連線比較讀已提交與可重複讀
tags:
- 隔離
- 快照
- 不可重複讀
resources:
- title: PostgreSQL：交易隔離
  url: https://www.postgresql.org/docs/current/transaction-iso.html
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀隔離表，並對照同一交易兩次 SELECT。
- title: MySQL：InnoDB 隔離級別
  url: https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀一致性讀取及預設隔離級別。
concepts:
- id: sq-db-05-dirty
  prompt: 讀到另一交易尚未提交且後來撤銷的值，叫什麼？
  answer: 髒讀；結果使用了未被確認的寫入。
  mcq:
    options:
    - 不可重複讀
    - 髒讀
    - 幻讀
    - 正常提交後讀取
    answer: 1
    explain: 是否已提交是診斷髒讀的關鍵。
- id: sq-db-05-snapshot
  prompt: 同一報表的兩次查詢為何可能讀到不同值？
  answer: 在逐語句取快照的讀已提交級別，另一交易可在兩句之間提交，後一句就看到了新值。
  mcq:
    options:
    - 同一交易必然讀未提交數據
    - 快照會刪除舊列
    - 另一交易在兩次查詢間提交
    - ROLLBACK 會使所有連線更新
    answer: 2
    explain: 逐語句快照不是整個交易的固定畫面。
  interview:
    question: 日報的兩個查詢需要同一版庫存，你怎麼做？
    answer: 先查引擎的隔離預設與讀取類型。若引擎的可重複讀可提供固定快照，我會讓兩個普通讀查詢跑在同一交易；用兩個連線重現另一人中途提交時，這份報表仍一致。
    points:
    - 同一連線與交易
    - 兩次查詢共享快照
    - 區分讀取類型與引擎
- id: sq-db-05-phantom
  prompt: 兩次用同一個 WHERE，第二次多一筆符合的訂單，這是什麼？
  answer: 幻讀，重點是符合條件的列集合改變，不只是同一列的值變了。
  mcq:
    options:
    - 髒讀一定發生
    - 語法錯誤
    - 主鍵衝突
    - 幻讀
    answer: 3
    explain: 如果新列已提交，便不是讀到未提交值。
- id: sq-db-05-retry
  prompt: PostgreSQL 的可序列化交易收到序列化失敗時，重試哪一段？
  answer: 重新執行整筆交易，包含再讀一次及重新判斷；不能只重送最後的 UPDATE。
  mcq:
    options:
    - 只重送最後一句 UPDATE
    - 直接提交原本失敗的交易
    - 用原快照重新寫一遍
    - 重新開始整筆交易
    answer: 3
    explain: 失敗表示原讀寫組合不能直接提交，重試要依新的快照再次檢查規則。
practice:
- id: sq-db-05-p1
  kind: sql
  category: [ddl]
  title: 列出兩份庫存快照
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    模擬同一商品在 A 交易兩次查詢可能見到的已提交版本。先用 products 的 101、102 作 read_no=1；read_no=2 僅將 101 的 stock 減 2，其餘不變。輸出 read_no、product_id、stock，依 read_no、product_id 升冪；只用查詢，不改表。
  solution: |
    SELECT 1 AS read_no, product_id, stock FROM products WHERE product_id IN (101, 102)
    UNION ALL
    SELECT 2, product_id, CASE WHEN product_id = 101 THEN stock - 2 ELSE stock END
    FROM products WHERE product_id IN (101, 102)
    ORDER BY read_no, product_id;
  explain: |
    用版本標籤把兩次讀取並列，102 是控制組。這只重建兩個值，不是在 DuckDB 練習場切換隔離級別。
  hints:
  - 用 UNION ALL 接兩次讀取
  - 用 CASE 只改 101 的第二份讀值
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-05-snapshot
  - sq-db-04-atomic
  tags:
  - 隔離
  - 快照
  - 不可重複讀
- id: sq-db-05-p2
  kind: sql
  category: [ddl]
  title: 標記條件集合的新成員
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    以 stock >= 5 為報表條件。模擬第二份快照只有商品 102 的庫存增 2，其餘不變。列出只在第二份符合條件的商品，輸出 product_id、before_stock、after_stock，依 product_id 升冪。
  solution: |
    WITH versions AS (
     SELECT product_id, stock AS before_stock,
            CASE WHEN product_id = 102 THEN stock + 2 ELSE stock END AS after_stock
     FROM products
    )
    SELECT product_id, before_stock, after_stock FROM versions
    WHERE before_stock < 5 AND after_stock >= 5 ORDER BY product_id;
  explain: |
    商品 102 由 3 變 5，跨過包含 5 的邊界。用總筆數差無法指出哪個鍵進出。這是值改動造成符合條件的集合改變。
  hints:
  - 把同一商品兩個版本排在同一列
  - 使用互補的 < 5 和 >= 5
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-05-phantom
  - sq-db-05-snapshot
  tags:
  - 隔離
  - 快照
  - 不可重複讀
- id: sq-db-05-p3
  kind: hands-on
  title: 記下兩輪兩次讀值
  minutes: 6
  steps:
  - 在本機 PostgreSQL 按正文的 A/B 排程做兩輪。
  - 把兩個隔離級別的讀值與 B 的提交位置寫進 C:\dev\conduit-lab\isolation.md。
  checks:
  - 讀已提交為 8→6；可重複讀為 8→8。
  - 若只做 SQL 題，把結果標成模擬。
---

盤點報表先讀到庫存 8 件，另一個收銀台完成出貨後，同一份報表的下一句查詢卻讀到 6 件。單看兩句都可能對，拼起來卻不像同一時間的報表。隔離（isolation；台灣也稱隔離層級）回答的是：我交易中的讀寫可以看見別人做到哪一步？

## 先看現象，再看級別

- 髒讀（dirty read）：讀到尚未提交的值，對方若回退，這個值就從未生效。
- 不可重複讀（nonrepeatable read）：同一列前後讀不同，因為別人中途提交。
- 幻讀（phantom read）：重跑相同篩選，符合條件的列集合變了。
- 序列化異常（serialization anomaly）：合在一起的結果無法解釋為交易依某一順序逐個執行。

由低到高常見讀未提交、讀已提交、可重複讀、可序列化。快照（snapshot）可想成讀取用的一個版本。讀已提交的 PostgreSQL 查詢看該語句開始前已提交的數據；該引擎的可重複讀在第一次非交易控制語句時建立快照，之後的普通讀取共享它。可序列化還要避免交易組合起來才出現的異常；遇到序列化失敗要重試整筆交易。

## 雙連線做一次

用本機 PostgreSQL，兩個終端連到同一個空白練習數據庫，不要在瀏覽器 SQL 題中執行。先在 B 建立一列表，讓建立和插入都完成提交。接著按 A 第一段、B 中段、A 最後一段的順序執行，各段選取送出。

```sql
-- B setup
CREATE TABLE lab_iso_stock (product_id INTEGER PRIMARY KEY, stock INTEGER);
INSERT INTO lab_iso_stock VALUES (101, 8);
```

```sql
-- A starts and reads 8
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT stock FROM lab_iso_stock WHERE product_id = 101;
```

```sql
-- B writes and commits
BEGIN;
UPDATE lab_iso_stock SET stock = 6 WHERE product_id = 101;
COMMIT;
```

```sql
-- A reads 6, then ends
SELECT stock FROM lab_iso_stock WHERE product_id = 101;
COMMIT;
```

第二輪先由 B 把庫存改回 8 並提交，A 起始改成 `BEGIN ISOLATION LEVEL REPEATABLE READ`；A 兩次都應讀到 8，結束後新的查詢才讀到 6。把兩輪順序與讀值寫進練習筆記；沒有 PostgreSQL 也可以做下方的 DuckDB 模擬題，但不能拿模擬當作雙連線實測。

## 為什麼固定快照不等於可序列化

假設兩人都看到有兩個人可值班，於是各自把自己的那列改為休假。每個人都改了不同列，若只檢查自己的更新成功，最後卻可能無人值班。固定快照讓兩人的讀取各自一致，不等於能保證跨列規則。這類情況要靠合適的鎖定或可序列化策略，遇到衝突時讓其中一次失敗後重新讀取。今天的雙連線只證明普通讀取何時看到已提交的庫存，不證明任何一種級別適合所有寫入。

所以隔離設計要先找出業務不變量，才決定這份工作容忍哪些並發結果。

## 常見錯誤

- A 兩次都讀 6 → 沒等 A 先讀就提交 B → 按上面的順序，一段一段做。
- 以為交易永遠固定快照 → 誤把讀已提交當可重複讀 → 明寫隔離級別。
- 查到的是同一個終端的寫入 → 兩段都在同一連線 → 確認 A、B 是不同連線。

## 方言與面試

PostgreSQL 預設讀已提交，MySQL InnoDB 預設可重複讀；這裡談的是普通一致性讀取，不能把鎖定讀也算進同一規則。MySQL 若要比較讀已提交，在開交易之前用 `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` 再 `START TRANSACTION`。DuckDB 練習題比較的是明確提供的兩個版本，不是用語法假裝真的有第二個寫入者。
