---
id: sq-pattern-07
module: sq-pattern
order: 7
title: 中位數與百分位
subtitle: 偶數筆等待時間取哪個值
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-06
objectives:
  - "用小樣本手算中位數與兩種百分位"
  - "分辨連續插值與實際樣本門檻"
  - "按事件步驟比較 P95 與最大延遲"
tags:
  - "中位數"
  - "百分位"
  - "插值"
resources:
  - title: "DuckDB：Aggregate Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/aggregates"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 median、quantile_cont 與 quantile_disc。"
  - title: "Spark SQL：Built-in Functions"
    url: "https://spark.apache.org/docs/latest/api/sql/index.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "比較 percentile 和 percentile_approx。"
concepts:
  - id: "sql-percentile-cont"
    prompt: "數值 45、45、90、240 的連續中位數是多少？"
    answer: "67.5，取中間兩個的平均。"
    mcq:
      options:
        - "45"
        - "90"
        - "67.5"
        - "105"
      answer: 2
      explain: "45 是下方中間值，90 是上方中間值；105 是四筆的平均，不是中位數。"
    interview:
      question: "工程監控要報延遲 P95，你會先確認什麼？"
      answer: "我會先確定每個樣本是一個事件還是一次接收、延遲用什麼欄位，再確認用插值還是必取實際樣本的定義。報表同時顯示樣本數與最大值，避免一個數字講完整條尾端。"
      points:
        - "樣本粒度與單位"
        - "百分位定義或近似誤差"
        - "樣本數與長尾"
  - id: "sql-percentile-disc"
    prompt: "需求是門檻一定要是樣本中的值，應選哪個？"
    answer: "QUANTILE_DISC；取實際排序位置的值。"
    mcq:
      options:
        - "AVG"
        - "QUANTILE_CONT"
        - "QUANTILE_DISC"
        - "COUNT DISTINCT"
      answer: 2
      explain: "AVG 和連續百分位可能落在兩個值之間；去重計數不是門檻。"
  - id: "sql-percentile-tail"
    prompt: "P95 比最大值小很多，有矛盾嗎？"
    answer: "沒有；最慢少數樣本可能遠離大部分數據，P95 不是最長等待。"
practice:
  - id: "sq-pattern-07-p1"
    kind: "sql"
    category: [percentile]
    title: "商品價格的兩種第九十分位"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "以 `products` 每個分類的商品價格為樣本，同價不同商品各算一筆。輸出 `category`、`samples`（有效樣本數）、`median_price`（連續中位數）、`p90_cont`（連續）、`p90_disc`（離散），依 `category` 升序。"
    solution: |-
      SELECT category, COUNT(price) AS samples, MEDIAN(price) AS median_price,
             QUANTILE_CONT(price, 0.9) AS p90_cont, QUANTILE_DISC(price, 0.9) AS p90_disc
      FROM products GROUP BY category ORDER BY category;
    explain: "不能對價格 DISTINCT 後算分位；相同價格的商品各提供一個樣本。插值可以給出從未標過的價。"
    hints:
      - "先寫每分類一組。"
      - "兩種分位使用相同的 0.9 但不同函式。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-percentile-cont"
      - "sql-percentile-disc"
    tags:
      - "百分位"
      - "中位數"
  - id: "sq-pattern-07-p2"
    kind: "sql"
    category: [percentile, time]
    title: "按步驟量出接收延遲的尾端"
    minutes: 9
    level: 3
    dataset: "events"
    prompt: "面試追問：以每次接收為樣本（重送也算），延遲定義為 `received_at - event_at` 的秒數。每種 `step` 算樣本筆數、離散 P95 與最大延遲。輸出 `step`、`samples`、`p95_seconds`、`max_seconds`，依 `step` 升序。"
    solution: |-
      WITH delays AS (
        SELECT step, EXTRACT(EPOCH FROM (received_at - event_at)) AS seconds
        FROM app_events
      )
      SELECT step, COUNT(*) AS samples, QUANTILE_DISC(seconds, 0.95) AS p95_seconds,
             MAX(seconds) AS max_seconds
      FROM delays GROUP BY step ORDER BY step;
    explain: "逕取最大值不是 P95；反過來 P95 也不能代表最晚的一筆。這題量接收狀況，重送不是重複用戶行為而是另一筆接收樣本。"
    hints:
      - "用 EXTRACT(EPOCH FROM 時間差) 取得秒數。"
      - "定義樣本後，不要再去重到 event_id。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-percentile-disc"
      - "sql-percentile-tail"
      - "sq-expr-06-clocks"
      - "sql-funnel-late"
    tags:
      - "百分位"
      - "事件時間"
---

## 平均不是「大多數等多久」

值班同事看到事件接收偶爾落後 26 小時。要交的不是一個平均數，而是一個能描述尾端的門檻，加上樣本數及最大值。百分位（percentile）先按值排序，再依比例找位置。第 95 百分位（P95）描述高分位的等待時間，不是「最慢的 5% 的平均」，也不是最慢一筆。中位數（median）則在排序中間，不容易被單一超大值拽走。

### 兩種取值方式

- `MEDIAN(x)`：對數值算連續中位數。偶數筆取中間兩筆的平均。
- `QUANTILE_CONT(x, p)`：連續百分位。若 0 起算的位置 `(筆數 - 1) × p` 落在兩筆之間，就按距離插值（interpolation）。
- `QUANTILE_DISC(x, p)`：離散百分位。取累積樣本比例首次達到門檻的實際值；在本課的正比例，等同取第「筆數乘比例並向上取整」筆。

## 用偶數筆先手算，再看結果

在 [自由練習](#/sql?tab=free) 選 `shop`。器皿價格為 45、45、90、240。中位數的連續位置在兩個中間值正中，給 67.5；離散的 P50 取第 2 筆，給 45。P90 的連續位置在第三筆與第四筆間，離散卻直接取第四筆。相同價錢的兩件商品不能合成一件，否則樣本分布變了。

```sql
SELECT product_id, price FROM products WHERE category = '器皿' ORDER BY price, product_id;
```

```sql
SELECT category, COUNT(price) AS samples, MEDIAN(price) AS median_price,
       QUANTILE_CONT(price, 0.9) AS p90_cont, QUANTILE_DISC(price, 0.9) AS p90_disc
FROM products GROUP BY category ORDER BY category;
```

換成延遲報表，每列是一次接收。先將時間差換算為秒，再分步驟聚合。若某組非常小，P95 可能正好等於最大值，不是算錯；看到差很大時也不要單憑兩欄宣布系統正常，要翻回時間差觀察是偶發重送還是集中在某個入口。想量「每個行為第一次收到」是另一個指標，必須先挑副本，不應沿用同一個樣本數。

**方言。** Spark SQL 有精確 `percentile` 和近似 `percentile_approx`；Hive 常用 `percentile_approx` 處理浮點樣本。不能把近似值說成精確的連續百分位。MySQL 面試可用 `ROW_NUMBER` 與總列數找排序位置，取兩側值後再插值，不能直接搬 DuckDB 函式。

### 交付之前，把百分位翻成一句話

例如說「以接收列為單位，約看排序靠後的門檻；這不是所有事件的完成時間。」若有 20 筆樣本，離散 P95 取第 19 筆，可把第 19 和第 20 筆一起列出，讓人看最慢的一筆是否相距很遠。若觀測的是 20 個用戶而非 20 次接收，應重新定義每人如何合併多次等待，不能只把報表的欄名改成用戶。

再做一個不需重跑的核對：用器皿的 4 筆價格手算連續 P90。零起算位置是 2.7，介於 90 和 240，向上走 70% 的差，得到 195。離散位置是第 4 筆，得到 240。若輸出恰好相反，先查選了哪個函式，不要把結果四捨五入到看不出差別。分組為空或價格缺值時也不該用 0 冒充樣本；在交付表留下有效樣本數，才看得到分位數的依據。

## 常見錯誤

- 小組 P95 看起來就是最大值 → 沒看樣本數及分位定義 → 顯示兩欄並手算名次。
- 分位值正好少掉常見價格 → 對值去重改變了分布 → 每件商品留一個樣本。
- 門檻不是任何實際樣本 → 用了連續插值 → 若需求要實際值，改離散定義。
