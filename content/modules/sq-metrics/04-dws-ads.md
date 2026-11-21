---
id: sq-metrics-04
module: sq-metrics
order: 4
title: DWS 彙總與 ADS
subtitle: 報表欄位在哪一層穩定下來
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-03
objectives:
- 把已付款明細彙總成可共用的每日數據
- 從同一份彙總產出報表欄，重算平均而非平均各日比率
tags:
- DWS
- ADS
- 可加總度量
resources:
- title: DataWorks：數倉分層
  url: https://help.aliyun.com/zh/dataworks/user-guide/data-warehouse-layering
  kind: doc
  lang: zh-Hans
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 DWS、ADS，對照共用與交付。
- title: Spark SQL：聚合函式
  url: https://spark.apache.org/docs/latest/sql-ref-functions-builtin.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查 sum、count 與條件聚合。
concepts:
- id: sq-metrics-04-layers
  prompt: 需要被多張報表使用的每日成交額應放哪層？
  answer: 放共用彙總 DWS；專用欄名、排序、檔案介面留給 ADS。
  mcq:
    options:
    - DWS 保留共用計量
    - 只留一張圖，不保留數字
    - 每個 ADS 各自從原始層重算
    - ODS 直接變成日總額
    answer: 0
    explain: 保留同粒度的反覆使用數字，避免每張報表再定義一遍。
- id: sq-metrics-04-average
  prompt: 兩天各自的客單價可以直接平均做兩日客單價嗎？
  answer: 不能，兩天可能單數不同；要用兩天成交額合計除以兩天訂單數合計。
  mcq:
    options:
    - 各日客單價除以日數
    - 合併分子與分母再除
    - 取最高的一日
    - 用天數當訂單數
    answer: 1
    explain: 不同天的樣本數不同，單純平均不代表每筆訂單。
  interview:
    question: 為何 DWS 要留分子與分母？
    answer: 如果下游要跨日重算客單價，我會留成交額和成交單數，不只存比率。拿單量不同的兩天做測例，確認跨日用合計後相除。
    points:
    - DWS 明寫粒度
    - 保留可合併的分子、分母
    - 以單量不等日期驗證
- id: sq-metrics-04-grain
  prompt: 為何客單價不能直接拿明細列數當分母？
  answer: 一張單可有多行，明細列數不是訂單數。先按單聚合，或按訂單鍵去重。
  mcq:
    options:
    - 明細金額永遠是訂單額
    - 只挑第一日就會正確
    - 明細有多行一單
    - 明細排序會換成一單一列
    answer: 2
    explain: 聚合前要確定量測單位。
practice:
- id: sq-metrics-04-p1
  kind: sql
  category: [model, aggregate]
  title: 製作每日共用的兩個數字
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對 2026-01-14 至 01-15（含兩端）的 paid 訂單以每行 qty × unit_price 計成交額。按日期輸出 sales_day、paid_orders（不同訂單數）、gross_amount，依 sales_day 升冪。
  solution: |
    SELECT o.order_date AS sales_day, COUNT(DISTINCT o.order_id) AS paid_orders,
           SUM(i.qty * i.unit_price) AS gross_amount
    FROM orders o JOIN order_items i USING (order_id)
    WHERE o.status = 'paid' AND o.order_date BETWEEN DATE '2026-01-14' AND DATE '2026-01-15'
    GROUP BY o.order_date ORDER BY sales_day;
  explain: |
    這份樣本已付款單均有明細。明細列與訂單數不同，不可拿 COUNT(*) 當 paid_orders。
  hints:
  - 單數去重但金額照加
  - 按訂單日分組
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-04-layers
  - sq-metrics-04-grain
  - sq-metrics-02-grain
  tags:
  - DWS
  - ADS
  - 可加總度量
- id: sq-metrics-04-p2
  kind: sql
  category: [model, aggregate]
  title: 從日彙總交付跨日客單價
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    對 2026-01-13 至 01-14（含兩端），以正文的每日 paid 訂單數與金額口徑先彙總，再交付一列 paid_orders、gross_amount、avg_order_amount（不捨入；總金額除以總單數），單列不需排序。
  solution: |
    WITH daily AS (
     SELECT o.order_date, COUNT(DISTINCT o.order_id) AS n, SUM(i.qty * i.unit_price) AS gross
     FROM orders o JOIN order_items i USING (order_id)
     WHERE o.status = 'paid' AND o.order_date BETWEEN DATE '2026-01-13' AND DATE '2026-01-14'
     GROUP BY o.order_date
    )
    SELECT SUM(n) AS paid_orders, SUM(gross) AS gross_amount,
           CAST(SUM(gross) AS DOUBLE) / NULLIF(SUM(n), 0) AS avg_order_amount FROM daily;
  explain: |
    兩天分別 1 單、2 單，不能平均每日客單價。PostgreSQL 要留意整數 / 整數會截斷；MySQL 不用 DIV。
  hints:
  - 先留每日分子、分母
  - 跨日先加總再除
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-04-average
  - sq-metrics-04-layers
  - sq-metrics-02-cancelled
  tags:
  - DWS
  - ADS
  - 可加總度量
---

財務和營運都要每日成交額，營運另外需要跨日客單價。若兩張表各從原始訂單重新決定什麼算成交，很快就會出現兩個版本。把可共用的計量留在一起，把交付格式留到最後；今天會得到一份日彙總和一個跨日報表數字。

## 兩層分工，先說清楚一列

彙總數據層（data warehouse service，DWS）在本課存一日一列的共用計量：成交額、成交單數。應用數據層（application data service，ADS）按具體消費者交付欄位、日期範圍、格式與排序。例如營運想看最近兩天合計，ADS 從每日數字重組，不需另定一個「成交」口徑。組織可以用不同層名；重點是共用業務邏輯與報表展示不相互污染。

- 共用 DWS：寫清日期用訂單日，且只含已付款；金額取品項成交額。單數用不同訂單鍵。
- 報表 ADS：對選定日加總金額與訂單數，再相除。輸出以業務命名，顯示位數可等到最後再處理。
- 需要跨日計算不同會員時，不能把每日不重複會員數相加；同一會員兩天出現會算兩次。要回到可去重的明細，或採經驗證的跨日統計方法。

在 SQL 練習場選 `shop`。1 月 13 日只有 1 單，1 月 14 日有 2 單；查查看兩天單量和金額。這組樣本每張已付款單都有明細；正式環境若缺品項，需要另出異常，不可讓內連接掩蓋。

```sql
SELECT o.order_date AS sales_day, COUNT(DISTINCT o.order_id) AS paid_orders,
       SUM(i.qty * i.unit_price) AS gross_amount
FROM orders o JOIN order_items i USING (order_id)
WHERE o.status = 'paid' AND o.order_date BETWEEN DATE '2026-01-13' AND DATE '2026-01-14'
GROUP BY o.order_date ORDER BY sales_day;
```

若只存日客單價，就會忘記哪天是用 1 單、哪天是用 2 單算的。日彙總存可重新合成的數字，能用手算核對短區間。遇上空窗口怎麼報，之後在[〈空集合與預期零值〉](#/lesson/sq-audit-05)會把沒發生和沒收到分開。

## 利用兩個不相等的日樣本驗算

手算一個最小例：第一天一張單 100 元，第二天兩張單共 400 元。每日客單價是 100 與 200 元，直接平均得到 150 元；兩日全部是 500 元除以 3 張單，約 166.67 元。這不是小數捨入誤差，而是把「日」錯當成每張訂單等權重。交接時讓彙總表保有兩欄原始度量，另外標一列時間範圍，讓報表換成週粒度時仍從同一份可重算的數字出發。

若同一份日表要加上城市，先問城市屬於訂單還是會員，也要重寫一列的粒度，不能在原查詢隨手加欄。只有各組互不重疊且定義一致的度量才可安全相加。

## 常見錯誤

- 客單價變小 → 以品項列數當訂單數 → 先按單聚合或對訂單鍵計數去重。
- 跨日結果與重算不同 → 做了每日比率的平均 → 加總分子和分母再相除。
- 兩張報表各有一套付款篩選 → 把業務口徑寫到 ADS 各處 → 回到 DWD 或 DWS 的共用定義。

## 方言與面試

在 DuckDB 和 Spark SQL，`/` 提供非整數除法；MySQL 的 `DIV` 則只留整數。搬到 PostgreSQL 時若兩側整數，先轉小數型別。不要等顯示時才補小數點：在除完才轉型無法找回已截斷的數字。
