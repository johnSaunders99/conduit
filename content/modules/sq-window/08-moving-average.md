---
id: sq-window-08
module: sq-window
order: 8
title: 移動平均
subtitle: 七列平均未必是七日平均
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-07
objectives:
- 寫出最近三個有數據日的平均
- 用日期值域選取近七天
- 說明缺日略過與補零對分母的影響
tags:
- moving-average
- rows
- range
- 缺日
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 ROWS 與 RANGE 的移動聚合範例。
- title: MySQL：窗口框
  url: https://dev.mysql.com/doc/refman/8.4/en/window-functions-frames.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀日期排序的 INTERVAL 框寫法。
concepts:
- id: sq-window-08-row-average
  prompt: 日報最近 3 個有紀錄的日量平均，當日要算進去，怎麼寫框？
  answer: 一日一列後，用 ROWS BETWEEN 2 PRECEDING AND CURRENT ROW。
  mcq:
    options:
    - ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    - ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
    - RANGE 到目前日，不限起點
    - ROWS BETWEEN CURRENT ROW AND 2 FOLLOWING
    answer: 0
    explain: 2 列在前加當日共 3 列；歷史不足時只算已有列。
- id: sq-window-08-calendar
  prompt: 有缺日的登入表，7 筆日量是否就是最近 7 個日曆天？
  answer: 不是。7 筆日量數的是有數據的 7 列，中間可能跳日。
  mcq:
    options:
    - 不是，ROWS 會自動剔除同月值
    - 不是，缺日可能讓它跨度更長
    - 是，只要按日期升序
    - 是，窗口自動補零
    answer: 1
    explain: 日曆跨度由日期值域或完整日曆表定義，不由列的個數定義。
  interview:
    question: 「七日平均」沒說缺日怎麼算，怎麼確認？
    points:
    - 問缺值還是零
    - 說明近七日的界線
    - 按口徑決定分母
    answer: 我會先問沒紀錄是營業量零，還是數據還沒到。零要先補出日曆日；缺測先略過並標實際天數，不能默認都用七當分母。
- id: sq-window-08-denominator
  prompt: 值域內只有 2 天有日量，若沒有補零，AVG 的分母是 7 嗎？
  answer: 不是。AVG 只數框內非 NULL 的數值；此例分母是 2。
  mcq:
    options:
    - 不是，分母是 1
    - 是，AVG 會補缺日為零
    - 不是，分母是 2
    - 是，只要 RANGE 寬為 7 日
    answer: 2
    explain: 窗口不造列，沒出現的日子不算作 0；若要納入須先補日再填零。
practice:
- kind: sql
  category: [window, time]
  title: 日付款量的三個有數據日平均
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    對有已付款單的日期計算每日付款張數 `daily_paid`，輸出目前列加前兩個已出現日期的平均 `avg_last_3_rows`。表首不足三天按現有日量平均，不補缺日。

    只輸出以下欄位，欄序固定：`day`、`daily_paid`、`avg_last_3_rows`。

    排序：`day` 升序。
  solution: |
    WITH daily AS (
      SELECT order_date AS day, COUNT(*) AS daily_paid
      FROM orders WHERE status = 'paid' GROUP BY order_date
    )
    SELECT day, daily_paid,
           AVG(daily_paid) OVER (ORDER BY day
             ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS avg_last_3_rows
    FROM daily ORDER BY day;
  explain: |
    首日為 1，次日為 (1+2)/2，不需要除以固定 3。若把框寫成 3 PRECEDING，就會把最長窗口擴成 4 列。
  hints:
  - 先算一日一列的付款量。
  - 既然算今天，還要幾列歷史湊成 3 列？
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-08-row-average
  - sq-window-08-denominator
  - sq-window-06-daily
  tags:
  - 移動平均
  - rows
  id: sq-window-08-p1
- kind: sql
  category: [window, time]
  title: 每位會員的近七日有數據日平均
  minutes: 10
  level: 3
  dataset: logins
  prompt: |
    依會員和 login_at 日曆日聚合登入次數 `daily_logins`（同日多次要算）。對每位會員的每個出現日期，計算當日及往前 6 個日曆日內、有登入的日期之平均日量 `avg_active_days`，另輸出實際參與平均的天數 `days_used`。不補缺日。

    只輸出以下欄位，欄序固定：`user_id`、`day`、`daily_logins`、`avg_active_days`、`days_used`。

    排序：`user_id` 升序，同人按 `day` 升序。
  solution: |
    WITH daily AS (
      SELECT user_id, CAST(login_at AS DATE) AS day, COUNT(*) AS daily_logins
      FROM login_log GROUP BY user_id, CAST(login_at AS DATE)
    )
    SELECT user_id, day, daily_logins,
           AVG(daily_logins) OVER (
             PARTITION BY user_id ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
           ) AS avg_active_days,
           COUNT(*) OVER (
             PARTITION BY user_id ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
           ) AS days_used
    FROM daily ORDER BY user_id, day;
  explain: |
    會員 4 在 1 月 5 日往回框內有 1 月 2 日的 2 次和 1 月 5 日的 1 次，平均 1.5、分母 2。用前 6 列代替 6 天，在後續稀疏紀錄會納入太舊的日期。
  hints:
  - 每位會員每天先聚成一列，然後按會員分區。
  - 用日期做 RANGE 的唯一排序鍵。
  - 用相同框計算平均與分母。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-08-calendar
  - sq-window-08-denominator
  - sq-window-07-range
  tags:
  - 移動平均
  - range
  - 登入
  id: sq-window-08-p2
---

營運問「最近七天，登入平均如何？」要先把一句話拆成兩件事：窗口用幾個日曆天圈範圍，平均數又要除以多少天。當會員不是每天都登入時，最近七筆日量常跨超過一週。即使日曆範圍選對，沒有補日仍然只會算實際出現的日量。

## 定義移動的範圍

- 移動平均（moving average）是每移到一列就重算一個鄰近範圍的平均。
- `AVG(daily_logins) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`：目前日量加前兩筆日量。只保證最多 3 列，不保證涵蓋連續 3 天。
- `… ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW`：日期在今天減 6 天到今天之內，共 7 個日曆日期。原本沒數據的日期不會由窗口自動造列。

在 SQL 練習場的「自由練習」選 `logins` 數據集，執行：

```sql
WITH daily AS (
  SELECT CAST(login_at AS DATE) AS day, COUNT(*) AS daily_logins
  FROM login_log WHERE user_id = 4 GROUP BY CAST(login_at AS DATE)
)
SELECT day, daily_logins,
       AVG(daily_logins) OVER (
         ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
       ) AS avg_active_days,
       COUNT(*) OVER (
         ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
       ) AS days_used
FROM daily ORDER BY day;
```

會員 4 的 1 月 2 日登入 2 次，1 月 5 日 1 次。1 月 5 日的七日窗口能看到這兩筆日量，平均 `(2 + 1) / 2 = 1.5`，不是除以 7。成品附上實際參與的天數，你可以一眼分辨平均變動是日量改變，還是分母改變。對本題，先按登入時間而不是接收時間轉日，再數同日所有原始登入。

若另一張圖的需求是零登入日也納入分母，就應先補出完整日期清單，再左接日量，將確知是零的日期填 0。在有 7 個完整日曆日的情形，分母才是 7；未到達的數據不一定等同零。[〈缺日補零〉](#/lesson/sq-pattern-10)會示範如何保留應有的日子。

本例的區間寫法是 DuckDB 方言。MySQL 的同類框使用 `INTERVAL 6 DAY PRECEDING`，不把數值和單位一起放在字串；若面試環境不支援日期值域框，可先補足日曆，再以 `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` 計算連續日。口徑要先對齊，不是直接互換。

## 平均旁邊附上實際分母

假設看 1 月 5 日，日期框涵蓋跨年的 12 月 30 日到 1 月 5 日。這七天雖都在日曆上，但數據集只從一月開始，也不是每一天都登入。若報表把發佈前的日期也當成零，讀者可能誤以為會員當時已存在並且沒活動。先約定數據完整的起點，再決定窗口是否要等滿七天才顯示。

試著為 1 月 5 日寫兩份手算：只用有登入的兩天，得到 1.5；如果已確認七天都在追蹤範圍且其餘日為零，則會得到 3 除以 7，兩個數不能互換。實務可以把分母和移動平均一起交付；若某一天突然少了數據，這個欄位比只看平均更容易看出缺測。題目只輸出實際有登入的日期，這不代表日曆版也要略過沒有登入的報表列。

也可檢查順序：先算每天量，再算平均。若直接對每次登入計算，登入較多的日子會占更多列；這時做出的數值不是每個日子的同權平均。

練習時選一個沒有前七天紀錄的首日，驗證只有一天作分母，再選一個中間有空日的日期；前者驗收組首，後者才能抓到把天數寫成列數的錯法。

## 常見錯誤

- 最近七日混到很久前的日量 → ROWS 只數列；要按日期界線改用 RANGE。
- 平均從第一天就除以 7，但題目要略過未出現日期 → 用實際非空日量的分母。
- 同一天多列讓某天權重偏大 → 先聚合成一日一列，再算日平均。
