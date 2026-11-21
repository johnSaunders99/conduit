---
id: sq-compose-01
module: sq-compose
order: 1
title: 標量子查詢
subtitle: 找出超過全店均價的品項
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 用括號查詢求單一門檻
- 寫出超過全店均價的商品查詢
- 判斷子查詢零列或多列時的行為
tags:
- scalar-subquery
- avg
- 門檻
resources:
- title: DuckDB：子查詢
  url: https://duckdb.org/docs/stable/sql/expressions/subqueries
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Scalar Subquery，核對單值與多列。
- title: MySQL：子查詢錯誤
  url: https://dev.mysql.com/doc/refman/8.4/en/subquery-errors.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 子查詢超過一列時的錯誤。
concepts:
- id: sq-compose-01-scalar
  prompt: 什麼情況能把括號查詢當作一個比較值？
  answer: 標量子查詢只能有一欄，結果最多一列；零列時取 NULL。
  mcq:
    options:
    - 只要用了括號即可
    - 一欄且最多一列
    - 一列且任意欄數
    - 任意列但最多一欄
    answer: 1
    explain: 大於比較需要一個值，不是任意大小的表；零列視為缺值。
- id: sq-compose-01-threshold
  prompt: 為何全店 AVG(price) 不需要 GROUP BY？
  answer: 目標是全表一個平均值。無分組的聚合只回一列；按分類分組會有多列。
  mcq:
    options:
    - AVG 自動挑最大一組
    - 分組只影響畫面排序
    - 門檻是全表一個值
    - 所有 AVG 都不能分組
    answer: 2
    explain: 先知道分母是哪些商品，再決定要不要分組。
- id: sq-compose-01-empty
  prompt: 用 price > 空結果的標量子查詢，哪些列會通過？
  answer: 沒有。內層沒有列會變成 NULL，大於比較得到未知。
  mcq:
    options:
    - 所有有價格的列
    - 最高價的一列
    - 等同 price > 0
    - 沒有列會通過
    answer: 3
    explain: 缺門檻不等於零；WHERE 只保留真。
  interview:
    question: 子查詢多列報錯，你會先用 LIMIT 1 嗎？
    points:
    - 先確認業務單值定義
    - 不任選任一列
    - 讓零列情形可解釋
    answer: 不會直接加。我要先確認需求是最大值、整體平均，還是應該只有一筆的設定；確定後才選聚合或檢查唯一鍵。無數據時也會確認業務要顯示什麼。
practice:
- kind: sql
  category: [cte, aggregate]
  title: 找出超過全店均價的商品
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    以所有 products 的 price 平均（所有商品同權）作門檻，找出標價嚴格大於門檻的商品。

    只輸出以下欄位，欄序固定：`product_id`、`price`。

    排序：`price` 由高到低，同價按 `product_id` 升序。
  solution: |
    SELECT product_id, price FROM products
    WHERE price > (SELECT AVG(price) FROM products)
    ORDER BY price DESC, product_id;
  explain: |
    全店平均是 88.75 元，符合 106、108、104。用 MAX 會找不到嚴格大於的商品；分組取平均則不是整店的比較基準。
  hints:
  - 先單獨執行內層 AVG。
  - 外層用嚴格大於，不是大於等於。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-01-scalar
  - sq-compose-01-threshold
  - sq-read-02-edge
  tags:
  - scalar-subquery
  - avg
  id: sq-compose-01-p1
- kind: sql
  category: [cte]
  title: 退款額高於 1 月平均的紀錄
  minutes: 8
  level: 2
  dataset: shop
  prompt: |
    門檻是 2026 年 1 月所有退款紀錄的平均金額（每筆退款同權）；列出不限日期、金額嚴格大於門檻的退款，保留每筆退款。

    只輸出以下欄位，欄序固定：`refund_id`、`order_id`、`amount`。

    排序：`amount` 由高到低，同額按 `refund_id` 升序。
  solution: |
    SELECT refund_id, order_id, amount
    FROM refunds
    WHERE amount > (
      SELECT AVG(amount) FROM refunds
      WHERE refund_date >= DATE '2026-01-01' AND refund_date < DATE '2026-02-01'
    )
    ORDER BY amount DESC, refund_id;
  explain: |
    日期範圍只限制用來求門檻的紀錄。若外層也限 1 月，就會漏掉高於門檻的後續退款；若先按訂單分組，則改成了每單口徑。
  hints:
  - 內層和外層各自讀 refunds，但職責不同。
  - 一月區間包含月初、排除二月初。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-01-scalar
  - sq-compose-01-threshold
  - sq-join-01-filter
  tags:
  - scalar-subquery
  - 日期門檻
  id: sq-compose-01-p2
---

店長不想每週把平均價格複製到另一段 SQL。只要商品改價，手填的門檻就可能過期。這堂讓同一份查詢先算出基準，再用它篩商品；報表只需執行一次，門檻與明細來自同一次查詢。

## 把括號當成一個值

子查詢（subquery）是放在另一段查詢裡的查詢。當它要佔據一個值的位置，稱為標量子查詢（scalar subquery，台灣也稱純量子查詢）。基本形式是 `WHERE 外層欄位 > (SELECT 一個值 FROM 來源)`；也可把括號查詢放在 `SELECT` 裡加上欄名，先顯示這個值，便於核對。內層要有一欄、至多一列。

- 一列一欄：用該值比較。
- 零列：當成 `NULL`，不是數字 0。輸入列為零時，無分組的 `AVG` 也會產生一欄一列，但平均值是 `NULL`。
- 多列：DuckDB 的預設會報錯，因為無法選出唯一的值。這種錯誤是在保護口徑，不要靠任取一筆壓掉。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT product_id, product_name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC, product_id;
```

單獨跑內層的 `AVG(price)`，可先核對 8 個標價合計 710 元、平均 88.75 元。再跑整句，應看到 106、108、104 三件商品，按價格由高到低。全店平均是「每件商品同權」；若先以庫存加權，或只拿器皿的商品，就已經不是原需求。先跑內層還有一個好處：門檻變成 `NULL` 時，可以回頭確認是沒有輸入，還是輸入價格都缺失，而不是直接懷疑外層篩選。

MySQL 8.4 也拒絕拿多列結果當單一值；跨引擎不要靠寬鬆設定任意選一列。本例內層不引用外層欄位，所以每件商品的參照門檻一樣；下一堂[〈相關子查詢〉](#/lesson/sq-compose-02)才會把門檻改成依外層的分類而變。

## 先核對門檻，再核對邊界

執行商品查詢之前，可先寫下兩個預測：90 元應入選，60 元應落選。若竟然 60 元也入選，不要只看結果排序；先查內層到底用了哪些商品。若業務改成「含均價」，只應改外層的比較邊界，不必改內層。用一個接近門檻的商品和一個明顯低於門檻的商品各查一次，就能分辨「比較符號錯」和「取錯了門檻」。

同一個技巧還能用來對帳退款。第二題裡，一月平均可先用退款日期範圍單獨求出；接著回到所有退款找超標紀錄。內層是樣本期，外層是交付對象，兩個範圍故意不同。當使用者說「以一月份數字為標準」，不要不加思索就只回傳一月紀錄。將樣本期寫成明確的起訖，跨二月時記得月初不再屬於一月。

報表若空了，也不要把零列當成「證明一切正常」。一種可能是沒有任何品項超標，另一種是用來求門檻的數據根本沒到；先跑小查詢驗門檻才知道是哪種。

## 常見錯誤

- 整句報「多列」 → 先單獨跑括號；若要全店平均，不加按分類的 GROUP BY。
- 結果少了後續月份的紀錄 → 分清比較對象與門檻樣本，時間條件不一定兩處都要寫。
- 查不到商品卻以為平均是 0 → 檢查門檻是否為 NULL，別替空值自行定義數字。
