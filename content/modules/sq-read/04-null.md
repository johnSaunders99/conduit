---
id: sq-read-04
module: sq-read
order: 4
title: NULL 與缺值
subtitle: 沒有城市不等於空字串
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-03
objectives:
- 以 IS NULL 查出缺城市的 5 名會員
- 以 IS NOT NULL 查出有值的 25 名會員，說清仍未驗證地名
- 說明 = NULL 為何找不到缺值，區分未知、空字串與數字 0
tags:
- 'null'
- is null
- is not null
- 缺值
- 三值邏輯
resources:
- title: NULL Values
  url: https://duckdb.org/docs/stable/sql/data_types/nulls
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀缺值比較結果，對照為何等號找不到缺值。
concepts:
- id: sq-read-04-missing
  prompt: 要找未知的城市，應在 WHERE 寫什麼？
  answer: 用 city IS NULL，不是 city = NULL。
  mcq:
    question: 找尚未填城市的人該用哪個條件？
    options:
    - city = 0
    - city IS NULL
    - city = 'NULL'
    - city = NULL
    answer: 1
    explain: 一般相等比較遇見缺值結果為未知；IS NULL 才專門判斷它。
- id: sq-read-04-known
  prompt: IS NOT NULL 能證明城市名正確嗎？
  answer: 不能，只能證明欄位有值；內容仍可能錯。
  mcq:
    question: 城市填了一段錯字，IS NOT NULL 怎麼判斷？
    options:
    - 一定未知
    - 一定為假
    - 為真但不是地名驗證
    - 自動更正
    answer: 2
    explain: 非空檢查的是值的存在，不是地名真偽。
- id: sq-read-04-zero
  prompt: 庫存 0 和未知庫存有何不同？
  answer: 庫存為 0 表示已知沒有庫存；NULL 則表示尚無這個值。
practice:
- id: sq-read-04-p1
  kind: sql
  category: [missing-values]
  title: 待補城市名單
  minutes: 4
  level: 1
  dataset: shop
  prompt: 找出城市未填的會員，只輸出 user_id，使用原欄名；不要求列的排序。
  starter: 'SELECT '
  solution: SELECT user_id FROM users WHERE city IS NULL;
  explain: 用 IS NULL 判斷缺值；用等號比較會得到未知，找不到待補者。
  hints:
  - 要判斷值缺不缺，不是比對字串。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-04-missing
  tags:
  - 缺值
- id: sq-read-04-p2
  kind: sql
  category: [missing-values]
  title: 找出仍有效的薪級
  minutes: 6
  level: 2
  dataset: hr
  prompt: salary_history 的 valid_to 缺值表示這段薪級仍有效。輸出 employee_id、monthly_pay，欄名照原名；依 employee_id 升冪。
  starter: 'SELECT '
  solution: SELECT employee_id, monthly_pay FROM salary_history WHERE valid_to IS NULL ORDER BY employee_id;
  explain: 每段歷史都有起日，只有目前那段沒有迄日；不能把所有歷史薪級當作現在月薪。
  hints:
  - 先看迄日，再排序。
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-04-missing
  tags:
  - 缺值
- id: sq-read-04-p3
  kind: sql
  category: [missing-values]
  title: 已登記城市的會員
  minutes: 6
  level: 2
  dataset: shop
  prompt: 只取 city 有值的會員，輸出 user_id、city，欄名照原名；不要求列的排序。
  starter: 'SELECT '
  solution: SELECT user_id, city FROM users WHERE city IS NOT NULL;
  explain: 已填者是缺值集合的另一側，不需要猜有哪些合法地名。與空字串比較並不是檢查是否缺值。
  hints:
  - 把缺值判斷反過來。
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-04-known
  tags:
  - 缺值
---

## 語法速查

以下條件可接在 `SELECT user_id, city FROM users WHERE` 後面（數據集：`shop`）。

| 條件 | 要找什麼 | 在本數據集的結果 |
|---|---|---|
| `city IS NULL` | 沒有城市值 | 5 列 |
| `city IS NOT NULL` | 已有值，不保證地名有效 | 25 列 |
| `city = NULL` | 錯誤寫法；比較結果是未知，不是真 | 0 列 |

`''`、`'NULL'` 和 `0` 都是值，不是 NULL。之後在 [COALESCE](#/lesson/sq-expr-04)學如何顯示替代值；本堂只找缺值，不改原表。

## 為什麼要學：沒填城市的人，怎麼找？

會員登記表裡有一欄城市。有人沒填城市，不能因此推定他住在哪裡。營運今天只要一份待補登城市的會員編號，想把未填的人找出來。這堂學的 NULL 是數據庫表示「沒有已知值」的記號。台灣也常說空值。它不是字串，不是數字零，更不是鍵盤上敲了四個英文字母。

打開 shop 的 users 表。user_id 是虛構的會員編號，city 是登記城市，兩欄記的是不同的事。一個會員有編號，只是城市未知，仍然應該有一整列。預覽只有前幾列，沒在預覽看見缺值，還不能說整張表每個人都填過。這次不用把所有人抄出來找，改用專門的判斷：

```sql
SELECT user_id, city
FROM users
WHERE city IS NULL;
```

IS NULL 問的是「這個位置是否缺值」。執行後你會看到 5 列，編號包括 6 與 30。第二欄顯示 NULL，是引擎刻意標示的缺值，不是城市的名稱叫做 NULL。如果交付給補登人員的清單只需要會員編號，可以把 city 從 SELECT 刪掉；這個動作並不影響 WHERE 仍然使用 city 做判斷。城市未知的人和會員編號未知的人不是同一件事。


## 核心概念：為什麼不用等號？

想像桌上有兩張卡片，一張寫著「港灣」，另一張反扣，只知道底下沒有登記城市。第一張與港灣相同，這可以回答「是」；第二張與港灣相同嗎？你沒有足夠的訊息。SQL 把一般比較遇到缺值的結果當成未知（unknown），而 WHERE 只留下確定為真的列。用等號把 city 和 NULL 比較，不會因此把兩個未知認成一樣，反而找不到你要補登的那些人。

把上面的條件換成 IS NOT NULL，就是找城市有值的會員。這一次共有 25 列。先把自己的預期寫成 5 加 25，再看 users 共有 30 列，兩群人既沒有漏掉，也不會同時出現在兩張名單裡。注意「有值」不等於「填得正確」。若來源把半個城市名也收進來，它仍然是一段文字。本堂只辨認缺值，沒有驗證地名真假。


## 範例：空字串和零都不是缺值

空字串（empty string）是長度為零的文字。把兩個英文單引號直接並在一起，表示「有一段文字，但裡面沒有字」。這和表格裡「沒留下任何值」不同；不要看螢幕上像是空格就把兩者合併。想到商品表的小杯也有幫助：它的庫存是 0，是店員清點過、知道一件也沒有，不是尚未盤點。若你把所有零都當成未知，正要補貨的商品就會被藏起來。

## 常見錯誤

- **要找未填城市卻得到 0 列** → `city = NULL` 對每列都不能得出真 → 改用 `WHERE city IS NULL`。
- **把空字串一併當成 NULL** → `''` 是有值的字串，只是長度為 0 → 先問口徑；`IS NULL` 不會選到空字串。
- **清單含錯字卻通過非空檢查** → `IS NOT NULL` 只判定有無值 → 若要確認地名，另外比對允許清單。

## 小結

最後換一張表，看看部門或訂單以外的例子：員工的主管編號缺值，可能表示這是組織圖的根節點，不一定是需要補填的錯誤。判斷方式相同，業務含義得回到欄位說明。完成動手題時，先說你找的是「缺值」還是「有值」，再說交出去的是哪一欄。當同事問「為什麼這份名單只有五個人」，你就能說明你的檢查界線，而不是只回答「因為系統這樣顯示」。
