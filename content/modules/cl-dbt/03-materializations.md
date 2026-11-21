---
id: cl-dbt-03
module: cl-dbt
order: 3
title: 物化策略
subtitle: 何時用視圖何時寫成表
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-02
objectives:
- 比較視圖、表、內嵌與增量的讀寫成本
- 將本機付費日報由視圖改成表並查驗其型態
- 用來源變化測出視圖與表在何時反映更新
tags:
- 物化
- view
- table
- ephemeral
- incremental
resources:
- title: dbt：物化策略
  url: https://docs.getdbt.com/docs/build/materializations
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 比較 view、table、ephemeral 與 incremental。
concepts:
- id: cl-dbt-03-view
  prompt: 若本課日報是普通 view，新增來源數據後何時看見變化？
  answer: 在來源提交且下次查詢視圖時；普通視圖保存邏輯而非預先寫好的結果。
  mcq:
    options:
    - 每小時自動重建
    - 下次查詢時能反映來源提交的數據
    - 只在 full refresh 時
    - 永遠不會改
    answer: 1
    explain: 表需要重建或更新，普通 view 通常在讀取時算，不是每小時自動排程。
- id: cl-dbt-03-table
  prompt: 用 table 物化熱門日報有何交換？
  answer: 多花建置時間與儲存，通常減少重複查詢時計算，並有上一次發布的更新邊界。
  mcq:
    options:
    - 讀寫都保證比 view 快
    - 不需要儲存結果
    - 數據會每秒自動更新
    - 把部分成本從讀取移到建置
    answer: 3
    explain: 不是保證更快或更實時。建置與讀取要分開計量。
  interview:
    question: 主管說把所有模型改成 table 才會快，你會怎麼回應？
    answer: 我會先看重複讀取最貴的是哪一段，把熱門日報選一張試做 table，比對讀取時間、建置時間和可接受的新鮮度。暫存模型若很薄，不一定值得每次另外寫一份。
    points:
    - 用真實負載尋找瓶頸
    - 說明新鮮度代價
    - 指出不是統一選型
- id: cl-dbt-03-ephemeral
  prompt: 中間模型不獨立查閱且只給少數模型重用，可以先試哪個？
  answer: ephemeral 會把 SQL 內嵌進下游，省一個獨立數據庫物件。
  mcq:
    options:
    - table
    - incremental
    - ephemeral
    - 普通 view
    answer: 2
    explain: 只有 ephemeral 不獨立落地；代價是難以單查與可能在多個下游重複計算。
- id: cl-dbt-03-incremental
  prompt: 哪種情況才值得做增量物化？
  answer: 全量重建成本已成問題，而且能辨認變更的輸入與對應輸出鍵，並驗證重跑及晚到。
practice:
- id: cl-dbt-03-p1
  kind: sql
  category: [dbt, select]
  title: 定義應物化的付款明細
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    取 1009–1013 號已付訂單（含兩端），依序輸出 `order_id`、`line_no`、`line_amount`（成交單價乘件數），按訂單鍵、行號升序。只交查詢，不提交 CREATE。
  solution: |
    SELECT i.order_id, i.line_no, i.qty * i.unit_price AS line_amount
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.order_id BETWEEN 1009 AND 1013 AND o.status = 'paid'
    ORDER BY i.order_id, i.line_no;
  explain: |
    先定義結果，才決定是否物化；取消單不能由材質或表型態自動移除。
  hints:
  - 連接訂單表取得狀態
  - 別丟掉行號
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-03-view
  - cl-dbt-03-table
  - sq-model-02-line-key
  tags:
  - 物化
  - view
- id: cl-dbt-03-p2
  kind: sql
  category: [dbt, aggregate]
  title: 驗算彙總物化前的數字
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    依 `order_date` 彙總 1009–1013 號訂單的已付明細。依序輸出 `order_date`、`paid_orders`（不同訂單數）、`gross_amount`，依日期升序，沒有已付明細就不出列。
  solution: |
    SELECT o.order_date, COUNT(DISTINCT o.order_id) AS paid_orders,
           SUM(i.qty * i.unit_price) AS gross_amount
    FROM orders o JOIN order_items i ON i.order_id = o.order_id
    WHERE o.order_id BETWEEN 1009 AND 1013 AND o.status = 'paid'
    GROUP BY o.order_date ORDER BY o.order_date;
  explain: |
    物化前先固定結果；`COUNT(*)` 會數品項，日報若落地就把錯誤保存了。標準去重計數在 Hive SQL、Spark SQL 與 MySQL 也可表達。
  hints:
  - 同日按訂單鍵去重計數，但金額按明細相加
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-03-table
  - sq-model-02-grain
  - sq-model-03-fact
  tags:
  - 物化
  - view
- id: cl-dbt-03-lab
  kind: hands-on
  title: 看見日報的更新邊界
  minutes: 9
  steps:
  - 先跑正文的視圖驗證，再把 fct_daily_orders 改成 table 並建置。
  - 暫時新增 1012，查看日報仍保留原值；重建後再查。最後清掉練習單並重建。
  checks:
  - 第一次結果表型態是 VIEW；改成實體後是 BASE TABLE。
  - 1012 在重建後會讓 1 月 18 日從 1 單變成 2 單；復原後回到 1 單。
---

## 決定把計算留在哪一刻

一個日報查詢每天被看 200 次，但來源一天只更新兩次。模型的 `SELECT` 沒變，你可以決定要每次讀都算，還是先存一次成品。物化（materialization）指 dbt 將模型輸出落成什麼，以及何時建立、重建或更新它。它改的是保存方式，不是「付款」的定義。

- `view`：保存查詢。一般視圖讀取時依底層現值求結果；適合薄暫存或輸入常變、讀量不高的情況。
- `table`：建置時把結果寫為表，下次查詢可直接讀；適合讀取重複而較重的結果，代價是儲存、建置時間與新鮮度邊界。
- `ephemeral`：不建獨立物件，把模型 SQL 內嵌到引用它的下游；適合小型、少數下游共用、不必獨立檢查的步驟。
- `incremental`：第一次建表，後續更新選定輸出；必須能辨認變更和正確合併。[〈增量模型與唯一鍵〉](#/lesson/cl-dbt-04)會做晚到退款。

基本配置放在模型頂部，形如 `{{ config(materialized='table') }}`。這段由 dbt 解讀，換成 Spark SQL 或 MySQL 不代表有相同的適配器能力；引擎自己的物化視圖也不是此處的普通 `view`。

## 量出可見的差別

在 dbt-shop 根目錄存成 inspect_daily.py，用它追蹤型態與內容：

```python
import duckdb

with duckdb.connect("lab.duckdb", read_only=True) as db:
    print(db.execute("""
        SELECT table_type FROM information_schema.tables
        WHERE table_schema = 'main' AND table_name = 'fct_daily_orders'
    """).fetchall())
    print(db.execute("SELECT * FROM main.fct_daily_orders ORDER BY order_date").fetchall())
```

在 `models/fct_daily_orders.sql` 第一行加上 `{{ config(materialized='table') }}`，再建置。為了演示更新，存 `change_order.py`；只碰本課未使用的 1012：

```python
import sys
import duckdb

with duckdb.connect("lab.duckdb") as db:
    db.execute("DELETE FROM raw.orders WHERE order_id = 1012")
    if sys.argv[1:] == ["add"]:
        db.execute("INSERT INTO raw.orders VALUES (1012, DATE '2026-01-18', 'paid')")
```

```powershell
.\.venv\Scripts\dbt.exe build --select fct_daily_orders --profiles-dir .
.\.venv\Scripts\python.exe change_order.py add
.\.venv\Scripts\python.exe inspect_daily.py
.\.venv\Scripts\dbt.exe build --select fct_daily_orders --profiles-dir .
.\.venv\Scripts\python.exe inspect_daily.py
.\.venv\Scripts\python.exe change_order.py
.\.venv\Scripts\dbt.exe build --select fct_daily_orders --profiles-dir .
```

第一次讀表還是 1 月 18 日 1 單，重建才變成 2 單。用同一腳本比較改動前的視圖，可看見查詢直接反映已提交的來源變化。小樣本證明的是更新邊界；不拿這幾列斷言誰效能更高。

比較時，至少記三個時刻：來源何時改完、模型何時建完、消費者何時讀。第一個和最後一個之間若要保證看到最新值，視圖可以直接讀到已提交來源，表就要安排建置節奏。反過來，管理日報有時希望整天維持同一次關帳結果，這種情況保留固定輸出反而更合適。問「快不快」前先問「應該讀哪一次結果」。

還可以用兩次輸出做對照：若實驗前本機數據和前兩堂一致，兩種物化的已付款列本來相同。新增樣本後才刻意讓更新時點不同。正式測量可用代表性數據比較幾次查詢的耗時和每次建置成本，控制同一輸入、同一算式；若同時改索引或改數據範圍，就不容易知道差別源自何處。

先量一種報表，不必把所有模型一次換成同一物化。若同事需要反查中間關聯，用內嵌會讓查詢除錯繞遠；若模型目前只是重新命名兩欄，另外建一份大表也可能得不償失。讓查詢時間和更新承諾一起決定。

## 常見錯誤

- 後台新單已到、表仍是舊值 → 只更新來源 → 跑模型並揭露發布截止。
- 找不到 ephemeral 對應的表 → 模型只是內嵌 → 查下游編譯 SQL。
- 建表後報表數字換了 → 同時改了查詢口徑 → 先用同一輸入對帳，不混改兩件事。
