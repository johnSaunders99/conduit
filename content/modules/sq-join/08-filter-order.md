---
id: sq-join-08
module: sq-join
order: 8
title: 連接與篩選順序
subtitle: 把條件移一行人數就變了
status: ready
minutes: 30
level: 1
prereqs:
- sq-join-07
objectives:
- 分別用 ON 限定匹配與 WHERE 篩結果
- 保留零付款會員和空部門
- 說明左表條件放在 ON 為什麼不等於篩選
tags:
- 'on'
- where
- 外連接
- 篩選
resources:
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/stable/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀外連接，先想像補出的右側欄值。
- title: Hive SQL：JOIN
  url: https://hive.apache.org/docs/latest/language/languagemanual-joins/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 OUTER JOIN 範例，比對 ON 與 WHERE。
concepts:
- id: sq-join-08-on
  prompt: 保留所有會員，但只配已付款單，狀態條件放哪裡？
  answer: 放在 ON，令右側取消單不算匹配，但左側仍有補列。
  mcq:
    options:
    - 'ON'
    - WHERE
    - 只放 SELECT 欄名
    - ORDER BY
    answer: 0
    explain: WHERE 篩連接結果，補列的右側狀態為 NULL，和 paid 比較不為真。
  interview:
    question: WHERE o.status = paid OR o.order_id IS NULL 一定等價嗎？
    points:
    - 用只有取消單反例
    - 指出失敗前並未補 NULL
    - 提出移到 ON
    answer: 不一定。只有取消單的會員先匹配出取消單，沒有補出的 NULL 那列；WHERE 的兩個條件都不成立。若目標是保住所有會員，我會把付款條件放 ON。
- id: sq-join-08-where
  prompt: 若只要 2 到 6 號會員，來自左側的範圍通常放哪？
  answer: 在 WHERE 篩左側欄位；若只加在 LEFT JOIN 的 ON，範圍外左列仍會保留。
  mcq:
    options:
    - ORDER BY user_id
    - WHERE 限定左側
    - 只加在 ON
    - LIMIT 5
    answer: 1
    explain: ON 的條件不成立只阻止匹配，不能消除左側保留列。
- id: sq-join-08-unknown
  prompt: 補列的 NULL = paid 經 WHERE 會保留嗎？
  answer: 不會。一般等值比較得到未知，WHERE 只保留真。
  mcq:
    options:
    - 會，LEFT 保留列不受 WHERE 影響
    - 會，ORDER BY 預設先排 NULL
    - 不會，結果未知
    - 會，NULL 等於每個字串
    answer: 2
    explain: 補列之後仍要接受外層 WHERE 的篩選。
practice:
- kind: sql
  category: [join, aggregate]
  title: 盤點一個營業日的付款單
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    只列會員 5 至 13（含），每人匹配 2026-01-24 當天所有已付款訂單；當天沒有付款單則 order_id 為 NULL。

    只輸出以下欄位，欄序固定：`user_id`、`order_id`。

    排序：`user_id` 升序，同人按 `order_id` 升序。
  solution: |
    SELECT u.user_id, o.order_id
    FROM users AS u LEFT JOIN orders AS o
      ON u.user_id = o.user_id AND o.status = 'paid' AND o.order_date = DATE '2026-01-24'
    WHERE u.user_id BETWEEN 5 AND 13
    ORDER BY u.user_id, o.order_id;
  explain: |
    付款條件跟著匹配規則，左側範圍放 WHERE。6 號當天只有取消單；若先按會員和日期配對，之後在 WHERE 篩付款或右鍵為 NULL，仍會漏掉 6 號。
  hints:
  - 分開回答「哪個會員在名單」與「哪張單算配上」。
  - 6 號當天的 1022 是取消單，不能當配對；13 號的 1023 則是付款單。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-08-on
  - sq-join-08-where
  - sq-join-02-preserve
  tags:
  - 'on'
  - where
  - left-join
  id: sq-join-08-p1
- kind: sql
  category: [join, aggregate]
  title: 盤點四部門目前高薪編制
  minutes: 9
  level: 2
  dataset: hr
  prompt: |
    保留所有部門，計算各部門目前編制中，具有現行薪級（valid_to 為 NULL）且月薪至少 42000 的員工人數，命名 `employee_count`。沒有符合者為 0。本數據集每位員工僅一筆現行薪級。

    只輸出以下欄位，欄序固定：`dept_id`、`employee_count`。

    排序：`dept_id` 升序。
  solution: |
    SELECT d.dept_id, COUNT(s.employee_id) AS employee_count
    FROM departments AS d
    LEFT JOIN employees AS e ON d.dept_id = e.dept_id
    LEFT JOIN salary_history AS s ON e.employee_id = s.employee_id
      AND s.valid_to IS NULL AND s.monthly_pay >= 42000
    GROUP BY d.dept_id
    ORDER BY d.dept_id;
  explain: |
    數的是配到合格薪級的員工鍵，而不是左接後必然出現的部門列。若把金額條件搬到 WHERE，籌備處就不會出現。
  hints:
  - 員工編制和合格薪級要各接一次。
  - 把資格條件寫在該次匹配的 ON。
  - 數不為 NULL 的薪級員工號。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-join-08-on
  - sq-join-08-unknown
  - sq-join-02-count
  tags:
  - 'on'
  - where
  - 條件計數
  id: sq-join-08-p2
---

同一句 `status = 'paid'`，放在 `ON` 跟放在 `WHERE`，營運報表的會員人數卻不同。關鍵在於你想限制「可配上的訂單」，還是「最後可顯示的列」。若需求是列出所有會員與他的已付款單，未付款的人也屬於完整名單。

## 讀成兩個步驟

1. `FROM users AS u LEFT JOIN orders AS o ON u.user_id = o.user_id AND o.status = 'paid'`：先定義配對資格。某人所有訂單都不合格時，沒有配對，左連接會補出右側為 `NULL` 的一列。
2. `WHERE u.user_id BETWEEN 1 AND 3`：篩選已完成連接的結果。這次用左表的會員號限制報表範圍；放在 `ON` 則只會阻止範圍外會員配對，他們自己還是會留著。

這是用來預測結果的邏輯順序（logical query processing order），不是要求引擎真的逐行照你的閱讀順序執行。引擎可以選等價的執行方式，不可以因此改變哪些列應保留。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT u.user_id, COUNT(o.order_id) AS paid_count
FROM users AS u LEFT JOIN orders AS o
  ON u.user_id = o.user_id AND o.status = 'paid'
WHERE u.user_id BETWEEN 1 AND 3
GROUP BY u.user_id
ORDER BY u.user_id;
```

若只有取消單，符合付款條件的張數 `paid_count` 是 0，但「整份訂單裡都沒有」是另一個問題。範例中 1 號有 37 張付款單，2 號是 0，3 號有 4 張；若把範例的付款條件移到 `WHERE`，2 號會從表上消失。這就和業務的「保留所有會員」矛盾。

有人會補 `OR o.order_id IS NULL`。想一個最小反例：新增一位只下過取消單的會員。若先按會員號配對，取消單存在，所以不會補空列；之後付款條件不成立，訂單號又不是 `NULL`，這位還是會消失。條件在 `ON` 才能讓取消單從一開始就不算匹配。

Hive SQL 的外連接手冊特別提醒這個陷阱；Spark SQL 與 MySQL 的普通左連接也遵守相同語意。對基本內連接，單純的右側狀態條件放兩處可得到相同的列對；不要把那個等價推論帶到外連接。

## 對帳時把條件按角色分三類

先寫清楚成品的基準名單，再標出每一條條件使用的來源。左側會員號定義哪些人能上榜；右側付款狀態定義哪張訂單能算；最後的計數只數有效配對的訂單號。這三個位置分開後，更動條件時就知道影響的是名單、配對，還是指標，與同事討論也不必逐字念整段 SQL。

把相同思路換成部門薪級：空部門正好能測到外連接的保留規則。若沒有職員，員工和薪級欄都是空，不代表部門本身應被剔除。反過來，即使部門有員工，但月薪沒有達標，也同樣應列出 0。要驗你的條件真的測到兩種零，挑一個有員工的部門提高門檻再跑一次，年資或薪級歷史不應把不合格的人補進來。

讀需求時可先圈起「都要列出」：它通常在指定左側基準名單，不是要把資格判斷整個移除。若規格改成只要達標部門，再另外篩彙總結果。

## 常見錯誤

- 零付款會員整列不見 → 右表資格條件在 WHERE，改放 ON。
- 會員範圍外仍留著 → 名單範圍應在 WHERE 檢查左表欄位。
- 含零的分組報表把 0 寫成 1 → 對右側的匹配鍵做 COUNT，而非數整列。
