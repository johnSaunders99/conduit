---
id: sq-db-09
module: sq-db
order: 9
title: 按列儲存與欄式儲存
subtitle: 讀三欄不必搬整列
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-08
objectives:
- 用相鄰儲存的欄位說明行式及列式各自的讀寫代價
- 寫出只讀所需欄位的彙總並辨認不必要讀取
tags:
- 按列儲存
- 欄式儲存
- 投影下推
resources:
- title: Apache Parquet：檔案格式
  url: https://parquet.apache.org/docs/file-format/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 row group 與 column chunk 的關係。
- title: PostgreSQL：數據頁配置
  url: https://www.postgresql.org/docs/current/storage-page-layout.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看頁中列項目與列頭結構。
concepts:
- id: sq-db-09-layout
  prompt: 為何只彙總金額的分析常適合列式？
  answer: 同欄的值一起存，能只取必要欄位，通常也較容易壓縮。
  mcq:
    options:
    - 保證完全不掃數據
    - 只讀需要的欄位區塊
    - 會自動排除所有錯單
    - 每次更新整列都更便宜
    answer: 1
    explain: 篩選和相接依賴的欄仍可能要讀；儲存形式不代替業務條件。
- id: sq-db-09-projection
  prompt: 查詢只顯示總金額，為何仍需讀商品編號？
  answer: 若 WHERE 依商品編號篩選，運算仍需要那欄；下推會保留被依賴的欄。
  mcq:
    options:
    - 輸出只有一欄就必定只讀一欄
    - 選 SELECT * 會少讀
    - 商品編號用在篩選
    - 壓縮能令條件欄消失
    answer: 2
    explain: 所需欄位包括結果、篩選、相接和算式所引用者。
- id: sq-db-09-tradeoff
  prompt: 單張訂單常被整列讀出與更新，哪種配置可先考慮？
  answer: 行式可把同一張訂單的欄位靠在一起，配索引支援單列查找；仍以真實負載量測。
  mcq:
    options:
    - 一定用列式加全表聚合
    - 檔案越大一定越快
    - 先把每欄複製到訂單表
    - 先評估行式與關鍵查找索引
    answer: 3
    explain: 點查更新和掃少量欄位做彙總，在意的成本不同。
  interview:
    question: 何時保留交易庫，又給分析另做列式副本？
    answer: 線上系統有大量小寫入或點查，我會保留擅長這類工作的交易庫；報表若大量掃時間範圍內幾欄，就評估以 Parquet 或列式數據庫供分析，把同步延遲與結果核對列入驗收。
    points:
    - 分開點查寫入和掃描
    - 明說同步延遲
    - 測量掃描和結果一致性
practice:
- id: sq-db-09-p1
  kind: sql
  category: [select, plan]
  title: 找出只需兩欄的標價摘要
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    依 products 分類彙總標價。輸出 category、product_count、avg_price，依 category 字串升冪；不加四捨五入。
  solution: |
    SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
    FROM products GROUP BY category ORDER BY category;
  explain: |
    聚合只用 category 與 price；COUNT(*) 不要求逐欄讀出品名。不可用 AVG(DISTINCT price)，那會吞掉同價商品。
  hints:
  - 計數不要按價格去重
  - 只投影分類與摘要
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-09-layout
  - sq-db-09-projection
  tags:
  - 按列儲存
  - 欄式儲存
  - 投影下推
- id: sq-db-09-p2
  kind: sql
  category: [expression, plan]
  title: 計算指定訂單明細金額
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    只掃 order_items，計算 1001 至 1005 的單內金額。輸出 order_id、gross_amount（qty × unit_price 加總），依 order_id 升冪。
  solution: |
    SELECT order_id, SUM(qty * unit_price) AS gross_amount
    FROM order_items WHERE order_id BETWEEN 1001 AND 1005
    GROUP BY order_id ORDER BY order_id;
  explain: |
    所需三欄是 order_id、qty、unit_price；product_id 和 line_no 不參與。把產品現價加進查詢不只多讀一張表，還改了金額口徑。
  hints:
  - 先列出篩選與算式依賴的欄
  - 按訂單號聚合
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-09-projection
  - sq-db-09-tradeoff
  - sq-db-02-price
  tags:
  - 按列儲存
  - 欄式儲存
  - 投影下推
---

客服把一張訂單的狀態從未出貨改為出貨；營運則掃一個月的訂單，只要日期、數量與金額。即使查同樣的業務，兩者需要從儲存裡搬動的數據不同。今天從「數據怎麼擺」解釋這個差異，最後在計畫裡指出哪些欄位真的要讀。

## 按列存與按欄存，不是列欄轉換

和[第一堂 SQL](#/lesson/sq-read-01)一樣，渠成稱一筆紀錄為「列」、屬性為「欄」。**按列儲存**（row-oriented storage）把同一筆紀錄的各欄放近；**欄式儲存**（columnar storage）讓同欄的值按區塊放近。中國大陸文件常把兩者稱為「行式儲存」與「列式儲存」。看見有歧義的「列式」時，先確認是按筆存，還是按欄存；查詢結果的形狀不會因儲存方式改變。

- 按列儲存：讀某張單的整筆欄位通常集中，可用索引定位；但掃大量紀錄只要三欄時，頁中常還有其他欄位。
- 欄式儲存：適合掃大量列的少數欄位，同欄相似的型別和值也有利於壓縮；點查重組整列，或頻繁小更新，不是這種配置的強項。
- Parquet 是可供分析引擎讀的欄式檔案格式，不是數據庫。列群組（row group，大陸常稱行組）是一段紀錄；其內各欄分開成欄位區塊（column chunk）。

## 先預測會讀什麼

在 DuckDB SQL 練習場選 `shop`。先圈出依賴：訂單號要篩選也要輸出，件數和成交價要計算，商品名稱完全不需要。下面看計畫，再去跑同一查詢的結果。投影下推（projection pushdown）讓儲存掃描只取所需欄位；篩選下推（filter pushdown）則讓可下推的條件更靠近掃描，是否能跳過區塊仍要看統計和格式。

```sql
EXPLAIN
SELECT order_id, SUM(qty * unit_price) AS gross_amount
FROM order_items WHERE order_id BETWEEN 1001 AND 1005
GROUP BY order_id ORDER BY order_id;
```

讀取更少欄位是有條件的。若用 `SELECT *` 拉回全部欄，或把大字串加進篩選，還是要讀它。不要拿小樣本的毫秒數承諾真實加速，記下計畫中的投影與條件即可。

## 先數需要的欄，不猜讀取量

假設每張訂單有 20 個欄，只有 3 個用於月報，不能直接承諾「讀取量就是原本的十分之幾」。欄寬不一樣、壓縮比不同，掃描還可能讀檔案統計和索引。能先確定的是：算式與條件沒用到的欄不必進入計算。你可以分開記下結果的欄數、掃描所需的欄和引擎實際量到的時間；若其中一條沒有量到，就如實留空，不用估算冒充。

## 常見錯誤

- 以為欄式儲存會自動把同一欄的值去重 → 壓縮不是刪列 → 查詢仍按原有紀錄數計算。
- 查三欄卻拉全表回程式 → 欄位挑選做得太晚 → 先在 SQL 選需要的欄。
- 用報表掃描結論替代更新測試 → 負載不同 → 分別測點查寫入與分析掃描。

## 方言與面試

Spark SQL 用 `CREATE TABLE … USING PARQUET` 明確指向檔案格式；MySQL InnoDB 一般表不是這種寫法。DuckDB 可掃 Parquet 也能分析自己的欄式表，不能把兩者的統計與掃描表現視為相同。之後在[〈OLTP 與 OLAP〉](#/lesson/sq-model-01)會用這個取捨拆分工作負載。
