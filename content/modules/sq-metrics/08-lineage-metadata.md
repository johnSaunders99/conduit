---
id: sq-metrics-08
module: sq-metrics
order: 8
title: 數據血緣與元數據
subtitle: 欄位一改哪些人會受影響
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-07
objectives:
- 從數據目錄查欄位型別及位置
- 沿欄位依賴列出改動影響的直接與間接輸出
tags:
- 數據血緣
- 元數據
- 影響分析
resources:
- title: OpenLineage：核心物件
  url: https://openlineage.io/docs/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Run、Job、Dataset 各代表什麼。
- title: OpenLineage：欄位級血緣
  url: https://openlineage.io/docs/spec/facets/dataset-facets/column_lineage_facet/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀輸出欄對應的輸入欄記錄。
concepts:
- id: sq-metrics-08-meta
  prompt: 欄位類型、擁有人與更新時間是數據還是元數據？
  answer: 它們描述數據而不是一筆業務事件，是元數據。
  mcq:
    options:
    - 描述數據的元數據
    - 每筆訂單的業務值
    - 下一個報表數值
    - SQL 計畫的實際耗時而已
    answer: 0
    explain: 元數據可用於尋找、解讀、管理數據；血緣是其中一類關聯。
- id: sq-metrics-08-lineage
  prompt: 要改 unit_price 欄位，如何知道哪個報表會受影響？
  answer: 從來源欄沿欄位級依賴往下游找，用到計算或篩選的欄都要列入，再核實實際消費端。
  mcq:
    options:
    - 只搜尋欄名相同者
    - 沿有向的欄位血緣往下游找
    - 只看原表數據類型
    - 只查是否建索引
    answer: 1
    explain: 改名或使用算式後欄名可能不同，光搜欄名會漏。
  interview:
    question: 要把成交價單位從元改成分，你如何做影響評估？
    answer: 我先列所有直接與間接消費這一欄的結果，確認哪些是計算、哪些是篩選；通知受影響的報表責任角色。在小範圍用已知金額核對兩版，再安排遷移和可回退切點。
    points:
    - 查直接與間接依賴
    - 別漏掉條件與聚合
    - 聯絡消費端並做前後對照
- id: sq-metrics-08-runtime
  prompt: 有設計好的依賴圖，能證明昨天的任務確實跑成功嗎？
  answer: 不能。也要看實際執行這一次的紀錄、輸入輸出版本和狀態。
  mcq:
    options:
    - 能，畫圖就代表任務完成
    - 只看數據表名稱即可
    - 不能，要查執行紀錄
    - 越多欄位越能證明成功
    answer: 2
    explain: 設計與實際運行是不同證據。
practice:
- id: sq-metrics-08-p1
  kind: sql
  category: [model, reconcile]
  title: 盤點成交金額的來源欄
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    用 information_schema.columns 盤點 main.order_items 的 order_id、qty、unit_price。輸出 column_name、data_type、ordinal_position，依 ordinal_position 升冪。
  solution: |
    SELECT column_name, data_type, ordinal_position FROM information_schema.columns
    WHERE table_schema = 'main' AND table_name = 'order_items'
      AND column_name IN ('order_id', 'qty', 'unit_price')
    ORDER BY ordinal_position;
  explain: |
    只查這張表、這個 schema，避免把別表同名欄混在一起。MySQL 要用自己的數據庫名稱篩 table_schema。
  hints:
  - 數據目錄是 information_schema.columns
  - 保留原欄位位置
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-08-meta
  tags:
  - 數據血緣
  - 元數據
  - 影響分析
- id: sq-metrics-08-p2
  kind: sql
  category: [model, reconcile]
  title: 追出改成交價會影響的報表欄
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    模擬四條由輸入到輸出的欄位血緣：order_items.unit_price→dwd.line_amount、order_items.qty→dwd.line_amount、dwd.line_amount→dws.gross_amount、dws.gross_amount→ads.avg_order_amount。從 order_items.unit_price 找所有直接及間接下游；依序輸出 column_id、hop（相距步數），依 hop、column_id 字串升冪。
  solution: |
    WITH RECURSIVE edges(src, dst) AS (
     VALUES ('order_items.unit_price','dwd.line_amount'),
            ('order_items.qty','dwd.line_amount'),
            ('dwd.line_amount','dws.gross_amount'),
            ('dws.gross_amount','ads.avg_order_amount')
    ), affected(column_id, hop) AS (
     SELECT dst, 1 FROM edges WHERE src = 'order_items.unit_price'
     UNION ALL
     SELECT e.dst, a.hop + 1 FROM affected a JOIN edges e ON e.src = a.column_id
    )
    SELECT column_id, hop FROM affected ORDER BY hop, column_id;
  explain: |
    順箭頭只走下游；qty 是同一產物的另一個上游，沒有被 unit_price 改動。此測例無環，真實追查需防循環，並處理多路徑抵達同欄。
  hints:
  - 第一跳找 src 是起始欄的列
  - 下次用上一跳的 dst 作起點
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-08-lineage
  - sq-metrics-08-runtime
  - sq-metrics-04-layers
  tags:
  - 數據血緣
  - 元數據
  - 影響分析
---

有人想把成交單價從元換成分。表裡只有一欄改動，報表卻可能從客單價到每日成交額都變成原來的 100 倍。今天先查它是什麼，再找誰用了它；最後能在部署前指出第一個受影響的報表欄。

## 描述數據，與記錄怎麼流

元數據（metadata，台灣也稱詮釋資料或中繼資料）描述數據：欄位型別、計量單位、誰維護、何時更新。數據血緣（data lineage，台灣也稱資料血緣）則記錄從輸入到產出的關係。表級血緣只說哪張表讀哪張；欄位級血緣（column-level lineage）指出哪些欄直接進入公式、或影響哪些列能參與計算。兩種粒度都重要，不能拿表有連接就斷言所有欄影響相同。

- 數據集（dataset）：一次讀寫的表或檔案。
- 任務（job）：可以重複執行的工作定義。
- 執行（run）：該工作在某一次的實際嘗試，需要記錄狀態、時間和使用的輸入版本。

## 盤點欄位，再走箭頭

在 SQL 練習場選 `shop`。用 `information_schema.columns` 查同一張表的型別與欄位位置。這能說明單價是整數，卻不能證明它是一元還是一分；業務單位要有約定，不能從欄名或型別猜。

```sql
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'main' AND table_name = 'order_items'
 AND column_name IN ('unit_price', 'qty')
ORDER BY ordinal_position;
```

下面不是跑時採集的結果，而是練習用的已知依賴：`unit_price → 行成交額 → 日成交額 → 客單價`。要查改動影響就沿箭頭往下；要查錯誤來源則反向找。前面[〈遞迴 CTE〉](#/lesson/sq-compose-08)的做法適合走多跳：先取第一跳，再把這一輪目的欄交給下一輪當起點。真實系統若有動態 SQL 或外部表計算，要向消費者確認圖上是否漏邊。交付時附上已證實和待確認的界線。

## 變更前先確認影響，變更後核對數字

拿一張已知兩行的訂單，用單價乘件數手算，保存改單位前的整筆金額。沿血緣通知日彙總和客單價的消費端，確認何時改公式、哪些讀者要保留舊版。單價改成分後，應用層若仍以元顯示，換算後這張訂單的金額應與原來一致。數據目錄可說明欄位已更新，只有逐項核對產物才能證明實際結果一致；報告若有影響範圍未知，也應留記錄而不是把未找到算作沒有。

也別把測得的輸出只存一張圖，留下對應欄及核對列，才能回查。

## 常見錯誤

- 只找同名欄 → 算式和別名早已換名 → 沿依賴查，而不是只查字串。
- 有血緣就以為這次報表跑成功 → 那可能是設計圖 → 看實際執行與輸入版本。
- 只列一跳 → 中間彙總後還有另一份報表 → 繼續走到消費端。

## 方言與面試

DuckDB 的數據集在 `main`；MySQL 的 `information_schema.columns` 裡 `TABLE_SCHEMA` 通常是數據庫名稱。Spark SQL 的目錄又取決於 catalog 和 schema，不能把 `main` 原樣搬過去。遞迴語句也需查各引擎支援及深度限制；在面試中先說要保留哪類依賴與哪次執行的證據。
