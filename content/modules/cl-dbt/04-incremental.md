---
id: cl-dbt-04
module: cl-dbt
order: 4
title: 增量模型與唯一鍵
subtitle: 補來的退款要改哪一天
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-03
objectives:
- 分開定義增量選取的更新時間與合併鍵
- 讓晚入帳的舊日更正更新既有退款列
- 重跑同批輸入並驗證不新增重複退款
tags:
- 增量模型
- unique_key
- is_incremental
- 晚到退款
resources:
- title: dbt：增量模型
  url: https://docs.getdbt.com/docs/build/incremental-models
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 is_incremental 的成立條件與數據篩選。
- title: dbt-duckdb：增量策略
  url: https://github.com/duckdb/dbt-duckdb
  kind: repo
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Delete+Insert Strategy 的鍵值規則。
concepts:
- id: cl-dbt-04-watermark
  prompt: 晚退款的業務日較舊，應依哪個欄決定是否進增量？
  answer: 看代表這筆列被新增或更正的 updated_at，而非退款業務日。
  mcq:
    options:
    - refund_date
    - updated_at
    - 退款金額
    - 會員編號
    answer: 1
    explain: 報表歸屬和變更偵測是兩個時鐘；只用業務日會漏更正。
- id: cl-dbt-04-merge-key
  prompt: 一張訂單能有多筆退款，哪個鍵適合替換同一筆退款？
  answer: refund_id；不得把原訂單鍵當成退款事件的唯一鍵。
  mcq:
    options:
    - order_id
    - refund_date
    - amount
    - refund_id
    answer: 3
    explain: 退款粒度一筆一列，多筆退款可能同屬一張訂單。
- id: cl-dbt-04-boundary
  prompt: 水位使用大於等於上次最大更新時間，為何仍需要唯一鍵？
  answer: 邊界列可能重讀；靠更換同一鍵而非追加，才能讓同批重跑不多列。
  mcq:
    options:
    - 邊界可能重送，鍵讓重跑替換不追加
    - 這樣可以省略來源唯一性
    - 這樣可永久避免任何晚到
    - 這樣會自動刪除來源消失的列
    answer: 0
    explain: 比較符號管候選範圍，鍵管寫回位置；等號不會自動幫你去重。
  interview:
    question: 增量作業成功但有一筆舊日期退款金額沒改，如何排查？
    answer: 我會先看變更是否進了候選集合，再查是否用退款鍵覆蓋同一筆。若水位只看業務日就會漏；我會用可靠的更新或接收時間，另安排有範圍的補算，並和全量結果對帳。
    points:
    - 把候選和寫回分開查
    - 辨認兩種日期
    - 提出回填與對帳
- id: cl-dbt-04-refresh
  prompt: 什麼情況不能只靠更新水位補救？
  answer: 來源更新時間不可靠、舊變更超出可回看範圍，或來源刪除沒有事件時；需要受控回填或重建。
practice:
- id: cl-dbt-04-p1
  kind: sql
  category: [dbt, aggregate]
  title: 核對同單多次退款
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    查 1021、1042 號訂單的所有退款。依序輸出 `refund_id`、`order_id`、`refund_date`、`amount`，按 `order_id`、`refund_id` 升序。
  solution: |
    SELECT refund_id, order_id, refund_date, amount FROM refunds
    WHERE order_id IN (1021, 1042) ORDER BY order_id, refund_id;
  explain: |
    同單兩筆不是重複；用訂單鍵當唯一鍵，更新時會互相覆蓋。
  hints:
  - 退款表本身就是事件粒度
  - 不用連品項
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-04-merge-key
  - sq-model-02-grain
  tags:
  - 增量模型
  - unique_key
- id: cl-dbt-04-p2
  kind: sql
  category: [dbt, time]
  title: 用收到時間找舊日期的新輸入
  minutes: 7
  level: 3
  dataset: events
  prompt: |
    截點為 2026-02-24 00:00:00。列出 `event_at` 在截點之前、`received_at` 在截點當下或之後的每筆**接收列**。依序輸出 `raw_id`、`event_id`、`event_at`、`received_at`，按 `received_at`、`raw_id` 升序。
  solution: |
    SELECT raw_id, event_id, event_at, received_at FROM app_events
    WHERE event_at < TIMESTAMP '2026-02-24 00:00:00'
      AND received_at >= TIMESTAMP '2026-02-24 00:00:00'
    ORDER BY received_at, raw_id;
  explain: |
    按接收時間發現變更、按事件時間歸屬；以事件時間當唯一條件會漏掉已發生但晚收到的列。題目取接收列，不按 event_id 去重。
  hints:
  - 寫兩個時間條件
  - 注意截點一邊含、一邊不含
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-04-watermark
  - cl-dbt-04-boundary
  - sq-model-09-half-open
  tags:
  - 增量模型
  - unique_key
- id: cl-dbt-04-lab
  kind: code
  title: 重跑退款更正不多列
  minutes: 10
  steps:
  - 建立 fct_refunds 並建置；執行 correct_refund.py，再建置兩次。
  - 用正文的讀回指令，比較變更前、第一次及第二次建置後。
  checks:
  - refund_id 1 仍只有一列，日期仍是 1 月 18 日，金額從 10 變 15。
  - 第二次建置後與第一次結果相同；沒有因重讀水位而追加一列。
---

## 有兩個時鐘、還有一個鍵

1 月 18 日的退款金額是 10 元，2 月 2 日才收到更正，正確是 15 元。財務仍要算進 1 月 18 日，管道卻必須在 2 月辨認這是新輸入。退款日期用於報表歸屬，更新時間（update timestamp）用於找本次候選數據，`refund_id` 則指出要替換哪一筆。三者不能互相替代。

增量模型（incremental model）首次建置完整表，後續只交一部分列給適配器。高水位標記（high-water mark）記住走到哪個更新時間。這個小練習使用目標最大 `updated_at`，邊界用大於等於而非大於，讓與水位同一時間戳的列仍可重讀。這要求來源一鍵一列、時間可靠，且新的更正不會被倒填成小於已記錄水位。真實接收可能亂序，應評估接收批次、回看範圍與[〈增量回填演練〉](#/lesson/cl-contract-05)，不要聲稱這個簡式能捕捉所有晚到。

## 在本機做一次增量更正

在 `dbt-shop` 的 `models/fct_refunds.sql` 寫如下模型。`this` 指這個模型的目標；`is_incremental()` 只在目標表已存在、設定為增量、且不是全量重建時才走增量條件。`unique_key` 指定更換鍵，不是唯一性約束；本例已假定來源提供每退款一列。

```sql
{{ config(materialized='incremental', incremental_strategy='delete+insert',
          unique_key='refund_id') }}
SELECT refund_id, order_id, refund_date, amount, updated_at
FROM {{ source('shop_raw', 'refunds') }}
{% if is_incremental() %}
WHERE updated_at >= (
    SELECT COALESCE(MAX(updated_at), TIMESTAMP '1900-01-01 00:00:00')
    FROM {{ this }}
)
{% endif %}
```

把修正寫成 `correct_refund.py`。它保留退款業務日，另外刷新更新時間：

```python
import duckdb

with duckdb.connect("lab.duckdb") as db:
    db.execute("""
        UPDATE raw.refunds
        SET amount = 15, updated_at = TIMESTAMP '2026-02-02 09:00:00'
        WHERE refund_id = 1
    """)
```

所有命令都在 `dbt-shop` 執行。用最後一行在修正前、修正後與重跑後各看一次：

```powershell
.\.venv\Scripts\dbt.exe build --select fct_refunds --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT refund_id, refund_date, amount FROM main.fct_refunds ORDER BY refund_id').fetchall())"
.\.venv\Scripts\python.exe correct_refund.py
.\.venv\Scripts\dbt.exe build --select fct_refunds --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT refund_id, refund_date, amount FROM main.fct_refunds ORDER BY refund_id').fetchall())"
.\.venv\Scripts\dbt.exe build --select fct_refunds --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT refund_id, refund_date, amount FROM main.fct_refunds ORDER BY refund_id').fetchall())"
```

預期從 10 元變成 15 元，不增加列。採 `delete+insert` 時，適配器用候選中的鍵替換舊列；若上游同鍵送兩列，並不會替你選正確一列。不同適配器可用的增量策略不同；Hive SQL 或 Spark SQL 上選擇更新方式還要看表格式，不能把 DuckDB 專案設定原樣搬過去。

增量輸出的粒度也決定合併鍵。如果最後想交付「一日退款額」，拿本批較晚收到的金額直接寫成整日結果會漏掉當天原有退款。可以維持一筆退款一列的事實，由下游重算受影響日期的總合，或由變更集合找日期並從完整來源重建日表。這一堂只更新事件列，不把接收日期改成報表日期。

別把重新建置當作日常漏數據的補丁。刪除、修正和來源倒填的語義不同；若已存在無法由更新時間找出的欠帳，先定義受影響鍵或日期，暫存候選並跟相同截止的完整輸入比對，再發布。當增量快到看不出是否漏掉歷史，這份比對比省下幾秒更有價值。

遇到來源更新時間為空，不要自動把它當作最新。先界定空值是漏欄、歷史匯入還是沒有變動；隔離並記錄未處理的鍵，否則增量會悄悄略過它們。

## 常見錯誤

- 舊月修正沒進來 → 以業務日當變更時鐘 → 使用可靠的更新或接收時間。
- 重跑多一筆 → 用追加但邊界有重讀 → 按退款鍵替換。
- 同張單的兩次退款只剩一筆 → 唯一鍵粒度太粗 → 使用退款事件鍵。
