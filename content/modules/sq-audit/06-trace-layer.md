---
id: sq-audit-06
module: sq-audit
order: 6
title: 逐層定位
subtitle: 從日總額一路切回原始憑證
status: ready
minutes: 30
level: 2
prereqs:
- sq-audit-05
objectives:
- 選擇同一日和粒度逐層核對金額
- 定位退款連接第一次放大的訂單並寫出修法
tags:
- 逐層對帳
- 連接膨脹
- 退款明細
resources:
- title: Spark SQL：CTE
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-cte.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看如何為每個中間核對步驟取名。
- title: Spark SQL：EXPLAIN
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-explain.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 FORMATTED 的節點資訊，辨認連接位置。
concepts:
- id: sq-audit-06-stage
  prompt: 日報總額對不上時，哪個粒度適合從日往下切？
  answer: 用同一天往訂單切，找出不同訂單後才看品項與退款明細。
  mcq:
    options:
    - 直接比全歷史總額
    - 先隨機刪掉重複金額
    - 日→訂單→明細或憑證
    - 只比日期格式
    answer: 2
    explain: 縮範圍時保留同口徑，才能找第一個改變的步驟。
- id: sq-audit-06-fanout
  prompt: 同單 3 筆品項與 2 筆退款直接相接，會出幾筆？
  answer: 在鍵都匹配時是 6 筆；每個品項對上每筆退款。應各邊先聚合到一單一列。
  mcq:
    options:
    - 5 筆，把兩邊列數相加
    - 3 筆，左連接永遠不放大
    - 2 筆，退款數決定結果
    - 6 筆，先兩邊各自聚合
    answer: 3
    explain: 左連接保留左列，但當右側有多筆匹配仍會放大。
  interview:
    question: 怎樣向營運證明差額不是來源本身缺數？
    answer: 我會先固定同一營業日與到達截點。從日總額比到每單，發現某單在接退款後才變了，再列出原品項和退款憑證。修正後以一單一列重算並核對差額歸零，保留前後輸出。
    points:
    - 固定同一截點
    - 找到最早失真的步驟
    - 以末端差額和原始憑證驗修復
- id: sq-audit-06-control
  prompt: 為什麼不能用 SUM(DISTINCT amount) 修金額膨脹？
  answer: 兩筆合法明細可能剛好同金額，去重會把它們合併。要修連接的粒度。
  mcq:
    options:
    - 同金額不代表同一筆
    - 只要改成 COUNT(DISTINCT amount)
    - 改排序即可
    - DISTINCT 會按所有原始鍵自動還原
    answer: 0
    explain: 值相同和來源身分相同是不同概念。
- id: sq-audit-06-basis
  prompt: 按下單日淨額和按退款入帳日的退款額不同，先做什麼？
  answer: 確認兩份報表的日期歸屬與退款截點，再挑同口徑範圍比較。
  mcq:
    options:
    - 先把兩邊轉成百分比
    - 用同口徑與截止點重做對照
    - 直接取兩份數字的平均
    - 將較高一方認定為重複
    answer: 1
    explain: 兩個指標可以同時正確；比對前要固定日的意思和可見的退款。
practice:
- id: sq-audit-06-p1
  kind: sql
  category: [reconcile, join]
  title: 找出第一張被放大的單
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    取 orders 的 2026-01-23 已付款訂單。比較接退款前的 order_items 列數和左連接 refunds（只用 order_id、不限退款日）後的列數。僅列放大的訂單，輸出 order_id、item_rows、joined_rows，依 order_id 升冪。
  solution: |
    WITH item_counts AS (
     SELECT i.order_id, COUNT(*) AS item_rows
     FROM orders o JOIN order_items i USING (order_id)
     WHERE o.order_date = DATE '2026-01-23' AND o.status = 'paid' GROUP BY i.order_id
    ), joined AS (
     SELECT i.order_id, COUNT(*) AS joined_rows
     FROM item_counts k JOIN order_items i USING (order_id)
     LEFT JOIN refunds r USING (order_id) GROUP BY i.order_id
    )
    SELECT i.order_id, i.item_rows, j.joined_rows FROM item_counts i JOIN joined j USING (order_id)
    WHERE j.joined_rows > i.item_rows ORDER BY i.order_id;
  explain: |
    1021 原有 1 個品項，接到 2 張退款後變 2 列。先留下列數對照，才知道金額在何處被放大。
  hints:
  - 在兩個步驟各自數列
  - 比較相同訂單鍵
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-06-stage
  - sq-audit-06-fanout
  - sq-audit-02-grouped
  tags:
  - 逐層對帳
  - 連接膨脹
  - 退款明細
- id: sq-audit-06-p2
  kind: sql
  category: [reconcile, join]
  title: 恢復按訂單對照的淨額
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    對 2026-01-23 已付款訂單，先逐單算品項總額與全期退款，再相接。不需分攤退款給品項；無退款為 0。輸出 order_id、gross_amount、refund_amount、net_amount，依 order_id 升冪。
  solution: |
    WITH gross AS (
     SELECT o.order_id, SUM(i.qty * i.unit_price) AS gross_amount
     FROM orders o JOIN order_items i USING (order_id)
     WHERE o.order_date = DATE '2026-01-23' AND o.status = 'paid' GROUP BY o.order_id
    ), refunded AS (
     SELECT order_id, SUM(amount) AS refund_amount FROM refunds GROUP BY order_id
    )
    SELECT g.order_id, g.gross_amount, COALESCE(r.refund_amount, 0) AS refund_amount,
           g.gross_amount - COALESCE(r.refund_amount, 0) AS net_amount
    FROM gross g LEFT JOIN refunded r USING (order_id) ORDER BY g.order_id;
  explain: |
    1021 是 90 元成交、15 元退款、淨 75 元；1020 無退款。先對齊一單一列，既不重複算成交，也不靠 DISTINCT 砍掉合法同價明細。
  hints:
  - 品項與退款先各自按訂單加總
  - 保留無退款的訂單
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-06-control
  - sq-audit-06-basis
  - sq-audit-06-fanout
  - sq-audit-05-aggregate
  - sq-db-02-price
  tags:
  - 逐層對帳
  - 連接膨脹
  - 退款明細
---

1 月 23 日的淨營收和財務明細對不上。不要先重跑全月，也不要見到重複金額就刪。這次逐層定位（layer-by-layer tracing）要回答：從哪一個步驟起，兩份數據第一次不一致？

## 從日往下切，不改口徑

先定為「1 月 23 日已付款訂單，退款歸原單且使用這份樣本內所有已知退款」。這不是「1 月 23 日當天入帳退款」，兩者不應互比。正式報表還要註明收到數據的截點。接著按以下步驟縮小：

1. 在日層記總額和單數，不用兩個數字彼此抵銷的差額直接過關。
2. 下切到每張訂單，並排兩邊的列數、成交額和退款額，標出第一個不同的欄位。
3. 對差異單再看來源品項與退款鍵，確認少列、多列或口徑不一樣。
4. 找到最早壞掉的步驟才修；修後重跑同範圍和幾張原本就正確的單，避免意外改壞其他數字。

## 1021 的兩張退款

在 `shop` 單看訂單 1021 的品項和相接退款後的列數。這張單本來只有一筆明細，卻有兩張退款憑證；若用訂單號直接連接，品項就被重複帶入。這種多對多或一對多的列放大常稱 fan-out（連接膨脹）。先把每邊變成同一粒度，再接。

```sql
SELECT i.order_id, COUNT(*) AS joined_rows, COUNT(DISTINCT i.line_no) AS item_lines
FROM order_items i LEFT JOIN refunds r USING (order_id)
WHERE i.order_id = 1021 GROUP BY i.order_id;
```

結果是 連接後 2 列、原始明細 1 列。原始成交額 90 元，兩次共退 15 元，應為 75 元。直接加總相接後的成交額則變 180 元，減完退款得到 165。你能把多出的 90 元指回一次連接；最後再用沒有退款的 1020 當對照，確定修法沒有把它丟掉。

## 交接只需要四個小證據

寫下同一營業日與截止點、差異首次出現的步驟、能回查的訂單與退款鍵，以及修完的前後對照。只報總差額，下一班還會從日報重頭找；只說連接膨脹，又沒法檢查是讀兩次退款還是重送一筆品項。可以另保留逐單的來源金額、錯誤金額及修正金額，讓同事一眼驗證差額由哪張單貢獻。比較另外一張原先沒有差異的訂單時，確認其金額和列數沒被變更；當修正影響不只一個日期，再按受影響鍵重算與抽檢。

若退款同時影響未關帳和已關帳期間，先問清誰能核可重列；保留舊值與預期新值，避免把更新了多少列誤當作業務已確認。修完後兩個截點應可各自重跑。

## 常見錯誤

- 報表總額看來相同卻沒比每單 → 差異相互抵銷 → 用雙向鍵和逐單差額。
- 只用 `SUM(DISTINCT 金額)` → 相同數字可能是兩筆不同的合法款項 → 修相接前的粒度。
- 無退款單消失 → 將左連接寫成只留有退款 → 保留左側訂單，按業務定義補 0。

## 方言與面試

DuckDB、Spark SQL 和 MySQL 都能以 CTE 拆出每層；Spark 的 `EXPLAIN FORMATTED` 與 MySQL 的計畫格式不同，但計畫不是對帳證據。拿執行的逐單列數、原始憑證和修完後的差額交付，別用一張計畫圖代替結果。
