---
id: sq-metrics-01
module: sq-metrics
order: 1
title: ODS 原始數據層
subtitle: 保留可追溯的來源批次
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 保留接收列、來源及批次的半開區間
- 並排事件日與接收日，找晚到及重送
tags:
- ODS
- 批次
- 接收時間
resources:
- title: DataWorks：數倉分層
  url: https://help.aliyun.com/zh/dataworks/user-guide/data-warehouse-layering
  kind: doc
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 只讀 ODS，對照保留來源的目的。
concepts:
- id: sq-metrics-01-raw
  prompt: 原始層為何要保留 e110 的兩次接收？
  answer: 原始層記錄這批實際收到什麼，保留重送供重播和核對；明細層再按業務鍵去重。
  mcq:
    options:
    - 只保留最後的數據
    - 保留兩筆原始接收
    - 把兩筆先取平均
    - 兩筆事件 ID 不同才保留
    answer: 1
    explain: 接收列和業務事件的粒度不同，原始層不可預先改寫證據。
- id: sq-metrics-01-clocks
  prompt: 接收時間與事件時間能通用嗎？
  answer: 不能。接收時間找批次與遲到；事件時間定業務日期。
  mcq:
    options:
    - 兩者用目前時間都一樣
    - 接收時間就是事件時間
    - 前者定位批次，後者定位業務歸屬
    - 晚到時把事件時間改寫成接收時間
    answer: 2
    explain: 晚到是一份證據，不應被數據清洗抹去。
  interview:
    question: 下游說 2 月 4 日事件少一筆，你從 ODS 找什麼？
    answer: 我先用 2 月 4 日的事件時間找鍵，再看它的接收時間和批次。如果是 2 月 6 日才收到，就可以用這筆接收紀錄解釋昨日報表，並保留重算該日的依據。
    points:
    - 分清兩個時鐘
    - 保留接收鍵和批次
    - 能說明晚到與重算
- id: sq-metrics-01-batch
  prompt: 批次定為每天從零時到下一天零時，為什麼不包含上界？
  answer: 下一天零時是下一批的下界，只有一批會收。
  mcq:
    options:
    - 順便排除所有晚到
    - 確保批次永遠非空
    - 讓事件日期一定等於接收日期
    - 避免相鄰批次重複接收邊界
    answer: 3
    explain: 時間區間切界和業務日期屬於不同問題。
- id: sq-metrics-01-replay
  prompt: 今天重跑同一個匯入批次，是否要保留第二份完全相同的接收鍵？
  answer: 不要把載入器的重跑當成來源的新接收。使用批次及接收鍵保證同批資料不重複寫入。
  mcq:
    options:
    - 複製同批所有列
    - 先依事件鍵永久去重
    - 只保留最後到達的一列
    - 不新增相同批次的同一接收鍵
    answer: 3
    explain: ODS 要忠實保留來源重送，但載入任務重試人為產生的副本不是新的來源證據。
practice:
- id: sq-metrics-01-p1
  kind: sql
  category: [model, time]
  title: 為接收列標上批次
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    取 received_at 在 2026-02-04 零時（含）至 02-05 零時（不含）的所有接收列，不去重。輸出 raw_id、event_id、source_name（固定 app_events）、batch_day（接收時間轉 DATE），依 raw_id 升冪。
  solution: |
    SELECT raw_id, event_id, 'app_events' AS source_name, CAST(received_at AS DATE) AS batch_day
    FROM app_events
    WHERE received_at >= TIMESTAMP '2026-02-04 00:00:00'
      AND received_at < TIMESTAMP '2026-02-05 00:00:00'
    ORDER BY raw_id;
  explain: |
    同事件 e110 在同批接收兩次；ODS 保留兩筆，批次條件看 received_at 而非 event_at。
  hints:
  - 不要 DISTINCT
  - 用接收時間做半開區間
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-01-raw
  - sq-metrics-01-batch
  - sq-metrics-01-clocks
  tags:
  - ODS
  - 批次
  - 接收時間
- id: sq-metrics-01-p2
  kind: sql
  category: [model, time]
  title: 分出延後接收的登入
  minutes: 8
  level: 3
  dataset: logins
  prompt: |
    列出在 2026-01-18 零時（含）至 01-19 零時（不含）收到，但登入日在 01-18 之前的登入列。輸出 login_id、login_day（login_at 轉 DATE）、batch_day（received_at 轉 DATE）、channel，依 login_id 升冪。
  solution: |
    SELECT login_id, CAST(login_at AS DATE) AS login_day,
           CAST(received_at AS DATE) AS batch_day, channel
    FROM login_log
    WHERE received_at >= TIMESTAMP '2026-01-18 00:00:00'
      AND received_at < TIMESTAMP '2026-01-19 00:00:00'
      AND login_at < TIMESTAMP '2026-01-18 00:00:00'
    ORDER BY login_id;
  explain: |
    登入 96 與 101 都要回補到 1 月 17 日。只以接收時間來推斷登入日，會把舊活動搬到新的一天。
  hints:
  - 兩個時鐘一起選
  - 用接收時間找本批，再判登入時間
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-01-clocks
  - sq-metrics-01-batch
  tags:
  - ODS
  - 批次
  - 接收時間
---

2 月 4 日收到的事件裡，同一個瀏覽 e110 送了兩次；同一天發生的 e90 卻晚兩天才送達。如果覆蓋舊數據，主管問報表為何少一筆時，你將沒有紀錄回答。數倉原始層不是報表，它應告訴你當時究竟收到什麼。

## 原始層的一列是一次接收

原始數據層（operational data store，ODS；此處採數倉分層的用法）接住來源數據，保留可重建下游的證據。常留下來源物件、來源列鍵或偏移量、批次識別碼、入庫時間與原始金額等業務欄位。若格式解析失敗，記錯誤並保留安全的原始參照，不要用猜出的值冒充來源。

- 接收時間（ingestion time）回答「這批何時收？」同一事件重送可能有兩筆此時間。
- 事件時間（event time）回答「這件事何時發生？」它決定業務歸屬。
- 批次（batch）是一組可一起重跑的接收範圍。若按日期切，零時是界線；採用 `>= 起點 AND < 終點`，上界不重複算下一批。
- 接收鍵（receipt key）回指單次接收；事件鍵（event key）辨認業務動作。保存原始不等於無限期留所有內容；數據留存及讀取仍要依權限和期限控管。

## 看見重送，不急著刪

在 SQL 練習場選 `events`。下例把接收時間轉成批次日，e110 仍顯示兩列；若用事件鍵取唯一就失去證據。若同一批檔案被重跑，仍要以檔案鍵和批次識別碼防止載入器重複寫入；那與來源本身重送的兩筆不是一回事。

```sql
SELECT raw_id, event_id, CAST(received_at AS DATE) AS batch_day
FROM app_events WHERE event_id = 'e110' ORDER BY raw_id;
```

留一份小樣本，把「來源、接收 ID、批次日」交給下一層，日後錯了可以切回這一批查。之後在[〈DWD 明細數據層〉](#/lesson/sq-metrics-02)會把重送依業務合併；在[〈全量與增量比對〉](#/lesson/sq-audit-04)會用兩種時間找出要回補的日期。

## 讓下一班能回答這批是否到齊

除了原始列，也留一份批次清冊。寫下來源預期交付幾個檔案、實收幾個、解析成功與被隔離各幾筆，以及重跑時用哪個識別碼。這些計數用於辨認載入是否完整，不能取代事件本身的業務數量。比如某批接收 2 列，但只含 1 個事件；兩個數可以同時正確。帶著接收鍵就能在下游只出現一次時解釋差異，不需要靠猜測改動歷史。

## 常見錯誤

- ODS 的重送消失 → 太早依事件鍵去重 → 先完整保留接收列。
- 晚收到的 2 月 4 日事件被當 2 月 6 日活動 → 把入庫時鐘當業務時鐘 → 分欄記兩者。
- 同一批重跑後又多一批 → 沒有相同批次的寫入防重策略 → 用固定批次識別碼及來源接收鍵核對。

## 方言與面試

DuckDB 的 `CAST(時間 AS DATE)` 在這份無時區小樣本直接取日期；Spark SQL 若原欄是帶本地時區語意的時間戳，轉日期需先核對工作階段時區。MySQL 的 `DATE(時間)` 也可取日期，但先確認欄是 `TIMESTAMP` 還是 `DATETIME`，兩者對連線時區的行為不同。別把欄型別差異誤判成來源晚到。
