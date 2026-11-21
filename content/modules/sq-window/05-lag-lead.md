---
id: sq-window-05
module: sq-window
order: 5
title: LAG 與 LEAD
subtitle: 計算相鄰兩次登入的間隔
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-04
objectives:
- 取得組內前一筆與後一筆
- 保留沒有相鄰紀錄時的 NULL
- 用正確時間單位算相鄰登入差
tags:
- lag
- lead
- 登入間隔
- 時間差
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 lag、lead 的偏移與預設值。
- title: MySQL：日期與時間函式
  url: https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比對 MySQL 的 DATEDIFF 與 TIMESTAMPDIFF。
- title: DuckDB：日期部分函式
  url: https://duckdb.org/docs/stable/sql/functions/datepart
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 date_diff，分清邊界數與間隔。
- title: Spark SQL：日期與時間函式
  url: https://spark.apache.org/docs/latest/api/sql/datetime-functions/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 datediff 的起訖順序及結果單位。
concepts:
- id: sq-window-05-lag
  prompt: LAG(login_at) 會取得哪一筆時間？
  answer: 在指定分區與排序內，上一列的 login_at；組首沒有上一列，預設為 NULL。
  mcq:
    options:
    - 當天第一筆一律補零
    - 同組排序中的上一列
    - 整張表較早一日的所有列
    - 下一列
    answer: 1
    explain: LAG 按列移動，不按日曆或全表插入順序。
- id: sq-window-05-lead
  prompt: 計算直到下一次登入的時間差，哪個是結束時間？
  answer: 用 LEAD(login_at) 當結束時間，目前 login_at 當起點。
  mcq:
    options:
    - PARTITION BY 的會員號
    - received_at
    - LEAD(login_at)
    - LAG(login_at)
    answer: 2
    explain: 題目看下一次登入而非上一次或接收時刻。
- id: sq-window-05-gap
  prompt: 相隔 90 分鐘但同一天，DATEDIFF 的日期結果應是什麼？
  answer: 日期差是 0 天；若需求是分鐘，就要用能計分鐘的函式。
  mcq:
    options:
    - 90 天
    - 1 天
    - 'NULL'
    - 0 天
    answer: 3
    explain: 日期差與經過時間不同；一開始就該寫單位進欄名。
  interview:
    question: 跨午夜的 8 分鐘會被 DATEDIFF 算成多久？
    points:
    - 區別日期差與經過時間
    - 指出跨午夜是一天日期差
    - 會按單位選函式
    answer: 如果用只看日期的 DATEDIFF，會是一天；實際只過了 8 分鐘。我會先問要活躍日差還是等待時間，再選日期差或分鐘級函式。
practice:
- kind: sql
  category: [window]
  title: 取同一會員左右相鄰的登入
  minutes: 6
  level: 1
  dataset: logins
  prompt: |
    只取會員 4 的所有登入，按 login_at、login_id 升序定義相鄰。輸出前一筆登入號 `prev_id`、下一筆登入號 `next_id`，找不到的保留 NULL。

    只輸出以下欄位，欄序固定：`login_id`、`prev_id`、`next_id`。

    排序：`login_at` 升序，同時按 `login_id` 升序。
  solution: |
    SELECT login_id,
           LAG(login_id) OVER (ORDER BY login_at, login_id) AS prev_id,
           LEAD(login_id) OVER (ORDER BY login_at, login_id) AS next_id
    FROM login_log WHERE user_id = 4
    ORDER BY login_at, login_id;
  explain: |
    6、7 是同一天連續兩次登入，7 的 prev_id 是 6，第一筆的 prev_id 和最後一筆的 next_id 是 NULL。不要先按天去重。
  hints:
  - 先篩成一人的輸入。
  - 把同一組排序同時給 LAG 和 LEAD。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-05-lag
  - sq-window-05-lead
  - sq-window-02-tie
  tags:
  - lag
  - lead
  - 相鄰列
  id: sq-window-05-p1
- kind: sql
  category: [window, time]
  title: 比對每次登入與上次相隔的分鐘數
  minutes: 9
  level: 2
  dataset: logins
  prompt: |
    保留每次登入。每位會員按 login_at、login_id 升序，輸出前一次登入時間 `prev_login_at`，以及從前次到這次跨過的分鐘邊界數 `gap_minutes`；沒有前次兩欄都為 NULL。

    只輸出以下欄位，欄序固定：`user_id`、`login_id`、`prev_login_at`、`gap_minutes`。

    排序：`user_id` 升序，再按 `login_at`、`login_id` 升序。
  solution: |
    WITH nearby AS (
      SELECT user_id, login_id, login_at,
             LAG(login_at) OVER (PARTITION BY user_id ORDER BY login_at, login_id) AS prev_login_at
      FROM login_log
    )
    SELECT user_id, login_id, prev_login_at, DATE_DIFF('minute', prev_login_at, login_at) AS gap_minutes
    FROM nearby ORDER BY user_id, login_at, login_id;
  explain: |
    7 號對 6 號相隔 90 分鐘。用日期差會變 0；漏分區會把別人的登入拿來當前次紀錄。DuckDB 的 DATE_DIFF 先給單位，再給起點、終點。
  hints:
  - 用 LAG 拿到之前的時間。
  - DuckDB 寫 DATE_DIFF(單位, 起點, 終點)，單位用 minute。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-05-lag
  - sq-window-05-gap
  - sq-window-01-partition
  tags:
  - lag
  - 日期差
  id: sq-window-05-p2
---

分析同一會員的登入節奏時，「昨天有沒有登入」和「距離上一筆多久」不是同一個問題。同一天可以登入兩次，上一筆也可能是好幾天前；若先按天去重，第二次登入的間隔就永遠看不到。這堂在每筆旁附上相鄰紀錄，先看得見，再算差。

## 移到相鄰的列

- `LAG(值, 位移, 預設值) OVER (PARTITION BY 會員 ORDER BY 時間, 唯一鍵)`：向前看。位移可省略，預設 1；跨出組首時預設回 `NULL`。
- `LEAD(值, 位移, 預設值) OVER (…)`：向後看；跨出組尾時同樣預設為 `NULL`。在只剩單一會員的查詢，可以不另分區。
- 位移（offset）在這裡是幾列，不是幾分鐘或幾天。不要用 0 代替找不到的鄰居；從沒有上次紀錄推不出「間隔為零」。

在 SQL 練習場的「自由練習」選 `logins` 數據集，執行：

```sql
WITH nearby AS (
  SELECT login_id, login_at,
         LAG(login_at) OVER (ORDER BY login_at, login_id) AS prev_at,
         LEAD(login_id) OVER (ORDER BY login_at, login_id) AS next_id
  FROM login_log WHERE user_id = 4
)
SELECT login_id, prev_at, next_id, DATE_DIFF('minute', prev_at, login_at) AS gap_minutes
FROM nearby ORDER BY login_at, login_id;
```

會員 4 的 6 號在 09:12，7 號在同日 10:42。前者是本組第一筆，沒有上次；後者的前次是 6，間隔 90 分鐘。如果把會員混在同一個窗口，某人的首筆可能錯接到別人的時間；檢查每位會員的首列是否沒有前次，比只看間隔是否非負更有用。時間相同的紀錄還要以唯一鍵決定先後。

DuckDB 的 `DATE_DIFF('minute', start, end)` 數跨過的分鐘邊界；本數據的秒數都是 00，這裡也就是相隔分鐘。MySQL 可用 `TIMESTAMPDIFF(MINUTE, start, end)` 取得整分鐘的間隔；對含秒數的數據，兩者不要假定相等。Hive SQL、Spark SQL、MySQL 的 `DATEDIFF(end, start)` 在這個寫法算的是日期差，終點在前，不是本題的分鐘。比照時連測跨日和同日兩個案例，再用合適的函式。

## 兩種相鄰，不要拿錯方向

想像三次登入是早上 09:00、09:20、10:00。第二筆的前次時間是 09:00，下次時間則是 10:00。若問「從上次過了多久」，第二筆應是 20 分；若問「到下一次還要多久」，同一筆得 40 分。這兩欄有不同的方向，不是交換兩個欄名就結束。先在時間線畫箭頭，再寫時間差，往往不用跑全表就能找出順序寫反的問題。

回到登入數據，先保留每人的全部紀錄算前次，再決定成品是否只顯示某一週。若先在窗口前切出某週，這週的首筆可能沒有上次，因為它原本在前一週；若業務希望用完整歷史找上次，就應算好後才篩報表日期。這和上堂先排名或先篩渠道是同一種取捨。

也要區分「根本沒有鄰居」與「鄰居的某一欄缺值」。有需要時，可同時查前次登入號與時間：登入號存在、時間卻缺失就屬於數據質量問題，不宜自動以零分鐘替代。之後[〈會話切分〉](#/lesson/sq-pattern-09)會用相鄰事件間隔決定哪裡開始新會話；那時同樣需要明確的時間單位與首列規則。

## 常見錯誤

- 第一筆有了別人的前次 → 依會員分區，不能只按全表時間排。
- 跨一天卻只有幾分鐘，報成 1 天 → 需求是經過時間，別改用只看日期的函式。
- 所有間隔都變成負數 → 檢查起點是前次，終點才是目前。
