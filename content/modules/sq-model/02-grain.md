---
id: sq-model-02
module: sq-model
order: 2
title: 業務過程與粒度
subtitle: 一筆商品與一張訂單分開
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-01
objectives:
- 用一句話宣告訂單與訂單明細的粒度
- 以可唯一定位一列的欄位檢查明細粒度
- 寫出不受退款筆數膨脹影響的訂單金額查詢
tags:
- 粒度
- 複合鍵
- 多對多膨脹
resources:
- title: Kimball Group：Grain
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/grain/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀粒度宣告與業務描述，區別粒度與鍵。
concepts:
- id: sq-model-02-grain
  prompt: 先決定粒度是在決定什麼？
  answer: 以業務語言定義一列是哪一次觀測，再挑能識別它的鍵與符合該層次的欄位。
  mcq:
    options:
    - 決定查詢排序
    - 決定一列代表什麼
    - 決定表名稱
    - 決定是否保留所有欄位
    answer: 1
    explain: 鍵是實作檢查；「一天」「一次明細」才說清列的意義。
- id: sq-model-02-line-key
  prompt: 茶舖的明細為什麼要用 order_id 與 line_no 一起辨認？
  answer: 行號只在同一張單內唯一；訂單鍵單獨也會重複。
  mcq:
    options:
    - order_id
    - line_no
    - order_id 與 line_no
    - product_id 與 unit_price
    answer: 2
    explain: 商品即使同價、同款也不是行識別。訂單鍵加行號按來源規則唯一。
- id: sq-model-02-preaggregate
  prompt: 訂單有 3 筆明細、2 次退款，三表直接按訂單鍵連會有幾列？
  answer: 6 列。同一張單的兩組子列彼此配對；若要一單一列，應先各自彙總。
  mcq:
    options:
    - 6 列
    - 5 列
    - 3 列
    - 2 列
    answer: 0
    explain: 3 × 2 產生 6 列；相加是兩組列的總數，不是連接後筆數。
  interview:
    question: 營運加了退款欄後總銷售額翻倍，你怎麼找錯？
    answer: 我會先查一張有多品項、也有多次退款的單，比對連接前後的列數。交付要一單一列，就先讓兩端各自按訂單彙總，沒有退款的用 LEFT JOIN 保留。退款只有到單，沒有規則時不攤到品項。
    points:
    - 用小樣本還原乘法膨脹
    - 先彙到共同粒度
    - 不自行分攤未知歸屬
- id: sq-model-02-atomic
  prompt: 可以從每日付款彙總找出 1001 單的商品嗎？
  answer: 不能；彙總丟掉了訂單與品項層次，應回明細。
practice:
- id: sq-model-02-p1
  kind: sql
  category: [model, select]
  title: 列出訂單與單內行號
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    取 `order_items` 中 1001–1003 號單（含兩端）的所有明細。依序輸出 `order_id`、`line_no`、`product_id`，按 `order_id`、`line_no` 依序升序。不要按商品或訂單去重。
  solution: |
    SELECT order_id, line_no, product_id FROM order_items
    WHERE order_id BETWEEN 1001 AND 1003 ORDER BY order_id, line_no;
  explain: |
    一列對應一個單內行號，不是每單第一項；只輸出訂單鍵無法辨認同單內不同列。
  hints:
  - 以 BETWEEN 取含端點範圍
  - 同一訂單內用 line_no 排序
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-02-grain
  - sq-model-02-line-key
  tags:
  - 粒度
  - 複合鍵
- id: sq-model-02-p2
  kind: sql
  category: [model, join]
  title: 先彙總再連兩種明細
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    取 1001–1022 號的已付款訂單（含兩端）。依序輸出 `order_id`、明細金額合計 `gross_amount`、退款合計 `refund_amount`，沒有退款顯示 0，依 `order_id` 升序。同一訂單只出現一次。
  solution: |
    WITH items AS (
      SELECT order_id, SUM(qty * unit_price) AS gross_amount
      FROM order_items GROUP BY order_id
    ), returned AS (
      SELECT order_id, SUM(amount) AS refund_amount FROM refunds GROUP BY order_id
    )
    SELECT o.order_id, i.gross_amount, COALESCE(r.refund_amount, 0) AS refund_amount
    FROM orders o JOIN items i ON i.order_id = o.order_id
    LEFT JOIN returned r ON r.order_id = o.order_id
    WHERE o.status = 'paid' AND o.order_id BETWEEN 1001 AND 1022
    ORDER BY o.order_id;
  explain: |
    兩個子查詢各縮成一單一列，然後才與訂單連接。`SUM(DISTINCT amount)` 會把金額恰好相同的兩次退款混成一次，不是修正粒度的方法。
  hints:
  - 各用一個 GROUP BY order_id
  - 退款用 LEFT JOIN 保留沒退款的單
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-02-grain
  - sq-model-02-preaggregate
  - sq-model-01-scope
  tags:
  - 粒度
  - 複合鍵
---

## 先說「一列是什麼」

茶舖想回答兩件事：「每天接幾單？」與「每款茶賣幾件？」第一個關心一次下單，第二個關心一次訂單品項。收單、出貨、退款都是業務過程（business process），也就是某一類可觀測的業務活動。每次只選定一個過程問清楚，不先把數據塞進同一張寬表。

粒度（grain）是一句關於列的承諾。`orders` 一列是一張單，`order_items` 一列是一張單內的一個行號。`order_id` 可辨認前者；後者用訂單鍵和行號組成複合鍵（composite key）。粒度不是欄位清單：換一個技術鍵也不會讓同一列突然變成一天。先寫「每單每行號一列」，再找能據此驗證唯一性的欄位。最細可用粒度讓你重組出更多問題；如果只保留日合計，就不能回頭找出單內商品。

## 看到連接後多出來的列

在 SQL 練習場選 `shop`，從 1001 號單開始。這張單的 225 元屬於整單，底下其實有兩個品項：

```sql
SELECT o.order_id, i.line_no, i.qty * i.unit_price AS line_amount
FROM orders o JOIN order_items i ON o.order_id = i.order_id
WHERE o.order_id = 1001
ORDER BY i.line_no;
```

結果是行號 1 的 135 元和行號 2 的 90 元。現在按列數說「今天有兩單」就錯了，因為連接後結果的粒度已成明細列。若要保留品項查詢，訂單數要按鍵去重；若要讓結果本身一單一列，就先將明細依訂單聚合。

接著加退款。假設一單有 3 筆明細、2 次退款，按單直接連接得到 6 列；明細各出現兩次、退款各出現三次。這是多對多膨脹（fan-out）。修正時讓兩端先按 `order_id` 分組。練習使用公用表運算式（common table expression，CTE）：`WITH 名稱 AS (子查詢)` 像給中間結果取名，外層用 `FROM 名稱` 就能讀它；也可改用放在 `FROM` 裡的子查詢。[〈CTE 命名步驟〉](#/lesson/sq-compose-04)可用來複習命名方式。

動手前先寫預期形狀：「每張已付款單一列、退款缺席填零」。做完在結果找到 1021：它有兩次退款，共 15 元，仍只出現一列。零代表確實沒有退款紀錄；若退款數據尚未載入，那是狀態未知，不應用零掩蓋。

另做一個不靠金額的驗收：把明細依訂單鍵與行號分組，找列數大於 1 的組。正常數據不回任何違規組。只檢查整張表總列數不夠，因為同一批有一筆重複、一筆缺失時，總數仍可能相同。連接後也可再用同一組鍵檢查，確認預期一對一的補充資訊並未改寫觀測粒度。

這一步也是載入後的最低限度對帳。

## 方言與常見錯誤

本課用分組子查詢讓各引擎都看得懂。若想用多欄去重計數，DuckDB 的 `COUNT(DISTINCT (order_id, line_no))` 把兩欄當成一組；Hive SQL、Spark SQL、MySQL 可見不加內層括號的多參數形式。要避開各引擎對缺值的差異，可先對兩欄 `SELECT DISTINCT`，再在外層 `COUNT(*)`，並明訂缺值政策。

- 訂單數變多 → 在明細粒度用 `COUNT(*)` → 回到訂單表或按訂單鍵去重。
- 金額加入退款後倍增 → 明細與退款同時一對多 → 各端先彙總再連接。
- 同價品項少算 → 用金額去重取代辨認列 → 使用訂單鍵與行號。
