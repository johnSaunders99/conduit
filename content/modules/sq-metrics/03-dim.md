---
id: sq-metrics-03
module: sq-metrics
order: 3
title: DIM 與一致鍵
subtitle: 退款也能沿用商品分類
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-02
objectives:
- 用一致鍵把不同來源接到同一商品維度
- 保留未映射鍵，避免把訂單級退款當商品級退款
tags:
- 一致維度
- 鍵映射
- 業務鍵
resources:
- title: DataWorks：數倉分層
  url: https://help.aliyun.com/zh/dataworks/user-guide/data-warehouse-layering
  kind: doc
  lang: zh-Hans
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 DIM，確認描述屬性如何被共用。
- title: Spark SQL：NULL 語意
  url: https://spark.apache.org/docs/latest/sql-ref-null-semantics.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀外連接條件與補出的缺值。
concepts:
- id: sq-metrics-03-mapping
  prompt: 兩種來源代碼指同一商品時，該用哪個欄位跨來源比較？
  answer: 先按來源和代碼映射為一致商品鍵，再以那個鍵分析，不直接用原碼或商品名。
  mcq:
    options:
    - 照原碼大小排序
    - 依品名完全相同即視為同款
    - 去掉任何字母後一律合併
    - 來源與代碼映射到同一鍵
    answer: 3
    explain: 不同系統可能各自發碼，相同文字也未必同一個實體。
- id: sq-metrics-03-unmapped
  prompt: 用什麼方法保住找不到維度的合格來源列？
  answer: 來源為左表做左連接，以找不到映射的狀態另記，不丟掉原始鍵。
  mcq:
    options:
    - 左連接並標未知
    - 內連接丟棄
    - 一律補成第一件商品
    - 在 WHERE 排除維表 NULL
    answer: 0
    explain: 未映射需可追查，否則報表總量會悄悄變少。
  interview:
    question: 怎麼確保支付和退款報表用的是同一分類？
    answer: 我先查兩邊有沒有同粒度的商品鍵，再統一代碼映射和維度版本。若退款只有訂單鍵，不直接接所有品項；要先確認有退款明細或經業務同意的分攤規則。
    points:
    - 確認事實粒度
    - 共用鍵映射與維度版本
    - 找不到商品不亂分攤
- id: sq-metrics-03-unique
  prompt: 對照表同一來源碼有兩個商品映射，直接接會怎樣？
  answer: 一筆事實會配兩筆，造成金額或行數變多；先處理衝突。
  mcq:
    options:
    - 引擎任選一個
    - 一筆來源接成多筆
    - JOIN 可自動去重
    - 品名相同就不影響金額
    answer: 1
    explain: 映射關係要先驗對應鍵唯一，不能把結果膨脹交給聚合。
practice:
- id: sq-metrics-03-p1
  kind: sql
  category: [model, join]
  title: 核對商品鍵是否能帶回分類
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    模擬匯入鍵 101、107、999；前兩個存在，999 為測試壞鍵。保留 3 列，輸出 product_id、category（不存在則 NULL），依 product_id 升冪。
  solution: |
    WITH incoming(product_id) AS (VALUES (101), (107), (999))
    SELECT i.product_id, p.category
    FROM incoming i LEFT JOIN products p USING (product_id)
    ORDER BY i.product_id;
  explain: |
    左連接保證 999 仍在；兩個已知商品分類不同。用標價或品名接會把維度的描述當識別碼。
  hints:
  - 來源為左表
  - 不要刪空分類
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-03-unmapped
  - sq-db-01-orphan
  tags:
  - 一致維度
  - 鍵映射
  - 業務鍵
- id: sq-metrics-03-p2
  kind: sql
  category: [model, join]
  title: 統一通路商品代碼，也找缺映射
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    模擬來源 (shop, P101)、(returns, P101)、(returns, R1)、(returns, R7)、(shop, X)。映射為 shop/P101→101、returns/P101→102、returns/R1→101、returns/R7→107。接到 products 帶回 category，不認識的原碼保留，product_id 與 category 為 NULL。輸出 source_name、source_sku、product_id、category，依 source_name、source_sku 字串升冪。
  solution: |
    WITH incoming(source_name, source_sku) AS (
     VALUES ('shop','P101'), ('returns','P101'), ('returns','R1'), ('returns','R7'), ('shop','X')
    ), key_map(source_name, source_sku, product_id) AS (
     VALUES ('shop','P101',101), ('returns','P101',102), ('returns','R1',101), ('returns','R7',107)
    )
    SELECT i.source_name, i.source_sku, p.product_id, p.category
    FROM incoming i LEFT JOIN key_map m USING (source_name, source_sku)
    LEFT JOIN products p ON m.product_id = p.product_id
    ORDER BY i.source_name, i.source_sku;
  explain: |
    P101 在不同通路是不同商品；returns/R1 和 shop/P101 則應對到同一商品。模擬退貨明細有商品代碼，但真實共用數據的 refunds 只有訂單號。
  hints:
  - 映射用來源加原碼
  - 兩次都保留左側列
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-03-mapping
  - sq-metrics-03-unique
  - sq-metrics-03-unmapped
  tags:
  - 一致維度
  - 鍵映射
  - 業務鍵
---

銷售使用 P101，退貨也寫 P101，卻未必是同一款茶。報表要共用商品分類時，先把兩套代碼翻成可信的商品鍵，然後才從同一份維度取屬性。今天留下一份對照清單，讓缺映射的原碼仍找得到。

## 從來源鍵到一致鍵

維度表（dimension table，DIM；台灣也稱維度資料表）存「受分析對象是什麼」，例如商品分類；交易明細存「發生了什麼」。一致維度（conformed dimension）不只是各報表都有欄位叫分類，而是分類及其商品鍵在各用途上同義。參考[〈一致維度與匯流排矩陣〉](#/lesson/sq-model-06)的觀點，把可以共用的描述集中管理。

1. 明定來源鍵：通路不同時，用「來源＋來源商品碼」記身分，以免撞碼。
2. 維護映射（key mapping）：同一來源組合對應一個商品鍵。若一個來源碼被映射成兩款，先列衝突。
3. 用一致鍵帶回品類。未映射應報未知並保存原碼；要分析歷史分類，就明確用當時版本，而非直接接今天的分類。

## 先保住來源，再帶描述

在 SQL 練習場選 `shop`，用小清單模擬進料。不存在的 999 不會因為無法帶回分類就消失。業務層可設獨立的「未知商品」維度成員處理交付，但稽核仍需保留原鍵。

```sql
WITH incoming(product_id) AS (VALUES (101), (999))
SELECT i.product_id, p.category
FROM incoming i LEFT JOIN products p ON p.product_id = i.product_id
ORDER BY i.product_id;
```

退貨來源若確實提供品項級商品碼，就能和銷售共用維度。這份 `shop` 的 `refunds` 只有訂單號，不能把一筆退款全額配給訂單的每個品項。要按商品看退款，先拿有商品鍵的退貨明細，或和業務定義分攤規則。歷史版本的接法見[〈SCD 一型與二型〉](#/lesson/sq-model-08)。

## 一次看三個對照例

先挑一個兩邊代碼不同、業務確認是同一商品的例子，看兩列是否接到同分類。再挑代碼相同卻分屬不同系統的例子，確定不會相撞。最後挑一個查無映射的值，確定它仍出現在結果裡並保留來源。映射表經常會更版；留好映射版本與生效時間，可以回答舊報表究竟為何歸到當時的類別。若今天只有當前版本，不要將它描述成可回溯所有歷史；先交付已知範圍的分類清單，再補缺的規則。

若映射遲到，保存原碼就能找到待回補的列；若原碼被預先替換成空白，你可能再也分不清是哪個系統缺對照。

## 常見錯誤

- 分類看起來合理，商品卻對錯 → 只比代碼，忽略哪個系統發碼 → 用來源和代碼並列核對。
- 入庫前後少了金額 → 內連接丟掉無對應者 → 改左連接，另出缺映射清單。
- 接完金額增加 → 一個來源鍵匹配多行 → 先查映射唯一性，不用 DISTINCT 掩蓋。

## 方言與面試

DuckDB 的 `WITH 名稱(欄位) AS (VALUES …)` 能建小型測試對照，Spark SQL 常用 `FROM VALUES … AS t(欄位)`，MySQL 要注意 `VALUES ROW(…)` 的語法，也可用多段 `SELECT … UNION ALL` 組測例。方言改得再漂亮，都不能拿相同的欄名取代一致的業務含義。
