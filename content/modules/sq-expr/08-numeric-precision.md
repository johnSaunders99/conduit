---
id: sq-expr-08
module: sq-expr
order: 8
title: 精度與除法
subtitle: 不要把轉換率算成整數
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-07
objectives:
- 比對一般除法和整數除法在不能整除時的結果
- 用 NULLIF 處理分母為零的比例
- 以分或定點小數管理金額，並在輸出時才做約定的捨入
tags:
- 除法
- 整數除法
- decimal
- nullif
- 比例
resources:
- title: Numeric Functions
  url: https://duckdb.org/docs/stable/sql/functions/numeric
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀除法、整數除法與 ROUND 的差別。
- title: MySQL Arithmetic Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/arithmetic-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照 MySQL 的斜線除法和 DIV。
concepts:
- id: sq-expr-08-division
  prompt: DuckDB 中 3 / 5 與 3 // 5 有何差別？
  answer: 前者是 0.6，後者是 0，整數除法去掉小數部分。
  mcq:
    question: 比率要保留小數時，DuckDB 應用哪個？
    options:
    - 3 / 5
    - 3 // 5
    - CAST(3 / 5 AS INTEGER)
    - 3 / 5 後永遠轉成百分比字串才可計算
    answer: 0
    explain: 斜線保留小數；整數化或輸出成字串不符合數值比率。
- id: sq-expr-08-zero
  prompt: 分母 0 代表比率不適用，怎麼讓結果為 NULL？
  answer: 用 `n / NULLIF(d, 0)`，讓零分母先成為缺值。
  mcq:
    question: 對分母為 0 的品項，題目要保留未知比例，該如何處理？
    options:
    - 把分母補成 1
    - 把整列刪掉
    - 將分母用 NULLIF 轉為 NULL
    - 把結果當 0
    answer: 2
    explain: 只替零分母產生缺值；刪列會讓核對看不到該品項。
- id: sq-expr-08-money
  prompt: 為什麼金額加總宜先使用整數分或 DECIMAL？
  answer: 可避免用二進位浮點近似表示每筆金額；需要四捨五入時，要依統一的計價規則處理。
- id: sq-expr-08-rounding
  prompt: 若報表只要比例小數第 2 位，應在哪一步捨入？
  answer: 先算完整比率，再在輸出層才捨入；不要先將分子、分母或中間比例轉整數。
  mcq:
    question: 若還要用 5 / 8 乘回 5 件，應讓下游拿到什麼？
    options:
    - 顯示值 0.63 就足夠
    - 整數商 0
    - 原始分子分母或未捨入的 0.625
    - 把 5 和 8 都轉成文字
    answer: 2
    explain: 0.63 乘回 8 不恰好等於 5；保留原始精度可避免失真。
  interview:
    question: 轉換率全是零，但分子有正數，你會怎麼找？
    answer: 我會先挑 3 比 5 這種不能整除的數，查是不是做了整數除法或提前轉成整數。接著試分母為零，確認是回 NULL 還是引擎的特殊值，不讓「沒有可比較樣本」變成 0%。
    points:
    - 用不能整除的小數驗證
    - 驗證零分母或特殊值
practice:
- id: sq-expr-08-p1
  kind: sql
  category: [expression]
  title: 相對目標庫存比例
  minutes: 5
  level: 1
  dataset: shop
  prompt: 以 `products` 計算相對於 8 件目標的庫存比例（庫存除以 8，0 到 1 的比例尺度，允許超過 1，不乘 100）。按欄序輸出 `product_id`、`stock_ratio`，不捨入；依 `product_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT product_id, stock / 8.0 AS stock_ratio
    FROM products
    ORDER BY product_id;
  explain: 庫存 5 件應為 0.625，而不是整數 0；庫存 0 才是已知的零比例。
  hints:
  - 用一般除法
  - 比例不等於百分比欄
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-08-division
  - sq-expr-08-rounding
  - sq-expr-01-units
  tags:
  - 除法
  - 整數除法
  - decimal
- id: sq-expr-08-p2
  kind: sql
  category: [expression]
  title: 每件庫存分攤成本
  minutes: 7
  level: 2
  dataset: shop
  prompt: 假設每個商品有 2 元固定整理成本，以目前庫存件數平均分攤。從 `products` 按欄序輸出 `product_id`、`stock`、`cost_per_unit`，分攤值以元計並四捨五入至小數第 2 位；無庫存應保留列、分攤值為 NULL。依 `product_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT product_id, stock,
           ROUND(2.0 / NULLIF(stock, 0), 2) AS cost_per_unit
    FROM products
    ORDER BY product_id;
  explain: 103 仍在表但分攤不適用；102 有 3 件，應顯示數值 0.67。把缺值補 0 或先整除都改變意義。
  hints:
  - 先把零分母轉為 NULL
  - 最後用 ROUND(..., 2)
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-08-division
  - sq-expr-08-zero
  - sq-expr-08-rounding
  - sq-expr-04-blanks
  tags:
  - 除法
  - 整數除法
  - decimal
---

## 三件佔五件，是六成不是零

報表上一欄比例全是 0，不代表沒人採取行動。用 3 比 5 測試，手算應該是 0.6；如果查詢得到 0，先檢查是不是取了整數商。數值精度（numeric precision）決定每一步保留多少資訊，不是把最後的欄名改成百分比就能補回來。先確認比例尺度：0.6 與 60% 表示同一比率，欄位若只叫 ratio 就交付 0.6。

## 語法速查

- DuckDB 的 `a / b` 做一般除法，`a // b` 在兩邊都是整數時取整數商。`3 / 5` 是 0.6，`3 // 5` 是 0。
- `NULLIF(b, 0)` 在 b 等於 0 時回 NULL，其他時候保留 b。用 `a / NULLIF(b, 0)` 明確規定分母為零時比例未知，不依賴各引擎的零除行為。
- `ROUND(x, 2)` 將結果捨入到小數第 2 位，產生的仍是數值。顯示兩位小數與實際數值捨入是兩個要求。
- 定點小數（fixed-point decimal）`DECIMAL(p, s)` 的 p 是總位數，s 是小數位數。整數分或定點小數適合表示金額；DuckDB 的定點小數除法仍產生近似的浮點（floating-point）結果，別只因輸入叫 DECIMAL 就假定商也精確。

數據集：`shop`。並排列出兩種商，核對是哪一步丟了小數：

```sql
SELECT product_id, stock,
       stock / 8 AS stock_ratio,
       stock // 8 AS whole_ratio
FROM products
WHERE product_id IN (102, 103, 104)
ORDER BY product_id;
```

102 有 3 件，是 0.375；104 有 5 件，是 0.625；103 沒庫存，數值就是 0。整數商三筆全成了 0。如果畫面只剩那一欄，庫存完全沒貨與還有 5 件就無法區分。再看另一種問題：按庫存件數分攤固定成本時，103 的分母是零。此時「每件零元」與「沒有任何可分攤的件」不同，後者保留一列及缺值，讓營運看得到小杯仍列在商品表。

## 先算，後捨入

若需要同一份報表既顯示兩位小數，又讓後續做總計，保留未捨入或原始分子分母會更好核對。提早捨入會逐步累積差異；金額先用分計算，也要確定欄位範圍容得下高金額。若帳務要求每筆按特定方式處理半分，就依該規則逐筆結算，而不是盲目把報表的末端捨入搬到帳務中。[加權平均](#/lesson/sq-group-08) 會再用未捨入的分子和分母重算比例。

**換引擎怎麼說：**MySQL 和 Spark SQL 的整數商用 `DIV`，不是 DuckDB 的 `//`。MySQL 的精確值斜線除法有其小數位取法；DuckDB 對整數的 `/` 回浮點。不要依賴任一環境的零除預設，用 `NULLIF` 把報表規則先寫明。

做一次小型對帳：把 5 件的比例乘回目標 8 件，未捨入的 0.625 能回到 5。如果先顯示成兩位小數的 0.63，再拿顯示值回算，就會得到 5.04。這並不表示原庫存有小數件，而是顯示精度不足以重建原數。若下一段管道還需核回件數，要保留原始分子、分母，而不是等下游從報表畫面推回去。金額以分輸入時也要留下幣別；不同幣別的分並不能直接相加。

## 常見錯誤

- **不能整除卻算成 0** → 選了整數除法 → 核對 3 比 5 再用 `/`。
- **沒有庫存卻列出零成本** → 混淆零與不適用 → 零分母回 NULL，不填成 0。
- **合計每次差一點** → 太早捨入或數字表示不同 → 留下原始金額和分母，依同一口徑才出表。
