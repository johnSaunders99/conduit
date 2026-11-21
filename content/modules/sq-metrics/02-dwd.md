---
id: sq-metrics-02
module: sq-metrics
order: 2
title: DWD 明細數據層
subtitle: 讓一列只做一件事
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-01
objectives:
- 用業務句子定義訂單明細和事件明細的粒度
- 寫出以事件鍵分組且可重現的去重規則
tags:
- DWD
- 明細粒度
- 窗口去重
resources:
- title: DataWorks：數倉分層
  url: https://help.aliyun.com/zh/dataworks/user-guide/data-warehouse-layering
  kind: doc
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 DWD，對照清洗後明細的邊界。
- title: Spark SQL：內建函式
  url: https://spark.apache.org/docs/latest/sql-ref-functions-builtin.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查 row_number 如何按窗口產生次序。
concepts:
- id: sq-metrics-02-grain
  prompt: DWD 訂單行明細的一列代表什麼？
  answer: 一張訂單的一行；用訂單鍵及行號，而不是單獨用訂單號。
  mcq:
    options:
    - 一個會員的所有商品
    - 一天的商品合計
    - 一個 (order_id, line_no)
    - 一筆退款的付款紀錄
    answer: 2
    explain: 口徑要能一眼推回候選鍵。
- id: sq-metrics-02-dedup
  prompt: 事件重送時只 SELECT DISTINCT 整列為何可能不夠？
  answer: 接收 ID 與時間可不同，整列不同但仍是同一事件；應按事件鍵挑列。
  mcq:
    options:
    - 先去掉所有相同接收日期
    - 只按 step 找第一筆
    - 用 MAX(raw_id) 合併每個會員
    - 以 event_id 分組決定保留列
    answer: 3
    explain: 接收層欄位不同不構成新業務事件。
  interview:
    question: 事件重送時你怎麼選留一筆？
    answer: 我先確定 event_id 真能識別同一次行為，再按來源約定的順序挑列；例如先保留最早接收，時間相同用 raw_id 打破並列。有不同有效載荷的衝突另外告警，不假定都是重送。
    points:
    - 確認可信的業務鍵
    - 穩定排序
    - 內容衝突不偷偷刪
- id: sq-metrics-02-cancelled
  prompt: 取消單保留來源明細時，分析用的已付款明細該怎麼生成？
  answer: 按訂單鍵接到單頭，以業務規則篩 paid；不能從金額是否大於 0 判定。
  mcq:
    options:
    - 由 orders 的 status 決定
    - 每筆有價格即為付款
    - 有退款才代表已付款
    - 只保留一行算一張單
    answer: 0
    explain: 來源保留不等於每列都納入某個業務口徑。
practice:
- id: sq-metrics-02-p1
  kind: sql
  category: [model, join]
  title: 建出每個品項的成交明細
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    從 orders 的 1009 至 1012 中只保留 paid，接 order_items，輸出 order_id、line_no、product_id、line_amount（qty × unit_price），依 order_id、line_no 升冪。
  solution: |
    SELECT i.order_id, i.line_no, i.product_id, i.qty * i.unit_price AS line_amount
    FROM orders o JOIN order_items i USING (order_id)
    WHERE o.order_id BETWEEN 1009 AND 1012 AND o.status = 'paid'
    ORDER BY i.order_id, i.line_no;
  explain: |
    1011 雖有品項，仍是取消單，不納入。不能依 order_id 去重，1010 有兩個合法品項。
  hints:
  - 單頭有交易狀態
  - 同單用行號拆開
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-02-grain
  - sq-metrics-02-cancelled
  - sq-db-02-price
  tags:
  - DWD
  - 明細粒度
  - 窗口去重
- id: sq-metrics-02-p2
  kind: sql
  category: [model, distinct]
  title: 每個業務事件只留最早接收
  minutes: 8
  level: 3
  dataset: events
  prompt: |
    只在 raw_id 為 25 至 34 的接收列中，按 event_id 取 received_at 最早的一列；接收時間相同時取 raw_id 較小者。保留 NULL 會話。輸出 event_id、raw_id、session_id、step，依 raw_id 升冪。
  solution: |
    WITH ranked AS (
     SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS rn
     FROM app_events WHERE raw_id BETWEEN 25 AND 34
    )
    SELECT event_id, raw_id, session_id, step FROM ranked WHERE rn = 1 ORDER BY raw_id;
  explain: |
    e110 只留 26；缺會話不等於缺事件。DuckDB 可用 QUALIFY，Spark SQL 與 MySQL 可用帶 ROW_NUMBER 的 CTE 再篩。
  hints:
  - 窗口依 event_id 分組
  - 先排名再保留第一列
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-02-dedup
  - sq-metrics-02-grain
  - sq-metrics-01-raw
  tags:
  - DWD
  - 明細粒度
  - 窗口去重
---

來源層的兩筆 e110 都是真的接收，但報表不應算成兩次瀏覽。另一張訂單有兩個品項，卻確實有兩筆明細。寫 SQL 之前先把「一列是什麼」說出來；否則去重可能把真的業務一起刪掉。

## 明細不是把原始表改個名字

明細數據層（data warehouse detail，DWD）整理成可重用、粒度（grain）穩定的一列。例：已付款品項明細是一張已付款單的一筆品項；事件明細是一個業務事件的一筆。兩者不混在一張表計數。清洗規則應可重跑：依業務鍵選列、固定型別和單位，讓非法數據有去處，而不是在聚合時才將異常默默吞掉。

- 登記粒度與唯一鍵。例如品項鍵是一對訂單號與行號，即使同商品出現兩次也不是重複。
- 決定是否保留某些狀態。原始取消單有明細，但用於「已付款品項」的視圖要按單頭付款狀態篩。
- 保留必要的追查線索。像事件保留原接收 ID 或批次；若拋棄複本，仍能回來源查發生過哪些接收。

## 窗口挑列，要寫明順序

在 SQL 練習場選 `events`。先看 e110 的兩個接收編號；按事件鍵分組，以接收時間加接收 ID 排序。在 CTE（common table expression，暫時命名的查詢結果）內標 `ROW_NUMBER()`，外層才篩第一名；接收時間一樣時仍能確定順序。這個例子應留 26，不是 27。

```sql
WITH ranked AS (
  SELECT event_id, raw_id, received_at,
         ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS rn
  FROM app_events WHERE event_id = 'e110'
)
SELECT event_id, raw_id, received_at FROM ranked WHERE rn = 1;
```

如果兩筆聲稱是同一事件，卻記錄不同會員或業務動作，先列出衝突，不要只用「第一筆」遮蓋。也不要把缺會話當作缺事件；產品可以先留待標記，再決定哪些報表排除。到了[〈DWS 彙總與 ADS〉](#/lesson/sq-metrics-04)才把這些穩定的明細聚合。

## 做兩種驗收，分辨少算與真去重

先挑同一事件的兩個接收編號，驗證篩前 2 筆、篩後 1 筆，對照較早的接收時間。再挑一張有多項商品的已付款訂單，驗證兩行都完整留下。前者確定誤報的事件被合併，後者確定合法的多行沒有被刪除。若要做增量重跑，排序規則需要涵蓋先前接收到的同鍵副本，不是只在今天批次內挑第一。把驗收結果分兩行保存：各有不同的粒度及鍵，不能只報「重複列少了幾筆」。

若上游沒有可信的事件鍵，先協議哪組欄可識別重送，不用看似唯一的接收時間取代。

## 常見錯誤

- 整列 DISTINCT 仍留下 e110 兩筆 → 接收欄位不同 → 依事件鍵排名。
- 重跑時保留的副本換了 → 時間並列沒指定次序 → 再排穩定接收鍵。
- 有兩筆商品的訂單少一筆 → 把訂單號當明細唯一鍵 → 用訂單號和行號驗證。

## 方言與面試

DuckDB 可用 `QUALIFY` 篩窗口計算結果；移植到 Spark SQL 或 MySQL 的通用寫法是先在內層算名次，再到外層篩選，不靠同層 `WHERE` 引用名次別名。能說明何時要隔離衝突、何時是合法多筆，比展示一個 `DISTINCT` 更有說服力。
