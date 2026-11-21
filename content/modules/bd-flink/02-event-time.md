---
id: bd-flink-02
module: bd-flink
order: 2
title: 事件時間與處理時間
subtitle: 凌晨送來昨天的訂單
status: ready
minutes: 35
level: 3
prereqs:
- bd-flink-01
objectives:
- 分辨事件、接收和處理三種時間
- 用跨午夜事件核對兩種日報歸屬
- 指出重播時何者可重現
tags:
- event time
- processing time
- 時間口徑
- 跨日
resources:
- title: Flink：時間與事件順序
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 比較事件與處理時間，留意結果可重現性。
- title: Flink：時間屬性
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/sql-table-concepts/time_attributes/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀事件時間欄何時需指定時間屬性。
concepts:
- id: bd-flink-02-event
  prompt: 週一 23:59 付款，週二 00:02 才收到，週一付款日報應算在哪一天？
  answer: 依事件時間算週一；另用接收或處理時間追延遲。
  mcq:
    question: 週二重播週一付款，哪項通常不應跟著改？
    options:
    - 作業處理時間
    - 重新接收的機器時間
    - 業務付款發生時間
    - 當次查詢執行時間
    answer: 2
    explain: 重播不改原事件時間；其他時間可與執行時刻或接收流程一起變。
  interview:
    question: 昨天支付比流水多 3%，你先查哪個時間欄？
    points:
    - 先確認指標日界與時區
    - 用跨日樣本對照事件與接收時間
    - 以事件鍵檢查重複與回補
    answer: 先問兩張表是不是都按付款發生時間且同一時區。我會挑午夜前後的樣本，用事件鍵逐筆核對兩個日期和重送；若只是午夜後才收到，就修歸屬再對總額。
- id: bd-flink-02-processing
  prompt: received_at 一定等於 Flink 處理時間嗎？
  answer: 不一定；它是接收端記錄的時間，作業可能稍後才處理。
  mcq:
    question: 訊息已進 Kafka，但 Flink 兩分鐘後才處理，哪個欄不能直接代替 Flink 的處理時間？
    options:
    - Flink 作業實際取機器時鐘所得的值
    - 紀錄原有的 received_at
    - 作業執行當刻的系統時間
    - 該運算子收到時取的時鐘
    answer: 1
    explain: 接收與處理可以位於不同服務，應分段觀測。
- id: bd-flink-02-timezone
  prompt: 同一 timestamp 在不同時區切日，比對之前要先統一什麼？
  answer: 將時刻轉到共同業務時區，或明訂已是同一個本地時間，再截為日期。
  mcq:
    question: 想比對日結差異，最安全的第一步？
    options:
    - 先刪掉所有午夜附近事件
    - 任由兩張表選各自時區
    - 先統一時區與業務切日規則
    - 只比事件的分鐘欄
    answer: 2
    explain: 跨日樣本最有診斷價值；若切日口徑不同，差異未必來自遺失。
practice:
- id: bd-flink-02-p1
  kind: sql
  category: [time]
  title: 找出收到時已跨日的事件
  minutes: 6
  level: 2
  dataset: events
  prompt: |
    `app_events` 的兩欄已是同一業務本地時間。只取接收日期與發生日期不同的接收列，不去重。依次輸出 `raw_id`、`event_id`、`event_day`（發生日）、`receive_day`（接收日），日期類型均為 DATE。依 `raw_id` 升序。
  solution: |
    SELECT raw_id, event_id, CAST(event_at AS DATE) AS event_day,
           CAST(received_at AS DATE) AS receive_day
    FROM app_events
    WHERE CAST(event_at AS DATE) <> CAST(received_at AS DATE)
    ORDER BY raw_id;
  explain: |
    先轉 DATE 才是在比日界；直接比 timestamp 會把同日但延遲的列也算進來。這是 DuckDB 的離線對帳，不把 received_at 當 Flink 的 PROCTIME。
  hints:
  - 比較的是兩個日期，不是兩個完整時間戳。
  - WHERE 兩側都先轉為 DATE。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-02-event
  - bd-flink-02-processing
  - sq-window-02-clock
  tags:
  - 跨日
  - 時間口徑
- id: bd-flink-02-p2
  kind: sql
  category: [time, aggregate]
  title: 同一批登入用哪一天統計
  minutes: 7
  level: 3
  dataset: logins
  prompt: |
    把每筆登入當作一筆，不按人去重。以發生日作為統計日，求當日總登入 `login_n` 和其中接收日期不同的筆數 `shifted_n`，只保留 `shifted_n > 0` 的日子。欄位依次為 `login_day`（DATE）、`login_n`、`shifted_n`，按 `login_day` 升序。
  solution: |
    WITH dated AS (
      SELECT CAST(login_at AS DATE) AS login_day,
             CAST(received_at AS DATE) AS receive_day
      FROM login_log
    )
    SELECT login_day, COUNT(*) AS login_n,
           COUNT(*) FILTER (WHERE receive_day <> login_day) AS shifted_n
    FROM dated GROUP BY login_day
    HAVING COUNT(*) FILTER (WHERE receive_day <> login_day) > 0
    ORDER BY login_day;
  explain: |
    先對所有登入做同日聚合，不能先在 WHERE 刪除同日抵達的列，否則分母也變了。Flink SQL 的處理時間由作業另產生，這題只對照共享數據中的兩個時鐘。
  hints:
  - 先用 CTE 取兩個日期。
  - 用 HAVING 篩掉沒有跨日列的整組。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-02-event
  - bd-flink-02-timezone
  - sq-compose-02-population
  tags:
  - 日期分組
  - 條件計數
---

週一 23:59 付款的顧客，週二 00:02 才被收件服務記下；數據作業因等前一批又晚了一分鐘。這筆在「週一支付」和「週二管道壓力」都應被看到，卻不在同一天。事件時間（event time）描述業務何時發生；接收時間（ingestion time）是指定接收站何時拿到；處理時間（processing time）是作業執行時的機器時間。不要只用欄名 `ts`，交接時要寫是哪個時鐘、由哪一站記錄。

## 口徑先寫在數字旁

- 支付歸屬按業務發生時間：同一筆重播於週三，仍算週一。
- 接入是否變慢看事件時間到接收時間；若來源時鐘不準或跨時區錯配，要先修兩欄可比性。
- 運算或下游卡多久，看接收後到實際處理完成的時間。接收時間不是 Flink 的處理時間；中間經 Kafka 可能已累積不少等待。

先在指標定義固定業務時區和日界，再從時間戳（timestamp）取日期。共享數據集 `events` 的兩欄已按同一業務本地時間記錄。若換成實務儲存 UTC 的時間戳，應先轉到共同的業務時區，再切成日期，不能只在兩台機器各做一次日期轉換。不同分店若有不同營業日，也要將規則寫進維度或指標定義，不可用上線機器的時區碰運氣。

在 SQL 練習場自由練習選 `events`，跑下列 DuckDB 查詢。`CAST(時間 AS DATE)` 是取日期；`<>` 比較不同日，不能直接用完整時間戳比較，以免把相差幾秒的同日事件也算跨日。這裡算原始接收列，事件重送仍算另一列；訂單金額則應有獨立的事件去重口徑。

```sql
SELECT raw_id, step,
       CAST(event_at AS DATE) AS event_day,
       CAST(received_at AS DATE) AS receive_day
FROM app_events
WHERE CAST(event_at AS DATE) <> CAST(received_at AS DATE)
ORDER BY raw_id;
```

結果有 7 筆，例如 `raw_id=115` 由 2 月 16 日跨到 2 月 18 日。挑一筆畫入庫線：如果將它誤算到接收日，本日少 1、另一天多 1，但整月總數可能沒變。這就是只查月總額很難抓到的錯誤。作業如果定期依事件時間出報告，還要訂「等到什麼程度才公告」；[〈浮水印與閒置分區〉](#/lesson/bd-flink-03)會決定這個時刻，不會從 SQL 的 `CAST` 自動得到。

## 重播時要用哪個時鐘

想驗證可重現性，在白紙上把同一事件由週二再處理一次改成週三：原發生日不變，這次處理時間會變。若看板口徑按處理時間，重播會把今日流量突然拉高；它適合服務運行度量，不是支付發生量。Flink SQL 的 `PROCTIME()` 是系統產生的處理時間屬性，原有 `received_at` 仍是來源欄位。這堂先用有限數據查兩個保存下來的欄，不假裝能替代實時引擎的時鐘。

如果兩個時間欄相差為負，先檢查時區、時鐘偏差和欄位來源，不要把負值硬改為零再做延遲報表。

## 常見錯誤

- 統計跨日列卻得到一堆同日列 → 比了完整 timestamp → 先統一時區再取日期。
- 凌晨重播讓昨日付款消失 → 分到了重跑當日 → 日報用事件時間，重跑負載另算。
- 看到接收快就斷言看板即時 → 沒量下游積壓 → 另記完成或查詢可見時間。
