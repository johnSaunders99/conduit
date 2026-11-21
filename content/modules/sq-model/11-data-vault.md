---
id: sq-model-11
module: sq-model
order: 11
title: Data Vault
subtitle: 為何拆成核心鍵關係與歷史
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-10
objectives:
- 將來源鍵、關係與歷史描述分到 Hub、Link、Satellite
- 對商品與訂單的關係去重，不混同原始明細粒度
- 把歷史整合模型與供報表的星型模型分開
tags:
- Data Vault
- Hub
- Link
- Satellite
- 業務鍵
resources:
- title: AutomateDV：Hub
  url: https://automate-dv.readthedocs.io/en/latest/tutorial/tut_hubs/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看業務鍵、載入日期與來源欄的責任。
- title: AutomateDV：Link
  url: https://automate-dv.readthedocs.io/en/latest/tutorial/tut_links/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看兩個核心鍵如何形成關係。
- title: AutomateDV：Satellite
  url: https://automate-dv.readthedocs.io/en/latest/tutorial/tut_satellites/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看描述版本與載入時間如何保存。
concepts:
- id: sq-model-11-hub
  prompt: 訂單核心鍵屬於 Data Vault 的哪一部分？
  answer: Hub；以同一規則認得業務身分，而不是把每筆描述歷史塞在核心鍵表。
  mcq:
    options:
    - Hub
    - Link
    - Satellite
    - 日報集市
    answer: 0
    explain: Hub 管業務鍵；Link 管關係，Satellite 管描述歷史，集市則讓人查分析。
- id: sq-model-11-link
  prompt: 同一張單可有多行同商品，若粒度是曾出現的訂單與商品關係，應保留什麼？
  answer: 每一組訂單鍵與商品鍵一列。要保留多行事件則另設帶行號的粒度。
  mcq:
    options:
    - 一律每行獨立
    - 每單只保第一個商品
    - 每組訂單與商品一列
    - 只保留同價商品
    answer: 2
    explain: 每行不等於一種關係；反過來只留訂單鍵也會遺失商品。
- id: sq-model-11-satellite
  prompt: 薪級調整的歷史描述放哪裡最合理？
  answer: 員工鍵所屬的 Satellite；區分來源的生效日和系統看到這版的載入時間。
  mcq:
    options:
    - 更新 Hub 的月薪
    - 用 Link 保存單一現值
    - 只留日報平均
    - 在 Satellite 保留每版
    answer: 3
    explain: 只覆寫 Hub 會遺失歷史；生效時間和接收時間也不一定相同。
- id: sq-model-11-presentation
  prompt: 為什麼一般不讓每個報表直接拼 Data Vault？
  answer: 歷史和關係都要以不同條件連接，容易重寫口徑；以可驗算的模型封裝成好用的集市。
  interview:
    question: 只有一個茶舖來源，要直接建 Data Vault 嗎？
    answer: 我會先做能對帳的維度集市，除非我們很快會接多套來源，且必須追溯原始關係與版本。採用時我用 Hub、Link、Satellite 保留整合證據，再把常用口徑交付成星型。
    points:
    - 說出採用成本與稽核需求
    - 區分三部分
    - 說明呈現層仍需要設計
practice:
- id: sq-model-11-p1
  kind: sql
  category: [model, distinct]
  title: 列出曾出現的訂單商品關係
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    以所有 `order_items`（含取消單明細）為初次輸入，再附加一遍 1001 號的所有明細來模擬來源重送，得到去重後的關係。依序輸出 `order_id`、`product_id`；按兩欄依序升序。不輸出行號、數量或金額。
  solution: |
    WITH received AS (
      SELECT order_id, product_id FROM order_items
      UNION ALL
      SELECT order_id, product_id FROM order_items WHERE order_id = 1001
    )
    SELECT DISTINCT order_id, product_id FROM received ORDER BY order_id, product_id;
  explain: |
    `DISTINCT` 作用於兩欄的組合。用 `line_no` 會把關係粒度變成明細；只保留 `product_id` 會失去所屬訂單。
  hints:
  - 用 UNION ALL 附加重送列；最後只投影兩個業務鍵去重
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-11-link
  - sq-model-11-hub
  - sq-model-02-grain
  tags:
  - Data Vault
  - Hub
- id: sq-model-11-p2
  kind: sql
  category: [model, scd]
  title: 交付一個有現值及版本數的視圖
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    以 `employees` 為基礎，對每個員工輸出 `employee_id`、薪級版本數 `version_count`、現行薪級 `current_pay`。沒有現行版本填 NULL，沒有歷史時版本數為 0，按 `employee_id` 升序。現行指迄日為 NULL；練習數據中每人至多 1 版現行。
  solution: |
    SELECT e.employee_id, COUNT(s.employee_id) AS version_count,
           MAX(CASE WHEN s.valid_to IS NULL THEN s.monthly_pay END) AS current_pay
    FROM employees e LEFT JOIN salary_history s ON s.employee_id = e.employee_id
    GROUP BY e.employee_id ORDER BY e.employee_id;
  explain: |
    分開統計歷史與投影現行值，不能用歷史列的最大薪資替代現行。使用 CASE 加條件聚合可在 Hive SQL、Spark SQL 和 MySQL 寫出相同形狀。
  hints:
  - LEFT JOIN 保留員工
  - COUNT 右側員工鍵，CASE 只把現行薪級送入聚合
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-11-satellite
  - sq-model-11-presentation
  - sq-model-08-current-vs-asof
  tags:
  - Data Vault
  - Hub
---

## 三個問題，三種表

不同系統對商品與訂單的描述會變。如果不只要做今日報表，還要能回頭查「哪個來源在何時帶來這個版本」，可考慮數據保險庫（Data Vault，台灣也稱資料保險庫）。它把辨認身分、連起關係和保存描述歷史分開。先不談自動產碼，只問表裡的一列負責回答什麼：

- **核心鍵表（Hub）**：這是哪個業務對象？例如訂單 Hub 保存不重複的訂單業務鍵，以及最初載入與來源證據。商品 Hub 也有自己的鍵，同一組值若代表不同來源的不同對象，先規定識別範圍。
- **關係表（Link）**：哪些業務對象發生了這種關係？例如訂單鍵與商品鍵的配對。若要保存每個成交行號，應另外設計帶行號的交易粒度，不能由去重後配對推回件數。
- **衛星表（Satellite）**：這個身分或關係曾有什麼描述？例如員工的月薪版本。保存來源與載入時間便於追蹤；業務生效日是來源知道何時生效，和系統何時收到不一定相同。

這些表不是因為拆開就自動可信。正式載入須明訂業務鍵、鍵值正規化、重送規則與來源標記。系統看見第 2 版的時間，只能證明收到了第 2 版，不能斷言業務在同一瞬間生效。

## 從歷史整合回到分析

在 `shop` 用兩欄去重取訂單商品關係，驗證 1001 有 2 個不同商品，不能由結果知道小杯是 3 件。這只是 Link 的關係形狀，不是假裝已載好合格的 Data Vault。再到 `hr` 把員工鍵想成 Hub 的身分，把 `salary_history` 想成描述歷史的教學替身；它沒有載入時間，不能回答系統最早何時知道調薪。

給主管的表一人一列，包含現行薪級和版本數。員工 1 會是 2 版、40500 元；員工 3 只有 1 版、42000 元。同一口徑若由各張報表自己連歷史，容易把現行薪級複製多次。較好的交付是封裝成可發現、可對帳的集市，必要時再把現行唯一性作成獨立測試。只有一份簡單來源時，不必為了術語多造三套表。

若之後要接第二套訂單，先寫「相同編號是否同一張單」的規則，而非看到同值就合併。兩站各自發號時可納入站點識別；若它們真的共享業務識別，則保持同一身分，另保留每次載入來源。

先記下這項約定，再去設計鍵。

## 方言與常見錯誤

本課用 `DISTINCT` 得關係、用 `CASE` 做條件彙總，不必生成雜湊鍵（hash key）。若正式設計使用雜湊，Spark SQL、Hive SQL 的 `sha2(value, 256)` 與 DuckDB 的 `sha256(value)` 語法不同；還要對齊編碼、欄位順序與空值規則，不能只對函式名稱。

- 加入品項量後關係重複 → 混了關係與明細粒度 → 另存明細事實。
- 查到現行月薪卻說是歷史部門 → 部門只存現在 → 標註限制或補歷史來源。
- 舊歷史無法追到哪一批 → 漏了載入證據 → 保留來源與載入批次。
