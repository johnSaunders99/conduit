---
id: sq-compose-06
module: sq-compose
order: 6
title: UNION 與 UNION ALL
subtitle: 保留兩個來源真正重複的列
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-05
objectives:
- 以同一欄序堆疊兩個來源
- 分辨整列去重與保留次數
- 對堆疊後的結果做一次總排序
tags:
- union
- union-all
- 多重集合
resources:
- title: DuckDB：集合運算
  url: https://duckdb.org/docs/stable/sql/query_syntax/setops
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比較 UNION 與 UNION ALL 的列數。
- title: Hive SQL：UNION
  url: https://hive.apache.org/docs/latest/language/languagemanual-union/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Hive 的 UNION 去重及欄位相容規則。
concepts:
- id: sq-compose-06-all
  prompt: 左邊兩列都是 4、右邊一列也是 4，UNION ALL 有幾個 4？
  answer: 3 個，UNION ALL 不去除任一來源或跨來源的重複。
  mcq:
    options:
    - 1 個
    - 0 個
    - 3 個
    - 2 個
    answer: 2
    explain: UNION ALL 保留每次出現，UNION 才按整列去重。
- id: sq-compose-06-position
  prompt: 普通 UNION 的欄位以什麼方式對齊？
  answer: 按位置對齊；兩段必須有相同欄數，且同一位置類型能相容。
  mcq:
    options:
    - 按兩側英文欄名排序
    - 按兩邊主鍵配對
    - 從左至右挑最常見的欄位值
    - 按 SELECT 的欄位位置
    answer: 3
    explain: 普通集合運算是堆列，不會找對應鍵；位置顛倒可能不報錯但放錯欄。
- id: sq-compose-06-distinct
  prompt: 兩列 user_id 相同但 channel 不同，UNION 會合併嗎？
  answer: 不會。若兩欄都在輸出，整列不同，不會去重。
  mcq:
    options:
    - 不會，整列不同
    - 會，以第一欄去重
    - 會，以名稱含 id 的欄去重
    - 看哪個來源先讀到
    answer: 0
    explain: 要依會員去重，先只投影會員鍵或在外層另定義規則。
  interview:
    question: 要合併兩個事件來源，你會用 UNION 還是 UNION ALL？
    points:
    - 保留原始事件先用 ALL
    - 去重依業務鍵
    - 保留來源以便追查
    answer: 我會先用 UNION ALL 接起來，必要時標來源。再按業務事件鍵和規則去重；直接 UNION 可能刪掉兩筆內容相同、但確實發生兩次的事件。
practice:
- kind: sql
  category: [set]
  title: 堆起兩個渠道的會員出現紀錄
  minutes: 6
  level: 1
  dataset: logins
  prompt: |
    分別取 2026-01-05 的 app 和 web 登入，各只投影 user_id，再用 UNION ALL 堆疊。保留每次出現，不能依會員去重。這題日期以 login_at 為準。

    只輸出以下欄位，欄序固定：`user_id`。

    排序：`user_id` 升序；相同值的列完全相同。
  solution: |
    SELECT user_id FROM login_log
    WHERE CAST(login_at AS DATE) = DATE '2026-01-05' AND channel = 'app'
    UNION ALL
    SELECT user_id FROM login_log
    WHERE CAST(login_at AS DATE) = DATE '2026-01-05' AND channel = 'web'
    ORDER BY user_id;
  explain: |
    1 號與 6 號各出現兩次。換成 UNION 就會各少一次，會員名單可能正確，登入明細的口徑卻錯了。
  hints:
  - 兩段 SELECT 的欄序應一致。
  - 題意要保留重複，不要先做 DISTINCT。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-06-all
  - sq-compose-06-position
  - sq-read-03-order
  tags:
  - union-all
  - 多重集合
  id: sq-compose-06-p1
- kind: sql
  category: [set, distinct]
  title: 產生付款或退款觸及的訂單清單
  minutes: 8
  level: 2
  dataset: shop
  prompt: |
    合成兩份來源：一是 2026-01-20 至 2026-01-25（含首尾）的已付款訂單，二是同一日期範圍內所有退款涉及的訂單。結果只留不同訂單號，不加來源欄。

    只輸出以下欄位，欄序固定：`order_id`。

    排序：`order_id` 升序。
  solution: |
    SELECT order_id FROM orders
    WHERE status = 'paid' AND order_date BETWEEN DATE '2026-01-20' AND DATE '2026-01-25'
    UNION
    SELECT order_id FROM refunds
    WHERE refund_date BETWEEN DATE '2026-01-20' AND DATE '2026-01-25'
    ORDER BY order_id;
  explain: |
    1021 同時符合付款與退款日期，但只應有一列。若加上不同來源名稱後再 UNION，兩筆整列不相同，就不會合併。
  hints:
  - 每段用自己的業務日期。
  - 只投影要視為同一列的鍵，再做整列去重。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-06-distinct
  - sq-compose-06-position
  - sq-join-01-filter
  tags:
  - union
  - 去重
  - 對帳
  id: sq-compose-06-p2
---

要合併 app 與 web 登入時，有兩種完全不同的成品：「登入出現清單」和「曾登入的會員名單」。前者一次登入就一列，後者同一會員只要一列。不要先背哪種比較快；先問重複看起來相同的列，在業務上到底值不值得保留。

## 集合運算如何對齊

- `SELECT 欄位… FROM a UNION ALL SELECT 欄位… FROM b`：把兩個結果堆在一起。允許重複而且記得出現次數，稱為多重集合（multiset）。
- 把 `UNION ALL` 換成 `UNION`，再以整列判斷重複；沒有指定「只比較第一欄」的規則。
- 普通形式按欄位位置對齊，因此兩段的欄數相同、對應類型可合併。輸出欄名依第一段；需要固定外觀就明確在第一段取別名，最後加整份結果的 `ORDER BY`。

在 SQL 練習場的「自由練習」選 `logins` 數據集，執行：

```sql
SELECT user_id FROM login_log
WHERE CAST(login_at AS DATE) = DATE '2026-01-02' AND channel = 'app'
UNION ALL
SELECT user_id FROM login_log
WHERE CAST(login_at AS DATE) = DATE '2026-01-02' AND channel = 'web'
ORDER BY user_id;
```

將範例的 `UNION ALL` 改成 `UNION` 重跑。1 月 2 日先看 4 號與 9 號：他們同一天兩個渠道各登入一次，投影後看起來同一個號，但本來確有兩次。若報表要問一天有幾次登入，左邊與右邊的輸入筆數相加就是一個檢查點。若要問有幾位會員出現，才讓整列去重；同時輸出渠道就會讓同一位會員分成不同列。

比較不同來源時，要先確認兩邊單位也一致。若兩欄都叫金額，但一邊以元、另一邊以分計，SQL 能把數字堆在一起，數據卻不能直接拿去加總。對齊的不只是欄名，還有欄序、類型、單位與每列的意義。

DuckDB 另有按欄名配對的 `UNION BY NAME`；通用題目別把它當普通 `UNION` 的行為。Hive SQL 的 UNION 對兩側欄名與類型相容性有額外要求，搬移時先在各段用同名別名和必要轉型；本課用普通、位置一致的寫法。[〈INTERSECT 與 EXCEPT〉](#/lesson/sq-compose-07)接著用兩份結果求交集或差集。

## 擴充欄位前先看重複的定義

先用 1 月 2 日做小實驗：兩個來源只輸出會員號，保持重複的結果是 7 列，去重的結果是 5 列。現在假想加入渠道欄再做 `UNION`：4 號的 app 和 web 變成兩列不同的內容，9 號也是。你不是突然失去了去重功能，而是改變了「兩列相同」的定義。把這個例子拿去檢查退款或訂單匯整同樣有效。

若為可追溯性需要來源欄，就先保留它，用另一個步驟決定哪一列代表同一個業務事件。若只需一份去重鍵清單，先只取鍵往往更直接。這個選擇要在查詢前做，而不是看到重複後才一次把所有欄都去重。尤其多個入口的系統常有重送和來源差異：看起來相同的兩列可以是不同事件，看起來不同的兩列也可以是同一事件的兩次接收。

第二題只交付訂單鍵，不要求保留付款或退款來源欄。1 月 23 日的 1021 付款，1 月 25 日有退款；兩個日期各在自己的來源算，最後才合成一列。

## 常見錯誤

- 登入次數變少卻沒有報錯 → 檢查是否把 ALL 寫成去重的 UNION。
- 同一會員在名單上還列兩次 → 檢查輸出是否含渠道、時間等使整列不同的欄。
- 欄位數相同但數據插錯欄 → 逐欄比對兩段 SELECT 的位置，不依賴同名。
