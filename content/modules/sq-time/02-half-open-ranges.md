---
id: sq-time-02
module: sq-time
order: 2
title: 半開區間
subtitle: 月末午夜不重複計入
status: ready
minutes: 30
level: 2
prereqs:
- sq-time-01
objectives:
  - "將相鄰月份寫成左閉右開日期條件"
  - "用正好在交界的事件驗證每列至多入一窗"
  - "以左連接保留沒有事件的報表窗"
tags:
  - "半開區間"
  - "日期篩選"
  - "邊界測試"
resources:
  - title: "DuckDB：Date Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/date"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "對照日曆日期、月份位移與區間。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看日期與時間戳的日期運算方式。"
concepts:
  - id: "sql-range-bound"
    prompt: "兩個相鄰區間共用界線，哪個條件讓界線只屬右窗？"
    answer: "各自使用起點 <= 時間 AND 時間 < 終點。"
    mcq:
      options:
        - "兩側都用 BETWEEN"
        - "起點 <= 時間且時間 < 終點"
        - "起點 < 時間且時間 < 終點"
        - "兩個窗口都包含終點"
      answer: 1
      explain: "雙含有重疊，兩側都嚴格不含則留一個洞。"
    interview:
      question: "月底的 23:59:59 不夠好嗎？"
      answer: "可能還有小數秒，而且午夜是下一個窗。我把上限寫成下月月初並用小於，測試前一瞬間、界線本身與界線之後。"
      points:
        - "不用猜末秒精度"
        - "下一窗包含共用邊界"
        - "指明同一時區"
  - id: "sql-range-naked"
    prompt: "事件欄可按原時間範圍篩選，為何不必 CAST 成日期再篩？"
    answer: "可直接精確比較原時間，並有機會保留範圍搜尋；仍需查看執行計畫。"
    mcq:
      options:
        - "轉成 DATE 便可直接表達任意時間邊界"
        - "轉成日期才能讓日期分區接受篩選"
        - "原欄範圍可表達完整邊界"
        - "原欄只能比較相同日期，不能比較範圍"
      answer: 2
      explain: "轉日期可能失去時分秒，也可能讓可用的索引或分區裁剪沒被用到。"
  - id: "sql-range-empty"
    prompt: "用窗口表左連接事件，時間條件放哪裡才能保留空窗？"
    answer: "放在 ON；成功匹配才計事件，失配窗口仍保留。"
practice:
  - id: "sq-time-02-p1"
    kind: "sql"
    category: [time]
    title: "選出二月內的全部訂單"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "用 `orders.order_date` 選 2026 年 2 月的全部訂單，不限狀態。輸出 `order_id`、`order_date`，依 `order_date`、`order_id` 升序。"
    solution: |-
      SELECT order_id, order_date FROM orders
      WHERE order_date >= DATE '2026-02-01' AND order_date < DATE '2026-03-01'
      ORDER BY order_date, order_id;
    explain: "用下個月起日當不含的上限；不用猜這個月幾天。3/1 的訂單不進二月。"
    hints:
      - "下界是 2/1。"
      - "上界用 3/1 而不是寫 2/28 幾點。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-range-bound"
      - "sql-range-naked"
      - "sq-expr-06-boundary"
    tags:
      - "半開區間"
      - "日期篩選"
  - id: "sq-time-02-p2"
    kind: "sql"
    category: [time, distinct]
    title: "午夜前的交接只記一次"
    minutes: 9
    level: 3
    dataset: "events"
    prompt: "面試追問：按 `event_at` 把 2026-02-04 本地日分在兩個左閉右開窗：00:00 到 23:07 為 before，23:07 到 2/5 00:00 為 after。每窗數不同 `event_id`，即使為 0 也要列。輸出 `bucket`、`events`，依 `bucket` 字串升序（after 在 before 之前）。"
    solution: |-
      WITH windows(bucket, start_at, end_at) AS (VALUES
        ('before', TIMESTAMP '2026-02-04 00:00:00', TIMESTAMP '2026-02-04 23:07:00'),
        ('after',  TIMESTAMP '2026-02-04 23:07:00', TIMESTAMP '2026-02-05 00:00:00')
      )
      SELECT w.bucket, COUNT(DISTINCT e.event_id) AS events
      FROM windows w LEFT JOIN app_events e ON e.event_at >= w.start_at AND e.event_at < w.end_at
      GROUP BY w.bucket ORDER BY w.bucket;
    explain: "e90 恰在 23:07 且晚到，依發生時間應只進 after。時間條件放 ON 可保留空窗，COUNT DISTINCT 也不會把重送多算。"
    hints:
      - "先宣告兩個窗的名稱和起迄。"
      - "共用的時間點只由右側窗口含入。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-range-bound"
      - "sql-range-empty"
      - "sql-funnel-late"
    tags:
      - "半開區間"
      - "事件時間"
      - "去重"
---

## 邊界是下一天的開始，不是今天的最後一秒

二月報表結算後，三月第一筆也出現在二月。兩邊若都用含尾點的區間，把 3/1 同時計進兩個月很容易。半開區間（half-open interval）寫成 `[start, end)`：**包含起點，不含終點**。相鄰窗用同一個交界，一個窗不收，另一個窗必收，所以不重疊也不漏。不要用「到 23:59:59」取代「小於隔天」，時間戳在最後一秒可能還有小數秒。

### 比較式和檢查點

- `t >= start AND t < end`：本課的範圍條件。
- `t BETWEEN start AND end`：兩端都含入，不適用於共用尾端的窗口。
- 日期欄以 `DATE` 比較；時間戳用同類型、同一業務時區的起迄界線。上一課的 04:00 業務日就以 04:00 來界定，不照搬午夜。

在 [自由練習](#/sql?tab=free) 選 `shop`，先查月底及月初的明細，核對 2/28 有兩張單且 3/1 另有一張。再跑二月範圍版本，確認 3/1 不會出現。範圍若改用時間戳，起點之前的最後一個小數秒也要測；光用日型別的樣本不能驗證時間精度。

```sql
SELECT order_id, order_date FROM orders WHERE order_date >= DATE '2026-02-28' AND order_date < DATE '2026-03-02' ORDER BY order_date, order_id;
```

```sql
SELECT order_id, order_date FROM orders
WHERE order_date >= DATE '2026-02-01' AND order_date < DATE '2026-03-01'
ORDER BY order_date, order_id;
```

載入 `events` 後，試按 23:07 這個交界切一日。剛好 23:07:00 的 `e90` 只進右窗，晚到也不改變歸屬。如果發現前後窗的合計和同口徑全日不一樣，先查是否用不同欄位或不同去重粒度，不要在總計末端平帳。若一個編號的副本有不同時間，需要先定哪個版本代表該事件，才能保證同事件只落一個窗。

**方言。** MySQL、Spark SQL、Hive SQL 都能用 `>=` 和 `<`；用月份算尾端時，DuckDB 可加 `INTERVAL '1 month'`，MySQL 通常用 `DATE_ADD(start, INTERVAL 1 MONTH)`，Spark SQL／Hive SQL 可用 `add_months`。務必從月首算，不能拿 31 號加一個月就假設得到下月月首。

### 兩張分表怎麼證明不重複也不漏？

先把比較欄與兩個窗口界線都寫出來，再挑三個時刻在紙上試算：交界前一個最小時間單位、恰在交界、交界後一個最小單位。期望是「只左、只右、只右」。若把交界改成兩端都小於，恰在交界的那筆兩份都沒有；若兩端都包含，它又同時出現。測試別只選交界前後，不選交界本身，那兩種錯法都可能混過去。

對真實數據可先做逐事件的驗收列表：每列帶出原時間、身分鍵、窗名，確認某筆恰在交界能對到哪一側；再按窗合計，並與全日同口徑結果比較。若有空窗，行仍需保留，使報表讀者知道這段是已查過但沒有事件。若事實表還允許缺時間，應在另一張質量清單列出缺失數，不能假設 NULL 是今天或昨天。

直接使用原欄和型別一致的範圍有時也能讓引擎做分區裁剪（partition pruning），即略過不用讀的分區。是否生效要看實際分區鍵和執行計畫；如果表是按另一路徑上的日期切分，仍可能需要另外限制該分區欄。不要把這點和 SQL 的邏輯結果混為一談。

## 常見錯誤

- 交界被數兩次 → 每窗用了 `BETWEEN` → 把上限改成嚴格小於。
- 最後零點前的小數秒漏列 → 終點硬填 23:59:59 → 用下一日的開頭。
- 左連接結果沒有空窗 → 時間條件寫在 WHERE → 移至 ON，從窗口表保留各窗。
