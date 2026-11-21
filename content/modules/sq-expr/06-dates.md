---
id: sq-expr-06
module: sq-expr
order: 6
title: 日期與區間
subtitle: 月末往後一天是哪個月
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-05
objectives:
- 用 DATE 指定曆日並用 INTERVAL 加減天數
- 用月底和次月首日核對日期加法及結果類型
- 用 date_diff 說明跨過日界與滿 24 小時的差別
tags:
- date
- interval
- date_diff
- 日期運算
resources:
- title: Date Functions
  url: https://duckdb.org/docs/stable/sql/functions/date
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看日期加法、date_diff 與 date_sub 的定義。
- title: MySQL Date and Time Functions
  url: https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照 DATEDIFF 的參數與 DATE_ADD。
concepts:
- id: sq-expr-06-roll
  prompt: 1 月 31 日加 1 天是什麼日期？
  answer: 同一年的 2 月 1 日，應由日期運算處理，而非對日號加 1。
  mcq:
    question: 在 DuckDB，DATE 加 INTERVAL 1 DAY 若要只輸出日期，怎麼做？
    options:
    - 把結果切取前兩個字
    - 對日號加 1
    - 把 DATE 改成 VARCHAR 再加
    - 對結果 CAST AS DATE
    answer: 3
    explain: 日期運算先處理跨月；加區間產生時間戳，最後再轉回 DATE。
- id: sq-expr-06-boundary
  prompt: 23:55 到隔日 00:03，date_diff('day', ...) 有何含義？
  answer: 跨過 1 個日界；不是說過了 24 小時。
  mcq:
    question: 起點是昨晚，終點是今天凌晨，跨了幾個日界？
    options:
    - 1 個
    - 0 個，因為未滿一天
    - 2 個，兩個日期都在內
    - 要先查是哪一天才知道
    answer: 0
    explain: 日界是午夜，跨一次即可；若在問完整日長度則需另一種計算。
- id: sq-expr-06-clocks
  prompt: 要取登入日，該先把哪一欄轉 DATE？
  answer: 用 login_at；received_at 是收到時間，延遲時可能已換日。
  mcq:
    question: 166 號 1 月 31 日登入，2 月 1 日收到。1 月活躍報表該怎麼辦？
    options:
    - 記在 2 月，因為當天才收到
    - 以 login_at 歸到 1 月
    - 讓它同時進 1 月和 2 月的日活
    - 以 received_at 減固定一天
    answer: 1
    explain: 登入日與接收日答不同問題，不用事後猜固定的延遲。
- id: sq-expr-06-offset
  prompt: DuckDB date_diff 與 MySQL DATEDIFF 的起迄順序一樣嗎？
  answer: 不一樣；DuckDB 寫單位、起點、終點，MySQL DATEDIFF 寫終點、起點。
  interview:
    question: 晚上發出的事件隔天才收，說「延遲一天」準確嗎？
    answer: 我會先反問是跨過日期，還是實際超過 24 小時。日報歸屬看事件日期；延遲等了多久要比兩個時刻。舉 23:55 到次日 00:03，一個日界但只有 8 分鐘。
    points:
    - 拆開日期與經過時間
    - 對照一筆跨午夜但延遲很短的反例
practice:
- id: sq-expr-06-p1
  kind: sql
  category: [time, expression]
  title: 月底訂單的次日檢查
  minutes: 5
  level: 1
  dataset: shop
  prompt: 從 `orders` 取 2026-01-31 到 2026-02-01（含）的訂單。輸出 `order_id`、`order_date`、`next_date`，依此欄序；第三欄是營業日加 1 天，類型為 DATE。依 `order_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT order_id, order_date,
           CAST(order_date + INTERVAL 1 DAY AS DATE) AS next_date
    FROM orders
    WHERE order_date BETWEEN DATE '2026-01-31' AND DATE '2026-02-01'
    ORDER BY order_id;
  explain: 日期加天數會跨月；用 INTERVAL 加完後要轉 DATE，免得把午夜時間戳當新增的報表時間。
  hints:
  - 明寫 DATE 常值
  - 把日期加一天後轉回 DATE
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-06-roll
  - sq-expr-02-target
  - sq-read-08-inclusive
  tags:
  - date
  - interval
  - date_diff
- id: sq-expr-06-p2
  kind: sql
  category: [time, expression]
  title: 發生日與接收日的差距
  minutes: 7
  level: 2
  dataset: logins
  prompt: 在 `login_log` 取 `login_id` 165 到 171（含）。依次輸出 `login_id`、`login_day`、`received_day`、`day_gap`；兩個日欄都是 DATE，差距是從發生時刻到接收時刻跨過幾個日界。不去掉同日到達的列，依 `login_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT login_id,
           CAST(login_at AS DATE) AS login_day,
           CAST(received_at AS DATE) AS received_day,
           date_diff('day', login_at, received_at) AS day_gap
    FROM login_log
    WHERE login_id BETWEEN 165 AND 171
    ORDER BY login_id;
  explain: 166 從 1 月 31 日跨到 2 月 1 日；日差為 1，不是把兩個日號相減。先放發生時間，再放接收時間，避免符號相反。
  hints:
  - 用 CAST 取兩個日欄
  - date_diff 先寫單位再寫起點、終點
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-06-boundary
  - sq-expr-06-clocks
  - sq-expr-06-offset
  - sq-expr-02-target
  tags:
  - date
  - interval
  - date_diff
---

## 讓日期自己處理月底

訂單核對天天做，月底也不能靠人工改日期。日期（date）表示曆日，不含幾點幾分；區間（interval）在本堂指一段可加減的時間量，不是 WHERE 的上下界。把日期加一天時，讓引擎處理不等長的月份。要比較哪兩天也別只取日號，月底接隔月時 31 和 1 仍相差一天。

## 語法速查

- `DATE '2026-01-31'` 是日期常值，不只是看起來像日期的文字。
- `d + INTERVAL 1 DAY` 從日期往後一天；`d - INTERVAL 1 DAY` 往前一天。DuckDB 的日期加區間結果為時間戳，若要曆日用 `CAST(... AS DATE)`。若只加整數天數，也可用 `d + 1` 直接得到日期。
- `date_diff('day', start_at, end_at)` 看起點到終點跨了幾個日界；順序對調，差值也反向。要算完整日長度，DuckDB 的 `date_sub('day', start_at, end_at)` 是另一種計算。
- `CAST(login_at AS DATE)` 取日期；這筆登入表的時鐘已是業務本地時間，所以不用再搬時區。

數據集：`logins`。先取月底兩筆登入，看次日與實際到達日：

```sql
SELECT login_id,
       CAST(login_at AS DATE) AS login_day,
       CAST(login_at + INTERVAL 1 DAY AS DATE) AS next_day,
       CAST(received_at AS DATE) AS received_day
FROM login_log
WHERE login_id IN (165, 166)
ORDER BY login_id;
```

兩筆都在 1 月 31 日登入，次日欄都應是 2 月 1 日；只有 166 的接收日是 2 月 1 日。若要做登入日報，兩筆應進同一日。這不是把三欄留一個最像日期的就好，它們各答不同問題：發生日定歸屬、次日用於檢查、接收日看輸入時機。來自兩個欄的日期即使碰巧一樣，也不能交換用途。

## 跨日不代表等滿一天

假設影片事件 23:55 發生，次日 00:03 才收到。要找「晚一個曆日進來的紀錄」，它屬於跨 1 個日界；要看「超過 24 小時才送達」則不符合，因為實際只過 8 分鐘。先把時刻放在一條線上：午夜是日報的邊界，不是開始計時的地方。同樣的數據出兩份報告時，欄名應區分日界數與經過秒數，不能都叫延遲天數。何時才算下一個業務日會在[業務日與截點](#/lesson/sq-time-01)再練。

**換引擎怎麼說：**DuckDB 的 `date_diff` 寫單位、起點、終點；Hive SQL 與 Spark SQL 的 `datediff(end_date, start_date)` 是終點在前，MySQL 的 `DATEDIFF` 同樣是終點在前且只看日期部分。Hive SQL／Spark SQL 的 `date_sub(date, days)` 是日期往前幾天，不是 DuckDB 這裡的完整時間單位差；MySQL 的日期往後則用 `DATE_ADD(d, INTERVAL 1 DAY)`。移植先手算一組正差和負差，別只改函式拼法。

手算核對時至少選一筆月底、一筆月初。1 月 31 日往後一天是 2 月 1 日，2 月 1 日往前一天才是 1 月 31 日；不要靠把數字後面兩位加減 1。若需求改為「往後一個月」，又和加 30 天不同，要先約定月底應落在哪個日期。例如帳期是下月同日還是下月最後一天，可能得出不同答案。這堂只承諾曆日加減，沒有假定每月相同長度。如果流程每天固定執行，查詢也應接收明確的目標日，而不是靠當下時鐘猜回補哪一天。

## 常見錯誤

- **月底變成當月 32 號** → 對日號做加法 → 用日期值加區間。
- **隔天收到卻看起來早一天** → 起點與終點交換 → 用發生時間作起點。
- **短暫延遲看起來是一整天** → 把日界數當經過時間 → 為不同問題保留不同指標。
