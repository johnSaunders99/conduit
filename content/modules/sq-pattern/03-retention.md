---
id: sq-pattern-03
module: sq-pattern
order: 3
title: 留存率
subtitle: 先固定分母是哪批新客
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-02
objectives:
  - "用首次登入固定同批分母"
  - "左連接精確第 N 天的用戶日並計算比例"
  - "從結果排除還沒到第 N 天的同期群"
tags:
  - "留存"
  - "同期群"
  - "去重"
resources:
  - title: "DuckDB：Aggregate Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/aggregates"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "比較 COUNT(*) 與 COUNT(欄位) 的用法。"
  - title: "MySQL：Arithmetic Operators"
    url: "https://dev.mysql.com/doc/refman/8.4/en/arithmetic-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "確認普通除法與整數除法的差別。"
concepts:
  - id: "sql-retain-denominator"
    prompt: "3 個新用戶只有 1 人隔天登入，分母是多少？"
    answer: "3；沒回來的人仍屬原同期群。"
    mcq:
      options:
        - "1"
        - "2"
        - "3"
        - "隔天的全站活躍人數"
      answer: 2
      explain: "1 是分子；隔天全站活躍包含其他同期群。"
    interview:
      question: "怎樣證明沒回訪的人沒有被丟掉？"
      answer: "我從每人首日建立名冊再左連接其精確第 1 天的登入日。找一位首日後就不回來的人：分母加一，分子應不變。"
      points:
        - "先定首次日口徑"
        - "保留全部入組者"
        - "測試沒回訪的用戶"
  - id: "sql-retain-numerator"
    prompt: "右側已按用戶日去重，哪個計數只數有回訪者？"
    answer: "COUNT(右表.user_id)，沒有匹配的 NULL 不數。"
    mcq:
      options:
        - "COUNT(*)"
        - "COUNT(左表.user_id)"
        - "SUM(左表.user_id)"
        - "COUNT(右表.user_id)"
      answer: 3
      explain: "左表仍保留全體，不宜當分子；加總編號沒有意義。"
  - id: "sql-retain-maturity"
    prompt: "觀測截至 3/1（含），能列出 2/28 首次登入者的第 7 天留存嗎？"
    answer: "不能；該日未觀測，不應當成 0。"
    mcq:
      options:
        - "不能，先不交付這一格"
        - "可以，填 0"
        - "可以，分母設 0"
        - "可以，只要有人隔天回來"
      answer: 0
      explain: "未到的日期不是零回訪；次日也不等於第 7 天。"
practice:
  - id: "sq-pattern-03-p1"
    kind: "sql"
    category: [retention]
    title: "按首次日算次日留存"
    minutes: 7
    level: 2
    dataset: "logins"
    prompt: "按 `login_at` 的本地日期找首次登入日。觀測截至 2026-03-01（含），只列次日可觀測的首日，沒有回訪也保留。當日多次登入只算一人。輸出 `cohort_day`、`cohort_users`、`retained_users`、`retention_rate`（0 到 1），依 `cohort_day` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), firsts AS (
        SELECT user_id, MIN(d) AS cohort_day FROM days GROUP BY user_id
      )
      SELECT f.cohort_day, COUNT(*) AS cohort_users, COUNT(d.user_id) AS retained_users,
             1.0 * COUNT(d.user_id) / COUNT(*) AS retention_rate
      FROM firsts f LEFT JOIN days d ON d.user_id = f.user_id AND d.d = f.cohort_day + 1
      WHERE f.cohort_day + 1 <= DATE '2026-03-01'
      GROUP BY f.cohort_day ORDER BY f.cohort_day;
    explain: "先用全表求最早登入，再限制首日。回訪條件寫在 ON，才不會把沒回訪的人濾掉。"
    hints:
      - "先建每個用戶只有一列的首日名單。"
      - "右側只配首日加 1；數右表欄位算分子。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-retain-denominator"
      - "sql-retain-numerator"
      - "sq-join-08-on"
      - "sql-streak-day"
    tags:
      - "留存"
      - "同期群"
  - id: "sq-pattern-03-p2"
    kind: "sql"
    category: [retention]
    title: "觀測期內的第七天留存"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "面試追問：按 `login_at` 回算到 2026-01-10 日結，不限制接收時間。只列首日加 7 天在期限內的同期群；只算精確第 7 天回訪，不是 7 天內任一天。輸出 `cohort_day`、`cohort_users`、`retained_users`、`retention_rate`（0 到 1），依 `cohort_day` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), firsts AS (
        SELECT user_id, MIN(d) AS cohort_day FROM days GROUP BY user_id
      )
      SELECT f.cohort_day, COUNT(*) AS cohort_users, COUNT(d.user_id) AS retained_users,
             1.0 * COUNT(d.user_id) / COUNT(*) AS retention_rate
      FROM firsts f LEFT JOIN days d ON d.user_id = f.user_id AND d.d = f.cohort_day + 7
      WHERE f.cohort_day + 7 <= DATE '2026-01-10'
      GROUP BY f.cohort_day ORDER BY f.cohort_day;
    explain: "只有首日不晚於 1/3 才能入表；第 1 到 6 天出現不能替代第 7 天。若要重建當時看到的報表，還要另約接收截點。"
    hints:
      - "找首次日要從數據集開頭算。"
      - "讓首日加 7 和日結日期比較。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-retain-denominator"
      - "sql-retain-numerator"
      - "sq-join-08-on"
      - "sql-retain-maturity"
      - "sql-streak-day"
    tags:
      - "留存"
      - "觀測窗"
---

## 同一批人，分開數兩次

產品同事問「昨天來的人有多少今天還在？」先把「來的人」改成能重算的定義。這裡的新用戶是**數據集觀測期內第一次登入的人**，不是第一次註冊或有史以來第一次使用服務的人；回來是首日之後剛好第 1 天有登入，不是首日後 24 小時內。以同一首日入組的人叫同期群（cohort，也稱隊列或同類群組）。同群的回訪人數除以初始人數，就是這裡的留存率（retention rate）。

首日有甲、乙、丙 3 人，次日甲登入兩次、丙登入一次，乙沒來。分子 2、分母 3；登入筆數 3 不是分子，隔天新來的丁也不能進到這個分母。把乙留在名單是驗算關鍵。跨多個月份時同理，之後在[〈隊列與留存矩陣〉](#/lesson/sq-time-03)會分開處理每個月的觀測資格。

## 建兩張小表，再連起來

在 [自由練習](#/sql?tab=free) 選 `logins`。第一層 `days` 用 `DISTINCT` 保證每天每人一列；第二層 `firsts` 用 `MIN(d)` 找各人的第一天。先看名冊，不急著算比例。如果同一用戶出現兩列，後面分子和分母都可能被放大。

```sql
WITH days AS (
  SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
), firsts AS (
  SELECT user_id, MIN(d) AS cohort_day FROM days GROUP BY user_id
)
SELECT user_id, cohort_day FROM firsts ORDER BY cohort_day, user_id;
```

用 `LEFT JOIN` 配回用戶日表，只配同一人且日期恰好為首日加 1。未配到的那列仍有左側用戶，右側是缺值（NULL）。所以 `COUNT(*)` 是全體，`COUNT(d.user_id)` 是有回訪的子集，最後用小數除法得到比例。觀測截至 3/1，首日加 1 必須已在其中；沒觀測到的分組不應顯示為 0。

```sql
WITH days AS (
  SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
), firsts AS (
  SELECT user_id, MIN(d) AS cohort_day FROM days GROUP BY user_id
)
SELECT f.cohort_day, COUNT(*) AS cohort_users, COUNT(d.user_id) AS retained_users,
       1.0 * COUNT(d.user_id) / COUNT(*) AS retention_rate
FROM firsts f LEFT JOIN days d ON d.user_id = f.user_id AND d.d = f.cohort_day + 1
WHERE f.cohort_day + 1 <= DATE '2026-03-01'
GROUP BY f.cohort_day ORDER BY f.cohort_day;
```

驗算時挑一批，用名冊數分母，再翻用戶日核對分子；僅檢查比例小於一還不夠，比例可能在兩邊同時被放大時碰巧對。若換第 7 天，分子的日期與觀測資格都要改。若上線後允許數據晚到，要先約好是以完整事件重新計算，還是保留日結時的畫面；這兩張報表不必相等。不要用替換日期欄位的方式把這個差異遮掉。

**方言。** Hive SQL／Spark SQL 用 `date_add` 加天，MySQL 用 `DATE_ADD(d, INTERVAL 1 DAY)`。比例保留小數，MySQL／Spark SQL 不要把 `/` 換成 `DIV`，DuckDB 不用整數除法 `//`。

### 把分母當成一張可核對的表

試著把名冊單獨保存為查詢草稿：首日 1/1 的那一群與首日 1/2 的那一群應互斥。若用同一份日期範圍求第 1 天及第 7 天留存，比較時先挑兩者都已觀測的首日；同一個首日的分母不應隨回訪規則改變。若它變了，問題通常在名冊來源或過濾次序，而不是除法。

報表需求也可能是「第 1 天到第 7 天之間，有一天回來就算」，這是期間回訪率，不是第 7 天留存。那個版本的右表可一次匹配多個日期，需要先壓回一人一列，否則一個人會貢獻多個回訪。想像甲在第 2、4 天回來，兩者在期間版本只算一人，在精確第 7 天版本則是零。先寫出這兩份答案，再決定查詢要比日期等值還是範圍。

## 常見錯誤

- 每批都是 100% → 用了內連接或分子也數全部列 → 左連接並數右側欄位。
- 首次日變晚 → 先切日期再找最早登入 → 先從全觀測範圍求首日。
- 最新一批是 0 → 當成已觀測而沒回來 → 檢查首日加 N 是否已到。
