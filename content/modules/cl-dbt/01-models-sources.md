---
id: cl-dbt-01
module: cl-dbt
order: 1
title: 模型與來源
subtitle: 先畫出原始訂單的入口
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
- 在 Windows 本機用 dbt Core 與 DuckDB 建出 stg_orders
- 區分來源與由 dbt 維護的模型
- 檢查暫存模型是否保留原始列並統一狀態寫法
tags:
- dbt Core
- DuckDB
- source
- 暫存模型
resources:
- title: dbt-duckdb：本機連線設定
  url: https://github.com/duckdb/dbt-duckdb
  kind: repo
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Installation 與 Profile，確認本機檔案路徑。
- title: dbt：source()
  url: https://docs.getdbt.com/reference/dbt-jinja-functions/source
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看如何宣告來源並用兩個名稱引用。
concepts:
- id: cl-dbt-01-source
  prompt: raw.orders 是外部流程寫入，dbt 要如何認得它？
  answer: 在 YAML 登記來源與表，再用 source('shop_raw', 'orders') 引用；宣告本身不會載入來源。
  mcq:
    options:
    - 放進 models 就會讀到原始表
    - 宣告來源並在模型呼叫 source
    - 把原始表改成模型同名
    - 靠來源表自動出現在 DAG
    answer: 1
    explain: 模型、檢測與來源寫入是不同工作；宣告只建立引用與依賴。
  interview:
    question: dbt 宣告來源後，為何跑模型還是說 raw.orders 不存在？
    answer: 宣告告訴 dbt 去哪裡讀，不會替我建來源。我會先查 profile 指到哪個檔案、來源 schema 有沒有那張表，再看初始化或上游載入；不是先把所有引用都改成硬編碼。
    points:
    - 區分來源寫入與模型讀取
    - 核對檔案和結構描述
    - 保留來源血緣
- id: cl-dbt-01-model
  prompt: 這個課程的 stg_orders.sql 應包含什麼？
  answer: 一個輸出標準化列的 SELECT；dbt 在建置時用物化策略決定如何存放結果。
  mcq:
    options:
    - 一個輸出模型結果的 SELECT
    - 安裝適配器的命令
    - 來源數據庫密碼
    - 先刪整個數據庫的腳本
    answer: 0
    explain: dbt 模型通常描述結果；不是啟動命令、憑證檔或來源初始化腳本。
- id: cl-dbt-01-staging
  prompt: 暫存層一單一列時，是否該先把取消單刪掉？
  answer: 本課不刪；只清理狀態與欄位，讓下游依需求選口徑。
  mcq:
    options:
    - 刪掉，因取消不可能有明細
    - 只留下第一筆取消單
    - 改成付費以方便查詢
    - 保留取消並統一狀態寫法
    answer: 3
    explain: 取消單仍是合法來源列；先過濾會讓下游無法分析取消。
- id: cl-dbt-01-adapter
  prompt: dbt Core 和 dbt-duckdb 各扮演什麼角色？
  answer: Core 解析專案、決定依賴和執行；適配器負責跟 DuckDB 連線並落實相應操作。
practice:
- id: cl-dbt-01-p1
  kind: sql
  category: [dbt, select]
  title: 預覽來源的穩定欄位
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    從 `orders` 取 1009–1012 號單，含取消單。依序輸出 `order_id`、`order_date`、`order_status`（`status` 去首尾空格並轉小寫），按 `order_id` 升序。只交 SQL，不寫 dbt 樣板。
  solution: |
    SELECT order_id, order_date, LOWER(TRIM(status)) AS order_status
    FROM orders WHERE order_id BETWEEN 1009 AND 1012 ORDER BY order_id;
  explain: |
    暫存模型做欄名與格式標準化，不偷偷改付款口徑；篩掉取消單會少一列。
  hints:
  - 用 LOWER(TRIM(status))
  - 以 AS 指定別名
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-01-source
  - cl-dbt-01-staging
  tags:
  - dbt Core
  - DuckDB
- id: cl-dbt-01-p2
  kind: sql
  category: [dbt, missing-values]
  title: 量出來源中尚未填城市的會員
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    把 `users.city` 首尾空格去除、空字串當作 NULL。依清理後的城市分組，未知的顯示「未知城市」。依序輸出 `city`、`user_count`，按數量降序、城市升序；未下單會員也計入。
  solution: |
    WITH cleaned AS (SELECT NULLIF(TRIM(city), '') AS city FROM users)
    SELECT COALESCE(city, '未知城市') AS city, COUNT(*) AS user_count
    FROM cleaned GROUP BY COALESCE(city, '未知城市') ORDER BY user_count DESC, city;
  explain: |
    空白文字與 NULL 要先統一，再從來源會員粒度分組；連訂單會漏掉無單會員或重複數人。
  hints:
  - 先用 NULLIF 清空字串
  - 再以 COALESCE 顯示未知
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-01-staging
  - cl-dbt-01-model
  - sq-model-04-unknown
  tags:
  - dbt Core
  - DuckDB
- id: cl-dbt-01-lab
  kind: hands-on
  title: 保存第一個可重建的暫存模型
  minutes: 10
  steps:
  - 依正文在 dbt-shop 建立設定、來源初始化程式與模型，跑 debug 再跑 build。
  - 用正文的驗證命令讀回 view，把結果留下供下一堂對照。
  checks:
  - 應有 3 張單，含 1011 cancelled；1009 和 1010 都是 paid。
  - raw.orders 的原始值不被 view 回寫；下一堂繼續使用同一份本機專案。
---

## 將轉換交給可重跑的專案

茶舖同一張訂單，在兩份報表分別被當作 `Paid` 和 `paid`；每張報表自己清理，遲早分歧。dbt Core 是本機可跑的轉換工具，把查詢結果寫成模型（model），並記錄依賴及測試。這裡用 dbt-duckdb 適配器（adapter）連 DuckDB 檔案；不需雲端帳號、連線憑證或付費倉庫。安裝需要網路，模型建置使用本機檔案。

你會分成兩端：來源（source）由別的工作載入，dbt 只讀；暫存模型（staging model）保持一單一列，只改型別、命名與格式。業務彙總等下一堂[〈ref 與依賴圖〉](#/lesson/cl-dbt-02)。本機樣本是獨立的小型沙盒，不是 App 裡的 `shop`；後者留給 SQL 練習。

## 建立可重建的入口

在 PowerShell，先定位到自己的 `C:\dev\conduit-lab`（使用 D: 就切到同名資料夾）。使用一個新的 `dbt-shop` 子資料夾，避免碰到既有同名專案。以下安裝使用支援 YAML 快照的 dbt Core 1.x 路線；適配器相依會安裝 Core 和 Python 的 DuckDB。若最新版 Python 還沒有相容套件，先選套件已支援的 Python 版本。無須啟用虛擬環境，也不用改系統執行原則：

```powershell
New-Item -ItemType Directory dbt-shop | Out-Null
Set-Location dbt-shop
New-Item -ItemType Directory models, snapshots, tests | Out-Null
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install "dbt-core>=1.10,<2" dbt-duckdb
.\.venv\Scripts\dbt.exe --version
```

在 `dbt-shop` 建立 `dbt_project.yml`：專案名、設定檔名稱與模型所在位置必須對得上。

```yaml
name: conduit_shop
version: '1.0'
config-version: 2
profile: conduit_shop
model-paths: ["models"]
test-paths: ["tests"]
snapshot-paths: ["snapshots"]
```

同一資料夾的 `profiles.yml` 指向本機檔案；往後命令都在此資料夾跑，並以 `--profiles-dir .` 指定讀這一份，不改全域設定。

```yaml
conduit_shop:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: lab.duckdb
      schema: main
      threads: 1
```

建立 `init_lab.py`，第一次初始化時執行。它會以固定範例重建來源表；往後更新樣本時不要重跑它，除非真的要還原沙盒。退款及會員來源先備好，後面會各自使用。

```python
import duckdb

with duckdb.connect("lab.duckdb") as db:
    db.execute("""
        CREATE SCHEMA IF NOT EXISTS raw;
        CREATE OR REPLACE TABLE raw.orders AS
        SELECT CAST(id AS INTEGER) AS order_id,
               CAST(day AS DATE) AS order_date,
               CAST(status AS VARCHAR) AS status
        FROM (VALUES
          (1009, '2026-01-17', 'Paid'),
          (1010, '2026-01-18', ' paid '),
          (1011, '2026-01-18', 'cancelled')
        ) AS sample(id, day, status);
        CREATE OR REPLACE TABLE raw.refunds AS
        SELECT 1::INTEGER AS refund_id, 1010::INTEGER AS order_id,
               DATE '2026-01-18' AS refund_date, 10::INTEGER AS amount,
               TIMESTAMP '2026-01-18 10:00:00' AS updated_at;
        CREATE OR REPLACE TABLE raw.members AS
        SELECT 1::INTEGER AS member_id, 'basic'::VARCHAR AS tier,
               TIMESTAMP '2026-01-18 09:00:00' AS updated_at;
    """)
```

登記來源的基本寫法是 `sources → name、schema → tables → name`；引用時要傳來源名與表名，兩者不是檔名。把這份放在 `models/sources.yml`：

```yaml
version: 2
sources:
  - name: shop_raw
    schema: raw
    tables:
      - name: orders
      - name: refunds
      - name: members
```

在 `models/stg_orders.sql` 建立第一個模型。「雙大括號」是 Jinja 樣板（template）：建置時由 dbt 解析為實際關聯名稱。它不是 DuckDB 直接能讀的 SQL，所以不要把整份模型貼到 App 的編輯器。

```sql
{{ config(materialized='view') }}
SELECT order_id, order_date, LOWER(TRIM(status)) AS order_status
FROM {{ source('shop_raw', 'orders') }}
```

## 跑一次，讀回結果

```powershell
.\.venv\Scripts\python.exe init_lab.py
.\.venv\Scripts\dbt.exe debug --profiles-dir .
.\.venv\Scripts\dbt.exe build --select stg_orders --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT * FROM main.stg_orders ORDER BY order_id').fetchall())"
```

結果是 3 列，前 2 列狀態均為 `paid`，1011 仍是 `cancelled`。先核對列數，再看是否只改預期欄位。基本的 `LOWER(TRIM(...))` 也能在 Hive SQL、Spark SQL 和 MySQL 表達；Jinja 和連線設定則要經相應工具與適配器，不是 SQL 方言。

如果 `debug` 成功、首次建置卻失敗，兩種訊號不矛盾：前者證明設定可以被讀取、適配器能連線，後者才會實際檢查來源及查詢。先看目前所在的專案資料夾和生成的數據庫檔案；同名檔若生在別的資料夾，成功的連線可能只是接到空庫。完成後保留初始化程式、兩份 YAML、模型與結果，不把虛擬環境當作工作成果備份。

這個模式讓兩份報表共用同一種清理，也保住了取消單作為分析素材。若改用另一個適配器，要重新驗證對應的類型與行為，不能因為 SQL 看起來一樣就假定部署結果一樣。

## 常見錯誤

- 找不到 `source` → YAML 來源名或表名打錯 → 對照 `shop_raw` 與 `orders`。
- 來源表不存在 → `lab.duckdb` 路徑錯或未初始化 → 回專案根目錄檢查。
- 暫存表忽然少了取消單 → 把業務篩選提早 → 保留一單一列，在下游決定用途。
