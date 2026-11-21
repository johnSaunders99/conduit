---
id: cl-contract-05
module: cl-contract
order: 5
title: 增量回填演練
subtitle: 舊月份更正不能被漏掉
status: ready
minutes: 35
level: 3
prereqs:
- cl-contract-04
objectives:
- 以更新批次定位受影響的業務日期範圍
- 從完整來源重算受影響分區或鍵，而不只加差額
- 用同一截止點比較回填與全量結果，驗證可重跑
tags:
- 歷史回填
- 增量
- 重算日期
- 全量對帳
resources:
- title: dbt：增量與重建
  url: https://docs.getdbt.com/docs/build/incremental-models
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀既有表更新及何時需要重新建置。
- title: dbt：unique_key
  url: https://docs.getdbt.com/reference/resource-configs/unique_key
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 確認合併鍵如何把輸入送到正確輸出。
concepts:
- id: cl-contract-05-affected
  prompt: 舊退款被更正，為何不能只重跑接收日？
  answer: 報表按業務日期分類；應找變更影響的業務日，若日期改過還要含前後日期。
  mcq:
    options:
    - 修正只影響今天
    - 按主鍵的最後一位決定日期
    - 只查目前最晚業務日
    - 查變更前後可能受影響的業務日期
    answer: 3
    explain: 接收日用來發現變更，分區由業務日決定。
- id: cl-contract-05-replace-slice
  prompt: 如何避免補送同一筆兩次讓日數加兩次？
  answer: 以完整來源按該日計算一次，在候選中替換該日結果；不要按補送列數一直加。
  mcq:
    options:
    - 每次都在現有值加一
    - 重算並替換命中範圍
    - 將所有日期一起乘一個係數
    - 把重複的所有金額去重
    answer: 1
    explain: 補送可能重複、也可能是既有列更正。直接加差很難保證可重跑。
- id: cl-contract-05-truth
  prompt: 要證明增量結果與全量一致，兩者哪個輸入條件最重要？
  answer: 同一來源版本和截止點，且按相同粒度、過濾、缺失規則比較。
  mcq:
    options:
    - 同一輸入與口徑
    - 一定用不同來源以增加樣本
    - 只比整表列數
    - 只比最後一天
    answer: 0
    explain: 截止點不同時，新列造成差異，不一定是回填錯。
  interview:
    question: 排程補到三週前的訂單，你會直接跑全量嗎？
    answer: 先用更新批次找改到哪些業務日，看看金額與日期是否被更正。能確定範圍就從同一輸入快照重算那些天，和全量基準按鍵比對，通過才替換；規則或範圍未知才評估受控全量。
    points:
    - 找變更與受影響日期
    - 同一來源快照對帳
    - 有驗收與回退方式
- id: cl-contract-05-recover
  prompt: 正式回填在何時應該切換讀取方？
  answer: 先在候選結果驗算，確定範圍、結果及重跑，再保留原版切換；失敗沿用原版。
practice:
- id: cl-contract-05-p1
  kind: sql
  category: [dbt, time]
  title: 找出單一接收窗口影響的舊日期
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    輸入為 2026-02-24 00:00:00（含）至 03:00:00（不含）接收到的事件；只取事件時間早於接收窗口起點。依序輸出 `event_date`（事件日期）、`late_rows`（接收列數），按 `event_date` 升序。
  solution: |
    SELECT CAST(event_at AS DATE) AS event_date, COUNT(*) AS late_rows
    FROM app_events
    WHERE received_at >= TIMESTAMP '2026-02-24 00:00:00'
      AND received_at < TIMESTAMP '2026-02-24 03:00:00'
      AND event_at < TIMESTAMP '2026-02-24 00:00:00'
    GROUP BY CAST(event_at AS DATE)
    ORDER BY event_date;
  explain: |
    窗口決定哪批變更要檢查，日期歸屬仍取事件。不要把接收日當成分區鍵。
  hints:
  - 以兩個不等式選窗口
  - 把 event_at 轉為 DATE
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-05-affected
  - sq-model-09-half-open
  - cl-dbt-04-watermark
  tags:
  - 歷史回填
  - 增量
- id: cl-contract-05-p2
  kind: sql
  category: [dbt, reconcile]
  title: 重算命中日期而非只統計補送
  minutes: 9
  level: 3
  dataset: events
  prompt: |
    仍用上一題窗口找受影響事件日期。在全部 `app_events` 裡，只分別以窗口前、窗口結束前兩個接收截點重算這些**事件日**。每個截點內一個 `event_id` 算一次。依序輸出 `event_date`、`before_events`、`after_events`、`delta`（後減前），依 `event_date` 升序。未收到的計數為 0。
  solution: |
    WITH affected AS (
      SELECT DISTINCT CAST(event_at AS DATE) AS event_date FROM app_events
      WHERE received_at >= TIMESTAMP '2026-02-24 00:00:00'
        AND received_at < TIMESTAMP '2026-02-24 03:00:00'
        AND event_at < TIMESTAMP '2026-02-24 00:00:00'
    ), daily AS (
      SELECT a.event_date,
             COUNT(DISTINCT CASE WHEN e.received_at < TIMESTAMP '2026-02-24 00:00:00'
                                 THEN e.event_id END) AS before_events,
             COUNT(DISTINCT e.event_id) AS after_events
      FROM affected a LEFT JOIN app_events e
        ON CAST(e.event_at AS DATE) = a.event_date
       AND e.received_at < TIMESTAMP '2026-02-24 03:00:00'
      GROUP BY a.event_date
    )
    SELECT event_date, before_events, after_events,
           after_events - before_events AS delta
    FROM daily ORDER BY event_date;
  explain: |
    用同一個定義重算日期切片。晚到列可能只是重送，所以不能把接收列數直接加到昨日事件數。本題對同事件維持同一事件日期；實務更正日期要同時重算舊日與新日。
  hints:
  - 先找受影響日期
  - 以條件 COUNT(DISTINCT …) 比兩個截點
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-05-affected
  - cl-contract-05-replace-slice
  - cl-contract-05-truth
  - cl-dbt-04-boundary
  tags:
  - 歷史回填
  - 增量
- id: cl-contract-05-lab
  kind: hands-on
  title: 保存一份補算與全量對帳記錄
  minutes: 7
  steps:
  - 在 SQL 練習場對 events 跑兩題。依正文做獨立全量查詢，與第二題的終值對帳後重跑第二題。
  - 在本機 backfill-log.md 留下截點、影響日、修改前後及全量對帳、重跑結果與停發條件。
  checks:
  - 兩份使用相同結束截點；影響日為 2026-02-23，事件數由 1 變 2。
  - 同一候選重跑沒有重複累加；有未解差異不得宣稱回填完成。
---

## 修的是那一天，不是今天

管道在 2 月 24 日收到了 2 月 23 日的行為。現有日報只跑最新業務日，昨天就永遠少了一列。回填（backfill）是在已發布的過去範圍補出缺失或重算更正；先用接收批次定位變更，再依事件日期找要重做的範圍。若一筆紀錄的業務日由甲日改為乙日，兩天都受影響，即使只收到一筆更正。

一次可以重跑的回填順序如下：

1. 凍結來源版本或接收截止，記錄更新窗口，找出受影響業務日期。半開範圍讓相鄰批次不撞端點。
2. 對這些日期以完整來源重算，使用相同的去重、指標口徑與日期規則。不要只把本次收到的列數加到舊合計。
3. 建候選結果，在未改的日期保留舊版本；對被重算的日期用新結果完整替換。重跑同一輸入結果不變，是冪等性（idempotency）。
4. 在同一截止做獨立全量，按鍵比較有無缺列和數值差異；保留舊版與驗收記錄，通過再發布。有差異則停止，不切換讀取方。

## 在 App 做一次小回填

`events` 的 2 月 24 日 00:00 至 03:00 收到一筆舊日事件。完成練習後，同一事件日期可用全量口徑交叉驗證：以下直接掃所有在結束截點以前已收到的事件，不用增量的受影響日清單或之前的彙總。

```sql
SELECT CAST(event_at AS DATE) AS event_date, COUNT(DISTINCT event_id) AS event_count
FROM app_events
WHERE received_at < TIMESTAMP '2026-02-24 03:00:00'
GROUP BY CAST(event_at AS DATE)
ORDER BY event_date;
```

定位 2 月 23 日，應看到 2 種事件。這只證明本例的重算日期與全量一致，不代表沒受影響的日期已經比對。正式流程須比較「未改日期舊值＋替換日期新值」的完整候選，才能發現範圍定得太窄。若某天更正後完全沒有事件，替換時也要刪掉舊結果或按日曆填明示的 0；純粹用只含現存鍵的更新會留下舊日錯值。

記錄還應能回答候選如何撤回。先保留已發布值和對帳差異，不直接就地覆寫；即使某些數字目前相同，也要記下用的是哪一份來源截止。當你確定某個受影響日需要改值，和維護者約定重算窗口，避免排程又用舊輸入覆蓋新結果。小練習不做發布，但這些欄能讓別人重演你的決定。

把重跑前後結果並排保留，以便分辨重算和累加。

## 方言與常見錯誤

本課比較候選先用查詢，不更新共享數據。DuckDB 的交易與表寫入能力、Spark SQL 的表格式支援、Hive SQL 的分區覆寫與 MySQL 的交易範圍不同；正式選更新方式時，先驗證只替換正確日期以及失敗時能否恢復。

- 補到今天、昨天還是少 → 混用接收日與業務日 → 從變更提取受影響日期。
- 重跑一次又多一筆 → 對今天的數字做累加 → 以完整來源重算，替換日期。
- 全量比對不穩定 → 兩份讀到不同截點 → 固定來源版本與時間邊界。
