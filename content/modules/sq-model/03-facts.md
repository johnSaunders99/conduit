---
id: sq-model-03
module: sq-model
order: 3
title: 事實表與度量
subtitle: 庫存餘額不能跨天直接相加
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-02
objectives:
- 依商品、營業日辨認可加總與不可加總的度量
- 從付費明細算出總金額與加權平均單價
- 寫出庫存餘額的跨日選值規則
tags:
- 事實表
- 可加總性
- 加權平均
resources:
- title: Kimball Group：度量的可加總性
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/additive-semi-additive-non-additive-fact/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀三種可加總性，特別看餘額與比率。
concepts:
- id: sq-model-03-fact
  prompt: 事實表的一個度量應在哪個層次填入？
  answer: 在表宣告的粒度上，例如明細列記錄該品項的件數與金額，不把整單總額重複貼上去。
  mcq:
    options:
    - 與該列粒度一致
    - 一律使用最上層日合計
    - 一律使用目前商品價格
    - 一律存整單總額
    answer: 0
    explain: 「方便讀」不能取代粒度；整單總額附在每列會被重複加總。
- id: sq-model-03-semi-additive
  prompt: 每日店舖庫存在同一時點與跨日加總有何差異？
  answer: 相同品項、單位及同一時點可跨不重疊店舖相加；跨日是把同一存量重複計入。
  mcq:
    options:
    - 只要都有日期就能跨日相加
    - 只有不同店的餘額不可以加
    - 庫存餘額全部不能聚合
    - 同時點可跨店加，跨日不能當期末量加
    answer: 3
    explain: 加總的合法性取決於維度。不同日期的餘額不是每天新增的件數。
  interview:
    question: 店長想讓同一張報表顯示週銷量與週末庫存，你會怎麼設計？
    answer: 銷量我會加整週明細；庫存我會用週末指定時點的快照，再確認各店的時點與品項單位相同。如果缺一天，不會當真的是零；我要先對齊缺失與補齊規則。
    points:
    - 辨別流量和存量
    - 說明時點一致性
    - 不把缺失視為零
- id: sq-model-03-weighted
  prompt: 每件單價應如何由 3 件 45 元與 1 件 90 元計算？
  answer: 金額 225 元除以件數 4，得 56.25 元；不是先平均 45 與 90。
  mcq:
    options:
    - 45 元
    - 67.5 元
    - 56.25 元
    - 225 元
    answer: 2
    explain: 加權後每件份量相同；直接平均兩個品項單價會讓每列權重相同。
- id: sq-model-03-zero
  prompt: 平均單價遇到售出件數為 0 時應怎麼處理？
  answer: 公式沒有有效分母；用 NULLIF 讓結果為 NULL，並在報表明示沒有可計價的件數。
practice:
- id: sq-model-03-p1
  kind: sql
  category: [model, aggregate]
  title: 算出付費明細的商品件數
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    只算 `paid` 訂單，按 `product_id` 加總成交件數。依序輸出 `product_id`、`sold_qty`，按 `product_id` 升序，只輸出有付費明細的商品。
  solution: |
    SELECT i.product_id, SUM(i.qty) AS sold_qty
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.status = 'paid' GROUP BY i.product_id ORDER BY i.product_id;
  explain: |
    件數是明細列上的度量，`COUNT(*)` 只數明細列，一列多件時會少算。
  hints:
  - 先以訂單表的狀態過濾
  - 再用 SUM(qty)
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-03-fact
  - sq-model-02-grain
  tags:
  - 事實表
  - 可加總性
- id: sq-model-03-p2
  kind: sql
  category: [model, aggregate]
  title: 每日成交每件平均單價
  minutes: 7
  level: 3
  dataset: shop
  prompt: |
    以已付款訂單的營業日分組。依序輸出 `order_date`、成交總額 `gross_amount`、成交件數 `sold_qty`、每件平均價 `avg_unit_price`。平均價不先取整，分母為 0 時給 NULL；日期升序，不補空日。
  solution: |
    SELECT o.order_date, SUM(i.qty * i.unit_price) AS gross_amount,
           SUM(i.qty) AS sold_qty,
           SUM(i.qty * i.unit_price) / NULLIF(SUM(i.qty), 0) AS avg_unit_price
    FROM orders o JOIN order_items i ON o.order_id = i.order_id
    WHERE o.status = 'paid' GROUP BY o.order_date ORDER BY o.order_date;
  explain: |
    先聚合金額及件數，再相除。`AVG(unit_price)` 是明細列均價，不是每件均價。DuckDB 的 `/` 能保留小數，`//` 會做整數除法；MySQL、Spark SQL 和 Hive SQL 的 `DIV` 不是本題所需。
  hints:
  - 用 SUM(qty * unit_price) 當分子
  - NULLIF 對付分母為零
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-03-weighted
  - sq-model-03-zero
  - sq-model-01-scope
  tags:
  - 事實表
  - 可加總性
---

## 先分清楚是流量還是存量

數倉裡，事實表（fact table）保存某種業務過程的觀測。它通常會有供連接的鍵，以及度量（measure），即可以計算的量。例如茶舖的付費明細可記成交件數、成交時單價以及行金額。訂單的營業日可從表頭取得，但整單金額不應貼到每個明細重複保存為可加總欄位。

店長要把「賣出的件數」「期末庫存」「每件成交均價」填進週報。它們都能用數字表達，卻不能都寫成 `SUM(value)`：

- **可加總（additive）**：同一業務定義下，金額可把不重疊明細按品項、店舖與日期相加。跨幣別要先統一計價；跨不同計量單位也要確認合計有意義。
- **半可加總（semi-additive）**：同一時點、同一品項的庫存可以跨不重疊店舖相加；週一有 8 件、週二有 6 件，期末是 6 件，不是 14 件。要算平均每日庫存還需要先決定空日及缺失如何處理。
- **不可加總（non-additive）**：比率、均價不能直接相加。優先保存可加的分子與分母，讓使用者在選定範圍內先加分子、再加分母，最後才相除。

## 驗算一組加權平均

在 SQL 練習場選 `shop`。1001 號單買了 3 個 45 元的小杯與 1 個 90 元的濾網。先加出 225 元與 4 件，再除得 56.25 元。比較兩種平均：

```sql
SELECT SUM(qty * unit_price) AS gross_amount,
       SUM(qty) AS sold_qty,
       SUM(qty * unit_price) / NULLIF(SUM(qty), 0) AS avg_unit_price,
       AVG(unit_price) AS avg_line_price
FROM order_items WHERE order_id = 1001;
```

結果最後兩欄不同，因為 `AVG(unit_price)` 把兩列各當一票，不管每列有幾件。日報若要再彙成月報，應沿用金額和件數，不平均已取整的每日均價。`NULLIF(SUM(qty), 0)` 在分母為零時給缺值；缺值和「均價恰為零」要在報表區分。

相同道理，`products.stock` 只是一個目前數值，不是日期完整的庫存記錄。不能從這張表推算昨天剩多少；[〈快照事實表〉](#/lesson/sq-model-07)會細講如何把每天某個時點保存成可比較的觀測。先想好表要支援的是「期末」「每日平均」或「變動量」，它們不是同一個問題。

設計小抄時，不只寫這三個名稱，而要每個度量標上「哪些軸可以加」。例如以元為同一單位的成交額可跨分類、日期加；庫存件數若混了杯與禮盒，未必是營運要看的同一量；均價則要保存分子與分母。也有不帶數值的事實表（factless fact table），例如每次出席一列，量度可由列數得出。重點依然是確定每一列代表哪一次觀測。

## 方言與常見錯誤

DuckDB 的 `//` 和 Hive SQL、Spark SQL、MySQL 的 `DIV` 都不適合作每件均價的除法。移植指標時要看除法結果類型和小數精度；若是需以固定幣別小數交付的數字，另外訂清楚最後在哪一層取位，而非在每列先四捨五入。

- 週末庫存過高 → 把每天餘額相加 → 選明確的週末時點並核對完整性。
- 平均單價偏離手算 → 用一列一票的均價 → 用總金額除總件數。
- 歷史金額跟著新品標價變 → 回算用了現價 → 使用成交明細的單價。
