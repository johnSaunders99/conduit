---
id: sq-audit-04
module: sq-audit
order: 4
title: 全量與增量比對
subtitle: 退款補來後只查受影響的鍵
status: ready
minutes: 30
level: 2
prereqs:
- sq-audit-03
objectives:
- 用接收時間找到需要重算的業務日期
- 以受影響鍵重算完整狀態並與先前截點比較
tags:
- 增量對帳
- 晚到數據
- 受影響鍵
resources:
- title: Spark SQL：CTE
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-cte.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀如何命名中間結果以便分段驗證。
- title: MySQL：日期與時間函式
  url: https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 DATE 與 DATEDIFF 對日期的處理。
concepts:
- id: sq-audit-04-window
  prompt: 晚到事件該以哪個時間找增量，以哪個時間決定報表歸屬？
  answer: 以接收時間找這輪新增的列，以事件時間決定該更新哪個業務日。
  mcq:
    options:
    - 接收找增量，事件定歸屬
    - 兩者一律用接收日
    - 兩者一律用事件日
    - 一律用目前時間
    answer: 0
    explain: 把接收時間當營業日會錯歸；只用事件時間找增量會漏掉較早發生的新列。
- id: sq-audit-04-recompute
  prompt: 一張訂單今天多收到一筆退款，重算累計只加總今天的退款可以嗎？
  answer: 不能，先找這張單，再讀到新截點為止的所有退款重算。
  mcq:
    options:
    - 直接用新退款總額覆寫累計
    - 只用新退款找鍵，為這些鍵重算完整歷史
    - 每張單只留最晚退款
    - 一律以退款日期當下單日
    answer: 1
    explain: 增量只限制要重算的鍵與截點，不是要將舊列從累計公式除去。
  interview:
    question: 怎麼證明增量結果和全量結果一樣？
    answer: 我用同一截止點做一份全算基準，對這輪受影響鍵做雙向核對。另加晚到、重跑同批及刪除測例；刪除必須靠變更紀錄或對照快照才能找回被影響的舊鍵。
    points:
    - 同截止點與口徑
    - 局部結果對全量基準
    - 覆蓋晚到與刪除
- id: sq-audit-04-cutoff
  prompt: 為何連續窗口常用 >= 下界且 < 上界？
  answer: 同一筆恰落邊界只歸一批，不會兩批都納入。
  mcq:
    options:
    - 讓日期永遠提前一天
    - 可以忽略遲到數據
    - 讓相鄰窗口不重疊
    - 可取代業務鍵
    answer: 2
    explain: 它只解決切界，不保證來源沒有回補。
- id: sq-audit-04-moved
  prompt: 同一事件原本歸在 2 月 4 日，更正後歸 2 月 5 日，重算哪一天？
  answer: 兩天都要重算：舊日要扣掉原貢獻，新日要算入。
  mcq:
    options:
    - 只重算舊日
    - 只重算新日
    - 兩個日期都要重算
    - 只重算收到更正那天
    answer: 2
    explain: 受影響鍵包含前後版本；只取更正後的日期會令舊日仍多算。
practice:
- id: sq-audit-04-p1
  kind: sql
  category: [reconcile, time]
  title: 找出晚到事件回補哪一天
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    找 received_at 在 2026-02-06 零時至 2026-02-07 零時（含下界、不含上界），且事件日期早於接收日期的所有接收列。輸出 raw_id、event_day（event_at 轉日期）、received_day（received_at 轉日期），依 raw_id 升冪。
  solution: |
    SELECT raw_id, CAST(event_at AS DATE) AS event_day, CAST(received_at AS DATE) AS received_day
    FROM app_events
    WHERE received_at >= TIMESTAMP '2026-02-06 00:00:00'
      AND received_at < TIMESTAMP '2026-02-07 00:00:00'
      AND CAST(event_at AS DATE) < CAST(received_at AS DATE)
    ORDER BY raw_id;
  explain: |
    raw_id 22 是 2 月 4 日發生、6 日收到。時間戳的截點與營業日各司其職；不要先只篩事件發生在 6 日。
  hints:
  - 先從接收窗口找列
  - 分別轉成兩個日期
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-04-window
  - sq-audit-04-cutoff
  - sq-metrics-01-clocks
  tags:
  - 增量對帳
  - 晚到數據
  - 受影響鍵
- id: sq-audit-04-p2
  kind: sql
  category: [reconcile, aggregate]
  title: 只重算受影響訂單的累計退款
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    把 refund_date 視為入帳日。舊截點不含 2026-01-28，新截點不含 2026-01-30。找在兩截點之間有退款的訂單，依新、舊截點各自計算累計。輸出 order_id、before_amount、after_amount，依 order_id 升冪；未有退款時金額為 0。
  solution: |
    WITH affected AS (
     SELECT DISTINCT order_id FROM refunds
     WHERE refund_date >= DATE '2026-01-28' AND refund_date < DATE '2026-01-30'
    )
    SELECT a.order_id,
           SUM(CASE WHEN r.refund_date < DATE '2026-01-28' THEN r.amount ELSE 0 END) AS before_amount,
           SUM(r.amount) AS after_amount
    FROM affected a JOIN refunds r ON r.order_id = a.order_id
    WHERE r.refund_date < DATE '2026-01-30'
    GROUP BY a.order_id ORDER BY a.order_id;
  explain: |
    1021 從 10 變 15，1028 從 0 變 10；只加總新退款會將 1021 算成 5。先去重受影響鍵，才不會放大退款。
  hints:
  - 變動窗口只用來找訂單鍵
  - 保留該鍵在新截點前的所有退款
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-04-recompute
  - sq-audit-04-cutoff
  - sq-audit-02-grouped
  tags:
  - 增量對帳
  - 晚到數據
  - 受影響鍵
---

昨晚的報表已結算，今早卻收到一筆兩天前的事件。整月重算很慢，只補今天又會補錯日。全量比對（full reconciliation）重算整個約定範圍；增量比對（incremental reconciliation）先找哪些鍵受影響，再對那些鍵做同口徑核對。它省的是範圍，不是驗證步驟。

## 拆成找鍵與重算

1. 固定舊、新截點；讀取本批變更採含下界、不含上界。若進度標記只記日期，就不能假定同日多次到達能被精確區分。
2. 從變更抓受影響鍵（affected keys）。對日報是業務日期；對單筆累計退款是訂單號。若更新會將紀錄移日，要把原日和新日都加入。
3. 用相同業務定義重算這些鍵的完整內容，而不是只聚合新增的列。若是刪除，需要收到刪除紀錄或保有舊鍵；只查現在還在的列會找不到它。
4. 拿同一截止點的全量基準，比雙向鍵、列數或金額；保存這輪的窗口、鍵與差異，讓重跑能重現。

在 SQL 練習場選 `events`，看 2 月 6 日收到、但屬於更早日期的列。接收時間（ingestion time）用來找到當批變化，事件時間（event time）用來定歸屬。這份教學數據已是業務時間，無須再加時差。

```sql
SELECT raw_id, CAST(event_at AS DATE) AS event_day
FROM app_events
WHERE received_at >= TIMESTAMP '2026-02-06 00:00:00'
  AND received_at < TIMESTAMP '2026-02-07 00:00:00'
  AND CAST(event_at AS DATE) < CAST(received_at AS DATE)
ORDER BY raw_id;
```

接著用 `shop` 的退款看同一件事：1021 已有 10 元，1 月 28 日再入帳 5 元，影響的是原訂單的累計。新退款只告訴你重算 1021，不表示過去的 10 元不重要。這個拆法也比較容易做可重跑的修復：每次用新截止點算完整狀態，檢查與目標是否一致。

## 保留失敗時的重跑起點

如果本批有多筆同一訂單退款，先把受影響鍵去重，否則在重新相接時會把歷史退款乘開。提交新截點前先確認結果寫完並核對通過；若處理一半就提高進度，重跑時可能從新的截點開始而漏掉半批。對照時可先選一個這輪受影響的訂單，手算前後差正好等於當批入帳，再選一個無受影響鍵：它不應出現在修復清單。這兩個測例分別保證「該補的有補」和「不該變的沒變」，比只核對總額更容易找錯。

追加處理時，週期性再抽一個已關閉期間用完整數據重算；它能抓到不在增量日誌裡的上游改動。

## 常見錯誤

- 找不到晚到數據 → 只掃當日事件時間 → 先用接收窗口找鍵。
- 累計從 10 變 5 → 用本批金額覆寫 → 以鍵重新讀全部應納入的列。
- 同一筆邊界列重複計入 → 兩批都用含上界 → 改用半開區間。

## 方言與面試

在 DuckDB 用 `CAST(時間 AS DATE)` 可得到日期；搬到 Spark SQL 或 MySQL 時，先核對來源欄型別及連線時區，不能假定轉日期都用同一時區。涉及逾日差異時，MySQL、Spark SQL 的 `DATEDIFF` 是結束日在前，和 DuckDB 的三參數寫法不同。面試談增量時先交代何時還需抽樣或全量兜底，尤其來源可重寫舊分區時。
