---
id: sq-pattern-06
module: sq-pattern
order: 6
title: 同時在線人數
subtitle: 離開與加入同秒先算誰
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-05
objectives:
  - "把非空在線區間展成進出事件"
  - "以同刻合併後的累計求同時在線曲線"
  - "找出峰值首次出現的區間並核對交接時刻"
tags:
  - "掃描線"
  - "半開區間"
  - "窗口累計"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 ROWS 窗口框、累計 SUM 與 LEAD。"
  - title: "Spark SQL：Built-in Functions"
    url: "https://spark.apache.org/docs/latest/api/sql/index.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "找窗口函式與時間間隔的方言對照。"
concepts:
  - id: "sql-online-ties"
    prompt: "一人 10:10 登出、另一人同時登入，人數淨變化是？"
    answer: "0；區間包含起點、不含終點。"
    mcq:
      options:
        - "+2"
        - "+1"
        - "0"
        - "−1"
      answer: 2
      explain: "進出各一個抵銷；不能把同秒的中間狀態當成真實峰值。"
    interview:
      question: "現場如何算同時在線峰值？"
      answer: "我把每段的起點標 +1、終點標 −1，合併同刻後累計。先說清楚這裡數人還是數會話；若同人能平行開兩段，要先合併其重疊區間才數人。"
      points:
        - "說清楚左閉右開"
        - "先匯總同刻再做前綴和"
        - "辨認用戶與會話粒度"
  - id: "sql-online-empty"
    prompt: "起點等於終點的區間，哪些瞬間在線？"
    answer: "沒有；半開的零長區間是空的。"
    mcq:
      options:
        - "剛好起點"
        - "起點後一秒"
        - "沒有"
        - "起點和終點各一次"
      answer: 2
      explain: "包含起點、不含終點，當兩者一樣時沒有值能同時滿足條件。"
  - id: "sql-online-span"
    prompt: "已求出某刻在線值，如何知道它維持到哪裡？"
    answer: "用 LEAD 取下一個變化點；值作用於當前點至下一點之前。"
practice:
  - id: "sq-pattern-06-p1"
    kind: "sql"
    category: [interval, window]
    title: "每位訪客預估在線十二分鐘"
    minutes: 7
    level: 2
    dataset: "events"
    prompt: "假設每個有瀏覽的用戶只在線一段：第一次 `view` 的 `event_at` 起，到 12 分鐘後（不含）。在所有起迄點各列一筆，包含淨變化為 0 的點。輸出 `at`、`online`（該刻變動後的人數），依 `at` 升序。"
    solution: |-
      WITH spans AS (
        SELECT user_id, MIN(event_at) AS start_at,
               MIN(event_at) + INTERVAL '12 minutes' AS end_at
        FROM app_events WHERE step = 'view' GROUP BY user_id
      ),
      edges AS (
        SELECT start_at AS "at", 1 AS delta FROM spans WHERE start_at < end_at
        UNION ALL
        SELECT end_at AS "at", -1 AS delta FROM spans WHERE start_at < end_at
      ), ticks AS (
        SELECT "at", SUM(delta) AS delta FROM edges GROUP BY "at"
      ), timeline AS (
        SELECT "at", SUM(delta) OVER (ORDER BY "at" ROWS UNBOUNDED PRECEDING) AS online,
               LEAD("at") OVER (ORDER BY "at") AS next_at
        FROM ticks
      )
      SELECT "at", online FROM timeline ORDER BY "at";
    explain: "拆端點後先按時間求淨變化；把同時進出分成兩列再累計可能產生假峰值。估計值不是實際在線監測。"
    hints:
      - "每人只取一次最早瀏覽。"
      - "起點 +1、終點 −1，同刻先求和；若採用 at 作欄名，以雙引號包住。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-online-ties"
      - "sql-online-empty"
    tags:
      - "掃描線"
      - "窗口累計"
  - id: "sq-pattern-06-p2"
    kind: "sql"
    category: [interval, top-n]
    title: "找首個到達峰值的會話區間"
    minutes: 10
    level: 3
    dataset: "events"
    prompt: "面試追問：每個非空 `(user_id, session_id)` 會話用最早到最晚 `event_at` 作為左閉右開區間，終點等於起點者不算。以所有非空區間端點切成不重疊的子區間；找同時進行會話最多的第一個子區間（同值取起點最早，不合併相鄰子區間）。輸出唯一一列 `start_at`、`end_at`、`peak_sessions`，依 `start_at` 升序。"
    solution: |-
      WITH spans AS (
        SELECT user_id, session_id, MIN(event_at) AS start_at, MAX(event_at) AS end_at
        FROM app_events WHERE session_id IS NOT NULL GROUP BY user_id, session_id
      ),
      edges AS (
        SELECT start_at AS "at", 1 AS delta FROM spans WHERE start_at < end_at
        UNION ALL
        SELECT end_at AS "at", -1 AS delta FROM spans WHERE start_at < end_at
      ), ticks AS (
        SELECT "at", SUM(delta) AS delta FROM edges GROUP BY "at"
      ), timeline AS (
        SELECT "at", SUM(delta) OVER (ORDER BY "at" ROWS UNBOUNDED PRECEDING) AS online,
               LEAD("at") OVER (ORDER BY "at") AS next_at
        FROM ticks
      )
      SELECT start_at, end_at, peak_sessions FROM (
        SELECT "at" AS start_at, next_at AS end_at, online AS peak_sessions
        FROM timeline WHERE next_at IS NOT NULL
        ORDER BY online DESC, "at" LIMIT 1
      ) p ORDER BY start_at;
    explain: "LEAD 給出下一端點；不能用最後一點替代有寬度的區間。這題數的是會話，即使同用戶開兩個會話也分別計。"
    hints:
      - "先排除空區間再拆端點。"
      - "在相鄰端點區間中做一次 Top 1。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-online-ties"
      - "sql-online-empty"
      - "sql-online-span"
      - "sq-window-06-running"
      - "sql-top-fixed"
    tags:
      - "掃描線"
      - "窗口累計"
      - "Top N"
---

## 只在變動時數人

服務要查昨晚同時在線的峰值。每秒產生所有會員的明細再數，會做許多重複工作：在線值只有在有人進出時變化。掃描線（sweep line）把一段在線區間拆成起點 +1、終點 −1，依時間累計。先問要數人、數裝置，還是數會話；同一人開兩個會話時，三者不是同一個指標。

我們採用半開區間（half-open interval）：起點算，終點不算，之後在[〈半開區間〉](#/lesson/sq-time-02)會詳談。甲在 10:10 離開，丙在 10:10 進來，乙仍在線。10:10 是乙、丙兩人，不是三人。如果把同刻先加再減後拿最大值，就會量到不存在的三人峰值。

## 核對一個交接點，再取峰值

下方是自帶數據的小例子，用 [自由練習](#/sql?tab=free) 的 `events` 即可執行。三段區間中，第一段結束剛好是第三段開始；確認中間結果在 10:10 的淨變化為 0。不要用 `UNION` 代替 `UNION ALL`：兩人同刻進來有兩列一樣的 +1，都必須數。

```sql
WITH spans(start_at,end_at) AS (VALUES
  (TIMESTAMP '2026-02-01 10:00:00', TIMESTAMP '2026-02-01 10:10:00'),
  (TIMESTAMP '2026-02-01 10:05:00', TIMESTAMP '2026-02-01 10:15:00'),
  (TIMESTAMP '2026-02-01 10:10:00', TIMESTAMP '2026-02-01 10:20:00')
),
edges AS (
  SELECT start_at AS "at", 1 AS delta FROM spans WHERE start_at < end_at
  UNION ALL
  SELECT end_at AS "at", -1 AS delta FROM spans WHERE start_at < end_at
), ticks AS (
  SELECT "at", SUM(delta) AS delta FROM edges GROUP BY "at"
), timeline AS (
  SELECT "at", SUM(delta) OVER (ORDER BY "at" ROWS UNBOUNDED PRECEDING) AS online,
         LEAD("at") OVER (ORDER BY "at") AS next_at
  FROM ticks
)
SELECT * FROM ticks ORDER BY "at";
```

再把各時間點的變動量用窗口累加。`ROWS UNBOUNDED PRECEDING` 指在排序後從首列一路加到這列。某時點的結果作用到下一個端點之前；`LEAD("at")` 就是找那個端點。中間結果中每刻只剩一列，所以不再需要選擇同秒哪一列先加。最後端點之後沒有更多區間，完整計算到這裡的在線值應是 0。

```sql
WITH spans(start_at,end_at) AS (VALUES
  (TIMESTAMP '2026-02-01 10:00:00', TIMESTAMP '2026-02-01 10:10:00'),
  (TIMESTAMP '2026-02-01 10:05:00', TIMESTAMP '2026-02-01 10:15:00'),
  (TIMESTAMP '2026-02-01 10:10:00', TIMESTAMP '2026-02-01 10:20:00')
),
edges AS (
  SELECT start_at AS "at", 1 AS delta FROM spans WHERE start_at < end_at
  UNION ALL
  SELECT end_at AS "at", -1 AS delta FROM spans WHERE start_at < end_at
), ticks AS (
  SELECT "at", SUM(delta) AS delta FROM edges GROUP BY "at"
), timeline AS (
  SELECT "at", SUM(delta) OVER (ORDER BY "at" ROWS UNBOUNDED PRECEDING) AS online,
         LEAD("at") OVER (ORDER BY "at") AS next_at
  FROM ticks
)
SELECT "at", next_at, online FROM timeline ORDER BY "at";
```

若只查報表截點之後的峰值，開頭可能已有人在線；先算截點前累積，或先把交叉截點的區間裁到查詢範圍，再拆端點。不要把端點表直接按日期篩掉前一天就歸零。若原始區間不是監測結果，而是由首次瀏覽加固定分鐘推算，對外交付時要連同這個假設說清楚。

**方言。** Hive SQL、Spark SQL 與 MySQL 可沿用 `UNION ALL`、聚合再做窗口累計；本課 DuckDB 的時間間隔 `INTERVAL '12 minutes'` 對應 MySQL 的 `INTERVAL 12 MINUTE`，不能照抄語法。

### 一張用來驗收掃描線的小清單

把三段例子的端點依序列出；從 0 起算，10:00 是 1，10:05 是 2，10:10 仍是 2，10:15 是 1，10:20 回到 0。如果想報「最高值從何時開始」，應回到峰值的第一個起點 10:05；如果要報「峰值連續維持多久」，兩段相鄰且同值，需要再合併才是到 10:15。第一個子區間和連續峰值段不是同一個輸出，即使峰值數字相同。

再將兩段改成同時開始，驗證淨變化是 +2，不是 +1；最後讓一段起迄相同，確認它從一開始就沒進端點表。若數據出現終點早於起點，也不要只當作零長區間略過：練習先保留合法段，真正的監控表應另外記錄不合法的段數，否則峰值看來偏低卻查不出原因。

## 常見錯誤

- 高峰發生在同秒交接 → 同刻各自累計 → 先用 `GROUP BY "at"` 合併。
- 最後在線人數不歸零 → 遺漏部分終點、或重複端點被去重 → 用 `UNION ALL` 保留每段的起迄。
- 同一人被數兩次 → 一人有重疊區間卻在數會話 → 先合併同人的重疊區間或改名為會話數。
