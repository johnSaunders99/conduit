---
id: bd-quality-01
module: bd-quality
order: 1
title: 唯一性與非空檢查
subtitle: 同一訂單出現兩次
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 為訂單與訂單明細各定義一個唯一鍵
- 用 IS NULL 和 HAVING 找出不同失敗
- 設計能把重複與缺鍵分別抓到的反例
tags:
- 唯一鍵
- 非空
- COUNT
- 數據粒度
resources:
- title: dbt：數據測試
  url: https://docs.getdbt.com/docs/build/data-tests
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 unique、not_null 與失敗查詢的關係。
- title: DuckDB：聚合函式
  url: https://duckdb.org/docs/lts/sql/functions/aggregates
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查 COUNT(*) 和 COUNT(欄位) 的差異。
concepts:
- prompt: 為什麼不能拿 order_id 當訂單明細的唯一鍵？
  answer: 一張訂單有好幾個品項；每列是一個單內行號，鍵要由 order_id 與 line_no 組成。
  mcq:
    question: 訂單 1001 有行號 1 和 2，應如何判定？
    answer: 1
    options:
    - 編號相同就全是重複
    - 兩列均合法，按訂單與行號判定
    - 按金額相同判重
    - 只保留較早行號
    explain: 各列有不同的複合鍵。只查 order_id 會誤將正常多列當重複。
  id: bd-quality-01-grain
- prompt: 唯一和非空能否只做其中一項？
  answer: 不能；重複是相同鍵出現多次，非空要求每列都有鍵。只有 1 筆 NULL 時未必會被重複檢查抓到。
  mcq:
    question: 要列出沒有訂單鍵的記錄，哪個條件正確？
    answer: 2
    options:
    - order_id = NULL
    - HAVING COUNT(order_id) > 1
    - order_id IS NULL
    - ORDER BY order_id
    explain: NULL 表示缺值；等號結果不是 TRUE。COUNT(order_id) 反而跳過 NULL。
  id: bd-quality-01-null
- prompt: 為何檢查結果宜保留壞鍵，而不是只有通過或失敗？
  answer: 壞鍵讓人可回到來源查重送、鍵丟失或錯 join，並驗證修復針對這些列。
  interview:
    question: 訂單明細重複，能不能先上 DISTINCT 把報表變正確？
    answer: 我會先定義明細鍵，列出重複鍵的原列和來源版本，確認是同批重送、兩條業務明細還是 join 放大。不能用全欄 DISTINCT 掩蓋問題；先擋發布，再修製造重複的那一段並補回歸測試。
    points:
    - 先定義粒度及業務鍵
    - 區分重送與粒度錯誤
    - 保留反例再修根因
  id: bd-quality-01-action
practice:
- kind: sql
  category: [reconcile, distinct]
  title: 抓住同鍵重送
  minutes: 5
  dataset: shop
  prompt: 從 `order_items` 選 `order_id = 1001` 的全部列作一份輸入，再用 `UNION ALL` 加入同單 `line_no = 1` 的原列一次。只輸出重複鍵，欄序 `order_id`、`line_no`、`copies`，按鍵兩欄遞增。
  solution: |-
    WITH incoming AS (
      SELECT order_id, line_no FROM order_items WHERE order_id = 1001
      UNION ALL
      SELECT order_id, line_no FROM order_items WHERE order_id = 1001 AND line_no = 1
    )
    SELECT order_id, line_no, COUNT(*) AS copies
    FROM incoming
    GROUP BY order_id, line_no
    HAVING COUNT(*) > 1
    ORDER BY order_id, line_no;
  explain: 只回傳 1001 的行號 1，共 2 份。若用 `UNION` 會把故意加入的重送消掉，測試失去效力。
  hints:
  - 先造一份保留重複列的輸入
  concepts:
  - bd-quality-01-grain
  - bd-quality-01-action
  - sq-group-07-grain
  tags:
  - 唯一性
  - 複合鍵
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-01-p1
- kind: sql
  category: [reconcile, missing-values]
  title: 找出空鍵但不誤標空城市
  minutes: 5
  dataset: shop
  prompt: 從 `users` 取 user_id 為 4、6、12 的 3 列，再加 `(NULL, '港灣')` 這筆 `user_id, city`。僅輸出鍵為 NULL 的列，欄序 `user_id`、`city`；不要求排序。
  solution: |-
    WITH incoming AS (
      SELECT user_id, city FROM users WHERE user_id IN (4, 6, 12)
      UNION ALL SELECT NULL, '港灣'
    )
    SELECT user_id, city FROM incoming WHERE user_id IS NULL;
  explain: 只抓人為加入的空鍵，不把城市未填視為同一故障。用 `= NULL` 不會傳回所需列。
  hints:
  - 問清楚是什麼欄位不可空
  concepts:
  - bd-quality-01-null
  - bd-quality-01-action
  - sq-group-01-nulls
  tags:
  - 非空
  - 缺值
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-01-p2
---

## 定義一列是什麼，才知道有沒有重

明細表想保留「每張單上的每一行」。同一張訂單出現 2 列本來正常；同一張單的**同一行號**出現 2 次，才有重送或加工重複的嫌疑。數據粒度（grain，台灣也稱資料粒度）說的是一列代表什麼；**唯一性（uniqueness）**則要求一個業務鍵只能出現一次。訂單表用 `order_id`，明細表用 `(order_id, line_no)`。若表其實保留歷次修訂，鍵還需要版本，或先選目前有效版才用同一檢查。

**非空（not null）**是另一條規則：辨認身份的每個欄位都要有值。城市可以未知，但訂單鍵缺失時不能把這列歸給任何訂單。`COUNT(*)` 數輸入列，`COUNT(key)` 跳過 NULL，兩者之差可做缺鍵計數；要讓人修得動，仍應能返回具體的失敗樣本。字串的空字串或只有空白也不符合某些業務規定，但不等同 NULL，須另訂條件。

## 完整的判斷順序

- **缺鍵查詢：**`WHERE order_id IS NULL OR line_no IS NULL`，先把無法識別的列挑出。
- **重複查詢：**對存在的鍵做 `GROUP BY`，再用 `HAVING COUNT(*) > 1` 篩出有多列的群組。`WHERE` 在分組前，`HAVING` 在分組後。
- **檢查契約：**對確定要唯一、不可空的鍵，查不到違規列才通過。練習刻意加入反例，確定查詢真的能抓到壞列。dbt 也使用「查詢返回失敗記錄」這個思路；之後在[〈測試與文件〉](#/lesson/cl-dbt-06)會把檢查接進較完整的建模流程。

## 先看正常的兩列

SQL 練習場選 `shop`，預留 1 GB，不開容器。訂單 1001 有行號 1、2；在同一張單內兩個鍵都各一列。

```sql
SELECT order_id, line_no, COUNT(*) AS copies
FROM order_items
WHERE order_id = 1001
GROUP BY order_id, line_no
ORDER BY order_id, line_no;
```

再用題目中的 `UNION ALL` 注入一條重送，不改共享表。做正式檢查時，報告要區分「有幾個重複鍵」「涉及幾筆原列」「多了幾筆」；若一個鍵有 3 列，三項分別是 1、3、2。三個數字各自回答不同問題，別用同一欄名模糊它們。

## 檢查不是看到壞列才開始

先用原始的 1001 的兩筆明細做正向測試，證明合法的一單多筆明細會通過；再用同一列模擬重送和一列空鍵，證明兩個規則各自能抓到問題。如果兩個驗收都只測「正確表通過」，即使查詢一直回空也會看起來無誤。發現重複時把涉及的兩筆標上來源批次和版本，不忙著刪其中一筆；可能一筆是舊版、一筆是新版，應由產品規則挑選目前有效者，而不是靠任意排序。

練習只需固定輸入。上線時若每日分區本身唯一、但跨日有重送，僅看單一日可能查不到；先問唯一性規則屬於全部歷史、每個營業日，還是每個已發布版本。不要用同一規則檢查兩種不同涵義的表。

## 常見錯誤

- **正確的一單多筆明細被攔 →** 用了訂單粒度的鍵檢查明細；把單內行號納入。
- **有缺鍵卻驗證通過 →** 只查重複或寫 `= NULL`；另用 `IS NULL`。
- **測試怎樣都找不到重送 →** 用 `UNION` 或先做 `DISTINCT`；保留原樣檢查。

**重點回顧：**先定粒度，再分別問誰沒有鍵、哪個鍵出現太多次。
