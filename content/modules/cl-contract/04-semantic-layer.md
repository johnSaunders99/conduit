---
id: cl-contract-04
module: cl-contract
order: 4
title: 指標語義層
subtitle: 兩張圖使用同一個分母
status: ready
minutes: 35
level: 3
prereqs:
- cl-contract-03
objectives:
- 定義付款率的分子、分母、營業日與空值政策
- 使用同一組可加總的計數產生週報與日報
- 用不等樣本量證明不能直接平均日付款率
tags:
- 語義層
- 指標口徑
- 分子分母
- 付款率
resources:
- title: dbt：指標定義概覽
  url: https://docs.getdbt.com/docs/build/metrics-overview
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 比較比率與基礎計數，理解重用口徑。
concepts:
- id: cl-contract-04-metric
  prompt: 茶舖付款率的分母該寫成什麼？
  answer: 在本課口徑是同營業日所建立的所有訂單，含付費與取消；分子才只取付費。
  mcq:
    options:
    - 只計有明細的付款單
    - 該日所有訂單，含取消
    - 付款金額
    - 退款事件數
    answer: 1
    explain: 分母若先排掉取消單，率會被人為提高；數據要從暫存訂單粒度出發。
- id: cl-contract-04-rollup
  prompt: 如果兩日分母不同，週付款率如何彙總？
  answer: 各日付費單數相加、各日全部訂單數相加，再相除。
  mcq:
    options:
    - 日付款率直接相加
    - 取最高一天
    - 把日付款率取平均
    - 分別加總分子分母再相除
    answer: 3
    explain: 日率不具有相同權重；取最大或平均都不是用相同訂單口徑。
  interview:
    question: 日報和週報的付款率對不上，你怎麼查？
    answer: 先拉出兩張圖的原始分子和分母，看範圍、時區、取消單及來源版本是否一致。週率要用整週加總的兩個計數，不平均日率。最後把同一套定義做成可重用模型。
    points:
    - 先對齊母體、日期與版本
    - 加總計數後再相除
    - 回報可手驗樣本
- id: cl-contract-04-null-rate
  prompt: 在報表補出沒有訂單的日子時，付款率應是什麼？
  answer: 分母是 0，率沒有定義，標 NULL；0% 留給有訂單但完全沒付費。
  mcq:
    options:
    - 'NULL'
    - 必定是 0%
    - 必定是 100%
    - 取上一天的數值
    answer: 0
    explain: 缺乏分母與沒有成功事件是不同狀態。
- id: cl-contract-04-semantic-layer
  prompt: 兩張報表重複貼一份正確 SQL，有何長期風險？
  answer: 往後某一份改動納入條件而另一份沒改，口徑分岔；應共用可版本化的定義。
practice:
- id: cl-contract-04-p1
  kind: sql
  category: [dbt, aggregate]
  title: 交付一天一列的付款率零件
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    2026-03-03 至 2026-03-04（含兩端）各有訂單的日子，依序輸出 `order_date`、`paid_count`、`all_count`。所有訂單為分母，已付款為分子，按日期升序。
  solution: |
    SELECT order_date, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
           COUNT(*) AS all_count
    FROM orders WHERE order_date BETWEEN DATE '2026-03-03' AND DATE '2026-03-04'
    GROUP BY order_date ORDER BY order_date;
  explain: |
    先保留所有訂單再做條件計數；若用 WHERE 篩掉取消，分子分母會相等。
  hints:
  - COUNT(*) 算全部，SUM(CASE…) 只算付費
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-04-metric
  - cl-contract-04-semantic-layer
  tags:
  - 語義層
  - 指標口徑
- id: cl-contract-04-p2
  kind: sql
  category: [dbt, aggregate]
  title: 用同一口徑算區間率
  minutes: 7
  level: 3
  dataset: shop
  prompt: |
    以 2026-03-03 至 2026-03-04（含兩端）為同一區間。依序輸出 `paid_count`、`all_count`、`paid_rate`（0 到 1 的比例，不先取整）、`mean_daily_rate`（區間內有訂單各日的付款率直接平均，用於對照）。輸出 1 列，不需排序。
  solution: |
    WITH daily AS (
      SELECT order_date, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d
      FROM orders WHERE order_date BETWEEN DATE '2026-03-03' AND DATE '2026-03-04'
      GROUP BY order_date
    )
    SELECT SUM(n) AS paid_count, SUM(d) AS all_count,
           SUM(n) / NULLIF(SUM(d), 0) AS paid_rate, AVG(n / NULLIF(d, 0)) AS mean_daily_rate
    FROM daily;
  explain: |
    先彙日分子分母，再用總和相除比較正確區間率；`mean_daily_rate` 只是反例。DuckDB 的 `/` 不是整數除法；Hive SQL、Spark SQL、MySQL 不要選 `DIV`。
  hints:
  - 做一個日計數 CTE
  - 分別用 SUM(n) / SUM(d) 和 AVG(n / d)
  check:
    ordered: false
    columnNames: true
  concepts:
  - cl-contract-04-rollup
  - cl-contract-04-null-rate
  - cl-contract-04-metric
  tags:
  - 語義層
  - 指標口徑
- id: cl-contract-04-lab
  kind: build
  title: 交付可重用的付款率定義
  minutes: 7
  steps:
  - 在 dbt-shop 存 payment-rate.md，寫分子、分母、時間範圍、空分母、上游版本與使用方式。
  - 以 App 的日計數作輸入，手算區間率及未加權日率，記錄兩者不同的原因。
  checks:
  - 區間的全單 3、付費 2，付款率為 2/3；日率直接平均為 3/4。
  - 說明無訂單的日期若補出應標 NULL，不當成有分母的 0%。
---

## 同一個指標，不能有兩張配方

經營日報把付款單除以所有下單，另一個圖卻先排除取消單再除。兩張圖名字一樣，解答的是不同問題。語義層（semantic layer）把數據表的欄位翻成業務可重用的指標和分組方式，讓使用者不各自重寫分母。它不是只把欄改成好看的名字，還要定義時間、過濾、粒度和例外。

拿付款率作例子。在此口徑中一張單一票，分子只計已付款，分母保留所有訂單，歸到來源營業日。兩個可加總的原子指標（atomic metrics）是 `paid_count`、`all_count`；付款率是由它們推導的複合指標（composite metric；部分工具也稱衍生指標）。同一日曆下跨不重疊的日可以加總兩個計數，但不能直接平均每天的比率。這個定義也應說明狀態是目前觀測結果；若要「以每日關帳時看到的狀態」，還需要版本或快照。

## 先驗算，再交給兩張圖

在 `shop` 查 3 月 3 至 4 日。當日付費數都是 1，所有訂單數依序 2、1。整段是 2/3，約 66.67%；日率平均則是 (50% + 100%) ÷ 2，等於 75%。差異不是顯示的小數位，而是權重。不要拿只保留付費日期的 `fct_daily_orders` 當分母來源；全部訂單應從一單一列的暫存或等價模型取得。

交付時，日圖可以從日計數取率；週圖用同一個計數模型按財務週選日期後再除。若某天空表仍要在圖上顯示，分母 0，付費率是未定義的 NULL，不是 0%。若有單但付費 0，才是 0%。用這兩個負例檢查圖表是否把空值全補成零。這堂以本機 SQL 示範同一口徑的重用，不啟用任何代管語義服務；正式工具可替你生成聚合，仍需核對產生的查詢和時區。

如果後來想比較不同城市的付款率，需要先選城市角色，例如下單時登記城市，而不是後來搬家的現居地。也要有未知分組，否則城市圖和全站圖使用的分母不一致。即使程式可以順利產生 SQL，日期、角色和權重仍要由指標定義約束。當指標把訂單粒度誤換成品項粒度，一單多品就會得到多票；這正是把分母模型放在共用位置的原因。

將兩份日計數留給使用者，比留一個顯示為百分比的欄更容易查錯。若兩張圖使用的分子與分母都能核對，就能把呈現格式的差異和口徑差異分開。

最值得留存的是能重算兩張圖的同一組計數，而不是截圖上的百分比。

## 方言與常見錯誤

DuckDB 可用 `n / NULLIF(d, 0)` 回傳小數；MySQL、Hive SQL、Spark SQL 的 `DIV` 是整數除法，不應用來算率。跨引擎交付須順便明訂百分比顯示與精度，先算正確比例再顯示。

- 付款率幾乎永遠 100% → 太早篩掉取消單 → 在同一份母體分開計數。
- 週報比日報怪 → 直接把日率平均 → 用計數加總再除。
- 空日變 0% → 把無分母當零成效 → 對零分母回 NULL，文件寫明。
