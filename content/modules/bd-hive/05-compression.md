---
module: "bd-hive"
id: "bd-hive-05"
order: 5
title: "編碼與壓縮"
subtitle: "省磁碟也要算解壓時間"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-04"
objectives:
  - "說明欄位編碼與壓縮編解碼器分別處理什麼"
  - "在同一批列上比較兩種實體輸出的大小與校驗值"
tags:
  - "dictionary encoding"
  - "RLE"
  - "Snappy"
  - "Zstandard"
resources:
  - title: "Parquet Encodings"
    url: "https://parquet.apache.org/docs/file-format/data-pages/encodings/"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "看字典編碼與重複值如何表示。"
  - title: "Parquet File Format"
    url: "https://parquet.apache.org/docs/file-format/"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "由檔案格式頁理解頁與欄位區塊的關係。"
concepts:
  - id: "bd-hive-05-encoding"
    prompt: "字典編碼如何處理反覆出現的狀態值？"
    answer: "保存少量不同值和各列的代號，再按代號還原原值。"
    mcq:
      question: "paid 重複 1 萬次，字典編碼典型做法是什麼？"
      options:
        - "保存狀態字典及逐列代號"
        - "把數據刪成一列"
        - "將狀態轉成日期分區"
        - "以壓縮比代替原值"
      answer: 0
      explain: "編碼保留每列的值與位置；不是聚合或分區。"
  - id: "bd-hive-05-codec"
    prompt: "編碼與 Snappy 或 Zstandard 是同一層嗎？"
    answer: "不是；欄值編碼改變表示方式，壓縮編解碼器再對位元組壓縮。"
    mcq:
      question: "低基數欄是指什麼？"
      options:
        - "磁碟較小"
        - "每個值都不重複"
        - "不同值的種類很少"
        - "每列必有空值"
      answer: 2
      explain: "低基數講的是不同值數量，不保證缺值或任何壓縮比。"
    interview:
      question: "怎麼回答「Zstandard 一定比 Snappy 好嗎」？"
      points:
        - "同批數據與同佈局"
        - "測檔案位元組、CPU 與讀寫耗時"
        - "看主要瓶頸不盲選"
      answer: "我會用同批輸入與相同檔案配置做對照，確認讀回一致，再比大小、CPU 和多次掃描時間。瓶頸是 CPU 或 I/O 時，選擇可能不同。"
  - id: "bd-hive-05-compare"
    prompt: "為什麼同時改欄排序與壓縮方式不易判讀？"
    answer: "兩個因素都改變表示，無法把體積或耗時差異歸因給其中一個。"
practice:
  - id: "bd-hive-05-lab"
    kind: "hands-on"
    title: "留下兩種編解碼器的比較紀錄"
    minutes: 10
    steps:
      - "存成 codecs.sql 後在 WSL 以 hive_lab.py 執行"
      - "用 find 與 wc 記下兩種檔案大小"
      - "同批重試可比較兩次大小，時間只作觀察"
    checks:
      - "兩份都為 40000 列且 checksum 為 799980000"
      - "紀錄的大小來自 Parquet 檔，不把整個中繼庫算進去"
  - id: "bd-hive-05-p1"
    kind: "sql"
    category: [distinct]
    title: "盤點反覆出現的訂單狀態"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "輸出 `row_count`、`distinct_status` 各一欄、欄序照此，共 1 列；前者為 `orders` 的列數，後者為不同非 NULL 的 `status` 數。"
    solution: "SELECT COUNT(*) AS row_count, COUNT(DISTINCT status) AS distinct_status FROM orders;"
    explain: "兩個數用來判斷重複程度，不能把其比值當壓縮比；還有字典開銷、其他欄與壓縮方式。`COUNT(status)` 不是不同值數。"
    hints:
      - "同一個 SELECT 裡寫兩種計數"
    check:
      ordered: false
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-05-encoding"
      - "sq-group-05-entity"
      - "sq-group-01-rows"
    tags:
      - "基數"
      - "編碼"
---

## 先縮小表示，再壓縮位元組

訂單狀態若只有 `paid`、`cancelled`，每列重複存完整文字未必合算。字典編碼（dictionary encoding）保存「代號 0 是 paid、1 是 cancelled」，再為每列保存代號。遊程編碼（run-length encoding，RLE）則善用連續重複：若連續 40 個值一樣，可把同值和次數寫成一段。重複很多但交錯出現，字典仍可能有用，連續段就不一定長。每列幾乎都不同時，另存字典反而有負擔。

壓縮（compression）是另一層：欄值完成編碼後，再用編解碼器（codec）如 Snappy、Zstandard 壓縮位元組。兩層最後都須能無損還原。較小的檔案通常省磁碟與傳輸量，但編碼、壓縮和還原需要 CPU。若查詢其實已經在等 CPU，就算檔案更小，結果不一定更快。實務還要核對讀取器能否讀，以及設定對既有檔案是否生效；更改表設定不會重編碼歷史檔案。

## 先控制變因，再看大小

以下用 **Spark SQL** 寫同一批 4 萬列、同樣 1 個輸出分區，只更換 Parquet 的 `OPTIONS (compression '…')`。在 WSL 的 `bd-hive` 目錄存為 `codecs.sql`，執行 `.venv/bin/python hive_lab.py codecs.sql`，預留 3 GB RAM。兩張表只給本堂使用；重跑會替換這兩張表的內容。
```spark-sql
CREATE OR REPLACE TEMP VIEW codec_src AS
SELECT id, CASE WHEN id < 20000 THEN 'paid' ELSE 'cancelled' END AS status
FROM range(0, 40000, 1, 1);
CREATE TABLE IF NOT EXISTS lab_snap (id BIGINT, status STRING)
USING PARQUET OPTIONS (compression 'snappy');
CREATE TABLE IF NOT EXISTS lab_zstd (id BIGINT, status STRING)
USING PARQUET OPTIONS (compression 'zstd');
INSERT OVERWRITE TABLE lab_snap SELECT id, status FROM codec_src;
INSERT OVERWRITE TABLE lab_zstd SELECT id, status FROM codec_src;
SELECT COUNT(*) AS rows_n, SUM(id) AS checksum FROM lab_snap;
SELECT COUNT(*) AS rows_n, SUM(id) AS checksum FROM lab_zstd;
```
在同一資料夾讀兩種表的檔案大小：
```bash
find warehouse/lab_snap warehouse/lab_zstd -name '*.parquet' -exec wc -c {} +
```

兩份應都是 40000 列、識別碼加總為 799980000。大小只記實測值，不預先承諾誰更小。若進一步比速度，先暖機、交錯測試順序、重跑數次、用原始欄做相同工作；別用能由中繼數據直接回答的查詢當解壓基準。當日報只讀某一欄時，該欄的壓縮效果也比整個檔案的小數點差距更接近體感。

### 練習先預測、再記反例

想像同一欄有一萬筆：第一份整段用相同狀態，第二份讓兩種狀態交替。不同值的種類都一樣，但連續重複的長度不同。再換成一萬個不同的隨機識別碼，字典會變大，每列的代號也要保留；寫入器可能改選其他編碼。由這三份想像輸入判斷「低基數」和「長連續段」不是同一件事。

比較檔案時，記一個最小的實驗紀錄：輸入條件、欄位和列數、寫出方式、兩份檔案的總位元組和讀回校驗。大小差可寫成「一個編解碼器比另一個少多少位元組」；請不要寫成「比原始 CSV 壓縮多少」除非實際量過同一批 CSV。若大小接近，不必硬挑贏家，選下游相容且維護簡單的方式，再等真實工作量裁決。

跨引擎交接還要問讀取器會不會載入所有欄，是否發生讀檔瓶頸，以及 CPU 能否負擔更重的壓縮。對冷歷史檔與頻繁重寫的當日檔，答案可以不同；先保留一份可回復的未重寫版本。

## 常見錯誤

- 不同列數仍比較檔案大小 → 測到的是不同內容 → 先核對列數與校驗。
- 壓縮比當掃描速度 → 忽略 CPU 與讀取條件 → 分開記位元組和耗時。
- 照搬 Spark 選項進 Hive → 兩者設定名不必相同 → 查對應引擎和檔案格式。
