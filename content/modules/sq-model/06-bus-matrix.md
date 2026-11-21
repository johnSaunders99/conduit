---
id: sq-model-06
module: sq-model
order: 6
title: 一致維度與匯流排矩陣
subtitle: 訂單與退款能否共用日期
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-05
objectives:
- 用過程和維度畫一份訂單與退款匯流排矩陣
- 以同一日曆定義對齊不同過程的每日結果
- 用按日對帳發現多對多連接導致的錯誤
tags:
- 一致維度
- 匯流排矩陣
- 日期角色
- 跨事實彙總
resources:
- title: Kimball Group：一致維度
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/conformed-dimension/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 確認跨事實對照需要共用屬性定義與值域。
- title: Kimball Group：數倉匯流排架構
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/kimball-data-warehouse-bus-architecture/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看矩陣如何從業務過程界定維度重用。
concepts:
- id: sq-model-06-conformed
  prompt: 兩張事實表都有 city 欄，如何判斷它是一致維度？
  answer: 同名不夠；要核對城市含義、可用值、未知政策以及所使用的版本。
  mcq:
    options:
    - 欄名相同即可
    - 欄位都是字串即可
    - 定義和值域可對齊才可以
    - 兩張事實的列數相同才可以
    answer: 2
    explain: 如果一邊是收貨地、一邊是會員現居地，欄名相同也不能直接對照。
  interview:
    question: 怎麼證明訂單和退款可共用日期維度？
    answer: 我先對齊營業日切換規則與財務週、假日等屬性，確認兩邊連到同一套日曆。訂單日與退款入帳日仍命名為不同角色。做日對帳我會各自聚合，再用日曆對齊並明示沒有來源的日期。
    points:
    - 用定義和值域證明一致
    - 保留日期角色
    - 各自聚合並保留單側有值日期
- id: sq-model-06-bus
  prompt: 匯流排矩陣的列與欄各在記什麼？
  answer: 以業務過程為列、可重用維度為欄，交叉點標記適用維度及其角色。
  mcq:
    options:
    - 列是過程，欄是維度
    - 列是日，欄是金額
    - 列是主鍵，欄是索引
    - 列是引擎，欄是版本
    answer: 0
    explain: 矩陣記的是業務模型關係，不是排程、索引或欄型清單。
- id: sq-model-06-drill-across
  prompt: 如何避免不同事實表在對比日金額時互相複製列？
  answer: 各自先按一致的日期粒度彙總，再按日期鍵對齊結果。
  mcq:
    options:
    - 直接按日連明細
    - 先按金額去重
    - 讓兩邊排序相同
    - 各自按日聚合後再對齊
    answer: 3
    explain: 直接按日期連明細會和同日所有列配對；改排序或在最後去重都治不了原始乘積。
- id: sq-model-06-role-date
  prompt: 退款入帳日可以和原單營業日使用同一日期維度嗎？
  answer: 可以共用日曆成員，但兩者是不同日期角色，報表欄名和口徑要分開。
practice:
- id: sq-model-06-p1
  kind: sql
  category: [model, time]
  title: 計算退款入帳日筆數
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    依 `refund_date` 彙總退款事件。依序輸出 `activity_date`、事件數 `refund_count`，按 `activity_date` 升序；同一張單分次退款應分開計數。
  solution: |
    SELECT refund_date AS activity_date, COUNT(*) AS refund_count
    FROM refunds GROUP BY refund_date ORDER BY activity_date;
  explain: |
    以退款自身日期為日期角色。使用原單的訂單日期或按訂單鍵去重，會改變這個口徑。
  hints:
  - 以 refund_date 分組
  - COUNT(*) 算事件列
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-06-role-date
  - sq-model-06-bus
  - sq-model-02-grain
  tags:
  - 一致維度
  - 匯流排矩陣
- id: sq-model-06-p2
  kind: sql
  category: [model, reconcile]
  title: 對齊訂單日與退款日
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    依 `orders.order_date` 算已付訂單數，依 `refunds.refund_date` 算退款事件數。依序輸出 `activity_date`、`paid_orders`、`refund_count`。只要任一側當日有事件就保留，另一側缺席補 0，依 `activity_date` 升序。
  solution: |
    WITH paid AS (
      SELECT order_date AS dt, COUNT(*) AS n
      FROM orders WHERE status = 'paid' GROUP BY order_date
    ), returned AS (
      SELECT refund_date AS dt, COUNT(*) AS n FROM refunds GROUP BY refund_date
    )
    SELECT COALESCE(p.dt, r.dt) AS activity_date, COALESCE(p.n, 0) AS paid_orders,
           COALESCE(r.n, 0) AS refund_count
    FROM paid p FULL OUTER JOIN returned r ON p.dt = r.dt
    ORDER BY activity_date;
  explain: |
    先各自彙總再對齊，可用 FULL OUTER JOIN。DuckDB、Spark SQL、Hive SQL 支援此連接；MySQL 沒有同名語法，可先 UNION 取日期集合，再分別左連兩份日彙總。
  hints:
  - 各用一個日彙總
  - 兩邊都要保留，COALESCE 取有值的日期
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-06-conformed
  - sq-model-06-drill-across
  - sq-model-02-preaggregate
  tags:
  - 一致維度
  - 匯流排矩陣
---

## 同一個日曆，不一定同一種日期

主管想看一張表：每天有幾張付費訂單、幾次退款？退款有自己的入帳日，不一定等於原單的營業日。若把 3 月 5 日的退款算到訂單原日，就變成「按原單日追蹤退款」，那是另一個問題。兩個日期可以共用一份日曆，仍要保留不同的日期角色（role-playing dimension），也就是同一套維度在事實上扮演不同欄位角色。

一致維度（conformed dimension，又稱一致性維度；台灣也稱共用維度）是讓數張事實能按相同的描述對齊的約定。要看欄位的定義和值域，而不只看名稱。兩邊都寫 `day`，但一邊按午夜切日、另一邊按凌晨 4 點切日，它們還不能直接對齊。兩套日曆若只有較粗的月份層級對齊，就只能可靠地比較到月。

## 先畫可共用的範圍

匯流排矩陣（bus matrix，亦稱總線矩陣）以業務過程為列、維度為欄。拿紙先畫這 2 列，空白不是漏填，是這一過程沒有直接可用的維度：

- 「銷售明細」列：日期填營業日、會員填下單會員、商品填成交品項。
- 「退款事件」列：日期填入帳日、會員可經原單取得；商品先留空，因為數據只知道退哪張單，不知道退哪個品項。

矩陣的產出不是另一張大寬表，而是提示哪些軸能一起比較、哪些不能。同一個會員若要跨過程比較，也要確認取的是同一業務身分和相容版本。

## 各自彙總後再對齊

在 `shop` 試算日對帳：先讓每份結果回到「一天一列」，再按日期對照。這種獨立彙總後比較叫跨事實查詢（drill-across）。如果當日只有退款，用全外連接保留；若所有日期都要顯示，改以完整日曆為保留端。看 3 月 5 日：退款 1 筆、付費訂單 0 張。若結果遺失了這一天，檢查是否只保留了左側的訂單日。這裡填入 0 的前提，是兩份來源在練習範圍內已完整。正式報表在來源未到齊時應標示未知，不應補零。

做一次反向驗算：把日表的退款筆數重新加總，應等於來源的退款事件數；對訂單數也做一次。兩個總數都對只是第一關，還要抽查原單日和入帳日不同的事件確實落在各自日期。否則整月的總數碰巧相同，仍可能每天都錯。

記得同時留下這兩組逐日與全期的對帳證據。

## 方言與常見錯誤

DuckDB、Hive SQL、Spark SQL 可用 `FULL OUTER JOIN`。MySQL 可先 `UNION` 兩份查詢的日期集合，再從集合分別 `LEFT JOIN` 兩邊。一開始就用完整日曆的做法在這些引擎都好遷移。

- 退款數多出數倍 → 同日原始事實直接連接 → 先各自聚合，再連日結果。
- 退款入帳日搬回銷售日 → 用錯日期角色 → 依分析問題選日期欄。
- 沒有訂單的退款日消失 → 只保留左側 → 保留兩側或用日期維度當底。
