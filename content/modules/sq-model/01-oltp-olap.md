---
id: sq-model-01
module: sq-model
order: 1
title: OLTP 與 OLAP
subtitle: 付款成功不等於日報正確
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 從查詢的讀寫方式判斷它偏向交易或分析
- 用同一份訂單數據分別查一張單與每日付款金額
- 寫出日報的付款範圍、日期欄位和截止時間
tags:
- OLTP
- OLAP
- 日報
- 交易系統
resources:
- title: Google Cloud：數據倉庫概覽
  url: https://cloud.google.com/learn/what-is-a-data-warehouse
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀交易庫與數倉比較，辨認不同讀寫負載。
concepts:
- id: sq-model-01-transaction
  prompt: 交易系統為何不宜把扣庫存與建立訂單分成互不相干的寫入？
  answer: 兩步是一個業務承諾；其中一步失敗時，不能留下已扣庫存卻沒有訂單的狀態。
  mcq:
    options:
    - 每張表永遠各成一筆交易
    - 因為只要分析就不能寫入
    - 兩步要一起成功或一起失敗
    - 因為交易只能包含單列
    answer: 2
    explain: 交易邊界取決於承諾，不取決於欄位數、表數或是否有報表。
- id: sq-model-01-workload
  prompt: 如何從查詢辨認 OLAP 負載？
  answer: 通常讀取許多列、依維度彙總或比較歷史，不是只更新少量指定列。
  mcq:
    options:
    - 按訂單鍵查狀態
    - 比較一個月各日的付款額
    - 把商品庫存減一
    - 寫入一列退款紀錄
    answer: 1
    explain: 找一張單、更新狀態或新增明細偏交易；比較多天的付款額偏分析。
  interview:
    question: 店長想直接在收銀數據庫跑半年日報，你會怎麼做？
    answer: 我先弄清楚日報要多新。如果不要求每秒更新，我會把明細增量送去分析端，按營業日與狀態做彙總，再用筆數和金額跟來源對帳。報表揭露截止時間，避免分析掃描拖慢收銀。
    points:
    - 分清讀寫負載
    - 說明同步延遲與時間口徑
    - 提出可查驗的對帳方式
- id: sq-model-01-cutoff
  prompt: 交易庫的付款成功與日報晚一小時看見，有沒有矛盾？
  answer: 未必；要檢查日報的同步截止與是否已超過承諾時限。
  mcq:
    options:
    - 先修改付款公式
    - 只要晚到就代表交易失敗
    - 重新整理網頁即可定案
    - 先確認這次報表已載入到何時
    answer: 3
    explain: 兩套系統可有不同時間邊界；要用載入證據判斷，不先改金額公式或把差異歸咎快取。
- id: sq-model-01-scope
  prompt: 日報為何不能單看訂單明細是否存在？
  answer: 取消單仍可保留明細；付款口徑需依訂單狀態明確篩選。
practice:
- id: sq-model-01-p1
  kind: sql
  category: [model, select]
  title: 查取消單的狀態
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    在 `orders` 查詢 1010、1011、1012 號單。依序輸出 `order_id`、`order_date`、`status`，依 `order_id` 升序。不排除取消單。
  solution: |
    SELECT order_id, order_date, status
    FROM orders WHERE order_id IN (1010, 1011, 1012)
    ORDER BY order_id;
  explain: |
    按訂單鍵取少量明細，這是交易系統常見的讀取形狀。加上 `status = 'paid'` 會把正要追查的取消單濾掉。
  hints:
  - 用 IN 列出 3 個訂單鍵
  - 不必連明細表
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-01-transaction
  - sq-model-01-workload
  tags:
  - OLTP
  - OLAP
- id: sq-model-01-p2
  kind: sql
  category: [model, aggregate]
  title: 做出每日付款金額
  minutes: 7
  level: 2
  dataset: shop
  prompt: |
    只取 `orders.status = 'paid'` 的訂單，依其 `order_date` 彙總明細的 `qty * unit_price`，不扣退款。依序輸出 `order_date`、`paid_amount`，日期升序；不補沒有付款單的日期。
  solution: |
    SELECT o.order_date, SUM(i.qty * i.unit_price) AS paid_amount
    FROM orders o JOIN order_items i ON o.order_id = i.order_id
    WHERE o.status = 'paid'
    GROUP BY o.order_date ORDER BY o.order_date;
  explain: |
    先保留付款單，再彙總成交明細。直接掃 `order_items` 會把仍有品項的取消單算入；不要用現行商品標價回算。這個 JOIN 與 GROUP BY 的基本寫法也適用 Hive SQL、Spark SQL 與 MySQL。
  hints:
  - 用 order_id 連接
  - 先篩狀態再按營業日聚合
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-01-workload
  - sq-model-01-scope
  tags:
  - OLTP
  - OLAP
---

## 一張單與一天的數字

客人問「1011 號單付款成功了嗎？」店長問「1 月 18 日共收了多少？」問題都從訂單出發，卻需要兩種工作方式。第一個要回到一張單當下的狀態；第二個要掃過當日所有合資格的明細，還可能要比較過去 30 天。先分清問題，才知道應該找哪張表、讀多少數據，以及結果能不能拿來承諾。

- **線上交易處理（online transaction processing，OLTP）**：處理結帳、取消、扣庫存等短而頻繁的操作。交易（transaction）可以把應該一起成功的數據庫寫入包在一起；若失敗就不留下半套。跨付款服務等外部寫入不能只靠本地交易保證。
- **線上分析處理（online analytical processing，OLAP）**：為比較、分組與彙總讀許多列。例如比較每天各類商品的成交額。數據倉庫（data warehouse，簡稱數倉；台灣多稱資料倉儲）通常會整合不同來源並保留歷史，讓大量分析讀取不用和結帳競爭相同資源。

這不是用數據庫品牌分類。同一個引擎也可能支援兩種查詢；要分的是工作量、寫入一致性與數據更新方式。分析端可能慢幾分鐘或一批，但慢多久必須說得清楚。反過來，交易庫當作唯一報表來源也不一定看得見歷史，例如商品只剩最新價格時就無法用它還原成交時的定價。

## 把需求翻成可驗算的查詢

在 SQL 練習場選 `shop`。先讀指定鍵的狀態；這是查單，不是在模擬付款：

```sql
SELECT order_id, order_date, status
FROM orders
WHERE order_id IN (1010, 1011)
ORDER BY order_id;
```

兩張單都在 1 月 18 日，只有 1010 已付款。明細裡它有 3 件各 90 元與 1 件 50 元，共 320 元；取消的 1011 仍有明細，卻不能加入本課定義的付款金額。這個結果只算成交明細，不是實收淨額；退款有自己的入帳日。把同一做法擴到全部日報，就是先按狀態篩單，再連到明細和加總。下一堂[〈業務過程與粒度〉](#/lesson/sq-model-02)會細講一列代表一單或一品項，為何能改變對同一批紀錄的計數。

假設日報標著「已載入至 09:00」。09:15 才到的補送沒有立刻出現在日報，不必先重算公式；應核對來源是否已有紀錄、載入進度是否超時，再到落後的那一段查錯。「有沒有收到」和「屬於哪個營業日」是兩個問題。

查單的正確性可以用單張收據或狀態紀錄核對；日報的正確性還要核對有哪些訂單應被收進去。用同一張紙記下這兩種證據，避免把一次成功查詢誤認為整批已齊。

## 方言與常見錯誤

基本篩選與加總可以共用。要算配送跨了幾天時，DuckDB 的 `date_diff('day', start_date, end_date)` 先起後迄；Hive SQL、Spark SQL 和 MySQL 的 `DATEDIFF(end_date, start_date)` 先迄後起。面試可用兩個已知日期驗證正負號，不要靠背函式名猜答案。

- 日報含取消單 → 把「有明細」當「已收款」→ 以訂單狀態篩選。
- 大量查詢時結帳變慢 → 分析和交易搶資源 → 先量尖峰延遲，再搬分析讀取。
- 同一張單兩處數字不同 → 兩邊截止時間或口徑不同 → 先對齊範圍、日期與截止再對帳。
