---
id: bd-quality-03
module: bd-quality
order: 3
title: 新鮮度與完整度
subtitle: 準時到的可能只有半批
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-02
objectives:
- 用固定驗收時刻判斷新鮮度
- 用上游清單比較應到與實到筆數
- 區分同時通過、有新數據但缺批以及空批
tags:
- 新鮮度
- 完整度
- 批次清單
- 延遲
resources:
- title: dbt：Source freshness
  url: https://docs.getdbt.com/docs/deploy/source-freshness
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 看最新載入時間與告警門檻。
- title: DuckDB：聚合函式
  url: https://duckdb.org/docs/lts/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 確認空輸入的 COUNT 和 MAX 結果。
concepts:
- prompt: 新鮮度主要回答什麼？
  answer: 在約定的驗收時間看，上次有效載入離現在多久，或是否到達約定切點；它不保證輸入數量。
  mcq:
    question: 最新載入在期限內，但班次只到一半，哪個結論正確？
    answer: 2
    options:
    - 新鮮且一定完整
    - 不新鮮但一定完整
    - 可能新鮮但不完整
    - 只看任務綠色就夠
    explain: 時間新鮮但內容不完整。MAX 只看最靠近的一筆，不能看出所有分片。
  id: bd-quality-03-fresh
- prompt: 應到筆數應從哪裡取得？
  answer: 從同切點、同業務範圍的上游交付清單或獨立來源；只用下游本身當分母無法檢出漏送。
  mcq:
    question: 應到 2、收到 2，但只看到相同鍵兩次，哪個說法正確？
    answer: 1
    options:
    - 完整性已證明
    - 可能一漏一重，須另外核對鍵
    - 要提高新鮮度門檻
    - 只比最大日期就能排除
    explain: 筆數一致只是一個訊號；還要對鍵、分片或檔案清單。
  id: bd-quality-03-count
- prompt: 全空輸入如何判斷？
  answer: 先分辨上游確認應到 0，還是未交清單或讀取故障。COUNT 回 0；MAX 通常回 NULL，不可偷當最新。
  interview:
    question: 日報最新時間準時但缺數，怎樣設定門檻和排查？
    answer: 先確認載入時間與營業時間沒有混用，用上游同切點清單核對應到的分片和筆數。把逾時與缺批分成兩個告警，空批區分已證實為零與上游未到，再抽查一漏一重的可能。
    points:
    - 分離兩項訊號
    - 正確的清單及時間軸
    - 區分合法空批和無證據
  id: bd-quality-03-empty
practice:
- kind: sql
  category: [reconcile, time]
  title: 新鮮但只收到一半
  minutes: 5
  dataset: shop
  prompt: 預期 2026-01-18 有 2 列；模擬 `orders` 在當日只收到 1010，該列視為當天載入。輸出一列 `latest_day`、`received_rows`、`expected_rows`（2）、`is_fresh`（最新日期等於
    01-18，無值視 false）、`is_complete`（筆數等於 2）。按此欄序，無須排序。
  solution: |-
    SELECT MAX(order_date) AS latest_day, COUNT(*) AS received_rows,
           2 AS expected_rows,
           COALESCE(MAX(order_date) = DATE '2026-01-18', FALSE) AS is_fresh,
           COUNT(*) = 2 AS is_complete
    FROM orders
    WHERE order_date = DATE '2026-01-18' AND order_id = 1010;
  explain: 應得到 01-18、1、2、true、false。不要用同一個布林值表達兩條規則，日期只是本題的載入替身。
  hints:
  - 一條件看 MAX，另一條件看 COUNT
  concepts:
  - bd-quality-03-fresh
  - bd-quality-03-count
  - sq-group-01-rows
  tags:
  - 新鮮度
  - 完整度
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-03-p1
- kind: sql
  category: [reconcile, join]
  title: 分辨應到但沒到的日期
  minutes: 5
  dataset: shop
  prompt: 清單含 2026-01-13 應到 1 筆、01-14 應到 2 筆。接收端只有 `orders` 的 1001、1002、1003 中日期早於 01-14 的列。逐日列 `batch_day`、`expected_rows`、`received_rows`、`missing_rows`，依
    `batch_day` 遞增。
  solution: |-
    WITH manifest(batch_day, expected_rows) AS (
        VALUES (DATE '2026-01-13', 1), (DATE '2026-01-14', 2)
    ), incoming AS (
        SELECT order_id, order_date FROM orders
        WHERE order_id BETWEEN 1001 AND 1003 AND order_date < DATE '2026-01-14'
    )
    SELECT m.batch_day, m.expected_rows, COUNT(i.order_id) AS received_rows,
           m.expected_rows - COUNT(i.order_id) AS missing_rows
    FROM manifest m LEFT JOIN incoming i ON m.batch_day = i.order_date
    GROUP BY m.batch_day, m.expected_rows
    ORDER BY m.batch_day;
  explain: 01-14 必須存在並顯示實到 0、缺 2。`COUNT(*)` 會把左連接補出的那列也算 1；必須數接收端必有值的鍵。
  hints:
  - 從應到日期開始，未到才不會消失
  concepts:
  - bd-quality-03-empty
  - bd-quality-03-count
  - sq-group-01-nulls
  tags:
  - 缺批
  - 左連接
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-03-p2
---

## 檔案準時到，不代表貨都在裡面

01-18 應有 2 筆訂單。最後一筆交付時間很新，收到的卻只有 1010。**新鮮度（freshness）**問最近有效載入有多舊、是否達到承諾切點；**完整度（completeness）**問應到的列、鍵、分片或檔案是否到齊。它們需要兩個訊號，而不是合成「排程成功」。營業時間、實際載入時間與驗收現在時間也不相同：一份剛補送的歷史檔很新，但仍屬於舊的營業日。

## 各量各的分母

先寫清楚交付約定：驗收哪一天、用什麼時區、晚幾分鐘算逾時、哪份上游批次清單給出應到值。新鮮度常以 `驗收時間 - MAX(loaded_at)` 衡量；最新載入只代表至少看見一筆新輸入。完整度可先比較應到與實到，再比對鍵或分片，因為一漏一重可以抵銷。若上游正式確認某日應到 0，空批可合法；若根本沒收到清單，不能把未知當 0。

在 SQL 練習場選 `shop`，預留 1 GB、無容器。例子沒有載入時間欄，用同天的營業日刻意代替「最新日期」；請勿把它直接改作上線的新鮮度判定。下面先看全部 01-18 到齊時的基線：（01-18，2）。

```sql
SELECT MAX(order_date) AS latest_day, COUNT(*) AS received_rows
FROM orders
WHERE order_date = DATE '2026-01-18';
```

再在題目裡限制只收到 1010，`MAX` 仍是 01-18，筆數卻少一半。若改成找不存在的單，`MAX` 返回 NULL，`COUNT(*)` 回 0。使用布林門檻時把無值明確標成未達（或另外呈現未知），不要讓三值邏輯靜默漏掉告警。下次看到「沒有更新」，先區分是查無列、沒有有效時間，還是讀取失敗。

告警應帶營業日、驗收時間、來源應到量與可定位的缺口。依[〈SLA 與告警〉](#/lesson/bd-orch-07)的分類，可以一則通知指出仍缺哪批，恢復後另外保存它曾晚到的事實。

## 用四個結果做一次演練

把 01-18 的應到清單寫成兩筆。能看到最後一筆、且兩筆都能核對，叫準時且完整；只能看到剛來的一筆，叫新鮮但不完整；兩筆都有卻超過日報期限，叫完整但晚到；清單未到也查不到輸入，叫未知或未到，不能宣稱應有零筆。若數據表最後還留著昨日的值，該日最新值也不應通過今日的驗收。這些狀態各自用一個反例，較容易檢查規則不會混用。

實作時發布門檻可以要求兩條規則都通過，但通知應呈現兩個值。完整性告警帶缺的日期或分片；新鮮度告警帶最後有效載入與期限。收到通知的人才知道該先去找漏送的一批，或改查延遲的上游處理。

## 常見錯誤

- **最新時間準時卻少半批 →** 只比 `MAX`；另驗應到筆數與鍵。
- **空日被當作正常 →** 未分應到為零和清單未抵達；保留上游確認。
- **午夜重跑就多出逾時訊號 →** 驗收時刻或時區不固定；保存要重現的同一個時點。

**重點回顧：**新鮮度要有時間基準；完整度要有獨立的應到基準。
