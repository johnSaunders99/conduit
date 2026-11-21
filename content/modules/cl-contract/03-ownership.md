---
id: cl-contract-03
module: cl-contract
order: 3
title: 模型文件與擁有者
subtitle: 不知道問誰的指標不算完成
status: ready
minutes: 35
level: 3
prereqs:
- cl-contract-02
objectives:
- 寫出包含粒度、單位與例外的模型文件
- 用來源到日報的依賴找到可追查的上游
- 區分模型維護、來源修復與使用方驗收的責任
tags:
- 模型文件
- 擁有者
- 數據血緣
- 操作手冊
resources:
- title: dbt：模型文件
  url: https://docs.getdbt.com/docs/build/documentation
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀模型描述、欄位描述與文件生成。
- title: dbt：模型群組
  url: https://docs.getdbt.com/docs/build/groups
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 group 和 owner 如何表明維護範圍。
concepts:
- id: cl-contract-03-owner
  prompt: 模型擁有者最重要的承諾是什麼？
  answer: 維護定義、變更與事故處置的入口；不必親自修每個來源，但要協調到有責任者。
  mcq:
    options:
    - 是最早寫 SQL 的人即可
    - 擁有所有上游系統
    - 為模型規則和變更提供責任入口
    - 只要是第一個開報表的人
    answer: 2
    explain: 僅有名字不代表有運作的交接；擁有者要有行動範圍和聯絡方式。
  interview:
    question: 你接到一個「金額對不上」的告警，這份模型文件要怎麼幫你？
    answer: 它應告訴我誰維護、按哪個日期和單位算、何時更新。我會沿血緣先比來源和暫存，若後者對而集市錯就由模型擁有者查；若來源沒到，再走上游通知。
    points:
    - 清楚責任入口
    - 用血緣定位第一次偏差
    - 給消費者更新和驗收方式
- id: cl-contract-03-lineage
  prompt: 數據血緣圖能直接告訴你付費欄是否扣退款嗎？
  answer: 不能；它指向依賴，仍要查模型描述、查詢和驗收值。
  mcq:
    options:
    - 不能，還要讀文件與對帳
    - 能，血緣箭頭等於公式
    - 能，只要有來源節點
    - 只有大於 1 個下游時能
    answer: 0
    explain: 箭頭回答數據從哪裡來，不自動回答口徑或品質。
- id: cl-contract-03-runbook
  prompt: 交接文件遇到 1 月 18 日少一張單，應怎麼讓同事查？
  answer: 寫清查對應日期、狀態與截止點的步驟，再告知何時通知來源或報表維護方。
  mcq:
    options:
    - 寫「見 SQL」
    - 只附報表首頁
    - 放一張圖、不說入口
    - 列出檢查與升級路徑
    answer: 3
    explain: 可以執行且清楚分工的步驟比「自行排查」實用。
- id: cl-contract-03-consumers
  prompt: 為何仍要記錄依賴圖外的消費者？
  answer: 外部報表、匯出和手寫查詢未必使用 ref；若不盤點，變更會漏通知。
practice:
- id: cl-contract-03-p1
  kind: sql
  category: [dbt, select]
  title: 留下可追到來源的查證列
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    取 `orders` 的 1009、1010、1011。依序輸出 `order_id`、`order_date`、`status`，按 `order_id` 升序。用途是保留原始狀態供排查，不排除取消。
  solution: |
    SELECT order_id, order_date, status FROM orders
    WHERE order_id IN (1009, 1010, 1011) ORDER BY order_id;
  explain: |
    現場查證需要來源鍵、日期與狀態，只有合計無法證明哪一列被排除。
  hints:
  - 直接查訂單來源，不必連退款
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-03-lineage
  - cl-contract-03-runbook
  tags:
  - 模型文件
  - 擁有者
- id: cl-contract-03-p2
  kind: sql
  category: [dbt, aggregate]
  title: 列出日期層的來源與採用量
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    對 2026-01-17 至 2026-01-19（含兩端）有訂單的日期，依序輸出 `order_date`、`source_rows`、`accepted_rows`（付費）、`excluded_rows`（其餘）。日期升序。
  solution: |
    SELECT order_date, COUNT(*) AS source_rows,
           SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS accepted_rows,
           SUM(CASE WHEN status = 'paid' THEN 0 ELSE 1 END) AS excluded_rows
    FROM orders WHERE order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
    GROUP BY order_date ORDER BY order_date;
  explain: |
    報表數字對不上時先把排除量列出來。過早以 WHERE 篩付款，會讓來源量等於採用量而無法查證。
  hints:
  - 日期先過濾，狀態用 CASE 分桶
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-03-runbook
  - cl-contract-03-lineage
  - cl-dbt-06-coverage
  tags:
  - 模型文件
  - 擁有者
- id: cl-contract-03-lab
  kind: explain
  title: 交給下一位維護者一頁操作手冊
  minutes: 9
  steps:
  - 在 dbt-shop 寫 daily-orders-runbook.md，列目的、粒度、欄位口徑、更新、角色、依賴和排查。
  - 附上 1 月 18 日的來源、採用及排除量，讓別人不問你也能驗算。
  checks:
  - 追查路徑從日報經 stg_orders 回到 raw.orders；說清不是依報表瀏覽日統計。
  - 指定分析工程、來源維護與報表使用角色各做什麼，不填姓名或聯絡帳號。
---

## 文件要能在出事時使用

日報欄位有描述，卻沒有誰接告警、去哪裡對帳，凌晨出事時還是要靠猜。模型擁有者（model owner）應是一個能對定義、變更與事故採取行動的責任入口。不等於擁有所有上游，也不能只寫「原作者」。小團隊可用角色或工作群組名稱，清楚寫出何時找哪個入口。

以茶舖日報為例，分析工程組負責一日一列的付費口徑和重建；來源維護組查站點批次和原始狀態；報表使用組確認業務是否接受數字與更新時刻。dbt 群組（group）可以記模型責任範圍及擁有者，但不能取代事故約定，也不會自動把通知送給每個外部使用者。

## 寫一張能被別人執行的卡

在 `dbt-shop` 建立 `daily-orders-runbook.md`。同一個名稱若有 v1、v2，要同時寫上適用版本。卡片至少能回答：

1. **用途與粒度**：按營業日顯示至少有一張付費單的日數字；未覆蓋無單日期，非完整日曆。
2. **欄位口徑**：`order_date` 來自來源營業日期；`paid_orders` 是以清理後付款狀態計算的訂單筆數，不是金額或扣退款後的淨額。
3. **血緣與截止**：文件能指出 `raw.orders → stg_orders → fct_daily_orders`。來源何時到以及模型建於何時，要引用各自的紀錄。
4. **告警與交接**：比對某日來源總列、付費列與取消列；若原始列少找來源維護，若暫存正確而日報錯找分析工程。報表使用組收到新口徑要回覆完成驗收。

實際跑兩題並註明來源是 App `shop` 的歷史樣本，不是本機 dbt 的三筆樣本。1 月 18 日應有 2 張來源單、採用 1、排除 1；用 1010 與 1011 解釋差異。筆數相符後，再看報表是否展示的是同一截止。若看到 1 月 17 日數量在兩環境不同，不要直接宣稱有錯，先核對不同範例的輸入。這樣的手算能用在修改之後，不是一次性的說明。

替這一頁文件找一個只有文字也走得通的驗收。請讀者假設告警寫「昨天 0 單」，不問你就能找出昨天屬於哪個營業日、來源是否確實載到、哪個查詢會證實有付款，以及差異要回報到哪一組。如果任何一步只能依賴口耳相傳，那才是最該加到手冊的一段。明天若改了狀態對照，文件應跟模型同時更新，不留兩份相反的規則。

在 dbt 可以把分析工程組宣告成群組，再用模型 `config.group` 指到它；擁有者可記團隊角色名稱。這表示歸屬關係，不代表下游已簽收或通知已發。

當責任交棒時也同步更新。

## 常見錯誤

- 文件只有欄名 → 使用者仍不知道哪種訂單被計入 → 補粒度、條件和對帳樣本。
- 血緣圖只有 dbt 節點 → 外部匯出未被列入 → 另盤點實際消費者。
- 沒有人接手修復 → 只有作者沒有責任角色 → 寫明模型、來源與使用端的入口。
