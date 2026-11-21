---
id: bd-flink-04
module: bd-flink
order: 4
title: 滾動與滑動窗口
subtitle: 每五分鐘更新近一小時
status: ready
minutes: 35
level: 3
prereqs:
- bd-flink-03
objectives:
- 用左閉右開口徑判定事件的窗口
- 區分窗口長度與每次滑動的步長
- 用 DuckDB 核對 Flink SQL 窗口應產出的計數
tags:
- tumble
- hop
- window TVF
- 半開區間
resources:
- title: Flink 2.3：窗口表值函式
  url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/sql/reference/queries/window-tvf/
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 對照 TUMBLE、HOP 參數與輸出欄。
concepts:
- id: bd-flink-04-boundary
  prompt: 在 [12:00,12:05) 與 [12:05,12:10) 中，12:05:00 屬哪一窗？
  answer: 只屬於 [12:05,12:10)。
  mcq:
    question: 12:05:00 落在哪裡？
    options:
    - 只落在前一個滾動窗口
    - 兩個滾動窗口都算
    - 只落在以 12:05 開始的滾動窗口
    - 兩窗都不算
    answer: 2
    explain: 含左邊界、不含右邊界，接壤的滾動窗口不重疊。
  interview:
    question: 看板要求每 5 分鐘報過去 10 分鐘，如何做？
    points:
    - 選 10 分鐘窗口、5 分鐘步長
    - 左閉右開及一事件可多窗
    - 用事件時間浮水印決定出數
    answer: 我會用 HOP，步長 5 分、長度 10 分。先用 12:05 正好在邊界的事件核對兩窗歸屬，再用晚到事件驗收關窗與修正政策。各窗的總數不能直接加成總事件數。
- id: bd-flink-04-hop
  prompt: 窗口長 10 分鐘、每 5 分鐘開窗，12:07 屬於幾窗？
  answer: 對齊整 5 分鐘時，屬於 [12:00,12:10) 與 [12:05,12:15) 兩窗。
  mcq:
    question: 12:07 屬於哪兩個開始時間？
    options:
    - 12:00 與 12:05
    - 12:05 與 12:10
    - 12:07 與 12:12
    - 12:00 與 12:10
    answer: 0
    explain: 先列能覆蓋事件的開始點，再檢查右界是否晚於事件。
- id: bd-flink-04-windows
  prompt: 為何不能把滑動窗口的筆數逐窗相加求總事件數？
  answer: 窗口有重疊，同事件被計入多窗；總數應回明細計算。
  mcq:
    question: 滑動結果相加比原始事件多，合理原因是什麼？
    options:
    - 重疊窗口共享事件
    - 時間欄一定已壞
    - 每窗只可能有唯一使用者
    - 從結果加總永遠等於明細
    answer: 0
    explain: 先確認是否因窗口重疊；如果維護指標還要查重送等口徑。
practice:
- id: bd-flink-04-p1
  kind: sql
  category: [time]
  title: 核對五分鐘滾動窗口
  minutes: 6
  level: 2
  dataset: events
  prompt: |
    取 `app_events` 中 `step = 'pay'` 且事件日為 2026-02-02 的接收列，不去重。每筆按 `event_at` 放入自整 5 分鐘起的滾動窗口，無事件的窗口不造列。只輸出 `window_start`（TIMESTAMP）、`pay_n`，依序列欄，按 `window_start` 升序。
  solution: |
    SELECT time_bucket(INTERVAL '5 minutes', event_at) AS window_start,
           COUNT(*) AS pay_n
    FROM app_events
    WHERE step = 'pay' AND CAST(event_at AS DATE) = DATE '2026-02-02'
    GROUP BY 1 ORDER BY 1;
  explain: |
    `time_bucket` 回傳事件所在的 5 分鐘開始點，Flink 原生串流寫法則是 TUMBLE 表值函式加時間屬性。按 received_at 分窗會把延遲付款放錯。
  hints:
  - 桶寬用 5 分鐘。
  - 先以事件時間篩日期。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-04-boundary
  - bd-flink-02-event
  tags:
  - 滾動窗口
  - 時間分桶
- id: bd-flink-04-p2
  kind: sql
  category: [time, interval]
  title: 驗證每筆付款可進兩個滑動窗口
  minutes: 8
  level: 3
  dataset: events
  prompt: |
    取 2026-02-02 當天發生的所有 `pay` 接收列，不去重。固定在每個整 5 分鐘開始、長 10 分鐘的窗口，跨午夜的窗口也保留，只列至少含一筆輸入的窗口。只輸出 `window_start`（TIMESTAMP）、`window_end`（TIMESTAMP）、`pay_n`，欄序照列，依 `window_start` 升序。
  solution: |
    WITH starts AS (
      SELECT time_bucket(INTERVAL '5 minutes', event_at)
               - mins * INTERVAL '1 minute' AS window_start
      FROM app_events CROSS JOIN (VALUES (0),(5)) AS offsets(mins)
      WHERE step = 'pay' AND CAST(event_at AS DATE) = DATE '2026-02-02'
    )
    SELECT window_start, window_start + INTERVAL '10 minutes' AS window_end,
           COUNT(*) AS pay_n
    FROM starts GROUP BY 1 ORDER BY 1;
  explain: |
    步長整除窗口長度、且對齊整 5 分時，每列隸屬自身所在桶及前一桶開的窗口；只用一個 time_bucket 會漏前一窗。原生 Flink HOP 可為每事件展開相應窗口。
  hints:
  - 每筆生成兩個開始點。
  - CROSS JOIN 兩個偏移值 0 與 5。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-04-hop
  - bd-flink-04-windows
  - bd-flink-02-event
  tags:
  - 滑動窗口
  - 交叉連接
---

營運要「每 5 分鐘報告過去 10 分鐘付款」，財務只想要「每 5 分鐘一格、格子能合回一天」。這不是只差一個數字。滾動窗口（tumbling window；台灣也稱滾動視窗）連續且不重疊；滑動窗口（sliding window，也稱 hopping window）有長度與步長，步長比長度短時相鄰窗口重疊。談的是切割串流的事件時間，不是把 SQL 明細保留下來的 `OVER` 窗口函式。

## 將左邊界算進去，右邊界留給下一窗

`[12:00,12:05)` 包含 12:00，但不含 12:05；下一格從 12:05 開口，付款在切點只算一次。改成每 5 分鐘開一個長 10 分鐘的窗口，12:07 同時屬於 `[12:00,12:10)` 與 `[12:05,12:15)`。12:10 不在第一個窗口，但會進從 12:05、12:10 開的兩個窗口。不要把每一窗的結果再相加冒充事件數。要把日總額從窗格合回去，應選不重疊區間，或直接從明細重算。

Flink SQL 的窗口表值函式（window table-valued function）會為每筆加上窗口邊界；再用 `GROUP BY window_start, window_end` 才能聚合每窗。實時模式的事件時間窗口需要上游時間屬性與[〈浮水印與閒置分區〉](#/lesson/bd-flink-03)的進度。相同 SQL 邏輯在有限樣本之上能核對歸屬，卻不能替實時作業驗證遲到行為。

- `TUMBLE(TABLE input, DESCRIPTOR(event_at), INTERVAL '5' MINUTE)`：最後一項是窗口長度。
- `HOP(TABLE input, DESCRIPTOR(event_at), INTERVAL '5' MINUTE, INTERVAL '10' MINUTE)`：先步長、後長度。`DESCRIPTOR` 指定哪欄提供時間。
- 上面兩項是 Flink 的語法骨架，不可貼進 DuckDB。下面用有限數據模擬同一種時間切格。

## 先核對落在哪一窗，再看計數

在 SQL 練習場選 `events` 跑 DuckDB。`time_bucket` 按 5 分鐘對齊，下面這個樣本讓你一眼看出開始與結束。如果事件剛好位於 23:55，開始就是 23:55；不是前一個 23:50。

```sql
SELECT raw_id, event_at,
       time_bucket(INTERVAL '5 minutes', event_at) AS window_start,
       time_bucket(INTERVAL '5 minutes', event_at) + INTERVAL '5 minutes' AS window_end
FROM app_events
WHERE raw_id IN (10, 11, 12, 13)
ORDER BY raw_id;
```

接收序號 `raw_id=11`，發生時間 23:59，窗口從 23:55 到次日 00:00；下一天 00:03 的 `raw_id=13` 已是次日第一窗。挑這些跨午夜樣本看看邊界，比只在正午挑一筆更能驗證。若業務一天不是從 00:00 算起，先固定營業日與窗口原點，不要用預設對齊猜財務口徑。

可以用兩張紙驗收同一個時刻。第一張畫 12:00、12:05、12:10 三個切點，每條線之間是一個滾動窗；把事件貼在屬於它的格子。第二張在每條線上開一段 10 分鐘的範圍，事件若在兩個範圍內就寫兩次。把「一份事件、多個窗口」顯式畫出來，再看結果總和為何可能變大。滑動窗口不是在上一格上直接附加全部數據；如果自行寫增量演算法，還要移掉退出範圍的值。最後用一筆剛好位於右界、一筆晚到但未越浮水印、一筆在封窗後才到的事件驗收。這三筆分別測歸屬、等待和修正政策，不能由同一個準時的範例代替。

若業務希望展示沒有付款的窗口，要另建完整窗口清單再接回結果；不應把未填補的時間誤當成零。

## 常見錯誤

- 把窗口右界也算進去 → 接壤事件重複 → 用左閉右開。
- 寫滑動窗口時對調步長和長度 → 產生錯誤的重疊或規格不合法 → 先口述「每 5 分、看 10 分」。
- 收到事件就要求交付最終值 → 實時要看進度 → 另外以遲到事件驗收結算時刻。
