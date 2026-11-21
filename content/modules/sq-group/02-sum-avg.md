---
id: sq-group-02
module: sq-group
order: 2
title: SUM 與 AVG
subtitle: 分母是品項列、件數還是訂單
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-01
objectives:
- 對同一批明細算 SUM、AVG 及參與平均的列數
- 先限制有效範圍，再手算分子與分母
- 解釋空輸入與已知金額為零的差異
tags:
- sum
- avg
- 平均分母
- 金額加總
resources:
- title: Aggregate Functions
  url: https://duckdb.org/docs/stable/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 sum、avg 與空群組的回傳值。
- title: MySQL Aggregate Function Descriptions
  url: https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查精確數值與浮點輸入的回傳類型。
concepts:
- id: sq-group-02-mean
  prompt: AVG(x) 的分母是 COUNT(*) 嗎？
  answer: 一般不是；只數 x 有值的列，即 COUNT(x)。
  mcq:
    question: 三列 x 分別是 10、NULL、20，AVG(x) 是多少？
    options:
    - '10'
    - '15'
    - '30'
    - 'NULL'
    answer: 1
    explain: 用 30 除以 2；未知值不是零，也不讓其他已知值的平均失效。
- id: sq-group-02-empty
  prompt: 零位已付款樣本的 SUM 和 AVG 會是什麼？
  answer: 在本堂未分組查詢中，兩者都為 NULL；COUNT(*) 為 0。
  mcq:
    question: 沒有任何列通過 WHERE，SUM(amount) 應如何理解？
    options:
    - 總金額已知為 0
    - 查詢必定回 0 列
    - 有一列摘要，但總金額值為 NULL
    - 輸出會是平均值
    answer: 2
    explain: 未分組聚合仍回一列；這不是觀察到零金額。
- id: sq-group-02-unit
  prompt: order_items 的 AVG(qty * unit_price) 平均的是什麼？
  answer: 每筆明細的金額，不是每件商品的平均單價，也不是每張單的平均金額。
- id: sq-group-02-cohort
  prompt: 歷史薪級和現行薪級可以一起平均嗎？
  answer: 只有需求要平均歷史紀錄才混算；算現行月薪前先用 valid_to IS NULL 篩選。
  mcq:
    question: 薪級表每位員工可能有多段薪級，要算現行平均應先保留哪些列？
    options:
    - 每一段都留
    - valid_to 為 NULL 的列
    - valid_to 有日期的列
    - 同一員工只留下金額最低的一段
    answer: 1
    explain: 現行的定義是迄日缺值，不是月薪大小。
  interview:
    question: 別人的客單價比你低，你怎麼確認差在哪？
    answer: 先對齊只算哪種訂單，特別是取消和退款，再看分母是不是訂單張數。如果來源一列只是單內明細，就先求每張訂單金額再平均，不直接拿明細列數。
    points:
    - 對齊計算範圍
    - 指出訂單張數與明細列數不同
practice:
- id: sq-group-02-p1
  kind: sql
  category: [aggregate]
  title: 單張訂單的明細合計
  minutes: 4
  level: 1
  dataset: shop
  prompt: 從 `order_items` 只取 1001 號訂單，金額為件數乘以元單價。輸出一列，欄序為 `line_count`（明細列數）、`total_yuan`（明細金額合計）、`avg_line_yuan`（明細平均金額，以元計、不捨入）。不要求列排序。
  starter: 'SELECT '
  solution: |
    SELECT COUNT(*) AS line_count, SUM(qty * unit_price) AS total_yuan,
           AVG(qty * unit_price) AS avg_line_yuan
    FROM order_items
    WHERE order_id = 1001;
  explain: 兩列為 135 元和 90 元；合計 225 元，平均明細金額 112.5 元。用單價做 AVG 會漏掉多件的金額。
  hints:
  - 聚合的輸入是每列金額，不只單價
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-02-mean
  - sq-group-02-unit
  - sq-expr-01-units
  - sq-group-01-rows
  tags:
  - sum
  - avg
  - 平均分母
- id: sq-group-02-p2
  kind: sql
  category: [select]
  title: 現行薪級的原值核對清單
  minutes: 5
  level: 1
  dataset: hr
  prompt: 在 `salary_history` 找員工 1 到 4（含）的現行薪級，`valid_to` 為 NULL。只輸出 `employee_id`、`monthly_pay`，按此欄序及 `employee_id` 升冪；作為下一題平均月薪的一份小樣核對清單。
  starter: 'SELECT '
  solution: |
    SELECT employee_id, monthly_pay
    FROM salary_history
    WHERE employee_id BETWEEN 1 AND 4 AND valid_to IS NULL
    ORDER BY employee_id;
  explain: 1 號應只有 40500；38000 是歷史薪級。四列是 40500、42500、42000、38500，合計 163500，平均 40875。
  hints:
  - 先把不是現行的列排除，再看核對用的小範圍
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-02-cohort
  - sq-read-04-missing
  tags:
  - sum
  - avg
  - 平均分母
- id: sq-group-02-p3
  kind: sql
  category: [aggregate]
  title: 現行月薪平均與人數
  minutes: 7
  level: 2
  dataset: hr
  prompt: 只用 `salary_history` 的現行薪級交付一列。欄序為 `paid_people`（月薪有值的現行員工數，本表每名員工只有一筆現行薪級）、`sum_pay`（月薪合計，元）、`avg_pay`（月薪平均，元，不捨入）；不排序。`valid_to` 為 NULL 才是現行。
  starter: 'SELECT '
  solution: |
    SELECT COUNT(monthly_pay) AS paid_people,
           SUM(monthly_pay) AS sum_pay, AVG(monthly_pay) AS avg_pay
    FROM salary_history
    WHERE valid_to IS NULL;
  explain: 合計及平均只使用現行列；把同人以前的薪級也加入會同時扭曲金額和分母。這份數據現行月薪都非空，COUNT(monthly_pay) 明確對齊 AVG 分母。
  hints:
  - 先排除歷史薪級
  - 平均值的分母對應有月薪的列
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-02-mean
  - sq-group-02-cohort
  - sq-group-01-rows
  - sq-read-04-missing
  tags:
  - sum
  - avg
  - 平均分母
---

## 把分子和分母都交付

同事問一張單的明細平均多少元。單價平均不是答案，因為有人在同一列買了不只一件。平均的分子是各列金額合計，分母是有金額的明細列數。先用一句話說清楚你在平均什麼，才能決定聚合函式（aggregate function）應套在哪個值上。

## 語法速查

- `SUM(x)`：把有值的 x 加總；若沒有任何有值的輸入，回 `NULL`。
- `AVG(x)`：用有值的 x 算平均，分母是 `COUNT(x)`；沒有值可算時回 `NULL`。
- `SUM(qty * unit_price)`：先在每一列算件數乘單價，再加總各列的金額。不是把所有件數加起來，再乘所有單價的總和。
- `WHERE` 先決定輸入。例如只看某張訂單，或只看現行薪級。對同一口徑的合計和平均，使用同一批輸入。

數據集：`shop`。先用訂單 1001 得到可以手算的答案：

```sql
SELECT SUM(qty * unit_price) AS total_yuan,
       COUNT(qty * unit_price) AS valid_lines,
       AVG(qty * unit_price) AS avg_line_yuan
FROM order_items
WHERE order_id = 1001;
```

本單有小杯 3 件、每件 45 元，以及濾網 1 件、每件 90 元。兩列金額是 135 與 90 元；合計 225 元、有效明細 2 列、平均 112.5 元。若先把 45 與 90 平均，只得到 67.5，那是在算兩個品項單價的平均；既不是明細金額平均，也不是售出 4 件商品的實際平均單價。用數字先算一遍，比只讀函式的名稱更能驗出分母錯了沒有。

## 取消、缺值和空輸入

共用表的取消單仍保留明細。上面查的是指定單號的明細，不是整體付款報表；若把條件拿掉就宣稱全店已付款金額，會算進取消單。正式出表要先從訂單表確認付款單，再把明細接上；如何接表會在 [INNER JOIN](#/lesson/sq-join-01)細講。現行薪級練習則直接在同一張表辨認有效列，沒有接表需求。先設定口徑，再算，而不是靠 AVG 把不該進來的列自動消掉。

若選不到任何訂單，查詢仍給一列摘要：計數是 0，合計與平均是 NULL。這和找到明細、每筆金額都為 0 的狀況不同。展示需求若要空輸入顯示 0，可在說明過口徑後用 `COALESCE`，但保留計數才能追查到底是沒樣本還是觀測到零。

**換引擎怎麼說：**常用的 `SUM`、`AVG` 可以移植；回傳類型不能假設相同。MySQL 對整數或 DECIMAL 等精確值輸入的 `AVG` 回 DECIMAL，DuckDB 對本例整數明細的 `AVG` 回浮點數。移植金額核對先看回傳類型、捨入時機和空輸入規則。

驗算時可以把 1001 換成不存在的單號，看看底下仍有一列但找不到均值；再改回 1001，兩個金額都要重新出現。明細型報表通常會回 0 列，摘要型查詢則要檢查欄內的值。若下游只看回傳列數，就可能把一列空摘要當成已確認有交易。

## 常見錯誤

- **多件訂單平均偏低** → 平均的是單價而非列金額 → 改用 `AVG(qty * unit_price)`。
- **沒有成交卻列出已知零元** → 把空樣本的 NULL 直接當成已知值 → 同時展示計數與計算規則。
- **客單價變成每列明細金額** → 分母用錯單位 → 先整理成每張單一列再算平均。
