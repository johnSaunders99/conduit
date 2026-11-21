---
id: sq-read-01
module: sq-read
order: 1
title: SELECT 與 FROM
subtitle: 從商品表取出兩欄
status: ready
minutes: 25
level: 1
prereqs: []
objectives:
- 從 shop 的 products 表只取品名與價格，核對 2 欄 8 列
- 對照 SELECT * 與指定欄名，說明交付時哪些欄不該輸出
- 交換 SELECT 欄名，分辨欄序改變與列排序
tags:
- select
- 投影
- 欄位順序
- 星號
resources:
- title: SELECT Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/select
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 SELECT 清單與星號語法，對照輸出欄數。
- title: SQLBolt：第一個 SELECT
  url: https://sqlbolt.com/lesson/select_queries_introduction
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 在另一張商品表練一次只取指定欄位。
concepts:
- id: sq-read-01-source
  prompt: FROM 後面指定什麼？
  answer: 指定讀取哪一張來源表。
  mcq:
    question: 要讀商品，不是讀訂單，哪一段決定來源？
    options:
    - SELECT price
    - 逗號
    - 分號
    - FROM products
    answer: 3
    explain: FROM 決定來源；SELECT 決定交付哪些欄。
- id: sq-read-01-projection
  prompt: SELECT 列表的次序決定什麼？
  answer: 決定輸出的欄位由左到右如何排列，不決定列的順序。
  mcq:
    question: 只交換 SELECT 後的兩個欄名，什麼一定改變？
    options:
    - 結果的左欄
    - 商品數
    - 每件商品的價格
    - 原始表
    answer: 0
    explain: 改的是投影，不是商品數、原值或來源。
- id: sq-read-01-preview
  prompt: 預覽顯示 5 列，能斷定全表有幾列嗎？
  answer: 不能，預覽是有限樣本；查詢結果才反映實際取出的列。
practice:
- id: sq-read-01-p1
  kind: sql
  category: [select]
  title: 品名清單
  minutes: 4
  level: 1
  dataset: shop
  prompt: 每項商品一列。只輸出 product_name 一欄，使用原欄名；不要求列的排序。
  starter: 'SELECT '
  solution: SELECT product_name FROM products;
  explain: 查的是商品本身，不是包含多項商品的訂單。星號會多交欄位。
  hints:
  - 先在表清單找記錄商品的來源。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-01-source
  - sq-read-01-projection
  tags:
  - 選欄
- id: sq-read-01-p2
  kind: sql
  category: [select]
  title: 交給盤點員的兩欄
  minutes: 6
  level: 2
  dataset: shop
  prompt: 輸出所有商品的 product_id、stock，欄名與欄序照此；不要求列的排序。
  starter: 'SELECT '
  solution: SELECT product_id, stock FROM products;
  explain: 兩欄以逗號分開，庫存不是價格；顛倒欄序就改變了交付格式。
  hints:
  - 先寫來源，再照題目的次序列欄名。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-01-source
  - sq-read-01-projection
  tags:
  - 選欄
---

## 語法速查

- 本階段查詢的書寫順序：`SELECT` 選欄 → `FROM` 指來源 → `WHERE` 篩列（可省略）→ `ORDER BY` 排列（可省略）。今天先寫前兩段。這是**書寫順序**，不是說引擎先選欄再讀表。
- `SELECT product_name, price FROM products;` 只出 2 欄，品名在左。
- `SELECT * FROM products;` 選出這張表的所有欄，適合預覽，不是固定的交付欄位。

以上兩個查詢都可在 `shop` 數據集執行。篩選見[下一堂 WHERE](#/lesson/sq-read-02)，列的先後見[ORDER BY](#/lesson/sq-read-03)，需要限制列數時再學 [LIMIT](#/lesson/sq-read-06)。

## 為什麼要學：給店員一張只有兩欄的清單

茶舖的商品目錄同時記了品名、分類、標價和庫存。店員今天只想抄一張價目表。你不必把整份目錄匯出，再用滑鼠逐欄刪除。在瀏覽器裡用 SQL（Structured Query Language，結構化查詢語言）說清楚「從哪張表、看哪些欄」，就能得到一張新的結果。這堂不裝數據庫，也不必先知道終端是什麼。

在本課的動手題找到數據集（dataset）「茶舖訂單」，代號是 shop。把數據表（table，台灣常稱資料表）想成一張有標題的清單。橫向的一列（row）記一件事，直向的一欄（column）記某個屬性。在商品表，一列是一項商品，不是一筆購買；同一個商品可能在許多張訂單中出現，那是另外的表要記的事。先在表清單找 products，展開欄位。面板顯示的欄名和數據類型是結構描述（schema）的一部分。確認找對表後，按「預覽 5 列」。預覽只展示幾列讓你認路，不代表全店只有這幾項商品。


> **同一個「列」在兩地可能指不同方向。** 渠成沿用台灣用法：橫向的一筆是「列」（row，也稱資料列或紀錄），直向的屬性是「欄」（column，也稱欄位）。中國大陸的教材常把 row 稱為「行」或「記錄」，把 column 稱為「列」或「字段」。例如這張價目表有 8 筆商品、2 個屬性：在渠成是 **8 列、2 欄**，用大陸題目的說法是 **8 行、2 列**。看見「列」時，先問是在數幾筆，還是在數幾個欄位。

## 核心概念：第一個能執行的查詢

在下方編輯區輸入這段。這段和本堂所有查詢都使用 shop，不需要檔案。若引擎是第一次啟動，等編輯區可用再按「執行」。

```sql
SELECT product_name, price
FROM products;
```

先看第二行：FROM 指定來源，products 是這份數據裡商品表的名字。再看第一行：SELECT 指定要交付的欄，product_name 是品名，price 是以元為單位的標價。中間那個英文逗號表示還有下一欄，不是要印在結果裡的符號。結尾的英文分號標記這句指令結束。你可以把兩行寫在同一行；分行只是讓人容易看見來源和輸出。

現在你應看到 2 欄、8 列，包括薄荷茶和標價 60。把兩個欄名交換位置再執行。品名與價格仍然配對，但結果改成價格在左。這就是欄位順序：由 SELECT 清單從左到右決定。它和「哪項商品排在第一列」是兩件事；在你還沒指定排序時，不能要求同一項商品永遠先出現。先用列數、欄數和一對已知值核對，而不是靠記住畫面第一列。


## 範例：如果畫面和預期不同

假如你輸入的是 product 而不是 products，看到的會是找不到來源的錯誤，不是一張「賣完了」的空表。回表清單核對英文名稱，不必整段重寫。中文輸入法打出的全形逗號也不是兩欄之間的 SQL 分隔符；切到英文輸入，重打那一個記號即可。執行成功只表示引擎讀懂你的話，不能證明你選的剛好是店員要的欄位。

## 常見錯誤

- **找不到來源表** → 把 `products` 拼成 `product` → 對照數據表面板，改寫成 `FROM products`。
- **結果欄太多** → `SELECT *` 選了每個欄位 → 改成 `SELECT product_name, price`。
- **兩次執行的第一列不同** → 沒有指定列的順序 → 核對全部 8 列；要固定列序時加上 `ORDER BY`。
- **逗號處出現語法錯誤** → 輸入了全形逗號 → 切到英文輸入，重打英文逗號 `,`。

## 小結

有人習慣寫 SELECT * 拿全部欄位。看陌生表時很方便，交價目表卻會多出店員沒有要求的庫存和識別碼。試著不看範例，只看欄位說明，先在紙上用中文講一句「從商品表取出品名和庫存」，再把其中的來源、第一欄、第二欄換成英文名稱。最後按「檢查答案」看看交出去的形狀對不對。今天最有用的收穫不是背住一行字，而是遇到新的數據表時，也知道去哪裡查那三個名字。
