---
id: cl-dbt-06
module: cl-dbt
order: 6
title: 測試與文件
subtitle: 交付可驗算的業務欄位
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-05
objectives:
- 以唯一性與非空測試保護日報粒度
- 寫出一個以違規列為輸出的業務測試
- 讓欄位口徑出現在可檢索的文件產物中
tags:
- dbt test
- 唯一性
- 數據測試
- 模型文件
resources:
- title: dbt：數據測試
  url: https://docs.getdbt.com/docs/build/data-tests
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀通用與單獨測試，確認失敗列的含義。
- title: dbt：模型文件
  url: https://docs.getdbt.com/docs/build/documentation
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看描述與欄名如何進入文件產物。
concepts:
- id: cl-dbt-06-fail-rows
  prompt: dbt 的單獨數據測試查詢應回什麼？
  answer: 回傳違反規則的列；通常 0 列代表通過，不是回傳布林值。
  mcq:
    options:
    - 所有正常列
    - 單列 true 或 false
    - 只回違規列
    - 總是回一列計數
    answer: 2
    explain: 查詢若永遠回一列 true/false，通常被視為有一列違規。
- id: cl-dbt-06-key-test
  prompt: 想保證一天只有一張付費日報列、且日期不能缺，該測什麼？
  answer: 在 order_date 分別配置 unique 與 not_null。
  mcq:
    options:
    - 只測 unique
    - unique 加 not_null
    - 只比較總列數
    - 只在文件寫「唯一」
    answer: 1
    explain: 唯一性不能替代非空，單查總列數也無法辨認重複日期。
- id: cl-dbt-06-docs
  prompt: 為何欄位描述要寫「不計取消」而不是只寫「付款數」？
  answer: 讓使用者知道納入邊界，且能用具體樣本核對。
  mcq:
    options:
    - 清楚記錄納入規則
    - 讓測試自動生成唯一性
    - 讓文件替代 SQL
    - 讓消費者不用看日期
    answer: 0
    explain: 單寫名字不夠；要保留可驗算的口徑，而不是依讀者猜義。
- id: cl-dbt-06-coverage
  prompt: unique 通過能證明付費單都算對嗎？
  answer: 不能；它只測粒度的一部分。還需要測數值口徑與對帳樣本。
  interview:
    question: 日報所有 dbt 測試都綠了，如何判斷能否交付？
    answer: 我會看測試到底測了什麼。日期唯一和非空只保住粒度；我會再用包含取消單的手算樣本與來源總量對帳，並讓文件寫出截止時間和排除規則。
    points:
    - 說出測試涵蓋範圍
    - 安排有鑑別力的對帳樣本
    - 交付可查口徑
practice:
- id: cl-dbt-06-p1
  kind: sql
  category: [dbt, distinct]
  title: 讓違規唯一鍵現形
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    把 `event_id` 誤當原始表的唯一鍵來檢查。列出出現超過一次的鍵，依序輸出 `event_id`、`duplicate_count`；按 `duplicate_count` 降序、`event_id` 升序。
  solution: |
    SELECT event_id, COUNT(*) AS duplicate_count FROM app_events
    GROUP BY event_id HAVING COUNT(*) > 1 ORDER BY duplicate_count DESC, event_id;
  explain: |
    測試應輸出實際違規鍵，不只回一個總數。原始接收列真正的鍵是 raw_id；這裡故意測出重送。
  hints:
  - GROUP BY 事件鍵
  - HAVING COUNT(*) > 1
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-06-fail-rows
  - cl-dbt-06-key-test
  - sq-model-02-line-key
  tags:
  - dbt test
  - 唯一性
- id: cl-dbt-06-p2
  kind: sql
  category: [dbt, reconcile]
  title: 對帳錯把取消單算入的日報
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    假設錯誤日報直接計所有 `orders`，正確日報只計 paid。只輸出兩者不同的日期，依序為 `order_date`、`reported_orders`、`expected_paid_orders`，按日期升序。
  solution: |
    SELECT order_date, COUNT(*) AS reported_orders,
           SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS expected_paid_orders
    FROM orders GROUP BY order_date
    HAVING COUNT(*) <> SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)
    ORDER BY order_date;
  explain: |
    這是口徑測試，日期即使唯一仍可能有錯。只要有取消單，錯誤日報在該天就有差異；不應先篩掉取消再算 reported。
  hints:
  - 用條件加總計算期望值
  - HAVING 排除相等的日子
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-06-coverage
  - cl-dbt-06-fail-rows
  - sq-model-01-scope
  tags:
  - dbt test
  - 唯一性
- id: cl-dbt-06-lab
  kind: code
  title: 留下一份可讀的測試與文件證據
  minutes: 9
  steps:
  - 加入日報 YAML 與 SQL 測試，跑 test，再生成文件。
  - 將 SQL 測試暫改成 paid_orders 大於或等於 1，確認測試失敗；改回原式再跑。
  checks:
  - 正常時日期的 unique、not_null 與負值檢查全過。
  - 故意改壞時單獨測試能指出 1 月 17 日和 18 日；文件有欄位口徑。
---

## 測規則，也把規則寫下來

日報第一欄叫 `order_date`，但「一天只出現一次」是業務規則，不是欄名自然具備的保證。數據測試（data test）會查找違反規則的列：通常回 0 列代表通過，回幾列代表找到幾項違規。模型文件則讓下游知道正確用法，兩者要一起交付。

- **通用數據測試（generic data test）**：把 `unique`、`not_null` 之類約定綁到欄位。前者查重複、後者查缺值；常要一起用。
- **單獨數據測試（singular data test）**：自己寫查詢，例如用 `WHERE` 找出負的付款數，或找與來源對帳不相等的列。
- **模型與欄位描述（description）**：定義粒度、分母、單位、例外；不能代替測試，卻能讓使用者知道該期待什麼。

## 加入兩層證據

在 `dbt-shop` 建立 `models/daily_orders.yml`。欄位級 `data_tests` 放在要檢查的欄位下方。日期唯一且非空，仍不能保證金額口徑；把必須另驗的付款範圍寫進描述。

```yaml
version: 2
models:
  - name: fct_daily_orders
    description: "One row per order date with at least one paid order."
    columns:
      - name: order_date
        description: "Business date from the orders source."
        data_tests:
          - unique
          - not_null
      - name: paid_orders
        description: "Count of paid orders, excluding cancelled orders."
```

在 `tests/no_negative_paid_orders.sql` 寫出單獨檢查。它回傳可追查的查詢欄，不回 `PASS` 字串。這是範例驗證；它不會發現把取消單加進去，因此還要在應用方保留 1011 的對帳案例。

```sql
SELECT order_date, paid_orders
FROM {{ ref('fct_daily_orders') }}
WHERE paid_orders < 0
```

於專案根目錄執行：

```powershell
.\.venv\Scripts\dbt.exe test --select fct_daily_orders --profiles-dir .
.\.venv\Scripts\dbt.exe docs generate --profiles-dir .
Select-String -Path .\target\manifest.json -Pattern 'excluding cancelled orders' -Quiet
```

若上一堂物化實驗未復原，先確認 `fct_daily_orders` 正是要驗收的版本。測試讀已建好的關聯，不會自動把剛改的模型 SQL 上線。文件產物中，`manifest.json` 記模型描述與依賴，`catalog.json` 保存查到的欄位類型等數據庫描述。小實驗可以故意把負值測試的條件改成 `paid_orders >= 1`，看它是否真的以 2 列失敗。改回再跑；不要改正式口徑來讓範例變綠。

在 App 的 `events` 會看見相同事件鍵被重送；這正好說明「測試失敗」也可能是弄錯契約。先確定原始接收的鍵應是 `raw_id`，再決定是修輸入還是改測試。Big data 或 MySQL 也可用 `GROUP BY … HAVING` 找重複，dbt 的這層宣告則不是引擎約束。

在文件記上一個可重現的失敗，勝過只保存綠燈截圖：哪個模型、預期多少列、違規查詢如何找出哪一天。恢復規則後再驗一次，確認不是把檢查關掉才成功。每新增一項測試要說清它能擋住的錯，而不是只以測試數量算進度。

整理文件時，把來源欄位的「營業日」和數據進倉日分開，也不要承諾報表顯示沒有付款的日子。使用者依此決定要不要左連日曆；若把空日算成沒有付款，結論可能需要補驗。下一堂會把模型和這些測試放入部署範圍，讓發版時也看得見檢查結果。

若測試失敗，先讀輸出的違規列與預期，分辨是模型出錯、輸入改變或規則本身誤寫。不要一看到紅燈就重跑直到它變綠。

## 常見錯誤

- 查詢回一列 `true` 仍失敗 → 數據測試看回傳列 → 改回只列違規。
- 唯一性過了仍有缺日期 → 沒單獨測非空 → 加 `not_null`。
- 文件寫「已付款」但報表加取消 → 文件沒驗證行為 → 用取消單樣本對帳。
