---
id: bd-ingest-02
module: bd-ingest
order: 2
title: 高水位與增量
subtitle: 同秒更新不能漏單
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-01
objectives:
- 用時間與唯一鍵寫出嚴格遞增的游標條件
- 區分複合游標、回看重疊與 CDC 能保證的事
- 說明何時才可保存本批高水位
tags:
- 高水位
- 複合游標
- 增量
- 同秒更新
resources:
- title: PostgreSQL：唯一約束
  url: https://www.postgresql.org/docs/current/ddl-constraints.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀多欄唯一值及 NULL 的規則。
- title: Debezium：MySQL 連接器
  url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對比來源日誌位置與表欄位游標。
concepts:
- prompt: 時間欄位高水位加上唯一鍵解決什麼問題？
  answer: 同一讀取視圖中，同時戳的不同列有穩定次序，分頁不會因同秒而跳過。
  mcq:
    question: 游標是 (10:00:00, 20)，哪一列應進入下一頁？
    answer: 1
    options:
    - (10:00:00, 20)
    - (10:00:00, 21)
    - (09:59:59, 99)
    - (10:00:00, 19)
    explain: 先比時間；同一時間才比鍵。原游標本身和更早時間不納入。
  id: bd-ingest-02-cursor
- prompt: 為什麼複合游標還是可能漏更新？
  answer: 晚提交或同一鍵同一時戳再改，後來可見的列可能排在已保存的游標之前或等於它。
  mcq:
    question: 排到游標之前的遲到更新，單靠增加取頁大小就能保證找回嗎？
    answer: 3
    options:
    - 能，因為下一頁會更長
    - 能，因為鍵會自動變大
    - 能，只須每批雙倍掃描
    - 不能，必須另訂回看或改用日誌
    explain: 頁大小改不了比較條件。回看窗口能補有限遲到，但不能保證所有遲到都被涵蓋。
  id: bd-ingest-02-lateness
- prompt: 寫入結果之前就保存高水位，會怎樣？
  answer: 若寫入失敗，下一批會跳過尚未落地的數據。
  interview:
    question: 同秒能分頁就算照時間做增量夠穩了嗎？
    answer: 我會先確認時戳由誰更新、排序鍵是否唯一，以及提交順序是否可能落後。複合鍵只解決同一視圖的分頁；若可容忍有限遲到，我用回看加去重。要求捕捉硬刪或不能接受漏更新，就選 CDC。寫入驗收後才保存可恢復的位置。
    points:
    - 說清同秒與晚提交的差別
    - 說出硬刪限制與替代方案
    - 推進高水位的時機
  id: bd-ingest-02-commit
practice:
- kind: sql
  category: [time, sort]
  title: 接上同日的下一頁
  minutes: 5
  dataset: shop
  prompt: 以 `orders.order_date` 模擬粗粒度時戳。列出 `(order_date, order_id)` 嚴格大於 `(2026-01-14, 1002)`、且 `order_date` 早於 2026-01-16
    的列。欄序 `order_date`、`order_id`；兩欄均遞增。
  solution: |-
    SELECT order_date, order_id
    FROM orders
    WHERE (order_date > DATE '2026-01-14'
           OR (order_date = DATE '2026-01-14' AND order_id > 1002))
      AND order_date < DATE '2026-01-16'
    ORDER BY order_date, order_id;
  explain: 1003 與已讀的 1002 同一天，不能只寫日期嚴格大於。展開後的 OR 條件也方便對照不支援同樣列值比較的引擎。
  hints:
  - 比較順序要與排序順序相同
  concepts:
  - bd-ingest-02-cursor
  - bd-ingest-01-cut
  - sql-range-bound
  tags:
  - 複合游標
  - 增量
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-ingest-02-p1
- kind: sql
  category: [time, aggregate]
  title: 為回看批次估算重播筆數
  minutes: 5
  dataset: shop
  prompt: 已發布至 2026-01-15（含）。從 `orders` 回看 2026-01-15 並讀到 2026-01-18 前，依日輸出 `order_date`、`seen_rows`、`replay_rows`（只計 01-15
    的列，其餘日期為 0）。按 `order_date` 遞增。
  solution: |-
    SELECT order_date, COUNT(*) AS seen_rows,
           COUNT(CASE WHEN order_date = DATE '2026-01-15' THEN 1 END) AS replay_rows
    FROM orders
    WHERE order_date >= DATE '2026-01-15' AND order_date < DATE '2026-01-18'
    GROUP BY order_date
    ORDER BY order_date;
  explain: 保留全部讀到的日期，只有重疊日的列算重播。把重疊條件放入 WHERE 會漏掉新批。本題用 CASE 搭配 COUNT，SQL 引擎無須支援 DuckDB 的 FILTER 才能寫出相同邏輯。
  hints:
  - 先分辨讀取範圍，才在聚合時標出重疊範圍
  concepts:
  - bd-ingest-02-lateness
  - bd-ingest-02-cursor
  - sq-group-01-rows
  tags:
  - 回看
  - 條件聚合
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-ingest-02-p2
---

## 第 1002 張讀完，還有同時間的下一張

每天搬整張訂單表變慢後，可以只抓新出現或更新的列，稱為**增量（incremental load）**。高水位（high-water mark）是上次已安全處理到的位置。假如來源只把時間記到秒，而每秒能有多張單，上一頁最後讀到 10:00:00 的第 20 張，下一頁用 `updated_at > 10:00:00` 就會跳過同秒的第 21 張。把條件改成大於等於又可能一直重讀第一頁。

## 固定比較、排序、推進方式

- **比較：**把游標（cursor）寫成 `(updated_at, order_id)`。先比時間，只有同一時間才比鍵；條件是 `t > last_t OR (t = last_t AND id > last_id)`。
- **排序：**`ORDER BY updated_at, order_id`。在本次讀取視圖中，這組欄位必須可靠區分每列、不可是 NULL。游標記本批確實處理到的整對值，不能分別找兩欄最大值後拼在一起。
- **界線：**需要跨頁讀同一份集合時固定本次可見視圖，或依來源契約固定有意義的上界；單固定一個時鐘上界，不保證掃描中看見的是同一版本。
- **推進：**先安全寫入、驗證，再保存高水位。若兩者不能放同一筆交易（transaction，一起成功或一起取消的操作），重啟可能重送，寫端要按鍵及可比較版本防止舊值覆蓋新值。

## 把增量的盲點算進成本

同秒有不同鍵是一件事；同一張舊單晚提交，或者同一鍵在同秒再更新，是另一件事。若後來才看得見的列排在已保存位置之前，複合游標照樣漏。業務能接受有限遲到時，回看（lookback）一小段時間、用冪等寫入（idempotent write，重播不再多產生一次寫入效果）消除重播；窗口之外的遲到仍須靠定期對帳發現。若刪除會令來源列直接消失，問整張表「哪些列更新了」看不到那筆刪除。需要完整變更序列時改讀來源日誌，細節見[〈CDC 與日誌位置〉](#/lesson/bd-ingest-06)。

## 在小數據中親眼看一次

SQL 練習場選 `shop`，保留 1 GB、不開容器。把只有日期的 `order_date` 當作刻意粗糙的時戳。先看 01-14 是否真的有同時段的兩張單：

```sql
SELECT order_date, order_id
FROM orders
WHERE order_date = DATE '2026-01-14'
ORDER BY order_date, order_id;
```

結果是 1002、1003；用這個反例在題目裡證明複合規則的價值。若一開始就用 `ORDER BY order_id`，樣本可能碰巧通過；把比較和排序都寫成這兩欄，才能說明為何換成不按日期配號的來源仍成立。保存切點時，同時記錄它屬於哪張來源表及哪個篩選口徑，不能拿另一張表的水位沿用。

## 試著挑兩個會戳破假保證的反例

其一是編號較小的訂單晚一秒提交，實際排回舊游標之前；其二是已讀鍵的金額再改一次，修改時間精度卻不足。前者能用足夠的回看補到，第二種還要有能辨識新值的來源版本。當你不能證明版本可比較時，不要宣稱永不漏，也不能靠把緩衝加倍就消除限制。

## 常見錯誤

- **每次少掉同秒最後一張 →** 只保存時間；保存時間與穩定鍵，並使用相同排序。
- **儲存的位置比實際輸出更新 →** 進度比寫端先提交；讓提交有共同邊界，或規劃可重播。
- **交易顯示取消，報表仍有效 →** 誤把增量查表當變更日誌；先釐清狀態更新是否必定可見，硬刪則要另有通路。

**重點回顧：**複合游標給列一個穩定次序，不會替可變來源補上提交順序。
