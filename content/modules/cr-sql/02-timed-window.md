---
id: cr-sql-02
module: cr-sql
order: 2
title: 限時窗口題
subtitle: 不看模板完成一次連續登入
status: ready
minutes: 25
level: 2
prereqs:
- cr-sql-01
objectives:
  - "限時盲寫用戶日、前日與分段旗標的三層查詢"
  - "寫出至少 3 日的連續登入段"
  - "說清截窗會如何改變跨月段的長度"
tags:
  - "連續登入"
  - "窗口函式"
  - "限時手寫"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習 LAG 與使用明確窗口框的累計。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "看方言對 DATE_ADD 與 DATEDIFF 的寫法。"
concepts:
  - id: "sql-drill-window-first"
    prompt: "連續登入限時題，先寫哪一層最能避免排到重複日期？"
    answer: "先寫用戶日去重，再排窗口。"
    mcq:
      options:
        - "直接累計原始登入明細"
        - "先取 MAX 段長"
        - "先做用戶日去重"
        - "把月加進窗口分區"
      answer: 2
      explain: "排序後去重可能太晚；按月分區會剪開跨月的真實連續。"
    interview:
      question: "題目限制查五天，窗外的登入要不要影響段長？"
      answer: "我會先問是量窗內的段，還是只列碰到這五天的歷史整段。若前者，就先切出日期再做用戶日和分段；後者要先建全歷史段再選重疊。"
      points:
        - "說明篩選與視窗先後"
        - "用跨邊界樣本驗證"
        - "保留同日去重"
  - id: "sql-drill-window-gap"
    prompt: "序列 1/30、1/31、2/2，三列開頭旗標依序為何？"
    answer: "1、0、1；2/1 缺席而斷開。"
    mcq:
      options:
        - "1、0、1"
        - "0、0、1"
        - "1、1、0"
        - "1、0、0"
      answer: 0
      explain: "首列是開頭，差一天延續，差兩天斷開。"
  - id: "sql-drill-window-rescue"
    prompt: "時間不足寫完時，哪個中間結果最適合留下？"
    answer: "寫有用戶、日期、上一日及開頭旗標的結果，讓對方能核對分段邏輯。"
practice:
  - id: "cr-sql-02-p1"
    kind: "sql"
    category: [streak, window]
    title: "跨月窗口的登入起段旗標"
    minutes: 6
    level: 2
    dataset: "logins"
    prompt: "只看 `login_at` 本地日 2026-01-30 到 2026-02-03（含首尾）；先去重成用戶日。對每個人依日升序，輸出 `user_id`、`d`、`prev_day`（窗內前個登入日，首列為 NULL）、`starts_run`（首列或非隔日為 1，其餘 0），依 `user_id`、`d` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d
        FROM login_log WHERE login_at >= TIMESTAMP '2026-01-30 00:00:00'
                        AND login_at < TIMESTAMP '2026-02-04 00:00:00'
      ), ordered AS (
        SELECT user_id, d, LAG(d) OVER (PARTITION BY user_id ORDER BY d) AS prev_day FROM days
      ), flags AS (
        SELECT *, CASE WHEN d = prev_day + 1 THEN 0 ELSE 1 END AS starts_run
        FROM ordered
      )
      SELECT user_id,d,prev_day,starts_run FROM flags ORDER BY user_id,d;
    explain: "依完整日期而非日號查相隔。2/1 之前的一天是 1/31，不因月份不同重開。"
    hints:
      - "同人同日一列之後才用 LAG。"
      - "用 CASE 判相隔 1 日；不成立則是開頭。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-window-first"
      - "sql-drill-window-gap"
      - "sq-window-05-gap"
      - "sql-streak-day"
    tags:
      - "窗口函式"
      - "連續登入"
  - id: "cr-sql-02-p2"
    kind: "sql"
    category: [streak, window]
    title: "保留至少三天的窗內連續段"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "以 2026-01-30 到 2026-02-03（含首尾）的登入日計窗內連續段，無視窗外登入。每人每天只算一次。每段至少連續登入 3 天才入選。輸出 `user_id`、`start_day`、`end_day`、`streak_days`，依 `user_id`、`start_day` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d
        FROM login_log WHERE login_at >= TIMESTAMP '2026-01-30 00:00:00'
                        AND login_at < TIMESTAMP '2026-02-04 00:00:00'
      ), ordered AS (
        SELECT user_id, d, LAG(d) OVER (PARTITION BY user_id ORDER BY d) AS prev_day FROM days
      ), flags AS (
        SELECT *, CASE WHEN d = prev_day + 1 THEN 0 ELSE 1 END AS starts_run
        FROM ordered
      ), numbered AS (
        SELECT *, SUM(starts_run) OVER (PARTITION BY user_id ORDER BY d ROWS UNBOUNDED PRECEDING) AS run_no
        FROM flags
      )
      SELECT user_id, MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*) AS streak_days
      FROM numbered GROUP BY user_id, run_no HAVING COUNT(*) >= 3
      ORDER BY user_id, start_day;
    explain: "先截窗再求段，段長就是去重後列數。限制至少 3 天要在段級做 HAVING，而不是刪原始事件。"
    hints:
      - "將 starts_run 累加取得 run_no。"
      - "GROUP BY 用戶與段號，才檢查段長。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-window-first"
      - "sql-drill-window-gap"
      - "sq-window-05-gap"
      - "sql-drill-window-rescue"
      - "sql-session-running"
      - "sql-streak-day"
    tags:
      - "連續登入"
      - "窗口累計"
      - "限時手寫"
  - id: "cr-sql-02-p3"
    kind: "explain"
    title: "記錄一次九分鐘手寫"
    minutes: 3
    steps:
      - "先用紙寫第二題，計時從讀題開始，9 分鐘前不開解答。"
      - "把草稿貼入核對。練習筆記記下實耗時間、錯在哪一層、下一次先查哪一列。"
      - "用 45 秒說明先截窗與先找歷史段的差別。"
    checks:
      - "留下一個跨月或重複登入的反例。"
      - "口述中能指出在哪一層去重及為何。"
---

## 計時練的是拆題，不是背窗口

請先關起[〈連續登入〉](#/lesson/sq-pattern-02)的解法。面試若遇到兩張登入表，背一條日期減序號也不一定能用；先問「同一天算幾次、跨月是否算連續、只計窗內還是包括窗外？」本輪只計窗內：開始日前的行為不影響開頭，結束日後的行為也不能替段湊到 3 天。這和「找碰到窗口的完整歷史段」是不同題目。用一位在第一天前已連登兩天的人當反例，確認你的問法真的會改變答案。

## 九分鐘寫完一段可檢查的結果

- **第 0–2 分鐘：畫三列。** 寫 1/30、1/31、2/2 和會影響去重的一筆重複 1/31。期望用戶日剩 3 列，段的旗標依序是 1、0、1。再補 2/1 看最後一段是否接回。
- **第 2–5 分鐘：交中間結果。** 去重後，以用戶分區和日期排序，寫 `LAG` 取上一個登入日。第一次及不相鄰的日子標 1，其餘 0。
- **第 5–9 分鐘：交付段。** 把開頭旗標累加成段號，再用用戶及段號分組，算起迄及天數。剩 1 分鐘時先補好測試列的預期，別為美化欄名改動整段查詢。

在 [SQL 練習場](#/sql) 以「分類」選 **連續問題** 找題；第一次先做[起段旗標](#/sql/cr-sql-02-p1)，第二次手寫[窗內連續段](#/sql/cr-sql-02-p2)。跑完草稿再按「檢查答案」。若時間到了還差最後一層，先交用戶日、上一日與旗標。面試官能確認你哪裡正確，你也能看出缺的是收尾還是基本口徑。不要把未執行的推導說成已驗證的結果。

**口述句型。**「這一層每列是用戶日。我先去重，才知道窗口左邊真的是上一個登入日。我只按用戶重啟窗口，所以跨月不會斷。」再補一句：「我測了重複日與缺一天，還沒測窗外延伸。」這種說法交代可核對的證據，不會讓人誤以為你的樣本涵蓋所有分支。

**方言。** DuckDB 的日相加用整數，Hive SQL／Spark SQL 用 `date_add(prev_day, 1)`，MySQL 用 `DATE_ADD(prev_day, INTERVAL 1 DAY)`。如果面試沒指定，先說你採用哪一種。

### 學會從第一個不對的數字復盤

貼進編輯器後，若結論筆數不同，不要先調最後的 `HAVING`。從用戶日開始跟那三列比對：日期對但前一日錯，問題在窗口的分區或排序；前一日對但旗標錯，才查日期差與首列；旗標對但段數錯，查累計窗口與段的分組鍵。這套順序花不到幾分鐘，也能讓你在對方追問時交代第一個出錯的位置。

隔天不看昨天的草稿，把同一窗口改成「相隔兩天仍算同段」再試一次。此時段的列數是活躍日數，起迄日差加一則是經過的日數，兩者可能不同。先問要哪個長度，再決定用哪個算式。若口頭仍把兩種說成一樣，先重做三列的小樣本，不急著再刷一題。

## 常見錯誤

- 同日兩次使旗標斷開 → 對事件排窗口 → 先整理用戶日。
- 跨月總斷開 → 加了月份分區 → 日期本身已含月，不要用月當段。
- 改了範圍卻保留窗外段長 → 混淆截窗與歷史段 → 先確認計算順序。
