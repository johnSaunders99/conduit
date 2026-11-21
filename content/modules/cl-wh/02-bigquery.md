---
id: cl-wh-02
module: cl-wh
order: 2
title: BigQuery 分區與費用
subtitle: 只查一天不要付整月掃描費
status: ready
minutes: 35
level: 3
prereqs:
- cl-wh-01
objectives: ["以日期分區欄位寫出左閉右開的查詢條件","用乾跑和單次上限拆解按需查詢的成本風險","用相鄰日期確認本機篩選口徑"]
tags: ["BigQuery","分區裁剪","最大計費量","dry run"]
resources:
  - title: "BigQuery：估算及控制成本"
    url: https://docs.cloud.google.com/bigquery/docs/best-practices-costs
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: "讀乾跑、最大計費位元組與 LIMIT 的限制。"
  - title: "BigQuery：查詢分區表"
    url: https://docs.cloud.google.com/bigquery/docs/querying-partitioned-tables
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "找可裁剪的分區條件與必要分區篩選。"
concepts:
  - id: cl-wh-02-pruning
    prompt: "分區裁剪會在哪一步省工作？"
    answer: "在讀取前排除不可能符合條件的分區。"
    mcq:
      options:
        - "在結果產出後移除多餘列。"
        - "在傳輸後縮小下載檔。"
        - "在讀取前排除不可能符合條件的分區。"
        - "把每個分區都掃描但只保留第一列。"
      answer: 2
      explain: "裁剪要靠引擎能先判斷的條件，不是事後截結果。"
  - id: cl-wh-02-cap
    prompt: "按需查詢開跑前，如何防止單次計費掃描估算超額？"
    answer: "先乾跑看位元組估算，再設最大計費位元組上限。"
    mcq:
      options:
        - "先乾跑看位元組估算，再設最大計費位元組上限。"
        - "加 LIMIT 10 就能保證掃描上限。"
        - "查完後把下載取消。"
        - "只用每月預算寄信，不設單次限制。"
      answer: 0
      explain: "LIMIT 限輸出，不能作為掃描上限；預算通知也不會在送出前擋查詢。"
    interview:
      question: "相同日報的 BigQuery 費用變成以前數倍，怎麼切分調查？"
      points:
        - "用相同輸出比較乾跑估算"
        - "查日期與欄位是否放寬"
        - "對照按需計費與容量方案"
      answer: "我先確認費用屬於按需掃描還是容量，對同一查詢乾跑，核對分區條件能否先裁剪，以及是否多取了欄位。再設單次上限，驗收結果不縮水才發布新查詢。"
  - id: cl-wh-02-bound
    prompt: "查 1 月 18 日且不包含隔日，日期比較應如何寫？"
    answer: "下界包含 1 月 18 日，上界不含 1 月 19 日。"
    mcq:
      options:
        - "下界排除 18 日，包含 19 日。"
        - "下界包含 1 月 18 日，上界不含 1 月 19 日。"
        - "用 BETWEEN 包含 18 日及 19 日。"
        - "只設下界，不設上界。"
      answer: 1
      explain: "半開區間讓相鄰批次不重疊，排錯時也方便核對邊界。"
practice:
  - id: cl-wh-02-p1
    title: "只讀一個業務日"
    kind: sql
    category: [time, plan]
    minutes: 5
    dataset: shop
    level: 1
    prompt: |
      用 `shop` 的 `orders` 找 2026-01-18 的全部訂單，包含取消。欄位依序為 `order_date`、`order_id`；列按 `order_id` 升序。
    solution: |
      SELECT order_date, order_id
      FROM orders
      WHERE order_date >= DATE '2026-01-18' AND order_date < DATE '2026-01-19'
      ORDER BY order_id;
    explain: |
      用明確的日期下界與排除的上界，排除隔天（此例為 DATE 欄，直接比較相等也能得到同樣結果）。BETWEEN 兩端都含，若拿 19 日當終點會多列。DuckDB 驗輸出，不檢查 BigQuery 是否裁剪。
    hints: ["拿隔天作為不包含的上界。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-02-bound","cl-wh-02-pruning","sql-range-bound"]
    tags: ["日期切片","分區條件"]
  - id: cl-wh-02-p2
    title: "驗證月界線的兩天日報"
    kind: sql
    category: [time, aggregate]
    minutes: 8
    dataset: shop
    level: 2
    prompt: |
      用 `shop` 的 `orders` 計算 2026-01-31 到 2026-02-02（不含 02-02）每天的已付款訂單數。只列出有已付款訂單的日期，欄位依序為 `order_date`、`paid_orders`，列按 `order_date` 升序。
    solution: |
      SELECT order_date, COUNT(*) AS paid_orders
      FROM orders
      WHERE order_date >= DATE '2026-01-31' AND order_date < DATE '2026-02-02'
        AND status = 'paid'
      GROUP BY order_date
      ORDER BY order_date;
    explain: |
      分區欄保留在日期比較的一側，狀態用另一條條件。只比較日號會在跨月時錯漏。BigQuery 分區裁剪須用實際的分區欄及支援的條件，最後以乾跑確認。
    hints: ["跨月也可直接比較完整日期。","按 order_date 分組後再決定輸出順序。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-02-bound","cl-wh-02-pruning","sql-range-naked","sq-group-03-key"]
    tags: ["跨月","日期聚合"]
---

## 成本安全：先看預估，不送出雲端查詢

只用應用內 DuckDB，不開 Google Cloud。真的測 BigQuery 時，先查試用適用範圍及專案計價模式；對按需查詢用乾跑（dry run）估讀取量，加單次上限，再決定是否執行。接著確認查詢結果或測試表的保留與清理。不要拿本機讀取量當成雲端帳單。

日報維護者為了看是否正常，只想取 10 列；若來源是整月的數據，`LIMIT 10` 並不保證少掃。分區（partition）是儲存上的可分開讀取範圍；若表按 DATE 型別的 `order_date` 分區，查詢能在讀入前判斷只用其中一天，就是分區裁剪（partition pruning）。只選需傳回的欄位也可避免讀多餘的欄。`WHERE` 的任何條件並不都能裁剪：對真正的分區欄用可預先判斷的邊界，並用乾跑檢查。不用日號字串或另一欄的值來猜會掃哪天。

## 基本形式：先選日期，再算業務條件

選 SQL 練習場的 `shop`。使用[〈半開區間〉](#/lesson/sq-time-02)的下界含、上界不含；以下是 DuckDB 查詢，`shop` 的 `orders` 的 `order_date` 是業務日，不代表本機表採 BigQuery 的物理分區。

```sql
SELECT order_date, COUNT(*) AS order_rows
FROM orders
WHERE order_date >= DATE '2026-01-18'
  AND order_date < DATE '2026-01-19'
GROUP BY order_date
ORDER BY order_date;
```

返回 `2026-01-18, 2`。當天含取消單；加 `status = 'paid'` 才是已付款口徑。對 TIMESTAMP 分區要另確認分區及業務時區；對攝取時間分區則要用該表的實際分區欄（例：`_PARTITIONDATE`），不能只用訂單日期就假定有裁剪。

## 為一次查詢設停止條件

想像乾跑估整月 280 GiB，單日 9 GiB，本次核准最多 12 GiB。按需模式可設定最大計費位元組（maximum bytes billed），讓估算超過上限的查詢不執行。乾跑是估算，不是最終帳單；還須核對最低計費量、方案、區域和真實用量。若是容量計價，掃描估算仍可做查詢診斷，但不可直接乘按需單價。日常表也可要求必須有可用的分區篩選，避免不小心送全表；這與單次限額是兩層防線。

### 用兩個反例拆開查詢正確性與成本

第一個反例只改結果的列數上限：回傳較少，不等於少讀分區。第二個反例在原時間條件外用「或」納入某個會員的訂單：這個會員可能每天都有單，因此日期外的分區不能全部排除。先問業務是否真的需要日期外數據，再改寫條件，不為省錢擅自改掉指標。

若單日的乾跑估算仍突然增加，把查詢複製成兩個條件相同、欄位不同的版本比較；另一組比較相同欄位、不同日期的版本。一次只改一件事，才分得出是欄寬、掃描天數，還是查詢了不該用的大表。若拿不到實際分區表，就維持未驗，不把本機秒數填進雲端驗收表。

記下乾跑採用的專案和表，方便別人重現比較。

## 常見錯誤

- 加 LIMIT 但估算沒降 → 只限制回傳列 → 先改分區與欄位範圍。
- 上下界兩端都包含 → 隔天也被納入 → 用 `>=` 和 `<`。
- 查詢返回一天便宣布只讀一天 → 邏輯結果不證明裁剪 → 在實際分區表乾跑驗證。
