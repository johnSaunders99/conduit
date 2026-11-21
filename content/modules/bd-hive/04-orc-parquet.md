---
module: "bd-hive"
id: "bd-hive-04"
order: 4
title: "ORC 與 Parquet"
subtitle: "挑三欄比較掃描量"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-03"
objectives:
  - "用圖說明欄投影與列群組跳讀的差別"
  - "為兩種輸出核對格式、結果和計畫的讀取欄位"
tags:
  - "列群組"
  - "stripe"
  - "投影下推"
  - "欄式儲存"
resources:
  - title: "Parquet File Format"
    url: "https://parquet.apache.org/docs/file-format/"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看檔案配置圖與 row group、column chunk。"
  - title: "Apache ORC"
    url: "https://orc.apache.org/docs/"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 ORC 的 stripe 及跳讀原理。"
concepts:
  - id: "bd-hive-04-projection"
    prompt: "欄式格式如何讓兩欄報表少讀數據？"
    answer: "欄值分區塊存放，讀取器可只取輸出和過濾所需的欄。"
    mcq:
      question: "輸出 amount，條件用 dt，dt 不是目錄分區欄。至少需哪些欄？"
      options:
        - "只有 amount"
        - "amount 與 dt"
        - "整張表所有欄"
        - "只有 dt"
      answer: 1
      explain: "仍需 dt 判斷是否保留；與其他欄無關。"
  - id: "bd-hive-04-stats"
    prompt: "最小值／最大值如何協助跳過列群組？"
    answer: "若整組的值域不可能符合條件，可不讀該組的數據內容。"
    mcq:
      question: "某一列群組金額介於 20 到 80；條件 amount >= 100，最多可做什麼？"
      options:
        - "把整組算進結果"
        - "刪除來源檔"
        - "略過該列群組"
        - "保證其他組也不用讀"
      answer: 2
      explain: "該組不可能命中；不能推論其他組或修改來源。"
    interview:
      question: "ORC 和 Parquet 都是欄式，怎麼挑？"
      points:
        - "查主要引擎與讀寫路徑"
        - "比較代表查詢的投影、跳讀和壓縮"
        - "驗證同一口徑"
      answer: "我先看哪些引擎要讀寫與它們支援的功能，再用同一批數據及代表性的查詢比讀取量和結果。不會單憑格式名字假設誰快。"
  - id: "bd-hive-04-unit"
    prompt: "ORC stripe 和 Parquet row group 在這堂扮演什麼角色？"
    answer: "都是較大的檔案內列範圍，在各自格式中包含分欄存放的數據與相關描述，不是日期目錄。"
  - id: "bd-hive-04-evidence"
    prompt: "計畫列出過濾下推，能直接知道跳過幾個列群組嗎？"
    answer: "不能；還需執行指標或讀取器診斷，因為可能每個列群組都含可匹配的值。"
    mcq:
      question: "每個列群組的金額範圍均從 1 到 200，條件為 amount >= 100。只靠最小最大值能略過多少組？"
      options:
        - "全部"
        - "沒有一組可由這個條件確定略過"
        - "剛好一半"
        - "只略過金額最大的組"
      answer: 1
      explain: "每個列群組都有可能包含符合的值，因此不能用這項統計跳過。"
practice:
  - id: "bd-hive-04-lab"
    kind: "hands-on"
    title: "保存兩種格式的讀取計畫"
    minutes: 10
    steps:
      - "把正文存成 columnar.sql，在 WSL 用 hive_lab.py 執行"
      - "記下兩份計畫的 ReadSchema 與 PushedFilters"
      - "核對兩份結果相同，記下沒有讀取的 debug_note"
    checks:
      - "兩份都回傳 102、120"
      - "只取所需欄，沒有把 debug_note 加入讀取欄清單"
  - id: "bd-hive-04-p1"
    kind: "sql"
    category: [select, plan]
    title: "查詢必要欄，不交付庫存"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "找出 `products` 中 `price >= 60` 的商品，只輸出 `product_id`、`price`，依此欄序，按 `product_id` 升序。"
    solution: "SELECT product_id, price FROM products WHERE price >= 60 ORDER BY product_id;"
    explain: "`SELECT *` 會交付不必要欄位。這題只驗輸出及 60 元端點；共享 DuckDB 表不證明 ORC 或 Parquet 做了投影下推。"
    hints:
      - "先確定輸出欄清單，再寫篩選下界"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-04-projection"
      - "sq-read-01-projection"
      - "sq-read-02-edge"
    tags:
      - "投影"
---

## 讀報表不用搬走整張表

訂單每列有金額、商品編號、備註、運送地址等欄，這次營運只要「哪些訂單超過 100 元」。若檔案逐列交錯存放所有欄，讀取器可能要解讀許多不需要的內容。欄式儲存（columnar storage）先取一段列，再把這段中各欄值分別放在一起；引擎便可選取需要的欄。只取指定欄的操作叫投影（projection），能讓讀取器少讀欄位時稱投影下推（projection pushdown）。

![先跳過不可能匹配的列群組，再讀需要的欄](assets/bd-hive-columnar.svg)

Parquet 將檔案拆成列群組（row group），每個列群組內有各欄的欄位區塊（column chunk）；ORC 的條帶（stripe）也在一段列內分欄組織，不等同於 Parquet 每個內部層級。兩種都可利用統計資訊跳讀，但單位、索引、寫入設定和讀取器支援不相同。當某組金額最大只有 80 時，讀取器若能用最小值／最大值，就可跳過整組。若多數組的金額都從 1 跨到 200，它就不能靠這個條件排除那些組。這叫過濾條件下推（predicate pushdown）的一種用途；計畫列出下推條件，不等於數據組真的被跳過。

## 同一批小數據，兩種格式

在 WSL 的 `bd-hive` 目錄存 `columnar.sql`，用 `.venv/bin/python hive_lab.py columnar.sql` 執行，預留 3 GB RAM。此為 **Spark SQL**，用兩張練習表觀察計畫，不用這麼小的樣本測讀取速度。
```spark-sql
CREATE TABLE IF NOT EXISTS lab_pc (order_id INT, amount INT, debug_note STRING) USING PARQUET;
CREATE TABLE IF NOT EXISTS lab_oc (order_id INT, amount INT, debug_note STRING) USING ORC;
INSERT OVERWRITE TABLE lab_pc VALUES (101,80,'alpha'),(102,120,'beta');
INSERT OVERWRITE TABLE lab_oc SELECT * FROM lab_pc;
EXPLAIN SELECT order_id, amount FROM lab_pc WHERE amount >= 100;
EXPLAIN SELECT order_id, amount FROM lab_oc WHERE amount >= 100;
SELECT order_id, amount FROM lab_pc WHERE amount >= 100;
SELECT order_id, amount FROM lab_oc WHERE amount >= 100;
```

兩份都應回傳 `102, 120`。在檔案掃描中找讀取欄位與過濾資訊，預期不需讀備註。再想像輸出只剩 `order_id`，條件仍用 `amount`：金額可能仍要讀，因為要判斷哪些列入選。分區裁剪解的是「哪些目錄」，統計跳讀是「檔案內哪些組」，投影是「哪些欄」，不是三種互相替代的設定。

### 小例子讀機制，大樣本才讀成本

磁碟上的總大小相同時，仍可能一種只需讀兩個欄位區塊，另一種因讀取路徑不同而得讀更多。相反，即使計畫只要兩欄，過小的檔案仍要逐一開啟；所以欄式格式不會自動解掉小檔成本。要接到生產，量同一日期範圍的已讀位元組、實際讀檔及耗時，再對照欄數和格式設定，而不是只看這次輸出幾列。

拿 100 元這個界線手算：若某列群組最高為 80 可排掉；最低為 120 代表整組符合；若從 80 到 160 就得讀入後篩選。統計數據可能缺失或無法安全用於該比較，讀取器就只能保守地讀取。欄位投影仍可減少其他欄的讀取。確認幾種手算情況再讀計畫，會比記「ORC 用在 Hive」更容易把問題帶到別的引擎。

若團隊一張表同時給兩種引擎使用，還要確認彼此支援的欄型別、壓縮方式及檔案讀法。能開檔不等於兩邊對時間與小數的解釋相同；試一份包含邊界值的業務樣本。

## 常見錯誤

- ORC 與 Parquet 的結果不同 → 先查是否同一批數據與型別 → 對帳後再比格式。
- 計畫列出下推就報告跳過多少列群組 → 計畫未證明實際跳讀量 → 補讀取器指標。
- 只比兩次執行秒數 → 受快取、啟動及樣本量影響 → 先比必讀欄、讀檔及大小。
