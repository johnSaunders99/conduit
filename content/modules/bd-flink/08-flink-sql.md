---
id: bd-flink-08
module: bd-flink
order: 8
title: Flink SQL 與更新流
subtitle: 結果表為何會撤回一列
status: ready
minutes: 35
level: 3
prereqs:
- bd-flink-07
objectives:
- 把持續 GROUP BY 的調整讀成變更日誌
- 驗證只追加目的端與更新目的端的差別
- 在本機 SQL Client 看見同一聚合鍵先後更新
tags:
- dynamic table
- changelog
- upsert
- Flink SQL
resources:
- title: Flink：動態表
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/sql-table-concepts/dynamic_tables/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 對照動態表與不同變更編碼。
- title: Flink 2.3：SQL Client
  url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/sql/interfaces/sql-client/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 changelog 顯示模式及串流模式。
- title: Flink 2.3：DataGen
  url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/connectors/table/datagen/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀固定序列、總列數及每秒產量。
concepts:
- id: bd-flink-08-changelog
  prompt: 同一門市的付款計數從 1 變成 2，結果是多兩列還是改一列？
  answer: 動態結果表是同一列從 1 改為 2；底層變更流可能送出前值與新值。
  mcq:
    question: 看到 -U(shop,1) 接 +U(shop,2)，最終那一列是什麼？
    options:
    - shop 有兩列，值 1 與 2
    - shop 的值是 3
    - shop 的最新值是 2
    - shop 被刪除且沒有新值
    answer: 2
    explain: -U 收回舊值，+U 帶來新值；輸出流有兩條紀錄不等於結果表多兩列。
  interview:
    question: 持續 GROUP BY 寫到只追加的目的端，會出什麼問題？
    points:
    - 聚合結果會發更新
    - 需要支援變更的目的端或閉窗後只送結算
    - 主鍵與輸出模式吻合
    answer: 我先看作業的變更模式。若每筆都修正門市計數，目的表要能按門市鍵更新；若目的地只能附加，要改成只送封窗結果或另定一張正式變更日誌供下游解讀。
- id: bd-flink-08-key
  prompt: 兩家店的計數共用一個目的端鍵，會怎樣？
  answer: 可能互相覆寫；目的鍵要能唯一識別查詢的結果粒度。
  mcq:
    question: 每店每日一列，哪個鍵合適？
    options:
    - 只按店
    - 只按日
    - 店與日的組合
    - 每次輸出生成新亂數
    answer: 2
    explain: 每個結果鍵要能唯一識別一店一日，新版本再寫同鍵。
- id: bd-flink-08-prefix
  prompt: 固定到接收第 12 列，算出的最終快照能否證明串流只發一次更新？
  answer: 不能；有限查詢能核對該切點狀態，不能推出中間更新次數。
  mcq:
    question: 要驗證真正的中間更新，應看何處？
    options:
    - 只看整天快照
    - 看 SQL Client 的 changelog 並核對目的粒度
    - 只看原始 Kafka 有幾個分區
    - 只看目的表最後一列
    answer: 1
    explain: 觀察變更流才能看撤回與替換；有限 SQL 則用來做獨立基準。
practice:
- id: bd-flink-08-p1
  kind: hands-on
  title: 留下實時聚合改值的畫面
  minutes: 12
  steps:
  - 重開第一堂的 Flink Compose，逐句跑正文的 Flink SQL。
  - 保留初始值和最後值的截圖或抄錄結果標記。退出 Client 並關閉本實驗。
  checks:
  - 能看見統計從 1 更新到 3。
  - 能解釋 -U、+U 不代表原始事件被刪除或重送。
- id: bd-flink-08-p2
  kind: sql
  category: [reconcile]
  title: 為更新流比出前後兩個值
  minutes: 6
  level: 2
  dataset: events
  prompt: |
    將 raw_id 不超過 12 的接收列視為目前快照，其中不超過 10 的列為舊快照。按 `step` 求舊值 `before_n`、新值 `after_n`，只列數字有變的組（舊快照沒有某組時算 0）。只輸出 `step`、`before_n`、`after_n`，依 `step` 升序。
  solution: |
    WITH snapshots AS (
      SELECT step, COUNT(*) FILTER (WHERE raw_id <= 10) AS before_n,
             COUNT(*) AS after_n
      FROM app_events WHERE raw_id <= 12 GROUP BY step
    )
    SELECT step, before_n, after_n FROM snapshots
    WHERE after_n <> before_n ORDER BY step;
  explain: |
    先保留新快照全體再算舊子集，才不會因內連接而丟掉新組。這題比 Flink 動態表的前後狀態，不產生原生 RowKind 變更流。
  hints:
  - 以兩邊較大的截止為輸入。
  - 先聚合，外層再比前後。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-08-changelog
  - bd-flink-08-prefix
  - bd-flink-01-bounded
  tags:
  - 變更日誌
  - 對帳
- id: bd-flink-08-p3
  kind: sql
  category: [distinct, top-n]
  title: 從重送版還原每事件一列
  minutes: 6
  level: 3
  dataset: events
  prompt: |
    將 `app_events` 的同一 `event_id` 視為同一目的鍵，以 `received_at` 最大者為目前版本；同時間以 `raw_id` 最大者作裁決。只輸出 `event_id`、`raw_id`、`step`，欄序如列，依 `event_id` 升序。
  solution: |
    SELECT event_id, raw_id, step FROM app_events
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY event_id ORDER BY received_at DESC, raw_id DESC
    ) = 1
    ORDER BY event_id;
  explain: |
    直接 DISTINCT 三欄會保留不同 raw_id 的重送。本題用 DuckDB QUALIFY，Flink SQL 可用外層查詢描述排名篩選；實時目的端能否消費更新仍依其契約。這個接收排序只供本題，正式訂單可能要按來源版本。
  hints:
  - 按事件鍵分組排名。
  - 時間同值再比接收序號。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-08-key
  - bd-flink-08-changelog
  - sq-window-03-winner
  tags:
  - 每組最新一列
  - upsert
---

支付看板的「目前共 1 筆」不是永遠固定。第二筆來時，正常結果是把 1 改成 2。Flink SQL 將持續查詢的結果視作動態表（dynamic table）；結果仍有行列，但一列可新增、修改、刪除。變更日誌（changelog）記錄這些修改，而不是每次重新匯出整張表。

## 一張表可以用不同方式傳

- 新增 `+I`：以前沒有這列，現在有了。
- 舊值 `-U`、新值 `+U`：撤回前一個結果，再加入更新值。以上例，目的結果是 2，不是 1+2。
- 刪除 `-D`：移掉結果中的一列。這是結果的變化，不代表來源 Kafka 主題也刪了某個位移。
- 更新或插入（upsert）：若目的端按穩定鍵辨識一列，可以用新值取代舊值，不一定要先收到舊值；是否需要完整撤回列取決於連接器和查詢。

一店一日就用「店、日期」辨識結果；只用店無法保留不同天，只用日期會讓不同店互蓋。看板需要按相同鍵讀最新結果，附加型的 CSV 卻只能再加一列。跨這條邊界時要承諾哪種變更能寫：改用支援更新的目的端，或改成窗口封閉後才發布本期結果，前提是窗口查詢確實交付只追加的變更。[〈StarRocks 主鍵表〉](#/lesson/bd-serve-03)會用數據庫的同鍵更新說明下游。

## 在 SQL Client 看見改值

沿用[〈無界流與有界流〉](#/lesson/bd-flink-01)的 `C:\dev\conduit-lab\flink` Compose，記憶體預留約 5 GB，依第一堂方式啟動及進入 SQL Client。下方是原生 Flink SQL，每個分號結束一條；`datagen` 產 3 列，`rows-per-second` 固定每秒 1 列，`sequence` 給可預測的順序。數量有限是為了好重跑，但作業使用串流模式，讓你看到中間值。這段不能貼進 DuckDB。

```sql
SET 'execution.runtime-mode' = 'streaming';
SET 'parallelism.default' = '1';
SET 'table.exec.mini-batch.enabled' = 'false';
SET 'sql-client.execution.result-mode' = 'changelog';
CREATE TEMPORARY TABLE demo_pay (event_seq BIGINT) WITH (
  'connector' = 'datagen',
  'number-of-rows' = '3',
  'rows-per-second' = '1',
  'fields.event_seq.kind' = 'sequence',
  'fields.event_seq.start' = '1',
  'fields.event_seq.end' = '3'
);
SELECT COUNT(*) AS pay_n FROM demo_pay;
```

留意累計從 1 到 3，以及中間以撤回與更新表達的變化。記下實際可見的標記；`Q` 退出結果頁，`QUIT;` 離開客戶端，回到同一資料夾的 PowerShell 用 `docker compose down` 收工。這是變更模式的簡例，並未驗證外部目的端。下方練習改在 DuckDB 用共享數據重做兩份固定切點快照，作為靜態對帳；快照會告訴你哪一列變了，但不會記錄查詢一共發過幾次中間更新。

驗收時把「來源輸入筆數、變更紀錄數、目前結果列數」分成三欄。三筆付款可對到一列全域計數，但為了把舊值換成新值，傳輸看到的變更紀錄可以多於三筆。若寫端要求保留歷史，可以把這些變更寫成有操作類型的日誌供重播；若只給看板目前結果，下游應以結果鍵更新。想驗證兩種方案都實現正確口徑，把同一份變更套成一張目前表，比對最後筆數，不能用變更檔案的列數判斷支付有多少筆。

## 常見錯誤

- 把變更列直接相加 → 將全量新值誤當差值 → 逐鍵維護目前值或按前後差運算。
- 用每次都變的輸出編號當目的鍵 → 同一列變成多個結果 → 改用查詢粒度的穩定鍵。
- 用 DuckDB 開 Flink 連接器 → 方言及執行模型不同 → 原生演練走 Flink SQL Client，驗收邏輯用內嵌 SQL。
