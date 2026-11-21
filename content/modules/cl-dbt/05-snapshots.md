---
id: cl-dbt-05
module: cl-dbt
order: 5
title: 快照與歷史
subtitle: 保留會員級別變動
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-04
objectives:
- 設定 timestamp 策略的 dbt 快照
- 核對會員變更前後的版本與有效期
- 解釋快照何時會漏掉中間版本
tags:
- dbt snapshot
- SCD 二型
- timestamp 策略
- 會員等級
resources:
- title: dbt：快照與二型歷史
  url: https://docs.getdbt.com/docs/build/snapshots
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀 YAML 設定、timestamp 策略與刪除行為。
concepts:
- id: cl-dbt-05-snapshot
  prompt: 為何需要 dbt 快照而不能只看現行會員表？
  answer: 現行列會覆寫等級；重複快照時可保留每次觀察到的版本與有效期。
  mcq:
    options:
    - 快照只是查得比較快
    - 快照讓已觀察的舊版仍可回查
    - 快照能追到從未收到的版本
    - 快照會自動完成會員去重
    answer: 1
    explain: 快照是歷史，不是當前表的別名；未觀察到的中間版本不會憑空出現。
- id: cl-dbt-05-strategy
  prompt: 來源 updated_at 每次變更都會可靠增加，該選哪種快照策略？
  answer: 選 timestamp 並指定 updated_at；來源沒有可靠的時間才依欄位變化考慮 check。
  mcq:
    options:
    - timestamp
    - check，不設欄位
    - incremental append
    - 直接 SELECT DISTINCT
    answer: 0
    explain: timestamp 用更新時間偵測變更；check 才比較指定欄位。
- id: cl-dbt-05-cadence
  prompt: 上午和下午各快照一次，中午變兩次，能保證保存兩次嗎？
  answer: 不能。快照只看到執行時來源狀態；要逐次保留須用變更事件或其歷史。
  mcq:
    options:
    - 保證，因為有 updated_at
    - 保證，因為用了二型
    - 不能，中間狀態可能沒被觀測
    - 能，只要有唯一鍵
    answer: 2
    explain: 提高頻率能縮小盲區，不能改成保證逐次捕捉。
  interview:
    question: 使用者說會員等級早上有三段，但快照只有兩列，你如何說明？
    answer: 我會看來源欄位和快照執行時間，先判斷是否中間狀態在兩次快照間就被覆寫。若業務要完整歷史，我會改接有每次變更的事件，不把快照當來源日誌。
    points:
    - 辨認快照頻率與觀測盲區
    - 要求可靠更新時間
    - 把逐次歷史交給事件記錄
- id: cl-dbt-05-deletion
  prompt: 來源會員被硬刪除，預設是否會結束舊版本？
  answer: 不會；刪除應明確選擇並驗證策略，不將缺席自動等同於消失。
practice:
- id: cl-dbt-05-p1
  kind: sql
  category: [dbt, scd]
  title: 找出仍未結束的版本
  minutes: 4
  level: 1
  dataset: hr
  prompt: |
    從 `salary_history` 找現行薪級，依序輸出 `employee_id`、`dbt_valid_from`（原 `valid_from`）、`dbt_valid_to`（原 `valid_to`）；按員工鍵升序。
  solution: |
    SELECT employee_id, valid_from AS dbt_valid_from, valid_to AS dbt_valid_to
    FROM salary_history WHERE valid_to IS NULL ORDER BY employee_id;
  explain: |
    此題用現有薪級區間類比快照欄位，不會實際執行 dbt。現行標記在本題是 NULL。
  hints:
  - 先用 IS NULL 判斷，再更名輸出
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-05-snapshot
  - sq-model-08-type-two
  tags:
  - dbt snapshot
  - SCD 二型
- id: cl-dbt-05-p2
  kind: sql
  category: [dbt, scd]
  title: 做一份歷史與現行數量的稽核
  minutes: 7
  level: 3
  dataset: hr
  prompt: |
    對全部 `employees` 輸出 `employee_id`、`version_count`（歷史版本總數）、`current_count`（沒有迄日的版本數）。無歷史兩值為 0，按員工鍵升序。
  solution: |
    SELECT e.employee_id, COUNT(s.employee_id) AS version_count,
           SUM(CASE WHEN s.employee_id IS NOT NULL AND s.valid_to IS NULL THEN 1 ELSE 0 END) AS current_count
    FROM employees e LEFT JOIN salary_history s ON s.employee_id = e.employee_id
    GROUP BY e.employee_id ORDER BY e.employee_id;
  explain: |
    先保留員工，計數時只數真正匹配的薪級列；光測 `s.valid_to IS NULL` 會把左連補出的空列解讀為現行版。
  hints:
  - COUNT(s.employee_id) 算版本
  - 條件計數時確認薪級真的存在
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-05-snapshot
  - cl-dbt-05-deletion
  - sq-model-07-spine
  tags:
  - dbt snapshot
  - SCD 二型
- id: cl-dbt-05-lab
  kind: hands-on
  title: 保留一次會員等級變更
  minutes: 9
  steps:
  - 先跑快照記錄 basic，執行 upgrade_member.py 後再拍。
  - 用正文的讀回命令確認兩個版本與切換時點。
  checks:
  - basic 的結束和 plus 的開始是 2026-02-01 00:00:00；plus 的結束為 NULL。
  - 若再拍一次但不改來源，應仍是 2 列。
---

## 保留被覆寫的來源版本

來源的會員表只留目前等級。當 `basic` 升成 `plus`，若營運用舊訂單查當時等級，會想知道原值。dbt 快照（dbt snapshot）在每次執行時比較同一業務鍵的新舊狀態，為變動開新列並封舊列，是一種二型歷史實作。它不同於[〈快照事實表〉](#/lesson/sq-model-07)的每天一筆觀測：沒有變更不必每天新增一個版本。

選策略先看來源是否有可靠更新時間。`timestamp` 以 `updated_at` 辨認更新，要求該欄反映每次應追蹤的變更；`check` 以指定欄位是否有變作決定。兩者都要一個穩定、不空且單列的唯一鍵。若來源有多列同鍵，先清理；不要讓快照猜哪列才是現在。

## 用兩次觀測留下前後版本

從[〈模型與來源〉](#/lesson/cl-dbt-01)的 `dbt-shop` 繼續，尚未做過這段時來源等級為 `basic`。建立 `snapshots/member_tiers.yml`。`relation` 用來源引用，`strategy`、`unique_key`、`updated_at` 都放在 `config`：

```yaml
snapshots:
  - name: member_tiers
    relation: source('shop_raw', 'members')
    config:
      unique_key: member_id
      strategy: timestamp
      updated_at: updated_at
```

新增 `upgrade_member.py`。只在第一份快照建立後執行：

```python
import duckdb

with duckdb.connect("lab.duckdb") as db:
    db.execute("""
        UPDATE raw.members
        SET tier = 'plus', updated_at = TIMESTAMP '2026-02-01 00:00:00'
        WHERE member_id = 1
    """)
```

在根目錄執行：

```powershell
.\.venv\Scripts\dbt.exe snapshot --select member_tiers --profiles-dir .
.\.venv\Scripts\python.exe upgrade_member.py
.\.venv\Scripts\dbt.exe snapshot --select member_tiers --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT member_id, tier, dbt_valid_from, dbt_valid_to FROM main.member_tiers ORDER BY dbt_valid_from').fetchall())"
```

第一版迄於 2 月 1 日 00:00，第二版從該時點開始，迄日 NULL。用左閉右開可查切換日唯一有效版本。若先升級才執行第一份快照，就看不到 `basic`；若在兩次執行之間變更兩次，也可能跳過中間版。提高執行頻率只能縮小空窗。需要完整逐次歷史時，應保留逐次變更事件。

來源硬刪除的預設是不作處理；若消失必須留下歷史，先決定如何區分刪除、沒收齊與臨時停供，再配置刪除政策。SQL 的 `IS NULL` 可跨 DuckDB、Hive SQL、Spark SQL 與 MySQL；快照設定與實際寫入方式是 dbt 與適配器責任，不是共通 SQL。

日常查詢也要分現況與時點：只問目前等級，用非空業務鍵和空迄日找一筆；問下單當時的等級，用該訂單的事件日對有效區間作半開比較。不要把現行版本直接貼到全年的訂單。如果舊會員數據沒有從第一天被觀測，最早一版以前沒有證據；報表應允許未知，而不是用最早一版覆蓋所有過去。

驗收時同時保留變更前的一筆與變更後的兩筆，檢查版本總數、現行版數和切換時點。如果底層來源忽然從一鍵一列改成一鍵多列，改用更高頻率不會治好；先找能辨認業務身分的規則，再做歷史。新版本的時間必須按同一時區比較，不能一部分用本地時間、另一部分用世界協調時間，再拿來解釋報表差異。

每次快照可以保留執行紀錄，讓使用者知道觀測窗口。排程漏跑也應留證據，不把空窗解讀成期間沒有變更。

## 常見錯誤

- 變了等級但沒新增版本 → 更新時間未更新 → 核對來源的時間欄契約。
- 一個會員長出多個現行版本 → 來源鍵不唯一 → 先測 `member_id` 再快照。
- 宣稱保留每次變更 → 把定期觀測當成事件日誌 → 標明頻率或改保留來源事件。
