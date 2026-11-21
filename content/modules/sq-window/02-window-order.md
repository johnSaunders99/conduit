---
id: sq-window-02
module: sq-window
order: 2
title: 窗口排序
subtitle: 把同秒事件排出可解釋順序
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-01
objectives:
- 分開寫計算排序與顯示排序
- 讓同秒事件有固定先後
- 用遲到事件比對兩種時間口徑
tags:
- window-order
- 平手規則
- 事件時間
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀窗口排序與缺省排序框，確認平手行為。
- title: Spark SQL：窗口函式
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-window.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Spark 的排序與 NULLS 選項。
- title: MySQL：窗口框
  url: https://dev.mysql.com/doc/refman/8.4/en/window-functions-frames.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的目前列與同值列。
concepts:
- id: sq-window-02-sort
  prompt: OVER 內的 ORDER BY 會保證結果畫面同樣排序嗎？
  answer: 不會。窗口內排序決定計算對象的先後；畫面由最外層 ORDER BY 保證。
  mcq:
    options:
    - 會，但只有 DESC 時
    - 不會，內層排序完全無效
    - 不會，兩處排序職責不同
    - 會，外層一律繼承
    answer: 2
    explain: 計算順序與輸出順序是兩件事，兩處需求各自明寫。
- id: sq-window-02-tie
  prompt: 同一會員有兩筆 event_at 相同，要固定先後可加哪個欄？
  answer: 加能唯一區分兩筆的 raw_id 作第二排序鍵；event_id 在重送時不唯一。
  mcq:
    options:
    - 同一會員的 user_id
    - 已知相同的 event_at
    - 重送時相同的 event_id
    - raw_id
    answer: 3
    explain: 平手規則必須真的能區分兩列，不能重複比較相同資訊。
  interview:
    question: 事件看板要還原使用者先看再買，你用哪個時鐘？
    points:
    - 事件時間優先
    - 以唯一鍵打破平手
    - 接收時間只用於接收分析
    answer: 我要重建行為就按 event_at，時間相同時再看定義好的接收鍵。接收時間是管道看到事件的時點，遲到時把它用來代表行為會顛倒先後。
- id: sq-window-02-clock
  prompt: late event 的 event_at 和 received_at 分別回答什麼？
  answer: event_at 是行為何時發生；received_at 是管道何時收到。晚到可能改變兩種排列的結果。
  mcq:
    options:
    - 發生時間與接收時間
    - 都是同一時鐘，必然相同
    - 接收時間與事件號
    - 是否成交與是否退款
    answer: 0
    explain: 業務分析和管道診斷使用不同時間，不能為省事交換。
practice:
- kind: sql
  category: [window, sort]
  title: 為兩筆同秒接收固定先後
  minutes: 6
  level: 1
  dataset: events
  prompt: |
    只看 event_id 為 e220 的接收列，不去重。依事件時間先後累計已到目前位置的列數 `step_no`，同秒時 raw_id 小的先算。

    只輸出以下欄位，欄序固定：`raw_id`、`event_id`、`step_no`。

    排序：畫面刻意按 `raw_id` 降序。
  solution: |
    SELECT raw_id, event_id,
           COUNT(*) OVER (ORDER BY event_at, raw_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS step_no
    FROM app_events WHERE event_id = 'e220'
    ORDER BY raw_id DESC;
  explain: |
    畫面先看到 55，但其 step_no 為 2；54 的 step_no 為 1。不能把最外層降序直接用作窗口順序。
  hints:
  - 內外排序方向可以不同。
  - 有相同 event_at 時，加入 raw_id。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-02-sort
  - sq-window-02-tie
  - sq-window-01-partition
  tags:
  - 窗口排序
  - 平手
  id: sq-window-02-p1
- kind: sql
  category: [window, time]
  title: 比對行為順序與接收順序
  minutes: 8
  level: 2
  dataset: events
  prompt: |
    只看 session_id 為 s9 的接收列，兩個序號都從 1 開始：`event_no` 為按 event_at 升序計到目前列的筆數，`arrival_no` 為按 received_at 升序計到目前列的筆數；時間相同時均以 raw_id 升序定先後。

    只輸出以下欄位，欄序固定：`raw_id`、`step`、`event_no`、`arrival_no`。

    排序：`raw_id` 升序。
  solution: |
    SELECT raw_id, step,
           COUNT(*) OVER (ORDER BY event_at, raw_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS event_no,
           COUNT(*) OVER (ORDER BY received_at, raw_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS arrival_no
    FROM app_events WHERE session_id = 's9'
    ORDER BY raw_id;
  explain: |
    22 號 view 發生在 cart 前，卻比 23 號晚收到。換兩次外層排序無法產生兩種序號；每個窗口要選自己的時間欄。
  hints:
  - 在同一份輸入上寫兩個 COUNT OVER。
  - 每個窗口各用對應的時鐘。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-02-clock
  - sq-window-02-sort
  - sq-window-01-whole
  tags:
  - 事件時間
  - 接收順序
  id: sq-window-02-p2
---

事件接收表裡，兩列可能記著同一秒，甚至是同一個事件重送。報表要標出誰先誰後，不能靠表格現在碰巧顯示的順序。這堂故意讓畫面把最新的接收列擺上面，但序號仍從行為較早的列開始算。

## 兩個 ORDER BY，不是重複工作

- `OVER (PARTITION BY 分組鍵 ORDER BY 時間, 唯一鍵 …)`：決定每組的計算順序。只分析一個已篩好的會話時，可以不寫分區。時間一般是第一排序鍵，唯一鍵讓時間相同時也有固定先後。
- `… FROM 來源 ORDER BY 欄位`：決定最後拿到的列怎麼顯示，不會反過來改變窗口的運算。
- 本課用 `COUNT(*)` 搭配 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` 表示「從組首數到目前這一列」。這段範圍稱窗口框（window frame，台灣也稱視窗框架），後面的[〈ROWS 與 RANGE〉](#/lesson/sq-window-07)會拆解其邊界。今天只先觀察哪筆拿到哪個位置。

在 SQL 練習場的「自由練習」選 `events` 數據集，執行：

```sql
SELECT raw_id, event_id,
       COUNT(*) OVER (
         ORDER BY event_at, raw_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS event_pos
FROM app_events WHERE event_id = 'e110'
ORDER BY raw_id DESC;
```

e110 的兩次接收分別是 26 和 27；事件時間相同，照接收鍵打破平手後，26 的位置是 1，27 是 2。畫面降序時卻會先秀 27。若只按事件時間，兩個接收列在窗口內是平手，逐列的位置沒有足夠資訊可決定。將 raw_id 改為窗口內降序試一次，這兩個位置會交換；改外層排序則只會交換畫面。

另外，事件時間（event time）代表行為發生，接收時間（arrival time）代表管道收到。s9 的 view 發生在 cart 前，卻延遲收到。要還原行為就用事件時間，要解釋接收先後才用接收時間。就算兩個時間欄都叫時間戳，也不是替代品。

DuckDB 和 Spark SQL 能寫 `NULLS FIRST` 或 `NULLS LAST`。若要把「缺值排最後」的規則也帶到 MySQL，可先排 `CASE WHEN 欄位 IS NULL THEN 1 ELSE 0 END`，再依欄位本身排列，避免依賴引擎預設。本課的主排序鍵沒有缺值，仍必須明確處理平手。

## 把平手規則寫成可以驗收的句子

不要只說「按時間排序」。補一句「若事件時間相同，接收列識別碼小的先」，讀者就知道為什麼 26 搶在 27 前。這個序號定義的是接收列：若兩筆其實是同一次業務事件，時間排序不負責把它變成一筆。要重建業務事件序列時先決定是否去重，保留哪個版本，再按選出的列排序；兩個目的都合理，但數出的位置不同。

要測選錯時鐘，可只畫 s9：22 號先發生，23 號先收到。在兩張時間線上各標 1 和 2，再對照第二題的兩欄。若兩個序列一模一樣，先檢查兩個窗口是否誤抄成同一個時間欄。也不要推論接收列識別碼小就一定比較早收到，選接收時鐘要以 `received_at` 為主。

用顯式框時，這段 `COUNT(*)` 是逐列累進的；下一堂練[〈ROW_NUMBER〉](#/lesson/sq-window-03)，可以用更直接的函式取得位置，仍然要指定相同的排序條件。

## 常見錯誤

- 重送的兩列位置不固定 → 加上能區分每列的次排序鍵。
- 最終畫面亂序卻加更多窗口排序 → 在外層另寫 ORDER BY。
- 晚收到就當作晚發生 → 先問指標要看哪個時鐘。
