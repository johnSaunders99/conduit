---
id: cl-dbt-02
module: cl-dbt
order: 2
title: ref 與依賴圖
subtitle: 改動上游會影響誰
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-01
objectives:
- 使用 ref 建立暫存模型到日報的依賴
- 在編譯後 SQL 找到已解析的關聯名
- 用選取結果確認 stg_orders 的下游集合
tags:
- ref
- DAG
- 數據血緣
- dbt compile
resources:
- title: dbt：ref()
  url: https://docs.getdbt.com/reference/dbt-jinja-functions/ref
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀模型引用、關聯名稱與依賴紀錄。
- title: dbt：依賴圖選擇運算子
  url: https://docs.getdbt.com/reference/node-selection/graph-operators
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀加號前後的位置如何改變選取範圍。
concepts:
- id: cl-dbt-02-ref
  prompt: 把下游硬編碼的 stg_orders 表名改成 ref 有何好處？
  answer: dbt 會解析目標環境的完整關聯名，也記下一條模型依賴供選取和排序。
  mcq:
    options:
    - 會自動替來源去重
    - 會保證 SQL 聚合正確
    - 辨認關聯名並登記依賴
    - 會把 view 自動改成 table
    answer: 2
    explain: 硬編碼也可能跑出數字，但不會自動告知 dbt 這條依賴。
  interview:
    question: 下游跑出舊版表但 SQL 沒報錯，你先查哪裡？
    answer: 我先看模型是否硬編碼了別的 schema，再看編譯 SQL 和依賴圖。用 ref 讓目標環境決定關聯名，也能在發版前用 dbt ls 看受影響模型，而不是只憑表名猜。
    points:
    - 查環境與編譯證據
    - 說明 ref 形成依賴
    - 區分列出和建置
- id: cl-dbt-02-dag
  prompt: 依賴圖中兩個模型可以互相 ref 嗎？
  answer: 不行。沒有任何一個能先建；應拆出兩者共用的上游模型。
  mcq:
    options:
    - 可以，依字母順序跑
    - 不行，拆出共用上游
    - 可以，兩份查詢一起跑
    - 只在 DuckDB 不行
    answer: 1
    explain: 有向無環圖不容許循環；手動換順序不能讓兩邊都先完成。
- id: cl-dbt-02-select
  prompt: 想列出 stg_orders 和所有下游，要把加號放哪裡？
  answer: 放在選取名後面：stg_orders+。
  mcq:
    options:
    - +stg_orders
    - stg_orders
    - +stg_orders+
    - stg_orders+
    answer: 3
    explain: 前置加號是上游；不加只指定節點本身，可能還有間接選到的測試。
- id: cl-dbt-02-compile
  prompt: dbt compile 顯示正確表名，能否證明模型通過數據測試？
  answer: 不能；編譯檢查解析結果，不等於寫出模型或驗證列值。
practice:
- id: cl-dbt-02-p1
  kind: sql
  category: [dbt, cte]
  title: 從暫存定義上接付款日報
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    用 `orders` 模擬上游，把狀態去空格並轉小寫，再按日數付費單。依序輸出 `order_date`、`paid_orders`，按日期升序，不補無付費日期。
  solution: |
    WITH stg_orders AS (
      SELECT order_date, LOWER(TRIM(status)) AS order_status FROM orders
    )
    SELECT order_date, COUNT(*) AS paid_orders
    FROM stg_orders WHERE order_status = 'paid'
    GROUP BY order_date ORDER BY order_date;
  explain: |
    暫存模型提供一致狀態，日報才加業務條件；避免將 SQL 樣板直接貼入練習場。
  hints:
  - 給清理結果一個 CTE 名稱
  - 下游使用清理後的狀態
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-02-ref
  - sq-model-01-scope
  tags:
  - ref
  - DAG
- id: cl-dbt-02-p2
  kind: sql
  category: [dbt, cte]
  title: 回到日報粒度核對取消單
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    1009–1013 號訂單作為暫存樣本。依 `order_date` 分組，依序輸出 `order_date`、`order_count`、`paid_orders`；包含樣本所有營業日，無付費填 0，日期升序。
  solution: |
    SELECT order_date, COUNT(*) AS order_count,
           SUM(CASE WHEN LOWER(TRIM(status)) = 'paid' THEN 1 ELSE 0 END) AS paid_orders
    FROM orders WHERE order_id BETWEEN 1009 AND 1013
    GROUP BY order_date ORDER BY order_date;
  explain: |
    維持同一上游，對總單數及付款數用不同篩選口徑。先 WHERE 篩付費會讓兩個指標永遠相等。
  hints:
  - COUNT(*) 算總單
  - CASE WHEN 分開計付費
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-02-ref
  - sq-model-02-grain
  tags:
  - ref
  - DAG
- id: cl-dbt-02-lab
  kind: code
  title: 用 ref 接出付費日報
  minutes: 9
  steps:
  - 把正文的日報存成 models/fct_daily_orders.sql，列出受 stg_orders 影響的模型。
  - 從前一堂的專案根目錄跑正文的編譯、建置和讀回。
  checks:
  - 選取結果含 stg_orders 與 fct_daily_orders；編譯後 SQL 中沒有 Jinja。
  - 本機日報只有 1 月 17、18 日，每天各 1 筆付費單；取消單未被多算。
---

## 先能回答「誰會受影響」

上游暫存把 `status` 改名為 `order_status`。如果日報只硬編碼 `main.stg_orders`，dbt 看不見它依賴暫存。即使這次碰巧查得到表，換測試環境，或兩個模型執行先後錯了，下游有可能讀舊表。相反地，明確的引用能讓工具為你排序，也能在發布之前找到改動的影響範圍。

依賴圖（dependency graph）由節點與箭頭構成：來源指向暫存，暫存指向日報。它必須是有向無環圖（directed acyclic graph，DAG）。若日報要等暫存、暫存又用日報計算欄位，沒有一個能先跑；抽成兩者都能引用的底層模型，不是手工調換順序就能修好。

## 用兩種引用寫出一條線

- `source('來源名稱', '表名')`：讀外部提供的表，來源名與表名由 YAML 登記。
- `ref('模型名稱')`：讀 dbt 管理的模型；通常使用 SQL 檔名去掉副檔名。dbt 解析名稱，並加入依賴。
- `dbt ls --select 名稱+`：查看該節點與下游。`+名稱` 選上游與本身。`ls` 只列節點，不寫模型。

在[〈模型與來源〉](#/lesson/cl-dbt-01)的 `dbt-shop` 專案新增 `models/fct_daily_orders.sql`。暫存保留所有合法狀態，日報才加付款條件：

```sql
SELECT order_date, COUNT(*) AS paid_orders
FROM {{ ref('stg_orders') }}
WHERE order_status = 'paid'
GROUP BY order_date
```

回到 `dbt-shop` 根目錄，先看準備要跑哪個集合，再開編譯結果。看到名稱解析不能當作數據已正確；接著建置再讀結果：

```powershell
.\.venv\Scripts\dbt.exe ls --select "stg_orders+" --resource-type model --profiles-dir .
.\.venv\Scripts\dbt.exe compile --select fct_daily_orders --profiles-dir .
Get-Content .\target\compiled\conduit_shop\models\fct_daily_orders.sql
.\.venv\Scripts\dbt.exe build --select "stg_orders+" --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT * FROM main.fct_daily_orders ORDER BY order_date').fetchall())"
```

輸出 1 月 17、18 日各 1 單。可以沿「原始訂單 → 暫存 → 日報」追出 1011 在哪裡排除：暫存仍有，付費日報不算。把這個位置講給同事，比只說「我用了 ref」更有用。

把每個節點的輸入與輸出各寫一行。來源是外部流程持有的表；暫存是每單一列的標準狀態；日報把多張單收成一日一列。這個註記能讓改動者知道哪裡可以加入日彙總，哪裡應保留原始粒度。如果日報錯誤，你也有三個位置可做對照：來源狀態、清理結果、分組計數，而不是從一個大查詢猜起。

再試把 `stg_orders+` 的加號暫時放前面。前置表示要沿箭頭往回找輸入，後置表示往前找消費者。命令限制只列模型時，來源不會出現在清單；拿掉類型過濾才能看清有哪些其它節點。報表或試算表直接連數據庫的依賴，也不會因為加了 `ref` 自動被找到，這些仍要在[〈模型文件與擁有者〉](#/lesson/cl-contract-03)盤點。

當日報未重建卻查得到表，不要只看名稱。讀回時同時核對那一版的欄名、最近建置證據和一個已知數值。三者一起才說得出讀的是哪一份。

## 方言與常見錯誤

`ref` 由 dbt 解析，不是任何 SQL 引擎的函式。DuckDB 中完整的關聯名稱與 MySQL 或 Hive SQL 的命名層次不一定相同，讓適配器處理。輸出是否有序由外層查詢決定，不由依賴圖決定。

- 下游還查到舊關聯 → 硬編碼環境名稱 → 用 `ref` 並檢查編譯 SQL。
- 預覽只出現上游 → 加號方向錯 → 要影響範圍用 `名稱+`。
- 建置完成就當驗收 → 只證明模型跑過 → 另查列結果與口徑。
