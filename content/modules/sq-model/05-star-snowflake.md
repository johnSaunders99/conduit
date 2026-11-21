---
id: sq-model-05
module: sq-model
order: 5
title: 星型與雪花模型
subtitle: 查商品分類要連幾次
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-04
objectives:
- 畫出星型與雪花的商品分類連接路徑
- 用花費與維護權衡解釋何時把分類留在商品維度
- 比對兩種路徑的分類金額與空部門計數
tags:
- 星型模型
- 雪花模型
- 正規化
resources:
- title: Microsoft：星型模型與維度
  url: https://learn.microsoft.com/en-us/power-bi/guidance/star-schema
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看商品維度的雪花拆分，再比較使用成本。
concepts:
- id: sq-model-05-star
  prompt: 星型模型中，事實要按商品類別分組，類別通常從哪裡來？
  answer: 事實直接連商品維度，商品維度內便有分類屬性。
  mcq:
    options:
    - 商品維度的分類欄
    - 日期維度的月份欄
    - 每筆事實的鍵前綴
    - 從金額反推
    answer: 0
    explain: 直接到商品維度是這個星型的特徵；分類不必存進每筆事實或繞日期。
- id: sq-model-05-snowflake
  prompt: 把分類拆成獨立表後，事實如何拿到分類名？
  answer: 先以商品鍵連商品，再以分類鍵連分類；兩段都要維持多對一。
  mcq:
    options:
    - 事實跳過商品直連分類鍵
    - 事實連商品再連分類
    - 事實以金額連分類
    - 每列事實複製所有分類
    answer: 1
    explain: 分類鍵在商品維度上，直接用商品鍵連分類會錯配。
- id: sq-model-05-fanout-guard
  prompt: 拆出的分類表一個分類鍵有兩列時，分類金額為何會變大？
  answer: 同一筆事實可能經商品連到兩列分類，重複計入。
  mcq:
    options:
    - 金額被自動轉換了幣別
    - 分類鍵需要排序
    - 違反多對一，連接複製事實
    - GROUP BY 不允許連接
    answer: 2
    explain: 不該靠去重金額補救；要先保證被連接的分類鍵唯一。
- id: sq-model-05-choice
  prompt: 什麼情況可能值得接受多一段 JOIN？
  answer: 分類有獨立維護與共用需求，而額外的查詢與使用成本可接受時。
  interview:
    question: 星型與雪花模型，給報表團隊你會選哪個？
    answer: 我預設給報表團隊星型，減少連接和誤用。若分類有自己的管理流程、很多維度共用，我才評估拆表；無論哪個，我都先驗證分類鍵唯一與總額守恆，再比較真實負載。
    points:
    - 說出查詢路徑差異
    - 說出維護取捨而非保證效能
    - 給出粒度與金額驗證
practice:
- id: sq-model-05-p1
  kind: sql
  category: [model, join]
  title: 沿星型路徑算分類成交額
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    只算已付款訂單明細，以 `products.category` 分組，依序輸出 `category`、`gross_amount`，依 `gross_amount` 降序，再依 `category` 升序。
  solution: |
    SELECT p.category, SUM(i.qty * i.unit_price) AS gross_amount
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    JOIN products p ON p.product_id = i.product_id
    WHERE o.status = 'paid'
    GROUP BY p.category ORDER BY gross_amount DESC, p.category;
  explain: |
    直接從商品維度取分類。若按商品鍵分組，就仍是一商品一列，沒有得到分類層級。
  hints:
  - 從明細用 product_id 連商品
  - 用訂單狀態篩付費
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-05-star
  - sq-model-03-fact
  tags:
  - 星型模型
  - 雪花模型
- id: sq-model-05-p2
  kind: sql
  category: [model, join]
  title: 沿雪花路徑保留空部門
  minutes: 7
  level: 3
  dataset: hr
  prompt: |
    對所有部門，連目前員工再連現行薪級（`valid_to IS NULL`）。依序輸出 `dept_id`、`dept_name`、現行有薪級的員工數 `staff_count`、月薪合計 `pay_total`。無員工的部門兩值為 0，按 `dept_id` 升序。
  solution: |
    SELECT d.dept_id, d.dept_name, COUNT(s.employee_id) AS staff_count,
           COALESCE(SUM(s.monthly_pay), 0) AS pay_total
    FROM departments d LEFT JOIN employees e ON e.dept_id = d.dept_id
    LEFT JOIN salary_history s ON s.employee_id = e.employee_id AND s.valid_to IS NULL
    GROUP BY d.dept_id, d.dept_name ORDER BY d.dept_id;
  explain: |
    兩段走部門、員工、薪級；把現行條件放進連接前的子查詢或連接條件。`COUNT(*)` 會把空部門保留列視為員工。雖然本題從部門反向走，仍要驗證薪級到員工、員工到部門是多對一。
  hints:
  - 以 departments 為保留端
  - COUNT 薪級的 employee_id，再為 SUM 填零
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-05-snowflake
  - sq-model-05-fanout-guard
  - sq-model-04-unknown
  tags:
  - 星型模型
  - 雪花模型
---

## 先畫查詢路徑

同一筆茶舖銷售想按不同類別彙總。這時顯示的是「茶飲」還是分類代碼，不必由每筆事實決定。模型可以用兩種方式安放分類：

- **星型模型（star schema，亦稱星狀綱要）**：已付款品項事實在中央，外圍的商品、會員、日期等維度與它直接連接。商品維度已存分類名，按類別查只需從品項連到商品。為教學，`shop` 的付費狀態仍由訂單表頭取；正式事實若已封裝這個口徑，報表不必再自行篩一次。
- **雪花模型（snowflake schema，台灣多稱雪花綱要）**：把商品分類的鍵及屬性提到獨立維度表。路徑變成事實 → 商品 → 分類。這是正規化（normalization）的一種用法：有自己的維護責任的描述放一處，用鍵連回去。

如果分類只是一個供報表分組的文字，我會先選星型，容易教、也少一個連錯的地方。若分類還有獨立層級、管理時程，且許多維度要共用同一套代碼，拆開較方便更新。並不等於星型永遠較快：維度大小、篩選和實際執行計畫都會影響速度。星型可能由上游集中維護分類後展平，不需要由每個人改商品表。

## 驗證拆表沒改掉金額

試著用手畫兩張圖。第一張只有事實與商品，將分類名寫在商品內；第二張商品只留分類鍵。對同一批事實，兩張圖都應把一筆明細送到同一個分類。要驗證，先檢查商品鍵唯一、分類鍵唯一，再比對付費明細總額與各分類加總。若分類缺失，先約定未知桶，不可因 INNER JOIN 的預設行為漏錢。

下一個數據集 `hr` 展示類似的分拆。薪級只能先找員工，再用員工的目前部門找部門描述。題目要列所有部門，因此反向從部門開始，忽略薪級過去版本但不能丟掉沒員工的籌備處。因 `employees` 只存現在編制，這張結果不能宣稱是歷史部門薪資；改成歷史題時，部門也必須有當時的版本。用結果的最後一列核對籌備處：人數和金額都應是 0。

如果你選擇雪花，還要問下游是否需要「報表看到的是當時的分類」。直接修改共用分類名，可能讓所有舊品項跟著改名。需要保存舊歸屬時，版本政策仍得另設，不能靠拆表解決。

## 方言與常見錯誤

本課用標準 `JOIN … ON` 寫明鍵。Spark SQL 有 `BROADCAST` 提示可在分析過執行計畫後考慮；MySQL 的索引與提示不同，不要把 Spark 專用提示當建模準則。小表上的演練是確認正確性，不是跨引擎速度比較。

- 分類合計比總額大 → 分類鍵重複 → 對分類鍵跑唯一性檢查再連。
- 空部門不見 → 使用內連接或在連接後刪去右側缺值 → 以部門為保留端。
- 一個員工被數多次 → 同時連到舊薪級 → 依查詢時點選出一版。
