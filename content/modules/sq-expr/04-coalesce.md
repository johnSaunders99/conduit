---
id: sq-expr-04
module: sq-expr
order: 4
title: COALESCE
subtitle: 缺折扣不必覆寫原始欄位
status: ready
minutes: 30
level: 1
prereqs:
- sq-expr-03
objectives:
- 寫出 COALESCE 從左到右挑第一個有值的欄位
- 分開顯示原始缺值和約定的報表替代值
- 判斷零、空字串與 NULL 是否會觸發替代
tags:
- coalesce
- 缺值
- 替代值
- 預設值
resources:
- title: NULL Values
  url: https://duckdb.org/docs/stable/sql/data_types/nulls
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 coalesce 與 NULL 傳播的例子。
- title: MySQL Comparison Functions and Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 查 COALESCE 如何傳回第一個非 NULL 值。
concepts:
- id: sq-expr-04-first
  prompt: COALESCE(a, b, c) 取哪個值？
  answer: 依你寫的順序取第一個不是 NULL 的值，不是選最大值。
  mcq:
    question: COALESCE(NULL, 0, 9) 得到什麼？
    options:
    - '9'
    - '0'
    - 'NULL'
    - 報錯
    answer: 1
    explain: 0 是一個已知值，遇到它就不再取 9。
- id: sq-expr-04-blanks
  prompt: COALESCE 能把所有空字串替成預設嗎？
  answer: 不能；長度為 0 的字串仍有值，須按口徑先辨認空字串。
  mcq:
    question: COALESCE('', 'unknown') 輸出什麼？
    options:
    - unknown
    - 'NULL'
    - 空字串
    - 兩段字串相接
    answer: 2
    explain: COALESCE 只略過缺值；沒有字元仍是字串。
- id: sq-expr-04-fallback
  prompt: 如何在出表時補值又不讓同事誤以為原欄有值？
  answer: 同時輸出原欄和另取別名的顯示欄，並註明補值只為本報表。
  mcq:
    question: 城市畫面需要預設文字，稽核也要看缺值。應保留哪些欄？
    options:
    - 原城市及另外命名的顯示欄
    - 只有顯示欄
    - 只留原城市且移除 NULL 列
    - 以固定文字取代原欄後再預覽
    answer: 0
    explain: 兩欄分開才能同時說清畫面顯示和來源輸入。
- id: sq-expr-04-no-value
  prompt: 所有參數都為 NULL 時，COALESCE 結果是什麼？
  answer: 仍為 NULL；沒有任何候選值可用。
  interview:
    question: 缺折扣能否直接當作 0 來算？
    answer: 看來源定義。如果缺值確實等於沒有折扣，可以在報表運算中補 0；若代表折扣尚未入帳，就不能當無折扣。我會保留原欄，讓零折扣與未回報可以分開對帳。
    points:
    - 先確認缺值含義
    - 補值是展示或指標規則，不是核實原始值
practice:
- id: sq-expr-04-p1
  kind: sql
  category: [missing-values, expression]
  title: 會員城市顯示欄
  minutes: 4
  level: 1
  dataset: shop
  prompt: 用 `users` 的會員 4 到 8（含）。依序輸出 `user_id`、原始 `city`、`city_label`；顯示欄有城市就沿用，缺值才用「未登記」。依 `user_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT user_id, city, COALESCE(city, '未登記') AS city_label
    FROM users
    WHERE user_id BETWEEN 4 AND 8
    ORDER BY user_id;
  explain: 6 號的 city 仍為 NULL，只有 city_label 補值。不能用 WHERE 刪除缺值列，也不能把所有人都標為未登記。
  hints:
  - 留下同一欄的原值和補值兩種版本
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-04-first
  - sq-expr-04-fallback
  - sq-read-04-missing
  tags:
  - coalesce
  - 缺值
  - 替代值
- id: sq-expr-04-p2
  kind: sql
  category: [missing-values, expression]
  title: 會話鍵缺值的顯示優先序
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 只看 `raw_id` 30 到 35（含）。輸出 `raw_id`、`session_id`、`display_key`，照此欄序。顯示鍵優先用會話鍵，沒有則用事件鍵，兩者都沒有就用 `unknown`；依 `raw_id` 升冪。不去重。
  starter: 'SELECT '
  solution: |
    SELECT raw_id, session_id,
           COALESCE(session_id, event_id, 'unknown') AS display_key
    FROM app_events
    WHERE raw_id BETWEEN 30 AND 35
    ORDER BY raw_id;
  explain: 32 到 34 缺會話，依序退到 e130、e131、e132；30 有 s12 就不要換成 e120。這是顯示回退，不能當會話的唯一鍵。
  hints:
  - 按優先順序列出三個參數
  - 保留原會話欄查證
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-expr-04-first
  - sq-expr-04-fallback
  - sq-expr-04-no-value
  tags:
  - coalesce
  - 缺值
  - 替代值
---

## 給讀表的人一個可用值，不替來源作證

客服名單上有一列城市沒填，希望在畫面中顯示「未登記」，但補登人員仍要知道原欄是缺值。這不是要把會員城市改名為未登記，而是為輸出準備替代值（fallback value）。`COALESCE` 從左往右檢查候選，取第一個不是 NULL 的值。先決定替代值的用途，再決定先用哪個欄、找不到時用什麼。

## 語法速查

- `COALESCE(city, '未登記')`：原欄有值就保留，缺值才用文字。
- `COALESCE(a, b, c)`：可以依序嘗試多個候選；全部是 NULL 才回 NULL。
- 候選應有相容的數據類型，例如城市與顯示文字皆為字串。金額欄應補數字而非顯示用的破折號；兩者混成一欄會讓下游難以計算。
- 只檢查 `NULL`，不檢查 `''`、數字 0 或空白字元。這些值即使不適合報表，也需要另外的規則。

數據集：`shop`。把原城市和顯示城市同時交付：

```sql
SELECT user_id, city, COALESCE(city, '未登記') AS city_label
FROM users
WHERE user_id BETWEEN 5 AND 7
ORDER BY user_id;
```

5 號是山城、7 號是港灣，兩個欄都一樣；6 號原城市是 NULL，第二個城市欄才顯示未登記。這樣營運畫面有文字可用，補登人員仍能檢查原欄。如果交換兩個參數，第一個候選永遠有字，三個人會全部顯示未登記。這正好能驗證一句規則：替代值放在後面，不是宣告它比來源更可信。

## 缺折扣與零折扣不是同一件事

設想一份另有折扣欄的報表。單價已知、折扣未知，相減的結果仍未知；若計算口徑規定「未提供就是沒打折」，才用 `COALESCE(discount, 0)` 讓計算繼續。這裡的共用商品表沒有折扣欄，這個寫法只說明口徑，不把缺欄當成實際數據。若折扣可能晚入帳，同一寫法就會暫時把售價算得太高。兩個輸出即便數字都等於原價，已確認零折扣和還沒收到折扣仍是不同狀態。

事件練習再加一層：先用會話鍵、再用事件鍵。兩種鍵辨認的事物不同，拿事件鍵暫時顯示並不代表找回了會話。下游若要按會話去重，應用原欄而不是這個顯示欄。這個區分在[去重計數](#/lesson/sq-group-05)會再用到。

**換引擎怎麼說：**DuckDB、Hive SQL、Spark SQL、MySQL 都有 `COALESCE`；MySQL 用 `IFNULL` 也可做兩個候選的回退，但不能把第三候選直接塞進去。要列出三層優先順序，保留 `COALESCE`，並在目標環境核對類型和缺值行為。

還可以做一次同列試算：若這筆原本就寫了數字 0，第二候選設成 9，輸出仍是 0。挑選預設值不是挑比較好看的數字，也不會把缺值改成最近的一個值。只要口徑改了，就重新確認候選欄的順序。

## 常見錯誤

- **每個人都顯示未登記** → 固定文字先命中 → 把來源欄放第一個。
- **空白內容沒被替換** → 空字串不是 NULL → 先與數據提供者確認是否視為缺值。
- **補值後追不回缺值** → 只交付顯示欄 → 同時保留原欄給核對者。
