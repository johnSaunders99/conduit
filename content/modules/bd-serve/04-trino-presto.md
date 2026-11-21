---
id: bd-serve-04
module: bd-serve
order: 4
title: Trino 與 Presto
subtitle: 不用搬表也能跨來源查詢
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-03
objectives:
- 標出跨目錄查詢的數據來源與運算位置
- 用選欄和篩選解釋可推下的工作
- 按實際粒度核對跨來源結果
tags:
- catalog
- connector
- pushdown
- federated query
resources:
- title: Trino：協調器、工作節點與目錄
  url: https://trino.io/docs/current/overview/concepts.html
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀工作分配與 catalog.schema.table。
- title: Trino：下推
  url: https://trino.io/docs/current/optimizer/pushdown.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 對照計畫中的篩選、投影與連接下推。
- title: PrestoDB：官方專案
  url: https://github.com/prestodb/presto
  kind: repo
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀專案用途，辨認另一條獨立發行線。
concepts:
- id: bd-serve-04-catalog
  prompt: catalog.schema.table 的 catalog 在 Trino 代表什麼？
  answer: 代表以某連接器配置的一個可查來源，不一定是一台機器。
  mcq:
    question: lake.sales.orders 的第一段 lake 是什麼？
    options:
    - SQL 排序方向
    - 工作者名稱
    - 查詢目錄
    - JOIN 的鍵
    answer: 2
    explain: 目錄讓引擎知道該用哪一套連接器配置讀取。
  interview:
    question: 跨湖倉與訂單庫 JOIN 很慢，怎麼定位？
    points:
    - 看 EXPLAIN 的掃描和連接位置
    - 查是否能下推、讀了多少列和欄
    - 測對照並控制交易庫負載
    answer: 我先看計畫和兩端讀取量，確認日期條件有沒有下推。若每日都掃交易庫且連接無法在來源做，我會把所需欄增量搬到分析側，拿同一晚結果、讀量和延遲對照。
- id: bd-serve-04-push
  prompt: SQL 有 WHERE，就一定在遠端來源篩完再傳嗎？
  answer: 不一定；要看連接器、條件能否執行及實際計畫。
  mcq:
    question: 怎樣證明來源真的先做了篩選？
    options:
    - 只看 SQL 有 WHERE
    - 查看實際計畫並核對來源掃描及傳輸
    - 把輸出調成 10 列
    - 由速度比上一次快推斷
    answer: 1
    explain: 語法表達邏輯，執行計畫和讀取才說明物理位置。
- id: bd-serve-04-grain
  prompt: 一張會員表接多筆訂單後，COUNT(*) 還是在數會員嗎？
  answer: 不是；已變成連接後的影響列數，須先對齊業務粒度。
  mcq:
    question: 要輸出每城不同購買會員數，應數什麼？
    options:
    - 不重複的會員鍵
    - 每個訂單行號
    - 表的所有列
    - 連接器的數量
    answer: 0
    explain: 跨不跨來源不會改變粒度的數學；連接後得以需求單位計數。
practice:
- id: bd-serve-04-p1
  kind: sql
  category: [join, distinct]
  title: 核對城市的唯一買家數
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    將 `users` 當會員來源，`orders` 當訂單來源。只用已付款訂單，只列城市非 NULL 的會員；同城同一會員只算一次，無買家的城市不造列。只輸出 `city`、`buyers`，按 `buyers` 降序，同值 `city` 升序。
  solution: |
    SELECT u.city AS city, COUNT(DISTINCT u.user_id) AS buyers
    FROM users AS u JOIN orders AS o ON o.user_id = u.user_id
    WHERE u.city IS NOT NULL AND o.status = 'paid'
    GROUP BY u.city ORDER BY buyers DESC, city ASC;
  explain: |
    內連接後一名會員可能有多張訂單，直接 COUNT(*) 會算多。本題在 DuckDB 同一數據集驗證口徑，不證明 Trino 有連接下推。
  hints:
  - 先限制已付及已填城市。
  - 連接後再按會員鍵去重計數。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-04-grain
  - sq-compose-02-population
  tags:
  - 跨來源
  - 去重計數
- id: bd-serve-04-p2
  kind: sql
  category: [join, aggregate]
  title: 在跨來源連接前先縮小訂單輸入
  minutes: 7
  level: 3
  dataset: shop
  prompt: |
    取 2026-02-01（含）至 2026-02-15（不含）的已付款訂單，先在訂單側依 `user_id` 聚合，再接 `users`；保留空城市，不列未有合格訂單的會員。輸出 `user_id`、`city`、`paid_n`，依 `user_id` 升序。
  solution: |
    WITH per_user AS (
      SELECT user_id, COUNT(*) AS paid_n FROM orders
      WHERE status = 'paid' AND order_date >= DATE '2026-02-01'
        AND order_date < DATE '2026-02-15'
      GROUP BY user_id
    )
    SELECT p.user_id, u.city, p.paid_n
    FROM per_user AS p JOIN users AS u ON u.user_id = p.user_id
    ORDER BY p.user_id;
  explain: |
    先聚合為每人一列在此粒度下保留訂單數，且能減少送往連接的列。在 Trino 真正由誰做篩選與聚合仍需看連接器及計畫，不能由 CTE 的文字位置判定。
  hints:
  - 在訂單側只留實際用到的欄。
  - CTE 先按會員計數。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-04-push
  - bd-serve-04-grain
  - sq-compose-04-order-grain
  tags:
  - 先聚合
  - 下推
---

客服要查最近兩週的各城買家，會員在交易庫、訂單歷史在湖倉。Trino 與 PrestoDB 都是分散式 SQL 查詢引擎，可藉由連接器查不同系統。兩者有共同歷史，現在是不同專案：連接器、支援的語法、設定和發行版需分開查。這裡以 Trino 命名說明，不把查詢引擎當作新的永久儲存層。若把跨來源連接放在每秒都更新的看板，可能把負載轉到原交易庫。

## 跟著查詢走一遍

客戶端把 SQL 交給協調器（coordinator）；協調器規劃工作，工作節點（worker）讀分片、執行和交換數據。Trino 的目錄（catalog）對應一份連接器（connector）配置；用 `catalog.schema.table` 指到表。例子可想成 `lake.sales.orders` 和 `crm.app.users`；兩個目錄來源各異，不要求先把整表永久複製到同一庫。這種聯邦查詢（federated query；也稱聯合查詢）可以同時送請求到多處，但仍可能在工作節點搬動中間結果。

篩選下推（predicate pushdown）讓來源自己只回傳符合條件的列。例如日期篩完只剩十萬筆，比先傳一千萬筆再篩省網路。投影下推（projection pushdown）則只讀實際需要的欄；不必把備註和大欄也拉過來。聚合或連接也可能下推，但要看連接器與查詢，不能因寫了 `WHERE`、`JOIN` 就假設來源執行。不同目錄的連接通常需要引擎端合併，且每個來源的掃描與一致性都要分開看。

## 核對數據，再核對搬動

在 SQL 練習場用 `shop` 演練：先確認 `orders` 每列一張單，`users` 每列一人。兩表在本機 DuckDB 中，不是實際兩個遠端。下列查詢只驗證連接前的訂單量和涉及多少買家；它不是 Trino 服務的讀取量。

```sql
SELECT COUNT(*) AS order_n, COUNT(DISTINCT user_id) AS buyer_n
FROM orders
WHERE status = 'paid' AND order_date >= DATE '2026-02-01'
  AND order_date < DATE '2026-02-15';
```

這個範圍有 26 張已付訂單、涉及 15 位買家。把範圍、兩個計數和每表粒度記下來。預計計畫從哪端掃描、在哪裡交換，再用練習題寫出相同口徑的報表。正式驗收還要用 Trino 的 `EXPLAIN` 與來源度量證明下推、欄數及實際讀量。如果每個使用者每天都問同一個聚合，而交易庫又常因跨來源查詢出現等待，就可考慮[〈預聚合與物化視圖〉](#/lesson/bd-serve-05)或增量複製一份分析所需欄位，交換工作不應原封不動搬到每個看板請求。

上線時也要限制聯邦查詢的允許範圍。臨時客服請求少，不必先複製整庫；每隔幾秒跑的大範圍看板則可能耗盡來源連線。挑同一時段、同一結果做兩次測量：一次只取必要欄，一次刻意讓更多數據傳到工作節點，並對照來源掃描與傳輸，而非只看回傳幾列。

## 常見錯誤

- 有 WHERE 就承諾來源只傳符合的列 → 連接器可能沒有支援 → 看計畫再量來源。
- 連接後數的仍自稱「人」 → 一個人可能有多張單 → 明確使用會員鍵或先在正確粒度彙整。
- 把所有來源拉到同一查詢就覺得易維護 → 頻繁報表拖住交易庫 → 評估目的端物化與延遲成本。
