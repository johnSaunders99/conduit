---
id: sq-read-06
module: sq-read
order: 6
title: LIMIT 與取樣
subtitle: 前五筆不是隨機五筆
status: ready
minutes: 25
level: 1
prereqs:
- sq-read-05
objectives:
- 用 LIMIT 做固定列數的預覽而不宣稱隨機抽樣
- 寫出可重現的前 N 列，並以唯一編號打破同價平手
- 用 LIMIT 與 OFFSET 核對相鄰兩頁
tags:
- limit
- offset
- 前 N 列
- 排序鍵
- 取樣
resources:
- title: LIMIT and OFFSET Clauses
  url: https://duckdb.org/docs/stable/sql/query_syntax/limit
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀列數上限與略過列數的例子。
- title: MySQL SELECT Statement
  url: https://dev.mysql.com/doc/refman/8.4/en/select.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 看 LIMIT 的兩種參數寫法，確認位置。
concepts:
- id: sq-read-06-cap
  prompt: LIMIT 5 保證什麼？
  answer: 至多 5 列；不保證隨機或哪 5 列。
  mcq:
    question: 用 LIMIT 5 而不指定排序，結果可怎麼使用？
    options:
    - 找出最高價五項
    - 當作均勻隨機樣本
    - 只做快速預覽
    - 保證每次挑到同五項
    answer: 2
    explain: 沒有自訂排序，無法聲稱最高價或固定順序；LIMIT 本身也沒有抽樣規則。
- id: sq-read-06-stable
  prompt: 如何讓同價商品只取其中一項時仍有可重現結果？
  answer: 在價格後使用唯一商品編號作第二排序鍵。
  mcq:
    question: 要取最高價前四項，同價取編號較小者，排序如何寫？
    options:
    - ORDER BY price, product_id
    - ORDER BY product_id, price DESC
    - ORDER BY price DESC
    - ORDER BY price DESC, product_id ASC
    answer: 3
    explain: 先按價格降冪，同價再按編號升冪；只排價格不能解決第四名平手。
- id: sq-read-06-offset
  prompt: 每頁 3 列，第二頁的 OFFSET 是多少？
  answer: 先略過第 1 頁的 3 列，所以是 3。
  interview:
    question: 一個報表用 LIMIT 100 驗證數據質量，足夠嗎？
    answer: 它適合先看欄位長相，但不能用這 100 列推論整表。要估比率我會先定抽樣方法和範圍；若只是重現同一批問題，我會用唯一的排序鍵取固定名單。
    points:
    - 區分方便預覽與抽樣推論
    - 說出可重現名單需要的排序條件
practice:
- id: sq-read-06-p1
  kind: sql
  category: [sort, top-n]
  title: 最高價四項
  minutes: 5
  level: 1
  dataset: shop
  prompt: 從 `products` 取最高價的 4 項商品。輸出 `product_id`、`price`，用原欄名及這個欄序；依價格降冪，同價依商品編號升冪。
  starter: 'SELECT '
  solution: |
    SELECT product_id, price
    FROM products
    ORDER BY price DESC, product_id ASC
    LIMIT 4;
  explain: 編號 101 和 102 同價，只有 101 是第 4 項。先寫完排序再限制列數，不可依預覽順序猜第四項。
  hints:
  - 用唯一編號打破同價平手
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-06-cap
  - sq-read-06-stable
  - sq-read-03-tie
  tags:
  - limit
  - offset
  - 前 N 列
- id: sq-read-06-p2
  kind: sql
  category: [sort]
  title: 現行薪級第二頁
  minutes: 7
  level: 2
  dataset: hr
  prompt: 在 `salary_history` 只看 `valid_to` 為 NULL 的現行薪級。依 `monthly_pay` 降冪、`employee_id` 升冪，每頁 3 列；回傳第 2 頁。欄序為 `employee_id`、`monthly_pay`，保留原名，列順序沿用分頁排序。
  starter: 'SELECT '
  solution: |
    SELECT employee_id, monthly_pay
    FROM salary_history
    WHERE valid_to IS NULL
    ORDER BY monthly_pay DESC, employee_id ASC
    LIMIT 3 OFFSET 3;
  explain: 先排除歷史薪級，再排完整名次；略過前 3 列，不是先截 3 列才找有效薪級。
  hints:
  - 現行薪級用缺值判斷
  - 第二頁要略過第一整頁
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-read-06-offset
  - sq-read-06-stable
  - sq-read-04-missing
  tags:
  - limit
  - offset
  - 前 N 列
---

## 先定義哪幾列，再問要幾列

營運要把價格最高的商品放到報表右側，只放得下 4 項。有人先預覽表格，再從眼前看得到的幾列挑最貴的；那不是全表的前四名。行數上限（limit）只決定最多拿幾列。若要拿價格名次，先把排序標準寫進同一個查詢，再截取結果。

## 語法速查

- `LIMIT n`：最多回傳 n 列；如果只剩 2 列，`LIMIT 5` 也只得到 2 列。
- `LIMIT n OFFSET m`：略過排序結果的前 m 列再取 n 列。略過列數叫位移（offset）；不寫時從第一列開始。
- `ORDER BY price DESC, product_id ASC LIMIT 4`：依價格由高到低，同價依編號由小到大，最後取前四列。

數據集：`shop`。執行下面的價格榜：

```sql
SELECT product_id, product_name, price
FROM products
ORDER BY price DESC, product_id ASC
LIMIT 4;
```

從結果讀到茶壺 240 元、禮盒 120 元、濾網 90 元、薄荷茶 60 元。烏龍茶也是 60 元，但商品編號 102 比薄荷茶的 101 大，排到第 5，沒有入榜。移除第二個排序欄，最高三項不受影響，第四項卻沒有明確規則。即使你在這台電腦上重跑十次都碰巧是薄荷茶，查詢也沒有承諾下一次仍選同一項。需求若是「第四名同價全留」，上限 4 列就不再符合；之後在 [RANK 與 DENSE_RANK](#/lesson/sq-window-04) 用名次而不是列數解決。

## 用同一種順序切頁

在靜態數據上把每頁設成 3 列，第 1 頁略過 0 列，第 2 頁略過 3 列，第 3 頁略過 6 列。將範例改成 `LIMIT 3 OFFSET 3`，第 2 頁應從薄荷茶開始，不會重複第 1 頁的濾網。要逐頁核對，就固定兩頁的篩選與排序，包括平手規則。線上數據若在翻頁途中新增了一筆高價商品，原本的第 3 筆可能移到第 4 位；即使排序完整，第二頁仍可能重見第一頁的東西。這和沒有排序是兩種不同問題，這堂在固定的小表上先練完整的排序條件，不假設線上表永遠不變。

## 預覽不是隨機取樣

不加排序的 `LIMIT` 可以快速確認欄名和內容形式；做隨機抽樣（random sampling）則是在定義每列如何被選中。前 5 列可能集中在最早載入的一天，不能拿來估全月的退單率。核對時先說你要的是「讓我看幾列長怎樣」、「固定前幾名」還是「估全表的情況」。三個問題的驗收不同，不能用一次看起來合理的輸出混過去。

**換引擎怎麼說：**MySQL 支援 `LIMIT n OFFSET m`，也有 `LIMIT m, n` 的簡寫，逗號前面是略過數。別把這個簡寫直接移到 DuckDB 或 Spark SQL；分開寫能讓閱讀的人直接辨認兩個數各代表什麼。

試著用同一套排序把 8 項切成 3、3、2 列，再比對每頁的編號有沒有重疊。最後一頁不到 3 項不是故障，只是剩餘不足；若還拿到 3 項，先查是否忘了遞增略過的列數。這個練習比反覆執行同一頁，更容易發現分頁公式寫錯。

## 常見錯誤

- **得到想要的列數卻不是最貴** → 只有 `LIMIT`，沒有名次條件 → 在它前面加 `ORDER BY price DESC, product_id`。
- **平手時榜單不固定** → 排序條件沒有區分同價商品 → 明寫次要排序欄。
- **第二頁少翻或多翻** → 把頁碼當成略過列數 → 從第 2 頁的 `OFFSET 3` 查起，比對前一頁末列。
