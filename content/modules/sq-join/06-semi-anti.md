---
id: sq-join-06
module: sq-join
order: 6
title: 半連接與反連接
subtitle: 只問是否出現別複製明細
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-05
objectives:
- 用半連接挑出有訂單的會員
- 用反連接找沒有匹配的左列
- 辨認 NOT IN 碰到 NULL 的陷阱
tags:
- semi-join
- anti-join
- 有無匹配
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Semi and Anti Joins，確認輸出是哪側。
- title: Spark SQL：JOIN
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-join.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Semi Join 與 Anti Join 的完整語法。
- title: Spark SQL：缺值語義
  url: https://spark.apache.org/docs/latest/sql-ref-null-semantics.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 NOT IN 的缺值行為。
concepts:
- id: sq-join-06-semi
  prompt: 半連接會把一位有多張單的會員輸出幾次？
  answer: 若左側本來只有一列，半連接只輸出一次；它只問有沒有匹配。
  mcq:
    options:
    - 所有會員一律一次
    - 兩次
    - 一次
    - 等於右側匹配張數
    answer: 2
    explain: 半連接不取右欄也不展開右表，但不替左表去重。
- id: sq-join-06-anti
  prompt: 反連接留下的是哪一種左列？
  answer: 沒有任何右列讓 ON 成立的左列。
  mcq:
    options:
    - 找不到匹配的右列
    - 所有同鍵列對
    - 只留右鍵為 NULL 的原始右列
    - 找不到匹配的左列
    answer: 3
    explain: 判斷方向由左至右，檢查的是配對，而不是右表內容是否本來缺值。
- id: sq-join-06-null
  prompt: 右側集合有 NULL 時，為何不能直接用 NOT IN 取代反連接？
  answer: 找不到相等值時，NOT IN 仍可能因 NULL 得到未知；WHERE 不會保留未知。
  mcq:
    options:
    - NOT IN 可能得到未知
    - NULL 一律匹配所有鍵
    - NOT IN 會把右側列複製
    - 反連接一律排除左側缺值
    answer: 0
    explain: 等值碰到 NULL 可能是未知；反連接則只問有沒有真的匹配。
  interview:
    question: 如何在 MySQL 寫不受右側空鍵影響的反連接？
    points:
    - 用關聯 NOT EXISTS
    - 根據業務決定是否保留左缺值
    answer: 我會用 NOT EXISTS 搭配鍵相等，右側空鍵不會讓相等條件成立；若左側空鍵也不該列入，我會另加 IS NOT NULL。
practice:
- kind: sql
  category: [join]
  title: 付款會員只列一次
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    由 users 找出至少有一張已付款訂單的會員。每位合格會員只列一次；不必輸出任何訂單欄位。

    只輸出以下欄位，欄序固定：`user_id`。

    排序：`user_id` 升序。
  solution: |
    SELECT u.user_id
    FROM users AS u SEMI JOIN orders AS o
      ON u.user_id = o.user_id AND o.status = 'paid'
    ORDER BY u.user_id;
  explain: |
    半連接只驗證存在，1 號有多張付款單仍只列一次。只寫 INNER JOIN 且不去重會重複；取消單不能當付款依據。
  hints:
  - 要輸出的欄位全部在左表。
  - 已付款條件也影響算不算匹配。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-06-semi
  - sq-join-01-filter
  tags:
  - semi-join
  - 訂單
  id: sq-join-06-p1
- kind: sql
  category: [join]
  title: 找出沒有下屬的人
  minutes: 8
  level: 2
  dataset: hr
  prompt: |
    列出沒有任何員工把這個人的 employee_id 填成 manager_id 的員工。employees 本身有 manager_id 為 NULL 的列。

    只輸出以下欄位，欄序固定：`employee_id`。

    排序：`employee_id` 升序。
  solution: |
    SELECT e.employee_id
    FROM employees AS e ANTI JOIN employees AS s ON e.employee_id = s.manager_id
    ORDER BY e.employee_id;
  explain: |
    應保留 4 至 15 號。用未排除 NULL 的 NOT IN 會漏掉他們；反連接只剔除真正有匹配的 1、2、3 號。
  hints:
  - 同表分成被檢查的人、可能的下屬兩個角色。
  - 比對員工號與下屬列的主管號。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-06-anti
  - sq-join-06-null
  - sq-join-05-keys
  tags:
  - anti-join
  - 缺值
  id: sq-join-06-p2
---

客服只想知道「誰曾付過款」，不想列出每張訂單；人事只想知道「誰沒有下屬」，不需要出現下屬的欄。這兩個問題都在檢查存在性：右側只是證據，結果仍然是一份左側名單。若先做內連接再去重，很容易把左來源本來就該保留的重複列也去掉。

## 把配對當成是非題

- `FROM a SEMI JOIN b ON a.key = b.key`：半連接（semi join，台灣也稱半聯結）保留至少有一筆匹配的左列。
- `FROM a ANTI JOIN b ON a.key = b.key`：反連接（anti join，台灣也稱反聯結）保留沒有匹配的左列。
- 兩種都只輸出左欄。左側每一筆輸入分開判定，不保證同一業務鍵只剩一列；這要看輸入本身的粒度。

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
SELECT e.employee_id, e.employee_code
FROM employees AS e ANTI JOIN employees AS s ON e.employee_id = s.manager_id
WHERE e.employee_id <= 6
ORDER BY e.employee_id;
```

本例左右兩份都是員工表：左側是候選主管，右側是可能的下屬。`1`、`2`、`3` 都被某人填在主管欄，因此排除；範例只顯示 1 至 6 號的候選人，因此留下 4、5、6；移除左側範圍後會列出 4 至 15。右邊存在未填主管的列，但那些列不能讓 `e.employee_id = s.manager_id` 成立，不會阻止你找出沒有下屬的人。

同一題若用 `WHERE e.employee_id NOT IN (SELECT manager_id FROM employees)`，沒有相等值也不能直接得出「不在裡面」：集合裡的 `NULL` 讓結果變成未知，而 `WHERE` 只收真。你可以先用原表看出右欄確有缺值，再比對反連接留下的列。不是每次搬引擎都要重寫口徑，但應保留這個反例來查語意。

DuckDB 在本課寫 `SEMI JOIN`／`ANTI JOIN`；Spark SQL 也提供 `LEFT SEMI JOIN`／`LEFT ANTI JOIN`。Hive SQL 的 JOIN 語法可寫 `LEFT SEMI JOIN`；MySQL 不用這兩個 JOIN 關鍵字。要帶去另一個引擎，可改用 `EXISTS` 或 `NOT EXISTS` 表達有無匹配，下一模組的[〈EXISTS 判斷〉](#/lesson/sq-compose-03)會完整拆解括號內如何引用外層的鍵。

## 保留左列，不代表保留不同鍵

把左來源想像成兩次登入，兩列是同一會員；右來源是一份合格會員名單。兩次登入都能配到會員，就會兩列都保留。半連接回答的是「這筆左列要不要」，不是「這個會員要不要只算一次」。當交付要一位會員一列，先選一會員一列的來源，或另寫明確的去重步驟，不要靠半連接自己改變左表粒度。

另一個容易忽略的約定是左側鍵也可能缺失。一般等值反連接找不到能與空鍵配成真的列，所以缺鍵會被保留；但「尚未填鍵」未必屬於「已知沒有匹配」。若名單只接受已知識別對象，就在左來源或外層加非空條件。先在報表說清楚要把未知另列，還是直接排除，讀者才不會拿結果當作所有對象都完成檢查的證據。

若半連接與反連接採用同一組配對條件，兩份結果的列數相加應等於左側原始列數，可用來查漏。

## 常見錯誤

- 一位會員出現多次 → 檢查是不是用了普通內連接，數到右側的所有匹配列。
- 用 NOT IN 查不出本應留下的人 → 先看右側是否含 NULL，缺值不是「絕對不存在」。
- 想從半連接取右欄 → 若需求確實要明細，應回到內連接，並說清楚要幾筆。
