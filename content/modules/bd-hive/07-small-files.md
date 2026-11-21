---
module: "bd-hive"
id: "bd-hive-07"
order: 7
title: "小檔案合併"
subtitle: "千個零碎輸出拖慢下一批"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-06"
objectives:
  - "比較合併前後的檔案數、列數與金額"
  - "說明安全發佈前如何保留舊輸出"
tags:
  - "small files"
  - "compaction"
  - "開檔成本"
  - "對帳"
resources:
  - title: "Hive DDL Manual"
    url: "https://hive.apache.org/docs/latest/language/languagemanual-ddl/"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Concatenate，分辨格式限定與表操作。"
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Coalesce Hints 與檔案讀取成本。"
concepts:
  - id: "bd-hive-07-cost"
    prompt: "為什麼內容同樣大，小檔案多仍可能拖慢查詢？"
    answer: "每檔都要列舉、開啟和規劃讀取；在 HDFS 還有檔案與區塊中繼數據成本。"
    mcq:
      question: "報表檔案總量不變，但從 12 個增到 12000 個，先看什麼？"
      options:
        - "把報表日期欄刪除"
        - "提高每筆金額型別精度"
        - "列舉和開檔時間、每日期檔案大小分布"
        - "將所有日期合併為一檔"
      answer: 2
      explain: "症狀支持先查檔案粒度；不能為減檔直接犧牲日期分區與平行讀取。"
  - id: "bd-hive-07-audit"
    prompt: "合併的輸出檔變少了，還要驗證什麼？"
    answer: "至少比同分區列數、數值總額與業務鍵；需要完整證明時比對列及重複次數。"
    mcq:
      question: "同一日期的合併輸出檔數減少但金額差 30，現在應怎麼做？"
      options:
        - "保留原輸出，查明差異再發佈"
        - "先切換，下一批再補"
        - "用較小的列數當目標"
        - "按檔案大小同比調金額"
      answer: 0
      explain: "合併是物理重寫，不允許邏輯數據自行變化。"
    interview:
      question: "Hive 分區每天產生大量小檔，你會怎麼處理？"
      points:
        - "量每分區檔案數及大小"
        - "從寫入平行度與批次頻率找源頭"
        - "用獨立輸出對帳後才切換"
      answer: "我先找小檔集中在哪些日期並檢查寫入粒度。要重寫時先封存同一批輸入、按原分區輸出到別處，驗筆數、金額與鍵，再用支援的提交方式發佈。"
  - id: "bd-hive-07-scope"
    prompt: "為何不把整個表一口氣合併成一檔？"
    answer: "會犧牲分區裁剪及平行能力，也可能讓單一任務成為瓶頸。"
practice:
  - id: "bd-hive-07-lab"
    kind: "hands-on"
    title: "交一張合併前後驗收單"
    minutes: 10
    steps:
      - "在 WSL 用 hive_lab.py 執行 compaction.sql"
      - "計算兩個目錄的實際數據檔個數"
      - "保存檔數、列數、總額，不改來源表"
    checks:
      - "兩邊均為 120 列，總額都是 7140"
      - "compact 目錄檔案少於 tiny 目錄"
  - id: "bd-hive-07-p1"
    kind: "sql"
    category: [reconcile, join]
    title: "寫出合併前的日級控制總額"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "由 `orders` JOIN `order_items`，計算每個有已付款明細的營業日。輸出依序為 `order_date`、`line_count`（明細列數）、`gross_amount`（`qty * unit_price` 合計，未扣退款）；按 `order_date` 升序。"
    solution: |
      SELECT o.order_date, COUNT(*) AS line_count, SUM(i.qty * i.unit_price) AS gross_amount
      FROM orders o JOIN order_items i ON o.order_id = i.order_id
      WHERE o.status = 'paid'
      GROUP BY o.order_date ORDER BY o.order_date;
    explain: "固定粒度為明細，不能把列數當訂單數；也不要 JOIN 退款造成一對多重複。這是重寫前可保存的控制總額，不是完整多重集合證明。"
    hints:
      - "先用訂單鍵配對訂單與明細"
      - "金額先逐列相乘再加總"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-07-audit"
      - "sq-group-07-lines"
      - "sq-join-01-match"
    tags:
      - "對帳"
      - "明細粒度"
---

## 搬一百個小箱子不只算重量

明細表每 5 分鐘落一批，每個寫入任務都可能產檔。日報最後讀到的不是一個大的日期包，而是幾百個小檔。每個檔案都需要列舉、開啟、安排讀取，有些格式還要先讀檔尾的描述；HDFS 還要為檔案與區塊保存中繼數據。總位元組一樣不代表成本一樣。先量每日期的檔案數、中位大小、極小檔的比例，再看掃描是否花在開檔而不是讀大量內容。

合併（compaction）把數據重新寫成較少且合理大小的檔案，不是把內容重新聚合。保留分區邊界可以讓日期裁剪仍有效；保留適當數目的檔案也讓下游有平行讀取空間。先查來源：可能是微批太頻繁、寫入平行度過高，或多個任務同時寫同一日期。治本通常比每天重寫所有歷史便宜。

## 對照同一批數據

在 WSL 的 `bd-hive` 存為 `compaction.sql`，執行 `.venv/bin/python hive_lab.py compaction.sql`，預留 3 GB RAM。這是 **Spark SQL**，`REPARTITION` 提示重分配輸出，`COALESCE` 提示以較少分區寫出；Hive 的 `ALTER TABLE … CONCATENATE` 有表或格式限制，也和交易表的合併不是同一指令。
```spark-sql
SET spark.sql.adaptive.enabled=false;
CREATE TABLE IF NOT EXISTS lab_tiny (order_id BIGINT, amount BIGINT) USING PARQUET;
CREATE TABLE IF NOT EXISTS lab_compact (order_id BIGINT, amount BIGINT) USING PARQUET;
INSERT OVERWRITE TABLE lab_tiny
SELECT /*+ REPARTITION(4) */ id, id FROM range(120);
INSERT OVERWRITE TABLE lab_compact
SELECT /*+ COALESCE(1) */ order_id, amount FROM lab_tiny;
SELECT COUNT(*) AS rows_n, SUM(amount) AS total FROM lab_tiny;
SELECT COUNT(*) AS rows_n, SUM(amount) AS total FROM lab_compact;
```
```bash
find warehouse/lab_tiny -name '*.parquet' | wc -l
find warehouse/lab_compact -name '*.parquet' | wc -l
```

期望兩邊都是 120 列、7140 元；第二個目錄檔案更少。兩個數相同仍可能一筆被另一筆替換；關鍵批次可按業務鍵逐筆比對或比較整個多重集合。真的重寫時，先固定輸入版本與日期，寫到獨立位置，驗收後再依檔案系統或表格式的提交機制切換；同時有人寫入時不要直接用舊快照覆蓋新的數據。表格式如何讓讀者看到一致的一版，見[〈物件檔與表格式〉](#/lesson/bd-lake-01)。

### 對帳表多一欄：能否復原

把練習記錄寫成三部分：舊目錄指向哪一批、候選目錄的對帳結果、哪一個操作能把讀者切回舊輸出。回復不必重新算整批，前提是舊結果還在，且知道誰在讀哪一版。如果只留下新位置，事後發現某個品項漏了，就沒有可重做逐筆比較的基準。

另一個常見壓力是白天和凌晨的寫入相撞。假設清理程式先列出五個舊檔，新任務同時追加第六個檔；若清理完直接以五檔的結果換整目錄，第六個檔可能不再可見。先等該日期寫入收斂，或使用有一致快照與衝突檢查的提交方式。不要將只有一個程序寫入的課內環境安全性推到共有生產路徑上。

是否合併，不只看檔案變少。若合併後同一日期從許多極小檔變成少量可平行掃描的大檔，才更接近目的；若只有一個任務要讀完整天，可能把瓶頸從開檔移到單一工作。

## 常見錯誤

- 一律輸出一個檔 → 大批次變成單任務瓶頸 → 按日期量大小並保留適當平行度。
- 總額對上就清理舊檔 → 可能互相抵銷或無法回復 → 核對鍵及保留回復點。
- 一邊寫一邊手動搬檔 → 讀者可能看到半套輸出 → 用引擎支援的提交機制。
