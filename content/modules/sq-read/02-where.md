---
id: sq-read-02
module: sq-read
order: 2
title: WHERE 與比較
subtitle: 只找庫存不足的商品
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-01
objectives:
- 寫出含 <= 和 <> 的 WHERE 條件，在 5 件庫存的邊界驗證
- 查出只含茶飲的品名，不額外輸出用來篩選的欄位
- 把少於與不超過改寫為比較符號，核對 3 列與 5 列
tags:
- where
- 比較運算子
- 篩選
- 邊界值
resources:
- title: WHERE Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/where
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 WHERE 對每列判斷的說明，再測 5 件庫存。
- title: DuckDB：比較運算子
  url: https://duckdb.org/docs/stable/sql/expressions/comparison_operators
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 7 個比較符號與缺值時的比較結果。
concepts:
- id: sq-read-02-filter
  prompt: WHERE 的條件會改動商品表嗎？
  answer: 不會；在 SELECT 查詢中，它只選擇本次應傳回的列。
  mcq:
    question: 只想讓缺貨商品出現在清單，要改哪裡？
    options:
    - 表名改成缺貨
    - 在 WHERE 寫判斷
    - 少抄一欄
    - 加分號
    answer: 1
    explain: 列是否保留由條件決定，不是由欄數決定。
- id: sq-read-02-edge
  prompt: stock < 5 和 stock <= 5 在哪個值不同？
  answer: 剛好 5 件；前者排除，後者保留。
  mcq:
    question: 只驗一個值來區分這兩個條件，該選？
    options:
    - '0'
    - '4'
    - '5'
    - '6'
    answer: 2
    explain: 其餘三個值在兩種寫法下的結果都相同。
- id: sq-read-02-literal
  prompt: 為什麼茶飲分類要加英文單引號？
  answer: 它是要比較的文字值，不是欄位名稱。
practice:
- id: sq-read-02-p1
  kind: sql
  category: [select]
  title: 只找缺貨
  minutes: 4
  level: 1
  dataset: shop
  prompt: 找出庫存等於 0 的商品。輸出 product_name、stock，保留原欄名；列不排序。
  starter: 'SELECT '
  solution: SELECT product_name, stock FROM products WHERE stock = 0;
  explain: 條件檢查的是件數；庫存很少但不等於零的商品不該入選。
  hints:
  - 先分清缺貨與低庫存。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-02-filter
  tags:
  - 篩選
- id: sq-read-02-p2
  kind: sql
  category: [select]
  title: 補貨門檻含五件
  minutes: 6
  level: 2
  dataset: shop
  prompt: 找出庫存不超過 5 件的商品。依次輸出 product_id、stock，欄名照原名；列不排序。
  starter: 'SELECT '
  solution: SELECT product_id, stock FROM products WHERE stock <= 5;
  explain: 「不超過」包含剛好 5。若只用小於，會漏掉濾網與茶匙。
  hints:
  - 想一想剛好 5 件要不要保留。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-02-filter
  - sq-read-02-edge
  tags:
  - 篩選
- id: sq-read-02-p3
  kind: sql
  category: [select]
  title: 包裝品清單
  minutes: 6
  level: 2
  dataset: shop
  prompt: 只取 category 是「包裝」的商品，輸出 product_name 一欄，保留原欄名；不要求列的排序。
  starter: 'SELECT '
  solution: SELECT product_name FROM products WHERE category = '包裝';
  explain: 篩選欄不必出現在輸出。包裝是文字值，不能當成另一個欄名。
  hints:
  - 文字值用英文單引號包住。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-02-literal
  - sq-read-02-filter
  tags:
  - 篩選
---

## 語法速查

把下列條件接在 `SELECT product_name, stock FROM products WHERE` 後面（數據集：`shop`）。

| 符號 | 意思 | 條件例子 |
|---|---|---|
| `=` | 等於 | `stock = 5` |
| `<>` | 不等於（標準寫法） | `stock <> 5` |
| `!=` | 不等於（DuckDB 也接受） | `stock != 5` |
| `<` | 小於 | `stock < 5` |
| `<=` | 小於或等於 | `stock <= 5` |
| `>` | 大於 | `stock > 5` |
| `>=` | 大於或等於 | `stock >= 5` |

`WHERE` 只保留條件為真的列。本堂先寫一個比較；後續分別學 [NULL 與缺值](#/lesson/sq-read-04)、[AND／OR](#/lesson/sq-read-07)、[IN／BETWEEN](#/lesson/sq-read-08) 和 [LIKE](#/lesson/sq-read-09)。

## 為什麼要學：哪些商品今天要補貨？

店員在價目表旁加了一句：「只給我看庫存少於 5 件的。」上一堂的 SELECT 選的是欄，不能決定哪項商品要留下。用篩選條件（filter）逐列比對庫存。符合才留下。先把規則讀成完整中文。少於 5，不是 5 件以下；店裡真的有庫存正好是 5 的商品，所以一個小符號會改變採購單。

在 shop 數據集找到商品表 products。stock 是庫存件數，price 是標價，兩個欄位都是數字，卻有不同單位。假如你不小心用標價和 5 比較，引擎不會替店員發現你把元和件弄混了。先問清楚要比較的量，再按「執行」。

```sql
SELECT product_name, stock
FROM products
WHERE stock < 5;
```

WHERE 後面是一句對一列問的問題：「這個庫存比 5 小嗎？」烏龍茶有 3 件，答案是，所以留下。小杯有 0 件，也留下；沒庫存正是店員最想知道的情況。濾網有 5 件，答案不是，所以不會出現在這份結果裡。你不用在數據表裡實際刪除任何商品。把最後一行拿掉再執行，原來的商品仍然都在。


## 核心概念：用三個值測一條界線

拿張紙，左邊寫 4、5、6，右邊分成「少於」和「不超過」兩欄。先自己打勾，再把查詢裡的小於號改成小於等於號。第一個條件只在 4 的位置打勾；第二個還會在 5 的位置打勾。回到茶舖，庫存恰好是 5 的不只一項。把小於改成小於等於，結果會從 3 列變 5 列：新增的正是庫存 5 件的兩項。先看新增的是誰，再決定這個變化是否符合需求。

條件也可以拿來比較文字。最後一個小任務要找某個分類，不是比較分類的高低。商品表把茶記作「茶飲」，不是「茶」。下面的等號表示相同，英文單引號包住的是一段要比對的文字。它跟 FROM 後面直接寫的表名不一樣。

```sql
SELECT product_name
FROM products
WHERE category = '茶飲';
```


## 範例：看得見的欄，不必是用來篩的欄

第二段結果只有品名，沒有分類，但條件仍然成立。想像店員先拿分類標籤挑出茶飲，再在另一張紙上只抄品名。這解釋了為什麼「用來做判斷」與「最後要展示」應分開思考。反過來，把 stock 寫進 SELECT 卻沒有 WHERE，只會多顯示庫存，不會自動得到缺貨名單。

最容易漏掉的檢查不是文法，而是門檻的含義。若店員其實想把剩 5 件的一起列入，先把需求改寫成「庫存不超過 5 件」，再選符號，而不是看哪一種輸出比較順眼。交付前用一句話講出哪項商品故意沒有出現、為什麼沒有；能用濾網這個實物舉例，比背一串比較運算符更能證明結果就是對方要的。


## 常見錯誤

- **庫存 5 件不在清單** → 把「不超過」寫成 `<` → 改用 `WHERE stock <= 5`，再確認多出哪兩項。
- **查茶飲時說找不到欄位** → 把茶飲當成欄名 → 改成 `WHERE category = '茶飲'`，文字加單引號。
- **看到了所有商品** → 只用 `SELECT` 改輸出欄，沒寫條件 → 補 `WHERE stock < 5`，確認只剩 3 列。

## 小結

遇到零列時，先保留原來的輸出欄，暫時撤掉條件確認來源確實有商品，再單獨加回比較。這樣可以分清全店沒有這類商品，還是自己把單位、分類名稱或門檻寫錯了。
