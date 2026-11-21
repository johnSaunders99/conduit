---
id: sq-db-01
module: sq-db
order: 1
title: 主鍵與外鍵
subtitle: 訂單不能指向不存在的人
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 分辨單欄主鍵、複合主鍵與外鍵
- 查出找不到父列的訂單，並在本機重現外鍵拒絕
tags:
- 主鍵
- 外鍵
- 孤兒列
resources:
- title: PostgreSQL：約束
  url: https://www.postgresql.org/docs/current/ddl-constraints.html
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀主鍵、外鍵；對照複合鍵與缺值。
- title: DuckDB：約束
  url: https://duckdb.org/docs/current/sql/constraints
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看建立父表、子表與無效寫入的例子。
concepts:
- id: sq-db-01-pk
  prompt: 一張訂單可有多行明細，為何明細表不能只用訂單編號當主鍵？
  answer: 同一訂單會重複出現；需用訂單編號和單內行號合成一個唯一鍵。
  mcq:
    options:
    - 行號本身在全表一定唯一
    - 同單內的行號才用來分辨各列
    - 主鍵允許重複但不能空
    - 將商品編號設成外鍵就能區分所有行
    answer: 1
    explain: 主鍵約束的是整列的識別；外鍵只驗證該值是否有去處。
- id: sq-db-01-fk
  prompt: 外鍵有什麼作用？
  answer: 它要求子表的非空參照值在父表有對應的鍵。
  mcq:
    options:
    - 自動產生父列
    - 保證所有父列都有訂單
    - 拒絕不存在的父鍵
    - 保證子表參照值不重複
    answer: 2
    explain: 多張單可指向同一會員，沒有訂單的會員也仍可獨立存在。
  interview:
    question: 上游送來一筆會員不存在的訂單，你怎麼處理？
    answer: 我會先用暫存層查缺會員的訂單，判斷是會員數據晚到還是壞鍵。正式表留外鍵，不造假父列；先隔離並留批次與訂單編號，等父列補齊再重試。
    points:
    - 分清晚到與錯鍵
    - 保留批次和鍵
    - 先父後子，不繞過正式約束
- id: sq-db-01-orphan
  prompt: 用 LEFT JOIN 查孤兒列時，為什麼測父表的鍵？
  answer: 父表原有鍵不為空；接完才出現空值代表沒對上。測城市等可空欄位會把存在的會員誤報。
  mcq:
    options:
    - 檢查右側城市
    - 檢查左側訂單狀態
    - 用 INNER JOIN 保留沒有匹配的列
    - 檢查右側不可為空的鍵
    answer: 3
    explain: 城市可能原本未填；內連接則直接丟棄未匹配的列。
practice:
- id: sq-db-01-p1
  kind: sql
  category: [model, reconcile]
  title: 驗證訂單明細的候選鍵
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對每個有明細的訂單比較明細列數和不同的行號數。輸出 order_id、line_rows、distinct_lines，依 order_id 升冪。
  solution: |
    SELECT order_id, COUNT(*) AS line_rows, COUNT(DISTINCT line_no) AS distinct_lines
    FROM order_items GROUP BY order_id ORDER BY order_id;
  explain: |
    行號只在單內唯一，故先按訂單分組。直接比較整表不同的行號數會把不同訂單混在一起。
  hints:
  - 先按訂單分組
  - 比較所有列與不同的行號
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-01-pk
  tags:
  - 主鍵
  - 外鍵
  - 孤兒列
- id: sq-db-01-p2
  kind: sql
  category: [model, join]
  title: 抓出暫存訂單的壞參照
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    來源是 orders 原有列加上 (9001, 999) 與 (9002, 1) 兩個 (order_id, user_id) 值，用 UNION ALL 接起來。找出會員鍵非 NULL 且在 users 查無對應的列。輸出 order_id、user_id，依 order_id 升冪。
  solution: |
    WITH incoming AS (
      SELECT order_id, user_id FROM orders
      UNION ALL SELECT 9001, 999
      UNION ALL SELECT 9002, 1
    )
    SELECT i.order_id, i.user_id
    FROM incoming i LEFT JOIN users u ON i.user_id = u.user_id
    WHERE i.user_id IS NOT NULL AND u.user_id IS NULL
    ORDER BY i.order_id;
  explain: |
    只剩 9001；用右表城市判斷會把存在但城市未填的會員也算進來。使用 UNION ALL 保留輸入筆數。
  hints:
  - 先保留左側全部訂單
  - 檢查右側 user_id 是否缺值
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-01-fk
  - sq-db-01-orphan
  - sq-db-01-pk
  tags:
  - 主鍵
  - 外鍵
  - 孤兒列
- id: sq-db-01-p3
  kind: hands-on
  title: 留下外鍵拒絕寫入的紀錄
  minutes: 5
  steps:
  - 在自用 PostgreSQL 或 MySQL 練習數據庫執行正文兩段；沒有伺服器時也可在 DuckDB 的同一連線執行。
  - 把錯誤訊息與合法列寫入 C:\dev\conduit-lab\key-check.md。
  checks:
  - 9001 寫入失敗；查子表只看到 9002。
  - 紀錄指出失敗來自外鍵，而不是訂單編號重複。
---

營運匯入兩筆訂單，9001 指向 999，9002 指向 1。你不能只看訂單編號是不是新的：如果找不到 999，就沒法確認誰下單。今天先把「這列是誰」和「它指向誰」拆開，最後用一張清單把不能入庫的訂單交回來源方。

## 兩種鍵，各管一件事

- 主鍵（primary key；台灣也稱主索引鍵）識別一列：不重複，也不能是缺值。表只有一組主鍵，但這組可以不只一欄。
- 複合主鍵（composite primary key）看整組欄位。`PRIMARY KEY (order_id, line_no)` 表示同一張單不能有兩個行號 1，不是全店只能有一個行號 1。
- 外鍵（foreign key）表示子表參照父表的鍵。`FOREIGN KEY (user_id) REFERENCES users(user_id)` 表示非空的會員編號必須找得到；`NOT NULL` 則是另一條規則，要求一定要填。
- 參照完整性（referential integrity；台灣也稱參考完整性）讓這個方向的連結不會斷。從會員找訂單是反方向；外鍵並不要求每個新會員都已下單。

## 先驗真數據，再試拒絕寫入

在 SQL 練習場選 `shop`，看首單的兩筆品項。`line_no` 說的是單內位置，不是全店的流水號。SQL 題會把查詢結果與參考解比較，不能替你證明來源一直有鍵：同名欄位不等於已建約束，這份練習數據的原表也沒有宣告外鍵。

```sql
SELECT order_id, line_no, product_id
FROM order_items
WHERE order_id = 1001
ORDER BY line_no;
```

若已在本機裝好 PostgreSQL 或 MySQL，連到自己的空白練習數據庫，先執行下面的建表和合法寫入。MySQL 請用 InnoDB；若預設不是它，兩個建表語句結尾都加 `ENGINE=InnoDB`。`CREATE TABLE` 先把規則定下來，之後由引擎檢查；之後在[〈DDL 與約束〉](#/lesson/sq-db-03)會細講建表語法。別在正式數據庫試。

```sql
CREATE TABLE lab_key_parent (user_id INTEGER PRIMARY KEY);
CREATE TABLE lab_key_child (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES lab_key_parent(user_id)
);
INSERT INTO lab_key_parent VALUES (1);
INSERT INTO lab_key_child VALUES (9002, 1);
```

把下一段單獨送出，應被拒絕；再查子表，仍只有 9002。DuckDB 也支援這組建表語法，但在練習場重開數據集後，臨時試寫的表不會留存。

```sql
INSERT INTO lab_key_child VALUES (9001, 999);
```

## 安排匯入先後

想像會員和訂單是兩份獨立檔案，會員檔晚到 10 分鐘。先把訂單暫存，不要自動把所有壞鍵換成同一個會員。把匯入批次與後續處置一起記下：999 到齊後可以重試，若來源證實是手誤，則按來源更正。這也解釋為何查詢裡的左連接與數據庫的外鍵各有工作：前者讓你看見所有待處理列，後者讓它們不會在不完整時進正式表。測例至少要各挑一筆有效、無效及會員存在但城市缺值的訂單，才能證明沒有把未知城市誤報成壞參照。

## 常見錯誤

- 查不到任何孤兒 → 用內連接時，壞鍵已被篩掉 → 改左連接，測右表的鍵為空。
- 城市空白也被報為失聯 → 城市本來就可能缺值 → 比對右表會員鍵，而非描述欄位。
- 後來才到的會員造成匯入失敗 → 批次先子後父 → 把失敗列隔離並保留來路，等父列確認後重試。

## 方言與面試

PostgreSQL、MySQL InnoDB、DuckDB 都能在這個例子拒絕壞參照。在 Hive 的常見數倉用法中，主鍵與外鍵宣告不會替你拒絕這類錯誤，需把唯一性與孤兒列查詢做成批次檢查。你帶走的不是一個語法關鍵字，而是能向人交代「原始訂單在哪、哪個會員鍵對不到、補齊後怎麼重跑」的檢查結果。
