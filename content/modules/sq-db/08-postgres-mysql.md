---
id: sq-db-08
module: sq-db
order: 8
title: PostgreSQL 與 MySQL
subtitle: 在本機核對方言與預設值
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-07
objectives:
- 在 PostgreSQL 與 MySQL 重現同一段 DML 回退
- 把日期差、整數除法及衝突寫入改成對應方言
tags:
- SQL 方言
- 日期差
- 隱式提交
resources:
- title: MySQL：隱式提交
  url: https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀會提交的一般 DDL，區分語句原子性。
- title: PostgreSQL：INSERT
  url: https://www.postgresql.org/docs/current/sql-insert.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 ON CONFLICT 的衝突目標。
- title: MySQL：日期函式
  url: https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 只讀 DATEDIFF 的兩個參數。
concepts:
- id: sq-db-08-date
  prompt: DuckDB 的 date_diff('day', start, end) 搬到 MySQL 怎麼寫？
  answer: 用 DATEDIFF(end, start)；這個 MySQL 函式只取日期部分。
  mcq:
    options:
    - DATEDIFF(end, start)
    - DATEDIFF(start, end)
    - DATEDIFF('day', start, end)
    - 不需指定先後，結果永遠是正值
    answer: 0
    explain: MySQL 和 Spark 的兩參數寫法首參數是結束；DuckDB 先起日再迄日。
- id: sq-db-08-intdiv
  prompt: PostgreSQL 中 1 / 2 為什麼可能算成 0？
  answer: 兩個運算元都是整數，使用整數除法；先將至少一邊轉成適當小數型別。
  mcq:
    options:
    - 因為不支援分數
    - 整數除法截斷小數
    - 因為 NULL 變成 0
    - 因為 SELECT 自動四捨五入
    answer: 1
    explain: DuckDB 的 / 不同於 //；MySQL 的 / 不同於 DIV。
- id: sq-db-08-implicit
  prompt: 同一段 DDL 加 DML 為何不能假定兩個引擎都能全回退？
  answer: MySQL 的許多一般 DDL 會隱式提交；PostgreSQL 中普通建表可隨交易回退。
  mcq:
    options:
    - MySQL 的 ROLLBACK 永遠無效
    - 所有 PostgreSQL 命令都能回退
    - 一般 DDL 的交易邊界不同
    - 兩個引擎的自動提交永遠關閉
    answer: 2
    explain: 支持語句原子性不代表 DDL 可以成為交易中的普通一段。
  interview:
    question: 如何驗證 MySQL 的寫入遷移到 PostgreSQL 沒改結果？
    answer: 我先整理會碰到的語句，對照交易邊界、重複鍵、日期及捨入規則。用同一組小數據驗正常、邊界和錯誤路徑，再把兩邊可重現的輸出及差異寫下。
    points:
    - 對照交易邊界
    - 重複鍵、日期、除法各留測例
    - 按產品定義驗結果
- id: sq-db-08-upsert
  prompt: 同時有商品主鍵與外部碼唯一約束時，移植衝突寫入要先查什麼？
  answer: 確認哪個鍵有權識別要更新的列，以及另一個唯一鍵碰撞時要怎麼處理。
  mcq:
    options:
    - 先確認衝突目標和其他唯一鍵
    - 只對照 INSERT 字樣
    - 忽略其他唯一鍵
    - 只查欄位的顯示名稱
    answer: 0
    explain: PostgreSQL 可指定衝突目標，MySQL 在主鍵或唯一索引重複時進入更新分支；只比 SQL 關鍵字看不出語意差異。
practice:
- id: sq-db-08-p1
  kind: sql
  category: [time, expression]
  title: 算訂單到退款的日數差
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對訂單 1021 的所有退款，輸出 refund_id、sold_on（order_date）、refund_on（refund_date）、days_waited（相差日數），依 refund_id 升冪。
  solution: |
    SELECT r.refund_id, o.order_date AS sold_on, r.refund_date AS refund_on,
           date_diff('day', o.order_date, r.refund_date) AS days_waited
    FROM refunds r JOIN orders o USING (order_id)
    WHERE r.order_id = 1021 ORDER BY r.refund_id;
  explain: |
    起訖顛倒會得到負數。MySQL 和 Spark SQL 的 datediff 使用結束日、開始日；此題用 DuckDB 的單位、開始、結束順序。
  hints:
  - 先用訂單號相接
  - 確認差值是退款日減下單日
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-08-date
  - sq-db-01-fk
  tags:
  - SQL 方言
  - 日期差
  - 隱式提交
- id: sq-db-08-p2
  kind: sql
  category: [ddl]
  title: 寫入遇到重複鍵只改指定欄
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    建 lab_dialect_stock(product_id INTEGER PRIMARY KEY, stock INTEGER)，匯入 products 的 101 與 102，再嘗試插入 (101,5)，主鍵衝突時只以新值更新 stock。系統輸出 product_id、stock，依 product_id 升冪。
  solution: |
    CREATE TABLE lab_dialect_stock (product_id INTEGER PRIMARY KEY, stock INTEGER);
    INSERT INTO lab_dialect_stock SELECT product_id, stock FROM products WHERE product_id IN (101, 102);
    INSERT INTO lab_dialect_stock VALUES (101, 5)
    ON CONFLICT (product_id) DO UPDATE SET stock = excluded.stock;
  explain: |
    DuckDB 與 PostgreSQL 可指定衝突目標；MySQL 的 ON DUPLICATE KEY UPDATE 在主鍵或唯一索引衝突才改既有列。不能把衝突無聲略過，否則 101 還是 8。
  hints:
  - 衝突目標是 product_id
  - 以嘗試插入的 stock 更新
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      SELECT product_id, stock FROM lab_dialect_stock ORDER BY product_id;
  concepts:
  - sq-db-08-upsert
  - sq-db-04-dml
  tags:
  - SQL 方言
  - 日期差
  - 隱式提交
- id: sq-db-08-p3
  kind: hands-on
  title: 留下兩種引擎的結果
  minutes: 5
  steps:
  - 在各自本機空白練習數據庫執行正文的共用腳本、以及對應的方言片段。
  - 將回退後庫存、整數比值和日差，寫成 C:\dev\conduit-lab\sql-dialects.md 的兩列。
  checks:
  - 兩邊庫存皆為 8、日差皆為 4。
  - 整數比值在 PostgreSQL 為 0、MySQL 為 0.5。
---

同一張退款報表在兩個數據庫跑。搬語法最容易注意的是函式不存在，最難注意的是沒報錯卻改了數字，或錯了卻撤銷不了。方言（dialect）是引擎採用的語法與行為；遷移要同時比對這兩類差異。

## 拿三種小測例當路標

| 工作 | DuckDB | PostgreSQL | MySQL |
| --- | --- | --- | --- |
| 計算兩日期差幾天 | `date_diff('day', start, end)` | 日期減日期得到日數 | `DATEDIFF(end, start)` |
| 整數算一半 | `1 / 2` 為 0.5；`//` 為整數除法 | `1 / 2` 為 0；先轉成小數 | `1 / 2` 有小數；`DIV` 會截斷 |
| 衝突時寫入或更新（upsert） | `ON CONFLICT (key)` | `ON CONFLICT (key)` | `ON DUPLICATE KEY UPDATE` |

Spark SQL 與 Hive SQL 的二參數 `datediff` 也是結束在前，DuckDB 要先寫單位再寫起點。移植時以跨午夜、同一天逆序等值檢查自己的假設；此處比較日期，不是相隔幾個完整 24 小時。

## 在本機跑同一段，再跑分歧處

分別連本機 PostgreSQL、MySQL 的空白練習數據庫。MySQL 用支援交易的 InnoDB，非預設時在建表加 `ENGINE=InnoDB`。下面是兩邊可跑的相同腳本，建表與起始寫入先完成，再測回退。不必拿公司的訂單測。

```sql
CREATE TABLE lab_dialect (id INTEGER PRIMARY KEY, qty INTEGER);
INSERT INTO lab_dialect VALUES (1, 8);
START TRANSACTION;
UPDATE lab_dialect SET qty = 6 WHERE id = 1;
ROLLBACK;
SELECT qty FROM lab_dialect WHERE id = 1;
```

兩邊都應顯示 8。接著在每個引擎只跑自己的那一段；PostgreSQL 顯示 0 與 4，MySQL 的 `ratio` 為 0.5（顯示位數可不同）且日差也是 4。

```sql
-- PostgreSQL
SELECT 1 / 2 AS ratio, DATE '2026-01-28' - DATE '2026-01-24' AS elapsed_days;
```

```sql
-- MySQL
SELECT 1 / 2 AS ratio, DATEDIFF('2026-01-28', '2026-01-24') AS elapsed_days;
```

隱式提交（implicit commit）指某些語句自發結束交易。MySQL 的許多一般 DDL 有此行為；PostgreSQL 的一般建表則可在交易內撤銷。這和「DDL 本身成功或失敗是否原子」是兩個問題。需要移轉表結構時，另外規劃回復步驟，別指望把結構和業務寫入包一起就有保護。

## 再用普通建表驗證回退差異

在兩個本機練習數據庫，只在沒有同名表時執行以下整段。先開交易，再建表，最後回退，與剛才先在交易外建表不同。PostgreSQL 最後應查到 0 筆；MySQL 的一般建表已隱式提交，會查到 1 筆。查目錄可避免把「找不到表」當作整段語法失敗。若重跑，先換一個未使用的練習名稱，不要為了讓測試過而刪其他人的表。

```sql
START TRANSACTION;
CREATE TABLE lab_dialect_ddl_probe (id INTEGER);
ROLLBACK;
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_name = 'lab_dialect_ddl_probe';
```

另挑一個會出錯的值，例如重複商品鍵。在同一份測例中記預期行為是拒絕、略過或更新；不同語法可能各使其中一種行為成立。遇到多個唯一鍵時，PostgreSQL 可以明指定哪個衝突目標，MySQL 的更新路徑則受任何觸發衝突的唯一鍵影響。若新的索引讓兩個代碼同時衝突，應先把業務識別規則問清楚，而非硬把兩邊寫成看似相同。用相同的輸入列，逐條驗收最終列值和事務邊界，才有把握遷移。

這兩個練習均只使用本機空白數據庫。把每次查到的值寫進兩欄表，若和預期不同，同時記下引擎、儲存引擎與連線設定，別先把差異歸因於語法。

## 常見錯誤

- 日期差變負數 → 起迄搬反 → 用一筆已知日差的退款驗符號。
- 退款率顯示 0 → 在 PostgreSQL 先做了整數除法 → 在除法前轉小數。
- 寫了回退卻見到舊更新生效 → MySQL 中間的一般 DDL 先提交了 → 分開做結構變更與業務寫入。
