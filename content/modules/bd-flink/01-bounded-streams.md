---
id: bd-flink-01
module: bd-flink
order: 1
title: 無界流與有界流
subtitle: 等不到全部到齊怎麼出數字
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
- 依來源與作業設定判斷輸入是否有界
- 在本機 Flink SQL 跑出一張有限訂單計數表
- 標出持續看板何時需要修正一個中間值
tags:
- bounded stream
- Flink SQL
- batch
- streaming
resources:
- title: Flink：流與數據處理總覽
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/overview/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀有界與無界輸入，以及狀態的用途。
- title: Flink：Docker 部署
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/deployment/resource-providers/standalone/docker/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Compose 裡兩種角色如何連線。
- title: Flink 2.3：SQL Client
  url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/sql/interfaces/sql-client/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀設定批次模式與執行第一個查詢。
concepts:
- id: bd-flink-01-bounded
  prompt: Kafka 主題就是無界輸入嗎？
  answer: 不一定；作業若固定每區停止位移，讀取可有界。
  mcq:
    question: 哪一項能讓讀取確定結束？
    options:
    - 看主題目前有 100 列
    - 將主題分成 3 區
    - 為每區固定明確停止位置
    - 把 SELECT 改成 GROUP BY
    answer: 2
    explain: 來源還會追加；把讀取邊界凍結才有可知的終點。
  interview:
    question: 何時你會選有界重算，而不維持另一份持續作業？
    points:
    - 業務允許批次延遲
    - 固定快照與時間範圍
    - 比較結算與線上暫定結果
    answer: 如果營運只要昨日日結，我會凍結輸入範圍重算，重跑對帳才知道結果穩定。若連今日即時數也需要，就另外規定中間值可何時修正，不能把它當結算。
- id: bd-flink-01-updates
  prompt: 無界的全域計數能等到所有事件到齊再輸出嗎？
  answer: 不能；沒有自然終點，要輸出暫定值、按窗口結算，或設外部截止。
  mcq:
    question: 訂單流一直追加，今日看板的即時計數通常是什麼？
    options:
    - 只算一次的最終數
    - 會變動的目前結果
    - 昨天的日結快照
    - 只能等服務關閉才有數字
    answer: 1
    explain: 即時看板可先交付目前已知數據，之後明確修正。
- id: bd-flink-01-finite-sample
  prompt: 用 VALUES 寫死 3 列，能證明作業扛住連續事件嗎？
  answer: 不能；這只確認 SQL 路徑和有限輸入結果。
  mcq:
    question: 本課 Flink 查詢成功證明什麼？
    options:
    - 可做跨節點接管
    - 確認有限輸入聚合與執行環境
    - 時間窗口一定準確
    - 可壓滿正式流量
    answer: 1
    explain: 用小樣本驗證功能，不將其外推成性能、可靠性或無界演練。
practice:
- id: bd-flink-01-p1
  kind: hands-on
  title: 留下 Flink SQL 的第一張表
  minutes: 12
  steps:
  - 照正文建立 Compose 並將 Flink 查詢貼入 SQL Client。
  - 在 flink-first.md 寫預期兩組筆數並貼上實際結果，再記一項未驗證的能力。
  checks:
  - pay=2，view=1。
  - 說明樣本有自然終點；不拿它證明能持續更新。
- id: bd-flink-01-p2
  kind: sql
  category: [aggregate]
  title: 為每類事件記錄有界輸入的範圍
  minutes: 5
  level: 2
  dataset: events
  prompt: |
    以接收序號 `raw_id` 為邊界，只讀 7 至 12（兩端皆包含）。列出每種 `step` 最早的序號 `first_raw_id`、最晚的序號 `last_raw_id`、接收列數 `receipt_n`；重送仍算接收列，不為未出現的類別造列。只輸出 `step`、`first_raw_id`、`last_raw_id`、`receipt_n`，欄序如列，依 `step` 升序。
  solution: |
    SELECT step, MIN(raw_id) AS first_raw_id, MAX(raw_id) AS last_raw_id,
           COUNT(*) AS receipt_n
    FROM app_events WHERE raw_id BETWEEN 7 AND 12
    GROUP BY step ORDER BY step;
  explain: |
    先把上下界固定，再求每組範圍及列數。只用 LIMIT 6 不會指定要看哪六筆。DuckDB 讀的是已凍結的表；原生 Flink 作業如何終止，還要看來源能否宣告有界。
  hints:
  - 先只保留接收序號 7–12。
  - 在每個組內求 MIN、MAX 與 COUNT。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-flink-01-bounded
  - bd-flink-01-updates
  - sq-compose-02-population
  tags:
  - 有界輸入
  - 條件聚合
---

支付看板想每分鐘出數字，財務要昨日日結。兩方都能用 SQL 加總，但「還有下一筆嗎」會改變做法。有界流（bounded stream）有已知終點，例如凍結的 10 筆檔案或每區位移範圍已固定的 Kafka 讀取；無界流（unbounded stream）沒有自然終點。今天先用 Flink SQL 看一張有限結果，之後再看同一個查詢怎麼連續更新。

## 邊界由輸入與設定決定

檔案大小不是關鍵：一次讀完已封存的 1.2 億列仍然有界；每分鐘追蹤只追加 1 列的小表，沒有停止條件就仍無界。Kafka 主題可同時容納兩種讀法：批次處理（batch processing）讀每區固定的終點，持續作業則從已知位置追之後的事件。日結時要先記下快照或上下界。否則半小時後重跑同一 SQL，結果不同也無法決定是邏輯退步，還是來源多了幾筆。

假設先收到 2 筆付款，再收到 1 筆。無界的全域聚合不可能等到「所有紀錄」才給值；看板看到的 2 只是當前值，可能被 3 取代。另一種做法是限定事件時間窗口，例如按每五分鐘出一筆；窗口不是把來源變有界，只是替運算分成可收尾的小段。[〈滾動與滑動窗口〉](#/lesson/bd-flink-04)會畫出這些範圍，[〈Flink SQL 與更新流〉](#/lesson/bd-flink-08)會看到結果自己變動。

## 一台 Windows PC，先跑一張有限表

在 `C:\dev\conduit-lab\flink`（C 槽不可用就換 D 槽）存 `compose.yaml`。Docker Desktop 預留約 5 GB；兩個常駐服務，加一個臨時 SQL Client 的容器上限合計約 4.5 GiB。JobManager 協調工作，TaskManager 執行工作，兩者都在同一台 PC。映像內含官方建議的 Java 17；主機不用另外裝。先停止上一模組的容器，不公佈連接埠。

```yaml
services:
  jobmanager:
    image: flink:2.3.0-java17
    command: jobmanager
    mem_limit: 1408m
    environment:
      FLINK_PROPERTIES: |
        jobmanager.rpc.address: jobmanager
        rest.address: jobmanager
        rest.bind-address: 0.0.0.0
        jobmanager.memory.process.size: 1024m
  taskmanager:
    image: flink:2.3.0-java17
    command: taskmanager
    mem_limit: 1792m
    depends_on:
      - jobmanager
    environment:
      FLINK_PROPERTIES: |
        jobmanager.rpc.address: jobmanager
        taskmanager.memory.process.size: 1536m
        taskmanager.numberOfTaskSlots: 1
```

在上述資料夾的 PowerShell 啟動後，等 JobManager 與 TaskManager 就緒，再開 SQL Client。`--no-deps` 表示這次只為 SQL Client 多開一個臨時容器，沿用已在跑的服務。

```powershell
docker compose up -d
docker compose run --rm --no-deps jobmanager /opt/flink/bin/sql-client.sh
```

下方是原生 Flink SQL：`SET` 切批次模式；`VALUES` 造有限的 3 列；`GROUP BY` 每個類別合成一列。要在 DuckDB 比對，可在任一共享數據集的自由練習只執行 `SELECT` 段，不讀數據集的表；Flink 的 `SET` 不是 DuckDB 設定。

```sql
SET 'execution.runtime-mode' = 'batch';
SET 'parallelism.default' = '1';
SET 'sql-client.execution.result-mode' = 'tableau';
SELECT action_kind, COUNT(*) AS n
FROM (VALUES ('pay'), ('view'), ('pay')) AS demo(action_kind)
GROUP BY action_kind ORDER BY action_kind;
```

應見 `pay=2`、`view=1`。用 `QUIT;` 離開 SQL Client；做完可在同一資料夾執行 `docker compose down`，第 8 堂使用同一份設定再啟動。這裡證明 SQL 能跑通，不是負載測試。下堂開始把同一筆輸入的兩種時鐘分開；在[〈鍵控狀態與期限〉](#/lesson/bd-flink-05)才把 SQL 背後的 DataStream 分工拆開來看。

做成可以比較的驗收時，先把每次輸入的範圍記在結果旁。若第二次多兩筆，先用接收序號查新增的是哪一組，不以「新增數字看起來合理」取代對帳。正式來源若一邊讀一邊變動，還要確定所用快照或讀取邊界能重現；這是作業的輸入合約，不是聚合語法能替你補上的保證。

## 常見錯誤

- 查詢一直等 → 先查 TaskManager 與可用 slot，再查輸入是否無界 → 固定本課的有限樣本。
- 以為 LIMIT 等於凍結來源 → 只限制結果，不保證一致的輸入切點 → 記錄各分區的邊界。
- 把臨時累計當日結 → 後續仍會更新 → 顯示口徑與截至時間。
