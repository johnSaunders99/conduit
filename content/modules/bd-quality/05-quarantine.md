---
id: bd-quality-05
module: bd-quality
order: 5
title: 隔離與例外清單
subtitle: 壞列不要污染正式集市
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-04
objectives:
- 將合法列與隔離列互斥分類
- 保留識別鍵、原始值及具體拒收原因
- 以讀入等於通過加隔離驗收分流
tags:
- 隔離
- 拒收原因
- TRY_CAST
- 例外清單
resources:
- title: DuckDB：型別轉換
  url: https://duckdb.org/docs/current/sql/expressions/cast
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比較 CAST 與 TRY_CAST 遇到壞值的行為。
- title: dbt：數據測試
  url: https://docs.getdbt.com/docs/build/data-tests
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看失敗記錄如何留給後續處理。
concepts:
- prompt: 為什麼隔離要保存原始欄位和原因？
  answer: 可辨認一筆數據為何被拒收，修復後能找到原始批次及同鍵，不必猜測是格式還是缺值。
  mcq:
    question: 金額是 'N/A'、來源說可修，先怎麼做？
    answer: 0
    options:
    - 隔離並記錄原因及原值
    - 改 0 放進集市
    - 只保存失敗總數
    - 刪掉等明天再來
    explain: 保留鍵、原值、規則與批次，供重驗。補 0、丟掉或只留數字都失去原始證據。
  id: bd-quality-05-reason
- prompt: TRY_CAST 後出現 NULL 就等於原值為 NULL 嗎？
  answer: 不等於。原值缺失與轉換失敗都可能得到 NULL；須另觀察原值。
  mcq:
    question: 如何區分原值 NULL 與非 NULL 但無法轉型？
    answer: 2
    options:
    - 只判轉型結果
    - 比較原始字串長度
    - 先判原值 IS NULL，再判轉型結果
    - 把兩者都改成空字串
    explain: 先判原值，再判轉型結果，才能給不同的修復路徑。
  id: bd-quality-05-cast
- prompt: 隔離之後哪些批次仍不得發布？
  answer: 違反交付底線的批次，例如帳務不容許少單、某類鍵缺失或拒收超過門檻。
  interview:
    question: 一萬列有三列不合格，為何不一定可以交付其他 9997 列？
    answer: 先看業務底線而不是比例；三列可能全是高額帳務。寫入隔離區並保留原因與重跑鍵，核對讀入等於通過加隔離；如果不允許部分交付，仍維持上一個好版本，修完同批再驗。
    points:
    - 依業務風險決定能否部分交付
    - 守恆與可重跑
    - 好版本不被半批替代
  id: bd-quality-05-gate
practice:
- kind: sql
  category: [expression, reconcile]
  title: 保留原值及可用的拒收理由
  minutes: 5
  dataset: shop
  prompt: 以 `orders` 的 1001、1002、1003 三筆為輸入，對應 `raw_qty` 依序為字串 `'3'`、字串 `'bad'`、NULL（用 CASE 模擬）。輸出拒收列，欄序 `order_id`、`raw_qty`、`reason`（`missing`
    或 `not_integer`），依 `order_id` 遞增。
  solution: |-
    WITH incoming AS (
      SELECT order_id, CASE order_id WHEN 1001 THEN '3' WHEN 1002 THEN 'bad' END AS raw_qty
      FROM orders WHERE order_id IN (1001, 1002, 1003)
    ), marked AS (
      SELECT *, CASE WHEN raw_qty IS NULL THEN 'missing'
                     WHEN TRY_CAST(raw_qty AS INTEGER) IS NULL THEN 'not_integer' END AS reason
      FROM incoming
    )
    SELECT order_id, raw_qty, reason FROM marked WHERE reason IS NOT NULL ORDER BY order_id;
  explain: 1002 為 `not_integer`，1003 為 `missing`。DuckDB 的 `TRY_CAST` 對本題壞格式回 NULL；MySQL 沒有同名通用語法，需依版本與模式先做字串驗證。若規則要求只接受整數字面值，還需驗字面格式，例如排除可被轉為整數的帶小數數字。
  hints:
  - 先看原值，再看轉換
  concepts:
  - bd-quality-05-cast
  - bd-quality-05-reason
  - bd-quality-01-null
  tags:
  - 型別轉換
  - 隔離
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-05-p1
- kind: sql
  category: [reconcile, aggregate]
  title: 核對流入等於兩條流出
  minutes: 5
  dataset: shop
  prompt: 在 `order_items` 取訂單 1001 的 `qty`，另加 `0` 與 `NULL` 各 1 列。`qty > 0` 為通過，其餘含 NULL 為拒收。輸出一列 `incoming_rows`、`accepted_rows`、`rejected_rows`，不要求排序。
  solution: |-
    WITH incoming AS (
      SELECT qty FROM order_items WHERE order_id = 1001
      UNION ALL SELECT 0
      UNION ALL SELECT NULL
    )
    SELECT COUNT(*) AS incoming_rows, COUNT(CASE WHEN qty > 0 THEN 1 END) AS accepted_rows,
           COUNT(CASE WHEN qty > 0 THEN NULL ELSE 1 END) AS rejected_rows
    FROM incoming;
  explain: 4 進、2 通過、2 拒收。若把拒收條件寫成 `qty <= 0`，會漏掉 NULL；這裡用同一個 CASE 條件的 ELSE 確保兩路互斥且涵蓋全部。
  hints:
  - 不能讓 NULL 落在兩路之外
  concepts:
  - bd-quality-05-gate
  - bd-quality-05-cast
  - sq-group-01-nulls
  tags:
  - 守恆
  - 隔離
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-05-p2
---

## 把問題留給能處理的人，不把它丟掉

上游發來 4 筆訂單，2 筆件數合理、1 筆寫 0、1 筆沒有值。**隔離（quarantine）**讓不符合契約的列不進正式集市，又能保留供修正的證據。隔離表通常至少包含批次識別、穩定業務鍵或來源列號、必要原始欄位、拒收原因、規則版本。別把整份來源和憑證倒進告警；只保留修復所需欄位，限制讀者及保存期間。

![同一批先標記規則結果，依通過與拒收分流並核對筆數守恆](assets/bd-quality-quarantine.svg)

## 先標記，再分流

先把最具體的原因找出來，再決定哪條路收它。`CAST(value AS INTEGER)` 會在無法轉換時報錯；DuckDB 的 `TRY_CAST(value AS INTEGER)` 在不能轉換時回傳 NULL。原始值就是 NULL，與原值有內容但無法轉換，修法不同，因此先判斷原值，再判斷轉換後的值。如果規格要求純整數格式，還要單獨驗格式與可接受範圍，而不是把可轉換等同合格。

在 SQL 練習場選 `shop`，預留 1 GB、不開容器。以下用一個正常值與一個壞值印出轉型結果；共享表沒有被修改。

```sql
SELECT order_id, raw_qty, TRY_CAST(raw_qty AS INTEGER) AS parsed_qty
FROM (
  SELECT order_id, CASE WHEN order_id = 1001 THEN '3' ELSE 'bad' END AS raw_qty
  FROM orders WHERE order_id IN (1001, 1002)
) AS incoming
ORDER BY order_id;
```

1002 仍保有 `bad`，目的不是把它變成 0，而是把它送到可追查的另一條路。為分流建立守恆檢查：**讀入 = 通過 + 隔離**，且一列不能落入兩邊。若同一列可能有多個原因，明定只取首個原因，或用一列附多個原因；不能因原因有兩個就把它當兩筆輸入。

即使守恆通過，也要決定能否交付部分結果。帳務不許漏單時，隔離流程成功、批次發布仍應失敗；允許部分交付的看板要標明所缺及何時修復。修好後用原鍵和批次重驗，讓通過的數據進正式層，避免全部重送造成重複。

## 區分可修復的拒收和必須追查的拒收

格式不合可以由上游重送；識別鍵缺失通常不能安全自動補，否則無法證明是在修同一筆。可為拒收記錄加首次出現時間和處理狀態，將「待來源修正」與「已重驗通過」分開。若一批有重送，先確定仍以同一粒度計守恆；在隔離前去重會減少一類數字，則應另外記錄去重移除量，不能把移除當成沒有收到。

觀察營運效果時，別選隔離率下降作唯一成功條件。轉換失敗兜成 0 也會讓比例下降，但原始錯誤沒有消失。更有用的指標是拒收是否有可行原因、是否在約定時限內得到修復，以及修完的數據能否與原先認定的批次重新對帳。

## 常見錯誤

- **壞字串都悄悄變成零 →** 用預設值遮住錯誤；先保留原值再標拒收原因。
- **通過加隔離比讀入少 →** SQL 的 NULL 未落到任何一邊；以同一判斷互斥分流。
- **同一批修完又多一份 →** 未使用穩定的重跑鍵；修正時沿用原識別，再核對數量。

**重點回顧：**隔離是保留修復路徑，不是把少掉的記錄合理化。
