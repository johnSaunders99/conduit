---
id: sq-db-06
module: sq-db
order: 6
title: 索引與選擇性
subtitle: 不是每個欄位都要建索引
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-05
objectives:
- 計算查詢匹配列占比並說明索引何時值得評估
- 建立單欄及複合索引並以索引定義自查
tags:
- 索引
- 選擇性
- 複合索引
resources:
- title: DuckDB：索引效能
  url: https://duckdb.org/docs/current/guides/performance/indexing
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 ART 單欄掃描條件及更新成本。
- title: MySQL：如何使用索引
  url: https://dev.mysql.com/doc/refman/8.4/en/mysql-indexes.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看複合索引的最左前綴與成本選擇。
concepts:
- id: sq-db-06-selectivity
  prompt: 匹配列占比在 1% 與 80% 時，哪個通常較值得先評估索引？
  answer: 1% 的查詢排除了大部分列；但是否使用仍由實際成本和引擎決定。
  mcq:
    options:
    - 80% 一定走索引
    - 哪個有排序就一定走索引
    - 1% 但需看計畫
    - 建索引會改匹配筆數
    answer: 2
    explain: 索引是查找路徑，不改查詢條件或結果。
- id: sq-db-06-prefix
  prompt: MySQL 的 B-tree 複合索引 (user_id, order_date) 自然先服務哪種查法？
  answer: 先以 user_id 查，再依 order_date 篩選；只按日期查不能當成同等的前綴查找。
  mcq:
    options:
    - 只用日期一定等效
    - SQL WHERE 中先寫日期即可
    - 只靠 ORDER BY 任意非索引欄
    - 以會員鍵限縮，再看日期
    answer: 3
    explain: 複合索引的實際鍵順序與 WHERE 的書寫順序不同。
  interview:
    question: 如何決定要不要為訂單加索引？
    answer: 我先看主要查詢和匹配比例，挑最常用的條件對比計畫和實際時間，另外量寫入成本。若是會員等值加日期區間，我會在 MySQL 先評估會員、日期的順序，不假設 DuckDB 的掃描規則一樣。
    points:
    - 用實際工作負載
    - 核對欄位順序與匹配比例
    - 測讀取與寫入
- id: sq-db-06-cost
  prompt: 索引建立後，為什麼寫入可能變慢？
  answer: 新增、刪除或更新相關欄位，通常還要維護索引結構，並消耗空間。
  mcq:
    options:
    - 每次相關寫入也要維護索引
    - 索引會自動複寫整個數據庫
    - 索引改變 WHERE 的條件
    - 所有查詢都必須重建索引
    answer: 0
    explain: 每個索引都要為它服務的查詢賺回維護成本。
practice:
- id: sq-db-06-p1
  kind: sql
  category: [plan, select]
  title: 比較兩個查詢的匹配比例
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對 orders 比較 user_id=1 和 user_id=8。輸出 user_id、matching_rows、total_rows、matched_pct（0 到 100，不用捨入），依 user_id 升冪。
  solution: |
    SELECT user_id, COUNT(*) AS matching_rows,
           (SELECT COUNT(*) FROM orders) AS total_rows,
           100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders) AS matched_pct
    FROM orders WHERE user_id IN (1, 8) GROUP BY user_id ORDER BY user_id;
  explain: |
    分母是全表，不是只保留兩個會員後的列數；兩者比例差反映了偏斜。MySQL 的 DIV 是整數除法，別用它算有小數的百分比。
  hints:
  - 分子先按 user_id 計數
  - 分母獨立從整張表算
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-06-selectivity
  tags:
  - 索引
  - 選擇性
  - 複合索引
- id: sq-db-06-p2
  kind: sql
  category: [plan, ddl]
  title: 建立兩個可核對的索引
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    在 orders 建立命名為 lab_order_user_idx 的非唯一單欄索引（user_id），再建 lab_order_user_date_idx（user_id、order_date，欄位順序不可調換）。系統在索引目錄輸出 index_name、key_expr，依 index_name 字串升冪；不用寫 SELECT。
  solution: |
    CREATE INDEX lab_order_user_idx ON orders (user_id);
    CREATE INDEX lab_order_user_date_idx ON orders (user_id, order_date);
  explain: |
    這題驗證索引欄位與順序，不代表兩個索引都應留在正式環境，也不保證 DuckDB 會用複合索引掃描。MySQL、PostgreSQL 優化方式不同。
  hints:
  - 用 CREATE INDEX … ON …
  - 複合索引先列會員鍵，再列日期
  check:
    ordered: true
    columnNames: true
    mode: state
    query: |
      SELECT index_name, expressions AS key_expr FROM duckdb_indexes() WHERE table_name = 'orders' ORDER BY index_name;
  concepts:
  - sq-db-06-prefix
  - sq-db-06-cost
  - sq-db-03-ddl
  tags:
  - 索引
  - 選擇性
  - 複合索引
---

今天有兩個客服查詢：一個只找會員 8 的訂單，另一個找會員 1 的訂單。兩個都查會員鍵，代價卻未必一樣。若直接為每個欄位建索引，日後匯入訂單時還得付出額外的維護成本。先問「它能替哪種查詢少看多少列？」

## 先想它省什麼

索引（index）是另一條找列的路徑。`CREATE INDEX 索引名 ON 表名 (欄位)` 建單欄索引；括號內有多欄就是複合索引（composite index）。索引不會替你保證輸出排序，有序結果仍寫 `ORDER BY`。看選擇性（selectivity）時，本課明寫「匹配列占比」：命中 5 列除以總共 100 列，就是 5%；占比越小，越值得評估這個條件是否能省讀取。有些人說「選擇性高」反而是指過濾力強，所以溝通時報數字。

在 SQL 練習場選 `shop`，比較不同會員。圖表或查詢筆數再漂亮，都不能從這份小樣本推導正式表的加速倍率。測試也別順手把主鍵或約束刪掉：用來驗證正確性的索引與為了效能新增的索引，不必有相同去留。

```sql
SELECT user_id, COUNT(*) AS matching_rows
FROM orders WHERE user_id IN (1, 8)
GROUP BY user_id ORDER BY user_id;
```

## 索引順序不是 WHERE 的書寫順序

在 MySQL 的一般 B-tree 索引（B-tree index）中，`(user_id, order_date)` 像先按會員分冊，再按日期在冊內排列。查某會員的日期區間，這條路徑通常合理；只查某天，不能當成直接以前綴找會員。若已在本機安裝 MySQL 或 PostgreSQL，以下是同樣可執行的建表與索引語法。它會建一張空練習表，可在同一連線查看索引；比較速度時需先準備有代表性的數據量。不要在正式表執行。

```sql
CREATE TABLE lab_index_order (user_id INTEGER, order_date DATE);
CREATE INDEX lab_member_date ON lab_index_order (user_id, order_date);
```

DuckDB 常靠列式掃描和自動區塊統計跳過無關範圍；ART 索引主要適合選擇性強的單欄查找，別把 MySQL 的最左前綴結論直接套進 DuckDB 的索引掃描。建索引前後怎麼比較實際讀取，之後在[〈EXPLAIN 執行計畫〉](#/lesson/sq-db-07)會做。

## 做一個公平的前後比較

先選定查詢和輸出欄，不要一邊建索引，一邊把日期範圍改小。以相同參數在建索引前和建後各跑一次計畫，確認結果列及排序完全一樣，再記掃描方式。至少比較一個窄條件和一個常見條件；若它們總命中不同數量，不能只挑最快的一個代表所有查詢。寫入面則保留同樣批量與同樣欄位，分別記索引有無時的耗時；在小練習數據中差距可能不可辨認，此時只報可觀察的結構差異，不宣稱效能提升。

確認索引不再有讀取價值後，也別直接移除：先查它是否還保護唯一性或被其他查詢使用。

## 常見錯誤

- 建了索引仍掃表 → 樣本小或條件命中太多 → 看計畫，再用代表性數據測試。
- 只查日期卻誤判複合索引合用 → 索引先按會員而非日期 → 先核對常用的篩選前綴。
- 寫入變慢 → 每個索引增加維護工作 → 保留能服務真實查詢的組合，再比較寫入時間。
