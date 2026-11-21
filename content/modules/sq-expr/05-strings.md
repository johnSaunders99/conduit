---
id: sq-expr-05
module: sq-expr
order: 5
title: 字串拆解
subtitle: 把事件名稱拆成動作與物件
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-04
objectives:
- 用 SPLIT_PART 依分隔符號取指定一段
- 用 SUBSTRING 取固定格式的字首或尾碼
- 檢查缺少分隔符號時的空字串並依口徑標為缺值
tags:
- split_part
- substring
- 字串拆解
- 分隔符號
resources:
- title: Text Functions
  url: https://duckdb.org/docs/stable/sql/functions/text
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對照 split_part、substring、length 的參數。
- title: MySQL String Functions and Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/string-functions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 SUBSTRING_INDEX 與串接的參數規則。
concepts:
- id: sq-expr-05-index
  prompt: SPLIT_PART('view:e10', ':', 2) 拿到什麼？
  answer: e10；DuckDB 從 1 開始數段。
  mcq:
    question: 要取 view:e10 的步驟，應指定第幾段？
    options:
    - '1'
    - '0'
    - '2'
    - '5'
    answer: 0
    explain: 段號是分割後的位置，不是字元的位置。
- id: sq-expr-05-missing
  prompt: 要取第 2 段但輸入沒有分隔符號，DuckDB SPLIT_PART 回什麼？
  answer: 沒有第 2 段時回空字串，不等同 NULL。
  mcq:
    question: split_part('e130', ':', 2) 如何輸出？
    options:
    - e130
    - 空字串
    - 'NULL'
    - e
    answer: 1
    explain: 完整原字串是第 1 段；第 2 段不存在。
- id: sq-expr-05-position
  prompt: SUBSTRING 的起點和 SPLIT_PART 的段號有什麼不同？
  answer: 前者按字元位置，後者依分隔符號所切出的段落。
- id: sq-expr-05-shape
  prompt: 怎麼發現拆解後結果不適合下游？
  answer: 保留原標籤，選正常、有空段和無分隔符號的值，核對各段是否符合約定。
  mcq:
    question: 拆完 e130 的第 2 段是空字串。若要區分它與 e130:，該怎麼做？
    options:
    - 兩者都轉成整數
    - 只看拆出的第 2 段
    - 把兩者都補成相同未知字串
    - 保留原字串並檢查有沒有冒號
    answer: 3
    explain: 兩者的第 2 段輸出都可能是空字串，冒號是否存在才保留格式差異。
  interview:
    question: 遇到舊格式沒有分隔符號，要怎麼改拆解查詢？
    answer: 我會先跑正常與舊格式的幾筆，確認函式缺段是空字串還是 NULL。若規格把缺段定義為未知，就明寫轉成 NULL 的規則，同時保留原標籤供回查。
    points:
    - 檢查函式在缺段時的輸出
    - 保留原始字串和缺值規則
practice:
- id: sq-expr-05-p1
  kind: sql
  category: [expression]
  title: 保留前導零的員工代碼拆解
  minutes: 4
  level: 1
  dataset: hr
  prompt: 從 `employees` 取員工編號 1 到 4（含）。`employee_code` 由一個英文字母及三個數字字元組成。輸出 `employee_code`、`code_prefix`（第一個字元）、`code_suffix`（後三個字元，保留前導零），依此欄序並按 `employee_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT employee_code,
           SUBSTRING(employee_code, 1, 1) AS code_prefix,
           SUBSTRING(employee_code, 2, 3) AS code_suffix
    FROM employees
    WHERE employee_id BETWEEN 1 AND 4
    ORDER BY employee_id;
  explain: '`E001` 應拆成 E、001；若把尾碼轉數字，就只剩 1。不要用另一個已是數字的欄位替代。'
  hints:
  - 用 SUBSTRING 取固定位置
  - 尾碼從第 2 個字元開始
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-05-position
  - sq-expr-02-target
  tags:
  - split_part
  - substring
  - 字串拆解
- id: sq-expr-05-p2
  kind: sql
  category: [expression]
  title: 沒冒號的舊標籤
  minutes: 8
  level: 2
  dataset: events
  prompt: 取 `app_events` 的 `raw_id` 30 到 35（含）。本題模擬匯入：有會話時的 `source_label` 為 `session_id:step`，缺會話時為 `event_id`。拆出第 2 段作 `action_part`，空字串當 NULL。輸出 `raw_id`、`source_label`、`action_part`，依此欄序及 `raw_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id,
           CASE WHEN session_id IS NULL THEN event_id
                ELSE CONCAT(session_id, ':', step) END AS source_label,
           NULLIF(SPLIT_PART(source_label, ':', 2), '') AS action_part
    FROM app_events
    WHERE raw_id BETWEEN 30 AND 35
    ORDER BY raw_id;
  explain: 32 到 34 只有事件鍵，拆出第 2 段時會是空字串，須依交付規則轉 NULL。若直接把原 step 搬過去，會宣稱在舊標籤裡真的讀到了步驟。
  hints:
  - 先用 CASE 造出兩種來源格式
  - 可用 `NULLIF(字串, '')` 將空字串轉成 NULL
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-05-missing
  - sq-expr-05-shape
  - sq-expr-03-null
  - sq-expr-04-blanks
  tags:
  - split_part
  - substring
  - 字串拆解
---

## 先看符號，再拿你要的那一段

事件標籤可把兩種訊息放進同一欄，例如 `view:e10`。要做稽核時，營運想分開看動作與事件鍵。兩種動作的長度不同，不能假設冒號永遠在同一個位置。先找到分隔符號（delimiter，大陸也稱分隔符），再按照段落取值。若是固定開頭一個字母的代碼，才適合用固定字元位置切。

## 語法速查

- `SPLIT_PART(text, ':', 1)` 用冒號分段，取第 1 段；第 2 段用 `2`。不存在的段回空字串。
- `SUBSTRING(text, 2)` 從第 2 個字元取到尾；`SUBSTRING(text, 2, 3)` 從同一處最多取 3 個字元。
- `LENGTH(text)` 在 DuckDB 計字元。若要判讀哪種格式，不要只看某一筆的長度；可能有不同長度的正確標籤。
- `CONCAT(a, ':', b)` 把字串接起來。要留意任一部分缺值時如何串接，不要將自動略過的部分當成輸入合格。

數據集：`events`。表裡步驟與事件鍵分開存；下面先拼出示範標籤，再拆回步驟。本例的兩個組成欄都已知：

```sql
SELECT raw_id,
       CONCAT(step, ':', event_id) AS event_label,
       SPLIT_PART(CONCAT(step, ':', event_id), ':', 1) AS action_part
FROM app_events
WHERE raw_id BETWEEN 1 AND 3
ORDER BY raw_id;
```

標籤依次是 `view:e10`、`cart:e11`、`pay:e12`；第 1 段應讀出 view、cart、pay。前兩個步驟剛好等長，但第三個只佔 3 個字元。試用固定取前 4 個字元的想法算第三筆，就會把冒號一起拿走。這不是數據載入錯誤，是切割方法和來源格式不符。

## 當舊系統只留下事件鍵

例如原標籤只有 `e130`，沒有冒號。第一段是原文字，第二段是空字串，不能說讀出一個已知的步驟。若交付定義「沒有第二段」與「有第二段但為空字串」都屬未知，可用 `NULLIF(part, '')`：兩值相等時回 NULL，不等時回第一個值。若來源要分辨「缺段」與「有冒號但末段空」，就不能只看拆完後的值，還要檢查原標籤。用原欄加上拆解欄一起驗，之後遇到壞值仍能回查。

進階題用 `source_label` 在同一份 DuckDB 輸出裡接著拆解。若目標引擎不允許同層重用選取欄的別名，可以先算標籤再拆，之後在 [CTE 命名步驟](#/lesson/sq-compose-04) 會細講。這樣兩種來源格式也能共用一套拆解規則。

**換引擎怎麼說：**MySQL 的 `SUBSTRING_INDEX` 表示「取第幾次分隔符之前或之後的整段」，不是 DuckDB 的「取第幾段」。若在 Spark SQL 用 `split`，分隔參數是規則式（regular expression），它會指定可匹配的字元模式；字面上的點不能不經檢查就當作普通符號。換引擎至少要重跑缺段的反例。

實務上，分隔符號也可能在內容裡出現。若規格約定只有兩段，像 `view:e10:retry` 的第三段不該默默忽略；否則有效的二段格式和多一段的輸入會看起來一樣。先和來源約好冒號能否出現在內容中，再選拆解方式；保留原字串，問題才不會在轉換後失去證據。拆解產物仍是字串；尾碼看似數字，也不必轉型。

## 常見錯誤

- **pay 被拆成 pay 加冒號** → 用固定寬度處理可變欄位 → 改用冒號分段。
- **第 2 段取到整個原標籤** → 誤取第 1 段 → 確認段號從 1 開始。
- **缺段仍當作有值** → 空字串不是 NULL → 依明確口徑轉換，並保留原標籤。
