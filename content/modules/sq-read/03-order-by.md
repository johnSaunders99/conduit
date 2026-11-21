---
id: sq-read-03
module: sq-read
order: 3
title: ORDER BY 與排序
subtitle: 同價商品誰排在前面
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-02
objectives:
- 寫出一個降冪鍵與一個升冪鍵，核對兩杯同價茶的次序
- 用唯一商品編號把平手變成可逐列比對的結果
- 指定 NULLS FIRST 或 NULLS LAST，核對未填城市的人排在哪端
tags:
- order by
- 升冪
- 降冪
- 平手鍵
- nulls last
resources:
- title: ORDER BY Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/orderby
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀排序方向、平手鍵與 NULLS FIRST／LAST。
concepts:
- id: sq-read-03-direction
  prompt: 昂貴商品排前面要指定什麼方向？
  answer: 用 price DESC，因為要從大到小。
  mcq:
    question: ORDER BY 後寫哪個排序規則，能把最貴的商品排在最前？
    options:
    - price ASC
    - product_id ASC
    - stock DESC
    - price DESC
    answer: 3
    explain: 排序鍵要選價格，方向要由大到小。
- id: sq-read-03-tie
  prompt: 第一個排序鍵相同時，第二個鍵做什麼？
  answer: 只在第一個鍵平手時決定先後。
  mcq:
    question: 同為 45 元，按 price ASC、product_id ASC，誰先？
    options:
    - 編號 103
    - 編號 107
    - 庫存較多者
    - 無法排列
    answer: 0
    explain: 同價才比較第二個鍵，103 小於 107。
- id: sq-read-03-order
  prompt: 查詢不寫 ORDER BY，能要求哪一列每次都排第一嗎？
  answer: 不能；輸出看起來穩定不等於有排序保證。
practice:
- id: sq-read-03-p1
  kind: sql
  category: [sort]
  title: 按庫存排盤點順序
  minutes: 4
  level: 1
  dataset: shop
  prompt: 所有商品輸出 product_id、stock，欄名照原名。按庫存升冪，再按商品編號升冪。
  starter: 'SELECT '
  solution: SELECT product_id, stock FROM products ORDER BY stock ASC, product_id ASC;
  explain: 低庫存先看；庫存相同還需用唯一編號固定次序。只按編號會混入較高庫存。
  hints:
  - 先列出第一個排序鍵，再指定平手規則。
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-03-direction
  - sq-read-03-tie
  tags:
  - 排序
- id: sq-read-03-p2
  kind: sql
  category: [sort]
  title: 貴價商品先展示
  minutes: 6
  level: 2
  dataset: shop
  prompt: 所有商品輸出 product_name、price、product_id，欄名照原名。先按價格降冪，同價按商品編號升冪。
  starter: 'SELECT '
  solution: SELECT product_name, price, product_id FROM products ORDER BY price DESC, product_id ASC;
  explain: 兩個鍵的方向各自指定；都用降冪會把兩杯同價茶的次序倒過來。
  hints:
  - 價高先排不是兩個鍵都倒序。
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-03-direction
  - sq-read-03-tie
  - sq-read-03-order
  tags:
  - 排序
---

## 語法速查

- `ORDER BY price ASC`：價格升冪。只寫 `ORDER BY price`，DuckDB 的出廠預設方向是 ASC。
- `ORDER BY price DESC`：價格降冪。加 `, product_id ASC` 可讓同價商品的編號從小到大。
- `ORDER BY city ASC NULLS FIRST`：缺城市的列在前。改成 `NULLS LAST` 就排在後。指定位置與排序方向是兩件事。
- 本課 DuckDB 工作區預設缺值在後，其他數據庫或設定可能不同；交付時請明寫。本堂只排缺值的位置，[下一堂](#/lesson/sq-read-04)才篩缺值；[LIMIT](#/lesson/sq-read-06)再教排序後取前幾列。

## 為什麼要學：同價商品，誰在前？

兩位店員拿到相同的商品清單，都照標價由低到高抄在看板上。第一位把小杯放第一，第二位把茶匙放第一。兩份都沒抄錯價，卻沒辦法逐行核對。問題不是誰算錯，而是指令只說了價格，沒有說明平手怎麼排。今天我們要交一張不同人重做，仍能逐行互相比對的價目表。

排序（sorting）是決定列出現的先後，不是把儲存中的商品重新編號。SQL 用 ORDER BY 指定排序鍵（sort key），也就是比較兩列時先看哪個欄位。在 shop 數據集使用 products 表，按「執行」看看這份清單：

```sql
SELECT product_id, product_name, price
FROM products
ORDER BY price ASC, product_id ASC;
```

ASC 是升冪（ascending），數字從小到大；DESC 是降冪（descending），從大到小。預設是升冪，但第一次寫出 ASC 有助於把想法講清楚。上面有兩份看起來很像的清單，別混在一起：SELECT 後面決定畫面左到右顯示三欄；ORDER BY 後面決定拿哪個值逐層比較。一份報表完全可以把編號顯示在左欄，仍然先按右欄價格排序。


## 核心概念：用四項商品手排一次

先手排四項：小杯 45 元，編號 103；茶匙也是 45 元，編號 107；薄荷茶 60 元，編號 101；烏龍茶也是 60 元，編號 102。第一關只比價格，所以兩件 45 元的都在兩杯茶之前。同價才進第二關，比的是商品編號，103 在 107 之前，101 在 102 之前。若交換 ORDER BY 裡兩個欄名，就變成先比編號。因為每個編號在這張表只出現一次，價格根本沒有機會決定先後。

現在假設門市想把昂貴的商品排在最上面，卻仍希望同價商品按編號從小到大。只把 price 後面的方向改成 DESC，第二個鍵仍然寫 ASC。每個方向只管自己前面的欄位，不是寫一次就把整張清單統統反過來。茶壺標價 240，應該最先出現；兩杯 60 元的茶仍是編號 101 先於 102。同時核對第一名與平手順序；只看第一列看不出第二個鍵有沒有寫對。


## 範例：說清楚什麼叫做一樣

如果題目只要看有哪些品名，沒有要求列的先後，兩份列順序不同的結果可能同樣正確。若題目明說要按價格和編號排列，行次就是交付內容的一部分。你可以先故意省略第二個鍵，看看同價商品這一次如何出現；就算恰好符合預期，也不能說每次都保證如此。引擎沒有收到平手規則，換一批輸入或換一個執行方式時，可以合法地給你另一個次序。

想驗證缺值的位置，在 `shop` 數據集執行：

```sql
SELECT user_id, city
FROM users
ORDER BY city ASC NULLS FIRST, user_id ASC;
```

前 5 列是沒填城市的人，會員編號按升冪排列。把 FIRST 改成 LAST，這 5 列就會排到最後；名單和總列數不變。別把「排在最後」理解成刪掉缺值。

## 常見錯誤

- **便宜的先出現** → 用了預設升冪 → 要把高價排前，改成 `ORDER BY price DESC`。
- **兩個同價品項互換** → 第一個鍵分不出兩列 → 加唯一的第二鍵：`ORDER BY price DESC, product_id ASC`。
- **缺城市的人排到另一端** → 沒寫缺值規則或沿用別種引擎的預設 → 明寫 `ORDER BY city ASC NULLS LAST, user_id ASC`。

## 小結

收工前把價格欄暫時換成庫存，在紙上寫一句新的交付條件：「先看最要補貨的商品，同樣庫存時讓編號比較小的排前面。」先別複製剛才的指令，對照那句中文找出第一個鍵、方向、第二個鍵、方向。執行以後檢查庫存為零的是誰，再找一組同為 5 件的商品，看它們有沒有依照約定站好。這兩次核對分別照顧到一般情況與平手，比把整張畫面背下來有用。
