---
id: bd-orch-02
module: bd-orch
order: 2
title: 邏輯日期與數據區間
subtitle: 今天執行的是昨天的帳
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-01
objectives:
- 從一天的排程反推開始與結束時間
- 用半開區間篩出指定營業日
- 判斷重試、夏令時間與人工觸發是否改變處理範圍
tags:
- 邏輯日期
- 數據區間
- 營業日
- 時區
resources:
- title: Airflow：DAG Runs
  url: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 data interval、logical date 與 catchup。
- title: Python：datetime
  url: https://docs.python.org/3/library/datetime.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查 aware 與 naive 日期時間的差異。
concepts:
- prompt: 為什麼不能用任務啟動時間的日期來查日報？
  answer: 執行時間可能落在隔天或因重試而更晚；日報應沿用該次執行指定的數據區間。
  mcq:
    question: 01-19 02:00 執行的班次約定算昨日，應讀哪個區間？
    answer: 2
    options:
    - 01-19 的整日
    - 01-18 02:00 至 01-19 02:00
    - 01-18 零時含、01-19 零時不含
    - 只讀 01-19 02:00 前最後一筆
    explain: 以營業日曆算 01-18 零時至 01-19 零時；不可用啟動時間的日或回推固定 24 小時。
  id: bd-orch-02-interval
- prompt: 遇到夏令時間，營業日一定是 24 小時嗎？
  answer: 不一定；先在指定的業務時區求各自的午夜，再把兩端轉成目的欄位的時間基準。
  mcq:
    question: 跨夏令時間的午夜邊界最安全怎麼取？
    answer: 0
    options:
    - 從營業日曆取兩個帶時區邊界
    - 每次固定加 24 小時
    - 對 UTC 欄位只取字串日期
    - 用任務實際啟動時間
    explain: 分別建立當地起終點，再換算；不能一律從起點加固定 24 小時。
  id: bd-orch-02-timezone
- prompt: Airflow 的邏輯日期等於實際執行時刻嗎？
  answer: 不等於。對帶數據區間的定期排程，邏輯日期通常錨定該區間起點；實際執行可在區間後。
  interview:
    question: 日報晚兩天重跑，怎樣避免讀錯分區？
    answer: 用該次 run 的 data interval 或明確的 business_date，按業務時區把起迄轉成數據欄位的時間基準，採含起不含迄。重跑不重新從 now 推日期；若手動執行沒有預期區間，要求明確傳入參數。
    points:
    - 拆開邏輯日期與執行時間
    - 固定業務時區和半開區間
    - 重跑沿用輸入參數
  id: bd-orch-02-logical
practice:
- kind: sql
  category: [time]
  title: 替昨日班次取訂單
  minutes: 5
  dataset: shop
  prompt: 班次在 2026-01-19 凌晨補做 01-18 營業日。在 `orders` 取 `[2026-01-18, 2026-01-19)`，欄序 `order_id`、`status`，依 `order_id` 遞增。
  solution: |-
    SELECT order_id, status
    FROM orders
    WHERE order_date >= DATE '2026-01-18' AND order_date < DATE '2026-01-19'
    ORDER BY order_id;
  explain: 即使當班推遲，仍讀 01-18；上界如寫成 `BETWEEN`，01-19 會被納入。
  hints:
  - 班表觸發日不是報表日
  concepts:
  - bd-orch-02-interval
  - bd-orch-02-logical
  - sql-range-bound
  tags:
  - 營業日
  - 半開區間
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-orch-02-p1
- kind: sql
  category: [time, aggregate]
  title: 逐日核對延遲兩天的日報
  minutes: 5
  dataset: shop
  prompt: 重跑報表區間 `[2026-01-18, 2026-01-20)`。從 `orders` 輸出欄序 `order_date`、`row_count`（當日訂單列數，包含取消）。依 `order_date` 遞增；不用補 0
    日期。
  solution: |-
    SELECT order_date, COUNT(*) AS row_count
    FROM orders
    WHERE order_date >= DATE '2026-01-18' AND order_date < DATE '2026-01-20'
    GROUP BY order_date
    ORDER BY order_date;
  explain: 01-18 與 01-19 各 2 筆。先固定區間，再逐日聚合；取 `CURRENT_DATE` 會讓結果跟重跑日一起移動。
  hints:
  - 先把查詢範圍跟重跑時鐘分開
  concepts:
  - bd-orch-02-logical
  - bd-orch-02-interval
  - sq-group-01-rows
  tags:
  - 重跑
  - 營業日
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-orch-02-p2
---

## 作業晚跑，昨天不能跟著變

茶舖約定凌晨 02:00 發布昨日報表。到了隔天因故補跑，如果程式寫「今天減一天」，同一次任務會改抓另一個營業日（business date）。先把這 3 個時間分開：**數據區間（data interval）**決定查哪些列；**邏輯日期（logical date）**是工作流執行的參考時間；**實際執行時間（run time）**表示機器何時開始。在 Airflow 採數據區間的定期排程中，邏輯日期通常對應區間起點，排程器通常等該區間結束後才啟動該次執行；其他 timetable（定義排程時機和區間的規則）或人工觸發不一定有同樣的對應。

## 說清楚 02:00 是哪一種承諾

若營業日是台北時間 01-18 零時到隔天零時，02:00 是交付時刻，不必把數據區間跟著移到 02:00。把排程改成每天 02:00，不能想當然地把該排程器推導的區間當成午夜窗口。先查實際 timetable 的輸出，再決定讓午夜區間等待來源，或以明確參數計算營業日。工作流在 01-20 修復時仍使用同一範圍，輸出也寫到 01-18 那份產物。

營業日的半開區間（half-open interval）用 `[start, end)` 表示：大於等於起點、小於結束點。相鄰窗口剛好拼合，不用猜最後一秒有沒有毫秒；時區（time zone）則決定這兩個邊界對應哪個時間。碰到夏令時間，要先在業務時區算兩個午夜，再分別換成來源欄位所用的時區，不能把「一天」硬譯成 24 小時。可回看[〈半開區間〉](#/lesson/sq-time-02)的邊界例子。

## 用已經標好營業日的小表驗收

SQL 練習場選 `shop`，預留 1 GB，無容器。日期欄位已按營運標記，不需要在本例自己轉換時區。先核對 01-18 的兩張單，注意取消單是否納入，取決於報表規格而不是排程器。

```sql
SELECT order_id, order_date, status
FROM orders
WHERE order_date >= DATE '2026-01-18'
  AND order_date < DATE '2026-01-19'
ORDER BY order_id;
```

你會看到 1010、1011；1011 已取消。即使延遲兩天也應得到它們，再由指標定義決定是否排除取消單。把這組預期鍵留下，重跑時便不只檢查「成功」，還能辨認查錯日。

## 將時間規則寫進產物名字

把日期當成隨工作流傳遞的明確參數，輸入條件、輸出分區和日誌都用同一值。若日報允許在 02:00 後補入晚到的退款，還應把營業日期同來源切點分開記：修訂版本仍屬 01-18，但所依據的來源切點可比首版更新。人工重跑前先看出是哪一次執行、確認其時區與輸入版本，再決定這是重試還是重算。若兩份結果同名卻各屬不同日，事後很難從完成時間猜回原查詢。

## 常見錯誤

- **補跑寫到今天的分區 →** 由現在時鐘推導輸入日；保存該次工作流的日期參數與輸出路徑。
- **午夜的列算兩次 →** 用兩端皆含的條件；採含起不含迄。
- **日期正確但跨時區少了幾筆 →** 未寫明欄位時區；先按業務日曆算兩個邊界，再轉換。

**重點回顧：**排程何時啟動可以變；要處理哪一天，必須在該次執行明確固定。
