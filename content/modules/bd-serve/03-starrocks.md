---
id: bd-serve-03
module: bd-serve
order: 3
title: StarRocks 主鍵表
subtitle: 處理反覆更新的訂單
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-02
objectives:
- 按主鍵辨認應被替換的列
- 以來源版本保護全量更正與刪除
- 區分 StarRocks 模型和 DuckDB 演練語法
tags:
- primary key table
- upsert
- 版本防倒退
- 刪除
resources:
- title: StarRocks：主鍵表
  url: https://docs.starrocks.io/docs/table_design/table_types/primary_key_table/
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀主鍵表更新、刪除及排序鍵限制。
concepts:
- id: bd-serve-03-upsert
  prompt: 兩張訂單共用同一個目的主鍵會怎樣？
  answer: 同一鍵代表同一列，兩張會互相覆蓋；應選真正的業務粒度。
  mcq:
    question: 訂單有多行明細，要保留各行目前狀態，適合哪個主鍵？
    options:
    - 只有更新時刻
    - 只有 order_id
    - order_id 加 line_no
    - 固定鍵 store
    answer: 2
    explain: 複合鍵與每單每個行號的粒度對齊。
  interview:
    question: StarRocks 主鍵表用在實時訂單，有什麼容易漏？
    points:
    - 主鍵粒度及查詢排序需求
    - 來源版本、亂序和刪除
    - 以逆序更正和重播驗收
    answer: 我會先確認一列是訂單還是訂單明細。再用一筆由 100 改 130 的更新先送新版、後送舊版，驗證還是 130；刪除和重播也要測，不能只測順序正常的 INSERT。
- id: bd-serve-03-sequence
  prompt: 來源第 4 版比第 3 版先到，直接後到覆蓋會怎樣？
  answer: 第 3 版可能使結果倒退，須根據來源版本判定。
  mcq:
    question: 哪個資訊最適合防止舊更新覆蓋新值？
    options:
    - 來源保證的單鍵版本
    - 查詢執行時間
    - 每次重送生成的新鍵
    - 每筆收到時才遞增的計數
    answer: 0
    explain: 接收時刻晚不等於業務變更新；用來源可比較版本。
- id: bd-serve-03-delete
  prompt: 刪除後把去重的版本記錄也立刻清除，收到舊更新可能怎樣？
  answer: 目的端可能把刪除的列重新插入；要保留足夠久的刪除版本或使用正確的順序機制。
  mcq:
    question: 已刪鍵重播舊值時要防的是什麼？
    options:
    - 壓縮率太高
    - 列復活
    - 排序鍵失效
    - 欄名失去大小寫
    answer: 1
    explain: 刪除也是由版本決定的狀態，不應讓舊事件越過刪除。
practice:
- id: bd-serve-03-p1
  kind: sql
  category: [ddl]
  title: 以狀態模式防止舊版本覆蓋
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    用 DuckDB 建立 `current_orders(order_id INTEGER PRIMARY KEY, rev INTEGER, amount INTEGER)`。先放 `(701,1,100)` 與 `(702,1,80)`；再以鍵套用 `(701,3,130)`，最後模擬晚到 `(701,2,120)`，只在入站 `rev` 大於目前值時覆蓋。保留該表給檢查。檢查讀取 `order_id`、`rev`、`amount`，依 `order_id` 升序。
  solution: |
    CREATE TABLE current_orders (order_id INTEGER PRIMARY KEY, rev INTEGER, amount INTEGER);
    INSERT INTO current_orders VALUES (701,1,100),(702,1,80);
    INSERT INTO current_orders VALUES (701,3,130)
    ON CONFLICT (order_id) DO UPDATE SET rev = excluded.rev, amount = excluded.amount
    WHERE excluded.rev > current_orders.rev;
    INSERT INTO current_orders VALUES (701,2,120)
    ON CONFLICT (order_id) DO UPDATE SET rev = excluded.rev, amount = excluded.amount
    WHERE excluded.rev > current_orders.rev;
  explain: |
    `excluded` 是嘗試寫入的版本，和表裡的 rev 比較。無條件覆蓋會退回 120；忽略所有衝突又會留在 100。這是 DuckDB 的狀態演練，不可把 ON CONFLICT 貼到 StarRocks 當成載入設定。
  hints:
  - 先用真正的 PRIMARY KEY 建練習表。
  - 對新舊兩次 INSERT 都套版本條件。
  check:
    ordered: true
    columnNames: true
    mode: state
    query: SELECT order_id, rev, amount FROM current_orders ORDER BY order_id;
  concepts:
  - bd-serve-03-upsert
  - bd-serve-03-sequence
  - bd-flink-08-key
  tags:
  - 狀態模式
  - 版本更新
- id: bd-serve-03-p2
  kind: sql
  category: [distinct, top-n]
  title: 選出每筆事件的目前接收版本
  minutes: 6
  level: 3
  dataset: events
  prompt: |
    把相同 `event_id` 視為同一鍵，以 `raw_id` 最大代表最新接收版本（只在本題當作版本）。只列出有多次接收的事件。輸出 `event_id`、`latest_raw_id`、`receipt_n`，依 `event_id` 升序。
  solution: |
    SELECT event_id, MAX(raw_id) AS latest_raw_id, COUNT(*) AS receipt_n
    FROM app_events GROUP BY event_id HAVING COUNT(*) > 1
    ORDER BY event_id;
  explain: |
    若先挑最新再計數，原本多次接收的證據就消失。真實主鍵表要由來源版本決定目前值，本題只以接收序號做獨立演練。
  hints:
  - 按事件鍵分組。
  - MAX 和 COUNT 使用同一組輸入。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-03-sequence
  - bd-serve-03-upsert
  - bd-flink-05-key
  tags:
  - 版本
  - 重送
---

實時看板先接到訂單第 3 版 130 元，再收到延遲的第 2 版 120 元。如果只做「後到者覆蓋」，畫面就倒退。StarRocks 的主鍵表（primary key table；台灣亦稱主鍵資料表）讓相同鍵對應到目前一列，適合更新與刪除；但哪個更新算新，要靠來源順序或支援的條件式更新機制，不是鍵自己能判斷。這堂用 DuckDB 重現版本契約，不另外啟動 StarRocks。

## 識別一列，和加速找一列，是兩件事

主鍵先定粒度。一列一張訂單就用 `order_id`；一列一個品項就可能用 `order_id, line_no`。排序鍵仍要考慮分析查詢常篩哪些欄位，不能因主鍵叫 ID 就忽略店與日期的讀取需求；StarRocks 主鍵表可為排序指定另外的欄位組合，要按版本與表設計限制核對。相比之下，Doris Unique 也有同鍵語義；基本 ClickHouse MergeTree 的 `ORDER BY` 主要負責存放排序，不會直接把同鍵寫成唯一列。

主鍵更新（upsert）對不存在的鍵插入，對存在的鍵替換目前版本。上游送來的若只是部分欄位，要明訂「缺欄」和「寫 NULL」是否不同，不能讓更新地址把金額也清掉。若來源可刪除，晚到的舊更新也不能讓舊列復活。實作可保存刪除版本、讓事件順序可重現，或按連接器支援的方式送刪除；只有「現在看不見該鍵」不等於下次重播仍會隱藏它。CDC 怎樣提供變更，回看[〈Flink CDC〉](#/lesson/bd-flink-09)。

## 把逆序更正變成測試

在 SQL 練習選 `shop`；用下方 SQL 題在這個數據集的乾淨副本另建練習表，不修改共享的 `orders`。DuckDB 的基本形式是 `INSERT INTO 表 … ON CONFLICT (鍵) DO UPDATE SET 欄 = excluded.欄 WHERE 條件`；`excluded` 代表這次嘗試寫的列，而表名引用已在表裡的列。以 `excluded.rev > current_orders.rev` 拒絕回退。這是 DuckDB 方言，不是 StarRocks 的原生匯入命令。

先設 701 的目前版本 1、金額 100，送版本 3 與版本 2，最後讀表確認 701 仍為 130，且不動 702。若你說只測到覆寫，還漏一條：再用一張草圖加上版本 4 刪除、然後重播版本 2；寫清楚是否還記著版本 4。交出的不只是更新語法，而是目的表接晚到時仍可信的一個反例。設定生產載入時，要額外確認不同連接器有無按版本更新、部分更新和刪除能力。

將驗收再提升一層：版本 3 重送一次，結果還是一列、金額 130；版本 2 晚到仍不可降回 120。若來源竟為同鍵同版本給兩種金額，不能以到達順序隨便取值；要訂拒絕或隔離規則。缺乏可信版本時，不如先查來源能否提供事件次序，再決定服務層是否能承諾最新。

同一份測試也應核對未被更正的其他訂單不受影響。

## 常見錯誤

- 只用訂單當明細的主鍵 → 同一訂單多行互蓋 → 加入行號或真正明細鍵。
- 覺得晚到就一定較新 → 看板金額倒退 → 以來源可比較的版本驗收。
- 目的表刪列就忘記版本 → 重播舊列可能重新插入 → 保留刪除判斷的依據。
