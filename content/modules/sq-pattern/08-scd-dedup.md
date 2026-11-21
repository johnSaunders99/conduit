---
id: sq-pattern-08
module: sq-pattern
order: 8
title: 拉鏈區間去重
subtitle: 兩段有效期不要同時命中
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-07
objectives:
  - "用左閉右開條件查指定日期有效的薪級"
  - "按員工數命中版本，識別重疊或缺漏"
  - "說明何時應隔離數據而非任選一列"
tags:
  - "拉鏈表"
  - "有效期"
  - "數據質量"
resources:
  - title: "DuckDB：FROM and JOIN Clauses"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/from"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看 LEFT JOIN 如何保留找不到版本的員工。"
  - title: "DuckDB：Date Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/date"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "核對 DATE 邊界與比較使用的類型。"
concepts:
  - id: "sql-zipper-boundary"
    prompt: "舊版迄日與新版起日都是 2/1，以半開區間查 2/1 應命中哪筆？"
    answer: "只命中新版；起日算、迄日不算。"
    mcq:
      options:
        - "舊版"
        - "新版"
        - "兩個都算"
        - "兩個都不算"
      answer: 1
      explain: "把迄日寫成包含式才會兩筆都中。"
    interview:
      question: "同一位員工命中兩筆生效薪級時怎麼辦？"
      answer: "我先確認區間用左閉右開，再用命中數把異常員工標出。除非業務有明定修訂優先序，不能靠 DISTINCT 或任取最新版去掩蓋重疊。"
      points:
        - "區間邊界及 NULL 迄日"
        - "先量命中數"
        - "修訂須有明確優先規則"
  - id: "sql-zipper-match"
    prompt: "LEFT JOIN 後用哪個計數能得到 0 個匹配？"
    answer: "數右側不為 NULL 的起日。"
    mcq:
      options:
        - "COUNT(*)"
        - "COUNT(左表員工鍵)"
        - "COUNT(右表起日)"
        - "COUNT(右表迄日)"
      answer: 2
      explain: "左表仍有一列；沒有迄日的現行版本也算有效，不能數迄日。"
  - id: "sql-zipper-conflict"
    prompt: "兩個重疊版本薪資相同，DISTINCT 可以取代命中數檢查嗎？"
    answer: "不可以；數值相同仍可能是兩筆不同版本，重疊應另外診斷。"
practice:
  - id: "sq-pattern-08-p1"
    kind: "sql"
    category: [scd, join]
    title: "換薪當天的有效薪級"
    minutes: 6
    level: 2
    dataset: "hr"
    prompt: "以 `employees` 為名冊，配 2026-02-01 生效的 `salary_history`。含起日、不含迄日，NULL 迄日為開放終點，找不到亦保留員工。輸出 `employee_id`、`valid_from`、`monthly_pay`，依 `employee_id` 升序。"
    solution: |-
      WITH candidates AS (
        SELECT e.employee_id, h.valid_from, h.monthly_pay
        FROM employees e LEFT JOIN salary_history h
          ON h.employee_id = e.employee_id
          AND h.valid_from <= DATE '2026-02-01'
          AND (h.valid_to > DATE '2026-02-01' OR h.valid_to IS NULL)
      )
      SELECT employee_id, valid_from, monthly_pay FROM candidates ORDER BY employee_id;
    explain: "2/1 是換薪邊界，不可用兩端含入的 BETWEEN。現行版本可能沒有迄日，不等於未知薪資。"
    hints:
      - "起日 <= 查詢日。"
      - "檢查迄日晚於查詢日，或迄日為 NULL。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-zipper-boundary"
      - "sq-join-02-preserve"
      - "sql-zipper-match"
    tags:
      - "拉鏈表"
      - "有效期"
  - id: "sq-pattern-08-p2"
    kind: "sql"
    category: [scd, reconcile]
    title: "抓出雙重命中的薪級"
    minutes: 9
    level: 3
    dataset: "hr"
    prompt: "面試追問：用 CTE 在 `salary_history` 追加測試版 `(1, DATE '2026-01-20', DATE '2026-03-01', 39900)`，不要修改原表。以名冊查 2026-02-01，按同樣左閉右開規則，列出命中數不是 1 的員工。輸出 `employee_id`、`matching_versions`，依 `employee_id` 升序。"
    solution: |-
      WITH history AS (
        SELECT * FROM salary_history
        UNION ALL SELECT 1, DATE '2026-01-20', DATE '2026-03-01', 39900
      ), candidates AS (
        SELECT e.employee_id, h.valid_from, h.monthly_pay
        FROM employees e LEFT JOIN history h
          ON h.employee_id = e.employee_id
          AND h.valid_from <= DATE '2026-02-01'
          AND (h.valid_to > DATE '2026-02-01' OR h.valid_to IS NULL)
      )
      SELECT employee_id, COUNT(valid_from) AS matching_versions
      FROM candidates GROUP BY employee_id HAVING COUNT(valid_from) <> 1
      ORDER BY employee_id;
    explain: "員工 1 必須顯示命中 2 筆；未配對時應計為 0。排名先取一筆會讓檢查永遠看不到重疊。"
    hints:
      - "用 UNION ALL 追加測試版。"
      - "先計右側起日，HAVING 留下異常。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-zipper-boundary"
      - "sq-join-02-preserve"
      - "sql-zipper-match"
      - "sql-zipper-conflict"
      - "sql-retain-numerator"
    tags:
      - "拉鏈表"
      - "數據質量"
---

## 留住當時的值，不是用最新值蓋過去

薪級在 2/1 改了，財務要查 1/31 發生時是哪一級。拉鏈表（zipper table；台灣也稱歷史區間表，常見於第二型緩慢變化維度，SCD Type 2）為同一業務鍵保留多個版本，每列只管一段有效期。這堂先用薪級練如何取出**指定日有效、且理論上唯一的一筆**。數倉建模還會談版本鍵與歷史補錄；此處不需要先建數據倉庫。

規則是 `valid_from <= 查詢日`，同時 `查詢日 < valid_to OR valid_to IS NULL`。起日含入，迄日不含；NULL 迄日代表仍有效。這是有效期區間（validity interval）的設定，不是 SQL 自動把 NULL 變成無限遠。試把 1 號員工的兩段畫在紙上：第一段到 2/1 之前為止，第二段從 2/1 開始，邊界上不必扣一天，也不需要猜時分秒。

## 先看歷史，再查命中

在 [自由練習](#/sql?tab=free) 選 `hr`。先看一位員工的全部版本。預期 1 號員工從 38000 元改到 40500 元；用 `2026-02-01` 查詢只可命中新值。若查詢日比所有起日更早，員工仍得保留，只是薪級未知。

```sql
SELECT employee_id, valid_from, valid_to, monthly_pay FROM salary_history WHERE employee_id = 1 ORDER BY valid_from;
```

```sql
WITH candidates AS (
  SELECT e.employee_id, h.valid_from, h.monthly_pay
  FROM employees e LEFT JOIN salary_history h
    ON h.employee_id = e.employee_id
    AND h.valid_from <= DATE '2026-02-01'
    AND (h.valid_to > DATE '2026-02-01' OR h.valid_to IS NULL)
)
SELECT employee_id, valid_from, monthly_pay FROM candidates ORDER BY employee_id;
```

這個結果的正確性包含「同一員工不多列」，不是只檢查金額。把查詢改成按員工聚合，`COUNT(h.valid_from)` 若大於 1 表示同日多版本；為 0 表示沒有有效版本。先盤點，再決定要中止薪級結算、隔離異常，還是按已約定的版本優先規則修正。看到一樣的薪資也不能直接把兩列去重，因為同時生效的問題仍在。之後在[〈生效時間連接〉](#/lesson/sq-time-06)會把固定查詢日換成每一筆事實自己的日期。

**方言。** DuckDB、MySQL、Spark SQL 與 Hive SQL 都能用比較式及 `IS NULL` 表達。不要把用字串填一個「無限遠」年份的做法直接搬到不同引擎，日期解析與型別推導可能不同；直接表達開放終點較清楚。

### 區間檢查要從「應該存在」的員工出發

假設人資多送了 1 號員工的一份修訂，修訂在 1/20 起到 3/1 前有效。它不是單純多一個相同金額；1/20 到 2 月底的多個日子都可能同時命中兩筆。把修訂只追加在 CTE，不改來源數據表；先檢查 2/1 的命中數，應明確看到 2。若只挑起日較晚的版本，就永遠不會看到它曾經不唯一。

再把查詢日改為所有版本之前的一日，完整名冊上的員工仍都列出，但每人命中數為 0。這個反例能發現用了內連接或誤用 `COUNT(*)` 的查詢，因為內連接連異常員工都不會留下。正式管道除了查單日，還要檢查未來可能遇到的重疊：兩段有交集的充要條件是各段的起點都早於另一段的終點，開放迄日不設上限。相鄰版本只有共用邊界，不算重疊。在報表追查時把命中版本的起迄日留下，比只寫「薪級不對」更容易讓上游找到問題。

## 常見錯誤

- 生效日薪資出現兩筆 → `BETWEEN` 讓迄日也算 → 迄日改嚴格大於查詢日。
- 當期員工都沒薪級 → 忘記 NULL 迄日有業務意義 → 在 ON 中補開放終點判斷。
- 缺版本的員工也顯示命中 1 → 用了 `COUNT(*)` → 改數右側不為空的欄。
