---
id: sq-expr-03
module: sq-expr
order: 3
title: CASE 分類
subtitle: 替庫存貼上補貨標籤
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-02
objectives:
- 用 CASE 依庫存門檻標示缺貨、偏低與正常
- 以 0 與 5 件兩種邊界驗證分支次序
- 判斷未符合任何條件時 ELSE 和缺值各如何處理
tags:
- case
- when
- 條件分類
- 門檻
resources:
- title: CASE Expression
  url: https://duckdb.org/docs/stable/sql/expressions/case
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 CASE 第一個命中分支及預設值。
- title: MySQL Flow Control Functions
  url: https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 對照 MySQL 的 CASE 與 IF 語法。
concepts:
- id: sq-expr-03-first
  prompt: 同一列符合兩個 WHEN 時，CASE 採用哪個？
  answer: 從上往下第一個為真的分支。
  mcq:
    question: 庫存為 0，先寫 stock <= 5，再寫 stock = 0，會進哪一支？
    options:
    - 最後寫的那支
    - stock <= 5
    - 兩支都執行輸出兩列
    - 進 ELSE
    answer: 1
    explain: 0 同時符合兩條件，第一個命中就停止。
- id: sq-expr-03-else
  prompt: 沒有 ELSE 且所有 WHEN 都不符合，結果是什麼？
  answer: NULL，不是原值或零。
  mcq:
    question: CASE WHEN stock = 0 THEN 'empty' END 對 5 件怎麼輸出？
    options:
    - '5'
    - empty
    - '0'
    - 'NULL'
    answer: 3
    explain: 沒有命中的分支，又沒給預設值，結果就是缺值。
- id: sq-expr-03-null
  prompt: 若 NULL 要標為未知，哪種 WHEN 寫法正確？
  answer: '`WHEN stock IS NULL THEN ''unknown''`；不要用 `stock = NULL`。'
  interview:
    question: 調整補貨門檻時你怎麼驗證沒有誤分類？
    answer: 先把每個標籤的範圍寫下來，再拿剛好 0、5、6 件和缺值試跑。若條件可能重疊，先放更窄的；我也會對照總列數，確認只是換標籤，不是漏了商品。
    points:
    - 測試等於門檻和相鄰值
    - 說出第一個命中與缺值分支
practice:
- id: sq-expr-03-p1
  kind: sql
  category: [expression]
  title: 商品補貨標籤
  minutes: 5
  level: 1
  dataset: shop
  prompt: 為 `products` 每項商品加標籤：庫存是 0 為 `empty`，1 到 5 件為 `low`，大於 5 為 `ready`。若沒有值或數量小於 0，標成 `unknown`。輸出 `product_id`、`stock`、`stock_band`，依此欄序；按 `product_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT product_id, stock,
           CASE
             WHEN stock = 0 THEN 'empty'
             WHEN stock BETWEEN 1 AND 5 THEN 'low'
             WHEN stock > 5 THEN 'ready'
             ELSE 'unknown'
           END AS stock_band
    FROM products
    ORDER BY product_id;
  explain: 0 與 5 件要分別標為 empty、low。先寫精確的門檻，並保留未知分支；不要把 5 件標成 ready。
  hints:
  - 從已知零開始
  - 把不能分類的放進 ELSE
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-03-first
  - sq-expr-03-else
  - sq-expr-03-null
  - sq-read-08-inclusive
  tags:
  - case
  - when
  - 條件分類
- id: sq-expr-03-p2
  kind: sql
  category: [expression]
  title: 購物事件補登優先序
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 取 `raw_id` 30 到 37（含）。缺 `session_id` 的付款步驟標 `urgent`；其他缺 `session_id` 的標 `review`；餘下標 `ok`。輸出 `raw_id`、`step`、`review_flag`，採此欄序並按 `raw_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, step,
           CASE
             WHEN session_id IS NULL AND step = 'pay' THEN 'urgent'
             WHEN session_id IS NULL THEN 'review'
             ELSE 'ok'
           END AS review_flag
    FROM app_events
    WHERE raw_id BETWEEN 30 AND 37
    ORDER BY raw_id;
  explain: 付款缺會話是更窄的條件，要比「所有缺會話」先判斷。34 應是 urgent，33 是 review，37 雖付款但有會話，所以是 ok。
  hints:
  - 先寫窄的缺值條件
  - 再判斷一般缺值
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-03-first
  - sq-expr-03-null
  - sq-read-07-both
  - sq-read-04-missing
  tags:
  - case
  - when
  - 條件分類
---

## 同一份庫存表，多一欄可採取行動的標籤

店員看見 0 件要處理缺貨，看到 5 件要加入待補清單，看到 8 件暫不用動。把這些判斷寫成條件運算式（conditional expression），就能讓每一列都算出一個標籤，不必人工逐列填表。記住這不是篩選：想保留商品並標記狀態，要在 `SELECT` 加一欄；想只看符合條件的列，才用 `WHERE`。

## 語法速查

- `CASE WHEN 條件 THEN 值 WHEN 另一條件 THEN 另一值 ELSE 預設值 END`：依序檢查，第一個為真的分支提供結果。
- `CASE 欄位 WHEN 值 THEN 結果 ELSE 預設值 END`：同一欄和各候選值做等號比較的簡式。要寫數量範圍或 `IS NULL`，使用上一種。
- 不寫 `ELSE` 時，沒有命中的列回 `NULL`。各分支應可合成同一種輸出類型；本堂標籤都用字串，避免一支回文字、另一支回數字。

數據集：`shop`。先取四個代表品項，確認標籤沒有擋掉任何一列：

```sql
SELECT product_id, stock,
       CASE
         WHEN stock = 0 THEN 'empty'
         WHEN stock BETWEEN 1 AND 5 THEN 'low'
         WHEN stock > 5 THEN 'ready'
         ELSE 'unknown'
       END AS stock_band
FROM products
WHERE product_id IN (101, 103, 104, 107)
ORDER BY product_id;
```

101 有 8 件，正常；103 為零，缺貨；104 和 107 剛好各 5 件，都是待補。沒有任何庫存資料時，不會因為「沒證明低庫存」而自動變正常；上面的 `ELSE` 刻意把未命中的範圍放在未知。若業務要分辨「庫存未知」與「負值出錯」，就各自定義標籤，不用同一個字串掩蓋兩種狀況。

## 條件重疊時，次序就是規則的一部分

若寫成 `WHEN stock <= 5 THEN 'low'` 再接 `WHEN stock = 0 THEN 'empty'`，零件會被先標低庫存，缺貨標籤始終用不到。可以把條件改成互斥的 0、1 到 5、6 以上，也可以有意利用先窄後寬的順序。動手題的事件就是後者：缺會話而且是付款比一般缺會話更急，要先檢查。挑一列同時符合兩個條件，再挑一列只符合較寬條件，各走一遍才能證明次序對。

**換引擎怎麼說：**這裡的 `CASE WHEN` 能移到 Hive SQL、Spark SQL、MySQL。MySQL、Spark SQL 也有函式 `IF`，但要讀多個門檻時，照業務順序排列 `WHEN` 比巢狀函式清楚。選這種語法不代表文字和數字能任意混作結果；移植時也要核對輸出類型。

簡式適合離散代碼，例如來源只有 `paid` 或 `cancelled`，可用 `CASE status WHEN 'paid' THEN '已付款' … END` 改成顯示名稱。想按庫存區間分級，或判斷「付款而且缺會話」，就不能只寫一個候選值。用完整 `WHEN` 條件可一眼看出需要同時成立的部分，測試時也可照條件逐項手算。分支和顯示的文字最好各只有一種責任：先用指定的碼做分類，若要把碼翻成讀者用的文字，再另外定顯示名稱。不要為了改字樣而改門檻。

## 常見錯誤

- **零件被標待補** → 較廣的 `stock <= 5` 擋掉零件分支 → 先判零或改成互斥區間。
- **未分類變成一格 NULL** → 忘了 `ELSE` → 明寫未知標籤，或在規格上確認應保留缺值。
- **商品列突然少了** → 用 `WHERE` 丟掉非目標商品 → 將分類運算放在 `SELECT`。
- **未知沒有命中** → 用 `= NULL` 做等號比較 → 改成 `IS NULL`。

把四列的結果當你的驗收表：任何同事都能用庫存欄逐一重算標籤，不必知道程式是怎麼實作的。
