---
id: sq-time-03
module: sq-time
order: 3
title: 隊列與留存矩陣
subtitle: 同批新客跨月留下多少
status: ready
minutes: 30
level: 2
prereqs:
- sq-time-02
objectives:
  - "以首筆已付款的月份建立隊列名冊"
  - "把活躍月對齊成從 0 起算的月齡"
  - "用固定分母、已觀測零值與未觀測格組出留存矩陣"
tags:
  - "留存"
  - "同期群"
  - "月齡"
  - "缺日補零"
resources:
  - title: "DuckDB：WITH Clause"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/with"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看如何將名冊、計數和骨架分成 CTE。"
  - title: "DuckDB：Date Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/date"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "核對 date_trunc 和 date_diff 的月份口徑。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "對照 TIMESTAMPDIFF 的參數與月差。"
concepts:
  - id: "sql-cohort-ages"
    prompt: "一月首購、三月再次下單，三月對這個人是哪個月齡？"
    answer: "第 2 個月齡；首次月是 0。"
    mcq:
      options:
        - "0"
        - "1"
        - "2"
        - "3"
      answer: 2
      explain: "以月首相差兩個曆月，不是以有下單的月份重新編號。"
    interview:
      question: "矩陣中同一列的分母需要逐月更新嗎？"
      answer: "不要。每列是一批固定的首購者，分母不變。月齡變化的是哪一天算觀測和有多少人再下單；我會在遞交前分開零與未觀測。"
      points:
        - "首購基於有效訂單"
        - "保留原人數當分母"
        - "月齡和觀測窗獨立"
  - id: "sql-cohort-cell"
    prompt: "已觀測整個月卻沒人回購，該留存格應是？"
    answer: "保留格子，分子 0。"
    mcq:
      options:
        - "刪掉整個同期群"
        - "分子 0"
        - "把分母也設 0"
        - "使用上月值填補"
      answer: 1
      explain: "無活動不代表無這個期間或無入組者。"
  - id: "sql-cohort-grid"
    prompt: "長表矩陣每列用什麼鍵識別？"
    answer: "首購月份加月齡；某個活躍月可能落入不同首購群的不同月齡。"
practice:
  - id: "sq-time-03-p1"
    kind: "sql"
    category: [retention, time]
    title: "核對首購月份的用戶人數"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "只看 2026-03-01 前的已付款訂單，按每位用戶第一個這類訂單的月份分群。輸出 `cohort_month`（月首 DATE）、`cohort_users`，依 `cohort_month` 升序。"
    solution: |-
      WITH months AS (
        SELECT DISTINCT user_id, CAST(DATE_TRUNC('month', order_date) AS DATE) AS m
        FROM orders WHERE status = 'paid' AND order_date < DATE '2026-03-01'
      ), firsts AS (
        SELECT user_id, MIN(m) AS cohort_month FROM months GROUP BY user_id
      )
      SELECT cohort_month, COUNT(*) AS cohort_users FROM firsts GROUP BY cohort_month ORDER BY cohort_month;
    explain: "先過濾取消單才能定首購。用戶同月多單不能在名冊中出現多次。"
    hints:
      - "找的是首個有效訂單月，不是註冊月。"
      - "先按用戶最早月份，再按月份數人。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-cohort-grid"
      - "sq-group-05-entity"
      - "sql-retain-denominator"
    tags:
      - "同期群"
      - "留存"
  - id: "sq-time-03-p2"
    kind: "sql"
    category: [retention, time]
    title: "交付月齡零到二的留存格"
    minutes: 11
    level: 3
    dataset: "shop"
    prompt: "面試追問：只用 2026-03-01 前已付款訂單定義首購與月活躍；每用戶每月只算一次。列出各群月齡 0、1、2 中已完整觀測的格（截至二月底），無人回購的已觀測格填 0，未觀測不列。輸出 `cohort_month`（月首 DATE）、`month_age`、`cohort_users`、`active_users`、`retention_rate`（0 到 1），依前兩欄升序。"
    solution: |-
      WITH months AS (
        SELECT DISTINCT user_id, CAST(DATE_TRUNC('month', order_date) AS DATE) AS m
        FROM orders WHERE status = 'paid' AND order_date < DATE '2026-03-01'
      ), firsts AS (
        SELECT user_id, MIN(m) AS cohort_month FROM months GROUP BY user_id
      ), sizes AS (
        SELECT cohort_month, COUNT(*) AS cohort_users FROM firsts GROUP BY cohort_month
      ), active AS (
        SELECT f.cohort_month, DATE_DIFF('month', f.cohort_month, m.m) AS month_age,
               COUNT(*) AS active_users
        FROM firsts f JOIN months m ON f.user_id = m.user_id
        GROUP BY f.cohort_month, month_age
      ), cells AS (
        SELECT s.cohort_month, n.month_age, s.cohort_users,
               CAST(s.cohort_month + n.month_age * INTERVAL '1 month' AS DATE) AS observed_month
        FROM sizes s CROSS JOIN (VALUES (0), (1), (2)) n(month_age)
      )
      SELECT c.cohort_month, c.month_age, c.cohort_users,
             COALESCE(a.active_users, 0) AS active_users,
             1.0 * COALESCE(a.active_users, 0) / c.cohort_users AS retention_rate
      FROM cells c LEFT JOIN active a
        ON a.cohort_month = c.cohort_month AND a.month_age = c.month_age
      WHERE c.observed_month < DATE '2026-03-01'
      ORDER BY c.cohort_month, c.month_age;
    explain: "每群人數一次算好再配上月齡骨架。二月群的月齡 1 落在三月，不能因無配對就顯示 0；月齡 0 應全數活躍。"
    hints:
      - "活躍表先去重到用戶月。"
      - "以同期群和月齡的組合當左表，先判斷月份有沒有完整觀測。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-cohort-ages"
      - "sql-cohort-cell"
      - "sql-cohort-grid"
      - "sq-group-05-entity"
      - "sql-retain-denominator"
      - "sql-fill-spine"
    tags:
      - "留存"
      - "月齡"
      - "缺日補零"
---

## 一列原始訂單不能當一個人

茶舖想比較一月和二月首購的顧客，回來買東西的比例是否變了。直接把二月訂單數除以一月訂單數，量到的是訂單量變動，不是同一群人的留存。沿用[〈留存率〉](#/lesson/sq-pattern-03)的概念：同一群（cohort，題名也稱「隊列」）由**首次已付款訂單月份**決定，以後不因再次購買而換群。先排除取消單，再決定取數範圍。每人同月下 3 張單也只有 1 位活躍用戶。

## 先交名冊，再對齊每個月齡

在 [自由練習](#/sql?tab=free) 選 `shop`。先用 `DATE_TRUNC('month', order_date)` 將日期映回月份開頭，再 `CAST(... AS DATE)`。`months` 的鍵是用戶與月首；`firsts` 按人取最小月首。這是分母的唯一來源，和是否還有下單無關。執行下方，檢查 6 號用戶的一月取消單沒有把會員提前分進一月。

```sql
WITH months AS (
  SELECT DISTINCT user_id, CAST(DATE_TRUNC('month', order_date) AS DATE) AS m
  FROM orders WHERE status = 'paid' AND order_date < DATE '2026-03-01'
), firsts AS (
  SELECT user_id, MIN(m) AS cohort_month FROM months GROUP BY user_id
)
SELECT * FROM firsts ORDER BY cohort_month, user_id;
```

留存矩陣（retention matrix）的列是首購月，欄是月齡（month age）。月齡 0 是首購月，1 是下一個月；一月首購者三月再來是月齡 2，即使二月沒來也不會重編為 1。`DATE_DIFF('month', cohort_month, m)` 在兩個月首之間算月差。先在數據中計各組活躍，再用「群 × 月齡」骨架配上數值。下方用長表表示矩陣：一組一個月齡一列，此後才由圖表轉成欄。

```sql
WITH months AS (
  SELECT DISTINCT user_id, CAST(DATE_TRUNC('month', order_date) AS DATE) AS m
  FROM orders WHERE status = 'paid' AND order_date < DATE '2026-03-01'
), firsts AS (
  SELECT user_id, MIN(m) AS cohort_month FROM months GROUP BY user_id
), sizes AS (
  SELECT cohort_month, COUNT(*) AS cohort_users FROM firsts GROUP BY cohort_month
), active AS (
  SELECT f.cohort_month, DATE_DIFF('month', f.cohort_month, m.m) AS month_age,
         COUNT(*) AS active_users
  FROM firsts f JOIN months m ON f.user_id = m.user_id
  GROUP BY f.cohort_month, month_age
), cells AS (
  SELECT s.cohort_month, n.month_age, s.cohort_users,
         CAST(s.cohort_month + n.month_age * INTERVAL '1 month' AS DATE) AS observed_month
  FROM sizes s CROSS JOIN (VALUES (0), (1), (2)) n(month_age)
)
SELECT c.cohort_month, c.month_age, c.cohort_users,
       COALESCE(a.active_users, 0) AS active_users,
       1.0 * COALESCE(a.active_users, 0) / c.cohort_users AS retention_rate
FROM cells c LEFT JOIN active a
  ON a.cohort_month = c.cohort_month AND a.month_age = c.month_age
WHERE c.observed_month < DATE '2026-03-01'
ORDER BY c.cohort_month, c.month_age;
```

驗算表頭之前，先分開三種格：月齡 0 是所有首購者，分子等於分母；已觀測整月且無回購是 0；三月還沒完整觀測，格子不交付。即使二月群比一月群小，也不能用全站活躍當比較基準，兩群各用初始人數。若只從有回購的數據對表格，沒有活動的組和沒有觀測的組會一起消失，讀者就無法判斷空白的原因。

**方言。** MySQL 用月首欄位配 `TIMESTAMPDIFF(MONTH, cohort_month, m)`；Spark SQL／Hive SQL 可用兩個月首的年月換算成月份索引後相減。不要拿未截月的兩個時間比較，再假設不同引擎的月差都等於跨過幾個月首。

### 檢查一格，而不是只看顏色深淺

一月有 10 位首購者，二月有 3 位回購，就是一月群月齡 1 的 30%；二月新增的 4 位首購者不進這個格。若要合計所有群的同一月齡，應把各群分子先加總，再除以同樣已觀測的各群分母總和，不能直接平均群百分比。每群大小相差很大時，不加權平均會偏離整體人數口徑。

交報表時順手帶出「觀測截止」或「完成至哪個月」。輪到三月完整後重新產表，二月群的月齡 1 才會新增一格；即使那時仍無回購，也能確定那個 0 是真實的觀測值，不是報表沒等到數據。檢查整張矩陣之前，可從其中一群挑兩位用戶，把首購及後續購買月份寫在紙上，再對照每格的計數。這比拿一眼看起來漂亮的熱圖當驗收更可靠。

## 常見錯誤

- 月齡跳過空月 → 對活躍月份排流水號 → 用日曆月差。
- 分母每月縮小 → 只數成功回購者 → 固定首購群規模。
- 未完成的三月變零 → 未先篩觀測月 → 先判斷資格，再對缺列補 0。
