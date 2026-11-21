---
id: sq-pattern-09
module: sq-pattern
order: 9
title: 會話切分
subtitle: 閒置多久才算下一次造訪
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-08
objectives:
  - "以事件時間和唯一鍵排序並取前一筆時間"
  - "照嚴格大於的閒置門檻標記會話開頭"
  - "累計開頭標記並交付每段訪問的統計"
tags:
  - "會話切分"
  - "窗口函式"
  - "事件時間"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 LAG 預設的缺值與 ROWS 累計窗口。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "對照 DATE_ADD 的分鐘間隔寫法。"
concepts:
  - id: "sql-session-threshold"
    prompt: "相隔恰好 8 分鐘，題意為超過 8 分鐘才分段，該列是新會話嗎？"
    answer: "不是；比較式是 >，不含等於。"
    mcq:
      options:
        - "是，8 分鐘達到門檻"
        - "不是，尚未超過門檻"
        - "要看接收時間"
        - "只要跨午夜就是"
      answer: 1
      explain: "門檻定義用事件相隔時間；跨日與收到次序都無關。"
    interview:
      question: "缺 session_id，你怎樣估計每人的到訪？"
      answer: "我會先去重，依事件時間排序並固定同時事件的順序。前一事件不存在或閒置超過門檻就標一個新開頭，按用戶累計出段號。我會把它標成推算會話，不當原系統真值。"
      points:
        - "去重及穩定排序"
        - "首列與等於門檻的邊界"
        - "用累計開頭取得段號"
  - id: "sql-session-first"
    prompt: "每人的第一列 LAG 是 NULL，開頭旗標應是？"
    answer: "1；不需要前一個事件也一定開一段。"
    mcq:
      options:
        - "NULL"
        - "0"
        - "1"
        - "取上一用戶旗標"
      answer: 2
      explain: "第一列本身開始第一段，不能因為無法比較就落入非開頭。"
  - id: "sql-session-running"
    prompt: "已經有開頭旗標 1、0、0、1、0，段號是什麼？"
    answer: "1、1、1、2、2；從第一列累加到當列。"
practice:
  - id: "sq-pattern-09-p1"
    kind: "sql"
    category: [interval, window]
    title: "核對會話起點旗標"
    minutes: 7
    level: 2
    dataset: "events"
    prompt: "保留每個 `event_id` 最早收到的列，同時取較小 `raw_id`；不使用 `session_id`。對每個用戶依 `event_at`、`event_id` 升序，第一筆或與上一筆相隔超過 8 分鐘標為 1，其餘為 0。輸出 `user_id`、`event_id`、`event_at`、`prev_at`、`begins`，依 `user_id`、`event_at`、`event_id` 升序。"
    solution: |-
      WITH clean AS (
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
          FROM app_events
        ) r WHERE pos = 1
      ), prev AS (
        SELECT user_id, event_id, event_at,
               LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at, event_id) AS prev_at
        FROM clean
      ), flags AS (
        SELECT *, CASE WHEN prev_at IS NULL OR event_at > prev_at + INTERVAL '8 minutes'
                       THEN 1 ELSE 0 END AS begins
        FROM prev
      ), numbered AS (
        SELECT *, SUM(begins) OVER (
          PARTITION BY user_id ORDER BY event_at, event_id ROWS UNBOUNDED PRECEDING
        ) AS visit_no
        FROM flags
      )
      SELECT user_id,event_id,event_at,prev_at,begins FROM flags ORDER BY user_id,event_at,event_id;
    explain: "8 分鐘整不開新段；首列沒有前一筆，必須明確使用 IS NULL。e90 收到較晚不會改變行為次序。"
    hints:
      - "以 LAG 取同一用戶之前的事件時間。"
      - "用原時間加 INTERVAL，避免截斷分鐘。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-session-threshold"
      - "sql-session-first"
      - "sq-window-05-lag"
      - "sql-funnel-late"
    tags:
      - "會話切分"
      - "窗口函式"
  - id: "sq-pattern-09-p2"
    kind: "sql"
    category: [interval, window]
    title: "交付重建的會話摘要"
    minutes: 10
    level: 3
    dataset: "events"
    prompt: "面試追問：沿用前題去重及超過 8 分鐘開新會話的規則。對每位用戶依時間給會話從 1 起編號；一段一列，保留只有一筆的會話。輸出 `user_id`、`visit_no`、`start_at`、`end_at`、`event_count`（去重後事件數），依 `user_id`、`visit_no` 升序。"
    solution: |-
      WITH clean AS (
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
          FROM app_events
        ) r WHERE pos = 1
      ), prev AS (
        SELECT user_id, event_id, event_at,
               LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at, event_id) AS prev_at
        FROM clean
      ), flags AS (
        SELECT *, CASE WHEN prev_at IS NULL OR event_at > prev_at + INTERVAL '8 minutes'
                       THEN 1 ELSE 0 END AS begins
        FROM prev
      ), numbered AS (
        SELECT *, SUM(begins) OVER (
          PARTITION BY user_id ORDER BY event_at, event_id ROWS UNBOUNDED PRECEDING
        ) AS visit_no
        FROM flags
      )
      SELECT user_id, visit_no, MIN(event_at) AS start_at, MAX(event_at) AS end_at,
             COUNT(*) AS event_count
      FROM numbered GROUP BY user_id, visit_no ORDER BY user_id, visit_no;
    explain: "窗口累計把每個開頭變成新段號；不要用 ROW_NUMBER 當段號，也不要按自然日分區切斷跨日造訪。"
    hints:
      - "累加前先把每列開頭旗標算出來。"
      - "段號和用戶一起作 GROUP BY 的鍵。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-session-threshold"
      - "sql-session-first"
      - "sq-window-05-lag"
      - "sql-session-running"
      - "sql-funnel-late"
    tags:
      - "會話切分"
      - "窗口累計"
---

## 用閒置時間切造訪，不替原鍵補一個猜測值

有一批手機事件漏填會話鍵，想用行為間隔估計一次造訪。這叫會話切分（sessionization；也稱會話劃分，台灣也用工作階段切分）。本課不去補寫來源 ID，而是把整份事件重新依同一規則分段：同人相鄰事件**超過 8 分鐘**就另開一段。23:55、00:03、00:11 雖然跨午夜，兩個間隔都剛好 8 分鐘，仍為同一段；若尾列變 00:12，才會開下一段。門檻是營運定義，不是瀏覽器活動的真值。

## 先看上一筆，再做開頭旗標

在 [自由練習](#/sql?tab=free) 選 `events`。去重時以最早接收版本為準；行為排序使用 `event_at`，同一時刻用唯一 `event_id` 固定順序。`LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at, event_id)` 取得排序後的上一列；沒有上一列得到 NULL。先看看用戶 14，找到源表會話鍵為空但時間仍連得上的那段。

```sql
WITH clean AS (
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
    FROM app_events
  ) r WHERE pos = 1
), prev AS (
  SELECT user_id, event_id, event_at,
         LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at, event_id) AS prev_at
  FROM clean
)
SELECT * FROM prev WHERE user_id = 14 ORDER BY event_at, event_id;
```

開頭旗標（flag）只有 0 或 1。首列為 1；否則用 `event_at > prev_at + INTERVAL '8 minutes'` 判斷，不把秒數先截成整分鐘。接著讓窗口從首列加到當列；旗標序列 1、0、0、1、0 加出 1、1、1、2、2。用戶不是每次只會有一段，所以最後把「用戶、段號」一起分組；首末時間取最小與最大，單事件段仍有一筆。段結束時間是最後一次看見行為，不是觀測到的離開時間。

```sql
WITH clean AS (
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
    FROM app_events
  ) r WHERE pos = 1
), prev AS (
  SELECT user_id, event_id, event_at,
         LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at, event_id) AS prev_at
  FROM clean
), flags AS (
  SELECT *, CASE WHEN prev_at IS NULL OR event_at > prev_at + INTERVAL '8 minutes'
                 THEN 1 ELSE 0 END AS begins
  FROM prev
), numbered AS (
  SELECT *, SUM(begins) OVER (
    PARTITION BY user_id ORDER BY event_at, event_id ROWS UNBOUNDED PRECEDING
  ) AS visit_no
  FROM flags
)
SELECT user_id,event_id,event_at,prev_at,begins,visit_no FROM numbered ORDER BY user_id,event_at,event_id;
```

**方言。** MySQL 用 `DATE_ADD(prev_at, INTERVAL 8 MINUTE)`。Spark SQL／Hive SQL 的時間間隔常寫成 `INTERVAL '8' MINUTE`，面試時先說方言；去重、`LAG`、`CASE` 和窗口累計的分層不變。若晚到事件插入一段空白，有機會把兩段接起來，所以增量重算不能只更新那一列。

### 把推算會話交給下游前

拿原表事件數、去重事件數、切出會話的事件數做三次核對。第一個可以比第二個大，因為包含重送；第二個必須等於所有會話的事件數加總，少掉則表示有事件沒有分段。再找一個單事件的會話：首末時間相同、事件數為 1，不能為了報表看起來合理就自動刪除。這和「在線區間長度為零」的題意不同：會話可以有行為，卻沒有觀測到持續時間。

如果一個較早發生的晚到事件插在兩次造訪之間，原本大於門檻的間隔可能打成兩個不超過門檻的小間隔，兩段便會合成一段。例如 10:00 和 10:12 原本隔 12 分鐘，補到一筆 10:06，就變成兩次 6 分鐘。後面的段號也可能跟著變，不適合直接當成對外永久識別碼。若下游需要穩定指標，應先說明可重算的時間範圍，哪些時點以前不再改，並讓未到齊的分段有清楚標記。

要讓定位更容易，保留每段第一個事件的 ID 供人工核對；若要重現報表當時的分段，應按當時的接收截止點過濾後再還原發生順序，不能只抄最新的會話結果。

## 常見錯誤

- 恰好 8 分鐘也被拆成兩段 → 用 `>=` → 依題意改用 `>`。
- 第一段編成 0 → 首列 NULL 未判斷 → 先寫 `IS NULL`。
- 同一事件重送令段內計數增加 → 按接收列數 → 先按事件鍵去重。
- 午夜自動另開一段 → 以日期分區 → 只以用戶分區。
