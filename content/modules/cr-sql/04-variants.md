---
id: cr-sql-04
module: cr-sql
order: 4
title: 錯題重做與遷移
subtitle: 換個粒度還能解出來
status: ready
minutes: 25
level: 2
prereqs:
- cr-sql-03
objectives:
  - "從錯解找出最先偏離題意的中間層"
  - "把精確次日規則遷移為 3 日內任一天回訪"
  - "驗證新規則下多次回訪仍只計一人"
tags:
  - "錯題重做"
  - "留存"
  - "觀測窗"
  - "遷移"
resources:
  - title: "DuckDB：WITH Clause"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/with"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習分別執行 CTE 的中間結果。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀移動上界所需的日期加法。"
concepts:
  - id: "sql-drill-transfer-change"
    prompt: "改為首日後 3 天內任一天回來，哪一層規則必須改？"
    answer: "匹配從精確單一日期換成範圍，再壓回每用戶一列。"
    mcq:
      options:
        - "只改輸出別名"
        - "把分母改成 3 天活躍"
        - "把 MATCH 從等值換成範圍並去多配"
        - "在最後排序時補回訪日"
      answer: 2
      explain: "範圍可能配到多個用戶日，不能只換條件得到同粒度。"
    interview:
      question: "錯題重做時如何確定你沒有背答案？"
      answer: "我會換一個會影響粒度的條件，例如從第 1 天改成第 1 到 3 天。先寫新反例，然後重新做名冊及匹配，核對兩次回訪仍只算一人，再比較我的舊草稿。"
      points:
        - "用新反例測遷移"
        - "辨認變動的匹配基數"
        - "保留固定分母"
  - id: "sql-drill-transfer-duplicate"
    prompt: "甲在第 1、3 天都登入，第 1 至 3 天內回訪指標要貢獻幾人？"
    answer: "1；當題目的單位仍為入組用戶。"
    mcq:
      options:
        - "0"
        - "1"
        - "2"
        - "3"
      answer: 1
      explain: "兩個用戶日是兩筆匹配，但不是兩個人。"
  - id: "sql-drill-transfer-note"
    prompt: "錯題筆記最有用的短格式是什麼？"
    answer: "觸發錯誤的反例、最先錯的一層、修好後的可驗算不變量。"
practice:
  - id: "cr-sql-04-p1"
    kind: "sql"
    category: [retention]
    title: "交付用戶級的次日回訪旗標"
    minutes: 6
    level: 2
    dataset: "logins"
    prompt: "按 `login_at` 本地日取每人首次登入日，只列 2026-01-05（含）前首次登入的會員。若剛好次日曾登入，旗標為 1，否則 0。輸出 `user_id`、`first_day`、`returned_d1`，依 `first_day`、`user_id` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), firsts AS (
        SELECT user_id, MIN(d) AS first_day FROM days GROUP BY user_id
      )
      SELECT f.user_id, f.first_day, CASE WHEN r.d IS NULL THEN 0 ELSE 1 END AS returned_d1
      FROM firsts f LEFT JOIN days r ON r.user_id = f.user_id AND r.d = f.first_day + 1
      WHERE f.first_day <= DATE '2026-01-05'
      ORDER BY f.first_day, f.user_id;
    explain: "每人每日期去重後，單一目標日最多匹配一個右側；左連接保留沒回訪的人。若把條件改成三天範圍，這個唯一性就失效。"
    hints:
      - "用 exact-date 條件連至次日。"
      - "CASE 把失配列轉成 0。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-transfer-change"
      - "sql-retain-denominator"
      - "sql-streak-day"
    tags:
      - "留存"
      - "錯題重做"
  - id: "cr-sql-04-p2"
    kind: "sql"
    category: [retention]
    title: "改成三天內任一天回訪"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "面試追問：以 `login_at` 回算 2026-01-08 日結，不限制接收時間。每位會員首日後第 1 至 3 天內任一天有登入即為成功，多日回訪只算 1 人。只列完整觀測 3 日的首日組。輸出 `first_day`、`cohort_users`、`returned_users`、`return_rate`（0 到 1），依 `first_day` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), firsts AS (
        SELECT user_id, MIN(d) AS first_day FROM days GROUP BY user_id
      ), outcomes AS (
        SELECT f.user_id, f.first_day, MIN(r.d) AS return_day
        FROM firsts f LEFT JOIN days r ON r.user_id = f.user_id
          AND r.d > f.first_day AND r.d <= f.first_day + 3
        WHERE f.first_day + 3 <= DATE '2026-01-08'
        GROUP BY f.user_id, f.first_day
      )
      SELECT first_day, COUNT(*) AS cohort_users, COUNT(return_day) AS returned_users,
             1.0 * COUNT(return_day) / COUNT(*) AS return_rate
      FROM outcomes GROUP BY first_day ORDER BY first_day;
    explain: "範圍會讓一位用戶配多個回訪日，先用 MIN 取一個見證日期、回到一人一列才聚合。首日當天不算；1/5 之後不完整的組排除。"
    hints:
      - "首次日是嚴格下界；首次日加 3 含入。"
      - "先交一人一列，再交每群一列。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-transfer-change"
      - "sql-drill-transfer-duplicate"
      - "sq-join-07-grain"
      - "sql-retain-denominator"
      - "sql-retain-maturity"
    tags:
      - "留存"
      - "遷移"
      - "觀測窗"
  - id: "cr-sql-04-p3"
    kind: "explain"
    title: "寫下修改口徑後的不變量"
    minutes: 4
    steps:
      - "把兩道題各用一個有第 1、3 天回訪的人驗算。"
      - "在練習筆記只記最先錯的一層、改法，以及下次能重新跑的測試。隔天不看解答再做。"
    checks:
      - "報表觀測截至 1/8，1/5 首次日可入組，1/6 不可。"
      - "同一人兩個回訪日，在三日內分子仍只計一次。"
---

## 不修最後那個數，找第一張錯表

昨天的題是「恰好次日回來」，今天改成「首日後 3 天內有回來」。如果直接把 `r.d = f.first_day + 1` 換成範圍，其餘完全照抄，原本一人一列的中間表就可能變成一人多列。這叫匹配基數（join cardinality）變了：每個左側用戶能對到幾筆右側。練遷移（transfer practice）不是換函式名，而是辨認哪個中間假設已經不成立。

## 先用四列找出錯在哪

甲首日 1/2，接著 1/3 和 1/5 回來；乙也在 1/2 入組但無回訪。這四列裡，次日與三日內都應是 1/2，但改成「第 3 天」時，仍是甲入選。如果把甲的 1/3 改為 1/4，次日變 0/2，三日內仍是 1/2。再把甲的兩個回訪日都配上，原始左連接會有 3 列；若此時數分母，會錯報 3 人。要核對的第一張表是回訪匹配，不是最後小數位。

在 [SQL 練習場](#/sql) 在 **留存與同期群** 分類搜尋「錯題重做」，也可直接打開[次日旗標](#/sql/cr-sql-04-p1)。用 2 分鐘在紙上保證右表每天最多一列，再用 4 分鐘實作。接著用 9 分鐘做[三天內回訪](#/sql/cr-sql-04-p2)。先把範圍內的任何回訪壓回一人一列，留最早回訪日期作為證據；最後才依首日分組。觀測到 1/8，首日為 1/5 已經能看到 3 天，1/6 卻不能。先把這條寫在紙上，確認你沒有為了湊分母把未觀測者算零。

**留下一條明天還能用的錯題筆記。** 舊解錯在「範圍配對仍以為右側唯一」；改法是「用最小符合日期作有無旗標」；測試是「同人回兩天，但名冊列數不變」。備忘一張手算小表比貼完整解法更容易隔天重做。若第二次你只記得 `MIN` 卻無法解釋為何不是 `MAX`，再想想題目是否只問有無；兩者皆可作非空見證，只是指向的日期不同。

**方言。** DuckDB 可用日期加整數；MySQL 要寫 `DATE_ADD(first_day, INTERVAL 3 DAY)`，Hive SQL／Spark SQL 查 `date_add`。分層檢查法不依賴方言。

### 換一個追問，確認自己能遷移

若面試官改成「回來至少兩個不同日」，保留一人一列的方向不變，但不能再只取一個最早日期。你需要對範圍內不重複的日期計數，並把至少兩日轉成成功旗標。用一人同日兩次、另一天沒來的例子，驗證沒有把事件次數當成日期數。若同一批人都沒有達到兩日，分母依然是原班人數，不因新門檻縮水。

下次重做挑一條不同的觀測截止日，先寫哪一批會因此新增或被排除。比較兩次草稿，記下你的第一個檢查動作是否變得更短。若還是要從整組比例猜問題，就先暫停計時，練一遍用每位會員的中間結果找第一個不同。改的是這個習慣，不是逼自己提高打字速度。

## 常見錯誤

- 多位「回訪者」其實是同一人 → 直接數多筆日配對 → 先壓回用戶層。
- 第 0 天也算 → 範圍包含首日 → 下界嚴格大於首日。
- 只記住答案 → 看完沒用新題測 → 換一個期間與反例盲寫。
