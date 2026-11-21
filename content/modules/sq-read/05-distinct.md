---
id: sq-read-05
module: sq-read
order: 5
title: DISTINCT 去重
subtitle: 城市重複出現要留幾次
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-04
objectives:
- 列出會員表中已登記的各個城市，並排除缺值
- 用事件重送的例子判斷哪些輸出欄應參與去重
- 區分去掉重複結果與修改原表
tags:
- distinct
- 去重
- 欄位組合
- 事件重送
resources:
- title: SELECT Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/select
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 DISTINCT 段落，對照一欄與整列去重。
concepts:
- id: sq-read-05-tuple
  prompt: DISTINCT 看哪幾欄來決定重複？
  answer: 看 SELECT 選出的整組值；任一欄不同就是不同結果列。
  mcq:
    question: 要每種城市只列一次，哪個寫法直接符合？
    options:
    - SELECT DISTINCT user_id, city
    - SELECT DISTINCT city
    - SELECT city ORDER BY city
    - SELECT DISTINCT *
    answer: 1
    explain: 編號或其他欄位可能不同；排序則只調順序。
- id: sq-read-05-missing
  prompt: DISTINCT 會不會自動排除 NULL？
  answer: 不會；只選一欄時，多筆缺值折成一個 NULL。
  mcq:
    question: 只選 city 去重，5 筆缺值最後貢獻幾列？
    options:
    - 1 列
    - 0 列
    - 5 列
    - 跟已填城市數相同
    answer: 0
    explain: 去重會合併重複缺值；排除缺值要另寫 WHERE。
- id: sq-read-05-key
  prompt: 重送事件的 event_id 一樣，為何不應選 raw_id 一起做去重？
  answer: raw_id 記接收列，重送時不同；一併輸出就留下兩列。
  interview:
    question: 接收表重送事件時，SELECT DISTINCT * 能不能去重？
    answer: 我會先問要去掉接收列還是業務事件。這裡重送沿用 event_id，但 raw_id 不同；如果只要事件鍵，選 event_id 去重就好。如果還要保留某次接收的時間，先定保留哪一筆，不能只加 DISTINCT。
    points:
    - 指出接收鍵與事件鍵的差別
    - 先指定輸出粒度，再選去重欄位
practice:
- id: sq-read-05-p1
  kind: sql
  category: [distinct]
  title: 已填城市選單
  minutes: 4
  level: 1
  dataset: shop
  prompt: 在 `users` 找已登記的不同城市。只輸出 `city`，欄名照原名；依 `city` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT DISTINCT city
    FROM users
    WHERE city IS NOT NULL
    ORDER BY city;
  explain: 先排除未知城市，再對輸出那一欄去重。只排序不會把相同城市折成一列。
  hints:
  - WHERE 可先排除缺值
  - 投影只留一欄
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-05-tuple
  - sq-read-05-missing
  - sq-read-04-known
  tags:
  - distinct
  - 去重
  - 欄位組合
- id: sq-read-05-p2
  kind: sql
  category: [distinct]
  title: 重送事件核對表
  minutes: 6
  level: 2
  dataset: events
  prompt: 在 `app_events` 找 `raw_id` 25 到 29（含）涵蓋的不同事件。輸出 `event_id`、`step`，照這個欄序及原名；依 `event_id` 升冪，再依 `step` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT DISTINCT event_id, step
    FROM app_events
    WHERE raw_id >= 25 AND raw_id <= 29
    ORDER BY event_id, step;
  explain: 26 與 27 的事件和步驟相同，只應留一列。把 `raw_id` 放進 DISTINCT 會阻止這次合併。
  hints:
  - 先用接收編號圈出範圍
  - 只對交付欄位去重
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-05-tuple
  - sq-read-05-key
  - sq-read-02-edge
  tags:
  - distinct
  - 去重
  - 欄位組合
---

## 一欄一份名單，兩欄一份組合

客服要把已登記城市做成選單。直接從會員表撈城市，港灣會出現很多次；客服需要的是每種選項，不是每個會員。去重（deduplication）就是按你指定的內容，把一樣的輸出列折成一列。先確定交付欄位，再加關鍵字，不要先整張表去重再想拿哪幾欄。

## 語法速查

- `SELECT DISTINCT city FROM users`：以單欄做去重，輸出每種城市值。
- `SELECT DISTINCT city, signup_date FROM users`：以整組值去重；同城市但不同日期會各留一列。
- `SELECT DISTINCT * FROM users`：全部欄位都要相同才合併；若每列的會員編號不同，就不會少列。

數據集：`shop`。先查看包含缺值的版本，對照輸出欄位和列數：

```sql
SELECT DISTINCT city
FROM users
ORDER BY city NULLS LAST;
```

這張會員表有 30 列，卻只回傳 4 列：山城、河岸、港灣，加上一列 `NULL`。會員 6 和 12 都沒填城市，在這份只關心城市的名單裡，兩列未知折成一列。用等號做判斷時，缺值跟缺值相比仍是未知；那是判斷條件的規則，不代表去重會保留每一個缺值。若選單只接受能選的地名，在排序前面加上 `WHERE city IS NOT NULL`，結果應剩 3 列。不要用把缺值改成另一個城市的方式達成一樣的列數，因為那會改變名單的含義。

## 先決定什麼叫「同一筆」

把會員編號加到輸出，答案就變回每位會員一列：港灣與編號 1 的組合，和港灣與編號 4 的組合，是兩個結果。城市沒有變多，變的是你要求數據庫交付的東西。日期也一樣，加入註冊日就等於問「有哪些城市與日期的搭配」，不是城市選單多了一個說明欄。回到交付物，先用一句話寫下「每一列代表什麼」，再檢查每個被選出的欄是否屬於這個承諾。

接收日誌有另一種重複。同一個事件可能重送；接到的每一列有不同接收編號，但事件編號相同。動手題會讓你看見同一事件的兩次接收如何變成一列。若需求改成「每個事件留下最早接收時間」，不能一併選入不同的時間期待自動挑第一筆。[ROW_NUMBER](#/lesson/sq-window-03) 會教你先排順序，再選出要保留的那筆。

**換引擎怎麼說：**普通 `SELECT DISTINCT` 可移到 Hive SQL、Spark SQL 或 MySQL。DuckDB 另有 `DISTINCT ON`，只按指定欄去重並保留一筆代表列；不要把這個擴充當成其他引擎都認得的寫法。跨引擎移植文字名單，也要確認字串的比較與排序規則，不能拿畫面顯示順序當作同值的證據。

## 常見錯誤

- **城市仍出現很多次** → 選進了唯一會員編號 → 只選城市，再加 `DISTINCT`。
- **選單多出一項 NULL** → 去重不是非空檢查 → 在 `WHERE` 補上 `city IS NOT NULL`。
- **原表預覽沒有變少** → `SELECT` 只產生查詢結果 → 把查詢結果當交付物，不要為了這份選單刪會員紀錄。
- **換了欄位就換了列數** → 去重以整個輸出列為準 → 先寫出要交付的欄序和每列代表的事，再驗算。

把第一題的結果和原表預覽並排核對。你應能指著選單上的一列說，它代表一個已知城市，而不是某一名會員，也不是數據庫擅自挑了某名會員做代表。
