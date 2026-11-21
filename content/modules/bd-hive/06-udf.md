---
module: "bd-hive"
id: "bd-hive-06"
order: 6
title: "Hive UDF"
subtitle: "內建函式不夠時怎麼驗算"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-05"
objectives:
  - "用內建函式標準化狀態並保留缺值"
  - "為自訂函式寫出可測的邊界契約"
tags:
  - "UDF"
  - "NULL 語意"
  - "內建函式"
  - "字串清洗"
resources:
  - title: "Hive UDF Manual"
    url: "https://hive.apache.org/docs/latest/language/languagemanual-udf/"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "對照內建字串函式，讀 NULL 的使用邊界。"
concepts:
  - id: "bd-hive-06-contract"
    prompt: "標準化 UDF 的契約至少要說什麼？"
    answer: "指定輸入型別、正常值如何映射、NULL 與未知值如何回傳，以及是否決定性。"
    mcq:
      question: "狀態缺失，且規格要求保留未知。應回傳什麼？"
      options:
        - "paid"
        - "NULL"
        - "零元"
        - "上一筆的狀態"
      answer: 1
      explain: "缺失不等於已付款、零額或前一筆，不能擅改口徑。"
  - id: "bd-hive-06-builtin"
    prompt: "查詢裡已有 TRIM 和 LOWER 時，為什麼通常先不用自訂函式？"
    answer: "內建函式易部署、容易做型別及執行計畫優化，維護成本也較低。"
    mcq:
      question: "唯一需求是去掉首尾空白並轉小寫，優先怎麼做？"
      options:
        - "寫一個會發網路請求的 UDF"
        - "讓函式依執行時間變化"
        - "用 TRIM 與 LOWER"
        - "把所有值改成 paid"
      answer: 2
      explain: "內建已能滿足需求；外部依賴和不穩定結果只增加風險。"
    interview:
      question: "何時選 Hive 自訂函式，怎麼交付？"
      points:
        - "先查內建組合能否處理"
        - "規劃型別、NULL、異常和版本檢查"
        - "考慮 UDF 對執行計畫的影響"
      answer: "如果公司的產品碼規則超過內建組合能清楚表達的範圍，我才用 UDF。先寫正常和壞值的測例，再確認版本、部署與查詢成本。"
  - id: "bd-hive-06-family"
    prompt: "UDF、UDAF、UDTF 回傳的粒度有何不同？"
    answer: "純量 UDF 每列產一個值；UDAF 聚合多列；UDTF 可產生多列或多欄。"
  - id: "bd-hive-06-determinism"
    prompt: "為什麼清洗函式不宜依賴現在時間？"
    answer: "同一筆輸入在重試時可能得到不同結果，難以對帳和回復。"
    mcq:
      question: "哪個行為會破壞同一輸入得到同一輸出？"
      options:
        - "固定用 LOWER"
        - "依字串比對白名單"
        - "保留原本 NULL"
        - "向外部服務讀隨時會改的規則且未固定版本"
      answer: 3
      explain: "前面三項能依固定輸入計算，外部規則若改版就不再可重現。"
practice:
  - id: "bd-hive-06-lab"
    kind: "hands-on"
    title: "保留五筆清洗測例"
    minutes: 6
    steps:
      - "在 shop 自由練習先執行正文的四筆樣本查詢。"
      - "補一筆有內部空白的狀態，將輸入、預期及實際輸出存到 udf-cases.md。"
    checks:
      - "去除首尾空白，不移除內部空白。"
      - "空字串與 NULL 都標缺值；未知字串沒有擅自變成 paid。"
  - id: "bd-hive-06-p1"
    kind: "sql"
    category: [expression, missing-values]
    title: "用內建函式清洗商品分類"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: |
      以 `products` 模擬有空白的來源：商品 101 的原分類改成只含 2 個空格；商品 102 的原分類在兩端各加 1 個空格；其餘照原值。
      輸出 `product_id`、`category_clean`，欄序照此，按 `product_id` 升序。移除首尾空白；原值為 NULL 或清洗後為空字串都交付 NULL，不改內部文字。可沿用編輯器裡的 `source`。
    starter: |
      WITH source AS (
        SELECT product_id,
               CASE product_id
                 WHEN 101 THEN '  '
                 WHEN 102 THEN ' ' || category || ' '
                 ELSE category
               END AS raw_category
        FROM products
      )
      SELECT
    solution: |
      WITH source AS (
        SELECT product_id,
               CASE product_id
                 WHEN 101 THEN '  '
                 WHEN 102 THEN ' ' || category || ' '
                 ELSE category
               END AS raw_category
        FROM products
      )
      SELECT product_id, NULLIF(TRIM(raw_category), '') AS category_clean
      FROM source ORDER BY product_id;
    explain: |
      `TRIM` 去首尾空白，`NULLIF` 把空字串標為缺值。只用 `TRIM` 時，商品 101 仍是空字串；直接讀原表則沒有處理題目模擬的異常。Hive SQL 若不用雙直線串接，改用 `CONCAT(' ', category, ' ')`。
    hints:
      - "先處理首尾空白"
      - "想想怎麼把空字串變回 NULL"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-06-contract"
      - "bd-hive-06-builtin"
      - "sq-read-04-missing"
    tags:
      - "清洗"
      - "空值"
  - id: "bd-hive-06-p2"
    kind: "sql"
    category: [missing-values, expression]
    title: "列出需要人工追查的接收列"
    minutes: 5
    level: 2
    dataset: "events"
    prompt: "對 `app_events`，先將 `session_id` 去掉首尾空白。輸出清理後為 NULL 或空字串的接收列，欄位依序為 `raw_id`、`event_id`，按 `raw_id` 升序。不合併重送。"
    solution: |
      SELECT raw_id, event_id FROM app_events
      WHERE NULLIF(TRIM(session_id), '') IS NULL ORDER BY raw_id;
    explain: "用 `IS NULL` 捕捉清理後缺值；`= NULL` 不成立。保留 raw_id 是因本題盤點接收列，不是對事件去重。"
    hints:
      - "把上一題的清洗表示式放進 WHERE"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-06-contract"
      - "sq-read-04-missing"
      - "bd-distrib-07-key"
    tags:
      - "缺值盤點"
---

## 先定輸入與輸出，才問要不要寫 UDF

付款狀態可能是 `'  PAID  '`，也可能只有空字串，甚至完全沒收到。報表要把前者標準成 `paid`，卻不能把缺值當已付款。自訂函式（user-defined function，UDF；台灣亦稱使用者定義函式）把常用的逐列規則命名，讓其他查詢可以重用。它不是把所有類型的函式混為一談：純量 UDF（scalar UDF）一列傳回一個值；自訂聚合函式（UDAF）合多列；自訂表生成函式（UDTF）可把一列展成多列或多欄。

今天先用內建函式。`TRIM(value)` 去除首尾空白，`LOWER(value)` 統一成小寫，`NULLIF(value, '')` 把等於空字串的值變成 NULL。`CASE WHEN … THEN … ELSE … END` 用來把未認可值另外標出。先說明例外：若還要接受別名、全形字元或多種空白，不能默默假設預設 `TRIM` 都會處理，要加測例或明定轉換。部署前另核對引擎及版本的函式簽名。

## 拿四筆測例問規格

在 SQL 練習場的 `shop` 自由練習執行以下 **DuckDB SQL**，不會改共享表，預留 0.5 GB RAM。用獨立的小輸入補正式數據集缺少的邊界。
```sql
WITH sample(id, raw_status) AS (
  VALUES (1, '  PAID  '), (2, ' '), (3, NULL), (4, 'pending?')
)
SELECT id, raw_status,
       NULLIF(LOWER(TRIM(raw_status)), '') AS cleaned_status
FROM sample ORDER BY id;
```

依序核對 `paid`、NULL、NULL、`pending?`。第四列保留未知字串，因為「標準化」不是「把未知值擅改成已知」。交給下一步的白名單查核時可保留原始欄以便追查；若產品規格要求未知值改成 NULL，要把第四筆期望值重寫清楚。這種清洗決定了日報的分母，並非只改顯示格式。

## 真正需要自訂時

多層公司的產品代號有版本、校驗位和歷史規則，內建函式組合若已難以維護，才把純量規則包成 UDF。避免在每列呼叫外部服務：它不只慢，重試時也可能得到不同答案或重複寫入。確認輸入與輸出型別、缺值策略、錯值紀錄與決定性（determinism：同一輸入得到同一輸出），再用小規模數據比較結果與計畫。Hive 的 Java 類別與 JAR 註冊留到[〈Java Hive UDF〉](#/lesson/bd-jvm-01)；DuckDB 題不會部署 Hive 函式。

### 在註冊前寫下驗收契約

以紙面演練方式為這個清洗取名，列下輸入是可能缺失的字串、輸出仍可能缺失；記錄「只清理格式，不承諾合法付款狀態」。依原順序列出四個指定測例，再加入一筆內部有空白的值，確認沒有不小心把詞間空白也拿掉。這份規格比先寫 Java 類別更容易和維護者對齊。

改版時別只拿新版跑一筆正常數據。讓新舊兩版在同一批邊界樣本上各跑一次，把不相等的輸入記下來；有意的變動才更新預期。若相同表格多次運轉出不同結果，也要查函式是否依賴時鐘、外部設定或網路，再討論是否能滿足重跑要求。

## 常見錯誤

- 空字串仍算有效 → 沒把清洗後的空值標成缺失 → 補空字串與 NULL 的測例。
- 正常值通過就上線 → 異常值可能被誤判 → 加入不在白名單的原值。
- 用 UDF 代替一個已有函式 → 多了部署與優化成本 → 先驗內建組合。
