---
id: bd-serve-08
module: bd-serve
order: 8
title: 尾端延遲與容量
subtitle: 用最慢那批而非平均驗收
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-07
objectives:
- 按最近秩定義算出尾端百分位
- 為相同工作負載記錄延遲、錯誤及吞吐
- 以容量曲線找到查詢排隊開始的區間
tags:
- p95
- p99
- query_log
- load test
resources:
- title: ClickHouse：查詢日誌
  url: https://clickhouse.com/docs/reference/system-tables/query_log
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀查詢時間、讀取量及記憶體觀測欄。
concepts:
- id: bd-serve-08-tail
  prompt: 99 次 40 ms、1 次 4000 ms，平均能代表那一筆慢查詢嗎？
  answer: 不能；還要用明確百分位定義及極慢樣本，並保留時間窗和樣本數。
  mcq:
    question: 下列哪句是 p95 的合理讀法？
    options:
    - 最慢的 95 次平均
    - 95% 左右的樣本不超過這個門檻
    - 平均值的 95 倍
    - 每次一定在這個時間內
    answer: 1
    explain: 百分位是分布門檻，不是平均，也不是最差一次。
  interview:
    question: 把看板從 10 增至 100 查詢／秒，如何知道容量夠？
    points:
    - 固定查詢組合、快取狀態與數據量
    - 量尾端延遲、完成速率和錯誤
    - 分階加壓，定位排隊轉折
    answer: 我會固定查詢組合及冷熱快取條件，逐階加負載，記 p95、p99、逾時和成功完成率。若輸入再加但完成量不增且排隊升高，就不把該速率當安全容量。
- id: bd-serve-08-budget
  prompt: 負載只記成功請求，重負載時 p95 變小，能說速度變好嗎？
  answer: 不能；慢請求可能逾時被排除，須同報失敗與逾時的比例。
  mcq:
    question: 高負載 p95 降了，但逾時從 0% 到 20%，怎判讀？
    options:
    - 一定更快
    - 只看 p95 就夠
    - 不能宣稱改善，要把逾時與完成量納入
    - 刪掉尖峰後發佈
    answer: 2
    explain: 要區分真正改善與慢樣本不再進成功樣本。
- id: bd-serve-08-queue
  prompt: 同一測試到達變快但成功完成率不增、尾端延遲上升，可能代表什麼？
  answer: 系統開始排隊或飽和；要量工作階段等待與瓶頸。
  mcq:
    question: 哪組數據較能定位突然變慢的負載階段？
    options:
    - 負載率、完成率、p95、錯誤率
    - 只有 UI 截圖
    - 只有一次冷查詢時間
    - 只有各查詢的平均執行時間
    answer: 0
    explain: 尾端延遲需和流量、完成及錯誤一起讀。
practice:
- id: bd-serve-08-p1
  kind: sql
  category: [percentile, time]
  title: 核對登入到接收的尾端延遲
  minutes: 7
  level: 2
  dataset: logins
  prompt: |
    將 `received_at` 減 `login_at` 作為每筆接收延遲（整秒）。依 `channel` 求樣本數 `sample_n`、離散 p95 `p95_s` 和最大值 `max_s`。只輸出 `channel`、`sample_n`、`p95_s`、`max_s`，欄序如列，按 `channel` 升序。
  solution: |
    WITH lagged AS (
      SELECT channel, date_diff('second', login_at, received_at) AS delay_s
      FROM login_log
    )
    SELECT channel, COUNT(*) AS sample_n, quantile_disc(delay_s, 0.95) AS p95_s,
           MAX(delay_s) AS max_s
    FROM lagged GROUP BY channel ORDER BY channel;
  explain: |
    DuckDB 的 quantile_disc 取離散秩，最大值另報。不用 AVG 當 p95。這個數據量的是接收延遲，不是 ClickHouse 查詢耗時；後者要看查詢日誌。
  hints:
  - 先為每筆算整秒，不取時間戳自身的百分位。
  - 分組後各算一個離散 p95。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-08-tail
  - bd-flink-02-processing
  tags:
  - 百分位數
  - 延遲
- id: bd-serve-08-p2
  kind: sql
  category: [percentile, aggregate]
  title: 同時區分常態與單次長尾
  minutes: 8
  level: 3
  dataset: events
  prompt: |
    每個 `step` 用所有接收列（不去重）計延遲；整秒為 `received_at - event_at`。求 `sample_n`、`slow_n`（延遲大於 60 秒）、離散 p99 `p99_s`，只列有慢列的組。只輸出 `step`、`sample_n`、`slow_n`、`p99_s`，依 `slow_n` 降序，同值按 `step` 升序。
  solution: |
    WITH lagged AS (
      SELECT step, date_diff('second', event_at, received_at) AS delay_s
      FROM app_events
    )
    SELECT step, COUNT(*) AS sample_n, COUNT(*) FILTER (WHERE delay_s > 60) AS slow_n,
           quantile_disc(delay_s, 0.99) AS p99_s
    FROM lagged GROUP BY step
    HAVING COUNT(*) FILTER (WHERE delay_s > 60) > 0
    ORDER BY slow_n DESC, step ASC;
  explain: |
    不要先在 WHERE 排除快列；否則樣本數與 p99 都只看慢列。實務要用與服務口徑一致的時間命名，並報出逾時未完成的樣本。
  hints:
  - 每一組的百分位要看全組。
  - 用條件計數和 HAVING 列出存在慢列的組。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-08-tail
  - bd-serve-08-budget
  - sq-compose-02-population
  tags:
  - 條件計數
  - p99
- id: bd-serve-08-p3
  kind: explain
  title: 留一張三階負載判讀單
  minutes: 8
  steps:
  - 把正文的到達率、完成率、p95、逾時率寫入 serve-capacity.md。
  - 標出第一個不適合宣稱安全的區間，並寫下一次比較要固定的條件。
  checks:
  - 指出 100 到 150 次／秒之間需要加測。
  - 同時報完成速率、尾端延遲與逾時；不只看平均。
---

門市說看板「平常很快，但尖峰點不開」。尾端延遲（tail latency）關心少數慢請求；平均可能被許多快請求壓低。百分位數（percentile）用分布門檻說話：例如離散 p95 取排序後向上取整的第 `0.95 × n` 個樣本。用 100 筆來看，p95 是第 95 筆，p99 是第 99 筆；只有最慢那筆很慢時，p99 也未必反映它，故還要報樣本數、最大值或逾時數。不同工具可能用插值或近似演算法，比較時要用相同定義。

## 用一張表找排隊的轉折

維持同一份數據與查詢組合，每階測相同時間。只看成功樣本的延遲時，同時要報失敗或逾時，否則最慢那批消失後，p95 反而可能變小。

| 到達率（次／秒） | 完成率（次／秒） | p95 | 逾時率 |
| --- | --- | --- | --- |
| 50 | 50 | 80 ms | 0% |
| 100 | 100 | 130 ms | 0% |
| 150 | 108 | 900 ms | 8% |

150 次／秒這階還有請求未在觀測窗內完成或逾時，不能用 150 宣稱可承載速率。若 p95 目標是 200 ms 且錯誤率要低於 1%，100 是已觀察到可接受的點；100–150 中間要細測，不知道安全極限就不要報一個精準數。暖機、冷熱快取、併發度與請求組合都記錄下來；只測同一快取命中查詢，不代表全店都快。

## 先跑一個延遲基準

在 SQL 練習場選 `logins`，用 DuckDB 看「事件到接收」的整秒延遲。這是管道的一段延遲，並非數據庫的查詢延遲。先用全體查原始尺度，在題目再依來源或事件類型分組。

```sql
WITH lagged AS (
  SELECT date_diff('second', login_at, received_at) AS delay_s FROM login_log
)
SELECT COUNT(*) AS sample_n, quantile_disc(delay_s, 0.95) AS p95_s,
       MAX(delay_s) AS max_s
FROM lagged;
```

結果有 312 筆、p95 為 0 秒，但最大延遲是 108000 秒（30 小時）。`date_diff` 在本數據是整秒時間戳相減；`quantile_disc(延遲欄, 比例)` 取離散門檻。ClickHouse 查詢端可從 `system.query_log` 的 `query_duration_ms`、`read_rows` 等對照，需另看失敗或取消事件以及客戶端等待；不能混用接收延遲與查詢延遲。若日誌與看板實際延遲不符，量網路或查詢排隊，再分別定位。比較[〈ClickHouse 排序鍵〉](#/lesson/bd-serve-01)的掃描量時，先固定同一結果再描述速度。

評估容量時先分清用戶看到的耗時與引擎執行耗時。客戶端計時通常涵蓋排隊、網路與回傳；引擎查詢紀錄只能告訴你引擎內這一段。若引擎讀取量沒變且耗時穩定，但客戶端變慢，就先找請求排隊或網路，不必直接重排數據。相反，若只有含跨店長時間範圍的查詢變慢，先按查詢形態分組，否則整體百分位會稀釋這一類問題。留一份同組合可重跑的基準，往後調排序鍵、物化或容量都能快速比較；不以單個最快樣本與昨天的整體平均對比。

交班時把該次量測期間和重跑條件附在圖旁。若實測的負載只有讀取，別把結論直接推成讀寫混跑也能承受。後者會搶磁碟與記憶體，須分開留基準。

## 常見錯誤

- 只交平均值 → 尖峰被沖淡 → 報 p95、p99、樣本數與錯誤。
- 把每分鐘 p95 再平均 → 忽略每分鐘的樣本量和分布 → 用原始樣本或可合併的分布數據。
- 只測單一負載就下容量結論 → 看不到飽和點 → 分階加壓並固定對照條件。
