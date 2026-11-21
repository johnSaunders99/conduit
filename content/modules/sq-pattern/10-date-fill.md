---
id: sq-pattern-10
module: sq-pattern
order: 10
title: 缺日補零
subtitle: 沒有訂單的日子仍要列出
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-09
objectives:
  - "生成含首尾的日曆骨架"
  - "左連接每日指標並為沒有明細的日期補零"
  - "在完整的日曆上計算固定天數平均"
tags:
  - "缺日補零"
  - "日曆骨架"
  - "窗口平均"
resources:
  - title: "DuckDB：List Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/list"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "核對 generate_series 包含尾端的行為。"
  - title: "DuckDB：FROM and JOIN Clauses"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/from"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習左連接如何保留骨架列。"
  - title: "MySQL：WITH"
    url: "https://dev.mysql.com/doc/refman/8.4/en/with.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀遞迴 CTE 的日期序列與缺日例子。"
concepts:
  - id: "sql-fill-spine"
    prompt: "整天沒有登入，為何只在原聚合上用 COALESCE 不會補出一天？"
    answer: "因為該日根本沒有列；先用日期骨架產生這列。"
    mcq:
      options:
        - "應該在聚合函式裡先用 COALESCE"
        - "必須先有日期列"
        - "先把 COUNT(*) 換成 COUNT(用戶鍵) 就會補列"
        - "將日期欄裡的 NULL 改成那天就會補列"
      answer: 1
      explain: "問題是沒有那天的列。無論替換日期或更換計數，只會影響現有列，須先從完整日曆取列。"
    interview:
      question: "報表缺兩天，補零後做七天移動平均合理嗎？"
      answer: "只有確認那兩天是已監測且無活動才補零；數據管道沒到齊要標未知。我會先用完整日曆左連接，再按日期連續七列平均。"
      points:
        - "完整日曆使列數對應天數"
        - "已知無活動和未到齊不同"
        - "說明窗口開頭不足七天的處理"
  - id: "sql-fill-count"
    prompt: "日曆直接左連接明細後，哪個不會把空日期數成一筆？"
    answer: "COUNT(明細非空鍵)。"
    mcq:
      options:
        - "COUNT(*)"
        - "COUNT(日曆日期)"
        - "COUNT(明細非空鍵)"
        - "先 WHERE 明細有值"
      answer: 2
      explain: "前兩個會數左連接保留列；WHERE 會把空日期刪除。"
  - id: "sql-fill-window"
    prompt: "缺日未補時，包含前 2 列的窗口等於 3 個日曆日嗎？"
    answer: "不等於；它可能跨過沒出現在結果的日期。"
practice:
  - id: "sq-pattern-10-p1"
    kind: "sql"
    category: [time, distinct]
    title: "補齊六天的日活躍"
    minutes: 7
    level: 2
    dataset: "logins"
    prompt: "從 2026-02-18 到 2026-02-23（含首尾），按 `login_at` 的本地日計不同用戶數；沒有紀錄的日子算 0。輸出 `d`、`active_users`，依 `d` 升序。"
    solution: |-
      WITH calendar AS (
        SELECT CAST(day_value AS DATE) AS d
        FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
      ), daily AS (
        SELECT CAST(login_at AS DATE) AS d, COUNT(DISTINCT user_id) AS active_users
        FROM login_log GROUP BY d
      )
      SELECT c.d, COALESCE(a.active_users, 0) AS active_users
      FROM calendar c LEFT JOIN daily a ON c.d = a.d ORDER BY c.d;
    explain: "骨架是左表。2/20 原本沒有事件，單用 COALESCE 不會產生這日；同日多登仍只算一人。"
    hints:
      - "用 generate_series 建 6 個日期。"
      - "先把原表聚成每天一列才連。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-fill-spine"
      - "sql-fill-count"
      - "sql-streak-day"
    tags:
      - "缺日補零"
      - "去重"
  - id: "sq-pattern-10-p2"
    kind: "sql"
    category: [time, window]
    title: "補日後算三天移動平均"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "面試追問：沿用 2/18 到 2/23 的六天日活躍口徑，加上截至當日最近 3 個報表日的平均（首兩列不足 3 天，除以目前已有天數；無活動的日算 0）。輸出 `d`、`active_users`、`avg_3d`，依 `d` 升序。"
    solution: |-
      WITH filled AS (
      WITH calendar AS (
        SELECT CAST(day_value AS DATE) AS d
        FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
      ), daily AS (
        SELECT CAST(login_at AS DATE) AS d, COUNT(DISTINCT user_id) AS active_users
        FROM login_log GROUP BY d
      )
      SELECT c.d, COALESCE(a.active_users, 0) AS active_users
      FROM calendar c LEFT JOIN daily a ON c.d = a.d ORDER BY c.d
      )
      SELECT d, active_users,
             AVG(active_users) OVER (ORDER BY d ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS avg_3d
      FROM filled ORDER BY d;
    explain: "補零後的每日表恰好一日一列，窗口中的 3 列才代表 3 天。AVG 會忽略 NULL，已知無活動應先改成 0 才平均。"
    hints:
      - "以補齊結果作為一個新的 CTE。"
      - "窗口框從前 2 列到當前列。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-fill-spine"
      - "sql-fill-window"
      - "sq-window-08-calendar"
      - "sql-streak-day"
    tags:
      - "缺日補零"
      - "窗口平均"
---

## 先問是零還是沒看到

主管看到折線從 2/19 跳到 2/21，以為 2/20 的數據丟了。實際上這份練習數據在 2/20 沒有登入紀錄，報表要顯示 0。真正上線時還得查來源是否完整：沒有活動是可交付的 0，管道沒跑完則是未知，不能補成 0 讓報表看起來正常。**先定義哪些日期應該有一列，再處理該列的值。**

### 日期骨架（date spine）

在 [自由練習](#/sql?tab=free) 選 `logins`。用 `generate_series(起日, 迄日, INTERVAL '1 day')` 建逐日序列，包含能走到的末日。這個版本產生時間戳（timestamp），所以轉回 `DATE` 作連接鍵。如下先點出六日，確認 2/20 存在，不依賴登入明細來決定要列哪些日期。

```sql
WITH calendar AS (
  SELECT CAST(day_value AS DATE) AS d
  FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
)
SELECT d FROM calendar ORDER BY d;
```

先按日計不重複用戶，然後將骨架左連接到聚合結果。無活動日期的右表值是 NULL；`COALESCE(a.active_users, 0)` 表示優先取已知人數，沒有才取 0。骨架每個日期一列，日活表最多也只有一列，不會把時間軸倍增。

```sql
WITH calendar AS (
  SELECT CAST(day_value AS DATE) AS d
  FROM generate_series(DATE '2026-02-18', DATE '2026-02-23', INTERVAL '1 day') t(day_value)
), daily AS (
  SELECT CAST(login_at AS DATE) AS d, COUNT(DISTINCT user_id) AS active_users
  FROM login_log GROUP BY d
)
SELECT c.d, COALESCE(a.active_users, 0) AS active_users
FROM calendar c LEFT JOIN daily a ON c.d = a.d ORDER BY c.d;
```

想做 3 天移動平均，可以在補齊後的數據表使用窗口框（window frame）`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`。若缺日沒補，前 2 列可能跨超過 2 天；如果保留 NULL，`AVG` 跳過它，效果等於不把該日放入分母。報表最前面不足 3 天時，也要先定義是只除現有天數、延長取數區間，還是不交付平均值。這堂練習選第一種，不暗中多取開始日之前的紀錄。

**方言。** MySQL 可用 `WITH RECURSIVE` 或日期維度產生日期，不直接搬 `generate_series`。Spark SQL 可用 `sequence` 產生陣列並用 `explode` 把每個日期展成列。正式報表若有工作日、假日，日期維度可同時保留這些業務屬性。

### 用三天小樣本確認分母

想像週一有 6 位、週二確認沒有活動、週三有 3 位。週三的三日平均是 3，不是 4.5：分母包含週二。假如週二數據未到齊，先別照這個計算。可以交付週二為未知，並暫不公布涵蓋它的三日平均；也可交付只平均已知日的數字，但欄名須說它不是完整三日平均。看折線是中斷還是落到零以前，先確定報表要表達哪一件事。

驗收整張表時，第一步數日曆本身的列數，第二步看連接後是否還是同樣多列，第三步核對某個有活動的日期沒有因 JOIN 被數了兩次。若同時分來源管道，骨架要變成「日期 × 預期管道」，然後每組各自算平均，不能一日多列卻仍用全表前三列當三天。可以先從一個管道做起，用三天手算驗證，再延伸到多管道。

如果營運要求報表頭兩天也是真正的三日平均，須多取開始日之前至少 2 天；先在較長區間計算窗口，再篩掉不交付的日期。這與當前練習只平均已出現日期的規則不同，不應在同一欄混在一起。

## 常見錯誤

- 整天直接消失 → 沒有建立那一列 → 從日曆骨架開始。
- 空日期被算成 1 → 對左連接空結果 `COUNT(*)` → 先聚合，或數明細鍵。
- 骨架右側條件把空日刪掉 → 過濾寫在外層 WHERE → 先在明細 CTE 篩選。
