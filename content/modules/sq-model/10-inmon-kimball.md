---
id: sq-model-10
module: sq-model
order: 10
title: Inmon 與 Kimball
subtitle: 先整合企業還是先交付集市
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-09
objectives:
- 說出 Inmon 與 Kimball 對企業整合和交付的先後取捨
- 把茶舖的同一項付費指標分配到四個數倉層
- 比較明細彙總與集市口徑並保留對帳證據
tags:
- Inmon
- Kimball
- 數倉分層
- DWD
- 數據集市
resources:
- title: Kimball Group：兩種整合路徑
  url: https://www.kimballgroup.com/2004/03/differences-of-opinion/
  kind: article
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀兩種整合方法及共通的企業一致性目標。
concepts:
- id: sq-model-10-inmon
  prompt: Inmon 路徑先希望穩住什麼？
  answer: 先建立整合的企業級數據倉庫，再由它供應下游集市；核心常採正規化。
  mcq:
    options:
    - 先各自發布不共用的集市
    - 先整合企業核心模型
    - 直接在收銀庫做報表
    - 先分配儀表板顏色
    answer: 1
    explain: 重點是企業整合先於各應用交付，不是禁用維度模型或限定某種引擎。
- id: sq-model-10-kimball
  prompt: Kimball 先做一個業務過程，如何避免各集市永久割裂？
  answer: 先以匯流排矩陣規劃共用的一致維度，再逐個交付過程。
  mcq:
    options:
    - 每個集市自己定義日期
    - 保證每張表名相同
    - 只建一張全欄位表
    - 共用一致維度並按過程交付
    answer: 3
    explain: 逐步交付不等於互不相容；共用定義不能由每個報表自行發明。
  interview:
    question: 資源只有兩週，會從企業總模型還是第一個分析過程開始？
    answer: 若現在主要要交付茶舖日報，我會先做訂單這個明確過程，用一致日曆和會員定義留好擴充點。若已知多個來源的會員識別互撞，我會先解整合那一段，不假裝做完報表就算企業一致。
    points:
    - 按限制做明確決策
    - 說出企業整合和可交付性
    - 用共用維度與對帳守住一致性
- id: sq-model-10-layers
  prompt: 每筆付費品項的統一口徑應先在哪一層確立？
  answer: 明細數據層；上層可使用或彙總，而不是各報表重寫 paid 判斷。
  mcq:
    options:
    - 只在應用層篩
    - 只在日彙總後推測
    - 明細數據層
    - 把原始歷史覆寫
    answer: 2
    explain: 原始層保存來源，彙總和應用建立在已清理的可追溯明細上。
- id: sq-model-10-reconcile
  prompt: 日彙總和明細金額不同，先核對什麼？
  answer: 核對營業日、狀態、截止範圍和實際使用的鍵，再追數據血緣查哪一層改變了含義。
practice:
- id: sq-model-10-p1
  kind: sql
  category: [model, join]
  title: 從明細層建立付款品項
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    取 1009–1013 號已付款訂單（含兩端）的所有品項。依序輸出 `order_id`、`line_no`、`order_date`、`line_amount`（件數乘成交單價），按 `order_id`、`line_no` 升序。
  solution: |
    SELECT o.order_id, i.line_no, o.order_date, i.qty * i.unit_price AS line_amount
    FROM orders o JOIN order_items i ON i.order_id = o.order_id
    WHERE o.status = 'paid' AND o.order_id BETWEEN 1009 AND 1013
    ORDER BY o.order_id, i.line_no;
  explain: |
    用狀態和明細鍵固定明細層規則。此處仍是一單每行號一列，不要在這一層先按天壓成一列。
  hints:
  - 以 order_id 連付款表頭
  - 保留 line_no
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-10-layers
  - sq-model-02-line-key
  - sq-model-01-scope
  tags:
  - Inmon
  - Kimball
- id: sq-model-10-p2
  kind: sql
  category: [model, reconcile]
  title: 從雙粒度對帳生成日期集市
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    取所有訂單。用付費品項明細彙成日付費金額，從付費訂單表頭另彙成日訂單數。依序輸出 `order_date`、`paid_orders`、`gross_amount`；保留有付費訂單的日期，即使無明細也給金額 0，日期升序。
  solution: |
    WITH paid AS (
      SELECT order_id, order_date FROM orders WHERE status = 'paid'
    ), dwd AS (
      SELECT p.order_date, i.qty * i.unit_price AS amount
      FROM paid p JOIN order_items i ON i.order_id = p.order_id
    ), daily_amount AS (
      SELECT order_date, SUM(amount) AS gross_amount FROM dwd GROUP BY order_date
    ), daily_orders AS (
      SELECT order_date, COUNT(*) AS paid_orders FROM paid GROUP BY order_date
    )
    SELECT o.order_date, o.paid_orders, COALESCE(a.gross_amount, 0) AS gross_amount
    FROM daily_orders o LEFT JOIN daily_amount a ON a.order_date = o.order_date
    ORDER BY o.order_date;
  explain: |
    訂單數從表頭算，日金額從明細算。直接連明細後 `COUNT(*)` 會按明細數增加。把中間明細命名為 dwd 只是示意數據責任，CTE 不是永久保存。
  hints:
  - 分成 paid、dwd 與 daily_amount
  - 由日訂單數左連日金額
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-10-layers
  - sq-model-10-reconcile
  - sq-model-06-drill-across
  tags:
  - Inmon
  - Kimball
---

## 先整合，還是先交付一個過程？

茶舖想先做日報，隔季才接客服和倉庫數據。若收銀、網店和客服三邊對「會員」的定義已經打架，就有先整合核心的理由；若只有一份付款來源，先交付小而可核對的銷售模型通常更快。這是兩種數倉路徑的取捨：

- **Inmon**：通常先建按主題整合的企業級數據倉庫（enterprise data warehouse），核心常做正規化，再讓數據集市（data mart，台灣也稱資料超市）供應不同分析。好處是先處理跨系統的識別和定義；代價是首個可用報表可能要等整合。
- **Kimball**：先以匯流排矩陣規劃共用一致維度，再按業務過程交付可分析的維度模型。可以先做訂單，再接退款，但不能讓兩套日期或會員口徑各說各話。代價是每次新過程要遵守並維護共用標準。

它們不是「一種只能造大倉、一種只能造小表」。同一組織可以先整合來源，再透過星型集市交付。評估的是先解哪類風險與要等多久，不是背下兩張固定的架構圖。

## 用一份日報畫出四個責任

數倉分層（warehouse layering）是把不同責任拆開。以下是常見命名，不是任何引擎規定，也不與 Inmon 或 Kimball 一一對應：

1. **原始數據層（operational data store，ODS）**：在本課慣例中保存來源的訂單、明細和批次證據，讓載入可追查。
2. **明細數據層（data warehouse detail，DWD）**：統一鍵、類型和付款定義；付費品項仍是一單每行號一列。
3. **彙總數據層（data warehouse service，DWS）**：重用明細與訂單日結果，提供一天一列的指標組合。
4. **應用數據層（application data service，ADS）**：面向經營日報，明示「成交額未扣退款」和載入截止時間。

在 `shop` 重建其中的兩層。1 月 18 日，1010 是付款單，1011 是取消單：日報應是 1 單、320 元。若上層數字不對，循數據血緣（data lineage）往回查，也就是沿來源、轉換到結果的依賴，先找哪一層首次偏離。若正式模型要求付款單一定有明細，練習中缺明細填零的展示不能取代完整性告警。

把一張明細錯誤分派到哪一層，也是面試常問的實務題。來源列已缺時先修補接收，不靠彙總層硬補數字；原始列正確而付款規則未套用時，修明細層；只有看板把元顯示成分時，才回到應用層排查。

再把對帳責任交給實際能修復該層的角色。

## 方言與常見錯誤

本課的 `WITH` 只是命名中間結果，Hive SQL、Spark SQL 和 MySQL 8 也可用。把它保存為數據表是另一件事；各引擎建表和更新方式不同。如何取捨讀取和寫入成本，[〈物化策略〉](#/lesson/cl-dbt-03)會細講。

- 每張報表都重寫付款篩選 → 集市口徑走散 → 在明細層固定並對帳。
- 層名齊全卻無法追數 → 沒留下來源批次或轉換關係 → 先補血緣線索。
- 少做某層被視為錯誤 → 把組織命名當標準 → 先看責任是否都有著落。
