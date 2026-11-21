---
module: "bd-hive"
id: "bd-hive-02"
order: 2
title: "Hive SQL 與分區裁剪"
subtitle: "只讀昨天的訂單"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-01"
objectives:
  - "比較有無日期條件的掃描計畫"
  - "寫出保留日期分區欄的等值條件並核對日報口徑"
tags:
  - "分區裁剪"
  - "PartitionFilters"
  - "日期分區"
  - "EXPLAIN"
resources:
  - title: "Hive DDL Manual"
    url: "https://hive.apache.org/docs/latest/language/languagemanual-ddl/"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 PARTITIONED BY，分清一般欄與分區欄。"
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀查詢計畫與實際統計的觀測方式。"
concepts:
  - id: "bd-hive-02-prune"
    prompt: "分區裁剪省在哪裡？"
    answer: "掃描前排除不相關的分區目錄，使讀取不必先打開每個日期的數據檔。"
    mcq:
      question: "dt 是日期分區欄，要查一天，哪條件最直接表達裁剪？"
      options:
        - "dt = DATE '2026-01-02'"
        - "amount > 100"
        - "ORDER BY dt"
        - "LIMIT 1"
      answer: 0
      explain: "直接限制分區欄；篩金額、排序和列數上限都沒指定該目錄。"
  - id: "bd-hive-02-plan"
    prompt: "結果正確，如何驗證真的發生裁剪？"
    answer: "看引擎的分區過濾或實際讀取檔數，和無條件的對照計畫比較。"
    mcq:
      question: "兩個查詢都得到 1 列，哪個證據才支持掃描範圍更小？"
      options:
        - "列數相同"
        - "結果有欄名 dt"
        - "有日期分區過濾，且掃描指標顯示讀檔更少"
        - "第二次碰巧較快"
      answer: 2
      explain: "輸出列與速度都可能受其他因素影響；計畫與讀取指標才接近機制。"
    interview:
      question: "Hive 日報只查一天卻掃整個月，你怎麼查？"
      points:
        - "看實際分區欄與型別"
        - "比較 EXPLAIN 與讀取指標"
        - "直接限制分區欄並核對業務日期"
      answer: "我先查表是不是按 dt 分區，再看計畫能否從條件推出 dt 的範圍。如果只對事件時間做運算，我會補安全的分區條件，保留業務時間過濾，最後比對讀檔數和日報。"
  - id: "bd-hive-02-boundary"
    prompt: "分區日期是接收日，事件時間是發生日；可否只讀發生日同名路徑？"
    answer: "不能直接保證。跨日到達可能存在，必須先確定完整掃描邊界，再用事件時間篩數據。"
  - id: "bd-hive-02-pushdown"
    prompt: "檔案內過濾和日期分區裁剪能分別省什麼？"
    answer: "分區裁剪跳過目錄；檔案內條件有機會少讀檔案中不符合的數據。"
    mcq:
      question: "哪些日期目錄可以略過，是哪個階段要先回答的？"
      options:
        - "結果排序"
        - "聚合小計"
        - "分區裁剪"
        - "追加退款"
      answer: 2
      explain: "先縮小日期目錄，和打開檔案後的篩列不同。"
practice:
  - id: "bd-hive-02-lab"
    kind: "hands-on"
    title: "保存一對掃描計畫"
    minutes: 10
    steps:
      - "把正文存成 layout_days.sql 並用 hive_lab.py 執行"
      - "在兩個計畫圈出 PartitionFilters"
      - "記下有日期條件的結果列數"
    checks:
      - "沒有條件的查詢沒有指定日期分區"
      - "有條件時出現 dt 等值過濾，結果 1 列"
  - id: "bd-hive-02-p1"
    kind: "sql"
    category: [time, aggregate]
    title: "只算指定日的已付款訂單"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "只統計 2026-01-18 已付款訂單。輸出 `order_date`、`paid_orders`，依此欄序；只需該日 1 列。"
    solution: |
      SELECT order_date, COUNT(*) AS paid_orders
      FROM orders
      WHERE order_date = DATE '2026-01-18' AND status = 'paid'
      GROUP BY order_date;
    explain: "日期與付款條件各管一層，缺任一條件就改變口徑。DuckDB 的共享表沒有 Hive 分區目錄；在 Spark/Hive 要看計畫驗證裁剪。"
    hints:
      - "先限制正確的日期"
      - "付款條件用 AND 疊加"
    check:
      ordered: false
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-02-prune"
      - "sq-read-02-filter"
      - "sq-group-03-key"
    tags:
      - "日期過濾"
  - id: "bd-hive-02-p2"
    kind: "sql"
    category: [time]
    title: "兩天對帳，不含右邊界"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "只查 `order_date` 自 2026-01-18（含）至 2026-01-20（不含）的訂單，包含取消單。每個營業日一列，輸出 `order_date`、`order_count`，按 `order_date` 升序。"
    solution: |
      SELECT order_date, COUNT(*) AS order_count FROM orders
      WHERE order_date >= DATE '2026-01-18' AND order_date < DATE '2026-01-20'
      GROUP BY order_date ORDER BY order_date;
    explain: "以左閉右開把相鄰批次接在一起；`BETWEEN` 會包含右端。若實際分區欄是字串，在 Hive/Spark 先確認格式和型別，不依賴隱式轉型。"
    hints:
      - "限制兩個邊界，而非 BETWEEN"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-02-prune"
      - "bd-hive-02-boundary"
      - "sq-read-02-edge"
    tags:
      - "分區範圍"
---

## 先縮小要找的目錄

值班查昨天的訂單，卻發現掃了整個月。按營業日期分區的表好比每天各放一個目錄：`dt=2026-01-01/`、`dt=2026-01-02/`。分區欄（partition column）描述數據在哪一組目錄，查詢若能在讀檔前判斷只需要其中一組，便可不掃其他分區。這個步驟叫分區裁剪（partition pruning；亦稱分區剪枝）。它和讀完檔案後才丟掉不合條件的列不同。

![日期條件先選目錄，非日期條件再篩列](assets/bd-hive-pruning.svg)

以一個日期分區都含 `order_id`、`amount` 為例，只知道 `amount > 100`，不能從日期目錄名推出要讀哪天；直接寫 `dt = DATE '2026-01-02'` 才把日期告訴掃描層。查兩天可寫 `dt >= DATE '2026-01-02' AND dt < DATE '2026-01-04'`。若分區欄是 `STRING` 而非 `DATE`，以文件約定的字串格式比較。使用函式包住欄位不一定就無法裁剪，但引擎能否把條件轉回目錄值，要看計畫，不要猜。

## 看計畫，不只看結果列數

`EXPLAIN`（執行計畫）描述引擎打算怎麼讀與算。Spark SQL 檔案掃描常把 `PartitionFilters` 與數據檔上的過濾分開列出。有分區條件，是引擎能依此縮小範圍的證據；想知道實際開了幾個檔，再看 Spark UI 的掃描指標。Hive 的計畫名稱和顯示位置不同，不必硬找 Spark 的字樣。兩次輸出筆數一樣，只能保證看到的結果，不能告訴你讀了多少檔。

用上一堂的 WSL `bd-hive` 目錄與 `hive_lab.py`，預留 3 GB RAM。以下 **Spark SQL** 存成 `layout_days.sql`，執行 `.venv/bin/python hive_lab.py layout_days.sql`。`PARTITIONED BY (dt)` 定義分區，`INSERT OVERWRITE` 此處只重建本堂專用表的兩筆數據。
```spark-sql
CREATE TABLE IF NOT EXISTS lab_days (order_id INT, amount INT, dt DATE)
USING PARQUET PARTITIONED BY (dt);
INSERT OVERWRITE TABLE lab_days VALUES
(101, 80, DATE '2026-01-01'), (102, 120, DATE '2026-01-02');
EXPLAIN SELECT order_id FROM lab_days;
EXPLAIN SELECT order_id FROM lab_days WHERE dt = DATE '2026-01-02';
SELECT order_id FROM lab_days WHERE dt = DATE '2026-01-02';
```

第二個計畫應額外含日期條件，結果是 102。解釋時也要先問「日期是什麼」：若 `dt` 是上傳日，而日報用的是付款日，晚到的付款可能在隔天分區。依允許的延遲選一個完整分區範圍，再以付款時間篩列；不要為了少讀，把定義悄悄換成上傳日。相關實時例子見[〈事件時間與處理時間〉](#/lesson/bd-flink-02)。

### 兩行計畫代表兩種資訊

看到日期條件時，回頭用檔案位置驗證：同一張表兩筆數據位於不同日期路徑，條件只落在其中一個目錄。計畫上若另外出現金額條件，那是檔案讀取器或其上方的列過濾，不代表金額也成了路徑。用關掉日期條件的對照計畫，就能把「少讀一個日期」與「只輸出一列」拆成兩個觀察。

若查詢必須讀一個月的日期分區，逐日篩選不一定更省：拆成三十個應用也可能增加啟動和管理成本。先問報表實際需要哪幾天，再比較單次掃描的檔案大小、並行程度和結果，不為了讓計畫出現某個字就重寫。遇到原本是分區但計畫沒出現日期過濾時，查表結構、型別和日期運算三處，再用同一張表重試。

## 常見錯誤

- 看見 WHERE 就認為會裁剪 → 條件不一定涉及分區欄 → 看計畫中分區過濾。
- 月底少一天 → 輸入範圍與右邊界含不含不同 → 明寫兩端且驗邊界。
- 硬裁成單一付款日 → 按上傳日切檔且有晚到 → 同時檢查分區範圍和業務時間。
