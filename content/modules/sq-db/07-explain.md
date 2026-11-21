---
id: sq-db-07
module: sq-db
order: 7
title: EXPLAIN 執行計畫
subtitle: 查十筆為何掃了整張表
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-06
objectives:
- 從計畫讀出掃描、篩選與輸出列數
- 區分 EXPLAIN 的估計與 EXPLAIN ANALYZE 的實測
tags:
- EXPLAIN
- 執行計畫
- 列數估計
resources:
- title: DuckDB：EXPLAIN ANALYZE
  url: https://duckdb.org/docs/current/guides/meta/explain_analyze
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看每個運算的實際列數與時間。
- title: PostgreSQL：讀執行計畫
  url: https://www.postgresql.org/docs/current/using-explain.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀掃描節點、估計與實測欄位。
concepts:
- id: sq-db-07-plan
  prompt: 執行計畫上的輸出列數等於掃過的列數嗎？
  answer: 不一定。全表掃描可先看大量列，只輸出條件命中的幾列。
  mcq:
    options:
    - 一定一樣
    - 永遠比掃描數多
    - 一律等於 LIMIT 的數字
    - 不一定，要看運算節點與篩選
    answer: 3
    explain: 輸出只計留下的列，不說明引擎為找它讀了多少。
- id: sq-db-07-actual
  prompt: EXPLAIN ANALYZE 有什麼和普通 EXPLAIN 不同的風險？
  answer: 它會真的執行被分析的語句；在支援的引擎中，分析寫入也可能真的改數據。
  mcq:
    options:
    - 它真的執行語句
    - 它僅修改估計
    - 它一定會永久建索引
    - 它不會使用處理器
    answer: 0
    explain: 純估計與實測要分別操作，正式環境先選讀取。
  interview:
    question: EXPLAIN 的估計 2 列，實際 40 列，你先做什麼？
    answer: 我先找偏差最早出現的節點，確認篩選值是否分布偏斜、統計是否過舊，或連接鍵是否重複。再用同樣條件重跑比較，不會看到掃表就立刻加索引。
    points:
    - 從最早的差異節點查起
    - 看分布、統計與連接基數
    - 保留相同口徑的前後量測
- id: sq-db-07-pushdown
  prompt: SQL 只選訂單編號，為何計畫還可能讀會員編號？
  answer: 篩選仍需要會員欄位。輸出欄位和為了計算必須讀的欄位不同。
  mcq:
    options:
    - 引擎永遠會讀所有欄
    - 篩選仍依賴會員欄位
    - SELECT 不影響欄位
    - 會員編號一定會顯示在結果
    answer: 1
    explain: 檢查讀取哪些欄位時要同時看投影、篩選與連接。
practice:
- id: sq-db-07-p1
  kind: sql
  category: [plan]
  title: 取得計畫查詢的實際輸出
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對 orders 查會員 8 於 2026-01-17（含）至 2026-02-01（不含）的訂單，不限狀態。輸出 order_id、order_date、status，依 order_date、order_id 升冪。此題比對結果，不輸出 EXPLAIN 文字。
  solution: |
    SELECT order_id, order_date, status FROM orders
    WHERE user_id = 8 AND order_date >= DATE '2026-01-17'
      AND order_date < DATE '2026-02-01'
    ORDER BY order_date, order_id;
  explain: |
    用日期半開區間保留起日。拿這個查詢去看計畫，再用結果列數核對，不要以為掃描節點的實際輸出就是實體讀取列數。
  hints:
  - 會員等值和日期區間都要寫
  - 保留取消單
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-07-plan
  - sq-db-07-pushdown
  tags:
  - EXPLAIN
  - 執行計畫
  - 列數估計
- id: sq-db-07-p2
  kind: sql
  category: [plan, join]
  title: 把連接放大的列數算出來
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    對 orders 的 1001 至 1003 左連接 order_items，逐單輸出 order_id、joined_rows（相接後的列數）、matched_items（匹配到的明細數），依 order_id 升冪；假如沒明細，前者 1，後者 0。
  solution: |
    SELECT o.order_id, COUNT(*) AS joined_rows, COUNT(i.line_no) AS matched_items
    FROM orders o LEFT JOIN order_items i USING(order_id)
    WHERE o.order_id BETWEEN 1001 AND 1003
    GROUP BY o.order_id ORDER BY o.order_id;
  explain: |
    先核對右表重複鍵的效果，再去解釋連接節點。只計 DISTINCT 訂單數會掩蓋列數膨脹。
  hints:
  - COUNT(*) 看相接後的全部列
  - 明細數要數右表的非空欄位
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-07-plan
  - sq-db-07-actual
  - sq-db-01-pk
  tags:
  - EXPLAIN
  - 執行計畫
  - 列數估計
---

你的查詢只回 2 張單，卻可能掃過整張訂單表。「回幾筆」和「為了找到這幾筆做多少工作」不是一件事。今天畫出查詢從讀表到出結果的路，再用一份固定結果校正你的解讀。

## 把計畫當運算流程讀

執行計畫（execution plan）是引擎安排的操作，不是把你寫的 SQL 從上念到下。掃描（scan）取數據；篩選（filter）只保留符合條件的列；投影（projection）取得運算需要的欄位或算式。計畫常畫成樹，先看下面的來源，再向上看連接、聚合、排序。做判斷前，把「輸入列、這層留下的列、最後回傳列」分開記。

- `EXPLAIN SELECT …` 顯示計畫及估計，不等同於執行結果。
- `EXPLAIN ANALYZE SELECT …` 真的執行，再附上觀察到的列數與時間；不要拿寫入語句在正式表測。
- 算子時間未必可以直接相加，平行工作可能重疊。樣本小時，時間常四捨五入，先比做了哪些事。

## 先算對，再問快不快

在 DuckDB 練習場選 `shop`，分開執行兩段，比較掃描、連接和最終輸出的列數：

```sql
EXPLAIN
SELECT o.order_id, i.line_no FROM orders o
JOIN order_items i USING (order_id)
WHERE o.order_id = 1001;
```

```sql
EXPLAIN ANALYZE
SELECT o.order_id, i.line_no FROM orders o
JOIN order_items i USING (order_id)
WHERE o.order_id = 1001;
```

訂單只有一張，接上品項後是 2 行；實際計畫的最上層有時包含僅用來展示計畫的節點，找真正承載查詢的運算，別把外層標題看成輸出。對照前一課的索引例子：數據量小，順序掃描可能最省。大表的偏斜、過時統計、重複鍵都會讓估計有偏差，不是每個偏差都值得立刻修。

## 查出偏差在哪一層開始

先寫下你的手算：主表符合一單，明細有兩行，最終應回兩行；再沿著兩條輸入分支對實測。若主表實際回了多張單，去查篩選條件和鍵；若兩邊輸入都對，卻多出重複品項，去找造成一對多的連接，而不是怪排序。選一個窄條件和一個常見條件重新看計畫，這可以說明同一段查詢為什麼會在不同參數下做不同工作。筆記應保留查詢條件、估計、實測和下一個要查的節點，方便別人重現。

如果實際列數一致卻時間不同，再確認是否改變讀取欄位、數據是否已在快取，以及執行期間有無其他工作；不要拿單次跑最快的結果當基準。

## 常見錯誤

- 掃描節點寫 2 列就斷言只讀 2 列 → 那可能是篩選後的輸出 → 對照掃描類型與條件。
- 改寫後看似更快，卻少一行 → 查詢語意跟著改了 → 先比一致的結果，再比計畫。
- 把分析寫入當成唯讀 → 分析型命令可能真執行語句 → 本課只分析讀取。

## 方言與面試

PostgreSQL 本機可用 `EXPLAIN (ANALYZE, BUFFERS)` 加上唯讀查詢看讀取緩衝狀態；DuckDB 的文字欄位和統計不相同。Spark SQL 的 `EXPLAIN FORMATTED` 用來看計畫概要與節點詳情，不代表已執行；實際執行統計要到 Spark 執行介面核對。把一張「預期 2 列、實際 2 列，這一步來自連接」的筆記留下，比背完各種掃描名稱更有用。
