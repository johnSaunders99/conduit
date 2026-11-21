---
id: cl-contract-02
module: cl-contract
order: 2
title: 欄位契約與版本
subtitle: 下游會在何時被改壞
status: ready
minutes: 35
level: 3
prereqs:
- cl-contract-01
objectives:
- 把粒度、欄名、型別、非空及單位寫成欄位契約
- 依實際消費者行為判斷結構變更相容性
- 並存兩個 dbt 輸出版本並檢查各自欄位
tags:
- 數據契約
- 欄位型別
- 模型版本
- 向後相容
resources:
- title: dbt：模型契約
  url: https://docs.getdbt.com/docs/mesh/govern/model-contracts
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看欄名、型別檢查與適配器限制。
- title: dbt：模型版本
  url: https://docs.getdbt.com/docs/mesh/govern/model-versions
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀版本檔名與 ref 的版本選擇方式。
concepts:
- id: cl-contract-02-structural
  prompt: 模型契約通過可否證明金額仍以元表示？
  answer: 不能；欄名型別可能相同而語義變了。單位需有描述與數值對帳。
  mcq:
    options:
    - 可以，只要欄名相同
    - 可以，數值都是整數
    - 不能，另驗口徑與樣本
    - 取決於表有幾欄
    answer: 2
    explain: 結構與語義是不同層，欄位型別不會證明數值含義。
- id: cl-contract-02-additive-change
  prompt: 新增可空欄必然對所有消費者相容嗎？
  answer: 不必然；只讀指定欄的多半不受影響，但依固定列形狀或 SELECT * 的用戶可能受影響。
  mcq:
    options:
    - 必然相容
    - 需檢查消費者如何讀欄
    - 必然破壞所有人
    - 只要列順序不變就相容
    answer: 1
    explain: 相容性要看真實依賴與解析方式，不只看欄位是否 NULL。
  interview:
    question: PM 說只是加一個可空欄，不用通知下游，你會怎麼做？
    answer: 先找模型的引用和外部讀取方，確認有沒有按固定欄數解析或使用 SELECT *。若都按欄名取用，可能只需文件和驗收；若有破壞風險，我會提供並存版本與遷移期。
    points:
    - 依消費方式判影響
    - 同時考慮結構與語義
    - 說出版本與遷移策略
- id: cl-contract-02-version
  prompt: 舊客戶要在新版發布後繼續讀原欄名，該如何引用？
  answer: 明確指定 v1，讓舊契約仍可用；確認遷移完成才停用。
  mcq:
    options:
    - 永遠讀未指定版本的 ref
    - 用 SELECT * 解決
    - 將 v1 改成 v2 的欄名
    - 用 ref 指定 version=1
    answer: 3
    explain: 不固定版本可能跟向預設新版；同名覆寫不給遷移緩衝。
- id: cl-contract-02-semantic-breaking
  prompt: 把訂單數從只計付費改為計所有訂單，需要版本嗎？
  answer: 即使結構相同也是破壞性口徑更改；應另發新版或另名，與使用方約定切換。
practice:
- id: cl-contract-02-p1
  kind: sql
  category: [dbt, select]
  title: 用明確欄名交付舊版
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    取 1009–1013 號所有訂單。依序輸出 `order_id`、`order_date`、`is_paid`（僅 `status = 'paid'` 為 true，其餘為 false），依 `order_id` 升序。不額外回傳來源狀態欄。
  solution: |
    SELECT order_id, order_date,
           CASE WHEN status = 'paid' THEN TRUE ELSE FALSE END AS is_paid
    FROM orders WHERE order_id BETWEEN 1009 AND 1013 ORDER BY order_id;
  explain: |
    明列欄位使上游新增其它欄不會溢出舊契約。取消不等於缺值，本題明示返回 false。
  hints:
  - 用 CASE 產生非空布林值
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-02-structural
  - cl-contract-02-additive-change
  tags:
  - 數據契約
  - 欄位型別
- id: cl-contract-02-p2
  kind: sql
  category: [dbt, aggregate]
  title: 從新版分欄適配到舊口徑
  minutes: 7
  level: 3
  dataset: shop
  prompt: |
    對每個有訂單的 `order_date`，在內部計算已付單數 `paid_count` 和取消單數 `cancelled_count`，再交付舊版只有付款日的介面。依序輸出 `order_date`、`paid_orders`（已付單數），捨棄沒有付費單的日期，按日期升序。
  solution: |
    WITH revised AS (
      SELECT order_date, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
      FROM orders GROUP BY order_date
    )
    SELECT order_date, paid_count AS paid_orders
    FROM revised WHERE paid_count > 0 ORDER BY order_date;
  explain: |
    用顯式投影和別名消化新版形狀，且保住舊版不含零付款日的條件。把兩類加起來或只改欄名不篩列，仍不相容。
  hints:
  - 先算新版的不同狀態
  - 在外層把 paid_count 改成舊名
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-02-version
  - cl-contract-02-semantic-breaking
  - cl-dbt-06-coverage
  tags:
  - 數據契約
  - 欄位型別
- id: cl-contract-02-lab
  kind: code
  title: 保存兩個可並存的日報版本
  minutes: 9
  steps:
  - 在 dbt-shop 建立兩個版本 SQL 與 report_orders.yml，跑正文的建置和 SHOW。
  - 在 delivery-contract.md 記粒度、型別、非空、含義、已知消費者及遷移風險。
  checks:
  - v1 欄為 order_date、paid_orders；v2 欄為 order_date、paid_count。
  - 兩版都保留相同付款口徑；即使數值相同，改名仍要遷移。
---

## 給使用者一份能依賴的承諾

日報把 `paid_orders` 改成 `paid_count`，兩欄值一模一樣，卻足以讓按舊欄名讀取的指令失敗。數據契約（data contract，亦稱數據合約）包括結構和語義。先寫出一列是什麼、鍵、欄名、型別、是否可空、單位和過濾條件，再寫新鮮度和擁有者。新增可空欄對按名讀取的程式通常安全，對用 `SELECT *` 或固定欄數匯入的工作不一定安全；把元改成分更不是「都是整數」就相容。

dbt 的模型契約（model contract）在受支援的適配器及物化方式驗證輸出結構；業務口徑、唯一性及完整性仍另外驗。模型版本（model version）則讓兩個介面並存。消費者可用 `ref('report_orders', version=1)` 固定舊版；未固定版本時會跟隨專案設定的最新版。

## 只更動欄名，不把默契藏起來

在 `dbt-shop` 新增 `models/report_orders_v1.sql`：

```sql
SELECT order_date, CAST(paid_orders AS BIGINT) AS paid_orders
FROM {{ ref('fct_daily_orders') }}
```

同目錄的 `models/report_orders_v2.sql` 則使用新欄名：

```sql
SELECT order_date, CAST(paid_orders AS BIGINT) AS paid_count
FROM {{ ref('fct_daily_orders') }}
```

把下列版本設定存為 `models/report_orders.yml`。使用表保存候選輸出；在本例只強制欄名及型別，不宣稱已強制所有鍵約束。版本指定各自欄位清單，模型層的設定由兩版繼承。

```yaml
version: 2
models:
  - name: report_orders
    latest_version: 2
    config:
      materialized: table
      contract:
        enforced: true
    versions:
      - v: 1
        columns:
          - name: order_date
            data_type: date
          - name: paid_orders
            data_type: bigint
      - v: 2
        columns:
          - name: order_date
            data_type: date
          - name: paid_count
            data_type: bigint
```

在根目錄執行；若你沒先建前一系列的日報，先跑含上游的這個選取。檢查兩版的列內容與欄名：

```powershell
.\.venv\Scripts\dbt.exe build --select "+report_orders" --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; db=duckdb.connect('lab.duckdb', read_only=True); print(db.execute('DESCRIBE main.report_orders_v1').fetchall()); print(db.execute('DESCRIBE main.report_orders_v2').fetchall())"
```

在照抄設定前，先寫你對這個模型要維護的契約：「只覆蓋至少一單已付款的營業日；一日一列；日期不可缺；筆數是不含取消的非負整數。」若下游拿這張表去跟完整日曆作差，它要明確區分「這天沒有付費日報列」與「來源沒有載完」。結構只說輸出形狀，這些例外要由文件與測試守住。契約也不會自動通知外部讀取方，因此要記下誰依賴固定欄名、誰依賴完整欄序。

試看兩個產物後，不要只對照 `DESCRIBE` 的欄位。用同一營業日比當日筆數，兩版在這次「只改欄名」的要求下必須相等。若值也不同就不能裝作相容遷移；評估是否是另一個指標，另名交付或另訂轉換。可暫時把新版欄位改成一個未宣告的別名再建一次，確認契約能攔住它，復原後再建。這個負例教你分辨契約真的在防什麼，不把結構驗證誤當兩版數值的保證。

實際準備替換預設版本時，不應照本地練習就把舊消費者留給工具自動遷移。先更新依賴，確認兩版可以並讀，讓匯出使用者實測換欄，最後才改預設。[〈交付驗收與停用〉](#/lesson/cl-contract-06)會把這段變成具體的切換與回退判準。

## 常見錯誤

- 結構檢查通過但付款變高 → 未驗口徑 → 用取消單樣本對帳。
- 推一個新空欄就破壞匯入 → 消費端靠固定欄數 → 先盤點，再提供相容版本。
- 切換後舊報表找不到欄 → 未固定版本又直接換預設 → 讓舊版並存，完成遷移再停用。
