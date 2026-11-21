---
id: bd-quality-04
module: bd-quality
order: 4
title: 跨層對帳
subtitle: 分別核對筆數與金額
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-03
objectives:
- 在同一口徑下比較來源和加工結果
- 找出筆數相同但總額不同的日期
- 用完整外連接列出缺鍵、多鍵及差額
tags:
- 跨層對帳
- 金額
- 粒度
- 完整外連接
resources:
- title: dbt：數據測試
  url: https://docs.getdbt.com/docs/build/data-tests
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 觀察如何讓查詢回傳要修的失敗記錄。
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/lts/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 查完整外連接如何保留兩邊未匹配列。
concepts:
- prompt: 開始對帳前先對齊什麼？
  answer: 時間範圍、來源切點、粒度、包含的狀態、金額單位與取整規則。
  mcq:
    question: 原始是全部訂單明細，集市只含已付款單，哪個比較有意義？
    answer: 1
    options:
    - 直接比較兩表總列數
    - 按相同規則聚合後比較
    - 只比較最大訂單編號
    - 只比較任務耗時
    explain: 按同狀態及同粒度比較，或先說清排除哪些列；直接比全表筆數會誤報。
  id: bd-quality-04-scope
- prompt: 兩邊筆數一致仍可能漏掉哪種異常？
  answer: 某些金額算錯，或者同時少一筆又多一筆，總筆數不變。
  mcq:
    question: 兩側都 2 列，來源 225 元、結果 215 元，下一步？
    answer: 2
    options:
    - 已通過，當前只看筆數
    - 將 10 元自動補到最大訂單
    - 按鍵列出金額差異並追溯
    - 刪除來源最便宜的一筆
    explain: 先查逐鍵差異；數量不變不能證明一致，也不應用整體平均掩蓋。
  id: bd-quality-04-amount
- prompt: 何時需完整外連接而非只看內連接？
  answer: 要同時看到來源有而加工缺、以及加工有而來源沒有的鍵。
  interview:
    question: 日報比明細少 3%，你會怎樣對帳？
    answer: 先對齊營業日、快照、退款及取消口徑，查出從原始到明細再到集市各層在哪一層開始偏差。先比筆數、總額，再按日與鍵展開兩邊的差集和差額；最後用具體的錯單重跑驗收。
    points:
    - 對齊切點、狀態與粒度
    - 逐層定位最先偏差處
    - 按鍵比對而非只看全量
  id: bd-quality-04-side
practice:
- kind: sql
  category: [reconcile]
  title: 抓到筆數沒變的差額
  minutes: 5
  dataset: shop
  prompt: 以 `order_items` 訂單 1001 的列作來源；每列 `amount = qty * unit_price`。候選層保留相同列數，但把行號 2 的金額減 10。輸出一列 `source_rows`、`candidate_rows`、`source_amount`、`candidate_amount`、`delta`（候選減來源），無須排序。
  solution: |-
    WITH raw AS (
      SELECT line_no, qty * unit_price AS amount FROM order_items WHERE order_id = 1001
    ), candidate AS (
      SELECT amount - CASE WHEN line_no = 2 THEN 10 ELSE 0 END AS amount FROM raw
    ), a AS (SELECT COUNT(*) AS n, SUM(amount) AS amount FROM raw),
    b AS (SELECT COUNT(*) AS n, SUM(amount) AS amount FROM candidate)
    SELECT a.n AS source_rows, b.n AS candidate_rows,
           a.amount AS source_amount, b.amount AS candidate_amount,
           b.amount - a.amount AS delta
    FROM a CROSS JOIN b;
  explain: 2、2、225、215、-10。先各自聚合到一列再交叉連接；直接把明細交叉配對會放大計數與金額。
  hints:
  - 每個層各自聚合再放在同一列
  concepts:
  - bd-quality-04-amount
  - bd-quality-04-scope
  - sq-group-07-reconcile
  tags:
  - 對帳
  - 差額
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-04-p1
- kind: sql
  category: [reconcile, join]
  title: 同時列出缺鍵、多鍵與金額錯
  minutes: 8
  dataset: shop
  prompt: 取 `order_items` 訂單 1001、1002 的逐單總額作來源。候選是 `(1001,215)` 和 `(1099,40)`。列出不一致的鍵，欄序 `order_id`、`source_amount`、`candidate_amount`、`issue`（來源獨有
    `missing`、候選獨有 `extra`、金額不同 `amount`），沒有的一側保留 NULL。依 `order_id` 遞增。
  solution: |-
    WITH raw AS (
      SELECT order_id, SUM(qty * unit_price) AS amount
      FROM order_items WHERE order_id IN (1001, 1002) GROUP BY order_id
    ), candidate(order_id, amount) AS (VALUES (1001, 215), (1099, 40))
    SELECT COALESCE(r.order_id, c.order_id) AS order_id,
           r.amount AS source_amount, c.amount AS candidate_amount,
           CASE WHEN c.order_id IS NULL THEN 'missing'
                WHEN r.order_id IS NULL THEN 'extra' ELSE 'amount' END AS issue
    FROM raw r FULL OUTER JOIN candidate c ON r.order_id = c.order_id
    WHERE r.order_id IS NULL OR c.order_id IS NULL OR r.amount <> c.amount
    ORDER BY order_id;
  explain: 完整外連接使缺鍵與多鍵都能看見。內連接只會留下 1001；MySQL 不支援 `FULL OUTER JOIN`，可用左連接加另一側反連接後 `UNION ALL`。本題金額非 NULL，缺少整列的判斷以鍵為準。
  hints:
  - 先將雙方放到每張單一列
  - 缺哪一側看的是鍵，不是金額
  concepts:
  - bd-quality-04-side
  - bd-quality-04-scope
  - bd-quality-02-orphan
  tags:
  - 對帳
  - 完整外連接
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-04-p2
---

## 列數都對，為什麼還少了錢？

茶舖的原始訂單先落地，再整理成一列一品項的明細，最後聚合為營運日報。數倉中，原始層留來源樣貌，明細層統一鍵、型別與業務規則，數據集市（data mart，台灣常稱資料市集）交付特定主題的分析結果。**跨層對帳（cross-layer reconciliation）**不是要求每層列數一樣，而是用同口徑的切點比較該保留的東西。日報一日只一列，明細一天數千列，兩個數字本來不能直接比較。

先寫對帳的 3 個基準：哪個營業日與來源版本、兩側轉為哪種粒度、要比較哪個金額（含不含取消與退款）。本例比較訂單明細金額，以成交時單價乘件數，不帶退款，也不使用商品的目前標價。在同粒度上先比筆數、金額，再查業務鍵缺失、多出與逐鍵差額。假如兩張單剛好一張多 10、一張少 10，總額也可能剛好抵銷，所以總額一樣不是最後一步。

## 從小差額追到一筆明細

在 SQL 練習場選 `shop`，預留 1 GB、無容器。先看訂單 1001 的列級金額：

```sql
SELECT order_id, line_no, qty * unit_price AS amount
FROM order_items
WHERE order_id = 1001
ORDER BY line_no;
```

你會看到 135 和 90，共 225。若加工把第二行算成 80，列數仍為 2，總額只剩 215。先把金額差異縮到 1001，再追到該行的原始單價、件數或轉換規則，會比重跑整月有效。若來源與候選用不同小數取整方式，應按事前約定的單位及容差驗證，不能在看到差額後才放寬門檻。

完整外連接（full outer join）用一個鍵並排兩側，連不到的那一側補 NULL；一邊只存在的列仍留下。前提是雙方已到同一粒度、同鍵至多一列，否則比對查詢自己也會放大量。題目會保留 NULL 以提供缺側證據，不把不存在的列當成 0 元。

## 對帳結果要能指到下一步

如果相同日期的整體差額永遠是 0，但有兩張單一正一負，就把異常鍵與絕對差額另行計算。以一張單多 10、另一張少 10 為例，淨差為 0，異常鍵卻有 2 個；只在看板顯示一個淨差會漏掉它們。有效的日報驗收至少給「總額差、差異鍵數、一個可定位的樣本」，並能追到原始檔或批次。若比較的規則不同，先調到相同單位和包含範圍再查據。

對帳不是把來源認作永遠正確。兩個結果不同時，在修復單上註明哪一側用什麼規則得到，拿原始事件或業務清單判定應有值。必要時先保留上一個好版本，待證據充足再換。

## 常見錯誤

- **明細與報表筆數必然不同 →** 用不同粒度相比；各自先依共同業務鍵或日期聚合。
- **總額沒變但營運仍報錯 →** 跨鍵的正負差可能抵銷；展開差額清單。
- **對帳表少了整筆異常 →** 只保留雙側都有的鍵；改用完整外連接或兩向差集。

**重點回顧：**先把兩側放到同一個業務問題上比較，再把差異追到能修的一筆。
