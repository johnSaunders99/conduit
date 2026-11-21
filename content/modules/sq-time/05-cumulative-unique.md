---
id: sq-time-05
module: sq-time
order: 5
title: 累計去重用戶
subtitle: 分日去重不能直接相加
status: ready
minutes: 30
level: 2
prereqs:
- sq-time-04
objectives:
  - "將每位用戶歸到首次出現日"
  - "逐日加總新用戶但不重複計回訪"
  - "比較區間內重新起算與承接歷史基底的累計"
tags:
  - "累計去重"
  - "首次出現"
  - "日曆骨架"
resources:
  - title: "DuckDB：Aggregate Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/aggregates"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習去重計數為何不是可直接相加的指標。"
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀累計 SUM 的窗口框與 DISTINCT 支援。"
concepts:
  - id: "sql-cumulative-first"
    prompt: "昨天、今天各有同一位會員登入，累計去重人數今天應增加幾位？"
    answer: "0 位，這個人只在首次出現日貢獻 1。"
    mcq:
      options:
        - "2"
        - "1"
        - "0"
        - "按登入管道決定"
      answer: 2
      explain: "每日活躍各可數一次，累計不同人的集合只有一位。"
    interview:
      question: "報表從週一開始，之前的會員要不要計入？"
      answer: "我會先問累計是本週內的人，還是歷史至當日。前者先截窗再找首次日；後者保留歷史首日，週一加上此前的基底，再累計每日新增。"
      points:
        - "起算範圍決定首次日"
        - "已見者不重複"
        - "驗證第一天及最後一天"
  - id: "sql-cumulative-baseline"
    prompt: "已有 10 位歷史用戶，週一新增 2，週二新增 0。歷史至週二累計是？"
    answer: "12，基底加新增。"
    mcq:
      options:
        - "0"
        - "2"
        - "10"
        - "12"
      answer: 3
      explain: "零增量不會清掉歷史，也不能只看報表期間新增。"
  - id: "sql-cumulative-last"
    prompt: "區間內去重累計的最後一列，可如何獨立驗證？"
    answer: "用整個觀測區間的 COUNT(DISTINCT user_id) 核對最後一列，不把每日值相加。"
practice:
  - id: "sq-time-05-p1"
    kind: "sql"
    category: [time, distinct]
    title: "六天內首次出現的會員"
    minutes: 7
    level: 2
    dataset: "logins"
    prompt: "只看 2026-02-18 到 2026-02-23（含首尾）的 `login_at`。每人只在這六天內第一次出現時貢獻 1；沒登入的日子也要列。輸出 `d`、`new_users`、`cumulative_users`，依 `d` 升序。"
    solution: |-
      WITH first_seen AS (
        SELECT user_id, MIN(CAST(login_at AS DATE)) AS first_day FROM login_log
        WHERE login_at >= TIMESTAMP '2026-02-18 00:00:00' AND login_at < TIMESTAMP '2026-02-24 00:00:00'
        GROUP BY user_id
      ), adds AS (
        SELECT first_day AS d, COUNT(*) AS new_users FROM first_seen GROUP BY first_day
      ), calendar AS (
        SELECT CAST(day_value AS DATE) AS d
        FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
      )
      SELECT c.d, COALESCE(a.new_users, 0) AS new_users,
             SUM(COALESCE(a.new_users, 0)) OVER (ORDER BY c.d ROWS UNBOUNDED PRECEDING) AS cumulative_users
      FROM calendar c LEFT JOIN adds a ON a.d = c.d ORDER BY c.d;
    explain: "先截取六天才找首次日；如果先找全表首次日，期間內回來的老用戶相對這個區間會被漏算。2/20 應承接前一日累計。"
    hints:
      - "每日只數 first_day 等於這天的會員。"
      - "用日曆表保留無人首度出現的日期。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-cumulative-first"
      - "sq-window-06-running"
      - "sql-cumulative-last"
      - "sql-fill-spine"
    tags:
      - "累計去重"
      - "缺日補零"
  - id: "sq-time-05-p2"
    kind: "sql"
    category: [distinct, window]
    title: "查詢期間承接歷史基底"
    minutes: 10
    level: 3
    dataset: "logins"
    prompt: "面試追問：以本數據集全歷史 `login_at` 找每人的首次日，輸出 2026-01-02 到 2026-01-08（含首尾）每天的新增人數及截至該日的歷史累計（包含 1/2 前已看過的人）。輸出 `d`、`new_users`、`cumulative_users`，依 `d` 升序。"
    solution: |-
      WITH first_seen AS (
        SELECT user_id, MIN(CAST(login_at AS DATE)) AS first_day FROM login_log
        GROUP BY user_id
      ), adds AS (
        SELECT first_day AS d, COUNT(*) AS new_users FROM first_seen GROUP BY first_day
      ), calendar AS (
        SELECT CAST(day_value AS DATE) AS d
        FROM generate_series(DATE '2026-01-02', DATE '2026-01-08', INTERVAL '1 day') t(day_value)
      )
      SELECT c.d, COALESCE(a.new_users, 0) AS new_users,
             (SELECT COUNT(*) FROM first_seen WHERE first_day < DATE '2026-01-02') + SUM(COALESCE(a.new_users, 0)) OVER (ORDER BY c.d ROWS UNBOUNDED PRECEDING) AS cumulative_users
      FROM calendar c LEFT JOIN adds a ON a.d = c.d ORDER BY c.d;
    explain: "先對全歷史每人取最早，再分出開窗前的基底與窗內新增。如果在原始事件直接篩 1/2 開始才取 MIN，同一位老會員會被誤當新會員。"
    hints:
      - "把首日早於報表起日的人數獨立求出。"
      - "窗內窗口累計加一次基底，不是每列加基底再求和。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-cumulative-first"
      - "sq-window-06-running"
      - "sql-cumulative-baseline"
      - "sql-cumulative-last"
      - "sql-fill-spine"
    tags:
      - "累計去重"
      - "窗口累計"
      - "首次出現"
---

## 每天出現，不表示每天都是新的人

營運想看截至每天共有多少不同會員用過服務。甲週一登入、週二又登入，兩天日活躍各是 1，但截至週二仍只有 1 位不同會員。**累計去重（cumulative distinct count）不是把每日去重再加起來。** 先找每位會員的首次出現日（first-seen date），每人只在那天貢獻 1；之後把每日首次出現的人數累計才不重複。原理是把可能多日出現的集合，改拆成彼此沒有成員重疊的首次日群組。

## 檢查每人的首次日

在 [自由練習](#/sql?tab=free) 選 `logins`。`MIN(CAST(login_at AS DATE))` 取出每人的最早登入日，不取接收日，也不必先去除當天重複登入：重複的相同日期不改變最小值。先看下面的名冊，確認用戶 1 只出現一列，即使後面幾天都有他。若做「每個管道各看自己的累計」，鍵要變成管道和用戶，兩管道仍不可相加成全站。

```sql
WITH first_seen AS (
  SELECT user_id, MIN(CAST(login_at AS DATE)) AS first_day FROM login_log
  GROUP BY user_id
)
SELECT * FROM first_seen ORDER BY first_day, user_id;
```

把名冊按首次日計數，再左連接日期骨架。最後用 `SUM(...) OVER (ORDER BY d ROWS UNBOUNDED PRECEDING)` 把到當天的新增加起來。下例只從六天內開始找首次日，因此窗外有登入也不影響；2/20 缺日但累計值仍應延續。

```sql
WITH first_seen AS (
  SELECT user_id, MIN(CAST(login_at AS DATE)) AS first_day FROM login_log
  WHERE login_at >= TIMESTAMP '2026-02-18 00:00:00' AND login_at < TIMESTAMP '2026-02-24 00:00:00'
  GROUP BY user_id
), adds AS (
  SELECT first_day AS d, COUNT(*) AS new_users FROM first_seen GROUP BY first_day
), calendar AS (
  SELECT CAST(day_value AS DATE) AS d
  FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
)
SELECT c.d, COALESCE(a.new_users, 0) AS new_users,
       SUM(COALESCE(a.new_users, 0)) OVER (ORDER BY c.d ROWS UNBOUNDED PRECEDING) AS cumulative_users
FROM calendar c LEFT JOIN adds a ON a.d = c.d ORDER BY c.d;
```

如果需求改成「有史以來截至每天」，先取全數據首日，再把報表起日前的用戶數當基底。基底只加一次；也可以在全歷史計算窗口後，最外層才篩報表日期。用報表第一天驗算起始值、最後一天做一次獨立的整窗去重核對。中間每列差值應等於當天新增，但此性質單獨不能證明起始值正確。若需求是最近 7 天的滾動去重，會員會掉出窗口，不能套用只增不減的首次日法。

**方言。** DuckDB 支援窗口聚合的 `DISTINCT`，MySQL 不支援 `COUNT(DISTINCT ...) OVER (...)`。先取得每人首日再做普通窗口和，可帶到 Spark SQL、Hive SQL 與 MySQL。

### 一張紙能驗算兩種起點

寫甲在週日與週一出現、乙只在週一出現、丙週三首次出現。只看週一到週三，週一新增是 2，週三累計是 3；承接歷史時，週一開始前的基底包含甲，週一只新增乙，週三累計仍是 3。末列在這個樣本碰巧一樣，不能只驗末列。再加一個只有週日出現的人，歷史累計就會多一位，也不會被計成週一新增。

想核對兩套規則，最直接是先交出首日名冊；取 1–2 位已知用戶逐一找出被分到哪天。檢查跨日的折線不要只看它是不是永遠上升：把截窗後的新客當成真新客同樣能畫出單調折線。正式交付時把欄位命名和觀測起點一起留在報表上，否則下週改了開始日，讀者會以為每一點都是相同的歷史累計。

## 常見錯誤

- 累計超過實際會員數 → 把日活躍直接相加 → 改加每日首見人數。
- 報表起日以前的人消失 → 太早篩原始日期 → 用完整歷史取首日並加基底。
- 無活動的日期掉出折線 → 只從活動分組 → 日曆先補列，再累計。
