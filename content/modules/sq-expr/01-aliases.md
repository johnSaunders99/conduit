---
id: sq-expr-01
module: sq-expr
order: 1
title: 欄位別名與算式
subtitle: 以分為單位避免金額混亂
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 在 SELECT 計算逐列金額並用 AS 明寫輸出欄名
- 從欄名和算式核對元、分與件的單位
- 用排序和括號驗證同一筆明細的計算
tags:
- as
- 欄位別名
- 算式
- 金額單位
resources:
- title: SELECT Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/select
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 SELECT List，核對算式如何命名。
- title: MySQL SELECT Statement
  url: https://dev.mysql.com/doc/refman/8.4/en/select.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 讀欄位別名可用在哪些查詢子句。
concepts:
- id: sq-expr-01-alias
  prompt: AS 改的是原欄名還是輸出欄名？
  answer: 只改本次查詢結果的欄名。
  mcq:
    question: SELECT price AS price_yuan 後再預覽 products，原欄名是什麼？
    options:
    - price
    - price_yuan
    - 兩欄都有
    - 哪個名字取決於列數
    answer: 0
    explain: 別名只屬於結果，不會更動數據表結構。
- id: sq-expr-01-units
  prompt: 成交單價以元計，乘件數再乘 100，結果用什麼單位？
  answer: 分。
  mcq:
    question: 明細每件 45 元、買 3 件，line_amount_cents 應是多少？
    options:
    - '45'
    - '135'
    - '13500'
    - '4500'
    answer: 2
    explain: 先算整列共 135 元，再轉為分；不要只轉單價或漏轉。
- id: sq-expr-01-precedence
  prompt: 先算兩個值的差再乘 100，應如何寫？
  answer: 用括號包住差，例如 `(price - 5) * 100`。
- id: sq-expr-01-scope
  prompt: 想用計算欄的別名篩選，又要讓查詢能移到 MySQL，怎麼做？
  answer: 同層 WHERE 寫原算式；同層 ORDER BY 可以用 SELECT 的別名。
  mcq:
    question: 在 MySQL 要篩算式結果至少 10000，應把哪個條件寫進同層 WHERE？
    options:
    - line_amount_cents >= 10000，只使用 SELECT 的別名
    - qty * unit_price * 100 >= 10000
    - unit_price >= 10000
    - WHERE 不可比較算式，必須使用 HAVING
    answer: 1
    explain: MySQL 的同層 WHERE 不知道輸出別名；直接重寫金額算式能保持正確單位。
  interview:
    question: 你接到兩份金額剛好差 100 倍的報表，先查什麼？
    answer: 先對同一訂單明細，確認單價與輸出一個是元還是分，再用件數手算。若真的只是單位，我會改欄名標出單位，不會只除 100 把差異抹掉。
    points:
    - 同一列逐筆對照
    - 輸出欄應反映單位
practice:
- id: sq-expr-01-p1
  kind: sql
  category: [expression]
  title: 商品標價換成分
  minutes: 4
  level: 1
  dataset: shop
  prompt: 從 `products` 列出 `product_id` 和標價換算成分的 `price_cents`，欄序照此；先依 `price_cents` 降冪，再依 `product_id` 升冪。原欄 `price` 以元計，1 元等於 100 分。
  starter: 'SELECT '
  solution: |
    SELECT product_id, price * 100 AS price_cents
    FROM products
    ORDER BY price_cents DESC, product_id ASC;
  explain: 別名直接說明輸出單位；價格平手仍按唯一編號。只把欄改名不會進行單位換算。
  hints:
  - 在算式後面用 AS 命名
  - 可用新名字排序
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-01-alias
  - sq-expr-01-units
  - sq-read-03-tie
  tags:
  - as
  - 欄位別名
  - 算式
- id: sq-expr-01-p2
  kind: sql
  category: [expression]
  title: 明細金額核對單
  minutes: 7
  level: 2
  dataset: shop
  prompt: 列出 `order_items` 中訂單 1001 到 1003（含）的明細，只留金額至少 10000 分的明細列。按欄序輸出 `order_id`、`line_no`、`line_amount_cents`；按 `order_id`、`line_no` 升冪。`unit_price` 以元計；金額是件數乘單價，不扣退款。
  starter: 'SELECT '
  solution: |
    SELECT order_id, line_no, qty * unit_price * 100 AS line_amount_cents
    FROM order_items
    WHERE order_id BETWEEN 1001 AND 1003
      AND qty * unit_price * 100 >= 10000
    ORDER BY order_id, line_no;
  explain: 1001 的第 1 項是 13500 分，第 2 項 9000 分而被排除。只用單價篩會錯過多件合計剛過門檻的明細。
  hints:
  - 件數和單價相乘才是該列金額
  - 篩選也用同一算式
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-01-units
  - sq-expr-01-scope
  - sq-read-08-inclusive
  tags:
  - as
  - 欄位別名
  - 算式
---

## 欄名是對讀表人的約定

營運手上的商品表用元，核對檔卻用分。報表若只寫「價格」，同一壺茶可能看起來貴了 100 倍。這堂不更新數據表；只用查詢把單位換好，並讓欄名說出這個轉換。先拿兩筆數字用手算過：45 元是 4500 分，240 元則是 24000 分。欄名和數值要一起改，才算換單位。

## 語法速查

- `price AS price_yuan`：用欄位別名（column alias）為本次輸出命名，原表仍叫 `price`。
- `price * 100 AS price_cents`：把運算式（expression）算出的值放在新輸出欄。
- `+` 加、`-` 減、`*` 乘、`/` 除。乘除先於加減；用括號可以明確指定哪部分先做。除法的結果類型稍後在[精度與除法](#/lesson/sq-expr-08)細講。
- 排序可用輸出別名，例如 `ORDER BY price_cents DESC, product_id`。篩選想通用，仍用原欄位或原算式。

數據集：`shop`。同時留下兩個單位，直接在結果中核對：

```sql
SELECT product_id,
       price AS price_yuan,
       price * 100 AS price_cents
FROM products
WHERE product_id IN (103, 106)
ORDER BY product_id;
```

編號 103 的小杯應顯示 45 與 4500，編號 106 的茶壺則是 240 與 24000。若欄名正確但數字仍是 45，就只是改標籤；如果數字是 4500 卻標為元，讀表的人仍會看錯。再預覽原表，會發現 `price` 還在，本次換算沒有覆寫它。

## 單價先乘件數，折抵先問是每件還是每列

計算明細時，`unit_price` 是每件多少元，`qty` 是件數，相乘才是這列的金額。訂單 1001 的第 1 項有 3 件，每件 45 元，合計 135 元；第 2 項 1 件 90 元，合計 90 元。若篩選金額至少 100 元，只有第 1 項符合，不是選單價超過 100 元的商品。這份交付每一列仍是一筆訂單明細，不是整張訂單的總額。

括號也有業務意義。假設每件折 5 元，寫成 `qty * (unit_price - 5)`；假設整列只折 5 元，則寫 `qty * unit_price - 5`。同樣是 3 件 45 元，前者 120 元，後者 130 元。測試時刻意挑多件的明細，因為件數是 1 時兩種寫法會碰巧一樣，看不出錯。

**換引擎怎麼說：**DuckDB 允許部分非聚合 SELECT 別名用在 `WHERE`；MySQL 不接受同層 SELECT 的別名作為 `WHERE` 篩選。先用原算式篩選，排序則可用別名。當算式要在好幾處重用，可以先算成一張有名字的中間結果，之後在 [CTE 命名步驟](#/lesson/sq-compose-04)再練。

列出費用算式時，最好也留下可回查的鍵。例如同一訂單有第 1 和第 2 項，只輸出訂單號與金額，會讓核對者猜是哪一項。先留下 `order_id` 和 `line_no`，才好用原單對帳。如果要臨時看換算是否正確，可以並排原金額與分欄；正式交付再依要求刪去多餘欄。這樣後段的欄位選擇既不會改到金額，也不會掩蓋你曾採用的計價單位。下游若還要加總，也應保留數值欄而不是帶「分」字的格式化字串。

## 常見錯誤

- **換成分後還顯示 45** → `AS` 只命名 → 乘 100 並同步標出單位。
- **多件折抵少算** → 把每件折扣寫成整列折扣 → 用括號讓每件單價先減，再乘件數。
- **搬到 MySQL 找不到欄名** → 同層 `WHERE` 用了新別名 → 改用原算式。
- **明細和訂單總額對不上** → 一筆明細不等於一張單 → 現在先保留訂單號與行號，之後用 [GROUP BY](#/lesson/sq-group-03)折成一張單一列。
