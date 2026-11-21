---
id: sq-lab-01-counter
module: sq-lab
order: 1
title: SQL 查詢與門市報表
subtitle: 一列代表什麼，決定你能怎麼算
status: ready
minutes: 35
level: 2
prereqs: []
objectives:
- 選出需要的欄位
- 區分空值與零
- 用排序讓結果可核對
tags:
- 查詢
- 報表
resources:
- title: DuckDB：SELECT 子句
  url: https://duckdb.org/docs/current/sql/query_syntax/select.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 只讀 SELECT List 與 DISTINCT，看選欄和去重有何不同。
concepts:
- id: order-project
  prompt: 只取出需要的欄位，用哪個子句？
  answer: 用 SELECT 列出欄位，用 FROM 指定來源數據表。
- id: order-sort
  prompt: 同一城市有多筆訂單，怎麼保證顯示順序？
  answer: 用 ORDER BY 排序，遇到同值再用唯一的訂單編號分出先後。
- id: order-count
  prompt: COUNT(*) 和 COUNT(litres) 如何處理空值？
  answer: 前者計算所有列，後者只計算指定欄位非空的列。
  interview:
    question: 沒有讀數就代表水量是零嗎？
    points:
    - 分辨未知與零
    - 說明平均值的分母
    answer: 沒有讀數可能是尚未回報；零表示已經量過。
practice:
- id: sq-lab-01-counter-p1
  kind: sql
  category: [selection]
  title: 訂單編號簿
  level: 1
  minutes: 4
  dataset: shop
  prompt: 列出每筆訂單的 order_id 一欄；順序不限。
  starter: 'SELECT '
  solution: SELECT order_id FROM orders;
  explain: 收銀機一筆交易留下一列。只投影編號，不要用星號把金額也帶出來。
  hints:
  - 從 SELECT 和 FROM 開始。
  check: {}
  concepts:
  - order-project
  tags:
  - 投影
- id: sq-lab-01-counter-audit
  kind: explain
  title: 寫出報表的一列代表什麼
  minutes: 2
  steps:
  - 對照原始訂單與門市報表，各寫下一列代表的事物。
  checks:
  - 能分辨一筆交易與一個門市。
- id: sq-lab-01-counter-p2
  kind: sql
  category: [ordering, selection]
  title: 找出最高金額
  level: 1
  minutes: 4
  dataset: shop
  prompt: 列出 order_id、amount，依金額由高到低，同額依編號由小到大。
  starter: 'SELECT '
  solution: SELECT order_id, amount FROM orders ORDER BY amount DESC, order_id;
  explain: 先看金額，再看訂單編號。DESC 只作用在它前面的排序欄位。
  hints:
  - 第二個排序欄位可以處理同額。
  check:
    ordered: true
  concepts:
  - order-project
  - order-sort
  tags:
  - 排序
- id: sq-lab-01-counter-p3
  kind: sql
  category: [aggregation]
  title: 門市訂單數
  level: 2
  minutes: 5
  dataset: shop
  prompt: 每個城市輸出 city 與訂單數 orders_count；欄名須相同，順序不限。
  starter: 'SELECT '
  solution: SELECT city, COUNT(*) AS orders_count FROM orders GROUP BY city;
  explain: GROUP BY 決定每列代表哪個城市；AS 替計數欄取名。
  hints:
  - 先決定每一組代表什麼。
  check:
    columnNames: true
  concepts:
  - order-project
  - order-count
  tags:
  - 聚合
- id: sq-lab-01-counter-p4
  kind: sql
  category: [aggregation, nulls]
  title: 平均水量
  level: 2
  minutes: 5
  dataset: meters
  prompt: 所有已回報讀數的平均值，輸出一欄 mean_litres，不必四捨五入。
  starter: 'SELECT '
  solution: SELECT AVG(litres) AS mean_litres FROM readings;
  explain: AVG 只把非空讀數算進分子與分母；未回報不是零。
  hints:
  - 想想 AVG 會不會計入 NULL。
  check:
    tolerance: 1.0e-05
  concepts:
  - order-count
  tags:
  - 空值
- id: sq-lab-01-counter-p5
  kind: sql
  category: [data-changes]
  title: 補登測站讀數
  level: 3
  minutes: 6
  dataset: meters
  prompt: 將 B 站尚未回報的 litres 補為 9；保留其他紀錄。檢查會讀取 station、day、litres，比對整張表。
  starter: 'UPDATE readings

    SET '
  solution: UPDATE readings SET litres = 9 WHERE station = 'B' AND litres IS NULL;
  explain: WHERE 必須同時限定測站與缺值；拿掉任一條件，都可能動到別的紀錄。
  hints:
  - 用 IS NULL 判斷缺值。
  check:
    mode: state
    query: SELECT station, day, litres FROM readings;
  concepts:
  - order-project
  tags:
  - 更新
- id: sq-lab-01-counter-p6
  kind: sql
  category: [deduplication, nulls]
  title: 哪些日期有回報
  level: 3
  minutes: 6
  dataset: meters
  prompt: 輸出有讀數的日期 day，每天只顯示一次，依日期由早到晚。
  starter: 'SELECT '
  solution: SELECT DISTINCT day FROM readings WHERE litres IS NOT NULL ORDER BY day;
  explain: 先排除未回報，再取不同日期。DISTINCT 不保證順序，仍要寫 ORDER BY。
  hints:
  - 同一天可能有兩個測站。
  check:
    ordered: true
  concepts:
  - order-sort
  - order-count
  tags:
  - 去重
---
## 一列代表什麼？

打開小店訂單（shop）的數據表（table，台灣也稱資料表）。先別急著加總，試著回答：「一列是一位客人、一次交易，還是一種商品？」同一個城市出現好幾次，不是重複輸入，而是那裡有好幾張訂單。訂單編號才是辨認每筆交易的線索。對店長來說，5 張訂單和 2 個門市是兩種數字；若不先問清楚，就算程式執行成功，也可能回答錯問題。

### 先把問題縮小

店長要核對編號，不需要看價格。查詢（query）的第一行告訴數據庫你要哪些欄位，第二行告訴它去找哪張表。在下方第一題寫這兩行，按「執行」看結果。你可以對照表結構，不必靠記憶猜名字。

```sql
SELECT order_id
FROM orders;
```

執行不等於交卷。把欄位換成城市再執行，看一看結果：為什麼有 5 列，卻只有兩個不同的城市？一個欄位可以有重複的值，挑出欄位並不會把重複列刪掉。只有問題要求「不同的」時，才考慮去重（deduplication，SQL 用 DISTINCT）。如果把金額相同的兩筆交易去重，月底結帳就會少算。

## 從明細換成報表

在 shop 數據集試下面這段。分組（grouping）像在桌上放兩個盒子，把城市相同的訂單放進同一盒。聚合（aggregation，台灣也稱彙總）才是清點每盒有幾筆；沒有分組時，所有訂單會被當成同一組。AS 給計數欄一個清楚的名稱，讓讀者知道它不是金額。

```sql
SELECT city, COUNT(*) AS orders_count
FROM orders
GROUP BY city;
```

這張報表應該只剩 2 列：Taipei 有 3 筆，Tainan 有 2 筆。把兩個計數加起來，仍是明細的 5 筆。如果你看到 5 列，先檢查是否不小心把訂單編號也放進了分組條件。每個編號都不同，多加一欄就改變了報表中一列的意思。最後再決定要不要排序，不要把列的先後誤認為計數出錯。

## 計算之前，先看分母

換到水量讀數（meters）。預覽裡有一個空值（NULL），意思是測站尚未回報，不是水量等於零。要算實際回報的平均水量，必須用回報的筆數當分母；若你先把缺值換成零，就等於替測站填了一筆未經觀察的數字。相反地，若你要算「預期收到幾筆」，缺值那列仍然要計入。寫下問題再選函式，比背兩個名稱更可靠。

### 順序也是約定

店長說「先看最大的一筆」時，就不能只挑出金額。數據表不是有固定行號的試算表，即使兩次執行碰巧一樣，也不代表順序有保證。排序（ORDER BY）讓結果有明確的先後。遇到同額，用編號當第二個比較條件，兩人就能依同一條規則核對報表。反過來說，若只要清單且沒指定先後，不必為了讓畫面看起來一樣而排序。

> [!TIP] 檢查前先猜結果的形狀：它應該有幾欄？一列代表什麼？順序重要嗎？把預期說清楚，才能分辨是語法錯，還是問錯了問題。

## 留下核對線索

遇到不通過時，先讀回饋再決定下一步。欄數不對先看投影，列數不對先看篩選與分組，順序不對再看排序條件。一次只調整一處，保留改動前後的結果。最後一組題目會讓你補登讀數；先寫出能選中目標列的條件，確認只找到需要更新的那一列，再把它用在更新指令裡。
