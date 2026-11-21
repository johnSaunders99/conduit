---
id: cl-wh-01
module: cl-wh
order: 1
title: ETL 與 ELT
subtitle: 先載入或先清洗怎麼選
status: ready
minutes: 35
level: 3
prereqs: []
objectives: ["畫出 ETL 和 ELT 的落地點及轉換位置","依欄位敏感程度決定哪些數據可載入","查出原始列到報表列的差異並保存對帳"]
tags: ["ETL","ELT","原始層","最小揭露"]
resources:
  - title: "AWS：區分 ETL 與 ELT"
    url: https://aws.amazon.com/compare/the-difference-between-etl-and-elt/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "讀流程先後，對照載入前後的轉換位置。"
concepts:
  - id: cl-wh-01-location
    prompt: "ETL 與 ELT 的主要區別是什麼？"
    answer: "相對於載入目標系統，轉換是在載入之前或之後。"
    mcq:
      options:
        - "相對於載入目標系統，轉換是在載入之前或之後。"
        - "ETL 用批次，ELT 只能用實時。"
        - "ETL 才擷取來源，ELT 不擷取。"
        - "ELT 只轉檔名，不轉內容。"
      answer: 0
      explain: "擷取、載入、轉換兩者都有；不同的是轉換相對於目標落地的時間與位置。"
  - id: cl-wh-01-boundary
    prompt: "落地前禁止傳送可識別的會員欄位，該怎麼做？"
    answer: "先在來源側移除或依規格保護欄位，只載入核准內容。"
    mcq:
      options:
        - "先把完整原始表放進目標，再對公開報表遮蔽。"
        - "先讓所有分析角色讀完整原始表，之後再縮權。"
        - "先在來源側移除或依規格保護欄位，只載入核准內容。"
        - "只把會員欄位改名再載入。"
      answer: 2
      explain: "禁止的是越過入口；限制報表曝光不能補救不該發生的載入。"
    interview:
      question: "怎麼選訂單管道用 ETL 還是 ELT？"
      points:
        - "用合規邊界排除不合格方案"
        - "看目標算力與重算成本"
        - "保留口徑與回放驗證"
      answer: "以欄位能不能進目標當第一關。若核准的原始數據可受限保留，ELT 讓目標重算更簡單；若不允許進去，就在邊界前先轉換。兩種都要驗同一批的列數、鍵與失敗處置。"
  - id: cl-wh-01-replay
    prompt: "為什麼日報修口徑時想留一份受限的原始批次？"
    answer: "核准後可固定輸入，比較新舊口徑及回放；保留仍須有期限及讀者限制。"
    mcq:
      options:
        - "讓任何人可以跳過日報直接讀會員明細。"
        - "核准後可固定輸入，比較新舊口徑及回放；保留仍須有期限及讀者限制。"
        - "使重算自動免費。"
        - "只要有原始批次就不用記版本。"
      answer: 1
      explain: "原始落地有助重跑，但不取代權限、成本及版本管理。"
practice:
  - id: cl-wh-01-p1
    title: "從原始表挑出可發布的日訂單"
    kind: sql
    category: [select, model]
    minutes: 6
    dataset: shop
    level: 1
    prompt: |
      用 `shop` 的 `orders` 篩出 2026-01-18 狀態為 `paid` 的訂單。只回傳 `order_id`、`order_date`，依此欄位順序，列按 `order_id` 升序；不發出 `user_id`。
    solution: |
      SELECT order_id, order_date
      FROM orders
      WHERE order_date = DATE '2026-01-18' AND status = 'paid'
      ORDER BY order_id;
    explain: |
      先限制欄位，再用日期和狀態決定哪些列發布。只挑欄位卻沒篩狀態會把取消單發出去。這題只驗報表輸出，不表示原始表進倉合規。
    hints: ["回想 SELECT 的欄位清單。","用 AND 同時限制日期和狀態。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-01-boundary","sq-read-02-filter","sq-metrics-09-small"]
    tags: ["欄位投影","發布"]
  - id: cl-wh-01-p2
    title: "按日對帳原始與已付款列數"
    kind: sql
    category: [reconcile, aggregate]
    minutes: 8
    dataset: shop
    level: 2
    prompt: |
      用 `shop` 的 `orders` 計算 2026-01-17 到 2026-01-19（含首尾）每日原始訂單列數及 `paid` 列數。只輸出有訂單的日期。欄位依序為 `order_date`、`raw_rows`、`published_rows`；依日期升序。
    solution: |
      SELECT order_date, COUNT(*) AS raw_rows,
             SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS published_rows
      FROM orders
      WHERE order_date >= DATE '2026-01-17' AND order_date < DATE '2026-01-20'
      GROUP BY order_date
      ORDER BY order_date;
    explain: |
      保留日期範圍內全部列作對帳，只有狀態是 paid 才加到發布數。若在 WHERE 先剔除非 paid，兩欄會相同，失去驗證依據。CASE 寫法也免依賴 DuckDB 的條件聚合簡寫。
    hints: ["用 WHERE 選批次日期，不用它排除取消單。","讓 CASE 回傳 1 或 0，再用 SUM 加總。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-01-replay","sq-group-06-count","sq-group-03-key","sql-range-bound"]
    tags: ["對帳","條件聚合"]
  - id: cl-wh-01-p3
    title: "保存一張落地邊界圖"
    kind: hands-on
    minutes: 7
    steps:
      - "用文字各畫一條 ETL、ELT 的來源到發布順序。"
      - "在兩條路上各標原始內容落地點、禁止越界欄位與重算位置。"
      - "把第 2 題日對帳結果貼在圖下，說明 1 月 18 日差 1 列的理由。"
    checks:
      - "圖中有一條先淘汰禁止欄位才載入的可行路徑。"
      - "對帳記錄 1 月 18 日原始 2 列、發布 1 列。"
---

## 成本安全：先在本機畫邊界

本堂用應用內 DuckDB，不建立雲端數倉。若日後做雲端小試驗，先查免費額度、儲存與轉換各如何計費，限定 1 天樣本和預算，列出暫存的清理責任。任何原始數據未經核准不能靠「先傳上去再刪」補救。

營運要看日訂單，不需要會員編號。另一組卻想保留受限的原始批次，以便改口徑後重算。選擇在哪一步處理欄位，決定可否安全地滿足兩件事。數據倉庫（data warehouse，簡稱數倉；台灣多稱資料倉儲）是用來分析數據的目標，以下的「載入」專指落地到這個目標，而不是程式用記憶體讀取來源。

## 同樣三步，落地點不一樣

- 擷取（extract）：取得原始批次，記下來源、業務日與批次鍵。
- 轉換（transform）：套用清洗、欄位限制、篩選及彙總。這次報表只保留已付款的訂單鍵與業務日。
- 載入（load）：把數據寫入選好的目標，並確認可查詢的範圍。

擷取轉換載入（ETL，Extract–Transform–Load）先在受控來源側轉換，再載入目標。擷取載入轉換（ELT，Extract–Load–Transform）先載入核准的原始批次到受限原始層，再由目標引擎轉換和發布。實務可以混用：先移除不許離開來源的欄位，再把核准的其餘數據進倉做 ELT。單靠先後順序不保證安全，原始層的讀權、保留期以及輸出邊界仍要管理。

## 本機比對一批數據的輸入與輸出

選 SQL 練習場的 `shop`。用下面查詢看 1 月 18 日的來源狀態，再在題目中產出報表欄位及日對帳。`SELECT` 只取需要的欄（projection），`WHERE` 選列；本例不把結果寫入新表，用查詢結果模擬發布。

```sql
SELECT order_id, status
FROM orders
WHERE order_date = DATE '2026-01-18'
ORDER BY order_id;
```

來源是 `1010 paid` 和 `1011 cancelled`。發布預期 1 列，不含 `user_id`；對帳還要能解釋另 1 列為何沒發布。若只比較報表列數，可能掩蓋一筆本該發布的訂單遺失與一筆取消單誤入。除了總數，留一份逐鍵差異、規則版本和批次切點。ELT 重算便利的前提是原始切點可重讀，且應該先知道數倉端會掃多少；估算方法見[〈BigQuery 分區與費用〉](#/lesson/cl-wh-02)。

### 更改發布規則而不改歷史輸入

假設下週新增一個可發布狀態，先固定本堂的原始快照，留兩份輸出：原規則和新規則。檢查新增的是哪幾個鍵，不要只宣布差一列。若在來源側做 ETL，需確認是否還能合法取得重跑所需的原始欄位；若已在目標端保留，則限制重跑帳戶只讀該批。這讓轉換位置成為可交接的決定，而非偏好工具名稱。

## 常見錯誤

- 公開表沒敏感欄卻仍違規 → 原始列已傳到不許落地的位置 → 在入口前移除。
- 兩個計數永遠相等 → 在共用來源先去掉取消列 → 原始計數在篩狀態前取得。
- 本機重跑秒過便承諾上雲成本 → 本機只驗輸出語義 → 另量雲端掃描、保留及重試。
