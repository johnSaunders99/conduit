---
id: cr-sql-03
module: cr-sql
order: 3
title: 限時留存與漏斗
subtitle: 把分母固定在同一批人
status: ready
minutes: 25
level: 2
prereqs:
- cr-sql-02
objectives:
  - "不看筆記說出留存和會話轉換各自的分母"
  - "用精確日齡驗算第三天回訪"
  - "手寫有總時限的漏斗並核對未轉換入口"
tags:
  - "留存"
  - "漏斗"
  - "分母"
  - "限時手寫"
resources:
  - title: "DuckDB：Aggregate Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/aggregates"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "核對 COUNT(欄位) 忽略 NULL 的行為。"
  - title: "MySQL：Arithmetic Operators"
    url: "https://dev.mysql.com/doc/refman/8.4/en/arithmetic-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "確認一般除法及基期為零的差異。"
concepts:
  - id: "sql-drill-retain-denom"
    prompt: "求第 3 天留存，哪個是分母？"
    answer: "入組首日的全部用戶，沒回來也算。"
    mcq:
      options:
        - "第 3 天所有活躍用戶"
        - "首日且每天都登入的人"
        - "首日入組的全部用戶"
        - "只能數配得上右表的用戶"
      answer: 2
      explain: "口徑不要求每天活躍；左側名冊交付固定分母。"
    interview:
      question: "請不看 SQL 比較留存和漏斗的分母。"
      answer: "留存是首日入組的用戶，分子是同群在第 N 天回來的人。這題漏斗是觀測窗進入的會話，分子是其中依序完成且限時內付款的會話。我會各拿一個只進門沒回來或沒完成的反例。"
      points:
        - "區分用戶和會話"
        - "兩者從入口而非成功列數出發"
        - "說出精確日期與總時限"
  - id: "sql-drill-funnel-cap"
    prompt: "入口到付款限 16 分鐘，哪個界線需要比較？"
    answer: "付款時間不晚於瀏覽時間加 16 分鐘。"
    mcq:
      options:
        - "付款不晚於加購加 16 分鐘"
        - "瀏覽到付款不晚於 16 分鐘"
        - "只量瀏覽到加購"
        - "只比較兩事件日期"
      answer: 1
      explain: "16 分鐘是整條路徑預算，不是每步都能各等 16 分鐘。"
  - id: "sql-drill-denom-zero"
    prompt: "沒有任何人入組，為甚麼比例不該填 0%？"
    answer: "分母為零，比例未定義；0% 僅適用有分母但沒有人成功。"
practice:
  - id: "cr-sql-03-p1"
    kind: "sql"
    category: [retention]
    title: "一月首日隊列的第三天留存"
    minutes: 6
    level: 2
    dataset: "logins"
    prompt: "以整份 `logins` 按用戶的首次 `login_at` 本地日分群，只看首次日為 2026-01-01 者。分子是恰好第 3 天（1/4）登入過的人，不是前三天都登入。輸出唯一一列 `cohort_users`、`returned_users`、`return_rate`，沒有分母則比例 NULL；單列無排序要求。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), cohort AS (
        SELECT user_id FROM days GROUP BY user_id HAVING MIN(d) = DATE '2026-01-01'
      )
      SELECT COUNT(*) AS cohort_users, COUNT(d.user_id) AS returned_users,
             1.0 * COUNT(d.user_id) / NULLIF(COUNT(*), 0) AS return_rate
      FROM cohort c LEFT JOIN days d ON d.user_id = c.user_id AND d.d = DATE '2026-01-04';
    explain: "先建隊列再左連接 1/4 用戶日，分母留沒回來的人。別從 1/4 活躍表反推誰是這群。"
    hints:
      - "按人選首日。"
      - "只對右表連 1/4。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-retain-denom"
      - "sql-drill-denom-zero"
      - "sq-expr-08-zero"
      - "sql-retain-numerator"
      - "sql-streak-day"
    tags:
      - "留存"
      - "分母"
      - "限時手寫"
  - id: "cr-sql-03-p2"
    kind: "sql"
    category: [funnel]
    title: "入口起十六分鐘內的付費轉換"
    minutes: 10
    level: 3
    dataset: "events"
    prompt: "面試追問：排除缺 `session_id`，對 `(event_id,user_id,session_id,step,event_at)` 去重。每個 `(user_id,session_id)` 以首個 view 為入口，只看 2026-02-04 和 2/5 進入的會話。cart 必須嚴格晚於 view，pay 嚴格晚於有效 cart，且不晚於 view 後 16 分鐘（含界線，可跨日）。只列有入口的日期；輸出 `entry_day`（首個 view 的本地日期）、`viewed_sessions`、`paid_sessions`、`conversion_rate`（0 到 1），依 `entry_day` 升序。"
    solution: |-
      WITH clean AS (
        SELECT DISTINCT event_id, user_id, session_id, step, event_at
        FROM app_events WHERE session_id IS NOT NULL
      ), views AS (
        SELECT user_id, session_id, MIN(event_at) AS view_at FROM clean
        WHERE step = 'view' GROUP BY user_id, session_id
      ), carts AS (
        SELECT v.user_id, v.session_id, v.view_at, MIN(c.event_at) AS cart_at
        FROM views v LEFT JOIN clean c ON c.user_id = v.user_id AND c.session_id = v.session_id
         AND c.step = 'cart' AND c.event_at > v.view_at
        WHERE v.view_at >= TIMESTAMP '2026-02-04 00:00:00'
          AND v.view_at < TIMESTAMP '2026-02-06 00:00:00'
        GROUP BY v.user_id, v.session_id, v.view_at
      ), stages AS (
        SELECT c.user_id, c.session_id, c.view_at, MIN(p.event_at) AS pay_at
        FROM carts c LEFT JOIN clean p ON p.user_id = c.user_id AND p.session_id = c.session_id
         AND p.step = 'pay' AND p.event_at > c.cart_at
         AND p.event_at <= c.view_at + INTERVAL '16 minutes'
        GROUP BY c.user_id, c.session_id, c.view_at
      )
      SELECT CAST(view_at AS DATE) AS entry_day, COUNT(*) AS viewed_sessions,
             COUNT(pay_at) AS paid_sessions, 1.0 * COUNT(pay_at) / COUNT(*) AS conversion_rate
      FROM stages GROUP BY entry_day ORDER BY entry_day;
    explain: "每階段先壓回會話一列；16 分鐘從入口算，恰好 16 分鐘的完整路徑計入。若先篩成功後用 COUNT(*) 當分母，會虛報 100%。"
    hints:
      - "先算所有入口，再在 ON 限制路徑順序。"
      - "付款的上界是 view_at 加 16 分鐘。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-funnel-cap"
      - "sql-drill-denom-zero"
      - "sq-expr-08-zero"
      - "sql-funnel-order"
      - "sql-funnel-key"
    tags:
      - "漏斗"
      - "分母"
      - "限時手寫"
  - id: "cr-sql-03-p3"
    kind: "explain"
    title: "錄在筆記裡的四句口述"
    minutes: 4
    steps:
      - "兩題各用 45 秒說分子、分母、邊界與一個反例。"
      - "在練習筆記抄下留存分母與其中一日的漏斗分母，旁邊註明日期與單位。"
    checks:
      - "能以未回訪用戶解釋留存分母。"
      - "能以未付款會話解釋漏斗分母，並說出 16 分鐘是從哪裡起算。"
---

## 用一句話固定分母

「留存率」與「轉換率」都像是把兩個數相除，但入場券不同。留存的分母是首次日入組的會員；這輪看 1/1 的群，第 3 天要在 1/4 登入才算。漏斗的分母是首次瀏覽落入報表窗的有效會話；同一會員有兩次會話就可貢獻 2 個入口。用 45 秒口述時，先說「一列是一人」或「一列是一個會話」，再說什麼情況讓這一列進入分子。

## 先算紙上的反例，再按碼表

留存：甲、乙同在 1/1 首次登入；甲 1/4 登兩次，乙只在 1/3 回來。答案 1/2，不是 2/2。若乙再於 1/4 登入，分子增一，分母不動。這也說明右表要去重。用 6 分鐘做[第三天留存](#/sql/cr-sql-03-p1)：前 2 分鐘只記下首日、回訪日與預期，剩下 4 分鐘寫名冊、左連接和比例。

漏斗：一個會話在 23:55 瀏覽、00:03 加購、00:11 付款，從入口到付款恰是 16 分鐘，若界線含入就通過。若改為 00:12 付款，還在相同會話卻不通過；另一個只有瀏覽和付款，中間跳步也不通過。用 10 分鐘做[限時付費轉換](#/sql/cr-sql-03-p2)：前 3 分鐘寫下各層鍵與界線，之後從左側入口逐層配對。若還有 1 分鐘，檢查在午夜之後的結果有沒有被報表入口窗錯濾掉。

到 [SQL 練習場](#/sql) 以「分類」選 **留存與同期群** 或 **轉換漏斗**；也能搜尋「分母」。先跑自己的中間名單再核對最終答案；每次把分子、分母和比例都交出來，評閱者不必反推。留存練習即使沒有分母也會交一列，讓空窗不是毫無訊息；漏斗有入口但無人付費，才是 0%。

**方言。** MySQL 的分鐘界線可用 `DATE_ADD(view_at, INTERVAL 16 MINUTE)`。若對方要求 Hive SQL 或 Spark SQL，先說明用 `CASE` 或只數有效階段欄位；別把比率寫成整數除法 `DIV`。

### 先展示一個會掉進分母的反例

把留存例子的乙從名冊拿走，比例會變 1/1；這是用成功者反推分母才會出現的假象。漏斗同理，若只看付款配得到的列，入口全部看似成功。你可以在草稿上保留左連接中沒有配對的那一列，指著它說「雖未進入分子，仍留在分母」。這比只把查詢投影成單一比率更能看出你的定義。

答辯前再問自己兩件事：剛好在界線是否算、數據尚未到齊是否仍交付？這一輪 16 分鐘含界線，精確日齡則只認那一日；真實報表仍需要保證已看到結尾。若只知道入口出現的日期，卻不知道付款紀錄已完整到哪天，先說仍需來源截止資訊，不把未觀測當作從未發生。把這兩種界線寫成短句，重練時先念出來再寫查詢。

## 常見錯誤

- 檢查通過卻解釋成「所有顧客」 → 混淆會員與會話 → 說明每列與分母的單位。
- 有分子沒對分母 → 用成功事件當起點 → 先寫入口名冊。
- 每一段各給 16 分鐘 → 把路徑總時限拆成兩段 → 付款直接與瀏覽時限比較。
