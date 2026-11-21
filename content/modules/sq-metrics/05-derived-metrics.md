---
id: sq-metrics-05
module: sq-metrics
order: 5
title: 原子與派生指標
subtitle: 先固定誰在何時做了什麼
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-04
objectives:
- 以業務動作寫出原子指標
- 加上日期與維度篩選派生成交指標，不重算同一訂單
tags:
- 原子指標
- 派生指標
- 統計口徑
resources:
- title: Dataphin：指標與統計粒度
  url: https://help.aliyun.com/zh/dataphin/fullmanaged/getting-started/the-statistical-index
  kind: doc
  lang: zh-Hans
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀原子、派生及其時間與限定詞。
- title: dbt：指標類型
  url: https://docs.getdbt.com/docs/build/metrics-overview
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對照簡單、派生及比率指標。
concepts:
- id: sq-metrics-05-atomic
  prompt: 「每天港灣的已付款訂單數」的原子業務動作是什麼？
  answer: 判定一張訂單付款成立並以訂單為單位計數；日和城市是派生的限定。
  mcq:
    options:
    - 港灣是付款事件
    - 已付款訂單以單為單位計數
    - 一天的城市名稱數
    - 把商品品項當訂單
    answer: 1
    explain: 原子定義先固定事件、單位和計算，再加時間與條件。
- id: sq-metrics-05-scope
  prompt: 如何從成交訂單數派生出某週的茶飲成交訂單數？
  answer: 保留同一付款及訂單粒度，限定日期與商品分類；多品項仍只算一單。
  mcq:
    options:
    - 改成茶飲行數
    - 每張單的一行都加一
    - 加週期與茶飲限定，不改計數單位
    - 以商品現價過濾已付款
    answer: 2
    explain: 維度限定不能把原子指標悄悄換成另一件事。
  interview:
    question: 給你一個「近七天活躍數」，你怎麼問清口徑？
    answer: 我會問活躍是哪種事件、計的是事件或使用者、七天基於哪個時區、包含今天嗎，以及重送怎麼處理。先寫下一句可驗定義，再拿邊界時刻和重送測例對 SQL。
    points:
    - 業務動作與計數單位
    - 窗口及時區
    - 留下邊界驗收測例
- id: sq-metrics-05-distinct
  prompt: 同一訂單同時有兩項茶飲，茶飲成交訂單數加幾？
  answer: 只加 1；先找到含茶飲的訂單，再依訂單鍵去重。
  mcq:
    options:
    - 加 2
    - 只數商品種類
    - 按會員訂單歷史累加
    - 加 1
    answer: 3
    explain: 指標的主詞是訂單，不是品項或會員。
practice:
- id: sq-metrics-05-p1
  kind: sql
  category: [model, aggregate]
  title: 固定一件業務的計數
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    查 2026-01-18 的已付款訂單，輸出 paid_orders（每張單計一次）、paid_buyers（不同會員數），單列不需排序。
  solution: |
    SELECT COUNT(*) AS paid_orders, COUNT(DISTINCT user_id) AS paid_buyers
    FROM orders WHERE order_date = DATE '2026-01-18' AND status = 'paid';
  explain: |
    取消的 1011 有明細但不算。單數和買家數是兩個指標，即使這天數字恰好相等也不能互稱。
  hints:
  - 使用單頭定付款狀態
  - 買家數按不同 user_id 算
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-05-atomic
  - sq-metrics-05-distinct
  tags:
  - 原子指標
  - 派生指標
  - 統計口徑
- id: sq-metrics-05-p2
  kind: sql
  category: [model, distinct]
  title: 限定茶飲但保留一單一次
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    取 2026-01-20 至 01-23（含）的已付款訂單，按日期算兩個數：paid_orders 為全部訂單數；tea_paid_orders 為至少有一個 '茶飲' 品項的不同訂單數。輸出 order_date、paid_orders、tea_paid_orders，依 order_date 升冪；有已付訂單但無茶飲時保留那天。
  solution: |
    WITH tea AS (
     SELECT DISTINCT i.order_id FROM order_items i JOIN products p USING (product_id)
     WHERE p.category = '茶飲'
    )
    SELECT o.order_date, COUNT(*) AS paid_orders, COUNT(t.order_id) AS tea_paid_orders
    FROM orders o LEFT JOIN tea t USING (order_id)
    WHERE o.status = 'paid' AND o.order_date BETWEEN DATE '2026-01-20' AND DATE '2026-01-23'
    GROUP BY o.order_date ORDER BY o.order_date;
  explain: |
    先把茶飲資格縮到一單一列，避免一單多行使兩個計數都膨脹。左連接保住未買茶的已付訂單；直接把分類寫到外層 WHERE 會丟它。
  hints:
  - 先做只含茶飲資格的訂單集合
  - 用左連接保留全集
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-05-scope
  - sq-metrics-05-atomic
  - sq-metrics-05-distinct
  - sq-metrics-04-grain
  tags:
  - 原子指標
  - 派生指標
  - 統計口徑
---

營運說「茶飲成交數」比財務的「成交數」還高。兩份 SQL 都能執行，問題卻出在主詞：一份數品項，一份數訂單。要讓報表換範圍而不換意思，先定義一項業務動作，再加上使用情境的限制。

## 先有能說清楚的原子定義

原子指標（atomic metric）是可重用的基本計量。例：已付款訂單數，指單頭狀態為 paid 的不同訂單數，單位是「張」。別把「已付款」當顯而易見的文字：這份樣本只有 paid 和 cancelled，正式系統可能還有付款後取消、部分支付或退款，各別由業務定義。

派生指標（derived metric，台灣常稱衍生指標）把時間窗口和業務限定加到基礎定義上。例如「1 月 20 日至 23 日，有茶飲品項的已付款訂單數」，日是下單營業日，茶飲表示同單有至少一個分類是茶飲的品項；一張單還是只算一次。在這套數倉命名中由原子加限制得到派生指標；別家工具可能用派生指不同指標之間的運算。之後在[〈複合指標與分母〉](#/lesson/sq-metrics-06)會比較比率。

## 先跑原子值，再加限定

在 `shop` 查 1 月 18 日。1010 已付、1011 取消，所以成交數是 1。即使有商品明細的取消單，也不納入成交。

```sql
SELECT COUNT(*) AS paid_orders FROM orders
WHERE order_date = DATE '2026-01-18' AND status = 'paid';
```

需要將「有茶飲」套上時，不用每個符合品項加 1；先挑出有資格的訂單集合，這個集合每單最多一列。比較衍生值和基礎值時，保證同一天、同一狀態定義，才有資格說前者不應大於後者。把定義改為「至少一個品項」還是「全部都是茶飲」，屬於不同指標，不可偷偷替換。

## 選幾張單用人話驗口徑

先挑一張已付、含兩個茶飲品項的單，預期它對兩個計數都只加 1。再挑一張沒有茶飲的已付單，只對全部成交加 1。最後挑有茶飲品項卻已取消的單，兩個計數都不能加。這三張單比「跑完不報錯」更能證明口徑。若同事問哪個欄位才能加上城市限定，你還要先確認該城市指購買當時、現在的會員城市，還是訂單配送城市；限制雖是同一名稱，含義不同就要另立定義。

若限定詞需要跨表取得，先驗相接前後訂單數；唯一鍵不正確的維表會改變分母，讓比率也看似合理卻不可追溯。

## 常見錯誤

- 茶飲成交比全部成交多 → 以茶飲品項列數當訂單數 → 用訂單鍵去重。
- 同樣寫「成交」但報表不同 → 沒定義狀態、時間與單位 → 先寫一句可用數據驗的口徑。
- 沒茶飲的日整個不見 → 外層只留匹配的品項 → 保留日期或已付訂單全集。

## 方言與面試

DuckDB、Spark SQL 都可用 `COUNT(DISTINCT 單欄)`。若要計複合鍵，MySQL 支援多參數的 `COUNT(DISTINCT a, b)`，DuckDB 可先以 `SELECT DISTINCT a, b` 做唯一組合再數；需先核對複合鍵中 NULL 要不要算。不要以不加分隔的字串拼接代替複合鍵，兩組數字可能拼成同一結果。
