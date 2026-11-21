---
id: sq-pattern-01
module: sq-pattern
order: 1
title: 分組 Top N
subtitle: 先問並列時要幾人
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
  - "用窗口函式寫出分類內排名"
  - "比較固定名額、保留並列及取不同價位三種答案"
  - "用商品編號固定同價商品的輸出順序"
tags:
  - "Top N"
  - "窗口函式"
  - "平手規則"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "比較三種排名函式對同值的處理。"
  - title: "MySQL：Window Function Descriptions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "查排名函式及窗口排序的對應寫法。"
concepts:
  - id: "sql-top-fixed"
    prompt: "每類最多 2 筆且同價取較小編號，用什麼排名？"
    answer: "用 ROW_NUMBER，價格降序、商品編號升序。"
    mcq:
      options:
        - "RANK，只按價格"
        - "ROW_NUMBER，按價格再按編號"
        - "DENSE_RANK，只按價格"
        - "全表 LIMIT 2"
      answer: 1
      explain: "RANK 與 DENSE_RANK 可讓同價多筆同時入選；全表 LIMIT 不會替每類各取一次。"
    interview:
      question: "營運要每類前兩名，你會先問什麼？"
      answer: "我會確認是最多兩件、保留第二筆的並列，還是要兩個不同價位。同價時三者可能不同。我會拿同價例子確認，再用商品鍵固定顯示順序。"
      points:
        - "確認名額或價位口徑"
        - "用同價反例驗證"
        - "分開排名與顯示排序"
  - id: "sql-top-distinct"
    prompt: "價格 60、60、50 的密集排名各是多少？"
    answer: "依價格降序是 1、1、2。"
    mcq:
      options:
        - "1、2、3"
        - "1、1、3"
        - "2、2、1"
        - "1、1、2"
      answer: 3
      explain: "同價共享名次，下一個不同價位緊接；1、1、3 是 RANK。"
  - id: "sql-top-output"
    prompt: "窗口中已排序，為何仍需要最外層 ORDER BY？"
    answer: "窗口排序只定義排名，最外層才保證交付次序。"
    mcq:
      options:
        - "窗口排序不保證結果的列順序"
        - "同一欄窗口排序會帶到整份結果"
        - "分區後結果一定按分類及窗口順序"
        - "CTE 已有名次欄，輸出一定會照名次排列"
      answer: 0
      explain: "窗口排序、分區及 CTE 產生的列都不承諾最終顯示順序；只有最外層的 ORDER BY 能定義這次交付的順序。"
practice:
  - id: "sq-pattern-01-p1"
    kind: "sql"
    category: [top-n, window]
    title: "每類固定取兩件"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "從 `products` 選每個分類最多 2 件商品：價格高者先，同價選商品編號小的；不足 2 件全留。輸出 `category`、`product_id`、`price`、`pos`（名次），依 `category`、`pos`、`product_id` 升序。"
    solution: |-
      WITH ranked AS (
        SELECT category, product_id, price,
               ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_id) AS pos
        FROM products
      )
      SELECT category, product_id, price, pos FROM ranked WHERE pos <= 2
      ORDER BY category, pos, product_id;
    explain: "先在分類內排名，再到外層篩 pos。直接 LIMIT 2 只限制全表；同價缺唯一排序鍵，就不能保證每次選到同一件。"
    hints:
      - "PARTITION BY 的鍵就是「每類」的欄位。"
      - "同價規則放在窗口 ORDER BY 的第二鍵。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-top-fixed"
      - "sql-top-output"
      - "sq-window-03-number"
    tags:
      - "Top N"
      - "窗口函式"
  - id: "sq-pattern-01-p2"
    kind: "sql"
    category: [top-n, window]
    title: "前兩個價位全部保留"
    minutes: 9
    level: 3
    dataset: "shop"
    prompt: "面試追問：改為每類最高的 2 個不同價位，同價商品全留。輸出 `category`、`product_id`、`price`、`pos`（價位名次）；依 `category`、`pos`、`product_id` 升序。"
    solution: |-
      WITH ranked AS (
        SELECT category, product_id, price,
               DENSE_RANK() OVER (PARTITION BY category ORDER BY price DESC) AS pos
        FROM products
      )
      SELECT category, product_id, price, pos FROM ranked WHERE pos <= 2
      ORDER BY category, pos, product_id;
    explain: "茶飲有兩件 60 元和一件 50 元，DENSE_RANK 都收入。RANK 把 50 元排第 3；若把 product_id 放入窗口，原本的平手會消失。"
    hints:
      - "名次是比它貴的不同價位數加 1。"
      - "編號只用於外層顯示順序。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-top-distinct"
      - "sq-window-04-dense"
      - "sql-top-fixed"
      - "sql-top-output"
      - "sq-window-03-number"
    tags:
      - "Top N"
      - "平手規則"
---

## 先談名額，再談函式

茶舖首頁每類只放 2 張商品卡，採購表卻要看每類最高的 2 個價位。以茶飲的 60、60、50 元為例，首頁只能放前兩件；採購表還會看到 50 元的那件。兩張表都有人口頭叫「每類前兩名」，所以先寫一句可核對的口徑：**每類最多幾列，還是最多幾個不同的值？** 這會決定同價商品去留，不只是函式拼法不同。

### 三種排名（ranking）

- `ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_id)`：每類從 1 編號。第二排序鍵（sort key）打破平手，讓同類同價也有固定順序。
- `RANK() OVER (PARTITION BY category ORDER BY price DESC)`：只以價格判定平手。同價共享名次，之後可能跳號；若篩到第 2 名，保留前兩筆所在價位及其並列。
- `DENSE_RANK() OVER (PARTITION BY category ORDER BY price DESC)`：同價共享名次但不跳號，數的是不同價位。

## 先看排名，再切掉沒入選的列

在 [SQL 練習場自由練習](#/sql?tab=free) 選「茶舖訂單」數據集 `shop`。下面先交出中間結果：每列仍是一件商品，旁邊加三種名次。看茶飲：前兩件的 `price_rank` 都是 1，50 元那列的 `price_rank` 是 3、`price_band` 卻是 2。再看包裝：它不足兩件，不需要補一筆假的商品。

```sql
SELECT category, product_id, price,
       ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_id) AS slot_no,
       RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_rank,
       DENSE_RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_band
FROM products ORDER BY category, slot_no;
```

交付時把排名留在結果上供人核對，再篩 `pos <= 2`。下方把窗口結果放進公用表運算式（CTE），也就是只在本次查詢內使用的具名結果。外層仍要排序：窗口內的排序不保證整張結果的列順序。

```sql
WITH ranked AS (
  SELECT category, product_id, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_id) AS pos
  FROM products
)
SELECT category, product_id, price, pos FROM ranked WHERE pos <= 2
ORDER BY category, pos, product_id;
```

若改成「各類最多 2 個價位」，換排名並移除窗口內的編號；最外層保留編號，這樣同價仍按固定順序顯示。先用茶飲的 3 列手算，再執行。說明時請用「同價是同一名」或「同價取較小編號」，不要只唸函式名。遇到並列剛好卡在名額邊界，再問需求方是否願意交付多於兩件。

**方言。** DuckDB 可用 `QUALIFY` 篩窗口結果；要把解法帶到 MySQL、Hive SQL 或 Spark SQL，先在 CTE 算名次、外層再 `WHERE`，不用依賴引擎對 `QUALIFY` 的支援。

### 留一張平手驗收表

暫時讓中間查詢只看茶飲，再抄下三個商品的三種名次。對照固定名額與不同價位兩份結果，圈出只有第二份才交付的 50 元商品。若題目改成「保留第二筆的並列」，茶飲這組的前兩件本來就同價，容易誤以為它和固定名額永遠一樣。可以用器皿把門檻改成 3：前兩價 240、90，最後兩件同為 45。固定名額仍只交 3 件，保留第三筆並列則交 4 件。用這組解釋差別，比只講三個函式的排列更容易讓人核對。

也可以從結果反問自己：「如果明天又新增一件同價商品，哪一份表會變長？」首頁名額不會變，採購表在入選價位出現新商品時會變長。這是判斷需求是否已講清楚的快速方法。

## 常見錯誤

- 全部分類加起來只剩 2 件 → 把分組名額寫成全表限制 → 改用分區排名。
- 同價商品名次不同 → 唯一鍵參與了本來應保留平手的排名 → 把它移到外層排序。
- 同價選中的編號不穩定 → 固定名額卻沒定平手規則 → 在 `ROW_NUMBER` 中補唯一排序鍵。
- 商品畫面沒按名次排 → 只在窗口內排序 → 補上最後的 `ORDER BY`。
