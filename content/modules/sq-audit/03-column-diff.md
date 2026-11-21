---
id: sq-audit-03
module: sq-audit
order: 3
title: 欄位級差異
subtitle: 兩邊都是未知也要視為一致
status: ready
minutes: 30
level: 2
prereqs:
- sq-audit-02
objectives:
- 用 NULL-safe 比較區分兩側同空、單側空及不同值
- 以完整外連接先辨別缺列，再輸出欄位差異
tags:
- 欄位對帳
- NULL-safe
- 完整外連接
resources:
- title: Spark SQL：NULL 語意
  url: https://spark.apache.org/docs/latest/sql-ref-null-semantics.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀普通等號、空值安全等號與比較例子。
- title: MySQL：比較運算子
  url: https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 NULL-safe 等號最小例子。
concepts:
- id: sq-audit-03-safe
  prompt: NULL 和 NULL 在欄位對帳中視為一致，DuckDB 可用什麼判斷不同？
  answer: IS DISTINCT FROM；雙空為假，只有一邊空為真。
  mcq:
    options:
    - a <> b
    - a = NULL
    - COALESCE(a, 0) <> COALESCE(b, 0) 一律正確
    - IS DISTINCT FROM
    answer: 3
    explain: 普通比較遇缺值得到未知，替代數值又可能和真值撞在一起。
- id: sq-audit-03-presence
  prompt: 為什麼要先區分整列缺失和欄位缺值？
  answer: 欄位缺值可能屬於原本存在的列；能區分它與未匹配的要靠不可空的鍵。
  mcq:
    options:
    - 用不可空的列鍵判斷在不在
    - 用可空欄位當存在旗標
    - 只比非空值
    - 把缺列計為零
    answer: 0
    explain: 完整外連接會讓缺失整側變成 NULL，但表中原本的 NULL 也仍存在。
- id: sq-audit-03-multiplication
  prompt: 相同鍵兩邊各有兩列，能直接用鍵相連比欄嗎？
  answer: 不能把四種配對視為四個差異；要先清理或明確使用更細的業務鍵。
  mcq:
    options:
    - 改用 INNER JOIN 就能去掉重複
    - 先驗每邊的鍵唯一性
    - 比對前把欄都補零
    - 最後 DISTINCT 一定正確
    answer: 1
    explain: 先確定要比較哪一對列，否則差異清單會被連接放大。
  interview:
    question: 對帳發現兩邊主鍵都有，金額卻不同，你怎麼查？
    answer: 我先確認兩側是一鍵一列、欄位單位及比較精度一致，再用能處理缺值的比較列出變動欄位，保留左右值。若一整列缺失，另給原因，不混成金額空值。
    points:
    - 對齊粒度及單位
    - 明確缺值語意
    - 保留雙側值和缺列分類
practice:
- id: sq-audit-03-p1
  kind: sql
  category: [reconcile, missing-values]
  title: 找出缺城市的變動
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    模擬 users 的 5 至 8 號會員：目標將 5 號城市設為 NULL、6 號改為 '港灣'、8 號改為 '河岸'，其他不變。比對並只輸出城市不同的 user_id、before_city、after_city，依 user_id 升冪。
  solution: |
    WITH src AS (SELECT user_id, city FROM users WHERE user_id BETWEEN 5 AND 8),
    dst AS (
     SELECT user_id, CASE user_id WHEN 5 THEN NULL WHEN 6 THEN '港灣'
                                  WHEN 8 THEN '河岸' ELSE city END AS city
     FROM src
    )
    SELECT s.user_id, s.city AS before_city, d.city AS after_city
    FROM src s JOIN dst d USING (user_id)
    WHERE s.city IS DISTINCT FROM d.city
    ORDER BY s.user_id;
  explain: |
    會員 5、6 的單側缺值也要列出，普通 <> 只能抓到 8。MySQL 與 Spark SQL 可用 NOT (a <=> b) 表示不同。
  hints:
  - 兩側城市可能為 NULL
  - 不要用 <>
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-03-safe
  tags:
  - 欄位對帳
  - NULL-safe
  - 完整外連接
- id: sq-audit-03-p2
  kind: sql
  category: [reconcile, join]
  title: 把主管異動和少一筆分開
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    來源為 employees 的 1 至 5。目標保留同組但刪除 5，並把 4 的 manager_id 設成 NULL。只顯示有差異者；輸出 employee_id、before_manager_id、after_manager_id、change_type；缺目標標 target_missing，主管欄位變了標 changed，依 employee_id 升冪。
  solution: |
    WITH src AS (SELECT employee_id, manager_id FROM employees WHERE employee_id BETWEEN 1 AND 5),
    dst AS (
     SELECT employee_id, CASE WHEN employee_id = 4 THEN NULL ELSE manager_id END AS manager_id
     FROM src WHERE employee_id <> 5
    )
    SELECT COALESCE(s.employee_id, d.employee_id) AS employee_id,
           s.manager_id AS before_manager_id, d.manager_id AS after_manager_id,
           CASE WHEN d.employee_id IS NULL THEN 'target_missing' ELSE 'changed' END AS change_type
    FROM src s FULL OUTER JOIN dst d ON s.employee_id = d.employee_id
    WHERE d.employee_id IS NULL OR s.manager_id IS DISTINCT FROM d.manager_id
    ORDER BY employee_id;
  explain: |
    4 是存在但欄位變了，5 整列不在。原本沒有主管且兩側都空的 1 至 3 不列。MySQL 可用左連接完成這個只存在單側缺列的例子。
  hints:
  - 先測目標的 employee_id
  - 兩邊主管都空時不能算差異
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-03-presence
  - sq-audit-03-safe
  - sq-audit-03-multiplication
  tags:
  - 欄位對帳
  - NULL-safe
  - 完整外連接
---

對帳清單說會員鍵都對得上，客服卻看到有人城市由空白變成港灣。這不是缺單，而是同一列的內容不同。今天的輸出會保留兩側的值，讓下一個人不用重新跑整份報表才知道哪欄變了。

## 缺值不是比較的否定

一般 `a <> b` 遇到任一邊 NULL 時，結果是未知；放在 `WHERE` 就不會留列。欄位級核對需要能處理缺值的比較（null-safe comparison）。DuckDB 的 `a IS DISTINCT FROM b` 在「值不同」或「只有一邊是空值」時為真；兩側都是空值時為假。反過來用 `IS NOT DISTINCT FROM` 判斷相同。

| 左欄 | 右欄 | 欄位差異 |
| --- | --- | --- |
| 港灣 | 港灣 | 無 |
| 港灣 | 河岸 | 有 |
| NULL | 港灣 | 有 |
| NULL | NULL | 無 |

在 SQL 練習場選 `shop`，直接預覽 5 與 6 號會員。先不要把空值用「未知」這個字串蓋掉，因為來源也可能真的存了那個字串。把原值留下，報表呈現才另做顯示轉換。

```sql
SELECT user_id, city, city IS DISTINCT FROM '港灣' AS differs
FROM users WHERE user_id IN (5, 6) ORDER BY user_id;
```

## 先核對鍵，再並排左右值

兩邊先確認粒度都是一鍵一列。若比的是員工的主管欄，員工鍵才是對齊欄，不能用主管來相接：多個人可有同一主管，而無主管員工仍存在。需要查整列缺失時，用完整外連接保住兩側；列出來源沒有、目標沒有、欄位變動三種原因。用不可空的識別欄判斷行在不在，不能用可空的城市或主管欄。

同一套做法也可比金額，但要先把單位、精度與取數時間固定。如果一側是分、一側是元，先轉成同一單位；不要為了讓表過關就把差額四捨五入掉。最有用的交付是一張差異清單：帶鍵、欄位名或原因、兩側的值，還有本次對帳截止時間。

## 先做測例，再定修復

把同空、單空、值不同、整列缺失分開各挑一筆；至少放一筆原來就缺主管而仍有效的員工，當作不該被報錯的對照。確認比較清單只落在應該落的分類後，再核對來源是否更新尚未到齊。有時缺值本來要保留，有時來源承諾不可能缺，兩者處置相反。不要看到右邊空，就拿左值填回右邊：先確認哪一層該提供權威值。若一次比多欄，可先產出各欄是否不同的標記，再決定報表要一鍵一列或一變更欄一列。

不要在同一欄混用兩種缺失原因。

## 常見錯誤

- 列出港灣變河岸卻漏了 NULL 變港灣 → `<>` 得到未知 → 改 NULL-safe 比較。
- 看見兩邊主管都空仍報錯 → 把空值組合視為未知差異 → 按口徑把雙空判一致。
- 每個壞鍵被重複報好多次 → 同鍵未先驗唯一 → 把重複鍵先另列再比對。

## 方言與面試

MySQL 與 Spark SQL 可用 `a <=> b` 表示空值安全的相等，取否定才是差異。DuckDB 用 `IS DISTINCT FROM` 更直接。是否應允許兩邊 NULL 代表一致是口徑，不能拿方言語法替業務決定。先提出雙空、單空和整列缺失三個測例，才能驗證你不是只背一個運算子。
