---
id: sq-window-07
module: sq-window
order: 7
title: ROWS 與 RANGE
subtitle: 同價兩筆會不會一起算
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-06
objectives:
- 用 ROWS 控制實際列數
- 用 RANGE 讓同值列一起進框
- 按價格差而非項目數設置範圍
tags:
- rows
- range
- 窗口框
- 同值列
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Framing，對照 ROWS 與 RANGE 範例。
- title: Spark SQL：窗口函式
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-window.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Spark 窗口框與排序的語法。
- title: MySQL：窗口框
  url: https://dev.mysql.com/doc/refman/8.4/en/window-functions-frames.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的 RANGE 值域與預設框。
concepts:
- id: sq-window-07-rows
  prompt: ROWS BETWEEN 1 PRECEDING AND CURRENT ROW 用什麼決定邊界？
  answer: 按已排好的列位置。本組有上一列時放入它和自己；不是按值差 1。
  mcq:
    options:
    - 排序值相差 1
    - 同值的所有列
    - 整個分區
    - 已排序的列位置
    answer: 3
    explain: ROWS 數的是列；排序鍵相等若沒第二鍵，哪一筆在前不確定。
- id: sq-window-07-peers
  prompt: 以 price 排序，RANGE 到 CURRENT ROW 時，另一件同價商品會算入嗎？
  answer: 會；在這種 RANGE 框，同價的列屬於同一組平手列，包含於目前值的邊界。
  mcq:
    options:
    - 會，同價列也在目前值邊界
    - 不會，只算物理目前列
    - 不會，除非加商品號打破平手
    - 會，但只在外層沒排序時
    answer: 0
    explain: RANGE 用排序值定邊界；若用 ROWS，CURRENT ROW 才只指這一列。
  interview:
    question: 同價商品的累計一起跳，怎麼判斷是不是錯？
    points:
    - 先問逐列還是價位累計
    - 比對 RANGE 的同值列
    - 改用顯式 ROWS 與平手鍵時對照
    answer: 若要每個價位封帳，兩件同價一起跳是對的；要逐件累計我才用 ROWS 加唯一商品鍵，拿同價兩件對照位置。
- id: sq-window-07-range
  prompt: 價格升序下 RANGE BETWEEN 10 PRECEDING AND CURRENT ROW 會挑什麼？
  answer: 挑排序值在目前價格減 10 到目前價格（含邊界）的所有列。
  mcq:
    options:
    - 同價只取其中一件
    - 目前價減 10 到目前價的所有列
    - 前 10 件商品加目前商品
    - 前 10 個不同價位
    answer: 1
    explain: RANGE 以排序值的差距取列，不保證固定筆數。
practice:
- kind: sql
  category: [window]
  title: 同價時的逐件與逐價位累計
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    輸出所有商品的逐件累計個數 `items_so_far`（價低先、同價小商品號先）與截至目前價位的商品個數 `price_band_count`（包含所有同價商品）。

    只輸出以下欄位，欄序固定：`product_id`、`price`、`items_so_far`、`price_band_count`。

    排序：`price` 升序，同價按 `product_id` 升序。
  solution: |
    SELECT product_id, price,
           COUNT(*) OVER (ORDER BY price, product_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS items_so_far,
           COUNT(*) OVER (ORDER BY price
             RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS price_band_count
    FROM products ORDER BY price, product_id;
  explain: |
    45 元兩件，逐件是 1、2；逐價位都是 2。若把商品號也放到逐價位的窗口排序，同價就不再是平手。
  hints:
  - 分開寫兩個窗口。
  - ROWS 窗口要有固定的同價先後。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-07-rows
  - sq-window-07-peers
  - sq-window-02-tie
  tags:
  - rows
  - range
  - 同價
  id: sq-window-07-p1
- kind: sql
  category: [window]
  title: 統計每件商品前十元價差內的件數
  minutes: 8
  level: 2
  dataset: shop
  prompt: |
    每件商品輸出 同價或較便宜最多 10 元的商品數 `nearby_count`，價格在目前價減 10 到目前價（兩端都含）；包含自身及所有同價商品。

    只輸出以下欄位，欄序固定：`product_id`、`price`、`nearby_count`。

    排序：`price` 升序，同價按 `product_id` 升序。
  solution: |
    SELECT product_id, price,
           COUNT(*) OVER (ORDER BY price
             RANGE BETWEEN 10 PRECEDING AND CURRENT ROW) AS nearby_count
    FROM products ORDER BY price, product_id;
  explain: |
    60 元的兩件商品各計 3 件：50、60、60；45 元不在前十元內。用 10 PRECEDING 的 ROWS 會數成前面好幾件商品，不是價差。
  hints:
  - RANGE 的 10 是價格單位。
  - 值距離的窗口只按 price 排。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-07-range
  - sq-window-07-peers
  - sq-window-06-running
  tags:
  - range
  - 價差
  id: sq-window-07-p2
---

價目表要在每項商品旁寫「到這個價位有幾件」。若 45 元有兩件，你想在兩列都顯示 2，還是隨著逐件掃描分別顯示 1 和 2？同一個 `COUNT` 能得到兩種答案，差別在窗口框按「已排好的列位置」還是「排序值」定界。

## 先看邊界單位

- `ROWS BETWEEN 1 PRECEDING AND CURRENT ROW`：往前一個列位置，加上目前列；組首不足就只算目前列。要逐列固定結果，排序應能分清所有平手。
- `RANGE BETWEEN 10 PRECEDING AND CURRENT ROW`：在數值升序下，取排序值介於目前值減 10 與目前值之間的所有列，包含兩個端點。
- `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`：從組首到目前排序值，包含與目前列同值的同值列（peers）。在 DuckDB 裡，帶窗口排序的聚合若沒寫框，預設就會用這種截至目前值的行為；本課直接寫出來。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT product_id, price,
       COUNT(*) OVER (ORDER BY price, product_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS items_so_far,
       COUNT(*) OVER (ORDER BY price
         RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS price_band_count
FROM products ORDER BY price, product_id;
```

45 元的 103、107 分別拿到逐件 1、2，但價位累計兩者都是 2。再看 60 元：換成僅前 10 元的值域時，計入 50、60、60，不計 45。由此可看出 `RANGE` 不是固定取幾件：價位密集時更多列被算入，稀疏時可能只有自己。想驗兩種行為，不要挑所有價格都不同的例子；平手與含邊界是測試重點。

DuckDB 在有數值位移的 `RANGE` 框要求單一可相減的排序運算式；MySQL 和 Spark SQL 使用有偏移量的值域時，也要留意排序鍵及偏移量類型限制。把唯一商品號留在外層顯示排序，不要同時加到有偏移的價位窗口。下一堂[〈移動平均〉](#/lesson/sq-window-08)把「目前價差」換成「過去幾天」。

## 把同值列和邊界都畫一下

把按價格排的開頭寫成 45、45、50、60、60。第二件 45 元的商品若使用「往前一列」的框，可看到兩件同價商品；第一件卻只有自己。若改成價位截至目前的框，第一件 45 元就能看到整個價位，因此兩列計數一致。這個手算例子也解釋了為什麼沒有唯一鍵時，逐列框不能保證哪一件商品先拿到第一個位置。

擴到 60 元的前十元時，左邊界正是 50；測試時要確認 50 算入、45 不算入。有些人直覺會把窗口讀成「嚴格小於十元的價差」，一旦把邊界算錯，成品會無聲少一件。對數據使用方說「含上下界」很重要，尤其是把 SQL 改成其他引擎之後。

列數框與值域框在邊界的行為也不同：往前的固定列數在組首自動縮短，而價值範圍會根據每個目前值圈出不同筆數。不管哪一類，都不會替你補不存在的列；支援固定長度的時間分析前，先決定缺測和零值要不要在輸入上各佔一日。

交付時，可用兩欄同列對照，而不是分兩張圖。逐件欄每次只增一，逐價位欄則按同值組大小跳，讀者立刻看得出方法不同。

## 常見錯誤

- 同價兩筆一起跳，卻想逐筆加 → 用 ROWS 並指定平手先後。
- 只想按價位，卻為兩件同價算出不同累計 → 不要在窗口排序用唯一鍵打破價位平手。
- 把 10 PRECEDING 當成前十列又套 RANGE → 先看排序值的單位；要前十列用 ROWS。
