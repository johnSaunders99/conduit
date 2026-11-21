---
id: sq-compose-07
module: sq-compose
order: 7
title: INTERSECT 與 EXCEPT
subtitle: 查出誰只出現在其中一份
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-06
objectives:
- 從兩份名單取共同的鍵
- 指定差集的方向
- 辨認集合去重與明細配對的差別
tags:
- intersect
- except
- 差集
- 交集
resources:
- title: DuckDB：集合運算
  url: https://duckdb.org/docs/stable/sql/query_syntax/setops
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 INTERSECT 與 EXCEPT 的 DISTINCT 與 ALL。
- title: MySQL：集合運算
  url: https://dev.mysql.com/doc/refman/8.4/en/set-operations.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 核對 MySQL 的優先順序與版本支援。
concepts:
- id: sq-compose-07-intersect
  prompt: INTERSECT 的輸出來自哪些列？
  answer: 兩個查詢都產生過的相同整列，預設去重。
  mcq:
    options:
    - 左側出現過的所有列
    - 只在右側的列
    - 兩側筆數相加
    - 兩側同時出現的整列，去重
    answer: 3
    explain: 交集要兩側都出現，並且普通寫法不保留重複次數。
- id: sq-compose-07-direction
  prompt: EXCEPT A、B 角色調換時，結果通常一樣嗎？
  answer: 不一樣。A EXCEPT B 只留下在 A、不在 B；交換後改問只在 B。
  mcq:
    options:
    - 通常不一樣，差集有方向
    - 永遠一樣
    - 相同列會變成 NULL
    - 只改順序不改內容
    answer: 0
    explain: 左側定義候選名單，右側是排除名單。
  interview:
    question: 要找 app 有、web 沒有的會員，你會選哪個寫法？
    points:
    - 確定 app 在左
    - 先投影同一會員鍵
    - 說清楚 EXCEPT 預設去重
    answer: 我會讓 app 當左側、web 當右側，兩段都只投影 user_id。EXCEPT 會給不同的會員；若還要保留 app 個別登入，我改做反連接再留原始列。
- id: sq-compose-07-null
  prompt: 兩邊都產生單欄 NULL，預設 INTERSECT 會怎樣？
  answer: 會產生一列 NULL；集合運算的整列重複判定不是 JOIN 的一般等號。
  mcq:
    options:
    - 會把 NULL 轉 0
    - 會產生一列 NULL
    - 不會產生任何列
    - 會產生兩列 NULL
    answer: 1
    explain: 集合運算對應位置的缺值可視為同一列；一般等值連接的 NULL = NULL 則不是為真。
practice:
- kind: sql
  category: [set]
  title: 找出同日兩種渠道都用過的會員
  minutes: 6
  level: 1
  dataset: logins
  prompt: |
    使用 login_at 的日期。找 2026-01-05 同時有 app 和 web 登入的會員，只列不同會員號。

    只輸出以下欄位，欄序固定：`user_id`。

    排序：`user_id` 升序。
  solution: |
    SELECT user_id FROM login_log
    WHERE CAST(login_at AS DATE) = DATE '2026-01-05' AND channel = 'app'
    INTERSECT
    SELECT user_id FROM login_log
    WHERE CAST(login_at AS DATE) = DATE '2026-01-05' AND channel = 'web'
    ORDER BY user_id;
  explain: |
    交集是 1、6。若把渠道也投影出來，app 與 web 那兩份整列就不同，不可能交集。
  hints:
  - 兩側分開選渠道，但只投影會員鍵。
  - 要兩邊都出現，不是併成一份。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-07-intersect
  - sq-compose-06-distinct
  tags:
  - intersect
  - 渠道
  id: sq-compose-07-p1
- kind: sql
  category: [set]
  title: 找出有瀏覽但未付款的會員
  minutes: 8
  level: 2
  dataset: events
  prompt: |
    以會員為單位：至少有一筆 view，而整個數據集都沒有同會員的 pay。只取不同會員號；不限制會話鍵是否為空。

    只輸出以下欄位，欄序固定：`user_id`。

    排序：`user_id` 升序。
  solution: |
    SELECT user_id FROM app_events WHERE step = 'view'
    EXCEPT
    SELECT user_id FROM app_events WHERE step = 'pay'
    ORDER BY user_id;
  explain: |
    只看會員，不是會話；若在同一會話反查，某會員只要有一次未付款會話就可能被誤列。重送紀錄不造成重複結果。
  hints:
  - 先寫候選會員名單，再寫排除名單。
  - 用整個數據集的付款會員做右側。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-07-direction
  - sq-compose-07-intersect
  - sq-join-06-anti
  tags:
  - except
  - 會員差集
  id: sq-compose-07-p2
---

渠道分析先準備兩張只有會員號的名單。現在有兩個問題：「誰兩邊都用過？」和「誰用了 app，卻沒用 web？」兩者成品都是一會員一列，不需要為了比較名單把每次登入配給另一次登入。

## 兩種整列比較

- `查詢 A INTERSECT 查詢 B`：交集（intersection），兩份都有才留下。
- `查詢 A EXCEPT 查詢 B`：差集（set difference），只保留 A 有、B 沒有的列。左右不可隨意交換。
- 普通寫法按整列比較並去重。想比較會員，就只投影會員鍵；若帶出渠道與登入時間，比較的將不再是會員。最後一個 `ORDER BY` 排的是整份結果。

在 SQL 練習場的「自由練習」選 `logins` 數據集，執行：

```sql
SELECT user_id FROM login_log
WHERE CAST(login_at AS DATE) = DATE '2026-01-02' AND channel = 'app'
INTERSECT
SELECT user_id FROM login_log
WHERE CAST(login_at AS DATE) = DATE '2026-01-02' AND channel = 'web'
ORDER BY user_id;
```

1 月 2 日 app 清單有 1、4、9、13、17，web 有 4、9。所以交集應是 4、9。把運算子換成 `EXCEPT`，只剩 1、13、17。如果也把左右兩段交換，會得到空結果；這不是查詢失效，而是右側名單剛好涵蓋換過來的左側。面試時用這五個號碼手算一次，比背「差集有方向」更不容易寫反。

集合運算判斷相同列時可以把對應的 `NULL` 視為相同；用一般 `JOIN … ON a.key = b.key` 並沒有這條規則。若名單以可能缺失的鍵作比較，先確定缺值是該排除的未知對象，還是可比較的共同類別。若要保留所有明細重複，不要把普通 EXCEPT 當成不去重的反連接。

DuckDB、Spark SQL 和 MySQL 8.4 都有這兩種運算；舊 MySQL 在 8.0.31 前沒有 `INTERSECT`／`EXCEPT`。跨版本可用存在或不存在判斷重寫，但要自行處理結果去重及缺值的比較。混用多個集合運算，最好用括號明示先做哪一段，別讓面試官猜你的集合範圍。

## 先把比較的「一列」畫出來

在白紙各畫一欄，第一欄寫由 app 產生的會員號，第二欄寫由 web 產生的會員號。先圈只在左邊的，再圈左右都有的，這兩類合起來就應覆蓋所有 app 會員，且彼此不重疊。這是很便宜的對帳：不用看一串時間戳也能驗證交集與差集沒寫反。若輸出的任一列含有登入時間，先擱下這個檢查，因為你已經把一列的含義改成了具體登入。

第二題換到事件時，也先問是否要比較會員還是會話。同一會員可以在某會話只瀏覽，後來在另一會話付款；只看未付款會話會把這位會員判成沒有付款。若成品只問會員是否曾付款，兩側都只投影會員號，別放會話號或接收碼。選用全期間或限定同一天也要先與需求對齊，這會改變右側排除名單。

進一步的 `INTERSECT ALL` 和 `EXCEPT ALL` 會考慮列重複出現的次數，但本課的名單只需要集合；別因為先前的 UNION ALL 常用就一律選 ALL。

## 常見錯誤

- 只差換順序，結果卻不同 → 差集是由左扣右，先指定候選清單。
- 本來應有交集卻變空 → 確認沒有輸出兩側注定不同的渠道欄。
- 還要保留原始事件卻每人只剩一列 → 這是普通集合運算的去重；改用明細上的反連接。
