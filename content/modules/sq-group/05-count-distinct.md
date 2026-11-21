---
id: sq-group-05
module: sq-group
order: 5
title: COUNT DISTINCT
subtitle: 三次下單仍然只算一人
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-04
objectives:
- 用 COUNT(DISTINCT key) 分開計算活動列與唯一會員
- 判斷缺值和重送各如何影響計數
- 驗證各日的人數相加不等於全期去重人數
tags:
- count distinct
- 唯一用戶
- 事件重送
- 去重計數
resources:
- title: Aggregate Functions
  url: https://duckdb.org/docs/stable/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 DISTINCT 可套在哪些聚合，以及缺值處理。
- title: MySQL Aggregate Function Descriptions
  url: https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 比較 MySQL 多欄組合去重與單欄寫法。
concepts:
- id: sq-group-05-entity
  prompt: 同一會員同日登入三次，COUNT(DISTINCT user_id) 會增加多少？
  answer: 1；登入列數才增加 3。
  mcq:
    question: 要數至少登入一次的已知會員，應用哪個？
    options:
    - COUNT(*)
    - COUNT(user_id)
    - COUNT(DISTINCT login_id)
    - COUNT(DISTINCT user_id)
    answer: 3
    explain: 前面三個在一列一登入的表都不會合併同一會員的多次登入。
- id: sq-group-05-null
  prompt: COUNT(DISTINCT session_id) 會把未知會話算一個嗎？
  answer: 不會；COUNT 不計 NULL，即使 SELECT DISTINCT 會顯示一列 NULL。
  mcq:
    question: 輸入為 s1、s1、NULL，COUNT(DISTINCT session_id) 是多少？
    options:
    - '0'
    - '1'
    - '2'
    - '3'
    answer: 1
    explain: 兩個 s1 合成一個，NULL 不計。
- id: sq-group-05-scope
  prompt: 把每日去重會員數相加，能得到月去重會員數嗎？
  answer: 不能；同一會員跨日會重算。要在整月的範圍內按會員鍵再去重。
  mcq:
    question: 某會員連兩日都活躍。兩份日報加起來與兩日去重有何不同？
    options:
    - 一定都算 2
    - 一定都算 1
    - 兩日去重算 2、日活加總算 1
    - 日活加總貢獻 2、兩日去重只貢獻 1
    answer: 3
    explain: 不同範圍的唯一計數不能直接累加。
- id: sq-group-05-resend
  prompt: 要區分接收量與事件量，應各用哪個計數？
  answer: 接收量用 COUNT(*)，事件量用 COUNT(DISTINCT event_id)，並說明事件鍵缺值是否納入。
  interview:
    question: 日活加總與月活不同，你怎麼說明？
    answer: 某會員 1 日、2 日各登入一次，日活各算一人，加總是兩個人日；月活在整月依會員鍵只算一次。我會先確認事件範圍和用哪一欄認人，避免按登入流水號去重。
    points:
    - 說清不同計算範圍
    - 用跨日重訪反例拆解
practice:
- id: sq-group-05-p1
  kind: sql
  category: [distinct, aggregate]
  title: 每日登入列與唯一會員
  minutes: 5
  level: 1
  dataset: logins
  prompt: 用 `login_log` 的 `login_at` 取曆日，依日彙總 2026-01-01 至 2026-01-03（含）。欄序為 `login_day`（DATE）、`login_rows`（登入列數）、`active_users`（不同會員數），依 `login_day` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT CAST(login_at AS DATE) AS login_day,
           COUNT(*) AS login_rows, COUNT(DISTINCT user_id) AS active_users
    FROM login_log
    WHERE CAST(login_at AS DATE) BETWEEN DATE '2026-01-01' AND DATE '2026-01-03'
    GROUP BY CAST(login_at AS DATE)
    ORDER BY login_day;
  explain: 1 月 2 日有同人同日重登，計登入列與計會員數會不同。用 login_id 去重只是在數事件。
  hints:
  - 日期建立群組，會員鍵才用去重計數
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-05-entity
  - sq-group-05-scope
  - sq-group-03-key
  - sq-expr-06-clocks
  tags:
  - count distinct
  - 唯一用戶
  - 事件重送
- id: sq-group-05-p2
  kind: sql
  category: [distinct, aggregate]
  title: 接收、事件、已知會話並排
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 取 `raw_id` 25 到 37（含），輸出一列。欄序為 `raw_rows`（接收列數）、`unique_events`（不同事件鍵數）、`known_sessions`（不同且非 NULL 的會話鍵數）。不要求排序。
  starter: 'SELECT '
  solution: |
    SELECT COUNT(*) AS raw_rows, COUNT(DISTINCT event_id) AS unique_events,
           COUNT(DISTINCT session_id) AS known_sessions
    FROM app_events
    WHERE raw_id BETWEEN 25 AND 37;
  explain: '`e110` 的接收重送只算一個事件；不同事件可同屬會話，而且缺會話不算一個會話。先按各欄的意義分開計。'
  hints:
  - 接收量不去重
  - 事件與會話各用自己的鍵
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-05-entity
  - sq-group-05-null
  - sq-group-05-resend
  - sq-read-05-key
  - sq-group-01-repeated
  tags:
  - count distinct
  - 唯一用戶
  - 事件重送
---

## 按哪個鍵去重，就在數哪種事

登入日報有 7 筆紀錄，營運想知道有幾個不同會員登入。有人開 App 後又從網頁登入，同一日多筆是正常行為，不應刪掉原紀錄。去重計數（distinct count）只針對你指定的鍵算不同值；保留原始行為數，另一欄回答有幾個人。台灣也常說相異計數。

## 語法速查

- `COUNT(*)` 數輸入列；`COUNT(user_id)` 只略過會員編號缺值。
- `COUNT(DISTINCT user_id)` 在目前範圍內只數不同的非 NULL 會員鍵。先有 `GROUP BY` 時，每組各自去重。
- `SELECT DISTINCT session_id` 可顯示一列 NULL；`COUNT(DISTINCT session_id)` 卻不計它。區別來自 COUNT 不計缺值，不是 DISTINCT 變了意思。

數據集：`logins`。數 1 月 2 日當天的兩種量：

```sql
SELECT COUNT(*) AS login_rows, COUNT(DISTINCT user_id) AS active_users
FROM login_log
WHERE CAST(login_at AS DATE) = DATE '2026-01-02';
```

應為 7 筆登入、5 名會員。4 號與 9 號各登兩次，兩人各多一筆紀錄，但不會各多一個人。當天若同事交來 7 名活躍會員，不需要改原表修掉兩筆登入；先把兩個輸出欄的名稱與計數方法核對。若問的是「有幾個人用過網頁」，先用 `WHERE channel = 'web'` 改輸入範圍，再按同一會員鍵算。多一條條件是在改問題，不是改去重算法。

## 對哪個範圍說「一次」

每人每天只算一次，並不等於每人全月只算一次。會員 1 在 1 月 1 日和 2 日都有登入，每天各貢獻一人；在兩天合併後的去重人數裡只貢獻一人。相加的是人日，不是全期會員數。事件題也要區分接收鍵、事件鍵和會話鍵；不要拿有值的會話鍵去代替會員編號，也不要拿顯示用的替代字串假裝找回了會話。

**換引擎怎麼說：**單欄 `COUNT(DISTINCT x)` 在 Hive SQL、Spark SQL、MySQL 都常見。MySQL 的 `COUNT(DISTINCT a, b)` 可計多欄組合，但任一欄為 NULL 的組合不計。DuckDB 可把兩欄包成一個組合值，例如 `COUNT(DISTINCT (a, b))`；組合內有缺值不等於整個組合值是 NULL，不是無條件等價。跨引擎先定好缺值政策，再選欄去重；若要先取不同組合再計列數，可在 [CTE 命名步驟](#/lesson/sq-compose-04)練習把一個查詢當中間結果。

把 1 月 1 日和 2 日用相同的日期範圍查三次：先逐日計兩個小計，再去掉日期分組算整段。儘管總登入列數可以從兩日加回來，不重複會員數卻要用原始會員鍵重算。若日報只留每一天的人數，就沒有保留跨日是否同一人的資訊，不能從那些數字精確推回全月人數；下游應保有可去重的來源，而不是要求一個平均或修正係數。若練習改成只看某個通路，也要同樣限制日報與全期明細，否則比較的是不同會員集合。

## 常見錯誤

- **活躍會員數與登入列完全相同** → 用唯一的登入編號做去重 → 改用會員鍵並找一名重複登入的人驗算。
- **未知會話也算一個** → 先用固定文字補值再去重 → 保留 NULL 或另列缺值數。
- **日活加總被報為月活** → 去重範圍從一天換成一月 → 在整月明細上再算一次。
