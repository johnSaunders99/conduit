---
id: sq-expr-07
module: sq-expr
order: 7
title: 時間戳與時區
subtitle: 同一瞬間在兩地是哪一天
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-06
objectives:
- 區分沒有時區的時間戳與已有時區依據的瞬間
- 先依報表時區換算，再擷取日期
- 用跨午夜與延遲接收事件驗證日期歸屬
tags:
- timestamp
- 時區
- utc
- 事件時間
- 跨日
resources:
- title: Timestamp with Time Zone Functions
  url: https://duckdb.org/docs/stable/sql/functions/timestamptz
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 AT TIME ZONE 的兩種輸入方向與回傳類型。
- title: MySQL Date and Time Functions
  url: https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 CONVERT_TZ 的來源、目標與時區表。
concepts:
- id: sq-expr-07-order
  prompt: 若來源是 UTC 時鐘，要做台北日報，轉日期和換時區哪個先？
  answer: 先換到台北時鐘，再取 DATE；先取日期可能丟掉跨日資訊。
  mcq:
    question: 假設來源是 UTC，23:07 在本題 UTC+08:00 是何時？
    options:
    - 同日 23:07
    - 同日 15:07
    - 次日 07:07
    - 次日 00:00
    answer: 2
    explain: 向東偏移 8 小時後過午夜；先轉 DATE 會丟掉 23:07。
- id: sq-expr-07-origin
  prompt: 一個沒有時區的 TIMESTAMP 能自行說明它是哪個瞬間嗎？
  answer: 不能；要有來源時鐘的約定，才知道它代表哪個瞬間。
  mcq:
    question: 來源已是台北本地時間，要取台北日報日期，該怎麼做？
    options:
    - 加 8 小時再取日期
    - 一律先減 8 小時
    - 從接收欄直接取日期
    - 依原本台北時間戳取 DATE
    answer: 3
    explain: 再加 8 小時會把本地時間當成 UTC，造成重複偏移。
- id: sq-expr-07-dst
  prompt: 什麼時候不能把固定加 8 小時當成通用時區轉換？
  answer: 當來源或目標的偏移會隨日期改變，例如有夏令時間時，用有時區規則的轉換。
- id: sq-expr-07-business
  prompt: 報表看實際發生的台北日期，晚到的事件要看哪欄？
  answer: 轉換 event_at 後取日期；收到時間只能回答何時入站。
  mcq:
    question: 事件落在本地 2 月 5 日、收到已是 6 日，實際行為日報應選哪個日期？
    options:
    - 2 月 5 日
    - 2 月 6 日
    - 兩天都算
    - 要用目前的系統日期
    answer: 0
    explain: 歸屬口徑是行為發生時鐘；接收日不能代替它。
  interview:
    question: 同一個事件在兩份日報分別算在兩天，要怎麼排查？
    answer: 先問兩份報表定義的時區跟起日，拿同一事件的來源時刻換算，確認先換時區再取日期。再看兩份查的是發生還是接收欄；我會用跨午夜和晚到各一筆防止回歸。
    points:
    - 確認來源時區與報表時區
    - 檢查時刻欄與截日先後
practice:
- id: sq-expr-07-p1
  kind: sql
  category: [time]
  title: 把晚間事件轉成台北日期
  minutes: 5
  level: 1
  dataset: events
  prompt: 本題約定 `event_at` 是 UTC 時鐘且報表固定 UTC+08:00。從 `app_events` 取接收列 11 到 15（含），輸出 `raw_id`、`utc_day`、`report_day`，按此欄序。後兩欄是各時鐘下的 DATE，依 `raw_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, CAST(event_at AS DATE) AS utc_day,
           CAST(event_at + INTERVAL 8 HOUR AS DATE) AS report_day
    FROM app_events
    WHERE raw_id BETWEEN 11 AND 15
    ORDER BY raw_id;
  explain: 11 在 UTC 還是 2 月 2 日，報表已是 2 月 3 日；先做偏移才取當地日期。
  hints:
  - 8 小時用 INTERVAL 加在時間戳上
  - 最後才 CAST AS DATE
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-07-order
  - sq-expr-07-origin
  - sq-expr-06-roll
  tags:
  - timestamp
  - 時區
  - utc
- id: sq-expr-07-p2
  kind: sql
  category: [time]
  title: 核對延遲事件的歸日
  minutes: 7
  level: 2
  dataset: events
  prompt: 本題視 `event_at`、`received_at` 為 UTC 時鐘，報表固定 UTC+08:00。取本地事件日期為 2026-02-05 的所有接收列，不做重送去重。輸出 `raw_id`、`event_id`、`local_received_day`，依此欄序；第三欄為接收時間的本地 DATE。依 `raw_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, event_id,
           CAST(received_at + INTERVAL 8 HOUR AS DATE) AS local_received_day
    FROM app_events
    WHERE CAST(event_at + INTERVAL 8 HOUR AS DATE) = DATE '2026-02-05'
    ORDER BY raw_id;
  explain: 22 應保留：換算後發生於 2 月 5 日，卻在 2 月 6 日收到。原始時間或本地接收日期都不是本題的篩選口徑。
  hints:
  - 篩選用本地事件日
  - 接收日只拿來顯示
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-07-order
  - sq-expr-07-business
  - sq-expr-06-clocks
  - sq-read-05-key
  tags:
  - timestamp
  - 時區
  - utc
---

## 先知道來源時鐘，才知道是哪一天

兩份日報都取 2 月 1 日，事件卻對不上。若一份採世界協調時間（UTC），另一份採台北時間，同一瞬間可能分屬不同日。時間戳（timestamp，台灣也稱時間戳）可以記到一天中的時刻；只有一串不帶時區的年月日時分秒，還不知道它是哪裡的時鐘。時區（time zone）定義當地時鐘怎麼對應瞬間，部分地區的偏移會隨日期改變。

## 速查：標記、換算、截日

- `TIMESTAMP` 在本數據集只是時鐘讀值。要知道瞬間，先問來源把它當 UTC 或本地時間，不能看欄名猜。
- 本堂以共用事件表做 2026 年的練習，**約定**無時區的事件欄讀作 UTC，報表固定 UTC+08:00。`t + INTERVAL 8 HOUR` 就得到這個口徑下的本地讀值。
- `CAST(本地讀值 AS DATE)` 最後才做，去掉一天中的時刻；若先取 UTC 日期，就失去跨日所需的資訊。
- 已代表目標本地時間的欄，不應再加 8 小時。這個算式只用於本堂明確限定的固定偏移案例，並不改寫共用表。

數據集：`events`。把同一筆事件在兩把時鐘上的表示放一起：

```sql
SELECT raw_id, event_at AS utc_clock,
       event_at + INTERVAL 8 HOUR AS report_clock,
       CAST(event_at + INTERVAL 8 HOUR AS DATE) AS report_day
FROM app_events
WHERE raw_id = 1;
```

UTC 時鐘是 2 月 1 日 23:07，報表讀值為 2 月 2 日 07:07，所屬日是 2 月 2 日。不是事件晚了 8 小時發生，而是把同一瞬間用另一地的時鐘表示。用原時刻先取 DATE 會得到 2 月 1 日，正好是這堂要抓的錯誤。

## 換時區也不能用錯時間欄

進階題中的 22 號是先發後到：把兩個時刻都換到報表時鐘後，事件發生於 2 月 5 日，接收卻是 2 月 6 日。要看使用者哪一天做了動作，用事件時間（event time）；要查哪一天收到，才看接收欄。固定 UTC+08:00 在這堂足夠，但不能套到有夏令時間（daylight saving time）的城市；當地同一鐘點在某些日期可能不存在或出現兩次。實務需保存來源時區或明確的 UTC 瞬間，並用目標時區規則換算。哪個本地鐘點是業務日切點，之後在[業務日與截點](#/lesson/sq-time-01)再談。

**換引擎怎麼說：**完整 DuckDB 可用 `AT TIME ZONE`，同一語法對不帶時區的讀值用來指定來源，對帶時區的瞬間則產生目標本地讀值；渠成的離線 DuckDB-WASM 不載入命名時區需要的 ICU 擴充，因此練習用明定的固定偏移。MySQL 用 `CONVERT_TZ(dt, from_tz, to_tz)`，命名時區依賴伺服器的時區表；Spark SQL 有 `from_utc_timestamp`。先核對來源類型和連線的時區設定，再移植轉換，而不是把兩種方向猜成一樣。

再挑 13 號做對照：來源欄是 2 月 3 日 00:03，報表欄是同日 08:03，日期其實沒變。若只用這種不跨午夜的例子，忘了換算也可能得到正確日期。驗收時同時挑一筆會跨日和一筆不會跨日，用時刻而非只用日期核對。

## 常見錯誤

- **UTC 晚間事件落在台北前一天** → 先截成日期 → 換算時鐘後再取 DATE。
- **已是本地時間卻再跨一天** → 對本地欄重複加偏移 → 先查來源欄定義。
- **晚到事件進接收日報卻被當成發生日** → 換對時區但用錯欄 → 明寫事件歸屬欄。
