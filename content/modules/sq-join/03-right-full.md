---
id: sq-join-03
module: sq-join
order: 3
title: RIGHT 與 FULL JOIN
subtitle: 列出雙方都可能漏掉的編號
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-02
objectives:
- 把 RIGHT JOIN 改寫為等價的 LEFT JOIN
- 用 FULL JOIN 一次列出雙方缺列
- 從未匹配一側取出可追查的鍵
tags:
- right-join
- full-join
- 對帳
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Outer Joins，畫出三種保留範圍。
- title: MySQL：JOIN 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/join.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 JOIN 語法，核對 MySQL 的外連接選項。
concepts:
- id: sq-join-03-right
  prompt: RIGHT JOIN 保留哪一邊的未匹配列？
  answer: 保留右側；把兩個來源調換並改用 LEFT JOIN，可保留相同的列對。
  mcq:
    options:
    - 左側
    - 兩側
    - 只保留匹配列
    - 右側
    answer: 3
    explain: LEFT 與 RIGHT 只差保留方向；FULL 才保留兩邊。
- id: sq-join-03-full
  prompt: FULL JOIN 的結果哪幾類都要有？
  answer: 兩邊配得上的列、僅左存在的列，以及僅右存在的列。
  mcq:
    options:
    - 匹配、僅左、僅右
    - 匹配、僅左
    - 匹配、僅右
    - 只要兩側未匹配
    answer: 0
    explain: FULL 包含配對結果，未匹配的側以 NULL 補上。
  interview:
    question: MySQL 要做全外對帳，你怎麼寫？
    points:
    - LEFT JOIN 搭 UNION ALL
    - 第二段只取右側未匹配
    - 用非空鍵辨認未匹配
    answer: 先用左連接拿匹配和僅左，再交換兩表做左連接，只取原左表的鍵為 NULL 的列。用 UNION ALL 接起來；第二段不能再放一遍已匹配列。
- id: sq-join-03-key
  prompt: 為什麼對帳會輸出 COALESCE(l.id, r.id)？
  answer: 僅右存在時 l.id 是 NULL，改用 r.id 才能保留找得到的鍵。
  mcq:
    options:
    - 自動合併多筆重複鍵
    - 從有值的一側保留鍵
    - 將兩邊鍵相加
    - 刪掉尚未匹配的列
    answer: 1
    explain: COALESCE 取第一個非空值，並不改變列數或修正重複鍵。
practice:
- kind: sql
  category: [join]
  title: 從編制表保留所有部門
  minutes: 6
  level: 1
  dataset: hr
  prompt: |
    以 employees 在左、departments 在右理解 RIGHT JOIN。列出部門與員工編號；籌備處即使沒有員工也要出現，員工編號為 NULL。

    只輸出以下欄位，欄序固定：`dept_id`、`employee_id`。

    排序：`dept_id` 升序，同部門按 `employee_id` 升序。
  solution: |
    SELECT d.dept_id, e.employee_id
    FROM employees AS e RIGHT JOIN departments AS d ON e.dept_id = d.dept_id
    ORDER BY d.dept_id, e.employee_id;
  explain: |
    右邊的籌備處會保留。可等價交換來源，用 departments LEFT JOIN employees；交換時仍須維持指定欄序。
  hints:
  - 要完整列出的名單是 departments。
  - 部門鍵請從保留下來的那側輸出。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-03-right
  - sq-join-02-preserve
  tags:
  - right-join
  - 部門
  id: sq-join-03-p1
- kind: sql
  category: [join, reconcile]
  title: 對齊兩個不同範圍的訂單鍵
  minutes: 10
  level: 2
  dataset: shop
  prompt: |
    左來源是訂單號 1007 至 1021 的 orders（含端點），右來源是訂單號 1014 至 1028 的 refunds（含端點），右側先按訂單號去重。全外連接後列出可追查的訂單號與 `coverage`：兩邊都有給 `both`，只在左給 `left_only`，只在右給 `right_only`。

    只輸出以下欄位，欄序固定：`order_id`、`coverage`。

    排序：`order_id` 升序。
  solution: |
    SELECT COALESCE(l.order_id, r.order_id) AS order_id,
           CASE WHEN l.order_id IS NULL THEN 'right_only'
                WHEN r.order_id IS NULL THEN 'left_only'
                ELSE 'both' END AS coverage
    FROM (SELECT order_id FROM orders WHERE order_id BETWEEN 1007 AND 1021) AS l
    FULL OUTER JOIN (
      SELECT DISTINCT order_id FROM refunds WHERE order_id BETWEEN 1014 AND 1028
    ) AS r ON l.order_id = r.order_id
    ORDER BY order_id;
  explain: |
    1021 有多筆退款，來源先去重才會一單一列。1028 在本題的左來源範圍之外，必須出現為 right_only；這不代表原始 orders 裡沒有 1028。
  hints:
  - 先各自準備來源範圍；FROM 裡括號查詢的結果可以取別名。
  - 分別檢查兩側鍵是否為 NULL。
  - 用 COALESCE 取有值的一側。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-03-full
  - sq-join-03-key
  - sq-join-02-missing
  tags:
  - full-join
  - 對帳
  id: sq-join-03-p2
---

對帳常見的提問是：「在這兩份清單中，誰有、誰沒有？」上一堂只保留左名單；這堂先練另一個方向，再把兩邊都留住。兩邊缺一筆都是訊號，不該因為慣用內連接而在查詢一開始就失去。

## 選保留範圍

- `a RIGHT [OUTER] JOIN b ON 條件`：保留右邊所有列；沒有左列配到時，左欄補 `NULL`。等價形式是 `b LEFT JOIN a ON 同一條件`，但仍應明列輸出欄位，不用 `SELECT *` 來賭欄序。
- `a FULL [OUTER] JOIN b ON 條件`：所有能匹配的列對留下；僅左有、僅右有的列也各自保留。中括號表示可省略。
- 做全外連接（full outer join，台灣也稱完整外部聯結）時，先確認兩份來源是否都是一個對帳鍵一列；兩側都有多列時，匹配部分仍會展開。先按口徑去重或聚合，才有一鍵一列的差異清單。

## 看兩邊各缺什麼

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
SELECT COALESCE(l.dept_id, r.dept_id) AS dept_id,
       l.dept_id AS left_id, r.dept_id AS right_id
FROM (SELECT DISTINCT dept_id FROM employees) AS l
FULL JOIN (SELECT dept_id FROM departments WHERE dept_id >= 2) AS r
  ON l.dept_id = r.dept_id
ORDER BY dept_id;
```

左側是員工「目前部門」的清單，右側是要納入對照的幾個部門。結果中，部門 1 只在左來源，部門 4 只在右來源，部門 2、3 兩側都有。若只顯示左邊的鍵，就會看不出僅右有的那列是 4；若只用內連接，兩邊缺口都看不到。範例的括號查詢就是先取出一份臨時結果，再讓外層把它當表用；[〈CTE 命名步驟〉](#/lesson/sq-compose-04)會示範怎樣讓這種來源讀起來更清楚。

讀差異清單時要把「來源範圍」一起記下來。某鍵在左清單不存在，可能只是左清單有日期或部門篩選；不能直接宣稱生產表漏寫。這個小例用範圍刻意製造缺口，目的是檢查查詢會不會忠實保留它們。

Hive SQL 和 Spark SQL 都有 `FULL OUTER JOIN`；MySQL 8.4 沒有這個連接語法。可先以左連接保留左側和匹配列，再用交換來源的左連接只取原右側未匹配列，最後用 `UNION ALL` 堆疊結果（[〈UNION 與 UNION ALL〉](#/lesson/sq-compose-06)會細講）。兩段互斥，不必依賴去重補救。

## 先只比較鍵，再看欄值

全外連接適合先做覆蓋範圍的盤點：以左鍵和右鍵是否為空分三類。在範例中左側有 3 個鍵，右側也有 3 個鍵，共用 2 個，合起來應有 4 個。若輸出變成 2 列，可能不小心改成了內連接；若變成更多列，先檢查你是否把整份員工表當作了一份部門名單，讓同部門被複製了。

盤完鍵後才值得比較其他欄，例如兩邊對同一部門的名稱是否一致；不宜把名稱也塞進原本對鍵的條件。名稱有變動時，你想將同一部門標成欄值不一致，而不是誤分成一左一右兩個孤立對象。報表設計時把「找同一個對象」和「比較它的內容」拆開，就能看出是哪一類不一致。

## 常見錯誤

- 把 RIGHT 當成讀取順序 → 它定義保留哪一邊，不是在指定引擎先掃哪張表。
- 僅右那列的鍵變成 NULL → 用 `COALESCE(l.dept_id, r.dept_id)` 取非空鍵。
- 對帳結果一鍵多列 → 檢查兩份來源的鍵是否唯一，再決定先去重或先聚合。
