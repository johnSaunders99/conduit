---
id: bd-bench-03
module: bd-bench
order: 3
title: 掃描量與裁剪
subtitle: 查一個月只該讀哪些檔案
status: ready
minutes: 35
level: 3
prereqs:
  - bd-bench-02
objectives:
  - 用日期分區條件縮小候選檔並比對結果
  - 分開說明分區裁剪、列群組裁剪及欄位裁剪
tags:
  - Parquet
  - 分區裁剪
  - 掃描量
  - 謂詞下推
resources:
  - title: Apache Parquet：檔案格式
    url: https://parquet.apache.org/docs/file-format/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看列群組、欄位區塊與檔尾的位置。
  - title: Apache Spark：效能調校
    url: https://spark.apache.org/docs/latest/sql-performance-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看檔案開啟成本和掃描分區設定。
concepts:
  - id: bd-bench-03-levels
    prompt: 只選 amount，與 WHERE month = 2，分別裁掉什麼？
    answer: 第一個縮小欄位讀取；第二個若能對應分區，先排除整個無關分區。
    mcq:
      options:
        - 兩者只會排除欄位
        - 前者減欄、後者可排分區
        - 前者排整檔、後者必須掃完
        - 兩者只影響輸出欄名
      answer: 1
      explain: 選欄與選檔是不同層次。
  - id: bd-bench-03-bounds
    prompt: 2 月查詢使用哪個區間容易核對且不誤納 3 月？
    answer: 起點包含 2 月 1 日、終點不含 3 月 1 日。
    mcq:
      options:
        - ">= 2 月 1 日且 < 3 月 1 日"
        - "> 2 月 1 日且 <= 3 月 1 日"
        - 只比日期大於 2 月 1 日
        - 只比字串以 02 開頭
      answer: 0
      explain: 半開窗口避免漏第一天與誤納下一月。
  - id: bd-bench-03-evidence
    prompt: 輸出 1 列，能證明只掃很少檔嗎？
    answer: 不能；應比實際掃描檔數、列群組或讀取位元組，並看計畫。
    mcq:
      options:
        - 能，只輸出 1 列必然只開 1 檔
        - 能，總計只需記一個數
        - 不能，要看掃描證據
        - 只要加 LIMIT 就能證明
      answer: 2
      explain: 聚合能把全表變 1 列，輸出量不等於讀取量。
    interview:
      question: 2 月查詢慢，怎麼判斷是分區沒裁還是檔裡讀太多欄？
      points:
        - 先分開候選檔與欄
        - 找執行計畫、檔數和 bytes
        - 改單一條件且保持結果相同
      answer: 我先看實際開檔數是否涵蓋其他月份，再看讀了幾個欄和多少位元組。用同一日期窗口和結果，只改一個條件重跑，以免把掃描減少和少算訂單混在一起。
practice:
  - id: bd-bench-03-p1
    kind: hands-on
    title: 保存分區裁剪前後的計畫
    minutes: 12
    steps:
      - 依本文將 lab.sql 跑在 WSL 2 的 DuckDB CLI，保存兩次讀取計畫。
      - 記下兩個查詢的總額、看到的候選／掃描檔數，以及環境是否提供讀取位元組。
    checks:
      - 原始及分區過濾都應為 95 元。
      - 本例建立 3 個月份分區；有檔案裁剪時應只掃 2 月。沒有 bytes 時不拿檔案大小冒充實際讀取。
  - id: bd-bench-03-p2
    kind: sql
    category: [time, reconcile]
    title: 核對 2 月的已付款訂單
    minutes: 6
    dataset: shop
    prompt: |
      在 `orders` 計算 2026 年 2 月的已付款訂單數。只納入 `status = 'paid'`；依 `order_date` 左含右不含篩選。只輸出一欄 `paid_orders`，一列，不需排序。
    solution: |
      SELECT COUNT(*) AS paid_orders FROM orders
      WHERE status = 'paid' AND order_date >= DATE '2026-02-01'
        AND order_date < DATE '2026-03-01';
    explain: |
      這個範圍包含 2 月 1 日，不含 3 月 1 日。不要只取日號，也不要把 `BETWEEN` 的上界設為 3 月 1 日。應用內數據集未分檔，這題只驗口徑，不驗裁剪；Hive 或 Spark 的實體裁剪要看分區設定與計畫。
    hints:
      - 先寫起點含、終點不含的 2 個條件。
    check:
      ordered: true
      columnNames: true
    concepts:
      - bd-bench-03-bounds
      - sql-range-bound
      - sq-group-01-rows
    tags:
      - 日期篩選
      - 基準對帳
---

## 查 2 月，只要排除 1 月和 3 月是不夠的

數據放成 `mo=1`、`mo=2`、`mo=3` 之後，查詢可先透過路徑分區值排除其他月份；這叫分區裁剪（partition pruning）。進到某個 Parquet 檔後，還能用列群組的最小、最大值排除不符合條件的群組；這是謂詞下推（predicate pushdown）可以利用的方式。欄位裁剪（column pruning）則只讀計算需要的欄。三者可以同時出現，但所有條件都要在正確的邏輯結果下比較。目錄命名不是數據本身的正確性保證；若 3 月真的被寫到 2 月路徑，先修寫入規則。

## 一份固定樣本，兩種讀取方式

Windows 用 WSL 2 進 `/mnt/c/dev/conduit-lab/bench`。需 DuckDB CLI、可用 RAM 1 GB；不開 Spark 或 Hive。為避免碰到上次的檔案，先建立一個尚不存在的子資料夾 `scan-run` 並切進去，重做另開新資料夾。在該處存 `lab.sql`。其中 `mo` 是產出後從路徑讀回的分區欄；`business_date` 仍是檔內完整日期。日期查詢用左含右不含，追加 `mo = 2` 讓引擎可直接以分區值排除候選。

```sql
COPY (SELECT * FROM (VALUES
    (1, DATE '2026-01-31', 10),
    (2, DATE '2026-02-01', 35),
    (2, DATE '2026-02-28', 60),
    (3, DATE '2026-03-01', 90)
) AS v(mo, business_date, amount))
TO 'monthly' (FORMAT PARQUET, PARTITION_BY (mo));

CREATE TEMP VIEW orders_scan AS
SELECT * FROM read_parquet('monthly/*/*.parquet', hive_partitioning = true);

SELECT SUM(amount) AS total FROM orders_scan
WHERE business_date >= DATE '2026-02-01' AND business_date < DATE '2026-03-01';

SELECT SUM(amount) AS total FROM orders_scan
WHERE mo = 2 AND business_date >= DATE '2026-02-01'
  AND business_date < DATE '2026-03-01';

EXPLAIN ANALYZE SELECT SUM(amount) FROM orders_scan
WHERE business_date >= DATE '2026-02-01' AND business_date < DATE '2026-03-01';

EXPLAIN ANALYZE SELECT SUM(amount) FROM orders_scan
WHERE mo = 2 AND business_date >= DATE '2026-02-01'
  AND business_date < DATE '2026-03-01';
```

```bash
duckdb :memory: < lab.sql > scan-plan.txt
```

查看 `scan-plan.txt`。兩個總額都是 95。找掃描節點的檔案過濾或開檔計數，名稱依版本而異。即使第一條可用檔內統計少讀列，第二條仍表達了可直接用目錄排除的條件。把「候選檔」、「實際開檔」與「實際讀取位元組」分開記錄；三者不是同一數字。DuckDB 是這裡的實驗引擎，並未建立 Hive Metastore。

## 讀計畫時，對照的是一層一層的證據

先確認讀入口的路徑真的代表 3 個月份；再看有沒有對 `mo` 的檔案過濾，最後看掃描節點用了哪幾個數據欄。第一個查詢即使需嘗試 3 個檔，也可能用 `business_date` 的統計避免解碼不合時段的列群組；第二個會在讀檔前就排除兩個路徑。兩者輸出都只是一個金額；報表的列數在這裡完全不能說明掃描量。原版若節省了解碼，額外目錄裁剪仍可能受益，但小樣本的時間差不代表正式表一定快。

再做一個反例：複製原本的腳本到新的執行資料夾，把 2 月 28 日那列的 `mo` 改成 3，保留日期和值。此時只按業務日期仍讀出 95，但加分區限制只剩 35；並不是裁剪把對的數據刪了，而是寫入沒有滿足「月份分區應等於日期月份」的契約。把反例寫進驗收：如果排除分區後結果變了，先停，追哪批把列放錯，別用看起來更快的方案蓋住數據錯誤。

報告可以以「檔案數 3→1、總額相同」收尾，前提是你確實在計畫看見該數字；沒有工具提供位元組時，不自行補一個。反例真的改變總額時，則明寫哪一列路徑錯了。

## 常見錯誤
- 看到計畫輸出 1 列就說掃描少 → 聚合已縮成 1 列 → 看掃描節點。
- 2 月漏了午夜的列 → 用錯日期終點或時區 → 用同一時區的半開窗口。
- 比較時順手少選了欄位 → 混入投影裁剪效果 → 保持彙總與輸出不變。
