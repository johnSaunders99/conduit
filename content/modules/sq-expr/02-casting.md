---
id: sq-expr-02
module: sq-expr
order: 2
title: CAST 與數據類型
subtitle: 把可算的數字從文字中取出
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-01
objectives:
- 寫出 CAST 明確指定目標數據類型
- 用 TRY_CAST 區分可讀的數字和轉型失敗的數值
- 在代碼包含前導零或字母時保留原碼
tags:
- cast
- try_cast
- 數據類型
- 代碼解析
resources:
- title: Casting
  url: https://duckdb.org/docs/stable/sql/expressions/cast
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 CAST 的目標類型及 TRY_CAST 失敗結果。
- title: Spark SQL ANSI Compliance
  url: https://spark.apache.org/docs/latest/sql-ref-ansi-compliance.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Spark 的轉型規則，找出 try_cast。
concepts:
- id: sq-expr-02-target
  prompt: CAST('007' AS INTEGER) 會留下前導零嗎？
  answer: 不會；整數結果是 7。若 007 是代碼，就保留原字串。
  mcq:
    question: 應保留 '007' 與 '7' 的差異時，要選哪個類型？
    options:
    - INTEGER
    - VARCHAR
    - DOUBLE
    - BOOLEAN
    answer: 1
    explain: 字串保留字面內容；轉為整數或浮點數會丟失前導零。
- id: sq-expr-02-failure
  prompt: TRY_CAST 遇到不能轉成 INTEGER 的字串回什麼？
  answer: NULL。它不會把壞值變成 0，也不替你驗證業務範圍。
  mcq:
    question: TRY_CAST('e10' AS INTEGER) 傳回什麼？
    options:
    - '10'
    - '0'
    - e10
    - 'NULL'
    answer: 3
    explain: 整段 'e10' 不是整數；要抽尾碼，須依來源格式另外處理。
- id: sq-expr-02-audit
  prompt: 如何分清原本缺值與轉型失敗？
  answer: 同時保留原值與轉型結果；原值非 NULL 而結果為 NULL，才是嘗試轉型後的失敗。
  mcq:
    question: 原值是 e110，TRY_CAST 結果為 NULL，這列代表什麼？
    options:
    - 來源沒有填任何內容
    - 數值確定是 0
    - 原值存在，但全碼不能轉成指定整數
    - 引擎會自動擷取 110
    answer: 2
    explain: 兩欄一起看才能把轉型失敗和原始缺值分開。
- id: sq-expr-02-compare
  prompt: 要做數字大小比較，為何不能沿用文字排序？
  answer: 文字按字串規則，'10' 可在 '2' 前面；轉成整數才按 10 大於 2 比較。
  interview:
    question: 來源把會員代碼輸出成文字，你會先全部轉整數嗎？
    answer: 不會。我會先問它是識別碼還是可計算的數值。識別碼可能有前導零或字母；要計算的欄位才轉型。我會保留原值，在轉換失敗時留 NULL 供核對，不會把錯誤藏成 0。
    points:
    - 先確認用途再選類型
    - 保留原值與失敗證據
practice:
- id: sq-expr-02-p1
  kind: sql
  category: [expression]
  title: 編號轉文字交付
  minutes: 4
  level: 1
  dataset: hr
  prompt: 在 `employees` 取員工編號 1 到 3（含）。輸出 `employee_code`、`employee_id_text`，按此欄序；後者把 `employee_id` 轉成字串。依原數字員工編號升冪。
  starter: 'SELECT '
  solution: |
    SELECT employee_code, CAST(employee_id AS VARCHAR) AS employee_id_text
    FROM employees
    WHERE employee_id BETWEEN 1 AND 3
    ORDER BY employee_id;
  explain: 文字編號和原代碼分欄；將 `employee_code` 轉成整數會失去或破壞它的格式。
  hints:
  - 目標為 `VARCHAR`
  - 欄名標出文字單位
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-02-target
  - sq-expr-01-alias
  tags:
  - cast
  - try_cast
  - 數據類型
- id: sq-expr-02-p2
  kind: sql
  category: [expression]
  title: 事件鍵轉型稽核
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 取 `raw_id` 25 到 29（含）。依次輸出 `raw_id`、`event_id`、`whole_number`、`suffix_number`；第三欄嘗試把全碼轉成整數（失敗保留 NULL），第四欄去掉開頭一個字元後轉成整數。保留所有接收列，按 `raw_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, event_id,
           TRY_CAST(event_id AS INTEGER) AS whole_number,
           CAST(SUBSTRING(event_id, 2) AS INTEGER) AS suffix_number
    FROM app_events
    WHERE raw_id BETWEEN 25 AND 29
    ORDER BY raw_id;
  explain: 整碼有 e，第三欄應為 NULL。尾碼照來源規格從位置 2 起取；26 和 27 的尾碼同為 110，不可用接收編號代替尾碼。
  hints:
  - 用 `SUBSTRING(event_id, 2)` 取尾碼
  - 失敗不該中止，用 `TRY_CAST`
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-02-failure
  - sq-expr-02-audit
  - sq-read-04-missing
  tags:
  - cast
  - try_cast
  - 數據類型
---

## 先問這欄是代碼，還是要拿來算

收到匯出檔時，「長得像數字」不表示「應當按數字解讀」。員工代碼可以有前導零，事件鍵開頭也能有字母；它們是識別用的文字。另一欄如果是件數，才需要確定能參與加減和比較。數據類型（data type）就是數據庫對一個值採用的表示和運算規則。本堂要交付的是一份並排顯示原值和轉換後值的核對結果。

## 語法速查

- `CAST(value AS type)`：做明確的類型轉換（cast，台灣也稱型別轉換）。值不能轉成指定類型時，嚴格轉型會報錯。
- `TRY_CAST(value AS type)`：可轉就給轉換後的值，轉換失敗則回 `NULL`。
- `VARCHAR` 是字串；`INTEGER` 是整數（有可表示的範圍）；`DOUBLE` 是可近似表示小數的浮點類型。精度會在[精度與除法](#/lesson/sq-expr-08)再驗。
- 前導零保存在字串裡。數字 7 轉回字串只會得到 `'7'`，不會記得原本寫了幾個零。

數據集：`events`。來源規格是 e 接數字。先取三筆，比對「整碼」與「尾碼」：

```sql
SELECT raw_id, event_id,
       TRY_CAST(event_id AS INTEGER) AS whole_number,
       CAST(SUBSTRING(event_id, 2) AS INTEGER) AS suffix_number
FROM app_events
WHERE raw_id BETWEEN 25 AND 27
ORDER BY raw_id;
```

`SUBSTRING(event_id, 2)` 是從第 2 個字元開始取到結尾，之後在[字串拆解](#/lesson/sq-expr-05)會再談這類函式。這裡的整碼以 e 開頭，第三欄三筆都是 NULL；最後一欄則是 101、110、110。26 和 27 是同一事件的重送，尾碼相同，不表示接收列編號相同。先確認格式才拿掉第一字；在來源不保證這個格式的真實匯入中，不應對所有字串一律切掉第一字。

## 讓不能轉的值可見

如果把範例第三欄改成 `CAST`，一筆不能轉換的字串便足以使查詢失敗。保留 `TRY_CAST` 可繼續查，但一個 NULL 有兩種來歷：輸入從來沒有值，或是有文字卻轉不成指定類型。不要直接都補成 0。把原字串放在旁邊，看到原值存在而數字缺值時才記成轉型失敗。接著可以挑選幾個失敗值回查來源，例如數字旁夾了代碼，或是整數超出範圍。成功轉型也只證明類型可用，不代表數量允許負值。

**換引擎怎麼說：**DuckDB 容錯語法是 `TRY_CAST`，Spark SQL 也提供 `try_cast`；同樣寫 `CAST` 時，Spark 的錯誤行為還要看 ANSI 模式。要移植到其他環境，應用一筆有效值、一筆無效字串和一筆 NULL 實測，不只核對函式名稱。

另一個容易混淆的地方是排序。文字比較會先看開頭；只比較 `'2'` 和 `'10'`，文字中的 `'10'` 會在前面。若它們是數量，轉型後再依整數排序；若是原始代碼，反而可能就要依文字規則列出。手動選一組會換序的值，比測 1 和 2 更能看出你到底用了哪一種類型。轉換前保留原欄，才有辦法復原和解釋換序。

## 常見錯誤

- **原代碼的零消失** → 把識別用文字轉成整數 → 保留原代碼；要比較數字時另產生一欄。
- **一筆錯值中止查詢** → 嚴格 `CAST` 讀到不能轉的字串 → 用 `TRY_CAST` 並另外核對失敗列。
- **報表把轉型失敗寫成零件** → 用 0 蓋掉了暫時未知 → 保留 NULL 和原始值，先確認修補規則。
