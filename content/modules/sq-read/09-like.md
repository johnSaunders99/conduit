---
id: sq-read-09
module: sq-read
order: 9
title: LIKE 與萬用字元
subtitle: 從品名找一組候選商品
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-08
objectives:
- 用百分號做前綴、後綴及包含查詢
- 用底線區分恰好一字與任意長度
- 用 ESCAPE 查找字面的底線
tags:
- like
- 萬用字元
- 字串匹配
- escape
resources:
- title: Pattern Matching
  url: https://duckdb.org/docs/stable/sql/functions/pattern_matching
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 LIKE 的全字串比對與 ESCAPE 範例。
- title: MySQL String Comparison Functions and Operators
  url: https://dev.mysql.com/doc/refman/8.4/en/string-comparison-functions.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的 LIKE 與大小寫比對。
concepts:
- id: sq-read-09-percent
  prompt: LIKE 裡的百分號能代表空字串嗎？
  answer: 能；它匹配零個或多個字元。
  mcq:
    question: 哪個型式會找到紅茶和只有一個字的茶，但不找茶壺？
    options:
    - '''茶%'''
    - '''_茶'''
    - '''%茶'''
    - '''茶'''
    answer: 2
    explain: 後綴用百分號在前；底線要恰好一字，前綴則會找茶壺。
- id: sq-read-09-underscore
  prompt: LIKE 裡的底線匹配幾個字元？
  answer: 恰好一個，既不能略過也不能吞掉兩字。
  mcq:
    question: 要找恰好兩個字，且第二字是茶，選哪個型式？
    options:
    - '''%茶'''
    - '''_茶'''
    - '''茶_'''
    - '''%茶%'''
    answer: 1
    explain: 左側一個底線固定長度與位置；百分號不限制長度。
- id: sq-read-09-escape
  prompt: 怎麼讓 LIKE 裡的底線只代表真的底線？
  answer: 用 ESCAPE 指定跳脫字元，放在底線前，例如 `LIKE '%!_%' ESCAPE '!'`。
  interview:
    question: 商品分類能直接用 LIKE '%茶%' 當成茶飲嗎？
    answer: 這樣會把茶壺、茶匙也抓進來，只適合找候選。正式分類我用 category 等明確欄位；如果一定要靠字串，先把型式、例外和比對規則寫清楚再驗證。
    points:
    - 區分文字命中與業務分類
    - 用茶壺或茶匙作反例
practice:
- id: sq-read-09-p1
  kind: sql
  category: [select, expression]
  title: 品名只有一字加茶
  minutes: 4
  level: 1
  dataset: shop
  prompt: 從 `products` 找品名恰好兩個字、末字是「茶」的商品。輸出 `product_id`、`product_name`，照這個欄序與原名；不要求列排序。
  starter: 'SELECT '
  solution: |
    SELECT product_id, product_name
    FROM products
    WHERE product_name LIKE '_茶';
  explain: 紅茶符合，薄荷茶與烏龍茶都多一字。用 `%茶` 只限制結尾，不限制長度。
  hints:
  - 一個底線恰好匹配一字
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-09-underscore
  - sq-read-09-percent
  tags:
  - like
  - 萬用字元
  - 字串匹配
- id: sq-read-09-p2
  kind: sql
  category: [select, distinct]
  title: 三位數事件鍵的瀏覽候選
  minutes: 7
  level: 2
  dataset: events
  prompt: 在 `app_events` 取 `step` 為 `view`，且事件鍵格式為 `e1` 開頭後恰好還有兩個字元的事件。只輸出 `event_id`，保留原名；重送只留一列，依 `event_id` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT DISTINCT event_id
    FROM app_events
    WHERE step = 'view' AND event_id LIKE 'e1__'
    ORDER BY event_id;
  explain: '`e1__` 限定完整長度，不會把短的 `e10` 加進來。重送仍要按事件鍵去重，不能按接收列取。底線不限制數字，只因本表事件鍵採數字尾碼。'
  hints:
  - 開頭固定，餘下長度也固定
  - 同一事件鍵可能重複
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-09-underscore
  - sq-read-05-tuple
  - sq-read-07-both
  tags:
  - like
  - 萬用字元
  - 字串匹配
---

## 找候選品項，不是改商品分類

店員要查「茶」字出現在哪些品名。直接用 `product_name = '茶'` 找不到薄荷茶；等號要求整段相同。`LIKE` 也是比對整段，但你可以在模式（pattern）中留出位置給其他字。萬用字元（wildcard，大陸也稱通配符）不是字面文字：位置和數量會決定結果。

## 語法速查

- `LIKE '茶%'`：以茶開頭，`%` 可以接零個或多個字元。
- `LIKE '%茶'`：以茶結尾；若品名剛好只有茶也會符合。
- `LIKE '%茶%'`：任何位置出現茶都符合。
- `LIKE '_茶'`：整段恰好是一個字元再接茶；`_` 匹配恰好一個字元。
- `LIKE '%!_%' ESCAPE '!'`：在任意位置查找真的底線。跳脫字元（escape character）`!` 讓下一個底線不再作為萬用字元。

數據集：`shop`。先把末字是茶的品名列出來：

```sql
SELECT product_id, product_name
FROM products
WHERE product_name LIKE '%茶'
ORDER BY product_id;
```

薄荷茶、烏龍茶、紅茶共 3 項。把模式改成 `'茶%'`，會得到茶壺和茶匙，共 2 項。改成 `'_茶'` 則只剩紅茶。這三個結果可以用同一張小表手算：先把固定的茶對到模式要求的位置，再確認還有幾個字要交給萬用字元。不能把底線想成任意長度，也不能把 `LIKE '茶'` 當成自帶前後百分號的搜尋。跑完三次後，挑一個剛好被保留的品名和一個剛好被排除的品名，各說出一條規則。

## 真有一條底線的時候

事件或欄位名稱有時故意包含底線。若想找字面上的 `order_` 開頭，`LIKE 'order_%'` 還可能找到開頭是 `orderX` 的文字，因為那個底線可代表 X。寫成 `LIKE 'order!_%' ESCAPE '!'`，第六個字元就必須是真正的底線。相同方式也能查真正的百分號；先選一個不會和固定內容混淆的跳脫字元，讓規則在查詢本身看得見。若要檢查尾碼只能是數字，底線做不到；它只管字元個數，不管字元種類。本堂的事件題有數字尾碼是表本身的命名規則，不是 LIKE 替你驗證了數字。

**換引擎怎麼說：**DuckDB 有不分大小寫的 `ILIKE`；MySQL 的 `LIKE` 是否區分大小寫要看字串定序（collation，大陸也稱排序規則，決定比對與排序），不能直接把 `ILIKE` 搬過去。移植英文字串的搜尋時，至少用一對只有大小寫不同的文字驗證；本堂的茶字與小寫事件鍵不依賴英文字母大小寫轉換。

若未填品名也要列入補登清單，另加缺值條件。`NOT LIKE` 不是 `LIKE` 結果的逐列補集：品名是 NULL 時，兩個普通比對都不能得到真。先問未填要算未命中還是另列，別用一次反向搜尋假裝已分類所有商品。

## 常見錯誤

- **茶壺沒出現** → 模式是後綴 `'%茶'`，不是包含 → 搜尋任一位置時用 `'%茶%'`。
- **多字茶名也進了雙字清單** → 百分號不限制長度 → 改用 `'_茶'`。
- **標籤抓到相似但沒有底線的名稱** → 裸底線是一個萬用字元 → 用 `ESCAPE` 明確指示字面的底線。

要交付分類報表時，再回頭確認營運要的是品名搜尋結果，還是分類欄上的茶飲。兩個結果可以剛好重疊，也可以完全不同；一份好查詢不會把文字碰巧命中當成分類證據。
