---
id: sq-window-06
module: sq-window
order: 6
title: 窗口累計
subtitle: 每天收工時帳上有多少
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-05
objectives:
- 明寫從組首到目前列的累計範圍
- 先聚合成每天一筆再累加
- 驗算末列累計是否等於分區總數
tags:
- running-total
- 累計值
- rows
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Framing 與累計的目前列邊界。
- title: MySQL：窗口框
  url: https://dev.mysql.com/doc/refman/8.4/en/window-functions-frames.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀預設框，分辨整組與截至目前。
concepts:
- id: sq-window-06-running
  prompt: ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW 包含哪幾列？
  answer: 同分區內從第一列到目前列，包含目前列，不含未來列。
  mcq:
    options:
    - 目前列與下一列
    - 只包含目前列
    - 分區第一列到目前列
    - 整個分區含未來列
    answer: 2
    explain: 起點和終點都受該組的排序控制，UNBOUNDED 從這個分區的開頭開始。
- id: sq-window-06-daily
  prompt: 日報要每天只留一個日終累計，先做什麼？
  answer: 把明細依營業日聚成一天一列，再對日金額或日張數做窗口累加。
  mcq:
    options:
    - 先對訂單日期做 DISTINCT 再忽略金額
    - 依入庫時間打亂後相加
    - 只加每天第一張單
    - 先按日聚合
    answer: 3
    explain: 先對齊輸出粒度，日終就不會分成同一天的多個階段。
- id: sq-window-06-reset
  prompt: 每位會員各自累加時，哪一處決定何時歸零重新累加？
  answer: 窗口的 PARTITION BY user_id。
  mcq:
    options:
    - PARTITION BY user_id
    - 外層 ORDER BY user_id
    - SELECT DISTINCT user_id
    - ROWS 中只寫 CURRENT ROW
    answer: 0
    explain: 外層排序僅顯示；分區決定哪些列能在同一累計中。
  interview:
    question: 如何交接一張每日付款累計表的自檢？
    points:
    - 先看日粒度
    - 核對首列和最後列
    - 說明品項和付款篩選
    answer: 我先確認每天只有一列。首日累計應等於首日量，最後應等於全期間合計；若按會員分區，也要選兩組確認不會接著上一組的數字加。
practice:
- kind: sql
  category: [window, time]
  title: 付款單的日終累計張數
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    先按 order_date 計算每天的已付款張數 `daily_paid`，只列有已付款單的日期。再輸出從最早一天到當日的累計張數 `running_paid`，日期別名 `day`。

    只輸出以下欄位，欄序固定：`day`、`daily_paid`、`running_paid`。

    排序：`day` 升序。
  solution: |
    WITH daily AS (
      SELECT order_date AS day, COUNT(*) AS daily_paid
      FROM orders WHERE status = 'paid' GROUP BY order_date
    )
    SELECT day, daily_paid,
           SUM(daily_paid) OVER (ORDER BY day
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_paid
    FROM daily ORDER BY day;
  explain: |
    1 月 13、14 日的日量是 1、2，累計是 1、3。若先在訂單上逐列算，1 月 14 日不只一列；若省略窗口排序，就會每列都看到全期合計。
  hints:
  - 先準備一日一列的數據。
  - 用日量做 SUM OVER。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-06-daily
  - sq-window-06-running
  - sq-window-01-rows
  tags:
  - 累計值
  - 每日聚合
  id: sq-window-06-p1
- kind: sql
  category: [window, time]
  title: 每位會員自己的累計付款張數
  minutes: 9
  level: 2
  dataset: shop
  prompt: |
    每位曾付款會員，按其有付款的日期，列該日已付款張數 `daily_paid` 與截至當日的個人累計 `running_paid`。不要補沒有付款的日期。

    只輸出以下欄位，欄序固定：`user_id`、`day`、`daily_paid`、`running_paid`。

    排序：`user_id` 升序，同人按 `day` 升序。
  solution: |
    WITH daily AS (
      SELECT user_id, order_date AS day, COUNT(*) AS daily_paid
      FROM orders WHERE status = 'paid' GROUP BY user_id, order_date
    )
    SELECT user_id, day, daily_paid,
           SUM(daily_paid) OVER (PARTITION BY user_id ORDER BY day
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_paid
    FROM daily ORDER BY user_id, day;
  explain: |
    每人首日累計應等於當日張數；不分區會把他人也算進來。會員 1 最後應為 37，不是全店合計。
  hints:
  - 先一人一日一列。
  - 每遇一個新會員，要從自己的第一天開始累加。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-06-reset
  - sq-window-06-running
  - sq-window-02-sort
  tags:
  - 累計值
  - 分區
  id: sq-window-06-p2
---

營運不只要每日付款量，也想看「截至這天，累積多少張付款單」。把每一天的數字算好是第一步；第二步把從最早一天到當天的數字加起來。這樣一張報表能同時對帳當日變化和到目前為止的合計。

## 明寫累計的起點與終點

- `SUM(daily_paid) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`：累計值（running total，台灣也稱累積總和）從組首加到目前列。`UNBOUNDED PRECEDING` 表示該組第一列，`CURRENT ROW` 表示包括當前這一天。
- 只有一組全店數據時不分區；要讓每位會員另外起算，在窗口排序前加 `PARTITION BY user_id`。
- 日期可能有幾張訂單，所以先 `GROUP BY order_date`。按會員寫時，分組的鍵是會員加日期；少任何一欄都改變「一列」的含義。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
WITH daily AS (
  SELECT refund_date AS day, SUM(amount) AS daily_refund
  FROM refunds GROUP BY refund_date
)
SELECT day, daily_refund,
       SUM(daily_refund) OVER (ORDER BY day
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_refund
FROM daily ORDER BY day;
```

退款的前兩個出現日期是 1 月 18 日和 1 月 22 日，日額各為 10 元；累計是 10 元、20 元。用兩天手算即可確認沒有把未來列算進第一天。退款範例最後一天的累計應等於全部退款金額。換成付款單後，最後一天的累計應等於相同口徑的總張數；兩者不一致時，優先檢查有沒有遺漏日期或把取消單帶進來。

沒有事件的日期不會因為用了窗口而新出現。此處題目只要有付款的日子；若要讓折線圖每日都有點，須先建立日曆，[〈缺日補零〉](#/lesson/sq-pattern-10)會介紹。於逐筆流水而非日報，也可先保留一列一單，改用日期和唯一單號一起排序；否則同日哪張單先計入仍不明確。

DuckDB、Hive SQL、Spark SQL、MySQL 的這種 `ROWS` 開始到目前列寫法一致。若省去框，帶排序的聚合窗口可能讓同值列一起算入；別期望每列必逐筆加。下一堂[〈ROWS 與 RANGE〉](#/lesson/sq-window-07)會拿同價商品做反例。

## 從第一個不合理的累計值倒查

假設 13 日有 1 張、14 日有 2 張、15 日又有 2 張；三個截至當日的累計應是 1、3、5。你可以從第二列往回驗：第二列的累計減第一列的累計，應剛好是第二天的日量。只要第一處對不上，就用同一天的付款紀錄回查原始張數，分辨問題是日量算錯，還是窗口吃錯了範圍。要測重複日期的錯法，不要只挑一天一張的日子。

同樣地，個人累計不能拿店鋪累計來猜。練第二題時查兩位會員，兩人的起點可能是不同日期，也沒有義務補同一份日曆；第一筆個人累計只等於自己首日的付款張數。若希望拿一份報表比較每位會員從入會開始的趨勢，要先重新定義日期基準，不能僅把顯示順序改成會員號。

最後，張數是非負，因此累計只能不減；若換成含沖銷的金額流水，累計可能下降。檢查應貼合指標，別把「一定上升」當成所有累計的性質。

## 常見錯誤

- 所有日期都顯示同一總量 → 缺少窗口排序與累計範圍。
- 一天好幾列 → 先按目標報表粒度聚合，才對各日作窗口。
- 換會員以後累計接續前一人 → 在窗口內依會員分區。
