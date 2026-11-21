---
id: cr-sql-01
module: cr-sql
order: 1
title: 題意與測試樣本
subtitle: 用五筆拆出兩種可能口徑
status: ready
minutes: 25
level: 2
prereqs: []
objectives:
  - "把含糊的「前幾名」換成可驗收條件"
  - "用五列寫出能區分兩種口徑的預期結果"
  - "用 60 秒說清楚結果鍵、平手及未覆蓋的案例"
tags:
  - "手寫"
  - "Top N"
  - "測試樣本"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "比較 ROW_NUMBER、RANK 與 DENSE_RANK。"
  - title: "MySQL：Window Function Descriptions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "確認排名函式與分區語法如何移植。"
concepts:
  - id: "sql-drill-contract"
    prompt: "對方說「每部門前兩位」，先問哪一件事最有用？"
    answer: "是否最多兩位、或要一起保留第二位的平手。"
    mcq:
      options:
        - "先確認名次欄要輸出 1 還是 01"
        - "先問平手是否擴充名額"
        - "先確認輸出是否按部門名稱排序"
        - "先問要顯示薪資還是只顯示員工鍵"
      answer: 1
      explain: "平手規則會改變選哪些人與總列數；顯示欄位和順序可在名單口徑確定後處理。"
    interview:
      question: "如何用小樣本讓口徑差異一眼可見？"
      answer: "我會讓一組的頭位單獨、第二位同薪，另一組只一人。先手寫兩種答案，再問對方哪份才是預期；不等到有 SQL 才發現我們說的是不同需求。"
      points:
        - "安排卡在名額邊界的平手"
        - "包含不足名額的組"
        - "先明定答案列與排序"
  - id: "sql-drill-witness"
    prompt: "下列哪組三個價格可測試「只取前兩筆」與「第二筆同價都留」？"
    answer: "90、60、60；第二筆平手跨過名額邊界。"
    mcq:
      options:
        - "90、70、60"
        - "90、90、60"
        - "90、60、60"
        - "只試一個價格"
      answer: 2
      explain: "只有第三組在第二筆出現跨界平手；90、90、60 的第一、第二筆都已在名額內。"
  - id: "sql-drill-output"
    prompt: "不看解答時，紙上先寫下哪些驗收條件？"
    answer: "一列是什麼、分組及篩選條件、平手政策、輸出欄與排序。"
practice:
  - id: "cr-sql-01-p1"
    kind: "sql"
    category: [top-n, window]
    title: "每個分類只推一件商品"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "每類只放得下一個首頁位置；用 `products` 取最貴的一件，同價取編號最小。輸出 `category`、`product_id`、`price`，依 `category`、`product_id` 升序。"
    solution: |-
      WITH ranked AS (
        SELECT category, product_id, price,
               ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_id) AS pos
        FROM products
      )
      SELECT category, product_id, price FROM ranked WHERE pos = 1 ORDER BY category, product_id;
    explain: "同價仍只能選一件，應把編號放進 ROW_NUMBER 的排序。茶飲可用 101 與 102 作反例。"
    hints:
      - "先確定每分類最多一列。"
      - "同價需要唯一平手鍵。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-contract"
      - "sql-drill-output"
      - "sql-top-fixed"
    tags:
      - "Top N"
      - "限時手寫"
  - id: "cr-sql-01-p2"
    kind: "sql"
    category: [top-n, window]
    title: "部門前兩名，第二位同薪全留"
    minutes: 8
    level: 3
    dataset: "hr"
    prompt: "以 `salary_history.valid_to IS NULL` 為現行薪級，按 `employees.dept_id` 分部門。按現行月薪由高到低取位於前兩個位置的員工，若第二個位置和其他人同薪就一起保留。同薪共享名次且可跳號。不列空部門。輸出 `dept_id`、`employee_id`、`monthly_pay`、`pay_rank`，依 `dept_id`、`pay_rank`、`employee_id` 升序。"
    solution: |-
      WITH ranked AS (
        SELECT e.dept_id, e.employee_id, h.monthly_pay,
               RANK() OVER (PARTITION BY e.dept_id ORDER BY h.monthly_pay DESC) AS pay_rank
        FROM employees e JOIN salary_history h ON h.employee_id = e.employee_id
        WHERE h.valid_to IS NULL
      )
      SELECT dept_id, employee_id, monthly_pay, pay_rank
      FROM ranked WHERE pay_rank <= 2 ORDER BY dept_id, pay_rank, employee_id;
    explain: "用 RANK 保留位置上的並列，DENSE_RANK 變成前兩種薪級。不要把員工鍵放進排名從而拆開同薪；只放進顯示排序。"
    hints:
      - "第二位指位置，而不是第二個薪資值。"
      - "先整理每位員工一筆現行薪級。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-drill-contract"
      - "sql-drill-witness"
      - "sq-window-04-ties"
      - "sql-top-output"
      - "sql-zipper-boundary"
    tags:
      - "Top N"
      - "平手規則"
      - "限時手寫"
  - id: "cr-sql-01-p3"
    kind: "explain"
    title: "寫下五列與兩份預期答案"
    minutes: 4
    steps:
      - "在紙上寫 A 部門薪資 90、60、60、50，B 部門 70；每人給一個虛構編號。"
      - "用 60 秒口述固定兩位與第二位全留的差異，說明編號在哪一層排序。"
      - "在練習筆記留下兩份預期編號與一個尚未覆蓋的情況。"
    checks:
      - "A 部門固定兩位與第二位全留分別有 2 列、3 列。"
      - "B 部門在兩種口徑中都只有 1 列。"
---

## 先交一張小答案，再寫查詢

面試官說：「幫我把薪資最高的人找出來，按部門，各取前兩位。」你可以先用 30 秒釐清：同薪如何處理？沒有員工的部門需不需要交付？薪級指現行值還是某一日有效？回答不是把每個選項逐個問遍，而是挑能改變列數與數值的條件。先說出你採用的判斷，再讓對方修正。這叫確認輸出契約（output contract）：先約好每列代表什麼，而不是只抄輸入欄位。

五列夠用：A 部門四人的薪資依序 90、60、60、50，B 部門一人 70。固定兩列時，A 的 60 元必須挑一人，B 只能交一人；第二位的並列全留時，A 交三人。這兩個結果都不是「取兩種薪級」的通則。再想 90、90、60：如果只是取前兩位置，60 不會入選；取兩種薪級則會。把這些預期寫出來再執行，比拿全部不同價的測試更有鑑別力。

## 本次計時：先說，再寫

在 [SQL 練習場](#/sql) 以「分類」選 **排名與 Top N**，也可直接打開[每個分類只推一件商品](#/sql/cr-sql-01-p1)。先用 1 分鐘寫下列鍵、名額、平手條件，用 4 分鐘在紙上寫。再貼進編輯器核對，不在前 5 分鐘開提示。執行後先看哪一列不同，而不是只看有沒有通過。拿題目的 60 元同價茶飲，確定先選了編號小的；若取部門題，就檢查空部門和同薪並列。

口述可用這一段：「我從每位員工的現行薪級開始，在部門內依月薪排名。我會用職位名額的規則決定是否保留第二位的平手，再用員工鍵固定顯示。假如題目改成兩種薪級，我改用密集排名。」這裡先解釋數據含義，再說函式，追問就有地方接。如果對方說第二位不想保留，你只需調整排名及平手規則，不必整段重寫。

**方言。** DuckDB 可用 `QUALIFY`；MySQL 面試用排名 CTE 加外層 `WHERE`。計時時選自己能寫對的通用版本，不靠冷門語法拿分。

### 結束後給自己一張可重做的題卡

在練習筆記寫下當時採用的口徑、一組被選出的編號，以及哪個條件改了就會得到另外一張表。不必抄解答；下次拿同一張五列的樣本，把名額換成 3，重新推導出應該由哪組平手影響列數。若你只能記得用哪個函式，卻算不出表形，代表還需做一次不看模板的手算。

最後試一個追問：「同薪如何固定輸出，又不讓同薪變不同名次？」在草稿把兩個排序圈起來：算名次的窗口只有薪級，顯示的外層再加員工編號。這是一個可以用實際列順序驗收的小細節，別用「系統會自己排序」帶過。可把這行記成下一輪面試前的快速回想題。

## 常見錯誤

- 直接開寫不問平手 → 一種寫法暗含一種答案 → 先拿五列驗收。
- 結果通過卻說不清空部門 → 把未覆蓋情況當成驗過 → 另記一行待確認。
- 寫滿一頁才檢查列鍵 → 把層級錯誤拖到最後 → 先寫每列是商品、員工還是部門。
