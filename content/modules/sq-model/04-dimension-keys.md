---
id: sq-model-04
module: sq-model
order: 4
title: 維度與代理鍵
subtitle: 會員改名仍保留歷史
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-03
objectives:
- 區分會員業務鍵、維度代理鍵與事實外鍵
- 用 NULL 政策保留城市未填的付費單
- 以有效日期為薪級事實選出唯一版本鍵
tags:
- 維度表
- 代理鍵
- 業務鍵
- 未知維度
resources:
- title: Kimball Group：維度代理鍵
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/dimension-surrogate-key/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀數倉自行發鍵的理由，區別來源鍵和版本鍵。
concepts:
- id: sq-model-04-dimension
  prompt: 維度表通常回答事實的哪些問題？
  answer: 用描述屬性回答是誰、什麼、何時或哪裡，例如商品分類、會員城市。
  mcq:
    options:
    - 每筆成交的金額
    - 商品歸在哪一類
    - 退款入帳筆數
    - 所有訂單的合計
    answer: 1
    explain: 類別是用來篩選分組的描述，事件量與成交額通常在事實表。
- id: sq-model-04-surrogate
  prompt: 會員改名且要保留歷史，哪個鍵應在新舊版本間保持相同？
  answer: 來源會員的業務鍵相同；版本各有自己的代理鍵，事實外鍵指向當時那個版本。
  mcq:
    options:
    - 只有代理鍵
    - 兩個鍵都換
    - 業務鍵
    - 兩個鍵都不換
    answer: 2
    explain: 只有版本鍵會換，業務身份仍相同；兩個鍵都換會切斷會員歷史。
  interview:
    question: 既然來源有會員編號，何必再建代理鍵？
    answer: 先看會不會存同一會員的多個版本，或合併鍵會撞的來源。需要留歷史時，我保留來源與業務鍵認人，在數倉為每版建立穩定代理鍵，讓事實能指回事件當時的版本。
    points:
    - 區分認人與認版本
    - 說明鍵穩定性
    - 指出缺失或晚到須有政策
- id: sq-model-04-unknown
  prompt: 有付費單但會員城市未填，應如何處理區域報表？
  answer: 保留付費單，把缺城市明確列成未知；缺失原因與補送進度另外追蹤。
  mcq:
    options:
    - 排除該單
    - 用最常見城市補值
    - 把金額除到所有城市
    - 保留金額並標記未知城市
    answer: 3
    explain: 未填不代表沒付款，也不應猜城市或隨機分配。
- id: sq-model-04-stability
  prompt: ROW_NUMBER 可當正式維度的永久代理鍵嗎？
  answer: 不適合每次重算；新增舊版本會改變序號。正式鍵要保存分派結果，不能讓舊事實換連到另一列。
practice:
- id: sq-model-04-p1
  kind: sql
  category: [model, join]
  title: 保留城市未填的付款單
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    按會員城市計已付款訂單數。城市為 NULL 或找不到會員時，輸出字串「未知城市」。依序輸出 `city`、`paid_orders`，依 `paid_orders` 降序、`city` 升序。
  solution: |
    SELECT COALESCE(u.city, '未知城市') AS city, COUNT(*) AS paid_orders
    FROM orders o LEFT JOIN users u ON u.user_id = o.user_id
    WHERE o.status = 'paid'
    GROUP BY COALESCE(u.city, '未知城市')
    ORDER BY paid_orders DESC, city;
  explain: |
    從付款單出發，LEFT JOIN 後再以 COALESCE 命名未知桶。WHERE 限制右表城市會把未知單排掉；無須連品項。
  hints:
  - '`COALESCE(u.city, ''未知城市'')` 統一缺值分組'
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-04-dimension
  - sq-model-04-unknown
  - sq-model-02-grain
  tags:
  - 維度表
  - 代理鍵
- id: sq-model-04-p2
  kind: sql
  category: [model, scd]
  title: 看見每個生效版本的代理鍵
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    只操作整份 `salary_history`。在全部歷史列依 `employee_id` 升序、`valid_from` 升序編 1 起算的連續 `salary_key`，再挑出 2026-02-01 生效的版本。依序輸出 `salary_key`、`employee_id`、`monthly_pay`，依 `employee_id` 升序。
  solution: |
    WITH versions AS (
      SELECT ROW_NUMBER() OVER (ORDER BY employee_id, valid_from) AS salary_key,
             employee_id, valid_from, valid_to, monthly_pay
      FROM salary_history
    )
    SELECT salary_key, employee_id, monthly_pay FROM versions
    WHERE valid_from <= DATE '2026-02-01'
      AND (valid_to > DATE '2026-02-01' OR valid_to IS NULL)
    ORDER BY employee_id;
  explain: |
    一定要先編全表再過濾；只對當天生效列編號會換一組鍵。序號是本題的展示，不是可重跑的正式鍵。窗口函式也可用在 Spark SQL、Hive SQL 與 MySQL 8。
  hints:
  - 以 ROW_NUMBER 編號後包一層查詢
  - 起日含、迄日不含，NULL 是無迄日
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-04-surrogate
  - sq-model-04-stability
  - sq-model-02-line-key
  tags:
  - 維度表
  - 代理鍵
---

## 先認人，再認版本

有商品明細和金額，卻沒有商品分類，店長就不能按茶飲或器皿看銷售。維度表（dimension table）保存這些描述：商品名、分類，或會員城市。事實表記業務活動與可計算的量，外鍵（foreign key）指向描述它的維度列。要保住事實表粒度，期待每筆事實在該維度只找到一列，不是把所有版本都連回來。

- **業務鍵（business key）**：在來源業務裡認出同一個對象，例如會員編號。整合多個來源時通常加上來源代碼，否則兩邊的會員 1 未必是同一人。
- **代理鍵（surrogate key）**：數倉分配的技術鍵，不從城市、名稱等會變的欄位推算。同一個業務鍵可以對應多個版本，各版本有不同代理鍵。
- **事實外鍵**：在載入時依業務鍵和事件日期選出對應版本，把其代理鍵放進事實列。報表就不用每次都猜如何選版本。

例如會員 42 先住山城再搬到河岸。可讓山城版本使用鍵 81，河岸版本使用鍵 96。舊訂單存 81，新訂單存 96，但兩列會員的業務鍵仍都是 42。何時應該保留舊版、何時覆寫，在[〈SCD 一型與二型〉](#/lesson/sq-model-08)會細講。暫時把版本想成在某個有效日期範圍內成立的一張說明卡。

## 找不到描述時，先保住金額

在 SQL 練習場選 `shop`，檢查 1013 號單。`users` 裡有會員 18，但沒有城市。`LEFT JOIN` 讓訂單先留下來：

```sql
SELECT o.order_id, o.user_id, COALESCE(u.city, '未知城市') AS city
FROM orders o LEFT JOIN users u ON u.user_id = o.user_id
WHERE o.order_id = 1013;
```

這一列要算在總付款筆數，不應因城市未知而消失。正式數倉可以另設一個固定代理鍵來指向「未知」維度成員，並把缺描述的原因記在質量報告。來源已知但尚未到達、與來源根本沒填，是不同的修復路徑。後者不能猜；前者可以等描述到齊，再依可重跑的政策補鍵。

薪級練習讓你試編一份示意鍵。`ROW_NUMBER() OVER (ORDER BY …)` 依明示次序從 1 給連續序號，不是按薪資排人；薪資平手也不應合併成同一個版本。事件日落在起日（含）至迄日（不含）時選該列，空的迄日視為尚未結束；[〈拉鏈表〉](#/lesson/sq-model-09)會檢查如何載入與防重疊。

有些維度永遠只保留現值，即使用來源鍵也能正確連接；不必把代理鍵說成所有數據表的硬性規定。判斷是否獨立發鍵時，先問來源鍵會不會重用、數據是否來自多個系統，以及事實是否要指向固定版本。

## 方言與常見錯誤

正式發鍵與展示編號分開。DuckDB 可用序列配合 `nextval`，MySQL 可用 `AUTO_INCREMENT`；Hive SQL 常見的是在載入流程中保存鍵映射，不要直接把這兩種建表語法搬進 Hive。鍵的持久穩定比選哪種生成語法重要。

- 連接後訂單翻倍 → 用會員業務鍵同時連到歷史多版 → 先選唯一版本或連版本代理鍵。
- 城市報表金額少於全店 → 右表缺值被過濾 → 保留事實並分出未知桶。
- 重建後舊訂單換了城市 → 全量重排代理鍵 → 持久保存鍵分派。
