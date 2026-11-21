---
id: sq-time-04
module: sq-time
order: 4
title: 同期與環比
subtitle: 去年閏日和誰比
status: ready
minutes: 30
level: 2
prereqs:
- sq-time-03
objectives:
  - "分別找出上一期間和去年同一期間的日曆鍵"
  - "用原始值和基期分母核對變動率"
  - "為缺基期、零基期與閏日標示不可比較"
tags:
  - "同期"
  - "環比"
  - "同比"
  - "日曆對齊"
resources:
  - title: "DuckDB：Date Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/date"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看月份與年份的時間間隔運算。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "查日期加月時短月份的對齊行為。"
concepts:
  - id: "sql-growth-periods"
    prompt: "今年 2 月的環比與同比基期是？"
    answer: "環比是今年 1 月，同比是去年 2 月。"
    mcq:
      options:
        - "去年 2 月、今年 1 月"
        - "今年 1 月、去年 2 月"
        - "都是今年 1 月"
        - "今年 3 月、去年 1 月"
      answer: 1
      explain: "近一段與同一年的對齊位置是兩個不同問題。"
    interview:
      question: "去年沒 2/29，你會讓它和哪天比？"
      answer: "我會先向報表使用者說不能自然對齊。若決定只比同月同日，就標未對照；若改用月末規則，明示會比 2/28，不能在查詢中默默夾到月末。"
      points:
        - "先定日曆口徑"
        - "說明未對照和月末對齊的後果"
        - "缺值及零基期的比率不可定義"
  - id: "sql-growth-base"
    prompt: "當期 15、基期 10，變動率是多少？"
    answer: "0.5（50%），差額 5 除以基期 10。"
    mcq:
      options:
        - "0.3333"
        - "1.5"
        - "0.5"
        - "5"
      answer: 2
      explain: "除當期會得到不同問題；1.5 是兩值的比，5 是差額。"
  - id: "sql-growth-missing"
    prompt: "基期不存在或基期為 0，比例怎樣交付才不誤導？"
    answer: "比例給 NULL；保留基期欄，讓讀者分清未知與已知為零。"
practice:
  - id: "sq-time-04-p1"
    kind: "sql"
    category: [time, distinct]
    title: "核對兩個完整月份的不重複會員"
    minutes: 6
    level: 2
    dataset: "logins"
    prompt: "只用 2026 年一、二月 `login_at`；一月、二月各計全月不重複登入用戶（不要將日活相加）。輸出 `m`（月首 DATE）、`active_users`，依 `m` 升序。"
    solution: |-
      WITH monthly AS (
        SELECT CAST(DATE_TRUNC('month', login_at) AS DATE) AS m,
               COUNT(DISTINCT user_id) AS users
        FROM login_log
        WHERE login_at >= TIMESTAMP '2026-01-01' AND login_at < TIMESTAMP '2026-03-01'
        GROUP BY m
      )
      SELECT m, users AS active_users FROM monthly ORDER BY m;
    explain: "每月在整組用戶集合去重；3/1 有紀錄但三月不完整，應排除。"
    hints:
      - "以月首為分組鍵。"
      - "一次按月做 COUNT DISTINCT。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-growth-periods"
      - "sql-pivot-grain"
      - "sql-range-bound"
    tags:
      - "日曆對齊"
      - "去重"
  - id: "sq-time-04-p2"
    kind: "sql"
    category: [time, join]
    title: "以日曆鍵找環比和同比"
    minutes: 10
    level: 3
    dataset: "logins"
    prompt: "面試追問：以一、二月完整月份的不重複登入用戶數為報表。用上個曆月、上一年同月計環比與同比 (當期 − 基期) / 基期；只承認同一張完整月表中的基期，缺基期或零基期讓比例為 NULL。輸出 `m`、`active_users`、`prev_month_users`、`prev_year_users`、`mom_rate`、`yoy_rate`，依 `m` 升序。"
    solution: |-
      WITH monthly AS (
        SELECT CAST(DATE_TRUNC('month', login_at) AS DATE) AS m,
               COUNT(DISTINCT user_id) AS users
        FROM login_log
        WHERE login_at >= TIMESTAMP '2026-01-01' AND login_at < TIMESTAMP '2026-03-01'
        GROUP BY m
      )
      SELECT a.m, a.users AS active_users,
             b.users AS prev_month_users, y.users AS prev_year_users,
             1.0 * (a.users - b.users) / NULLIF(b.users, 0) AS mom_rate,
             1.0 * (a.users - y.users) / NULLIF(y.users, 0) AS yoy_rate
      FROM monthly a LEFT JOIN monthly b ON b.m = a.m - INTERVAL '1 month'
      LEFT JOIN monthly y ON y.m = a.m - INTERVAL '1 year'
      ORDER BY a.m;
    explain: "分別用月首減一月和一年配對。LAG(12) 在有缺月的表上不等於去年同月；這裡兩列都不存在去年同期，不應把 NULL 補成 0。"
    hints:
      - "用同一張月表左連接兩次。"
      - "用 NULLIF 讓零基期不參與除法。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-growth-periods"
      - "sql-growth-base"
      - "sql-growth-missing"
      - "sq-expr-08-zero"
      - "sql-range-bound"
    tags:
      - "環比"
      - "同比"
      - "日曆對齊"
---

## 先寫出你在和誰比

主管說二月活躍回升，但同比下滑。環比（period-over-period growth）與緊鄰的上一期比較；同比（year-over-year growth，也稱年增率）比較去年同一期間。若今年 2 月活躍 15 人，1 月 10 人，去年 2 月 20 人，環比是 50%，同比是 −25%。計算式都是「當期減基期，再除以基期」，不同的是分母屬於哪段。遇到沒有基期或基期為 0，比例不可定義，不是 0% 或無限成長。可以照常交付當期人數和基期值，並用缺值欄位解釋比例未提供。

## 先做完整月表，再對齊日曆

在 [自由練習](#/sql?tab=free) 選 `logins`。只看一、二月兩個完整月份。先逐月數不重複會員；再將同一表左連接兩次，一個目標月首減 1 個月，另一個減 1 年。下面會交付 2 列；一月沒有上月基期、兩月都無去年基期。若拿 3/1 唯一一天去和整個二月比，是比較不同長度的觀測窗。

```sql
WITH monthly AS (
  SELECT CAST(DATE_TRUNC('month', login_at) AS DATE) AS m,
         COUNT(DISTINCT user_id) AS users
  FROM login_log
  WHERE login_at >= TIMESTAMP '2026-01-01' AND login_at < TIMESTAMP '2026-03-01'
  GROUP BY m
)
SELECT a.m, a.users AS active_users,
       b.users AS prev_month_users, y.users AS prev_year_users,
       1.0 * (a.users - b.users) / NULLIF(b.users, 0) AS mom_rate,
       1.0 * (a.users - y.users) / NULLIF(y.users, 0) AS yoy_rate
FROM monthly a LEFT JOIN monthly b ON b.m = a.m - INTERVAL '1 month'
LEFT JOIN monthly y ON y.m = a.m - INTERVAL '1 year'
ORDER BY a.m;
```

## 日同比的閏日怎麼辦？

可以定同月同日、同星期幾，或都用各年的月末。沒有天然唯一的答案。用同月同日政策時，2/29 的去年對照不存在。下面自帶數據的小例子會顯示減年後的候選日期，再把日號不一致的候選改為 NULL。換用月末政策才可以讓 2/29 對到 2/28；那會讓兩天都對到同一個基期日，若要做月度合計不能直接把結果相加。

```sql
WITH dates(d) AS (VALUES (DATE '2024-02-28'), (DATE '2024-02-29'), (DATE '2024-03-01')),
shifted AS (SELECT d, CAST(d - INTERVAL '1 year' AS DATE) AS candidate FROM dates)
SELECT d, candidate,
       CASE WHEN EXTRACT(DAY FROM d) = EXTRACT(DAY FROM candidate)
            THEN candidate END AS comparable_day
FROM shifted ORDER BY d;
```

如果只是要報月同比，直接以月首為鍵，月度總數自然包含各月實際擁有的所有日期。若需求是月初至今，應說明截至今天中午還是昨天結束，並讓兩期用等價截點。先將兩個實際日期或區間顯示在驗算表，再交比例，讀者才容易發現對錯窗。

**方言。** MySQL 用 `DATE_SUB(m, INTERVAL 1 MONTH)`；Spark SQL／Hive SQL 可用 `add_months(m, -1)`。若使用 `LAG`，它取上一列，不是日曆上一期；僅當已補完整時間骨架且每期唯一時兩者才等價。

### 讓人區分不知道和確實歸零

取一個假想帳面：本月 5、基期沒有數據，交當期 5、基期 NULL、變動率 NULL；若基期是已確認為 0，交 5、0、NULL。兩例比例同為空，但經營意義不同。另一例是本月確實 0、基期 5，變動率才是 −100%。讓看報表的人能追溯到這兩個原始數，比只交一張百分比表好用。

面試遇到缺月時，可在紙上只留 1 月和 3 月，兩列值都大於零。用上一列會錯把 1 月當 3 月的基期；用日曆鍵配對時，3 月基期欄為 NULL，除非你能證明 2 月完整觀測且確實為零。若確定完整，也應先補清楚月份骨架再比較。這個小反例同時測了「相鄰列不是相鄰月」和「補值改變報表含義」兩個判斷。

## 常見錯誤

- 缺了一個月，環比卻跟前兩月比 → 只取上一列 → 以日曆鍵精確配對。
- 缺對照顯示成 0% → 補零後硬算 → 保留缺值並讓比例為 NULL。
- 兩份同比報表在閏日不同 → 沒寫閏日政策 → 明定配不到或與月末比較。
