---
id: sq-window-09
module: sq-window
order: 9
title: 首尾值與排序框
subtitle: 最後一筆為什麼看似沒變
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-08
objectives:
- 在每列附上整組第一筆和最後一筆的欄值
- 用整組框修正 LAST_VALUE 停在目前列
- 區分事件時間和接收時間所定義的首尾
tags:
- first_value
- last_value
- 窗口框
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 first_value、last_value 與預設框。
- title: MySQL：窗口函式
  url: https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 首尾函式和缺值限制。
- title: Hive SQL：窗口函式
  url: https://hive.apache.org/docs/latest/language/languagemanual-windowingandanalytics/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 核對 Hive 的首尾值與缺值參數。
concepts:
- id: sq-window-09-tail
  prompt: 有窗口排序卻沒寫框，LAST_VALUE 為何常跟目前列一樣？
  answer: 預設框通常只延到目前排序值；排序沒有平手時，框裡的最後一列就是目前列。
  mcq:
    options:
    - 外層沒有排序才會重複
    - 預設框的尾端不是整組最後
    - LAST_VALUE 不理會窗口
    - 它等同於 MAX(值)
    answer: 1
    explain: LAST_VALUE 讀窗口框的末位；當框只到目前列，就看不到後面的列。
- id: sq-window-09-full
  prompt: 每列都要知道分區整組最後值，應如何改框？
  answer: 指定 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING，取分區完整範圍。
  mcq:
    options:
    - 只拿掉外層排序
    - 只把欄名改成 last_step
    - ROWS 從組首到組尾
    - ROWS 到 CURRENT ROW
    answer: 2
    explain: UNBOUNDED FOLLOWING 明確將框延伸到分區末列。
  interview:
    question: LAST_VALUE 為什麼不能隨便改成 MAX？
    points:
    - 末位置與數值最大不同
    - 先說明窗口排序與框
    - 用非單調欄舉例
    answer: 我若按發生時間找最後一步，值可能是 cart，即使 pay 按字串比較更大也不能替代。先寫排序鍵與整組框，然後回原表驗那一列。
- id: sq-window-09-first
  prompt: 想要每個會話的第一個步驟，內層排序至少要交代什麼？
  answer: 按事件時間升序，時間平手時再比較唯一的 raw_id。
  mcq:
    options:
    - 步驟字母升序
    - 外層按會話號排序即可
    - 反向按接收時間取最大
    - 事件時間升序，平手用唯一接收鍵
    answer: 3
    explain: 要的是依時間的首列，並非字典最小的步驟字串。
practice:
- kind: sql
  category: [window]
  title: 在每筆登入旁標出最後一筆登入號
  minutes: 6
  level: 1
  dataset: logins
  prompt: |
    只看會員 4 的全部登入。按 login_at、login_id 升序決定第一與最後；每筆都附同一個第一筆登入號 `first_id` 和最後一筆登入號 `last_id`，保留原明細。

    只輸出以下欄位，欄序固定：`login_id`、`first_id`、`last_id`。

    排序：`login_at` 升序，再按 `login_id` 升序。
  solution: |
    SELECT login_id,
           FIRST_VALUE(login_id) OVER (ORDER BY login_at, login_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS first_id,
           LAST_VALUE(login_id) OVER (ORDER BY login_at, login_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_id
    FROM login_log WHERE user_id = 4
    ORDER BY login_at, login_id;
  explain: |
    6 號是第一筆。last_id 應在每列相同，若總是現在的 login_id，通常是框的終點仍在目前列。
  hints:
  - 在首筆觀察是否已經能看見最後一筆。
  - 讓兩個函數都看完整組。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-09-tail
  - sq-window-09-full
  - sq-window-07-rows
  tags:
  - first_value
  - last_value
  id: sq-window-09-p1
- kind: sql
  category: [window, interval]
  title: 以事件時間對帳會話首尾步驟
  minutes: 10
  level: 3
  dataset: events
  prompt: |
    保留 session_id 非 NULL 的所有接收列（不去重）。各會話按 event_at 升序、raw_id 升序決定首尾；每筆都附整個會話的第一個步驟 `first_step` 與最後一個步驟 `last_step`。

    只輸出以下欄位，欄序固定：`session_id`、`raw_id`、`step`、`first_step`、`last_step`。

    排序：`session_id` 字母升序，再按 `raw_id` 升序。
  solution: |
    SELECT session_id, raw_id, step,
           FIRST_VALUE(step) OVER (PARTITION BY session_id ORDER BY event_at, raw_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS first_step,
           LAST_VALUE(step) OVER (PARTITION BY session_id ORDER BY event_at, raw_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_step
    FROM app_events WHERE session_id IS NOT NULL
    ORDER BY session_id, raw_id;
  explain: |
    s9 的首尾是 view、cart，改用接收時間會交換。以 MAX(step) 替代 LAST_VALUE 會取字典序最大字串，而非最後一列的步驟。
  hints:
  - 先排掉未知會話鍵；已知會話彼此分區。
  - 選行為時間而不是到達時間。
  - 顯示與窗口排序各自指定。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-09-full
  - sq-window-09-first
  - sq-window-02-clock
  tags:
  - last_value
  - 會話
  - 事件時間
  id: sq-window-09-p2
---

會話對帳要在每筆事件旁附上首步與尾步。看到一個 `cart`，仍想知道這次會話最後有沒有到 `pay`。`LAST_VALUE` 看似正好，卻可能在首列只回首列的值；問題通常不在選錯函式，而是它的窗口框尚未伸到組尾。

## 先找位置，再取那格的值

- `FIRST_VALUE(step) OVER (PARTITION BY session_id ORDER BY event_at, raw_id …)`：首值（first value）取框內第一列的欄值。
- `LAST_VALUE(step) OVER (PARTITION BY session_id ORDER BY event_at, raw_id …)`：尾值（last value）取框內最後一列的欄值。實際位置由窗口排序規則決定，並不等於最大值。
- 若要「整個會話的首尾」，把框明寫為 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`。帶排序卻省略框時，DuckDB 的預設 `RANGE` 截到目前排序值（含同值列），看不到後方排序值。

在 SQL 練習場的「自由練習」選 `events` 數據集，執行：

```sql
SELECT raw_id, step,
       LAST_VALUE(step) OVER (ORDER BY event_at, raw_id) AS default_last,
       FIRST_VALUE(step) OVER (ORDER BY event_at, raw_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS session_first,
       LAST_VALUE(step) OVER (ORDER BY event_at, raw_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS session_last
FROM app_events WHERE session_id = 's9'
ORDER BY event_at, raw_id;
```

s9 的第一步是 view，下一步是 cart。輸出的第一列會顯示 `default_last = 'view'`，但同一列的 `session_last` 是 cart。到第二列，兩欄才都為 cart。手算時先畫線把框停在目前列，再把線挪到末端；同一個函式就能得到兩個都合理、但回答不同問題的結果。如果改按接收時間，本數據的 view 比 cart 晚到，首尾又會倒過來。

本題保留所有已知會話的接收列；不把未知鍵湊成一個會話，也不靠這個窗口做事件去重。在其他來源，若尾列的步驟本身缺值，預設取得的也是缺值。DuckDB 可在支援的函式內寫 `IGNORE NULLS`，Spark SQL 的相關寫法在函式之後，Hive SQL 的首尾函式可用第二個布林參數略過缺值；MySQL 8.4 不支援忽略（語法可解析但會報錯）。先確認需求要「末列」或「末個有效值」，不要用補 0 當作同一件事。

## 用第一列測「能不能看見組尾」

s9 只有兩筆，但很適合驗收：先照事件時間預告首列是 22，尾列是 23。在首列同時看預設尾值和整段尾值；如果你只驗最後一列，兩種寫法都會得到 cart，無法發現錯框。驗完第一列，再確認整組尾值固定，且換到另一個會話時能重新計算，不會沿用 s9 的值。

窗口函式還可以把倒序的第一列當作正序的最後一列，但反轉時要把所有排序鍵一併反過來。例如時間與接收鍵本來都升序，想用倒序挑尾值，就不能只反轉時間而不反轉接收鍵；同秒有兩筆時會挑到不同的原始列。要讓接手的人看懂意義，本課直接用原來的排序與完整框，使「找最後一筆」在查詢中顯而易見。

若只要每會話一列，可另外選代表列，或聚合已算好的結果；本課仍保留每次接收以便逐筆驗收。也別把「最後一步是付款」與「曾經有付款」直接視為同一件事；後續事件還可能把尾步改成其他值。查曾付款用存在判斷，查尾步才用位置。之後[〈漏斗轉換〉](#/lesson/sq-pattern-04)會區分事件先後和僅有某個步驟。

對照時記下尾值欄的排序依據與框界。只說「最後」而沒有講事件時間或接收時間，讀者無法重現結果。

## 常見錯誤

- LAST_VALUE 看似每列原樣返回 → 核對框的末端，若要組尾就寫 UNBOUNDED FOLLOWING。
- 取 MAX(step) 看起來像得到最後一步 → MAX 比較欄值，先回原表驗證按事件時間的尾列。
- 多個缺鍵事件成了一組 → 在分區前處理未知會話，再談首尾。
