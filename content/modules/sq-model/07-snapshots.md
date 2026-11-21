---
id: sq-model-07
module: sq-model
order: 7
title: 快照事實表
subtitle: 昨天未出貨的有幾筆
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-06
objectives:
- 以交易事實、週期快照與累積快照分別描述三種需求
- 從薪級有效期產生兩個月底的人數與薪資快照
- 以辦公室薪資說明跨日錯誤加總及空部門處理
tags:
- 週期快照
- 累積快照
- 期末餘額
- 有效期
resources:
- title: Kimball Group：週期快照事實表
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀每列的時間粒度與沒有活動時的保留原則。
- title: Kimball Group：累積快照事實表
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/accumulating-snapshot-fact-table/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看里程碑欄如何在過程推進時更新。
concepts:
- id: sq-model-07-periodic
  prompt: 要回答每月底在職人數，週期快照的一列可怎麼定義？
  answer: 若是部門彙總，就定義為每部門每月底一列；按當時有效的員工版本統計。
  mcq:
    options:
    - 每部門每月底一列
    - 每次薪級更新一列
    - 一張單每個付款事件一列
    - 每個部門永遠只保留一列
    answer: 0
    explain: 快照粒度是觀測時點，不是薪級變動的每一列。
  interview:
    question: 週末未出貨數和下單到簽收要多久，會放同一張表嗎？
    answer: 我會分開。未出貨數是每天晚上某個時點的存量，以週期快照查。流程用訂單一列、幾個里程碑欄的累積快照，另保留事件明細，才查得到反覆出貨和更正。
    points:
    - 說出兩種粒度
    - 說出更新和追加差異
    - 保留事件供追溯
- id: sq-model-07-accumulating
  prompt: 一張單要一路更新付款日、出貨日與簽收日，最接近哪種表？
  answer: 一單一列、按里程碑更新的累積快照。
  mcq:
    options:
    - 每小時明細交易表
    - 每日日結的週期快照
    - 累積快照
    - 會員維度
    answer: 2
    explain: 週期快照保存多個觀測時點，交易事實每次事件一列；兩者都不等於更新同一流程列。
- id: sq-model-07-spine
  prompt: 為什麼週期快照要先鋪部門和月底，再連觀測？
  answer: 確立預期出現的列；空部門也有一列，後續才能區分零值及缺失輸入。
  mcq:
    options:
    - 這樣不必驗證日期
    - 這樣跨期餘額必然可加
    - 用來把所有缺失強制變零
    - 讓本來就該有的列不會消失
    answer: 3
    explain: 用事實中已有列當起點，遇到沒有觀測就沒有列，無法檢查是否漏載。
- id: sq-model-07-current-org
  prompt: 現在部門可否直接用於歷史薪資？
  answer: 只能在明示「以目前部門重看」時使用；若要當時部門，另需編制歷史。
practice:
- id: sq-model-07-p1
  kind: sql
  category: [model, scd]
  title: 取 1 月底薪級快照
  minutes: 5
  level: 1
  dataset: hr
  prompt: |
    取 2026-01-31 有效的員工薪級。依序輸出 `snapshot_date`、`employee_id`、`monthly_pay`，按 `employee_id` 升序。起日含、迄日不含；NULL 為無迄日。
  solution: |
    SELECT DATE '2026-01-31' AS snapshot_date, employee_id, monthly_pay
    FROM salary_history
    WHERE valid_from <= DATE '2026-01-31'
      AND (valid_to > DATE '2026-01-31' OR valid_to IS NULL)
    ORDER BY employee_id;
  explain: |
    從同一觀測日挑版本。只取 NULL 迄日會把 2 月才生效的新薪級放進 1 月。
  hints:
  - 以指定日期與起迄做兩次比較
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-07-periodic
  - sq-model-04-surrogate
  tags:
  - 週期快照
  - 累積快照
- id: sq-model-07-p2
  kind: sql
  category: [model, scd]
  title: 產生兩期部門快照
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    對 2026-01-31、2026-02-28 與全部部門，按員工**目前部門**分組計該月底有效薪級。依序輸出 `snapshot_date`、`dept_id`、`staff_count`、`pay_total`；空部門為 0；按 `snapshot_date`、`dept_id` 依序升序。
  solution: |
    WITH dates AS (
      SELECT DATE '2026-01-31' AS dt UNION ALL SELECT DATE '2026-02-28'
    )
    SELECT x.dt AS snapshot_date, d.dept_id, COUNT(s.employee_id) AS staff_count,
           COALESCE(SUM(s.monthly_pay), 0) AS pay_total
    FROM dates x CROSS JOIN departments d
    LEFT JOIN employees e ON e.dept_id = d.dept_id
    LEFT JOIN salary_history s ON s.employee_id = e.employee_id
      AND s.valid_from <= x.dt AND (s.valid_to > x.dt OR s.valid_to IS NULL)
    GROUP BY x.dt, d.dept_id ORDER BY x.dt, d.dept_id;
  explain: |
    先鋪日期和部門，保留沒有薪級的列。`COUNT(*)` 會把空部門算成 1；把日期條件移到 WHERE 也可能濾掉保留列。
  hints:
  - 以 UNION ALL 組出 2 個日期
  - 有效期條件放在薪級的 LEFT JOIN 子句
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-07-periodic
  - sq-model-07-spine
  - sq-model-07-current-org
  - sq-model-03-semi-additive
  tags:
  - 週期快照
  - 累積快照
---

## 用三條時間線描述同一張單

「昨天有幾張沒出貨？」無法只靠今天的訂單狀態回答。今天被出掉的單，昨天可能還在等。事實表有幾種常見時間粒度，先說清楚你是在記事件、觀測時點，還是流程進度：

- **交易事實表（transaction fact table）**：一次事件一列，例如一筆退款。它可保留同一單的多筆退款，方便追查。
- **週期快照（periodic snapshot）**：每週、每日或每月底觀測一次，例如每倉每商品每天收班一列。即使那天沒單，也應保存庫存的觀測。
- **累積快照（accumulating snapshot）**：一次流程一列，例如一張單有下單、出貨、簽收三個里程碑欄。事件到達後更新同一列，便於比較耗時；若要追查重複里程碑或每次更正，仍需單獨保留事件。

可以同時保留交易與快照，不用硬把所有口徑擠進一張表。週期快照指定「一天」並不夠，還要說清使用哪個時區和一天哪個時刻。累積快照指定「一張單」也要問會不會拆出多次包裹：若研究各包裹耗時，可能要改用一包裹一列。

## 做 2 期薪資觀測

`hr` 的 `salary_history` 不是週期表，而是一人一段生效版本。把月底當作觀測日，挑出那天的有效版本，再按部門統計。版本的起日含、迄日不含，沒有迄日就表示還有效。這裡依目前部門重看過去薪級，不是還原過去部門；這個限制應跟快照一起交付。

抽查員工 1：1 月底是 38000 元，2 月底是 40500 元。把兩期加起來，不是 2 月底餘額。確定後再擴到部門：先鋪 2 個日期和 4 個部門的 8 個組合，再連接當期有效薪級。籌備處在兩期都應出現；它確實沒有員工，所以這組練習可以填 0。若實務上整批薪級遲到就不是這種零，應以完整性警示分開。

做週期快照也要規劃遲到修正。假設調薪於月末生效，但次日才收到通知，已發布的快照要重算哪一天、要不要留下原發布版本，由業務規則決定。保存「觀測日」及「實際載入時間」可讓兩種時間不互相冒充。若業務也需要同品項的庫存與流量，可各自保存，再對齊共同日曆，而不是把交易量填入每一個觀測列。

最後給快照一個明確名稱，例如「月底薪級，依目前部門」。讓讀者不必讀完整查詢，便知道時間和維度的限制。

## 方言與常見錯誤

在練習裡日期直接用可移植的 `DATE '…'`。若月末改為從日期推算，DuckDB 用 `last_day(d)`，Hive SQL、Spark SQL 和 MySQL 都有同名函式，但 Hive 的輸出型別宜另確認或顯式轉為 DATE，再作日鍵連接。

- 1 月出現 2 月薪級 → 只取現行版本 → 以觀測日選有效範圍。
- 結果少了整個空部門 → 從薪級表起查 → 先鋪應有的觀測網格。
- 週末庫存變成每日總和 → 選錯度量聚合方式 → 只取目標時點。
