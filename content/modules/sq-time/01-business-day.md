---
id: sq-time-01
module: sq-time
order: 1
title: 業務日與截點
subtitle: 凌晨一點仍屬昨天
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
  - "把已在業務當地時區的時間歸到 04:00 開始的業務日"
  - "用 03:59:59 與 04:00:00 驗證交界"
  - "比較事件與接收按同截點分日的差異"
tags:
  - "業務日"
  - "日切"
  - "事件時間"
resources:
  - title: "DuckDB：Timestamp Types"
    url: "https://duckdb.org/docs/stable/sql/data_types/timestamp"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "區分無時區時間戳與代表瞬間的時間戳。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "對照 DATE_SUB 的小時間隔。"
concepts:
  - id: "sql-business-cutoff"
    prompt: "每天 04:00 開始新的一日，2/4 03:59:59 屬於哪個業務日？"
    answer: "2/3；先往回移 4 小時再取日期。"
    mcq:
      options:
        - "2/4"
        - "2/3"
        - "2/5"
        - "按接收日期才知道"
      answer: 1
      explain: "04:00 前仍在昨日的營業窗；接收時間不是行為報表的分日依據。"
    interview:
      question: "收到時間和發生時間都跨日，要用哪一個？"
      answer: "營運行為按業務時區的發生時間與日切計，監控入庫可按接收時間計。我會列一筆晚到事件，在兩個欄位上對照，並把數據缺漏與晚到分開報。"
      points:
        - "事件與接收時間回答不同問題"
        - "先確認時區再日切"
        - "測試截點前後"
  - id: "sql-business-shift"
    prompt: "為何要先減 4 小時、再取日期？"
    answer: "先取日期就失去時分秒，不能區分截點兩側。"
    mcq:
      options:
        - "為了把兩個自然日合併成同一天"
        - "為了把每列轉成 UTC"
        - "先取日期會丟掉截點需要的時間"
        - "為了補上來源缺漏的時區"
      answer: 2
      explain: "位移是重新定義分日界線，仍有一天一個標籤；它沒有補上來源時區，也不是轉成 UTC。"
  - id: "sql-business-zone"
    prompt: "來源給 UTC 時間，應何時轉成業務當地時間？"
    answer: "先轉成業務當地時間，再套用 04:00 日切；兩步的目的不同。"
practice:
  - id: "sq-time-01-p1"
    kind: "sql"
    category: [time]
    title: "把凌晨事件歸入正確業務日"
    minutes: 6
    level: 2
    dataset: "events"
    prompt: "將 `app_events.event_at` 視為已換成本地的時間。列出 event_id 為 e50、e51、e90 的原接收列，按 04:00 日切。輸出 `event_id`、`event_at`、`business_day`，依 `event_id`、原 `raw_id` 升序。"
    solution: |-
      SELECT event_id, event_at, CAST(event_at - INTERVAL '4 hours' AS DATE) AS business_day
      FROM app_events WHERE event_id IN ('e50','e51','e90') ORDER BY event_id, raw_id;
    explain: "e50 的 23:55 和 e51 的 00:03 雖跨自然日，仍同屬 2/2 業務日。用 CAST(event_at AS DATE) 會錯分。"
    hints:
      - "先減 4 小時，再 CAST AS DATE。"
      - "不是把發生時間換成接收時間。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-business-cutoff"
      - "sql-business-shift"
      - "sq-expr-07-business"
    tags:
      - "業務日"
      - "日切"
  - id: "sq-time-01-p2"
    kind: "sql"
    category: [time]
    title: "找出跨業務日到達的事件"
    minutes: 9
    level: 3
    dataset: "events"
    prompt: "面試追問：兩個時間欄都視為同一業務時區的本地時間；以 04:00 日切分別算發生及接收的業務日。只列接收業務日晚於發生業務日的原接收列。輸出 `raw_id`、`event_id`、`event_day`、`receipt_day`，依 `raw_id` 升序。"
    solution: |-
      WITH stamped AS (
        SELECT raw_id, event_id,
               CAST(event_at - INTERVAL '4 hours' AS DATE) AS event_day,
               CAST(received_at - INTERVAL '4 hours' AS DATE) AS receipt_day
        FROM app_events
      )
      SELECT raw_id, event_id, event_day, receipt_day FROM stamped
      WHERE receipt_day > event_day ORDER BY raw_id;
    explain: "應用同一截點後才比較兩個日期。接收比發生晚幾秒不一定跨業務日；相反，2/4 的 e90 跨了日切。"
    hints:
      - "先算兩張日標籤。"
      - "只比較標籤，不用差值 ≥ 24 小時。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-business-cutoff"
      - "sql-business-shift"
      - "sq-expr-07-business"
      - "sql-business-zone"
      - "sql-funnel-late"
    tags:
      - "業務日"
      - "事件時間"
      - "數據質量"
---

## 午夜不是每家店的截點

凌晨 1 點還在營業，營運希望這筆交易進「昨天」的班次。業務日（business day，此處不是「工作日」）是報表的歸屬標籤。茶舖每天 04:00 開始新日：2/3 04:00 到 2/4 04:00 之前屬 2/3，2/4 04:00 整變 2/4。這個規則是左閉右開；之後[〈半開區間〉](#/lesson/sq-time-02)會用它對齊報表的選取範圍。不能因為習慣每天午夜換日就把班次截成兩半。

### 先時區，後日切

- 時區（time zone）決定同一瞬間在店裡當地顯示的時刻。練習的 `events` 已是同一業務本地時間，不要再加時差。若輸入是 UTC，先按[時區課](#/lesson/sq-expr-07)的規則換成本地，再做日切。
- 日切（day boundary）是把已在當地的 04:00 映成取日用的 00:00；用 `event_at - INTERVAL '4 hours'` 移動本地時鐘，再 `CAST(... AS DATE)`。
- 快速驗收要用 03:59:59、04:00:00、04:00:01 三點；光看白天的紀錄，錯寫成午夜也可能通過。

在 [自由練習](#/sql?tab=free) 選 `events`。第一段自帶三筆邊界數據；用它驗算應得到 2/3、2/4、2/4。日切不是轉時區，別把減 4 小時當成 UTC 的時差。若營運跨地或換夏令時間，各分店應先用已確認的地區規則轉換，而不是永遠套同一個偏移量。

```sql
WITH examples(event_time) AS (VALUES
  (TIMESTAMP '2026-02-04 03:59:59'), (TIMESTAMP '2026-02-04 04:00:00'),
  (TIMESTAMP '2026-02-04 04:00:01')
)
SELECT event_time, CAST(event_time - INTERVAL '4 hours' AS DATE) AS business_day
FROM examples ORDER BY event_time;
```

接著按實際事件計算業務日。`e50`、`e51` 雖跨午夜但同日；`e90` 2/4 23:07 發生，2/6 01:07 才到，發生歸 2/4、接收歸 2/5。把兩張日期標籤抄到紙上，這是說明補進昨天業務報表的好例子。只看兩個時間差的大小不能判斷跨日：一筆 03:59:59 發生、04:00:01 抵達，延遲只有兩秒也會跨日。

```sql
SELECT event_id, event_at, CAST(event_at - INTERVAL '4 hours' AS DATE) AS business_day
FROM app_events WHERE event_id IN ('e50','e51','e90') ORDER BY event_id, raw_id;
```

**方言。** 例子假設 `TIMESTAMP` 已是店內本地鐘面時間。DuckDB 的間隔寫成 `INTERVAL '4 hours'`；MySQL 可用 `DATE_SUB(event_at, INTERVAL 4 HOUR)` 再取日。Spark SQL 像 `from_utc_timestamp` 這類轉換時區的函式不等於業務日位移。

### 把口徑說給交班同事聽

「這張報表按茶舖當地時間 04:00 換日；看的是發生在這個營業窗的行為，不是入庫時間。」先說明時區前提，再說開始點與結束點。要從原明細撈出 2/3 的業務日，直接寫本地時間從 2/3 04:00 起、到 2/4 04:00 前，應與貼上 `business_day = 2/3` 標籤的結果相同。短的比較式方便驗證包含哪一秒；標籤方便在報表上一人一張表看多日。兩種查法不是兩種業務定義。

試問一個入庫情境：事件在 2/4 03:59:59 發生，2/4 04:00:01 到達。自然日相同，業務日不同；若你分別看兩張報表，它會進前一晚營運統計和下一班次入庫統計。進一步問「早班開始時重新產表看到哪一版？」才要把接收截止點另寫在取數條件，而不是將箭頭轉到接收日期。

最後留三個測試：截點正前方、正好截點、正後方，此外至少留一筆自然日跨越但業務日不變的行為。如果未知來源時區，先請來源確認，也可暫只展示原值；不要把無時區的時間戳當作已經轉成 UTC 的證據。不同店鋪的標準若有不同，應為每筆先確定店鋪規則，而不是從某一份報表反推。

## 常見錯誤

- 凌晨未到截點也算今天 → 直接轉日期 → 先往回移 4 小時。
- 正好 04:00 還算昨天 → 將上一日的右端包含進去 → 用不含迄點的區間。
- 遲來事件歸錯報表日 → 取了接收鐘面 → 分開報事件日與接收日。
