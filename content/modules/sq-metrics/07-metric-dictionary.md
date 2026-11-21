---
id: sq-metrics-07
module: sq-metrics
order: 7
title: 指標字典
subtitle: 把時區與生效日期一起交付
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-06
objectives:
- 為一個指標留下口徑、時區、負責角色及生效日
- 用半開生效區間選擇口徑版本並驗證午夜邊界
tags:
- 指標字典
- 生效日期
- 時區
resources:
- title: dbt：集中定義指標
  url: https://docs.getdbt.com/docs/build/metrics-overview
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看指標定義如何由不同工具共用。
- title: Spark SQL：時區轉換函式
  url: https://spark.apache.org/docs/latest/sql-ref-functions-builtin.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查 from_utc_timestamp，對照時區邊界。
concepts:
- id: sq-metrics-07-contract
  prompt: 一個可重現的指標條目不能只寫名稱，還需要什麼？
  answer: 公式、粒度、來源、範圍、時區、負責角色、版本生效日和驗收例。
  mcq:
    options:
    - 只有展示名稱
    - 只有圖表輸出欄位
    - 只留查詢當天的結果
    - 口徑、時區、版本與可驗的例子
    answer: 3
    explain: 別人要知道用哪版以及如何檢查，而非只知道叫什麼。
- id: sq-metrics-07-effective
  prompt: 新版從 2 月 3 日生效，舊版迄日也是 2 月 3 日時，當天用哪版？
  answer: 新版；以含起日、不含迄日的區間避免兩版同時命中。
  mcq:
    options:
    - 只用新版
    - 舊版和新版相加
    - 沿用第一次跑到的版
    - 兩版都不算 2 月 3 日
    answer: 0
    explain: 採用左閉右開後，邊界日只屬於新區間。
  interview:
    question: 指標由 2 月 3 日改口徑，要怎麼讓舊數字可重現？
    answer: 我會保存舊版及生效區間，不直接覆蓋定義；報表記錄用的版本與業務時區。先和負責角色說明舊日是否重列，再用邊界日輸出驗新版從哪天開始。
    points:
    - 保留舊版與生效區間
    - 說明是否重列歷史
    - 用邊界測例追溯版本
- id: sq-metrics-07-clock
  prompt: 先把 UTC 轉日期再調成業務時區，可能漏掉什麼？
  answer: 時間先被截到零時，跨午夜的事件可能歸到錯日；應先轉時區再轉日期。
  mcq:
    options:
    - 先轉日期一定正確
    - 先轉時區，再取日期
    - 固定把所有日期加一天
    - 事件時間和接收時間都可以替代
    answer: 1
    explain: 同一時刻在兩地可能不是同一天。
- id: sq-metrics-07-revision
  prompt: 業務同意用新版口徑重列歷史，舊版要不要刪掉？
  answer: 保留舊版及先前發布結果，另記重列版本、生效範圍和決議。
  mcq:
    options:
    - 刪除舊版和發過的報表
    - 保留舊版，另存重列版本
    - 沿用舊版號碼覆蓋公式
    - 只改展示名稱
    answer: 1
    explain: 重列不等於歷史從未發布；兩版和重列範圍都需可查。
practice:
- id: sq-metrics-07-p1
  kind: sql
  category: [model, time]
  title: 驗證兩個業務午夜邊界
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    只為本題假設 raw_id 8、11、13 的 event_at 是 UTC（不改數據集定義）。用固定 UTC+08:00 轉為日期。輸出 raw_id、utc_day、business_day，依 raw_id 升冪。
  solution: |
    SELECT raw_id, CAST(event_at AS DATE) AS utc_day,
           CAST(event_at + INTERVAL '8 hours' AS DATE) AS business_day
    FROM app_events WHERE raw_id IN (8, 11, 13) ORDER BY raw_id;
  explain: |
    先轉時間再取日期。11 是 UTC 2 月 2 日 23:59，進入業務日 2 月 3 日。Spark 可依需要用 from_utc_timestamp；有夏令時間時不可用固定小時數模擬規則。
  hints:
  - 本題才把數據當作 UTC
  - 在 CAST AS DATE 前加 8 小時
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-07-clock
  - sq-metrics-07-contract
  - sq-metrics-01-clocks
  tags:
  - 指標字典
  - 生效日期
  - 時區
- id: sq-metrics-07-p2
  kind: sql
  category: [model, time]
  title: 用生效日選指標版本
  minutes: 8
  level: 3
  dataset: events
  prompt: |
    本題使用 event_at 原本日期，不轉 UTC。示範指標 monitored_events：v1 自 2026-02-02 至 02-03（不含）只數 step='view'；v2 自 02-03 至 02-04（不含）只數 step='pay'。每版按不同 event_id 計數。輸出 business_day、metric_version、event_count，依 business_day 升冪。
  solution: |
    WITH policy(metric_version, begin_day, end_day, included_step) AS (
     VALUES ('v1', DATE '2026-02-02', DATE '2026-02-03', 'view'),
            ('v2', DATE '2026-02-03', DATE '2026-02-04', 'pay')
    ), event_days AS (SELECT event_id, CAST(event_at AS DATE) AS business_day, step FROM app_events)
    SELECT e.business_day, p.metric_version, COUNT(DISTINCT e.event_id) AS event_count
    FROM event_days e JOIN policy p ON e.business_day >= p.begin_day
     AND e.business_day < p.end_day AND e.step = p.included_step
    GROUP BY e.business_day, p.metric_version ORDER BY e.business_day;
  explain: |
    版本按業務日期，而不是當天在哪一日執行。區間兩端都包含會使 02-03 同時納入 v1，不再是單一口徑。
  hints:
  - 讓版本定義自帶日期區間
  - 先算業務日再與區間相接
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-07-effective
  - sq-metrics-07-contract
  - sq-metrics-05-scope
  tags:
  - 指標字典
  - 生效日期
  - 時區
- id: sq-metrics-07-p3
  kind: hands-on
  title: 留下一張可重算的指標卡
  minutes: 4
  steps:
  - 在 C:\dev\conduit-lab\metric-card.md 寫下 monitored_events 的 UTC 來源約定、業務時區、兩版起訖、責任角色與是否重列歷史。
  - 加一個跨午夜時刻與預期業務日，再對照第一題。
  checks:
  - 2 月 3 日只能命中新版，卡片不會以執行當天決定版本。
  - raw_id 11 的測試前提與預期日期有寫清楚。
---

昨晚改了「監測事件數」的條件，今天重算上週，卻再也做不出上週截圖。原因不是 SQL 語法忘了，而是新版覆蓋了舊的規則。指標字典要讓下一位同事能回答：那天的數用哪個定義，又可以怎麼驗？

## 寫成別人能測的條目

指標字典（metric dictionary）記錄從名稱到可執行口徑的約定。先寫決定數字的欄，再加管理欄。下面是一張教學用的條目卡：

| 欄 | 示例 |
| --- | --- |
| 穩定識別碼／顯示名 | monitored_events／監測事件數 |
| 粒度、計量與來源 | 每業務日，不同 event_id 數；來源為事件明細 |
| 限定及時鐘 | 按事件日，時區 Asia/Taipei；接收時間只記截點 |
| 生效版本 | v1 計瀏覽；v2 自 2 月 3 日改計支付；歷史不追溯改寫 |
| 負責角色與驗收 | 營運分析負責口徑，數據值班負責交付；用跨午夜和重送驗證 |

原始值如何帶時區也要寫清楚。生效日期（effective date）若是業務日，就先得到業務日才選版本。版本區間使用含起日、不含迄日：在邊界不能接到兩版，也不能一版都沒接到。若業務要求重列歷史，另外保存重列決議和結果版本，不偷偷替換既有截圖。

## 一個能手算的時區測例

在 SQL 練習場選 `events`，只為下面測例假設第 11 列時間是 UTC。它是 2 月 2 日 23:59；加 8 小時後是 2 月 3 日 07:59，先換時區再取日期，才會歸到 3 日。正式規則如果有夏令時間（daylight saving time），要用具名時區，不用固定加幾小時。

```sql
SELECT raw_id, event_at, CAST(event_at + INTERVAL '8 hours' AS DATE) AS business_day
FROM app_events WHERE raw_id = 11;
```

把你定義的指標抄成一張卡，另加一筆剛好在 UTC 16:00 的測例，再退一分鐘，看業務日是否往前一天。交接時把卡和查詢一起留底，並讓報表可追查使用哪一版。

## 改口徑也要寫退路

把版本條目當成可測的介面。先用舊版重算一個已發出的日期，再用新版重算生效日，存兩份對照。檢查區間交界是否有重疊或空洞；若新版測出錯誤，暫停發布，保留舊版與其執行證據，不要只把標題改回來。兩版若量的是不同事件，趨勢圖銜接處要標註，不能把指標改版引起的斷點解讀成業務大幅波動。寫好負責角色也有用途：當遷移要改時間或歷史重算時，讀者知道找哪一類同事確認。

口徑卡只寫角色，不列個人帳號或具體身分。

## 常見錯誤

- 用新版 SQL 覆寫歷史 → 沒有保留生效規則 → 改成版本區間並寫明是否重列。
- 時區轉完仍算舊日 → 先丟掉時分秒 → 先轉時區再取日期。
- 交接只給一個名稱 → 缺了來源、粒度、公式、角色 → 讓同事用邊界樣本重算。

## 方言與面試

渠成依[時區課的離線規則](#/lesson/sq-expr-07)，以 `INTERVAL '8 hours'` 演示固定 UTC+08:00 偏移；Spark SQL 可實際從 UTC 轉具名時區，MySQL 可用 `CONVERT_TZ`，使用具名時區前須配好時區表。比起單背函式，更值得在兩種引擎都重跑一個跨午夜例子，確認用的是同一業務日。
