---
id: sq-read-08
module: sq-read
order: 8
title: IN 與 BETWEEN
subtitle: 邊界上的訂單算不算
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-07
objectives:
- 用 IN 表示多個可接受的狀態或代碼
- 以剛好等於起點和終點的兩列驗證 BETWEEN
- 將時間戳的一整天改寫成半開區間
tags:
- in
- between
- 閉區間
- 日期邊界
resources:
- title: Comparisons
  url: https://duckdb.org/docs/stable/sql/expressions/comparison_operators
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 BETWEEN 與型別比較；留意兩端含括。
- title: MySQL Comparison Functions and Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照 IN 清單含 NULL 時的判斷。
concepts:
- id: sq-read-08-inclusive
  prompt: BETWEEN 3 AND 5 包含哪些整數？
  answer: 3、4、5；兩端都保留。
  mcq:
    question: 若庫存剛好 5 件，BETWEEN 3 AND 5 會如何？
    options:
    - 排除，因為上限不含 5
    - 保留，兩端都含
    - 只有順序降冪時保留
    - 與庫存型別無關，永遠不確定
    answer: 1
    explain: BETWEEN 是閉區間；排序不會改變是否符合。
- id: sq-read-08-set
  prompt: IN ('app', 'web') 是一個範圍嗎？
  answer: 不是；只接受明列的值，和逐一用等號比對再用 OR 相同。
  mcq:
    question: 要找分類恰好是器皿或包裝，該怎麼寫？
    options:
    - category BETWEEN '器皿' AND '包裝'
    - category = '器皿,包裝'
    - category = '器皿' AND category = '包裝'
    - category IN ('器皿', '包裝')
    answer: 3
    explain: 清單不是文字範圍，也不是一個夾逗號的值。
- id: sq-read-08-end
  prompt: 時間戳要查 2 月 1 日整天，最穩的終點判斷是什麼？
  answer: 小於 2 月 2 日的午夜，而不是小於等於 2 月 1 日午夜。
- id: sq-read-08-null-list
  prompt: 要用 IN 搜尋港灣與城市缺值，能直接把 NULL 放進清單嗎？
  answer: 不能；用 `city IN ('港灣') OR city IS NULL` 才會留下兩群。
  mcq:
    question: 條件 `city IN ('港灣', NULL)` 對一筆城市缺值如何判定？
    options:
    - 真
    - 未知，不進 WHERE 結果
    - 假，而且用 NOT 一定可找回
    - 會將 NULL 當成文字比對
    answer: 1
    explain: 清單中的 NULL 不是一個可用普通相等比對的城市。
  interview:
    question: 同事的月底查詢漏了最後一天白天，常見原因是什麼？
    answer: 我先查欄位是 DATE 還是 TIMESTAMP。如果拿月底日期當時間戳上限，可能只含月底午夜。我改成大於等於起日且小於次月首日，並用月底晚上和次月午夜各測一筆。
    points:
    - 辨別欄位的類型
    - 驗證含起不含迄
practice:
- id: sq-read-08-p1
  kind: sql
  category: [select]
  title: 補貨區間的品項
  minutes: 4
  level: 1
  dataset: shop
  prompt: 從 `products` 取器皿或茶飲、庫存 3 到 5 件（含 3 與 5）的商品。輸出 `product_id`、`stock`，照此欄序和原欄名；按 `stock` 升冪，同庫存按 `product_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT product_id, stock
    FROM products
    WHERE category IN ('器皿', '茶飲') AND stock BETWEEN 3 AND 5
    ORDER BY stock, product_id;
  explain: 102 庫存剛好 3；104 和 107 剛好 5。把比較改成嚴格大於、嚴格小於會漏掉邊界。
  hints:
  - 分類用清單
  - 數量用閉區間
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-08-inclusive
  - sq-read-08-set
  - sq-read-07-both
  tags:
  - in
  - between
  - 閉區間
- id: sq-read-08-p2
  kind: sql
  category: [select, time]
  title: 月底實際登入清單
  minutes: 7
  level: 2
  dataset: logins
  prompt: 在 `login_log` 找 2026-01-31 整天實際發生的登入（不按接收時間）。輸出 `login_id`、`channel`，用原名及這個欄序；依 `login_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT login_id, channel
    FROM login_log
    WHERE login_at >= TIMESTAMP '2026-01-31 00:00:00'
      AND login_at <  TIMESTAMP '2026-02-01 00:00:00'
    ORDER BY login_id;
  explain: 使用含起不含迄的兩個比較，保留 1 月 31 日白天的登入。166 雖然隔天才到，仍屬於 1 月 31 日。
  hints:
  - 以 `login_at` 判斷發生日
  - 上界是隔天午夜
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-08-end
  - sq-read-02-edge
  - sq-read-07-both
  tags:
  - in
  - between
  - 閉區間
---

## 可選的幾種值，與一段連續的範圍

採購要核對一份架上庫存偏低的清單。商品可以是茶飲或器皿，庫存要在 3 到 5 件，剛好 3 件或 5 件也算。第一個條件列出允許的文字；第二個條件給頭尾。兩者不是同一種篩法。

## 語法速查

- `x IN (a, b, c)`：清單中任何一個值與 x 相同才通過，像寫三個等號再用 OR 接起來。
- `x BETWEEN a AND b`：在同類型比較下相當於 `x >= a AND x <= b`。這是兩端都包含的閉區間（closed interval），先寫下界，再寫上界。
- `x >= a AND x < b`：左閉右開，也叫半開區間（half-open interval）。`a` 會留下，`b` 不會。連續日期的切法會在[半開區間](#/lesson/sq-time-02)細講。

數據集：`shop`。先核對價格在兩個邊界上的商品：

```sql
SELECT product_id, price
FROM products
WHERE category IN ('茶飲', '器皿')
  AND price BETWEEN 45 AND 60
ORDER BY price, product_id;
```

應有 5 列：編號 103、107 各為 45 元；105 為 50 元；101、102 都是 60 元。如果改成 `price > 45 AND price < 60`，只剩紅茶。若採購說原需求「45 到 60 元」含不含端點，要在查詢前確認；不要因為小表試跑中間值能查到，就以為邊界也對。當清單裡可能有缺城市時，補上 `OR city IS NULL` 才能把缺值作為另一個選項。把 `NULL` 塞進圓括號不等於檢查缺值，與 `NULL` 做一般相等比對不會得到真。

## 把一天切在兩個午夜之間

日期（date）只記曆日，時間戳（timestamp）還記當天幾點幾分；詳細類型會在[日期與區間](#/lesson/sq-expr-06)與[時間戳與時區](#/lesson/sq-expr-07)說明。先想像要取 1 月 31 日的登入：若拿當天午夜當上限，白天都會被排掉。若自己寫到 23:59:59，來源若記到小數秒，最後一秒內還是可能漏。改用「大於等於 1 月 31 日午夜，且小於 2 月 1 日午夜」。這樣兩天的切法接得上，同一瞬間不會算進兩張日報。

在登入題還要選對時間欄。`login_at` 是發生時刻，`received_at` 是收到時刻。同一筆紀錄如果延遲一天才送達，它仍發生在原日。這個錯誤不靠改運算子就能解決：先說清報表看的是「哪一天發生」，再用該欄對上下界。

**換引擎怎麼說：**圓括號的 `IN` 與同類型的 `BETWEEN` 能移到 Hive SQL、Spark SQL、MySQL。DuckDB 也有方括號的清單寫法，對清單內 `NULL` 的處理不同；面試手寫用圓括號，不把 DuckDB 的擴充當標準。移植日期查詢時明寫要比的類型，不把不同引擎的隱式轉換當成一樣。

文字清單也值得用一筆「看起來接近」的值來測。分類若只接受茶飲與器皿，包裝的禮盒即使符合另一個庫存範圍，仍不該通過。你可以把庫存限制改成 0 至 15 件，再暫時拿掉分類限制，查看禮盒如何出現。這麼做能區分是類別選錯，還是數量邊界選錯；兩個條件若一起修改，列數變化時就不容易知道是哪一個造成的。恢復分類條件後，再查一次禮盒是不是已排除。

## 常見錯誤

- **條件只查到區間中間** → 忘了上下限也要算 → 用 `BETWEEN`，再拿兩端各一筆驗算。
- **月底登入漏了白天** → 終點寫成月底當天午夜 → 用小於次日午夜。
- **找不到缺城市的人** → `IN` 中的 NULL 不是普通選項 → 另用 `IS NULL`。
