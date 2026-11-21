---
id: sq-compose-02
module: sq-compose
order: 2
title: 相關子查詢
subtitle: 只和同部門的人比較
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-01
objectives:
- 辨認來自外層的欄位引用
- 以同分類或同部門平均比較
- 用別名檢查內外層條件
tags:
- correlated-subquery
- 同組比較
- alias
resources:
- title: DuckDB：子查詢
  url: https://duckdb.org/docs/stable/sql/expressions/subqueries
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Correlated Subqueries，辨認外層引用。
- title: Spark SQL：錯誤條件
  url: https://spark.apache.org/docs/latest/sql-error-conditions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 查相關標量子查詢的單值檢查。
concepts:
- id: sq-compose-02-corr
  prompt: 什麼使子查詢成為相關子查詢？
  answer: 內層使用了外層來源的欄位，結果可能隨外層目前列而變。
  mcq:
    options:
    - 子查詢使用 AVG
    - 查詢結果固定一列
    - 內層引用外層欄位
    - 內層與外層剛好同名
    answer: 2
    explain: 區別在引用與依賴，不在表名、聚合或結果列數。
  interview:
    question: 查高於部門平均的員工，你會預期 SQL 每人必重掃一遍嗎？
    points:
    - 分清邏輯與執行策略
    - 保證同部門比較
    - 以計畫和實測判斷
    answer: 邏輯上每個人使用所屬部門的平均，但引擎可能改寫成分組再連接。我會先驗證平均的口徑和輸出列數，再看執行計畫，不用字面結構猜成本。
- id: sq-compose-02-scope
  prompt: 為何 p2.category = p2.category 不能求出外層商品的同類平均？
  answer: 兩邊都在同一內層，只是在每筆上比較自身，沒有連到外層分類。
  mcq:
    options:
    - 它改成只配同價品
    - 它只匹配外層的商品號
    - 它會自動依外層重算
    - 沒有使用外層分類
    answer: 3
    explain: 別名限定來源；其中一側必須是外層目前列。
- id: sq-compose-02-population
  prompt: 比較目前薪級時，歷史列應在何時排除？
  answer: 內外都要明確限制現行：外層定義被比較的人，內層定義平均用到的薪級。
  mcq:
    options:
    - 內外兩層都排除歷史列
    - 只排除外層歷史列
    - 只排除內層歷史列
    - 在排序後排除
    answer: 0
    explain: 兩層的輸入不同，外層篩選不會自動改寫內層樣本。
practice:
- kind: sql
  category: [cte, aggregate]
  title: 挑出高於同分類均價的商品
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    對每項商品，以同分類所有商品（包含自己）的平均標價為門檻，只取嚴格高於門檻的商品。

    只輸出以下欄位，欄序固定：`category`、`product_id`、`price`。

    排序：`category` 字母或字元升序，同分類按 `product_id` 升序。
  solution: |
    SELECT p.category, p.product_id, p.price
    FROM products AS p
    WHERE p.price > (
      SELECT AVG(q.price) FROM products AS q WHERE q.category = p.category
    )
    ORDER BY p.category, p.product_id;
  explain: |
    茶飲平均約 56.67 元，兩件 60 元的商品都符合；包裝只有一件，自己不會嚴格大於自己的平均。用全店平均會漏掉兩件茶飲。
  hints:
  - 內層 q 是候選商品，p 是現在正在比較的商品。
  - 讓兩側的 category 相等。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-02-corr
  - sq-compose-02-scope
  - sq-compose-01-threshold
  tags:
  - correlated-subquery
  - 均價
  id: sq-compose-02-p1
- kind: sql
  category: [cte]
  title: 比較同部門現行薪級
  minutes: 10
  level: 3
  dataset: hr
  prompt: |
    每位員工只取現行薪級（valid_to 為 NULL），以 employees 目前部門為準。列出現行月薪嚴格高於本部門現行平均的員工，平均包含本人。

    只輸出以下欄位，欄序固定：`dept_id`、`employee_id`、`monthly_pay`。

    排序：`dept_id` 升序，再按 `employee_id` 升序。
  solution: |
    SELECT e.dept_id, e.employee_id, s.monthly_pay
    FROM employees AS e JOIN salary_history AS s ON e.employee_id = s.employee_id
    WHERE s.valid_to IS NULL AND s.monthly_pay > (
      SELECT AVG(st.monthly_pay)
      FROM employees AS t JOIN salary_history AS st ON t.employee_id = st.employee_id
      WHERE t.dept_id = e.dept_id AND st.valid_to IS NULL
    )
    ORDER BY e.dept_id, e.employee_id;
  explain: |
    外層取要比較的現行薪級，內層獨立組成本部門現行樣本。內層混入歷史薪級時，1 號會被誤列為高於部門平均。
  hints:
  - 先在外層取現行薪級。
  - 內層另用一套別名，連完薪級後依外層部門限制樣本。
  - 內層也要排除歷史薪級。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-02-corr
  - sq-compose-02-population
  - sq-join-01-match
  tags:
  - correlated-subquery
  - 薪級
  id: sq-compose-02-p2
---

上一堂讓每件商品和同一條全店門檻比較。營運若改問「哪件商品比同一分類的均價高」，用全店平均就會讓低價分類集體落選。這次門檻跟著外層目前商品的分類走。

## 看懂兩套別名

相關子查詢（correlated subquery，台灣也稱關聯子查詢）是內層可引用外層欄位的子查詢。讀 `FROM products AS p WHERE p.price > (SELECT AVG(q.price) FROM products AS q WHERE q.category = p.category)` 時，先把 `p` 想成手中的一列，再用 `q` 找同類商品。內層知道 `p.category` 來自外層，外層卻不能拿內層的 `q.price` 作為最後輸出欄位。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT p.product_id, p.category, p.price
FROM products AS p
WHERE p.price > (
  SELECT AVG(q.price) FROM products AS q WHERE q.category = p.category
)
ORDER BY p.product_id;
```

例如你手上是商品 101，分類是茶飲。內層只看三個茶飲標價 60、60、50，門檻約 56.67；因此 101、102 都應保留。換成包裝商品，只剩自己那一筆，價格等於平均，不符合嚴格大於。把別名兩側都寫成 `q` 時，條件沒再問外層是哪個分類，這兩個手算反例最容易揭穿它。

相關寫法說明的是結果依賴，不表示引擎必須逐列重掃。面試若被問如何改寫，可以先按分類算平均，再把一類一列的門檻接回商品；這份數據的分類非空，兩種寫法可用同一批列核對。若真實來源分類可能是 `NULL`，先向需求方確認未知分類是否要一起來比較；普通等號不會把兩個缺值視為相等。跨引擎搬之前也重跑這個反例。

Spark SQL 會檢查相關標量子查詢是否滿足單值要求，聚合是本課用來證明單值的方式；DuckDB 和 MySQL 也不能讓比較讀到多個門檻。別把外層每人只算一次理解成內層可省略現行條件。下一堂[〈EXISTS 判斷〉](#/lesson/sq-compose-03)會用相關條件問「是否有」，而不求平均值。

## 換一個母群體驗算

部門平均的題目最容易漏掉薪級版本。先拿部門 2 作抽查：員工 1 的現行月薪 40500 元，部門現行平均 41300 元，應排除。內層若把舊薪級也加進平均，這個人原本不該入選卻會出現。對比時用數據表面板看 `valid_to`：為空表示該段仍有效，不代表薪水欄也沒有值。

不同部門各算一個門檻，但你不需要為 3 個部門各寫一條 SQL。使用相關條件把「所屬部門」交給目前這一列；用現行條件則把「同一個時間口徑」寫在各自讀薪級的範圍。不要讓部門名稱的樣式牽動匹配，因為名稱可能改名；用這份數據的數字部門鍵更容易核對。交付結果只挑幾個要看的欄位，但除錯時可暫時多輸出門檻，看看判斷是否符合手算。

若要排除本人，內層還需要一個不同員工號的條件，這份練習沒有排除。明確說出分母是否含自己比把「平均」兩字交給讀者猜更重要。

## 常見錯誤

- 各類商品好像用同一條門檻 → 看內層條件是否真的引用外層別名。
- 每人比到歷史平均 → 內外兩個來源都寫清楚是否只取現行。
- 內層加按商品分組以後報多列 → 此處要的是目前分類的一個平均，不是每件一個。
