---
id: sq-join-04
module: sq-join
order: 4
title: CROSS JOIN
subtitle: 展開日期乘門市的空格
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-03
objectives:
- 預測交叉連接的列數
- 列出日期與部門的完整組合
- 先建格子再顯示缺少的營運數據
tags:
- cross-join
- 笛卡兒積
- 補格
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Cross Joins，對照兩側筆數相乘。
- title: MySQL：JOIN 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/join.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的 INNER 與 CROSS 語法差異。
concepts:
- id: sq-join-04-product
  prompt: 3 個日期和 4 個部門交叉連接有幾列？
  answer: 12 列，每個日期都配每個部門。
  mcq:
    options:
    - 12 列
    - 7 列
    - 4 列
    - 3 列
    answer: 0
    explain: 逐對配出所有組合，所以不是相加或取一側筆數。
  interview:
    question: 要做兩個營業日的門市補零報表，怎麼避免漏格？
    points:
    - 先決定日期與門市清單
    - 再接已聚合的事實
    - 核對日期數乘門市數
    answer: 我先把兩天和完整的門市清單展開，再左接每個日店一列的銷售數。不賣也有格子；我會核對格子數是否等於兩天乘門市數。
- id: sq-join-04-domain
  prompt: 想看沒訂單的日期，為何不能只從 orders 取日期？
  answer: 沒有訂單的日期根本沒有來源列；應從指定日曆或日期清單定義範圍。
  mcq:
    options:
    - COUNT 會主動補日
    - 來源不含沒發生訂單的日子
    - SQL 無法比較日期
    - 日期一定要用現成字串
    answer: 1
    explain: 先定義應有的格子，聚合才有位置可填。
- id: sq-join-04-zero
  prompt: 為何要先聚合再把銷售量接上格子？
  answer: 聚合到格子的粒度，每個格子只配上一列數值，才不會展開回明細。
  mcq:
    options:
    - 保證一天只有一單
    - 把缺值自動變零
    - 保持一格一列
    - 讓 CROSS JOIN 不用掃表
    answer: 2
    explain: 格子和指標用同一組鍵才能保住粒度；補零另做。
practice:
- kind: sql
  category: [join]
  title: 建立兩天的四部門盤點格
  minutes: 6
  level: 1
  dataset: hr
  prompt: |
    將 2026-02-01、2026-02-02 各配上所有部門。可用 `(VALUES (DATE '2026-02-01'), (DATE '2026-02-02')) AS days(day)` 建立一欄兩列的日期清單。

    只輸出以下欄位，欄序固定：`day`、`dept_id`。

    排序：`day` 升序，同日按 `dept_id` 升序。
  solution: |
    SELECT days.day, d.dept_id
    FROM (VALUES (DATE '2026-02-01'), (DATE '2026-02-02')) AS days(day)
    CROSS JOIN departments AS d
    ORDER BY days.day, d.dept_id;
  explain: |
    每天 4 格，共 8 格。若從 employees 推導部門，會缺無員工的部門 4。
  hints:
  - 日期清單放一側，departments 放另一側。
  - 交叉連接不需要 ON。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-04-product
  - sq-join-04-domain
  - sq-join-03-right
  tags:
  - cross-join
  - 網格
  id: sq-join-04-p1
- kind: sql
  category: [join, missing-values]
  title: 補齊兩天各狀態的訂單張數
  minutes: 10
  level: 2
  dataset: shop
  prompt: |
    日期只取 2026-01-13、2026-01-14；每天都要有 `cancelled` 和 `paid` 兩種狀態。接上 orders 按同日同狀態的訂單張數，沒有訂單時 `order_count` 為 0。

    只輸出以下欄位，欄序固定：`day`、`status`、`order_count`。

    排序：`day` 升序，同日按 `status` 字母升序。
  solution: |
    SELECT days.day, states.status, COALESCE(a.order_count, 0) AS order_count
    FROM (VALUES (DATE '2026-01-13'), (DATE '2026-01-14')) AS days(day)
    CROSS JOIN (VALUES ('cancelled'), ('paid')) AS states(status)
    LEFT JOIN (
      SELECT order_date, status, COUNT(*) AS order_count
      FROM orders GROUP BY order_date, status
    ) AS a ON a.order_date = days.day AND a.status = states.status
    ORDER BY days.day, states.status;
  explain: |
    張數的粒度與格子相同，用日期與狀態兩個鍵。只接日期會讓 paid 張數也跑到 cancelled 格；兩天取消數都應為零。
  hints:
  - 先有 2 日乘 2 狀態的格子。
  - 按日期及狀態預先聚合。
  - 只把沒配到的張數由 NULL 改成 0。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-04-product
  - sq-join-04-zero
  - sq-join-02-preserve
  tags:
  - cross-join
  - 補零
  id: sq-join-04-p2
---

主管要看一張盤點表，日期是列、部門是欄。這堂先把每個「日期 × 部門」做成一列；不論那天的盤點表有沒有紀錄，格子都必須存在。如果先從既有紀錄找日期和部門，恰好沒有紀錄的組合就沒有位置可以顯示。

## 先建立座標，再填數字

交叉連接（cross join，台灣也稱交叉聯結）用 `FROM 左來源 CROSS JOIN 右來源`，這裡不寫 `ON`。左表每列都與右表每列配對，全部組合叫笛卡兒積（Cartesian product，也稱直積）。左 2 列、右 4 列，結果就是 8 列；只要一側是空表，結果就是 0 列。若一側清單的鍵有重複，重複也會參與配對，所以數量要以實際列數計，不是不同值的個數。

`VALUES` 可直接列出少量常值，每組括號是一列；`AS days(day)` 把這個來源命名為 `days`，把第一欄命名為 `day`。本例用 `DATE '2026-02-01'` 指定日期類型，不靠引擎自動把字串猜成日期。

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
SELECT days.day, d.dept_id, d.dept_name
FROM (VALUES (DATE '2026-02-01'), (DATE '2026-02-02')) AS days(day)
CROSS JOIN departments AS d
ORDER BY days.day, d.dept_id;
```

應得到 8 格，兩天都有部門 4。把日期清單縮成一天再跑一次，應剩 4 格；可用這個變化檢查自己不是在配對相同鍵，而是在展開所有組合。真正報表接回數值時用 `LEFT JOIN`，因為格子是完整清單。以「日期、部門」去對數值表就不能少用任一欄，也別先把整張明細表硬接上去。數值先聚合到一格一筆，輸出才可直接拿來填表。

補零不能一律套用。沒有成交時，張數通常是 0；但沒有溫度讀值不代表 0 度。建格子是為了顯示缺失，如何填缺失取決於這項指標的業務定義。[〈缺日補零〉](#/lesson/sq-pattern-10)會把日期範圍擴成有缺日的時間序列。

MySQL 的 JOIN 語法把 `JOIN`、`CROSS JOIN` 與 `INNER JOIN` 視為語法上的等價選項；Hive SQL 與 Spark SQL 也各有 CROSS JOIN。跨引擎交接仍用顯式的 `CROSS JOIN` 表示「刻意全配」，用 `INNER JOIN … ON` 表示「按條件配對」。本課的日期常值表寫法以 DuckDB 為準。

## 先估規模，再決定要展開什麼

完整格子的日期與部門清單不必來自同一張表。舉例說明，籌備處還沒有員工，也可能有開店前的盤點任務；若先從員工表抽出現有部門，兩天都會少一格。先以部門表定義完整範圍，才不會由「曾經出現」反推「應該出現」。練第二題時同樣要先定義兩種狀態，不能只看到當天有付款，就把取消欄整個省去。

注意不要為了完整就不加範圍：日報只做兩天，先定兩天才配對。拿全年的日期乘上所有部門，再寫好幾個篩選，語意會更難讀。你要能在執行前口頭預告這次結果格數，以及其中哪些格子的數字為零。第二題就是一個簡短驗法：應正好 4 格，若有 6 格，先查配對是否有漏掉第二個鍵。

## 常見錯誤

- 列數突然暴增 → 先估算兩側列數相乘；若不是要全部組合，回頭補真正的配對鍵。
- 沒數據的日子仍不見 → 日期來源只取事件表會漏掉空日，應先指定完整日期清單。
- 同格子出現多列 → 把數值先按格子的全部鍵聚合，再接上去。
