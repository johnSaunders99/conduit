---
id: sq-join-05
module: sq-join
order: 5
title: 自我連接
subtitle: 從員工找出直屬主管
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-04
objectives:
- 用兩個別名區分同表角色
- 依 manager_id 找直屬主管
- 保留沒有主管的員工
tags:
- self-join
- 主管階層
- 表別名
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀表別名與左外連接，對照同表兩個角色。
- title: MySQL：JOIN 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/join.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀表別名語法，辨認重複引用同一張表。
concepts:
- id: sq-join-05-roles
  prompt: 自我連接為什麼要替同一張表起兩個別名？
  answer: 兩份引用分別扮演員工與主管；別名讓欄值在兩側的角色清楚。
  mcq:
    options:
    - 去除所有重複主管
    - 讓欄位分屬員工和主管角色
    - 讓引擎替每個員工複製實體表
    - 強制員工只能匹配自己
    answer: 1
    explain: 別名區分引用，並不建立實體副本、限制鍵或去重。
- id: sq-join-05-keys
  prompt: 找直屬主管，ON 右側應該比對哪欄？
  answer: 用 e.manager_id 對 m.employee_id，因為主管本人也有員工識別碼。
  mcq:
    options:
    - m.dept_id
    - m.employee_code
    - m.employee_id
    - m.manager_id
    answer: 2
    explain: 左側存的是主管的員工號；同部門或同主管不代表彼此是主管。
- id: sq-join-05-roots
  prompt: 如何讓無主管的員工仍留在名單？
  answer: 員工放左，用 LEFT JOIN；無匹配時主管欄補 NULL。
  mcq:
    options:
    - 使用 INNER JOIN
    - 依 manager_id 分組後只取一人
    - 用 CROSS JOIN
    - 員工放左用 LEFT JOIN
    answer: 3
    explain: 需求是保住左側的人，而不是讓每個人都有一位主管。
  interview:
    question: 無主管和主管鍵亂填都連不到，你怎麼區分？
    points:
    - 同時輸出原始主管鍵與匹配鍵
    - 區分 NULL 和找不到對象
    answer: 我會同時留 e.manager_id 和 m.employee_id。前者本來是 NULL 才是未指定主管；前者有值、後者為 NULL 則是參照未命中，應另外查。
practice:
- kind: sql
  category: [join]
  title: 找出有匹配的直屬主管
  minutes: 6
  level: 1
  dataset: hr
  prompt: |
    列出所有能找到直屬主管的員工，以 `manager_code` 輸出主管的員工代碼；不要輸出無匹配的員工。

    只輸出以下欄位，欄序固定：`employee_id`、`manager_code`。

    排序：`employee_id` 升序。
  solution: |
    SELECT e.employee_id, m.employee_code AS manager_code
    FROM employees AS e INNER JOIN employees AS m ON e.manager_id = m.employee_id
    ORDER BY e.employee_id;
  explain: |
    主管代碼取自 m，連接則是左側主管鍵對右側員工鍵。用 e.manager_id = m.manager_id 會找成同一位主管的同事。
  hints:
  - 同一張表扮演兩個角色。
  - 主管 ID 也是一個員工 ID。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-05-roles
  - sq-join-05-keys
  - sq-join-01-match
  tags:
  - self-join
  - 主管
  id: sq-join-05-p1
- kind: sql
  category: [join, missing-values]
  title: 審核每位員工的主管部門
  minutes: 8
  level: 2
  dataset: hr
  prompt: |
    保留所有員工。輸出員工的部門 `employee_dept_id`、匹配到的主管員工號 `manager_id`、主管部門 `manager_dept_id`；無匹配時主管兩欄保留 NULL。

    只輸出以下欄位，欄序固定：`employee_id`、`employee_dept_id`、`manager_id`、`manager_dept_id`。

    排序：`employee_id` 升序。
  solution: |
    SELECT e.employee_id, e.dept_id AS employee_dept_id,
           m.employee_id AS manager_id, m.dept_id AS manager_dept_id
    FROM employees AS e LEFT JOIN employees AS m ON e.manager_id = m.employee_id
    ORDER BY e.employee_id;
  explain: |
    先按主管鍵連，不要拿同部門當配對前提；4 號在部門 2，但主管 2 號在部門 3。內連接則會漏掉沒有主管的 1 至 3 號。
  hints:
  - 部門只是要顯示的欄位，不是連接鍵。
  - 要保留員工就以員工當左側。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-05-keys
  - sq-join-05-roots
  - sq-join-02-preserve
  tags:
  - self-join
  - 缺值
  id: sq-join-05-p2
---

人事編制表已經有員工和直屬主管號，但部門主管想看到主管的代碼和所在部門。不必另建一張主管表：主管和員工本來都在同一張表，只是在不同列。這堂做一張能看出「誰向誰報告」的名單，沒有主管的人也能辨認。

## 先分清兩個角色

自我連接（self join，台灣也稱自我聯結）並沒有新的 `SELF JOIN` 關鍵字。基本形式是 `FROM employees AS e LEFT JOIN employees AS m ON e.manager_id = m.employee_id`。左邊 `e` 是正在看的員工，右邊 `m` 是被查出的主管。用「誰存著對方的編號」來找鍵：員工的 `manager_id` 指向主管那列的 `employee_id`，不是指向主管自己的 `manager_id`。

若只做「實際配上主管」的名單，把 `LEFT JOIN` 改為 `INNER JOIN`。若要把無主管者也放進名冊，保留左連接，並將右邊的主管欄位清楚命名；輸出兩個 `employee_code` 但不取別名，交付後就沒人知道哪一欄是主管。

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
SELECT e.employee_id, e.employee_code, m.employee_code AS manager_code
FROM employees AS e LEFT JOIN employees AS m ON e.manager_id = m.employee_id
ORDER BY e.employee_id;
```

4 號員工 `E004` 對到 `E002`；1 號沒有主管，仍在名單，主管代碼是 `NULL`。同一位主管可以出現好多次，因為每一列的主角是員工，而不是主管。你可以先找 4 號這一列，沿主管號回原表查 2 號，再對照查詢結果；不需要通讀全表才驗證連接方向。

這裡只走一層。若要找主管的主管，可以再引用一次表；但層數不固定時，手接幾次就會漏掉更高層。[〈遞迴 CTE〉](#/lesson/sq-compose-08)會用同一組鍵反覆向上走，直到找不到下一層。正式的質量檢查還會分開看「根本未指定」與「指定了不存在的人」；兩者都沒有右側列，但原始主管號不同。

DuckDB、Hive SQL、Spark SQL、MySQL 都可用同一張表的兩個別名寫這種連接。MySQL 也不需要特定自我連接關鍵字；面試時最好先說清楚左側和右側的業務角色，比背出自我連接名稱更能說明你知道怎麼配鍵。

## 檢查方向與輸出粒度

拿紙寫「4 的主管號是 2」，箭頭從左側 4 指向右側 2。如果條件寫成「員工號等於另一人的主管號」，你是在反向找 4 的下屬，並不是找 4 的主管。兩條查詢都是合法 SQL，而且只看欄名時很像；挑一位確定有主管的員工逐列回查，較容易發現這種方向錯誤。

本例左邊 15 位員工都應各留一列。用內連接的版本會少 3 列，正好對應沒有主管的 1 至 3 號。若左連接查出超過 15 列，不要急著在 SELECT 加去重；先回主管數據查員工鍵是否唯一。有兩個候選主管列卻不知道哪個是正確版本，後來再任選一筆容易把編制錯誤藏起來。練第二題時還可用 4 號跨部門的例子，驗證沒有誤把「同部門」當成配對條件。

## 常見錯誤

- 結果列出同事而非主管 → 右側要比 `m.employee_id`，不是 `m.manager_id`。
- 無主管的員工不見 → 確認員工放左，並用左連接。
- 同部門才找得到主管 → 拿掉部門相等的限制；現行編制可能跨部門匯報。
