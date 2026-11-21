---
id: cl-contract-01
module: cl-contract
order: 1
title: 來源新鮮度
subtitle: 昨天的數字為何還沒到
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
- 分別計算最近接收時間與最近業務時間
- 用固定觀測時刻判定連線來源的延遲等級
- 寫出新鮮度告警的責任與完整性補查
tags:
- 來源新鮮度
- 接收時間
- 事件時間
- SLA
resources:
- title: dbt：freshness 設定
  url: https://docs.getdbt.com/reference/resource-configs/freshness
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀警告、錯誤閾值與載入時間欄的設法。
- title: dbt：來源新鮮度檢查
  url: https://docs.getdbt.com/docs/deploy/source-freshness
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看獨立檢查的時機與檢查輸出。
concepts:
- id: cl-contract-01-arrival-clock
  prompt: 問「上游多久沒送列？」應看哪個時鐘？
  answer: 以觀測時刻減去最後載入或接收時間，不用最後業務事件日代替。
  mcq:
    options:
    - 最新 event_at
    - 最早業務日
    - 最新 received_at
    - 所有列數
    answer: 2
    explain: 營業日與到達日服務不同問題；列數也無法直接給出延遲。
- id: cl-contract-01-complete
  prompt: 來源新鮮度通過，能否保證昨天數據完整？
  answer: 不能；單一新列就能刷新最大時間。還需按批次、分區或應到清單檢查完整性。
  mcq:
    options:
    - 可以，最新列代表所有列都來了
    - 不能，另驗應到批次
    - 要看表名是否含日期
    - 只要金額非負就完整
    answer: 1
    explain: 新鮮度只是最近時間的訊號，不測是否每個分片都來。
  interview:
    question: 來源新鮮度綠燈，但營運說缺了某地區，你怎麼查？
    answer: 先確認新鮮度只代表最近有列。按約定的地區和批次列出應到集合，對照收到的列數。若沒齊，給報表標延遲或據規則暫停發布，聯絡來源擁有者。
    points:
    - 區分新鮮度和完整性
    - 有批次或分區證據
    - 說明是否發布和通知
- id: cl-contract-01-as-of
  prompt: 為何練習不用現在時間作唯一基準？
  answer: 指定同一觀測時刻，使結果可比較、可重跑，也避免把靜態歷史樣本誤當實時來源。
  mcq:
    options:
    - 因為時間不會變
    - 因為來源列不能有時間欄
    - 因為所有來源都要用午夜
    - 為了得到可重現的測試
    answer: 3
    explain: 固定觀測不表示生產不用現在時間，而是讓測試不隨執行日漂移。
- id: cl-contract-01-missing
  prompt: 數據完全沒到，可把查無最新時間當成通過嗎？
  answer: 不可以，應標成缺失或錯誤並通知負責方；沒有時間證據就無法聲稱達標。
practice:
- id: cl-contract-01-p1
  kind: sql
  category: [dbt, time]
  title: 分開讀最後事件與最後接收
  minutes: 4
  level: 1
  dataset: events
  prompt: |
    以 2026-02-24 03:00:00 作為觀測時刻。只取 `received_at` 不晚於此時的列。依序輸出 `last_event_at`、`last_received_at`，分別是兩欄最大值。只有 1 列，不需排序。
  solution: |
    SELECT MAX(event_at) AS last_event_at, MAX(received_at) AS last_received_at
    FROM app_events WHERE received_at <= TIMESTAMP '2026-02-24 03:00:00';
  explain: |
    這兩個最大值可來自不同列。從事件時間最大的一列同時取接收時間，不一定是最後一筆接收。
  hints:
  - 同一個 SELECT 放兩個 MAX
  - 先排除觀測點後的到達
  check:
    ordered: false
    columnNames: true
  concepts:
  - cl-contract-01-arrival-clock
  - cl-contract-01-as-of
  tags:
  - 來源新鮮度
  - 接收時間
- id: cl-contract-01-p2
  kind: sql
  category: [dbt, time]
  title: 依接收延遲標記各通道
  minutes: 7
  level: 3
  dataset: logins
  prompt: |
    對截至 2026-03-01 12:00:00（含）收到的登入，依 `channel` 取最近接收時間。依序輸出 `channel`、`last_received_at`、`freshness_status`。延遲嚴格大於 2 小時為 `error`，否則嚴格大於 1 小時為 `warn`，其餘 `pass`。只輸出有收到列的通道，依 `channel` 升序。
  solution: |
    WITH recent AS (
      SELECT channel, MAX(received_at) AS last_received_at FROM login_log
      WHERE received_at <= TIMESTAMP '2026-03-01 12:00:00' GROUP BY channel
    )
    SELECT channel, last_received_at,
           CASE WHEN last_received_at < TIMESTAMP '2026-03-01 10:00:00' THEN 'error'
                WHEN last_received_at < TIMESTAMP '2026-03-01 11:00:00' THEN 'warn'
                ELSE 'pass' END AS freshness_status
    FROM recent ORDER BY channel;
  explain: |
    先按通道找最大接收，再與固定時刻比較。不要先跨通道取單一最大值，否則落後通道會被遮住。等於閾值不升級。
  hints:
  - 先挑最嚴重的條件
  - 用時間比較而非整點小時差
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-01-arrival-clock
  - cl-contract-01-complete
  - cl-contract-01-as-of
  tags:
  - 來源新鮮度
  - 接收時間
- id: cl-contract-01-lab
  kind: explain
  title: 發出一張不誤導的來源狀態卡
  minutes: 7
  steps:
  - 把兩個最後時間、觀測時刻與通道等級寫進本機 freshness.md。
  - 說明哪個結果只能證明最近收到列，另列完整性判準、通知對象與發布動作。
  checks:
  - 用接收時間判斷告警，用事件時間說明業務範圍，沒有把綠燈寫成已對帳。
  - 使用固定觀測時間，重跑數字一致；缺通道有獨立的檢查策略。
---

## 有新列，不代表已到齊

上午 9 點，昨天的區域報表還少了其中一個市場。上游在 8:58 送過一列，為什麼還要擔心？來源新鮮度（source freshness）只問「距離最近一次有效到達多久」，它不是完整性（completeness）：「應該到的批次、地區或列是否全到」。

登入的事件時間（event time）指登入發生的時刻；接收時間（arrival time）是管道看到紀錄的時刻。2 月 23 日的行為可以在 2 月 24 日入庫。報表應歸到業務日，管道是否有收到新輸入則看接收時鐘。兩個最大時間甚至可以來自不同列，不要把同一列的兩欄強求成一組。

## 先把觀測時刻和閾值定下來

做一張狀態卡，寫明來源、觀測時刻、最近接收、最近業務時間、閾值和後續動作。練習固定日期，結果才不隨你打開課程的時間改變。對登入通道，最近接收距觀測點超過 2 小時就錯誤、超過 1 小時就告警，其餘先通過；正好等於閾值不升級。若該到的通道一列也沒有，應從應到通道清單查出缺席，而不是把「沒有結果」當綠燈。

在 dbt，來源具備載入時間欄時，可以在來源表的 `config` 放 `loaded_at_field`，再放 `freshness:` 底下的 `warn_after` 和 `error_after`；閾值用 `count` 與 `period`（如 `hour`）。`dbt source freshness` 以執行當下去比最近載入時間，和 App 的固定時間演算不同。在本地示例 `raw.refunds` 只建了 `updated_at`，沒有獨立的接收欄；不要拿它冒稱載入時間。實務上要與上游約定時區、欄位含義、沒有列時如何處置，然後做一次手動驗證。

向下游說「來源截至某個時點」比只顯示一個綠燈有用。服務水準協議（service-level agreement，SLA）可以定義何時必須到齊、如何通報與誰接手。告警觸發時，先確認是否為預期停供，再比對應到批次與實到筆數；日報若要提供暫估數，就標出未到的市場與何時再更。小樣本能驗證分類規則，不能保證生產時鐘都已同步。

把結果交給同事時，註明檢查適用的窗和假日例外。如果供應方週末本來停送，不宜把正常停供當事故；若結帳日前有額外批次，仍應單獨核對它。若時鐘偏差讓最近到達落在未來，先把它作為數據異常追蹤，不用負延遲證明很新。

將這些例外寫在閾值旁，值班者才能判斷何時處置。

## 方言與常見錯誤

DuckDB 可用時間點直接比較。MySQL 的 `TIMESTAMPDIFF` 和 Spark SQL 的時間差函式有各自的單位與參數形式；用整點小時差容易把 1 小時 59 分判成 1 小時。本課拿兩個明確時刻比較，避免先截整。

- 最近有一列就標完整 → 把是否有新列和應到數量混為一談 → 分別檢查。
- 舊事件晚到被當成停供 → 拿業務時間當接收時間 → 回查實際到達欄。
- 各通道都標成全站最新值 → 彙總粒度錯誤 → 逐通道算，另找缺席的通道。
