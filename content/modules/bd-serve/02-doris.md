---
id: bd-serve-02
module: bd-serve
order: 2
title: Doris 鍵模型
subtitle: 彙總和替換不能混用
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-01
objectives:
- 按必須保留的粒度選 Duplicate、Unique 或 Aggregate
- 手算更正紀錄和累加指標會得出不同結果
- 用 DuckDB 分別重建明細份數與彙總
tags:
- Duplicate Key
- Unique Key
- Aggregate Key
- merge-on-write
resources:
- title: Doris：明細鍵模型
  url: https://doris.apache.org/docs/4.x/table-design/data-model/duplicate/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀同鍵明細的保留方式。
- title: Doris：唯一鍵模型
  url: https://doris.apache.org/docs/4.x/table-design/data-model/unique/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀同鍵更新與寫入合併。
- title: Doris：聚合鍵模型
  url: https://doris.apache.org/docs/4.x/table-design/data-model/aggregate/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀聚合欄位如何指定合併函式。
concepts:
- id: bd-serve-02-models
  prompt: 按原始明細保留每次付款嘗試，選哪種 Doris 表？
  answer: 通常選 Duplicate Key；不以所謂鍵折疊同鍵明細。
  mcq:
    question: 一個訂單的每次嘗試同時都要可查，選哪種？
    options:
    - Aggregate Key 只留 SUM
    - Unique Key 以訂單為鍵
    - Duplicate Key 保留所有明細
    - 用昨日小計取代明細
    answer: 2
    explain: 訂單不是事件唯一鍵，折疊會失去歷史。
  interview:
    question: 同鍵 100 改成 130，為什麼 Aggregate Key + SUM 不是更正？
    points:
    - 全量新值不是增量
    - 選 Unique 保留目前狀態且防舊版本倒退
    - 事件歷史另留明細
    answer: 如果 130 是新全值，SUM 會算 230。我會讓目前狀態按訂單鍵做更新，並以來源版本處理倒序；若要查更正細節，另保留兩筆原事件。
- id: bd-serve-02-sum
  prompt: Aggregate Key 的金額列用 SUM，輸入 100、30 什麼時候應得 130？
  answer: 兩筆是同粒度的可相加變化，且重送不會再算時。
  mcq:
    question: 看板要累加不同退款事件，同時允許來源重送，還需要什麼？
    options:
    - 改用更細的日期分區
    - 先把同額退款合成一筆
    - 用加總前的事件身分防重
    - 用訂單鍵只保留第一次退款
    answer: 2
    explain: SUM 會忠實把重複數值再加一次，不會理解一筆重送的退款。
- id: bd-serve-02-latest
  prompt: Unique 同鍵最後可見一列，是否必定是業務最新？
  answer: 不必然；還要保證到達順序或正確設定版本及序列欄。
  mcq:
    question: 舊版本晚到，想讓金額不倒退，要補什麼？
    options:
    - 用接收頁碼當版本
    - 用來源順序規則及對帳
    - 只增加桶數
    - 把更正金額轉成文字
    answer: 1
    explain: 現在狀態的關鍵是來源版本，不是只看到一個唯一鍵。
practice:
- id: bd-serve-02-p1
  kind: sql
  category: [distinct, aggregate]
  title: 看保留明細與去重的數字差
  minutes: 7
  level: 2
  dataset: events
  prompt: |
    對 `app_events` 按 `step` 統計原始接收列數 `raw_n` 和不同 `event_id` 數 `event_n`，只列兩者不同的組。輸出 `step`、`raw_n`、`event_n`，依 `step` 升序。
  solution: |
    SELECT step, COUNT(*) AS raw_n, COUNT(DISTINCT event_id) AS event_n
    FROM app_events GROUP BY step
    HAVING COUNT(*) <> COUNT(DISTINCT event_id)
    ORDER BY step;
  explain: |
    在同一組比較粒度；先去重再計兩欄會遮住重送。DuckDB 這裡比較明細數與事件鍵數，不模擬 Doris 的實體合併。
  hints:
  - 不要先刪重送。
  - 以 HAVING 篩選有差異的組。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-02-models
  - bd-serve-02-sum
  - bd-flink-05-key
  tags:
  - 去重計數
  - 鍵模型
- id: bd-serve-02-p2
  kind: sql
  category: [aggregate]
  title: 把分次退款視為可累加事件
  minutes: 7
  level: 2
  dataset: shop
  prompt: |
    在 `refunds` 只列有至少 2 次退款的訂單。依次輸出 `order_id`、退款次數 `refund_n`、退款合計 `refund_total`，依 `refund_total` 降序，同額依 `order_id` 升序。每筆退款都是獨立可累加事件。
  solution: |
    SELECT order_id, COUNT(*) AS refund_n, SUM(amount) AS refund_total
    FROM refunds GROUP BY order_id HAVING COUNT(*) >= 2
    ORDER BY refund_total DESC, order_id ASC;
  explain: |
    每次退款都是獨立事件，初次退款不被今天退款取代。取 MAX(amount) 會少算。此處以 DuckDB 的 GROUP BY 明算；Doris Aggregation Key 可將可合併聚合在儲存路徑分段維護。
  hints:
  - 先確認一列是一筆退款。
  - 組的列數用 HAVING 控制。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-02-sum
  - bd-serve-02-models
  - bd-flink-08-key
  tags:
  - 退款
  - 預聚合
---

同一筆訂單先報 100 元，之後更正成 130 元。稽核要兩次都看得到，看板只要現在的 130 元，財務彙總則可能收 100 元加 30 元的兩次變動。Doris 的鍵模型（key model）回答：同一組鍵出現時，數據表保存的是多列、現在一列，還是聚合結果。選鍵前要口述一列代表什麼，不能只照數據庫名稱挑。

## 用輸入和期望選三個模型

- 明細鍵（Duplicate Key）：保留多筆，適合接收或稽核原始事件。鍵主要參與排序，並不禁止重複。
- 唯一鍵（Unique Key）：同鍵維護目前一列，適合會更新的訂單狀態。寫入合併（merge-on-write）讓新版本進入時處理舊列可見性；排序、序列欄與讀寫條件要依實際配置。
- 聚合鍵（Aggregate Key）：按鍵合併，非鍵欄以指定的聚合方式維護，例如退款金額用 `SUM`。要確定每個輸入是可累加的獨立變化，而不是同一筆的全量新值。

以同一訂單鍵讀出 100、130：明細是兩行；唯一鍵若版本正確，結果是 130；若聚合鍵的金額設定為 SUM 則是 230。若來源帶的是初始 100 與差額 30，SUM 才是 130。這些不是引擎的快慢差，而是同一數據在不同口徑下被解讀成不同含義。當使用會重試的來源，把「兩筆數字能不能加」與「兩筆是否為同一事件重送」分開驗收；即使是可相加的退款，重送也不能算第二次。

## 建一份模型選擇的核對基準

在 SQL 練習場選 `events`，先看原始輸入有多少行，再看不同事件鍵數量。以下是 DuckDB，`COUNT(*)` 讀接收列，`COUNT(DISTINCT event_id)` 讀不同行為鍵；它證明兩種粒度不同，不模擬 Doris 背景合併。

```sql
SELECT COUNT(*) AS raw_n, COUNT(DISTINCT event_id) AS event_n
FROM app_events;
```

結果是 166 個接收列、161 個事件鍵。保留這兩個數字和「應該保存哪個粒度」的理由。若看板只查目前狀態，關鍵是同鍵的新舊順序是否有來源版本；較舊版本晚抵達時，不應只是無條件覆蓋。[〈StarRocks 主鍵表〉](#/lesson/bd-serve-03)會把有版本的更正變成一項可跑的測試。若稽核仍要兩次都查得到，保留原始歷史表，再另外投影一份目前狀態，不要求同一張表滿足所有用法。這堂只比較 Doris 的模型，不再安裝第二個 OLAP 服務。

假設營運要修正三個月前某張訂單，先列出要動的是明細、狀態，還是已公開的小計。明細應保存更正事件及來源鍵；狀態要能由舊版過渡到新版；可相加的小計則可能用一正一負的差額調整。三張表允許採不同模型，但必須能利用同一筆更正對帳，不能讓每層各猜新值。

更正後要能回查原事件，不能只在報表填差額。

## 常見錯誤

- 金額更正後得到 230 元 → 把全值當差分累加 → 對全值採帶版本的同鍵更新。
- 原始稽核只剩目前一列 → 用狀態表代替明細 → 分開保留變更日誌。
- 指定 Unique 就忽略晚到 → 重送舊版仍可能覆蓋 → 用來源順序及反例重播。
