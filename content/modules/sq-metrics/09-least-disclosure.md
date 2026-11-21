---
id: sq-metrics-09
module: sq-metrics
order: 9
title: 權限與最小揭露
subtitle: 只公布門市合計不要明細
status: ready
minutes: 30
level: 2
prereqs:
- sq-metrics-08
objectives:
- 用欄位投影與分組做出不含識別碼的摘要
- 以最小權限及小群抑制分開限制存取和揭露
tags:
- 最小權限
- 小群抑制
- 聚合揭露
resources:
- title: PostgreSQL：GRANT
  url: https://www.postgresql.org/docs/current/sql-grant.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀表、檢視表與欄級授權的差異。
- title: Spark SQL：聚合與缺值
  url: https://spark.apache.org/docs/latest/sql-ref-null-semantics.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照 COUNT 如何處理缺值。
concepts:
- id: sq-metrics-09-privilege
  prompt: 營運只要部門合計，應該拿哪種權限？
  answer: 只允許讀已核可的摘要，不給原始表、員工識別碼及薪資明細。
  mcq:
    options:
    - 直接給全庫唯讀
    - 授權讀經核可的摘要
    - 原表只刪姓名就一定安全
    - 先給寫入權限讓使用者自己匯總
    answer: 1
    explain: 唯讀不等於最小權限；仍可能看到不該看的明細。
- id: sq-metrics-09-small
  prompt: 聚合後的單人成本為何不適合直接公布？
  answer: 只有一人的總額就是個別值，應依核可規則抑制或改用更大分組。
  mcq:
    options:
    - 總和自動匿名
    - 只改欄名就能公布
    - 單人群組的合計就是個別值
    - 任何有部門名稱的報表都是安全的
    answer: 2
    explain: 移除識別欄不會消除從群組資訊推回個人的風險。
  interview:
    question: 如何交付不公布個資的薪資摘要？
    answer: 我先問誰需要什麼數字，只輸出經核可的部門合計。小群組按政策不發布，核對同時發布的總計或其他切面能不能反推；最後以讀者角色驗證能讀摘要、不能讀明細。
    points:
    - 刪除不必要識別欄
    - 檢查小群與相減風險
    - 用同一讀者角色驗允許與拒絕的路徑
- id: sq-metrics-09-denial
  prompt: 上一層視圖刪了識別碼就算驗證完成嗎？
  answer: 沒有；仍要確認讀者無法直接讀底表、其他視圖或匯出取得同一明細。
  mcq:
    options:
    - 只讀角色永遠無法看個資
    - 在摘要裡加 ORDER BY 就安全
    - 結果內沒有姓名就不需要權限
    - 還要驗證底表與其他出口的存取
    answer: 3
    explain: 最小揭露是輸出契約；最小權限是誰可讀什麼，兩者各自驗證。
practice:
- id: sq-metrics-09-p1
  kind: sql
  category: [model, aggregate]
  title: 只交付有人的部門人數
  minutes: 5
  level: 1
  dataset: hr
  prompt: |
    從 departments 與 employees 輸出現有人編制的部門摘要，過濾無員工的部門。不輸出 employee_id、employee_code、manager_id。結果只含 dept_id、employee_count，依 dept_id 升冪。
  solution: |
    SELECT d.dept_id, COUNT(e.employee_id) AS employee_count
    FROM departments d JOIN employees e USING (dept_id)
    GROUP BY d.dept_id ORDER BY d.dept_id;
  explain: |
    結果只有部門和人數；籌備處沒有員工。若用 LEFT JOIN 再 COUNT(*)，空部門會被當成一人。
  hints:
  - 只選交付需要的兩欄
  - 不要輸出員工層識別碼
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-09-privilege
  - sq-metrics-09-denial
  tags:
  - 最小權限
  - 小群抑制
  - 聚合揭露
- id: sq-metrics-09-p2
  kind: sql
  category: [model, aggregate]
  title: 小群組的月薪總額不公開
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    以 2026-02-01 為查詢日，employees 的目前部門作分組，從 salary_history 取有效薪級（起日含、迄日不含，NULL 終點為持續有效）。有 6 人以上且都有薪級才公開總額；不足或缺值時 total_pay 為 NULL、publish_state 為 suppressed，其他標 published。只輸出 dept_id、total_pay、publish_state，依 dept_id 升冪，包含空部門。為使兩類都可測，聚合前用 UNION ALL 補一筆本題限定的虛構薪級：(employee_id=999, dept_id=1, monthly_pay=42000)。
  solution: |
    WITH pay_rows AS (
     SELECT e.employee_id, e.dept_id, s.monthly_pay
     FROM employees e LEFT JOIN salary_history s ON s.employee_id = e.employee_id
     AND s.valid_from <= DATE '2026-02-01'
     AND (s.valid_to > DATE '2026-02-01' OR s.valid_to IS NULL)
     UNION ALL SELECT 999, 1, 42000
    ), summary AS (
     SELECT d.dept_id, COUNT(p.employee_id) AS members, COUNT(p.monthly_pay) AS known_pay,
            SUM(p.monthly_pay) AS total_pay
     FROM departments d LEFT JOIN pay_rows p USING (dept_id) GROUP BY d.dept_id
    )
    SELECT dept_id,
           CASE WHEN members >= 6 AND known_pay = members THEN total_pay END AS total_pay,
           CASE WHEN members >= 6 AND known_pay = members THEN 'published' ELSE 'suppressed' END AS publish_state
    FROM summary ORDER BY dept_id;
  explain: |
    只公布 1 號部門的群組金額；空部門及未及 6 人的部門不輸出金額。不可用所有薪級歷史算人數，2 月 1 日的迄日邊界會形成雙重匹配。此題只是練規則，不代表門檻 6 可保證匿名。
  hints:
  - 先挑每人當日有效的薪級
  - 按部門數非空員工鍵
  - 不要在最終輸出帶出員工數或識別碼
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-metrics-09-small
  - sq-metrics-09-privilege
  - sq-metrics-09-denial
  tags:
  - 最小權限
  - 小群抑制
  - 聚合揭露
---

營運要看各部門的薪級支出，不需要知道是哪位員工。拿掉代碼不一定足夠：如果某區只有一人，群組總額就等於個別金額。今天做一份摘要，分開驗「誰能存取」和「報表可以揭露到哪一層」。

## 先決定用途，再決定輸出

最小權限（least privilege）指每個角色只拿完成任務所需的權限。最小揭露（data minimization for disclosure）則限制交付內容：不需要就不輸出識別碼、歷史明細或其他切面。兩者都要驗：讀者能查允許的摘要，但不能直接查原表。檢視表（view；也稱視圖）是有名字的查詢，本身不代表已設好授權或封鎖其他路徑。

- 先定角色和用途。部門摘要讀者只需部門鍵、可公開合計及發布狀態。
- 用明確欄位清單做聚合，不用 `SELECT *` 匯出。
- 小群抑制（small-cell suppression）只是一步。少於最低人數門檻的總額不發布，也檢查其他已公布的總計、期間或切面是否會讓人用相減推回。
- 保管你用來核對的明細，只給有權限的人；不要把檢查用逐筆輸出附在公開報表後面。

## 看一份最小的部門表

在 DuckDB 練習場選 `hr`。例子只計現行部門的人數，不帶識別碼。這是在驗證輸出形狀，並沒有建立一個使用者角色。空部門在左表仍有一列，因此要數非空的右表員工鍵。

```sql
SELECT d.dept_id, COUNT(e.employee_id) AS employee_count
FROM departments d LEFT JOIN employees e USING (dept_id)
GROUP BY d.dept_id ORDER BY d.dept_id;
```

接下來的薪資摘要只取查詢日有效的薪級；不要把兩期薪資疊成兩人。起訖的做法可回看[〈拉鏈表〉](#/lesson/sq-model-09)。正式環境若員工歷史區間重疊，應先找出重疊列，再算可公布的人數，不能只換一個 COUNT 掩蓋。

## 交付前用讀者的角度驗收

不要只用維護者連線看到一張合計表就宣布上線。列出應允許的讀取和應拒絕的讀取；以和報表讀者相同的角色分別試一次。再檢查同一天已公布的其他摘要：若群組的合計能由總額減去其他部門得到，小群抑制就形同虛設。可能需要一起隱藏其他可推回的數字或調整分組。這個練習只用虛構樣本，不要把真實逐筆工資放到可共用的測試檔案。

## 常見錯誤

- 摘要只刪人名卻仍保留可辨認代碼 → 換欄名並未清掉識別資訊 → 限制為核可的欄。
- 發出小群的總額 → 合計可能就是一人的數字 → 按規則抑制並檢查可推回的配套數字。
- 能讀摘要但也能讀底表 → 忘了驗權限的拒絕路徑 → 用相同的讀者角色查兩者。

## 方言與面試

本地 DuckDB 練習場用 SQL 模擬篩選和發布，不代替部署上的身份控制。PostgreSQL 可針對摘要檢視表授予 `SELECT` 並核對讀者是否另有原表權限；MySQL 檢視表的安全模式及角色行為不同，需用實際讀者驗證。面試中要說出「我怎麼知道不該看的東西真的看不到」，而不是只展示刪了幾欄。
