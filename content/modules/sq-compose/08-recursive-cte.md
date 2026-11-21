---
id: sq-compose-08
module: sq-compose
order: 8
title: 遞迴 CTE
subtitle: 沿主管鏈往上找根節點
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-07
objectives:
- 分辨起始項和遞迴項
- 沿主管鍵追蹤每一層
- 用根節點與深度上限區分完成與異常
tags:
- recursive-cte
- 主管鏈
- 終止條件
resources:
- title: DuckDB：WITH 子句
  url: https://duckdb.org/docs/stable/sql/query_syntax/with
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Recursive CTE，找出起始與遞迴項。
- title: MySQL：WITH 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/with.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的遞迴限制與終止說明。
- title: Hive SQL：CTE
  url: https://hive.apache.org/docs/latest/language/common-table-expression/
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 確認 Hive 普通 CTE 與遞迴能力的差別。
concepts:
- id: sq-compose-08-anchor
  prompt: 遞迴 CTE 的起始項做什麼？
  answer: 提供不依賴 CTE 本身的起點，例如要從哪位員工出發、深度從 0 開始。
  mcq:
    options:
    - 提供第一輪的輸入
    - 選擇最後一輪的結果
    - 把所有層都先跑完
    - 指定顯示順序
    answer: 0
    explain: 起始項不讀自己；遞迴項才讀前一輪並向下一層。
- id: sq-compose-08-step
  prompt: 從目前員工往上走一層，連接條件應是什麼？
  answer: 目前列的 manager_id 對員工表的 employee_id。
  mcq:
    options:
    - 目前 employee_id 對自身 employee_id
    - 目前 manager_id 對目標 employee_id
    - 目前 employee_id 對目標 manager_id
    - 目前 dept_id 對目標 dept_id
    answer: 1
    explain: 第二種走向下屬，後兩種不是主管路徑。
- id: sq-compose-08-stop
  prompt: 為何查到主管鍵為 NULL 的列後正常結束？
  answer: 該列沒有下一位主管，內連接不產生下一層；根節點那一列仍已在累積結果。
  mcq:
    options:
    - 根節點自動變回起始列
    - 到最後由 ORDER BY 停止
    - 下一輪不再產生列
    - 把已查過的根節點刪掉
    answer: 2
    explain: 沒有新列是正常停止條件；不是最後才篩掉根。
  interview:
    question: 如果人事數據寫成互為主管，如何保護查詢？
    points:
    - 辨認不會到 NULL
    - 深度上限是保護而非結果
    - 驗證已訪問的鍵或回報異常
    answer: 先放合理深度上限保護執行，再查路徑的重複鍵並報出循環。跑滿上限卻沒到根的人我會列為異常，不會拿截斷那一列冒充最高主管。
- id: sq-compose-08-depth
  prompt: 深度到 10 時可以把目前人員視作根嗎？
  answer: 不能；還要確認主管鍵為 NULL。上限只是保護，可能遇到循環或超出預期深度。
practice:
- kind: sql
  category: [cte]
  title: 逐層列出員工 4 的原始主管鏈
  minutes: 6
  level: 1
  dataset: hr
  prompt: |
    從員工 4 出發，列自己為深度 0，沿 manager_id 逐層往上列；包含最後一位無主管的人。輸出目前這一層的 employee_id，別名仍為 `employee_id`，層數為 `depth`。

    只輸出以下欄位，欄序固定：`depth`、`employee_id`。

    排序：`depth` 升序。
  solution: |
    WITH RECURSIVE chain AS (
      SELECT employee_id, manager_id, 0 AS depth FROM employees WHERE employee_id = 4
      UNION ALL
      SELECT m.employee_id, m.manager_id, c.depth + 1
      FROM chain AS c JOIN employees AS m ON c.manager_id = m.employee_id
      WHERE c.depth < 10
    )
    SELECT depth, employee_id FROM chain ORDER BY depth;
  explain: |
    4 自己在第 0 層，第 1 層是 2。2 的主管為 NULL，下一輪配不到任何人；拿員工號去對別人的主管號會反向列下屬。
  hints:
  - 起始項讀員工 4。
  - 每輪傳出目前員工的主管鍵和新增的深度。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-08-anchor
  - sq-compose-08-step
  - sq-join-05-keys
  tags:
  - recursive-cte
  - 主管鏈
  id: sq-compose-08-p1
- kind: sql
  category: [cte]
  title: 模擬改組後查每人的最高主管
  minutes: 11
  level: 3
  dataset: hr
  prompt: |
    先在查詢內模擬員工 2 改為向員工 3 匯報（不改表），其餘主管鍵不變。每位員工從自己開始，逐層走到主管鍵為 NULL 的根。輸出起始員工 `employee_id`、根 `root_id`、從起點到根的跳數 `depth`；若無主管，自己就是深度 0 的根。

    只輸出以下欄位，欄序固定：`employee_id`、`root_id`、`depth`。

    排序：`employee_id` 升序。
  solution: |
    WITH RECURSIVE reporting AS (
      SELECT employee_id, CASE WHEN employee_id = 2 THEN 3 ELSE manager_id END AS manager_id
      FROM employees
    ), chain AS (
      SELECT employee_id AS start_id, employee_id, manager_id, 0 AS depth FROM reporting
      UNION ALL
      SELECT c.start_id, m.employee_id, m.manager_id, c.depth + 1
      FROM chain AS c JOIN reporting AS m ON c.manager_id = m.employee_id
      WHERE c.depth < 10
    )
    SELECT start_id AS employee_id, employee_id AS root_id, depth
    FROM chain WHERE manager_id IS NULL ORDER BY start_id;
  explain: |
    改組後 4 沿 4 → 2 → 3，根是 3，深度 2。只做一層自我連接會停在 2；把深度上限當成根也不對，這裡只輸出真正的無主管節點。
  hints:
  - 先在普通 CTE 產生用同一口徑讀取的改組後快照。
  - 保存 start_id，另留目前 employee_id。
  - 最後篩主管鍵為 NULL 的列。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-08-step
  - sq-compose-08-stop
  - sq-compose-08-depth
  - sq-compose-05-dependency
  tags:
  - recursive-cte
  - 組織階層
  id: sq-compose-08-p2
---

一位員工換了部門，直屬主管也改了。要追查最高主管，固定寫兩個自我連接只能走兩層；組織比預計更深時，查詢會悄悄停在中途。遞迴 CTE（recursive CTE）把「沿目前主管鍵再走一步」寫一次，讓同一條規則用到沒有下一層。

## 先有起點，再反覆往上

- `WITH RECURSIVE chain AS (起始查詢 UNION ALL 遞迴查詢) SELECT … FROM chain`：起始項（anchor member）不讀自己，提供員工和深度 0。
- 遞迴項（recursive member）讀上一輪的列，依主管號接到員工表，再把深度加一。要追蹤多個起點，另留一欄原本的員工號，不能用每輪的目前人員覆蓋它。
- 找不到下一列就終止。此處用內連接，一旦目前主管鍵是 `NULL`，就不產生下一輪；根節點（root node）本身仍在結果中。

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
WITH RECURSIVE chain AS (
  SELECT employee_id, manager_id, 0 AS depth FROM employees WHERE employee_id = 4
  UNION ALL
  SELECT m.employee_id, m.manager_id, c.depth + 1
  FROM chain AS c JOIN employees AS m ON c.manager_id = m.employee_id
  WHERE c.depth < 10
)
SELECT depth, employee_id, manager_id FROM chain ORDER BY depth;
```

原始 `hr` 裡從 4 號開始，第 0 層是 4，第 1 層是 2。2 號沒主管，沒有第 2 層。練習會只在查詢內模擬一條新匯報線，把 2 號的主管改為 3 號；再從 4 號出發，就能驗出固定一跳的寫法會停得太早。不需要在共享數據表寫入任何紀錄。

實務要分清「根」和「異常數據」。有填主管號卻找不到那位員工，也會讓內連接停止，但不是到達根；根有明確的 `manager_id IS NULL`。若兩人互指，會一直有下一列。所以示範加了 10 跳上限。到達上限但沒到根就回報異常，不把最後一列當成功；要精確辨認循環，可另外保存已經走過的鍵並阻止二次造訪。

Hive SQL 的 CTE 手冊不支援遞迴，不能直接搬過去，可在批次流程中逐層算到穩定。MySQL 8.4 有 `WITH RECURSIVE` 和遞迴深度的伺服器設定，遞迴項也限制聚合與窗口函式。移植本課時先保留清楚的終止規則，不把引擎上限當業務條件。

## 帶著起點走，不要只交最後一步

多個員工可同時向上查，即使最後到同一位主管，也都需要輸出每個起點各自的結果。可先畫一張有「起點、目前人、下一位主管、深度」四欄的草稿，填入 4、4、2、0；改組後填下一列 4、2、3、1；最後才填 4、3、空、2。起點欄永遠不變，才能知道這條答案是給誰。這正是練習模擬多一層匯報線的用意，不是要更新原始編制。

你還可以拿一位本來就沒有主管的員工驗證起始項：保留自己當根，深度為 0。如果查詢從「先找主管」開始，這位會整個失蹤。若稽核要求每個起點都有狀態，別只交付成功找到根的明細；應把起點清單與找到的根再核對一次，辨認哪幾位未找到，才能回去補主管鍵或修正循環。

範例上限選 10 是為了保護小實驗，不是對組織層級的宣告。移到別的體系時，上限應由數據與執行環境決定，不是把這個常數照抄進正式報表。

## 常見錯誤

- 走出了下屬名單 → 配對方向反了，應拿目前主管號找主管本人的員工號。
- 每輪看起來都是同一個人 → 遞迴項應傳出新節點的主管鍵。
- 結果沒有根卻當作成功 → 檢查是否遇到失效主管鍵、循環或深度上限。
