---
id: sq-join-01
module: sq-join
order: 1
title: INNER JOIN
subtitle: 只配上真的有明細的訂單
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 用表別名連上訂單和品項
- 依訂單鍵與行號核對輸出粒度
- 找出需要排除的取消單
tags:
- join
- 內連接
- 連接鍵
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Inner Joins，確認一列如何匹配多列。
- title: Hive SQL：JOIN
  url: https://hive.apache.org/docs/latest/language/languagemanual-joins/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Join Syntax，辨認 Hive 的內連接語法。
concepts:
- id: sq-join-01-match
  prompt: 內連接留下哪些列？
  answer: 只留下 ON 為真的列對。左側一列可以配上右側多列。
  mcq:
    options:
    - 兩表原始列直接堆疊
    - 每一組滿足 ON 的列對
    - 左表所有列
    - 每個鍵只留一列
    answer: 1
    explain: ON 是配對規則，不是去重。保留全部左列是左連接；堆疊屬於集合運算。
  interview:
    question: 為什麼接完明細後，1001 出現兩次？
    points:
    - 說明一單多行
    - 指出明細粒度
    - 不用 DISTINCT 掩蓋
    answer: 我會先查 1001 在明細表有幾行。這份結果是一列一項，不是一列一單；如果需求是一單一列，我會按 order_id 聚合。
- id: sq-join-01-alias
  prompt: 同名欄位如何指定來源？
  answer: 用表別名加點號，例如 o.order_id，讓來源明確。
  mcq:
    options:
    - 一律改寫成 DISTINCT order_id
    - 依表的大小判定
    - 用 o.order_id 指定來源
    - 依 SELECT 欄位位置判定
    answer: 2
    explain: 兩張表都有 order_id 時，未限定來源可能發生歧義。
- id: sq-join-01-filter
  prompt: 有品項明細就代表訂單已付款嗎？
  answer: 不代表。取消單也有明細；付款口徑要另外以 status 判定。
  mcq:
    options:
    - 有品項就代表付款
    - 以數量大於零判定付款
    - 看訂單號是否連續
    - 還要檢查訂單狀態
    answer: 3
    explain: 連得上只代表鍵有對應，不能回答狀態或付款口徑。
practice:
- kind: sql
  category: [join]
  title: 核對前三張訂單的品項
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    連接 orders 與 order_items，列出訂單號 1001 至 1003（含）所有品項。

    只輸出以下欄位，欄序固定：`order_id`、`line_no`、`product_id`、`qty`。

    排序：`order_id` 升序，再按 `line_no` 升序。
  solution: |
    SELECT o.order_id, i.line_no, i.product_id, i.qty
    FROM orders AS o INNER JOIN order_items AS i ON o.order_id = i.order_id
    WHERE o.order_id BETWEEN 1001 AND 1003
    ORDER BY o.order_id, i.line_no;
  explain: |
    同一訂單可有多行，1001 有 2 行。只用 DISTINCT order_id 會丟掉品項；只按訂單號排序則沒有交代單內順序。
  hints:
  - 兩張表共用的是訂單鍵，不是會員鍵。
  - 加上單內行號固定順序。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-01-match
  - sq-join-01-alias
  - sq-read-03-tie
  tags:
  - join
  - 訂單
  id: sq-join-01-p1
- kind: sql
  category: [join, expression]
  title: 已付款品項的成交金額
  minutes: 8
  level: 2
  dataset: shop
  prompt: |
    連接訂單與明細，只取已付款單；逐項計算成交金額（件數乘成交單價），命名為 `line_amount`。

    只輸出以下欄位，欄序固定：`order_id`、`line_no`、`line_amount`。

    排序：`order_id` 升序，再按 `line_no` 升序。
  solution: |
    SELECT o.order_id, i.line_no, i.qty * i.unit_price AS line_amount
    FROM orders AS o JOIN order_items AS i ON o.order_id = i.order_id
    WHERE o.status = 'paid'
    ORDER BY o.order_id, i.line_no;
  explain: |
    先確認狀態，再用明細成交單價。取消單 1011 也有明細；省略狀態會多列，改用商品標價也不是這題的成交口徑。
  hints:
  - 狀態在 orders。
  - 金額算式中的兩欄都在 order_items。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-01-match
  - sq-join-01-filter
  - sq-read-02-filter
  tags:
  - inner-join
  - 成交金額
  id: sq-join-01-p2
---

營運拿到了一份訂單清單，但看不出 1001 買了什麼。訂單表記付款狀態與日期，品項表記商品與數量。目標不是把兩張表各自排序再並排，而是產生一張能回查訂單號與品項行號的清單。只要兩張表新增列的時機不同，「第幾列」就不再代表同一件事。

## 基本寫法

- `FROM orders AS o`：請訂單表當左側來源，用表別名（table alias）`o` 縮短名稱。
- `INNER JOIN order_items AS i`：以明細表作右側來源；內連接（inner join，台灣也稱內部聯結）只保留符合條件的配對。單寫 `JOIN` 也是內連接。
- `ON o.order_id = i.order_id`：指定連接鍵（join key）。這不是要求兩邊的列位在同一個位置，而是要求兩邊的訂單號相等。
- `SELECT o.order_id, i.line_no`：從配好的列挑欄位。兩側同名欄位加上別名，讀者和引擎才知道你要哪一邊。

## 把兩張單接出來

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT o.order_id, i.line_no, i.product_id
FROM orders AS o INNER JOIN order_items AS i
  ON o.order_id = i.order_id
WHERE o.order_id IN (1001, 1002)
ORDER BY o.order_id, i.line_no;
```

訂單 1001 配出 2 列，對到商品 103、104；1002 配出 3 列。輸出粒度（grain，也就是一列代表什麼）是「一張單中的一行」，所以訂單號重複是預期結果，不是要清除的髒數據。反過來，若某張單沒有明細，該單就沒有任何能留下的配對。這份數據集剛好每張單有明細；想觀察缺失的情形，可以替右側來源只留下某個商品的明細，再看哪些訂單不見了。要保住未匹配的左列，下一堂用[〈LEFT JOIN〉](#/lesson/sq-join-02)處理。

對帳時先畫兩欄：左邊寫訂單號，右邊寫它匹配的明細行號。只核對 1001、1002 就能算出應有 5 列。如果最後只有 2 列，先檢查自己是否只挑訂單號又加了去重；如果超過 5 列，先查連接鍵是否漏條件，或右表同一張單同一行是否有重複紀錄。不要等到金額已經加總才找錯。

同樣的等值內連接可以寫在 Hive SQL、Spark SQL、MySQL。面試若追問 Hive 舊版本能不能在 `ON` 寫較複雜的非等值條件，先確認版本；本課只用共通的等值形式，不把引擎最佳化的差異混進結果定義。

## 先用預覽驗一張單

在數據表面板分別預覽 `orders` 和 `order_items`，先說出一列代表什麼，再挑要投影的欄位。用紙筆寫下 1001 的兩個行號，左邊訂單雖然只有一列，兩個行號都能在同一個訂單號下找到。這就是為什麼結果行號應是 1、2，而不是只出現一個訂單號。

若需求換成商品的可讀名稱，就需要再把明細的 `product_id` 接到商品表的 `product_id`；不是把商品號拿去替換原本的訂單連接鍵。不同的連接回答不同問題，從左至右讀成「找到訂單的項目，再找到該項目的商品」。做完第一題後，應能指出結果的每一欄來自哪一張表，這能幫你接手別人寫的查詢。

## 常見錯誤

- 沒有指定欄來自哪張表，出現欄名歧義 → 寫 `o.order_id` 或 `i.order_id`。
- 品項莫名跟別張單配在一起 → 以兩側的訂單鍵比較，不要把訂單鍵接到商品鍵。
- 報表出現取消單 → 配對成功不代表已付款；另加 `WHERE o.status = 'paid'`。
