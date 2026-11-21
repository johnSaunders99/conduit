---
id: sq-group-01
module: sq-group
order: 1
title: COUNT 與缺值
subtitle: 哪一欄少算了一個人
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 用 COUNT(*) 計總列數、COUNT(city) 計有值列數
- 用兩者相減核對缺值數
- 說明為何 COUNT(col) 不能當作唯一會員數或有效值數
tags:
- count
- 列數
- 非空計數
- 缺值
resources:
- title: Aggregate Functions
  url: https://duckdb.org/docs/stable/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 count(*) 與 count(arg) 的適用對象。
- title: MySQL Aggregate Function Descriptions
  url: https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 對照 MySQL 計列與計非 NULL 的定義。
concepts:
- id: sq-group-01-rows
  prompt: COUNT(*) 與 COUNT(city) 各數什麼？
  answer: 前者數輸入列，後者只數 city 有值的輸入列。
  mcq:
    question: 30 名會員有 5 名沒填城市，兩個計數分別多少？
    options:
    - 30、25
    - 25、30
    - 30、5
    - 25、5
    answer: 0
    explain: COUNT(city) 只看有值；不是數缺值，也不會讓 COUNT(*) 忽略整列。
- id: sq-group-01-nulls
  prompt: 如何計算 city 缺值的列數？
  answer: 用 `COUNT(*) - COUNT(city)`；總列數由有值和缺值兩部分構成。
  mcq:
    question: 哪一個計數會把有值的空字串也算進去？
    options:
    - COUNT(city) 等於只數正確城市，所以不算
    - COUNT(city) 會計所有非 NULL，包括空字串
    - 兩個 COUNT 都會排除空字串
    - 只有 COUNT(*) 能看見有值的空字串
    answer: 1
    explain: COUNT(city) 不做非空字串或地名驗證，只跳過 NULL。
- id: sq-group-01-repeated
  prompt: COUNT(user_id) 相同編號出現四次時貢獻多少？
  answer: 四次都有值就貢獻 4；要數不重複的人需要去重計數。
  interview:
    question: 撈出 30 列但 COUNT(city) 回 25，這是不是少抓了人？
    answer: 不一定。COUNT(*) 是有 30 筆會員列，COUNT(city) 只計 25 筆有城市值；我會用 IS NULL 找到另 5 筆核對，城市值合法與否則是另一道檢查。
    points:
    - 辨認兩種分母
    - 用缺值清單核回而不猜合法性
practice:
- id: sq-group-01-p1
  kind: sql
  category: [aggregate, missing-values]
  title: 核對城市登記完整度
  minutes: 4
  level: 1
  dataset: shop
  prompt: 對 `users` 整表交付一列。按欄序輸出 `total_rows`（會員列數）、`with_city`（城市有值的列數）、`missing_city`（城市為 NULL 的列數）。只有一列，不要求排序。
  starter: 'SELECT '
  solution: |
    SELECT COUNT(*) AS total_rows, COUNT(city) AS with_city,
           COUNT(*) - COUNT(city) AS missing_city
    FROM users;
  explain: '`COUNT(*)` 數 30 列，`COUNT(city)` 數 25 列，差 5。若用 `WHERE city IS NOT NULL`，原總數就會一起變小。'
  hints:
  - 讓兩個計數看到相同輸入列
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-01-rows
  - sq-group-01-nulls
  - sq-read-04-missing
  tags:
  - count
  - 列數
  - 非空計數
- id: sq-group-01-p2
  kind: sql
  category: [missing-values]
  title: 會話缺值核對清單
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 選 `raw_id` 為 31、32、33、34，每列輸出 `raw_id`、`session_id`；不做計數欄。依 `raw_id` 升冪，作為驗算本題正文所述會話缺值數的核對清單。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, session_id
    FROM app_events
    WHERE raw_id IN (31, 32, 33, 34)
    ORDER BY raw_id;
  explain: 肉眼點數可獨立驗證 COUNT：31 有值，32 到 34 缺值。若用 WHERE 排掉缺值，就失去這份驗算依據。
  hints:
  - 核對清單必須留下缺值列
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-01-nulls
  - sq-read-03-order
  - sq-read-08-set
  tags:
  - count
  - 列數
  - 非空計數
- id: sq-group-01-p3
  kind: sql
  category: [aggregate, missing-values]
  title: 付款接收列的會話缺值數
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 只看 `step` 為 `pay` 且 `raw_id` 30 到 37（含）的接收列。輸出一列，依次為 `pay_rows`（付款接收列數）、`with_session`（會話鍵非 NULL 的列數）、`no_session`（會話鍵為 NULL 的列數），不排序。
  starter: 'SELECT '
  solution: |
    SELECT COUNT(*) AS pay_rows, COUNT(session_id) AS with_session,
           COUNT(*) - COUNT(session_id) AS no_session
    FROM app_events
    WHERE step = 'pay' AND raw_id BETWEEN 30 AND 37;
  explain: 34 與 37 都是付款；34 缺會話但仍算進 `pay_rows`。34 以外的付款列 37 才進 `with_session`。
  hints:
  - 先用 WHERE 取付款及編號範圍
  - 不要在 WHERE 檢查會話非空
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-01-rows
  - sq-group-01-nulls
  - sq-group-01-repeated
  - sq-read-07-both
  tags:
  - count
  - 列數
  - 非空計數
---

## 30 筆會員，不是 30 筆已填城市

客服想知道補登工作有多大。先算有多少會員列，再算城市這一欄有多少列有值。把很多列算成一個數字稱為聚合（aggregation，也常稱彙總）。本堂沒有分組，整個篩選後輸入只產生一列摘要，不是為每名會員加計數欄。要交付的是可核回原表的一組總數、有值數與缺值數。

## 語法速查

- `COUNT(*)`：數輸入列，不管這一列哪個欄是 NULL。星號不代表把各欄位加起來。
- `COUNT(city)`：只數該欄有值的列；相同城市出現多次會算多次。
- `COUNT(*) - COUNT(city)`：從同一批輸入的總數扣除有值數，得到缺值列數。空輸入時兩個 COUNT 都是 0。
- `WHERE` 先篩列，計數只看留下來的列。要同時查總數和缺值，不要先把缺值列濾掉。

數據集：`shop`。把三個數並排列出：

```sql
SELECT COUNT(*) AS total_rows, COUNT(city) AS with_city,
       COUNT(*) - COUNT(city) AS missing_city
FROM users;
```

總數 30、有值 25、缺值 5。再回想[缺值判斷](#/lesson/sq-read-04)的清單：包括 6 與 30 共 5 名會員。摘要看不到是誰，但可以拿清單核回計數。這兩種查詢回答不同問題：一份說工作量，另一份讓人知道該處理哪幾筆。抽查不管從哪一份開始，篩選條件要用同一套，否則兩份結果本來就不該相等。

## 計有值，不是驗證，也不是數不同的人

`COUNT(city)` 不會驗證地名。若明天來源收到空字串或打錯字，只要不是 NULL 就會往上計。要驗證城市內容，需另訂允許清單或檢查規則。在事件表同樣，會話鍵有值只表示來源提供一個鍵，不代表它真的能與會話表對上。動手題先把接收列 31 到 34 拉出來，數出 1 個有值、3 個缺值，再把同一種方法用到付款子集。報表上的 2 筆付款接收列也不一定是 2 個不同的人；只有在一列確實代表一個人時，列數才等於人數。之後在[去重計數](#/lesson/sq-group-05)會把唯一會員數與事件列數分開。

**換引擎怎麼說：**Hive SQL、Spark SQL、MySQL 可用相同的 `COUNT(*)` 與 `COUNT(col)`；MySQL 為 InnoDB 無其他條件的 `COUNT(*)` 有專門的執行策略，不能據此假設加了 `WHERE` 或換到 Spark 還能用同一路徑。面試先答誰被算進去，再問引擎要掃哪些數據。

沒有任何列通過篩選時，未分組的計數結果仍是一列，值為 0。它不是「沒回傳結果」，也不能算出有填比例；後者在分母為零時不適用。出表前先核對總數，才能分辨全部沒填和根本沒取到對象。

## 常見錯誤

- **缺值數永遠為 0** → 先濾掉了缺值列 → 讓總數和非空計數看同一批輸入。
- **把非空數當成合法地名數** → COUNT 不做內容驗證 → 另訂有效性條件。
- **把事件數當成會員數** → 同一個人可以有多列 → 確認每列代表什麼，再選唯一鍵去重。

數字看起來順眼不算完成。把 25 加 5 核回 30，再用一筆缺城市會員和一筆有城市會員各檢查一次；這才是能獨立查證的摘要。
