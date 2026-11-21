---
id: bd-serve-05
module: bd-serve
order: 5
title: 預聚合與物化視圖
subtitle: 用更新成本交換查詢速度
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-04
objectives:
- 說明一般視圖和預存查詢結果的差別
- 由可合併中間量重算整體指標
- 寫出有更新與對帳條件的預聚合設計
tags:
- materialized view
- 預聚合
- refresh
- 新鮮度
resources:
- title: ClickHouse：增量物化視圖
  url: https://clickhouse.com/docs/concepts/features/materialized-views/incremental-materialized-view
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀插入觸發、目標表與既有數據回填。
concepts:
- id: bd-serve-05-grain
  prompt: 每店每日預聚合要回查每筆訂單，直接由小計還原可以嗎？
  answer: 不能；小計已丟失明細，原始表要另保留。
  mcq:
    question: 要兼顧日彙總和訂單稽核，哪個設計合理？
    options:
    - 只存每月平均
    - 保留明細，另供查詢用的日小計
    - 每次把結果覆蓋到明細表
    - 只存最快的查詢時間
    answer: 1
    explain: 預聚合優化特定粒度，不取代能逐筆追溯的原始數據。
  interview:
    question: 用物化視圖做付款報表，你如何驗收快且正確？
    points:
    - 固定粒度及更新延遲
    - 處理回填和修改刪除
    - 對比明細的正確性與掃描列數
    answer: 我先定每日每店的小計，寫明幾分鐘可見。用原始表查同一時間段對帳，額外插入晚到與退款，驗證更新或回填。只有口徑相同再比較讀取量。
- id: bd-serve-05-average
  prompt: 有 1 筆 100 和另一組 9 筆平均 200，整體均價是多少？
  answer: 190。要用各組金額和除以總件數，不是直接平均 100 與 200。
  mcq:
    question: 想合併任意兩組均值，預存什麼？
    options:
    - 只存各組平均值
    - 各組最大值
    - 各組總和和計數
    - 只存各組中位數
    answer: 2
    explain: 分母不同，平均的平均不是正確加權結果。
- id: bd-serve-05-refresh
  prompt: ClickHouse 插入觸發式物化視圖會在來源 UPDATE 後自動重算歷史嗎？
  answer: 不能依賴這行為；增量視圖主要處理新插入的區塊，修正歷史要另設機制。
  mcq:
    question: 建視圖前的舊訂單沒有進報表，要怎麼查？
    options:
    - 查既有數據回填是否已做並隔離邊界
    - 只看新數據插入成功
    - 等到索引重新命名
    - 增加前端更新頻率
    answer: 0
    explain: 用插入觸發不會自動掃完舊表；回填要避免與新寫重疊或有缺口。
practice:
- id: bd-serve-05-p1
  kind: sql
  category: [ddl, model]
  title: 建立每日退款物化基準
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    在 DuckDB 建表 `daily_refunds` 作為固定快照：按 `refunds.refund_date` 彙總所有列，一日一列。欄位依次為 `refund_date`、`refund_n`、`refund_total`。保留該表供檢查；讀取順序按 `refund_date` 升序。
  solution: |
    CREATE TABLE daily_refunds AS
    SELECT refund_date, COUNT(*) AS refund_n, SUM(amount) AS refund_total
    FROM refunds GROUP BY refund_date;
  explain: |
    CTAS 把聚合結果存成表；不是會自動跟著來源更新的物化視圖。只存每筆平均退款金額會遺失可合併的分母。
  hints:
  - 用 CREATE TABLE AS 加聚合。
  - 一列必須對應一個退款日。
  check:
    ordered: true
    columnNames: true
    mode: state
    query: SELECT refund_date, refund_n, refund_total FROM daily_refunds ORDER BY refund_date;
  concepts:
  - bd-serve-05-grain
  - bd-serve-05-refresh
  - bd-serve-02-sum
  tags:
  - 物化
  - 按日聚合
- id: bd-serve-05-p2
  kind: sql
  category: [aggregate]
  title: 用組內總和及件數合回全店均價
  minutes: 6
  level: 3
  dataset: shop
  prompt: |
    先以 `products.category` 聚成每組的 `price_sum` 與 `n`，然後合回按品項等權的全店均價。只輸出一列，欄序 `item_n`（全店品項數）、`shop_avg`（全店均價，不四捨五入）。單列無特別排序。
  solution: |
    WITH per_category AS (
      SELECT category, SUM(price) AS price_sum, COUNT(*) AS n
      FROM products GROUP BY category
    )
    SELECT SUM(n) AS item_n, SUM(price_sum) * 1.0 / SUM(n) AS shop_avg
    FROM per_category;
  explain: |
    正確是組總和相加除以組件數相加。直接平均各分類均值會讓每類同權。此處是 DuckDB 的兩階段計算；ClickHouse 實體上可保存合併用中間量。
  hints:
  - 先保存分子和分母。
  - 外層相除前要各自合計。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-05-average
  - bd-serve-05-grain
  - sq-window-01-whole
  tags:
  - 加權平均
  - 可合併聚合
---

門市看板每次都掃一天的付款明細，但畫面只顯示每店幾筆、總金額多少。可先做預聚合（pre-aggregation），把大量輸入壓成較少的小計。普通視圖（view）是可重用的查詢定義；物化視圖（materialized view；台灣也稱實體化檢視表）會實際維護預算好的數據，讀取成本下降，寫入、儲存與更新成本增加。有些引擎會定時重算，有些隨插入更新；不能看到名稱就推斷一致性。

## 先問小計能否再合併

一店每分鐘 1000 筆付款，一天有 144 萬筆。若業務主要看店與日，先存筆數及金額，查一天可能只需一個小計；但若要查哪筆重送，仍要存明細。就算小計可合併，指標也不全是同一類：總額可相加，平均要保存總和與分母；不同用戶數不可把各窗人數直接相加，因同一人會跨窗口。把可合併的狀態和為快速顯示才算的最後值分開，避免為了快而改口徑。

ClickHouse 的增量物化視圖主要像在來源接到新插入區塊時執行的轉換，將結果寫往目標表。`CREATE MATERIALIZED VIEW … TO target AS SELECT …` 指出轉換和目的表；具體如何合併由目標數據的模型決定。插入前的歷史要另回填，來源後續更新、刪除或維度表變化也不應假設會觸發同樣重算。若採定期刷新（refresh），則要寫明刷新時間、舊版本可否繼續讀及失敗時如何告警。任何方案要對帳，都須先訂晚到、退款、更正的規則。

## 自由練習看明細口徑

在 SQL 練習場選 `shop`。這段 DuckDB 查詢是對帳基準，輸出每日訂單筆數，不建立會自動更新的視圖。真正的退款小計在練習另外做。

```sql
SELECT order_date, COUNT(*) AS paid_n
FROM orders WHERE status = 'paid'
GROUP BY order_date ORDER BY order_date;
```

寫下你準備物化的粒度、保留的總和或計數、晚到時如何補與更新費用。做查詢比較時，挑相同月份、相同已付定義、相同截止位置，看明細與小計是不是對上，再比較掃描量。回填歷史時要為舊回填和持續接入切清楚邊界；如何在兩條路對帳，見[〈Lambda 架構〉](#/lesson/bd-serve-06)。

更新成本不只是一份新數據：若同一張來源表衍生很多視圖，每次插入可能要維護多份不同粒度的小計。先挑最頻繁的一類查詢試作，量寫入量、延遲與重建時間。當指標口徑改版，也不要在新舊小計一半一半時切換讀取；把版本、回填截止與驗收結果都留在交接表。

如果暫時沒有可靠的補數機制，就讓新視圖先服務試用報表，並保留回查明細的入口。

## 常見錯誤

- 看板快了卻每日少算 → 小計未處理遲到或更正 → 定義刷新與對帳規則。
- 直接平均各店平均 → 各店筆數不同 → 維護分子和分母再相除。
- 視圖上線前的歷史空白 → 插入觸發不自動補舊數據 → 另設回填並記邊界。
