---
id: sq-compose-03
module: sq-compose
order: 3
title: EXISTS 判斷
subtitle: 不因多次退款而重複列單
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-02
objectives:
- 用 EXISTS 判斷同鍵是否存在
- 用 NOT EXISTS 找未完成的會話
- 從反例分辨相關條件與 NULL
tags:
- exists
- not-exists
- 存在判斷
resources:
- title: DuckDB：子查詢
  url: https://duckdb.org/docs/stable/sql/expressions/subqueries
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 EXISTS 與 NOT EXISTS 對左列的影響。
- title: MySQL：EXISTS 子查詢
  url: https://dev.mysql.com/doc/refman/8.4/en/exists-and-not-exists-subqueries.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL EXISTS，不必投影所查欄值。
concepts:
- id: sq-compose-03-exists
  prompt: 有兩筆退款，EXISTS 會如何處理外層的一筆訂單？
  answer: 它只回真，所以這筆外層訂單通過一次。
  mcq:
    options:
    - 把外層展開成兩列
    - 算出退款總額
    - 選退款較高的一筆
    - 返回真，保留外層那列一次
    answer: 3
    explain: EXISTS 只測是否至少有一列，不數、不加、不複製。
- id: sq-compose-03-link
  prompt: 忘了在 EXISTS 內比對訂單號，有什麼後果？
  answer: 只要退款表有任一筆，所有外層訂單都可能通過，判斷失去相關性。
  mcq:
    options:
    - 只要有退款，可能每張單都通過
    - 只通過退款金額最高的單
    - 自動用同名欄配對
    - 只通過未退款單
    answer: 0
    explain: EXISTS 不依欄名猜連接，把外層鍵放進條件才是逐張判斷。
- id: sq-compose-03-neg
  prompt: NOT EXISTS 和 NOT IN 遇到右側 NULL 為何不同？
  answer: NOT EXISTS 要找讓條件為真的列；右側 NULL 無法與左鍵用等號配成真。
  mcq:
    options:
    - NOT EXISTS 自動將 NULL 改成零
    - NOT EXISTS 只問有沒有真的匹配
    - 兩種都把 NULL 當全匹配
    - 兩種都要求右側只有一列
    answer: 1
    explain: 等值未知不是匹配；NOT IN 則可能因右側缺值整個變成未知。
  interview:
    question: 不用 DISTINCT，如何找每張有退款的單？
    points:
    - 以訂單作外層
    - 用鍵關聯的 EXISTS
    - 可舉多次退款反例
    answer: 我從一單一列的 orders 出發，EXISTS 裡只找同一訂單號的退款。1021 有兩次退款，外層仍只過一次；若後面要退款額，我會另行按單聚合。
- id: sq-compose-03-projection
  prompt: EXISTS 裡的 SELECT 1 是什麼意思？
  answer: 用常數表達不需要欄值。它不表示只讀第一列，也不限定右表只有一列。
practice:
- kind: sql
  category: [cte, join]
  title: 列出已退款的付款單
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    只列已付款且至少有一筆退款的訂單，每張單一列。

    只輸出以下欄位，欄序固定：`order_id`、`user_id`。

    排序：`order_id` 升序。
  solution: |
    SELECT o.order_id, o.user_id FROM orders AS o
    WHERE o.status = 'paid'
      AND EXISTS (SELECT 1 FROM refunds AS r WHERE r.order_id = o.order_id)
    ORDER BY o.order_id;
  explain: |
    1021 的兩筆退款只讓同一張單通過一次。把退款接成一般內連接會列兩次，漏掉兩側 order_id 條件則會讓未退款的單也通過。
  hints:
  - 外層先定義訂單主體與付款狀態。
  - 括號只問同一訂單是否有退款。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-03-exists
  - sq-compose-03-link
  - sq-join-06-semi
  tags:
  - exists
  - 退款單
  id: sq-compose-03-p1
- kind: sql
  category: [cte, join]
  title: 找出只看未買的已知會話
  minutes: 9
  level: 2
  dataset: events
  prompt: |
    從有 `view` 的接收列出發，只看 session_id 非 NULL 的會話。若同一 session_id 沒有任何 `pay` 接收列，輸出其 session_id；重送不應讓同一會話重複出現。

    只輸出以下欄位，欄序固定：`session_id`。

    排序：`session_id` 字母升序。
  solution: |
    SELECT DISTINCT v.session_id
    FROM app_events AS v
    WHERE v.step = 'view' AND v.session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM app_events AS p WHERE p.session_id = v.session_id AND p.step = 'pay'
      )
    ORDER BY v.session_id;
  explain: |
    NOT EXISTS 只驗證付款是否存在；外層可能有重送，仍須依會話去重。缺會話鍵不能當成一個已知會話，省略外層非空限制會多一列 NULL。
  hints:
  - 先定義可對帳的 view 會話。
  - 括號只找同會話的 pay。
  - NOT EXISTS 不會替外層去重。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-03-neg
  - sq-compose-03-projection
  - sq-join-06-anti
  tags:
  - not-exists
  - 會話
  - 去重
  id: sq-compose-03-p2
---

退款 1021 分兩次發生，客服只關心是否要把這張單放進「已有退款」名單。從明細接過來再修重複，很容易把「是否有」和「有幾次」混為一談。這堂用訂單表當主角，讓退款表只回答一個是非題。

## 有沒有任何一列

- `WHERE EXISTS (SELECT 1 FROM 右來源 WHERE 右鍵 = 左鍵)`：存在判斷（existence test）。內層只要有一列，就對該筆外層紀錄回真。
- `WHERE NOT EXISTS (SELECT 1 FROM 右來源 WHERE 右鍵 = 左鍵)`：沒有任何匹配 時為真。請把鍵條件留在括號內，讓內層能看到外層目前的鍵。
- `SELECT 1` 用來表示不需要內層欄值。判斷的是有沒有列，不是判斷 1 大於 0，也不是限制最多一列。若真的要退款筆數或金額，要另行聚合。

在 SQL 練習場的「自由練習」選 `shop` 數據集，執行：

```sql
SELECT o.order_id
FROM orders AS o
WHERE EXISTS (SELECT 1 FROM refunds AS r WHERE r.order_id = o.order_id)
ORDER BY o.order_id;
```

1021 仍只出現一次，無退款的 1001 不出現。你可以嘗試把括號裡的 `r.order_id = o.order_id` 拿掉：退款表有數據，每張付款單都會通過。錯法通常不報語法錯；所以拿一張已知未退款的單當反例，比只檢查「有一張退款單通過」更有效。

事件表則多一個決策：會話號沒填的事件，不能因為找不到同會話付款就說「這是一個未購買的已知會話」。報表先排除未知鍵，再判斷已知鍵有無付款。右邊付款列即使有缺鍵也不妨礙別的會話判定；這和 `NOT IN` 容易被右側缺值影響不同。另要分清左側是否本來就有重送；存在判斷不會改變左側的輸入重複。

DuckDB 與 MySQL 可用本課的相關 `EXISTS`／`NOT EXISTS`。Spark SQL 若要明示左側存在判斷，亦可寫 `LEFT SEMI JOIN`／`LEFT ANTI JOIN`；移植時以同一個「匹配兩列、零列、缺值」反例核對，而不是只看關鍵字長得像不像。

## 將只問存在與帶回欄位分開

先拿三張單當小驗收：1001 沒退款應落選、1007 有一次退款應入選、1021 有兩次退款也只入選一次。比對這三張單有不同效果：第一張能抓到沒寫相關條件，第三張能抓到把普通內連接當半連接用。第二張則讓你確認基本配對鍵確實找得到已退款的單。遇到數百萬筆紀錄，這個小檢查依然能在你看全表前先驗口徑。

有時業務下一句會追問「退了多少」。這時寫 `EXISTS` 過濾名單不是錯，但它沒有傳回退款欄；不應硬在外層把內層退款別名拿來加總。另做按訂單聚合，或者讓聚合後的退款合計成為右側來源。這也提醒你讀懂需求的名詞：列「退過款的訂單」與列「退款紀錄」是兩種粒度，不能以最後列數恰好相同就宣告等價。

切到會話題時先挑你知道同時有瀏覽和付款的會話，如 s1；它不應出現在「只看未買」的成品，再找一筆跳步付款數據確認付款不是非得先加購才算。

## 常見錯誤

- 每張付款單都入選 → 檢查內層是否真的引用外層訂單鍵。
- 想從 EXISTS 取得金額 → 它只回真假，改做每單退款聚合才能拿到數值。
- 無退款名單遇 NULL 就空了 → 別把相關 NOT EXISTS 直接換成未清理右欄的 NOT IN。
