---
id: sq-window-03
module: sq-window
order: 3
title: ROW_NUMBER
subtitle: 每個用戶只取最近一次
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-02
objectives:
- 在每組內編出唯一序號
- 在外層查詢只保留每組第一筆
- 為同時間紀錄指定可重現的勝出規則
tags:
- row_number
- 最新一筆
- 去重
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 row_number，區分序號和並列名次。
- title: MySQL：窗口函式
  url: https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的 ROW_NUMBER 和平手說明。
concepts:
- id: sq-window-03-number
  prompt: ROW_NUMBER 遇到相同排序值會給相同號碼嗎？
  answer: 不會，同一分區的每列有不同序號；平手未解決時，不保證誰拿較小號。
  mcq:
    options:
    - 會，同價同號
    - 會，且下一筆自動跳號
    - 不會，且平手順序必定固定
    - 不會，但要另訂平手規則
    answer: 3
    explain: ROW_NUMBER 強制唯一位置，不會替你指定兩列的業務優先順序。
- id: sq-window-03-filter
  prompt: 為何用 CTE 後在外層 WHERE rn = 1？
  answer: 窗口先在內層算出 rn，外層才有欄位能篩；同層 WHERE 在窗口之前。
  mcq:
    options:
    - 外層讀得到已算好的序號
    - 內層不能使用任何 WHERE
    - 外層 WHERE 會重排窗口
    - 窗口只能在 GROUP BY 算出
    answer: 0
    explain: 需要分開「要參與排名」與「顯示已算出的哪幾位」。
- id: sq-window-03-winner
  prompt: 重送時若要保留最早收到且 raw_id 最小的列，排序方式是？
  answer: 依 received_at 升序、raw_id 升序，在每個 event_id 分區取第一筆。
  mcq:
    options:
    - received_at 降序，再 raw_id 降序
    - received_at 升序，再 raw_id 升序
    - event_at 降序後不處理平手
    - 只按 event_id 排序
    answer: 1
    explain: 較早接收是業務要求；事件發生時間相同或事件鍵相同都不能替代。
  interview:
    question: 每個會員挑一筆最新登入，怎樣避免結果重跑就換人？
    points:
    - 按會員分區
    - 時間降序
    - 唯一鍵打破平手
    - 外層篩 rn
    answer: 我會按會員分區，時間降序，再用登入唯一鍵降序打破平手。在外層取 rn=1；驗證時用一位有同秒紀錄的人檢查選到哪一筆。
practice:
- kind: sql
  category: [top-n, window]
  title: 每位會員最近一次登入
  minutes: 6
  level: 1
  dataset: logins
  prompt: |
    每位有登入的會員只保留一筆，以 login_at 最大為最近；時間相同取 login_id 最大。輸出選中那一列的登入號與時間。

    只輸出以下欄位，欄序固定：`user_id`、`login_id`、`login_at`。

    排序：`user_id` 升序。
  solution: |
    WITH ranked AS (
      SELECT user_id, login_id, login_at,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_at DESC, login_id DESC) AS rn
      FROM login_log
    )
    SELECT user_id, login_id, login_at FROM ranked WHERE rn = 1 ORDER BY user_id;
  explain: |
    先用窗口指定一人一個最新位置，再從完整列取欄值。GROUP BY user_id 加 MAX(login_at) 只得時間，不能順便猜出同列的 login_id。
  hints:
  - 每個會員要重新從 1 開始。
  - 把時間最新的列排第一。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-03-number
  - sq-window-03-filter
  - sq-window-02-tie
  tags:
  - row_number
  - 最新登入
  id: sq-window-03-p1
- kind: sql
  category: [distinct, window]
  title: 重送事件只保留最早接收版本
  minutes: 9
  level: 2
  dataset: events
  prompt: |
    每個 event_id 保留 received_at 最早的一列；同一接收時間取 raw_id 最小。保留所選列的原始 raw_id、step、received_at；缺會話鍵也應保留。

    只輸出以下欄位，欄序固定：`event_id`、`raw_id`、`step`、`received_at`。

    排序：`event_id` 字母升序。
  solution: |
    WITH ranked AS (
      SELECT event_id, raw_id, step, received_at,
             ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS rn
      FROM app_events
    )
    SELECT event_id, raw_id, step, received_at
    FROM ranked WHERE rn = 1 ORDER BY event_id;
  explain: |
    e110 的事件時間相同但接收時間不同，應留 26。若用 MAX(received_at) 會留下重送的較晚版本；按 user_id 分區則會把同會員的許多獨立事件消掉。
  hints:
  - 分區鍵是重送共用的事件號。
  - 用接收時間決定先收哪列。
  - 取到排名後才篩。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-03-winner
  - sq-window-03-filter
  - sq-compose-05-dedup
  tags:
  - row_number
  - 事件去重
  id: sq-window-03-p2
---

登入看板只想保留會員最近一次登入，卻還要顯示那筆的渠道和登入號。只取 `MAX(login_at)` 能拿到時間，不能單靠這個聚合確定同一列的其他欄；若有兩筆同秒，接回原表又可能兩筆都留下。把整列先排進每組的位置，就能選出完整、可追查的一筆。

## 先編號、後挑列

1. `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_at DESC, login_id DESC) AS rn`：列序號（row number）在每個分區從 1 開始，每列都有唯一位置。主規則是最近，平手才比唯一登入號。
2. 把編號的完整查詢放進 `WITH ranked AS (...)`，外層才寫 `WHERE rn = 1`。這是一段先算、再篩的查詢，不需要另存表。
3. 最外層 `ORDER BY user_id` 只是呈現次序，不參與決定誰是第一筆。

在 SQL 練習場的「自由練習」選 `logins` 數據集，執行：

```sql
WITH ranked AS (
  SELECT user_id, login_id, login_at, channel,
         ROW_NUMBER() OVER (
           PARTITION BY user_id ORDER BY login_at DESC, login_id DESC
         ) AS rn
  FROM login_log
)
SELECT user_id, login_id, login_at, channel FROM ranked WHERE rn = 1 AND user_id = 4;
```

4 號在 1 月 2 日有兩筆登入，就這兩筆而言 7 號較晚。不過範例先用窗口算整份歷史，再由外層顯示會員 4；因此成品要找的是整份歷史的最後一筆，不是手算小片段的最後一筆。若業務只問 1 月 2 日，就把日期條件改在排名前。前後篩選不同：把日期放到外層是「歷史最新那筆剛好在這一天嗎？」。

使用 `ROW_NUMBER` 表示明確只取一筆；若業務要同價並列的商品全留下，就不該用唯一序號裁掉同分列。[〈RANK 與 DENSE_RANK〉](#/lesson/sq-window-04)會教兩種並列排名。DuckDB 還可用窗口後的 `QUALIFY` 簡寫；本課採 CTE 加外層 `WHERE`，不要求 Hive SQL、Spark SQL 或 MySQL 具備同一個簡寫功能。

## 先決定篩選是候選資格，還是交付後的條件

想像一位會員先用 web，之後才用 app。先在內層只留 web 再排名，找到的是「最新一次 web 登入」；先對所有渠道排名再到外層篩 web，回答的是「最新一次登入是否來自 web」。兩個查詢使用相同序號函式，題意卻不同。看到「最新」不要立刻把所有判斷都塞進同一層，先列出哪些列有資格參加選拔。

在事件去重題，候選列按事件識別碼分區，不要按會話或會員分區；有缺會話鍵的列也是獨立事件。第一排序鍵則遵從保留最早接收的需求，不把「最新版本最好」當成固定規則。你可以用同一個事件的 26、27 驗收：保留 26 的接收時間，且選出的是 26 的整列。若測試只檢查事件號，兩個錯版本看起來都會通過。

還可自己搭兩筆假想的同秒登入，登入號一大一小，預告哪筆應勝出。今天的數據未必有每種平手組合，但查詢要把規則寫出來，不能依賴目前輸入剛好不平手。交付給下游時用登入號回查，才能證明渠道和時間來自同一筆。

若設計成每人一列，最後可核對「輸出列數等於原始輸入不同會員數」。這個數量檢查能抓到漏分區，但仍不足以保證選對版本；再抽查最新者和有平手的對象，才算驗完。

## 常見錯誤

- 整張表只有一位會員出現 → 忘了 PARTITION BY，每組沒有重新從 1 排。
- 重跑時平手勝出的人會換 → 加唯一欄位作最後的排序鍵。
- 在同一層 WHERE 引用 rn 報錯 → 先做成具名中間結果，再在外層篩。
