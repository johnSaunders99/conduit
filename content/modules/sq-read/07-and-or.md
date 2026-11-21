---
id: sq-read-07
module: sq-read
order: 7
title: AND 與 OR
subtitle: 兩個門市都要排除取消單
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-06
objectives:
- 使用括號把兩種候選條件綁在同一個付款限制下
- 手算一張同日取消單會不會通過各種括號位置
- 說明 AND、OR 遇到缺值時為何不總是非真即假
tags:
- and
- or
- 括號
- 運算優先順序
resources:
- title: Logical Operators
  url: https://duckdb.org/docs/stable/sql/expressions/logical_operators
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 AND 與 OR 的真值表，特別看 NULL。
- title: MySQL Operator Precedence
  url: https://dev.mysql.com/doc/refman/8.4/en/operator-precedence.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 查 MySQL 模式如何影響雙直線的含義。
concepts:
- id: sq-read-07-both
  prompt: A AND B 何時讓一列通過 WHERE？
  answer: A 與 B 都是真時才會留下這列。
  mcq:
    question: 要求已付款而且在指定日期，應怎麼接兩個條件？
    options:
    - A OR B
    - 只寫日期，付款欄選出來即可
    - A AND B
    - 把兩條條件用逗號隔開
    answer: 2
    explain: 只滿足其一不能留下；把欄列在 SELECT 也不會形成篩選。
- id: sq-read-07-parens
  prompt: A OR B AND C 沒括號時怎麼讀？
  answer: 先算 AND，所以是 A OR (B AND C)。
  mcq:
    question: 規則是符合 A 或 B，且兩者都要符合 C，怎麼寫？
    options:
    - (A OR B) AND C
    - A OR B AND C
    - A AND B AND C
    - A OR (B AND C)
    answer: 0
    explain: 第二與第四寫法會讓 A 繞過 C；全用 AND 則把可任選的條件變必須同時滿足。
- id: sq-read-07-unknown
  prompt: 在 WHERE 中，TRUE OR NULL 和 TRUE AND NULL 各會留下列嗎？
  answer: 前者為真會留下，後者仍未知而被濾掉。
  interview:
    question: 報表有兩個日期，只有其中一天混入取消單，你會先查哪裡？
    answer: 先查日期條件是否用 OR 但沒括住。我會挑一張那天的取消單代入，逐一看哪條件是真，然後驗證兩個日期都被付款條件限制。
    points:
    - 指出 AND 先於 OR
    - 用反例驗證共同條件
practice:
- id: sq-read-07-p1
  kind: sql
  category: [select]
  title: 兩天都只看付款單
  minutes: 5
  level: 1
  dataset: shop
  prompt: 在 `orders` 只找 2026-01-18 或 2026-01-29 的已付款訂單（`status` 是 `paid`）。輸出 `order_id`、`order_date`，按這個欄序與原欄名；依 `order_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT order_id, order_date
    FROM orders
    WHERE (order_date = '2026-01-18' OR order_date = '2026-01-29')
      AND status = 'paid'
    ORDER BY order_id;
  explain: 未加括號時，如果第一個日期單獨在 OR 左側，1011 會混入。兩個日期共用同一個付款限制。
  hints:
  - 先把二擇一日期寫成一組
  - 再接上付款狀態
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-07-both
  - sq-read-07-parens
  - sq-read-02-filter
  tags:
  - and
  - or
  - 括號
- id: sq-read-07-p2
  kind: sql
  category: [select, missing-values]
  title: 缺會話的購物事件
  minutes: 6
  level: 2
  dataset: events
  prompt: 從 `app_events` 找缺少 `session_id` 且 `step` 是 `cart` 或 `pay` 的接收列。輸出 `raw_id`、`step`，用原名及這個欄序；依 `raw_id` 降冪。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, step
    FROM app_events
    WHERE (step = 'cart' OR step = 'pay')
      AND session_id IS NULL
    ORDER BY raw_id DESC;
  explain: 檢查缺值須用 `IS NULL`；把 cart 與 pay 圈起來，不能讓有會話的 pay 通過。
  hints:
  - 兩種步驟任選，但缺會話是必要條件
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-07-parens
  - sq-read-07-unknown
  - sq-read-04-missing
  tags:
  - and
  - or
  - 括號
---

## 三個條件，不是三段願望

客服要核對兩天的已付款訂單。兩天只要符合其中一天，付款卻是必須的。如果把付款條件不小心只接在第二個日期後面，第一天的取消單會悄悄混進來。畫面上多一張單，金額核對就對不上；這和查詢能不能執行是兩件事。

## 語法速查

判斷條件可以用邏輯運算子（logical operator）連接。先把每個小條件當成一道可回答真、假或未知的問題，再按以下規則組合：

- `A AND B`：兩個條件都為真才為真；例如同一天且已付款。
- `A OR B`：任一條件為真就為真，兩個都真也算；例如兩天中任一天。
- `NOT A`：把真與假對調，未知仍未知；例如排除已知的取消狀態。
- 沒有括號時，這裡的優先順序（operator precedence）是 `NOT`、`AND`、`OR`。括號可以讓要一起判斷的條件先算。

數據集：`shop`。先做一份小到可以逐筆核對的清單：

```sql
SELECT order_id, order_date, status
FROM orders
WHERE (order_date = '2026-01-18' OR order_date = '2026-01-29')
  AND status = 'paid'
ORDER BY order_id;
```

應看到 1010 和 1032 兩張單。試把原本括住兩個日期的括號拿掉，第一天的 1011 也會出現。手算 1011：第一個日期是真，第二個日期是假，付款也是假。拿掉括號後，第二個日期和付款先算成假，再與第一個真做 OR，最後仍是真。加回括號時，日期組先算成真，再與付款的假做 AND，最後為假。能指著這一筆解釋差異，比只說「SQL 要加括號」更可靠。

## 帶著缺值來驗證

`WHERE` 只留下最後判斷為真的列。若一個事件屬於已知的購物步驟，但會話鍵缺值，不要猜缺值等於某個假會話；用 `IS NULL` 說出你要找沒有紀錄的會話鍵。普通比較若遇到缺值，可以先在紙上寫「未知」。例如「已付款」已為真，OR 另一個未知條件還是真；若要求兩者都真，則不能因為已確認付款就把未知當作通過。回想 [NULL 與缺值](#/lesson/sq-read-04)：未知不是另一種寫法的假，因為對未知用 NOT，結果仍不會變真。

**換引擎怎麼說：**Hive SQL、Spark SQL、MySQL 都能讀這裡的 `AND`、`OR` 與括號；別把其他語言的 `||` 當通用 OR。DuckDB 用它連接字串；MySQL 預設把它當 OR，但可用模式使它變成串接。移植時保留關鍵字，比依賴這種縮寫安全。

再用 1033 做一筆對照：它落在第二個日期，同樣是取消單，原本和去掉括號後都不應出現。只測這一筆會誤以為少了括號也沒問題。測共同限制時，要在每個候選分支各找一筆不符合必要條件的列，才有機會抓到只限制其中一邊的錯誤。

## 常見錯誤

- **只有一個日期混入取消單** → `AND` 先算，限制了 OR 的一側 → 把兩個日期括成一組。
- **兩天都查不到** → 用 AND 要求同一列同時是兩個日期 → 日期選擇用 `OR`。
- **缺會話名單為空** → 與 `NULL` 做等號比較不會為真 → 用 `session_id IS NULL`。

讀回你的條件時可以分兩次：先說出「候選是哪一組」，再說出「留下候選的必要條件」。若同事能用這兩句重算 1011 的命運，查詢的交付規則就夠清楚了。
