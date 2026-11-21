---
id: sq-window-01
module: sq-window
order: 1
title: OVER 與分區
subtitle: 保留每筆又看得到組別均價
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 在保留明細的結果附上組均值
- 用空 OVER 計算全體基準
- 數出窗口與 GROUP BY 的輸出差異
tags:
- over
- partition-by
- 窗口函式
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 OVER 與分區範例，驗證列數不變。
- title: Hive SQL：窗口函式
  url: https://hive.apache.org/docs/latest/language/languagemanual-windowingandanalytics/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Hive 的 PARTITION BY 和聚合窗口。
concepts:
- id: sq-window-01-rows
  prompt: AVG(...) OVER(PARTITION BY category) 會將同分類壓成一列嗎？
  answer: 不會。它把分類均值附在每件商品那一列；GROUP BY 才會產生每組一列。
  mcq:
    options:
    - 會，結果只剩分類欄位
    - 不會，每件商品仍有一列
    - 會，每分類只有一列
    - 會，只剩最高價那列
    answer: 1
    explain: 是否壓列看查詢是否用了分組聚合。窗口本身不改輸入列的數量。
  interview:
    question: 想顯示每位員工和部門平均，GROUP BY 還是窗口？
    points:
    - 指出保留的人員粒度
    - 按部門分區
    - 檢查輸入的現行口徑
    answer: 我要保留每人一列，所以用 AVG OVER 按部門分區。先排除歷史薪級，再查一個部門是否仍有原本的人數、平均在同組是否一致。
- id: sq-window-01-partition
  prompt: 窗口分區是把數據寫進不同檔案嗎？
  answer: 不是。它在本次查詢中決定哪些列一起計算，不改原表的存放方式。
  mcq:
    options:
    - 是，每個分區變一張常駐表
    - 不是，和 ORDER BY 完全相同
    - 不是，只決定本次計算同組有哪些列
    - 是，會重寫原表檔案
    answer: 2
    explain: 窗口分區是查詢邏輯，與實體分區或輸出排序不同。
- id: sq-window-01-whole
  prompt: 把 PARTITION BY category 改成空的 OVER() 時，平均範圍是什麼？
  answer: 整個窗口看到的輸入列；同一個平均值可附在每列。
  mcq:
    options:
    - 目前列的前一筆
    - 分類中最高價的兩列
    - 每列只算自己
    - 整份視窗輸入
    answer: 3
    explain: 沒有分區時大家在一組；先前 WHERE 仍然會影響窗口輸入。
practice:
- kind: sql
  category: [window]
  title: 在商品旁標出分類均價
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    每件商品都出現一列，以同分類所有商品的平均標價為 `category_avg`。也輸出原價。

    只輸出以下欄位，欄序固定：`product_id`、`category`、`price`、`category_avg`。

    排序：`product_id` 升序。
  solution: |
    SELECT product_id, category, price, AVG(price) OVER (PARTITION BY category) AS category_avg
    FROM products ORDER BY product_id;
  explain: |
    結果仍有 8 列。兩個 60 元的茶飲與 50 元紅茶的分類均價一致；GROUP BY category 則只會留下分類合計，不是原品項。
  hints:
  - 要保留明細，讓 AVG 後面跟 OVER。
  - 分類用來分窗口的計算範圍。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-01-rows
  - sq-window-01-partition
  - sq-compose-02-population
  tags:
  - over
  - partition-by
  id: sq-window-01-p1
- kind: sql
  category: [window]
  title: 同時顯示部門與全公司薪級基準
  minutes: 9
  level: 2
  dataset: hr
  prompt: |
    只取現行薪級，按員工目前部門比較。在每位員工列輸出月薪、該部門現行平均 `dept_avg`、全公司所有員工（每人同權）的現行平均 `company_avg`；不為空部門造列。

    只輸出以下欄位，欄序固定：`employee_id`、`dept_id`、`monthly_pay`、`dept_avg`、`company_avg`。

    排序：`employee_id` 升序。
  solution: |
    SELECT e.employee_id, e.dept_id, s.monthly_pay,
           AVG(s.monthly_pay) OVER (PARTITION BY e.dept_id) AS dept_avg,
           AVG(s.monthly_pay) OVER () AS company_avg
    FROM employees AS e JOIN salary_history AS s ON e.employee_id = s.employee_id
    WHERE s.valid_to IS NULL
    ORDER BY e.employee_id;
  explain: |
    先篩成每人一筆現行薪級，再在同一個輸入上指定兩種窗口。本題不先算部門均值再平均；人數不同的部門不應同權。
  hints:
  - 先把目前編制與現行薪級連好。
  - 兩個 AVG 各有自己的 OVER。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-01-whole
  - sq-window-01-rows
  - sq-join-01-match
  - sq-compose-02-population
  tags:
  - over
  - 分區
  - 薪級
  id: sq-window-01-p2
---

商品表用了 `GROUP BY category` 之後，只剩分類均價，但採購還想看到每一件商品。窗口函式（window function，台灣也稱視窗函數）讓你在保留原列的同時，把一個相關範圍的計算結果附上去。今天的成品是能逐件核對的價目表，不是另一張分類摘要。

## 三個層次先分開

- `AVG(price) OVER (PARTITION BY category)`：`AVG` 是運算，`OVER` 指定這個運算可看到哪些列。窗口分區（window partition；台灣也稱視窗分割區）按分類分組，每筆商品都看同一分類的所有同伴。
- `AVG(price) OVER ()`：沒有分區，全體輸入看成一組。這裡的「全體」是查詢篩選後的輸入，不是永遠指整張原表。
- `AVG(price) … GROUP BY category`：一般聚合時，每個群組只保留結果一列。窗口則可在同一份輸出同時顯示商品號、自己的價格和分類均價。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT product_id, category, price,
       AVG(price) OVER (PARTITION BY category) AS category_avg,
       AVG(price) OVER () AS shop_avg
FROM products ORDER BY product_id;
```

結果仍有 8 列。其中 3 件茶飲共享約 56.67 元的分類均價，但各自保有原本標價；全店均價 88.75 元則在每列相同。拿掉窗口、只按分類做 `AVG`，會剩 3 個分類；這個列數對照比只看均價更能證明你保住了明細。別把重複顯示的分類均價再拿來相加：它們是同一個基準複製到不同商品，不是多次發生的交易。

分區是在查詢內劃出計算對象，未將數據表搬到新的實體分區，也沒指定結果畫面排序。若之後只從結果顯示部分商品，先決定是先縮小樣本再算均值，還是用完整樣本算完再由外層挑出要顯示的列。

Hive SQL、Spark SQL、MySQL 都可用本課的 `AVG … OVER (PARTITION BY …)`。方言差異會出現在後面進階功能，例如 DuckDB 有窗口計算後的 `QUALIFY`；[〈ROW_NUMBER〉](#/lesson/sq-window-03)會先用跨引擎好移植的外層篩選寫法。這裡不要先把窗口放到 `WHERE`。

## 同時看整組與子組，不用把明細接回兩次

注意 101 和 105 都屬茶飲，因此顯示同一分類均值，但各自價格是 60 和 50；兩列的全店均價也仍是同一個 88.75。若你想知道某筆比分類均價高幾元，只需在選欄中用原價減分類均價，再保留商品號。先別把基準四捨五入成整數，否則差距很小的幾筆可能在「高於」和「等於」之間被判錯。

切換到薪級表時，輸入先限定為現行有效，每人各算一次。公司平均的分母是所有輸入員工，不是分區的個數；這份示例各個非空部門人數剛好一樣，但實務部門常不同大，不能用各部門的均值再平均來替換。若你要快速驗證這一點，可以設想一部門只有一人拿 30000，另一部門有三人都拿 50000；全公司應按四人算出 45000，不是把兩個部門平均成 40000。

若成品只想畫各部門的一根柱，就回到一般聚合，不必先做窗口再去重。兩種工具都合理，差別是最後要拿到什麼粒度。

## 常見錯誤

- 商品號找不到或明細被壓掉 → 若要保留每件商品，用窗口而非一般 GROUP BY。
- 所有商品只有同一分類均值 → 檢查是否漏了 PARTITION BY。
- 只顯示一個分類，卻以為全體基準沒變 → WHERE 會先限制窗口看得到的列。
