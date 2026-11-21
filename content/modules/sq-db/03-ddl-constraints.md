---
id: sq-db-03
module: sq-db
order: 3
title: DDL 與約束
subtitle: 不讓負數庫存寫進來
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-02
objectives:
- 以 DDL 建立必要、唯一及範圍約束
- 分別驗證零庫存、缺庫存與負庫存的寫入結果
tags:
- 建表
- CHECK 約束
- NOT NULL
resources:
- title: DuckDB：約束
  url: https://duckdb.org/docs/current/sql/constraints
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 CHECK、NOT NULL、UNIQUE 的差異。
- title: DuckDB：ALTER TABLE
  url: https://duckdb.org/docs/current/sql/statements/alter_table
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀新增欄位和更名；核對約束限制。
concepts:
- id: sq-db-03-ddl
  prompt: CREATE TABLE 和 UPDATE 的目的有何不同？
  answer: 前者定義結構與約束；後者修改現有列的欄位值。
  mcq:
    options:
    - 兩者都只更改列值
    - UPDATE 可直接新增欄位定義
    - CREATE TABLE 會自動匯入來源列
    - CREATE TABLE 是結構變更
    answer: 3
    explain: 結構規則和列的內容不同；只建空表不會搬數據。
- id: sq-db-03-check
  prompt: 要讓庫存只能是零或正數、又不能缺值，要如何宣告？
  answer: 加 NOT NULL 與 CHECK (stock >= 0)；只加 CHECK 不會拒絕未知值。
  mcq:
    options:
    - NOT NULL 加 CHECK (stock >= 0)
    - 只有 CHECK (stock >= 0)
    - 只有 UNIQUE
    - CHECK (stock > 0) 加 NOT NULL
    answer: 0
    explain: CHECK 不是非空規則；嚴格大於零又誤拒了合法零庫存。
  interview:
    question: 如何上線一個禁止負庫存的規則？
    answer: 我會先查歷史負值與缺值，問清是否代表欠貨而非錯誤。和業務確認後再修或隔離舊列，部署兩條約束並測 0、NULL、-1；上線前看引擎是否需要重建表或長時間鎖表。
    points:
    - 釐清負數是否真的不合法
    - 先掃舊數據
    - 零、負值、空值皆驗證
- id: sq-db-03-unique
  prompt: 既然商品已有主鍵，什麼時候還會加 UNIQUE？
  answer: 若外部商品代碼也必須唯一，可獨立加 UNIQUE，不改原本的主鍵。
  mcq:
    options:
    - 保證庫存不為空
    - 保護另一組不得重複的欄位
    - 讓所有大小寫必定等價
    - 保證引用的父鍵存在
    answer: 1
    explain: 唯一性不替代範圍、缺值與外鍵規則，文字相等還取決於比較規則。
practice:
- id: sq-db-03-p1
  kind: sql
  category: [ddl]
  title: 建立允許零件的庫存表
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    建立 lab_stock：product_id 為 INTEGER 主鍵，stock 為 INTEGER、不可為 NULL 且須大於等於 0。從 products 匯入 product_id、stock 全部列。系統依 product_id 升冪輸出 product_id、stock 及 has_product_pk、has_stock_not_null、has_stock_check 三個約束存在旗標；只需寫建表和匯入。
  solution: |
    CREATE TABLE lab_stock (
      product_id INTEGER PRIMARY KEY,
      stock INTEGER NOT NULL CHECK (stock >= 0)
    );
    INSERT INTO lab_stock SELECT product_id, stock FROM products;
  explain: |
    CHECK 必須允許 0，否則原始商品 103 無法匯入。狀態檢查能辨認約束類型和欄位，仍要用正文的非法寫入確認 CHECK 的實際行為。
  hints:
  - 明列欄位和型別
  - 先 CREATE，再 INSERT SELECT
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      WITH rule_flags AS (
        SELECT COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY' AND constraint_column_names = ['product_id']) > 0 AS has_product_pk,
               COUNT(*) FILTER (WHERE constraint_type = 'NOT NULL' AND constraint_column_names = ['stock']) > 0 AS has_stock_not_null,
               COUNT(*) FILTER (WHERE constraint_type = 'CHECK' AND constraint_column_names = ['stock']) > 0 AS has_stock_check
        FROM duckdb_constraints() WHERE schema_name = 'main' AND table_name = 'lab_stock'
      )
      SELECT product_id, stock, has_product_pk, has_stock_not_null, has_stock_check
      FROM lab_stock CROSS JOIN rule_flags ORDER BY product_id;
  concepts:
  - sq-db-03-ddl
  - sq-db-03-check
  - sq-db-01-pk
  tags:
  - 建表
  - CHECK 約束
  - NOT NULL
- id: sq-db-03-p2
  kind: sql
  category: [ddl]
  title: 給庫存表加上來源欄
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    另建 lab_stock_v2，用與上一題相同的兩欄定義並匯入 stock 不大於 5 的所有商品。再用 ALTER TABLE 新增 source VARCHAR DEFAULT 'shop'，並插入測試列 product_id=999、stock=0；插入時省略 source，觀察預設值。系統輸出 product_id、stock、source，依 product_id 升冪。
  solution: |
    CREATE TABLE lab_stock_v2 (
      product_id INTEGER PRIMARY KEY,
      stock INTEGER NOT NULL CHECK (stock >= 0)
    );
    INSERT INTO lab_stock_v2 SELECT product_id, stock FROM products WHERE stock <= 5;
    ALTER TABLE lab_stock_v2 ADD COLUMN source VARCHAR DEFAULT 'shop';
    INSERT INTO lab_stock_v2 (product_id, stock) VALUES (999, 0);
  explain: |
    邊界要用 <= 才保留剛好 5 件的商品。預設值不是非空約束；欄位仍可因明確寫入 NULL 而缺值。
  hints:
  - 重建本題獨立的小表
  - 新增欄位時一併指定 DEFAULT
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      SELECT product_id, stock, source FROM lab_stock_v2 ORDER BY product_id;
  concepts:
  - sq-db-03-ddl
  - sq-db-03-check
  tags:
  - 建表
  - CHECK 約束
  - NOT NULL
---

商品 103 剩下 0 件，可以補貨，但不能被查成「數字沒填」。若匯入時把空白轉成 0，營運會把未知庫存當售罄；若數量 -1 是輸入錯誤，就不該等報表才抓。今天把這兩種規則放在數據表的入口。

## 先定義，再寫入

數據定義語言（data definition language，DDL）改結構。`CREATE TABLE 表名 (欄名 型別 規則, …)` 建表；`ALTER TABLE 表名 ADD COLUMN 欄名 型別` 改結構；`DROP TABLE 表名` 會移除表和當中的數據，不拿正式表試。約束（constraint，台灣也稱限制條件）是引擎在寫入時強制驗證的規則，不只是給人看的欄位註解。

| 規則 | 檢查 | 不替你檢查 |
| --- | --- | --- |
| `NOT NULL` | 欄位有值 | 值是否合理 |
| `CHECK (stock >= 0)` | 判斷式不能為假 | 缺值的結果是未知，不等同於假 |
| `UNIQUE (source_sku)` | 不可有相同的非空商品代碼 | 欄位一定有值 |
| `PRIMARY KEY (product_id)` | 非空且不重複 | 有無其他表指到這列 |
| `DEFAULT 0` | 省略欄位時提供值 | 不是約束，也不把明確的 NULL 換成 0 |

## 讀一次成功，再分開看兩種失敗

在 DuckDB SQL 練習場開 `shop`，整段執行。插入後會顯示 103 的 0；`CREATE TABLE AS SELECT` 雖然也能快速複製列，卻不是複製原表約束的方式。待會兒的動手題用新增欄位留下來源，好讓人一眼看出產地。

```sql
CREATE TABLE lab_stock_demo (
  product_id INTEGER PRIMARY KEY,
  stock INTEGER NOT NULL CHECK (stock >= 0)
);
INSERT INTO lab_stock_demo VALUES (103, 0);
SELECT product_id, stock FROM lab_stock_demo ORDER BY product_id;
```

若要觀察錯誤，留在同一個本機 DuckDB 連線，分別單獨執行下兩句。第一句應因負數觸發 `CHECK`，第二句應因缺值觸發 `NOT NULL`。用本機 PostgreSQL 或 MySQL InnoDB 的空白練習數據庫也可執行以上三段。把兩個錯誤分開看，不要將非法寫入跟建表合成一次，否則整批失敗時你可能連能查的表也沒有。

```sql
INSERT INTO lab_stock_demo VALUES (201, -1);
```

```sql
INSERT INTO lab_stock_demo VALUES (202, NULL);
```

## 遷移時怎麼驗既有數據

若規則不是新建表，而是後加到既有庫存表，先用查詢分開清點「負值」、「缺值」、「有效零值」。前兩者交由來源確認，有效零值是回歸測例，不能一起刪掉。確定處置後，再決定要直接改表，還是建新表、複製已驗過的列後切換。切換前記下新舊表的商品鍵及列數；若鍵缺失，光看兩張表筆數一樣也不能算通過。這堂的狀態題會檢查目錄中有沒有需要的約束種類，卻不會替你試遍所有輸入；正文的拒絕測例仍不能省。

若合法的零值或原表總列數不符，先停止切換，保留舊表供回查；不要把重新跑一次當成還原。

## 常見錯誤

- 缺值仍寫得進 → 只寫了範圍約束 → 再加 `NOT NULL`。
- 零庫存也拒絕 → 寫成嚴格大於零 → 用 `stock >= 0`。
- 有些列是從舊表匯入，約束一開便失敗 → 歷史列不符新定義 → 先數清空值與負數，取得處置規則後才移轉。

## 方言與面試

DuckDB 支援建表時加 `CHECK`，不要假定所有 `ALTER TABLE ADD CONSTRAINT` 寫法都能搬過來。MySQL 8.0.16 起才執行 `CHECK` 約束；更舊版本不能靠這條語句防守。面試談遷移不只背語法：先看舊列、再測合法與非法邊界，最後說明結構變更會不會一起回退。之後在[〈PostgreSQL 與 MySQL〉](#/lesson/sq-db-08)會比較。
