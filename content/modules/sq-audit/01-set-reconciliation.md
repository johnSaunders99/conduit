---
id: sq-audit-01
module: sq-audit
order: 1
title: 集合差集對帳
subtitle: 筆數一樣也可能換了一批單
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 以雙向 EXCEPT 找缺單與多單
- 分辨同筆數與同鍵集合，並選對比較欄位
tags:
- EXCEPT
- 雙向對帳
- 集合
resources:
- title: Spark SQL：集合運算
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-setops.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對照 EXCEPT 與 EXCEPT ALL 的範例。
- title: MySQL：EXCEPT
  url: https://dev.mysql.com/doc/refman/8.4/en/except.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀方向、欄位以及 ALL 的差異。
concepts:
- id: sq-audit-01-direction
  prompt: 要找來源有、目標沒有的訂單，EXCEPT 左右怎麼放？
  answer: 來源在左、目標在右；反過來找的是目標多出的單。
  mcq:
    options:
    - 目標 EXCEPT 來源
    - 來源 EXCEPT 目標
    - 兩者做 INTERSECT
    - 兩邊只比較 COUNT
    answer: 1
    explain: 差集有方向；等筆數未必代表同一批鍵。
- id: sq-audit-01-key
  prompt: 只核對會員編號為何可能漏掉換單？
  answer: 同一個會員可下多單；要以訂單編號為比對粒度。
  mcq:
    options:
    - 只比訂單日期
    - 把欄位都轉成字串
    - 比對 order_id 而非 user_id
    - 使用總金額取代鍵
    answer: 2
    explain: 先定義一筆要核對的對象，再選對應鍵。
- id: sq-audit-01-membership
  prompt: 兩個方向差集都是空，還需要檢查什麼？
  answer: 它只證明所選欄位的不同值相同；還要依需求核對重複次數及非鍵欄位。
  mcq:
    options:
    - 已證明整張表所有列相同
    - 一定有原表壞鍵
    - 再比較列順序即可
    - 檢查次數與欄位
    answer: 3
    explain: 普通差集會去重，不能證明每個值的出現次數。
  interview:
    question: 上游和下游都是 100 筆，如何證明對帳過了？
    answer: 我不只比筆數。先固定同營業日、狀態與截點，比較兩個方向的訂單鍵；如果是明細還會比粒度、次數和金額。輸出缺在哪邊的鍵，方便查回來源。
    points:
    - 固定比較範圍
    - 雙向比鍵
    - 另核對重複及非鍵欄位
practice:
- id: sq-audit-01-p1
  kind: sql
  category: [reconcile, set]
  title: 找出漏掉的取消單
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    來源為 1009 至 1012 的 orders；目標只保留這些訂單的 paid 列。輸出來源有、目標沒有的 order_id，依 order_id 升冪。
  solution: |
    SELECT order_id FROM orders WHERE order_id BETWEEN 1009 AND 1012
    EXCEPT
    SELECT order_id FROM orders WHERE order_id BETWEEN 1009 AND 1012 AND status = 'paid'
    ORDER BY order_id;
  explain: |
    左減右會找到取消單。題意刻意讓兩側口徑不同以練習識別；正式對帳須先同範圍。
  hints:
  - 用訂單編號而非狀態當比較欄
  - 先寫來源再寫目標
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-01-direction
  - sq-audit-01-key
  tags:
  - EXCEPT
  - 雙向對帳
  - 集合
- id: sq-audit-01-p2
  kind: sql
  category: [reconcile, set]
  title: 查出等量換單的兩個方向
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    來源為 orders 的 1010 至 1012，目標為 1011 至 1013。輸出 order_id、side（僅來源為 source_only，僅目標為 target_only），依 order_id 升冪；不要輸出雙方都有的鍵。
  solution: |
    WITH src AS (SELECT order_id FROM orders WHERE order_id BETWEEN 1010 AND 1012),
    dst AS (SELECT order_id FROM orders WHERE order_id BETWEEN 1011 AND 1013),
    missing AS (SELECT order_id FROM src EXCEPT SELECT order_id FROM dst),
    extra AS (SELECT order_id FROM dst EXCEPT SELECT order_id FROM src)
    SELECT order_id, 'source_only' AS side FROM missing
    UNION ALL
    SELECT order_id, 'target_only' AS side FROM extra
    ORDER BY order_id;
  explain: |
    兩側各 3 列，卻是兩份不同集合。拆成兩個 CTE 可以防止集合運算綁定順序寫錯。
  hints:
  - 各寫一次 EXCEPT，左右互換
  - 各方向補標籤再合併
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-01-direction
  - sq-audit-01-membership
  - sq-audit-01-key
  tags:
  - EXCEPT
  - 雙向對帳
  - 集合
---

早上來源有 3 張單，報表也有 3 張單。昨夜的改版卻把 1010 換成 1013；總筆數檢查不會響。對帳（reconciliation；大陸也寫對賬）的第一步不是證明兩邊都很忙，而是交出一張確定缺哪張、多哪張的清單。

## 用差集回答有沒有

集合（set）只關心值是否出現。差集（set difference）用 `左查詢 EXCEPT 右查詢` 列出只在左半出現的值，普通寫法去重。前面[〈INTERSECT 與 EXCEPT〉](#/lesson/sq-compose-07)練過運算；這一堂把它裝進核對流程。

- 兩個查詢各輸出相同欄位數，順序對齊；比較按欄位位置，不按別名。先確認兩邊都比訂單編號，不要拿會員編號放在另一側同位置。
- 只寫來源減目標只能找到缺單；也要寫目標減來源才能找到多出來的單。
- 一個方向有結果、另一個沒有，不代表程式錯。它能區別「少入庫」，也能區別「查詢取太多」。排序放在最外層，方便固定收集結果。

## 先定比較範圍，再追差異

在 SQL 練習場選 `shop`。下面縮小範圍到 1010 至 1012。一側刻意只保留已付款，訂單 1011 是取消單；先預測誰留在差集。輸出只要鍵，理由留到第二個查詢查來源狀態。正式情境要先核對兩側是不是同營業日、同到達截點、同狀態定義；否則查到的可能只是規則不同。

```sql
SELECT order_id FROM orders WHERE order_id BETWEEN 1010 AND 1012
EXCEPT
SELECT order_id FROM orders WHERE order_id BETWEEN 1010 AND 1012 AND status = 'paid'
ORDER BY order_id;
```

只有 1011，不等於「取消單都該補入報表」。請把缺單清單和此次條件一起保存：如果報表本來只收已付，來源也應加同一條件後再核對。當兩邊鍵都一樣，值還可能錯，或某個事件有重送；之後在[〈多重集合對帳〉](#/lesson/sq-audit-02)和[〈欄位級差異〉](#/lesson/sq-audit-03)會分開處理。

## 留下能再查一次的證據

把缺單輸出另存為一份含範圍的結果，不要只截一張「查到兩列」的圖。比如記這次比的是一段訂單編號，來源包含取消狀態，目標僅含已付；再切到等量換單的情境，比較你能不能靠相同欄名和方向判讀兩列。正式交接時，時間範圍用業務日期，另記來源快照或批次截止，讓同事重跑差集時不會把後來到的單混進來。等候上游的差異和需要修復的差異，都用鍵保留，處置不要寫進同一個刪除指令。

把比對欄位和順序也記在結果旁，方便重現。

## 常見錯誤

- 缺單方向翻轉 → 左右放反 → 命名 source 與 target，先口述「誰有、誰無」。
- 會員都對上卻漏掉換單 → 比錯層級 → 改用訂單鍵；比明細則納入行號。
- 差集空便認定沒有重複 → 普通差集已去重 → 另跑每鍵列數或下一堂的多重集合檢查。

## 方言與面試

DuckDB 與 Spark SQL 可用 `EXCEPT`；MySQL 要確認版本，舊版可改用 `NOT EXISTS` 加 `DISTINCT`，且可空鍵要先定缺值的等價規則。不要直接換成可能受到 NULL 影響的 `NOT IN`。面試時先說清楚核對章法：先固定範圍、測兩個方向、最後才判斷差異是否真的有問題。
