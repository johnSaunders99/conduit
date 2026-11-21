---
id: sq-join-02
module: sq-join
order: 2
title: LEFT JOIN
subtitle: 沒下單的人也要出現
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-01
objectives:
- 保留沒有訂單的會員
- 用右側鍵計出零張單
- 判斷一列 NULL 是沒匹配還是欄值本來缺失
tags:
- left-join
- 外連接
- 補零
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Outer Joins，對照補出的 NULL。
- title: MySQL：JOIN 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/join.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 LEFT JOIN，確認無匹配時的右側欄位。
concepts:
- id: sq-join-02-preserve
  prompt: LEFT JOIN 找不到右列時會怎樣？
  answer: 左列保留一次，右側欄位補 NULL。
  mcq:
    options:
    - 把左側刪掉
    - 右側補數字零
    - 留左側一列，右側補 NULL
    - 左右各留一列
    answer: 2
    explain: 沒有匹配仍要保留左側；NULL 不等於零，也不會另外造一筆右列。
- id: sq-join-02-count
  prompt: 未下單會員的 COUNT(*) 為什麼是 1？
  answer: COUNT(*) 計入左連接補出的那列；COUNT(o.order_id) 才不計右側 NULL。
  mcq:
    options:
    - 它數非空訂單號
    - 它數不同狀態
    - 補出的訂單號是 0
    - 它數補出的整列
    answer: 3
    explain: COUNT(*) 算列，COUNT(欄位) 不算 NULL。
  interview:
    question: 要做含零的會員訂單報表，你會怎麼驗？
    points:
    - 會員名單放左
    - 數非空右鍵
    - 檢查一位零筆及一位多筆
    answer: 我會從會員清單做 LEFT JOIN，按 user_id 分組，數不為 NULL 的訂單鍵。先用 2 號確認是 0，再挑一位有多張訂單的會員和原表對帳。
- id: sq-join-02-missing
  prompt: 可以用城市欄的 NULL 判斷有沒有下單嗎？
  answer: 不行。城市沒填與未找到訂單是兩件事；應檢查匹配列不會缺失的右側訂單鍵。
  mcq:
    options:
    - 應檢查右側訂單鍵
    - 城市為 NULL 就是沒下單
    - 左側 user_id 不為 NULL 就有下單
    - 只要看總列數
    answer: 0
    explain: 原欄位可缺值時無法區分缺值來源；右側訂單鍵在真實訂單列不缺失。
practice:
- kind: sql
  category: [join, missing-values]
  title: 給未下單會員留一列
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    從會員出發連接訂單，保留所有會員與所有訂單配對；未下單會員的訂單號保留 NULL。

    只輸出以下欄位，欄序固定：`user_id`、`order_id`。

    排序：`user_id` 升序，再按 `order_id` 升序。
  solution: |
    SELECT u.user_id, o.order_id
    FROM users AS u LEFT JOIN orders AS o ON u.user_id = o.user_id
    ORDER BY u.user_id, o.order_id;
  explain: |
    LEFT JOIN 保留未下單的 2 號。INNER JOIN 會去掉這列；這裡不能用 0 取代缺失的訂單號。
  hints:
  - 哪張表定義了報表的完整名單？
  - 確認 2 號會員的 order_id。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-02-preserve
  - sq-join-02-missing
  - sq-join-01-match
  tags:
  - left-join
  - 缺值
  id: sq-join-02-p1
- kind: sql
  category: [join, aggregate]
  title: 每位會員的訂單數
  minutes: 8
  level: 2
  dataset: shop
  prompt: |
    包含沒有訂單的所有會員，計算各自的訂單張數 `order_count`；付費與取消單都算。

    只輸出以下欄位，欄序固定：`user_id`、`order_count`。

    排序：`order_count` 由多到少，同數按 `user_id` 升序。
  solution: |
    SELECT u.user_id, COUNT(o.order_id) AS order_count
    FROM users AS u LEFT JOIN orders AS o ON u.user_id = o.user_id
    GROUP BY u.user_id
    ORDER BY order_count DESC, u.user_id;
  explain: |
    右側非空鍵才是一張訂單。COUNT(*) 會把 2 號的補列誤算成一張；不需要用 COALESCE 補 COUNT 的結果。
  hints:
  - 先保留會員，再按會員分組。
  - 數哪個欄位才能跳過補出的 NULL？
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-02-count
  - sq-join-02-preserve
  - sq-join-01-alias
  tags:
  - left-join
  - count
  - 補零
  id: sq-join-02-p2
---

客服要寄一份新會員追蹤名單：有下單的人附上訂單，沒下單的人也得出現在清單。若用上一堂的內連接，完全沒下單的 2 號就會消失，客服甚至看不出名單少了誰。先問「哪一份名單一個都不能少」，再選表的位置。

## 左外連接怎麼留列

左連接（left join）是外連接（outer join，台灣也稱外部聯結）的一種。基本形式是 `FROM users AS u LEFT [OUTER] JOIN orders AS o ON u.user_id = o.user_id`；中括號表示 `OUTER` 可省略，不是 SQL 的字元。機制分兩步：

1. 對左側每一列找右側匹配：找到幾列就配出幾列。
2. 完全沒匹配時也保留左列，右側欄位全部補 `NULL`。不是另建一張訂單，也不是將所有欄位變成零。

## 從兩位會員開始核對

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT u.user_id, o.order_id
FROM users AS u LEFT JOIN orders AS o ON u.user_id = o.user_id
WHERE u.user_id IN (1, 2)
ORDER BY u.user_id, o.order_id;
```

查詢列出了 1 號的 40 張訂單；2 號沒有下單，仍有一列，右欄為 `NULL`。若把圖表縮成一列一位會員，對兩組使用 `COUNT(*)` 會分別得到 40、1，後者把保留用的列當成業務事件。改數 `COUNT(o.order_id)`，同一份輸入就會得到 40、0。這個對照也說明為什麼「結果有一列」與「數到一張單」不矛盾。

選右側辨認是否匹配時，不要隨便找一欄。例如客戶填的城市有可能原本就是 `NULL`，它不能證明訂單不在。優先選確定在真實右列非空的識別欄位；本例使用訂單號。這也讓你在對帳時能明講「沒訂單」和「有訂單但某欄沒填」的差別。

DuckDB、Hive SQL、Spark SQL、MySQL 的 `LEFT JOIN … ON` 都能表達這裡的保留規則。若在 MySQL 或 DuckDB 改用 `USING (user_id)`，同名鍵會合併顯示；要查看兩側鍵與缺值來源，用 `ON` 並點名兩側欄位更清楚。只匹配已付款單、但仍保留所有會員時，條件不能隨意移到 `WHERE`；[〈連接與篩選順序〉](#/lesson/sq-join-08)會把結果差異跑給你看。

## 用三種缺失壓測口徑

準備三種小例：一位下了幾張單、一位從未下單、一位城市沒填但確實下了單。這份數據可用 1、2、6 號，依序核對。6 號的城市雖缺填，原表仍有 4 張單；若你額外顯示城市，這個空白不應影響訂單張數。把所有空白統一換成零或文字「無」之前，先問自己那一欄想表達的是什麼。

本課的訂單張數可以直接數訂單鍵，因為目前只連到一單一列的 `orders`。若再接到品項，一張單可能佔多列；即使都數同一欄，結果也可能比張數大。先查清楚現在的輸入粒度，再選 COUNT 的對象。之後在[〈多對多膨脹〉](#/lesson/sq-join-07)會看到更難找的相同問題，也會學如何在配對前把右側縮到適合的粒度。

縮成一人一列後，可再比一次會員清單的列數，確認沒有漏掉未下單的人。

## 常見錯誤

- 沒下單的人整批不見 → 以會員表放左側，使用 `LEFT JOIN`。
- 零張單的人顯示 1 → 聚合數的是補出的列；改數不為空的右側訂單號。
- 左連接後總列數比會員數大 → 一位會員可對多單；需要一會員一列時才追加分組。
