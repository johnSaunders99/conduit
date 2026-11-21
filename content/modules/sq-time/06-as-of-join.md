---
id: sq-time-06
module: sq-time
order: 6
title: 生效時間連接
subtitle: 一張訂單只配一個當時的價格
status: ready
minutes: 30
level: 2
prereqs:
- sq-time-05
objectives:
  - "用每筆事實自己的日期配到有效維度版本"
  - "用 ASOF LEFT JOIN 找不晚於事實日期的最近版本"
  - "區分沒有版本、區間有空窗與同時生效的情況"
tags:
  - "生效時間連接"
  - "ASOF JOIN"
  - "拉鏈表"
resources:
  - title: "DuckDB：FROM and JOIN Clauses"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/from"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 As-Of Joins 的不等式及左側保留行為。"
  - title: "MySQL：Window Function Descriptions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "了解以 ROW_NUMBER 取最近版本的替代方法。"
concepts:
  - id: "sql-asof-lookback"
    prompt: "交易發生後才生效的版本，能拿來配這張交易嗎？"
    answer: "不能；起日必須不晚於事實日期。"
    mcq:
      options:
        - "能，最新數據永遠正確"
        - "能，只要鍵相同"
        - "不能；會把未來狀態帶回過去"
        - "只有日期是 NULL 才不能"
      answer: 2
      explain: "只看鍵會配多版本，只看最新版則可能配到未來。"
    interview:
      question: "最近起日已過有效迄日，還能給薪資嗎？"
      answer: "若業務規則有迄日，就不能用過期值。我會保留待核對的事實列、把配對欄留空，查是歷史缺漏還是合法空窗。若允許區間重疊，也要先約定選哪個版本。"
      points:
        - "找不晚於事實的最近起點"
        - "驗證開放或封閉迄日"
        - "保留未匹配事實"
  - id: "sql-asof-shape"
    prompt: "想讓無有效薪級的對帳列仍存在，應選什麼？"
    answer: "LEFT JOIN 或 ASOF LEFT JOIN，而非內連接。"
    mcq:
      options:
        - "內連接"
        - "先 WHERE 薪級不為空"
        - "左連接"
        - "交叉連接而不設條件"
      answer: 2
      explain: "無匹配也要交給下游盤點，不是把錯誤刪掉。"
  - id: "sql-asof-tie"
    prompt: "同一員工同時有兩筆相同起日，ASOF 會替你定好修訂規則嗎？"
    answer: "不會；先檢查或依已確定的修訂序與版本鍵整理右表。"
practice:
  - id: "sq-time-06-p1"
    kind: "sql"
    category: [scd, join]
    title: "配生效日前一天的對帳薪級"
    minutes: 6
    level: 2
    dataset: "hr"
    prompt: "為每位 `employees` 員工建立 2026-01-31 一列對帳事實，匹配當日有效的薪級（左閉右開，NULL 終點為仍有效）。無配對薪級留 NULL。輸出 `employee_id`、`pay_day`（DATE）、`monthly_pay`，依 `employee_id`、`pay_day` 升序。"
    solution: |-
      WITH facts AS (
        SELECT employee_id, DATE '2026-01-31' AS pay_day FROM employees
      )
      SELECT f.employee_id, f.pay_day, h.monthly_pay
      FROM facts f LEFT JOIN salary_history h ON h.employee_id = f.employee_id
        AND h.valid_from <= f.pay_day
        AND (f.pay_day < h.valid_to OR h.valid_to IS NULL)
      ORDER BY f.employee_id, f.pay_day;
    explain: "比較的是每筆事實日期。只抓當前 valid_to 為 NULL 的版本，會把後來的調整算進一月。"
    hints:
      - "先建員工與查詢日的事實表。"
      - "不要在 WHERE 排除右側找不到的員工。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-asof-lookback"
      - "sql-asof-shape"
      - "sq-join-02-preserve"
      - "sql-zipper-boundary"
    tags:
      - "生效時間連接"
      - "拉鏈表"
  - id: "sq-time-06-p2"
    kind: "sql"
    category: [scd, join]
    title: "同一員工跨三個時間點對帳"
    minutes: 10
    level: 3
    dataset: "hr"
    prompt: "面試追問：每位員工建立 2024-12-31、2026-01-31、2026-02-01 三個 DATE 的事實列。用查詢內的版本表模擬空窗：將員工 1 原迄日 2026-02-01 改成 2026-01-30，其他版本不變，不要更新原表。對每列選同員工起日不晚於事實日的最近版；若無版本或該版已到（含）迄日，兩個版本欄為 NULL。不退回更早版本。輸出 `employee_id`、`pay_day`、`valid_from`、`monthly_pay`，依前兩欄升序。"
    solution: |-
      WITH facts AS (
        SELECT e.employee_id, d.pay_day
        FROM employees e CROSS JOIN (
          VALUES (DATE '2024-12-31'), (DATE '2026-01-31'), (DATE '2026-02-01')
        ) d(pay_day)
      ), history AS (
        SELECT employee_id, valid_from, monthly_pay,
               CASE WHEN employee_id = 1 AND valid_to = DATE '2026-02-01'
                    THEN DATE '2026-01-30' ELSE valid_to END AS valid_to
        FROM salary_history
      ), nearest AS (
        SELECT f.employee_id, f.pay_day, h.valid_from AS version_start
        FROM facts f ASOF LEFT JOIN history h
          ON f.employee_id = h.employee_id AND f.pay_day >= h.valid_from
      ), candidate AS (
        SELECT n.employee_id, n.pay_day, h.valid_from, h.valid_to, h.monthly_pay
        FROM nearest n LEFT JOIN history h
          ON h.employee_id = n.employee_id AND h.valid_from = n.version_start
      )
      SELECT employee_id, pay_day,
             CASE WHEN valid_to IS NULL OR pay_day < valid_to THEN valid_from END AS valid_from,
             CASE WHEN valid_to IS NULL OR pay_day < valid_to THEN monthly_pay END AS monthly_pay
      FROM candidate ORDER BY employee_id, pay_day;
    explain: "ASOF LEFT JOIN 只找最近的版本鍵，再以員工及起日精確取回迄日。最後用 CASE 檢查是否過期，不能把最近起日當作仍有效。2024 年的事實仍保留；1 號員工的 1/31 空窗不應出現原薪級。"
    hints:
      - "在 ASOF 的 ON 放員工等值與日期 >= 起日。"
      - "用版本有效性處理兩個輸出欄，而非濾掉整列。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-asof-lookback"
      - "sql-asof-shape"
      - "sq-join-02-preserve"
      - "sql-asof-tie"
      - "sql-zipper-boundary"
    tags:
      - "生效時間連接"
      - "ASOF JOIN"
      - "拉鏈表"
---

## 把查詢日放到每一筆事實上

交易表記著當時賣了幾件商品，但價格表只記每次改價。如果用今天的價格重估昨天的訂單，整份歷史都會跟著改寫。在這堂課以 `hr` 的薪級歷史代替商品價格：每張對帳單是事實（fact），事實的日期決定要配哪個版本。這叫生效時間連接（as-of join）。[〈拉鏈區間去重〉](#/lesson/sq-pattern-08)用單一日期找有效版；這次同一張表上會有不同的事實日期。

## 先看以區間配對的結果

在 [自由練習](#/sql?tab=free) 選 `hr`。下面先造每員工一列的 1/31 對帳單，再配薪級。等值條件選員工，區間條件保證該版本在事實日生效。把查詢中的 1/31 改為 2/1，1 號應從 38000 變成 40500。若日期改為 2024-12-31，仍保留員工，只是金額沒有可參考的歷史。

```sql
WITH facts AS (
  SELECT employee_id, DATE '2026-01-31' AS pay_day FROM employees
)
SELECT f.employee_id, f.pay_day, h.monthly_pay
FROM facts f LEFT JOIN salary_history h ON h.employee_id = f.employee_id
  AND h.valid_from <= f.pay_day
  AND (f.pay_day < h.valid_to OR h.valid_to IS NULL)
ORDER BY f.employee_id, f.pay_day;
```

### 最近版不是永遠有效

DuckDB 的基本寫法是 `FROM facts f ASOF LEFT JOIN history h ON f.key = h.key AND f.at >= h.valid_from`。按相同鍵找不晚於事實的最近起日，且無匹配時保留左列。單有起日就能表達「一直有效直到下一版」；有迄日時，最近版可能已過期，還需要檢查。下面先在查詢內將員工 1 的舊薪級迄日提前到 1/30，造出一個正式數據沒有的空窗；不更新原表。再用 ASOF 找最近的版本鍵，不直接取可能為 NULL 的迄日；用員工鍵和版本起日精確取回該版，最後以 `CASE` 清掉已過期的值。沒有更早起日時，兩次左連接都會保留事實列。原始薪級歷史沒有同時生效的衝突；若一個值有多版本，靠不等式配對或最近起日都不能替業務決定優先序。

```sql
WITH facts AS (
  SELECT e.employee_id, d.pay_day
  FROM employees e CROSS JOIN (
    VALUES (DATE '2024-12-31'), (DATE '2026-01-31'), (DATE '2026-02-01')
  ) d(pay_day)
), history AS (
  SELECT employee_id, valid_from, monthly_pay,
         CASE WHEN employee_id = 1 AND valid_to = DATE '2026-02-01'
              THEN DATE '2026-01-30' ELSE valid_to END AS valid_to
  FROM salary_history
), nearest AS (
  SELECT f.employee_id, f.pay_day, h.valid_from AS version_start
  FROM facts f ASOF LEFT JOIN history h
    ON f.employee_id = h.employee_id AND f.pay_day >= h.valid_from
), candidate AS (
  SELECT n.employee_id, n.pay_day, h.valid_from, h.valid_to, h.monthly_pay
  FROM nearest n LEFT JOIN history h
    ON h.employee_id = n.employee_id AND h.valid_from = n.version_start
)
SELECT employee_id, pay_day,
       CASE WHEN valid_to IS NULL OR pay_day < valid_to THEN valid_from END AS valid_from,
       CASE WHEN valid_to IS NULL OR pay_day < valid_to THEN monthly_pay END AS monthly_pay
FROM candidate ORDER BY employee_id, pay_day;
```

驗算不是只看薪資有沒有變。每位員工的 3 筆事實都要保留，而且 2024 年對帳不得借用 2025 年才生效的數據。兩種寫法在無重疊且檢查迄日時可以交出同樣的有效值；要查重疊異常仍需先列出所有命中，不要直接以 ASOF 的單列結果證明歷史乾淨。

**方言。** MySQL、Hive SQL、Spark SQL 的面試可以用有效期左連接；若題意只准配最近起日，再把候選按事實鍵分區、以版本起日晚至早排名。需要明確同起日規則，不能抄 DuckDB 的 `ASOF` 關鍵字假設能跑。

### 空窗不能借前一個值

比對兩份 1/31 查詢：原始版本表上，1 號有 38000；帶空窗的模擬表中，該人仍有一筆事實，但近版已無效，薪級為 NULL。2/1 則再次有值。把這三個結果記在同一張紙上，不需要靠眼睛掃完所有人。若模擬表的空窗仍顯示 38000，錯在把「取得候選」當成「驗證候選有效」。若整列消失，查是否在外層套了篩選條件。

上線前還要問需不需要還原當時已知的版本。後來補登一個更早生效的薪級，會改變依有效期重算的歷史；若要回答人資當時確實看到了什麼，還得有版本的紀錄時間。本課只依有效日配對，不聲稱能回到任一歷史畫面。這個差異也能解釋為何兩份「二月報表」看似使用同一日期卻不同。

## 常見錯誤

- 舊日配到新薪資 → 只連現行版 → 比較每張事實與版本的日期。
- 查不到版本的事實消失 → 用了內連接或在 WHERE 篩右側 → 使用左連接。
- 歷史空窗仍有值 → 成功找起日就當有效 → 再查迄日並保留缺值。
