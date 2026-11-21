---
id: bd-ingest-01
module: bd-ingest
order: 1
title: 全量與快照
subtitle: 先固定讀取切點
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 說明全量讀取與一致性切點的差別
- 用固定輸入算出訂單快照的筆數與邊界
- 列出由快照銜接變更日誌的順序
tags:
- 全量
- 一致性讀取
- 快照
- 切點
resources:
- title: MySQL：一致性非鎖定讀取
  url: https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看同一交易何時沿用讀取快照。
- title: Debezium：MySQL 連接器
  url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀初始快照與後續串流的銜接。
concepts:
- prompt: 拉了全表就一定能重現同一個狀態嗎？
  answer: 不一定。全量說的是涵蓋範圍；一致性快照說的是各筆數據是否同屬一個可辨識的讀取視圖。
  mcq:
    question: 訂單在掃描中被改動，要用什麼證明結果屬於同一切點？
    answer: 2
    options:
    - 按訂單編號排序
    - 最後只比總列數
    - 以同一一致性視圖讀取
    - 記下掃描完成時間
    explain: 同一可用的一致性視圖才是保證。排序、列數與掃描結束時鐘都不固定可見版本。
  id: bd-ingest-01-cut
- prompt: 為什麼先寫暫存區再發布？
  answer: 可先核對輸出是否完整且口徑一致；失敗時讀者仍看上一版。
  mcq:
    question: 掃描中途失敗時，哪一版應仍可供下游讀取？
    answer: 0
    options:
    - 上一次驗收通過的版本
    - 這次暫存的半批
    - 把缺項補零後的這一版
    - 依檔案更新時間挑最新的一版
    explain: 未通過驗收的半批不可公開；補空列也無法補回缺少的來源。
  id: bd-ingest-01-release
- prompt: 快照要接續增量，需要留下什麼？
  answer: 記錄與快照對得上的來源日誌位置；它必須依來源協定取得，而不是事後猜測。
  interview:
    question: 首次全量掃描跑了 40 分鐘，怎麼接 CDC 才不漏這段更新？
    answer: 我會先依來源或連接器的協定建立一致性快照與對應位置，寫到暫存區再核對。接著從協定指定的位置重播增量；交界若可能重疊，就按鍵與來源版本做冪等寫入。上線前用掃描中發生的更新和刪除驗證。
    points:
    - 位置與快照同源
    - 暫存驗收和有序銜接
    - 重疊重播及更新刪除驗證
  id: bd-ingest-01-handoff
practice:
- kind: sql
  category: [time, aggregate]
  title: 核對固定切點
  minutes: 5
  dataset: shop
  prompt: 在 `orders` 取 `order_date` 早於 2026-01-15 的訂單。只輸出一列，欄序 `snapshot_rows`（列數）、`max_order_id`（最大編號）；單列無須排序。
  solution: |-
    SELECT COUNT(*) AS snapshot_rows, MAX(order_id) AS max_order_id
    FROM orders
    WHERE order_date < DATE '2026-01-15';
  explain: 上界當天不納入，因此是 3 列、1003。不要把上界寫成小於等於；本題用固定日期模擬切點，不是 MySQL 的一致性讀取指令。
  hints:
  - 先判斷 01-15 本身屬於哪一批
  concepts:
  - bd-ingest-01-cut
  - sq-group-01-rows
  - sql-range-bound
  tags:
  - 快照
  - 筆數
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-ingest-01-p1
- kind: sql
  category: [time]
  title: 列出切點後的訂單
  minutes: 5
  dataset: shop
  prompt: 在 `orders` 取 `order_date` 自 2026-01-15 起至 2026-01-17 前的訂單。依 `order_date`、`order_id` 遞增；欄序為 `order_id`、`order_date`、`status`。
  solution: |-
    SELECT order_id, order_date, status
    FROM orders
    WHERE order_date >= DATE '2026-01-15'
      AND order_date < DATE '2026-01-17'
    ORDER BY order_date, order_id;
  explain: 相鄰批次共用邊界且只納入一次。把起點也寫成嚴格大於會漏掉 01-15。這個練習只模擬不可變輸入，不會捕捉舊訂單更新。
  hints:
  - 用含起點、不含終點的條件
  concepts:
  - bd-ingest-01-handoff
  - bd-ingest-01-cut
  - sql-range-bound
  tags:
  - 快照
  - 半開區間
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-ingest-01-p2
---

## 搬整張表，先說清楚是哪一刻

茶舖第一次要把訂單搬進數倉。讀取從 02:00 跑到 02:40：02:10 有訂單取消，02:20 又有新訂單。就算最後帳面筆數與來源一樣，也可能是少了一張舊單、多了一張新單。營運要的不是「讀完當下看見什麼」，而是一份可核對、可再接續的訂單底本。

**全量（full load）**說的是範圍：把指定集合整批讀出，不只抓這次的變更。**一致性快照（consistent snapshot）**說的是可見性：讓讀到的數據對應同一個讀取視圖。把數據按鍵排序或切成 4 個檔都不會自動得到一致快照。如果每個讀取通道各自開啟視圖，併發更新仍可能讓各檔來自不同切點。用哪一套機制取得一致性，取決於來源數據庫與連接器。

![從來源的一致快照切點，經暫存與驗收，銜接之後的有序日誌](assets/bd-ingest-snapshot.svg)

## 讀、驗、發布要分開

1. **固定輸入。** 先訂好表、欄位、鍵、納入條件和讀取視圖。如果要接變更數據捕獲（change data capture，CDC），用來源支援的協定取得與視圖對應的日誌位置，不要事後抄牆上時間當作位置。
2. **只寫暫存。** 暫存區（staging area）是不給報表讀的中間區。替這批寫一份批次清單（manifest）：表名、切點、筆數、必要鍵與抽樣核對值。若被中斷，半批輸出不會頂替上一份完整輸出。
3. **驗過才發布。** 用同一範圍比對來源和暫存，核對鍵與金額，才切換給下游讀。之後用對應的日誌位置接續；若交界允許重疊，寫端要能安全重播。之後在[〈CDC 與日誌位置〉](#/lesson/bd-ingest-06)會把更新和刪除逐一套用。

## 動手前先算一遍

在 SQL 練習場選茶舖訂單 `shop`。本機只用既有瀏覽器 SQL 引擎；不開容器，練習可預留 1 GB。以下只是對固定樣本按日期切片，並不會在一張仍有併發寫入的表上創造一致性快照。先預測哪天歸在哪批，再執行這個查看日期分佈的查詢：

```sql
SELECT order_date, COUNT(*) AS order_rows
FROM orders
WHERE order_date < DATE '2026-01-16'
GROUP BY order_date
ORDER BY order_date;
```

結果是 01-13 有 1 列、01-14 有 2 列、01-15 有 2 列。若第一批的上界是 01-15、不包含當天，批次清單的筆數就寫 3；下一批才收那 2 筆 01-15。務必註明這是按營業日切片；如果 01-13 的訂單隔天改為取消，日期切片本身不會把那次更新帶過來。對可變來源，真正的切點要靠一致性視圖及匹配位置。

## 為切點寫下可查的識別

若你只留下「凌晨成功」，下次無法知道那 3 筆應屬哪一次讀取。清單至少寫出來源、條件、切點、值班者可以重算的計數；實際一致性讀取還要留下對應交易視圖或來源位置的證據。兩批同筆數不代表同數據，發布前可以再比對固定鍵的狀態和逐鍵差異。

## 常見錯誤

- **檔案都有了卻對不上金額 →** 並行讀端取了不同視圖；先確認數據庫與連接器能否共享讀取切點。
- **重開報表只剩半天 →** 把發布路徑當暫存區；在驗收前保持下游指向上一版。
- **交界少一次取消 →** 以掃描完成時間代替來源位置；依連接器的快照協定記錄並接續。

**重點回顧：**全量解決搬多少，一致性快照解決讀哪個版本；可發布、可接續，是兩次不同的驗證。
