---
id: sq-group-03
module: sq-group
order: 3
title: GROUP BY
subtitle: 把明細折成每類一列
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-02
objectives:
- 按一欄或多欄分組並輸出對應的聚合數字
- 說明每筆輸入會進哪一組以及輸出每列代表什麼
- 用總列數核對各組計數有沒有漏掉缺值組
tags:
- group by
- 分組鍵
- 聚合
- 每組計數
resources:
- title: GROUP BY Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/groupby
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀基本分組語法與 GROUP BY ALL。
- title: MySQL Handling of GROUP BY
  url: https://dev.mysql.com/doc/refman/8.4/en/group-by-handling.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 ONLY_FULL_GROUP_BY 對未分組欄的規則。
concepts:
- id: sq-group-03-key
  prompt: GROUP BY category 後，每列代表什麼？
  answer: 一個相同 category 的群組，不再是一項商品。
  mcq:
    question: 想出每個分類一列，並數該類商品，SELECT 應放哪些欄？
    options:
    - category, product_name
    - category, COUNT(*)
    - product_id, COUNT(*)
    - 只放 product_name
    answer: 1
    explain: 分類是組名，計數是組內摘要；個別名稱或編號不能代表整組。
- id: sq-group-03-pairs
  prompt: GROUP BY 日期, 狀態 會分出哪種結果？
  answer: 每個實際出現的日期與狀態組合一列。
  mcq:
    question: 同一天有 paid 和 cancelled，只按日期與狀態分組時會有幾列？
    options:
    - 1 列
    - 0 列
    - 2 列
    - 等於當天的原始列數
    answer: 2
    explain: 兩種狀態不同就形成兩組；同組內多張單只影響聚合值。
- id: sq-group-03-bucket
  prompt: 按 city 分組時，城市為 NULL 的列去哪裡？
  answer: 同屬一個 NULL 組；只有你在分組前排除它們才會消失。
  mcq:
    question: 不加 WHERE 就按 city 分組，未填城市的 5 筆去哪裡？
    options:
    - 每筆形成一組
    - 全部被自動排除
    - 一起進 NULL 組
    - 進到字串「未登記」組
    answer: 2
    explain: 分組可以保留一組缺值；固定文字則必須由查詢自己轉換。
- id: sq-group-03-order
  prompt: GROUP BY 已按分類列成群組，是否可省 ORDER BY？
  answer: 群組沒有承諾輸出順序；需要固定排序就另外指定。
  interview:
    question: SELECT 裡想附上原始訂單編號，為什麼 GROUP BY 後報錯？
    answer: 因為我要的是每組一列，一組可能有很多訂單號。加任一單號不說明如何選就不明確。我會先問要總結還是要明細；若要代表單號，就把選擇規則說清楚。
    points:
    - 明白一組不只一列輸入
    - 不能拿任意值當作組的代表
practice:
- id: sq-group-03-p1
  kind: sql
  category: [aggregate]
  title: 分類庫存總表
  minutes: 5
  level: 1
  dataset: shop
  prompt: 對 `products` 按 `category` 分組，輸出 `category`、`product_count`（商品列數）、`total_stock`（庫存件數合計），按此欄序。依 `total_stock` 降冪，同件數依 `category` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT category, COUNT(*) AS product_count, SUM(stock) AS total_stock
    FROM products
    GROUP BY category
    ORDER BY total_stock DESC, category ASC;
  explain: 每類只有一列。商品列數和庫存件數不同：茶飲共有 3 項、合計 22 件。
  hints:
  - 分組鍵放入 SELECT 和 GROUP BY
  - 不同聚合代表不同單位
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-03-key
  - sq-group-03-order
  - sq-group-01-rows
  - sq-group-02-unit
  tags:
  - group by
  - 分組鍵
  - 聚合
- id: sq-group-03-p2
  kind: sql
  category: [aggregate, time]
  title: 每日各步驟接收量
  minutes: 7
  level: 2
  dataset: events
  prompt: 以 `app_events` 的發生日期（`event_at` 直接取 DATE，不換時區）與 `step` 分組。只取事件日期 2026-02-04 至 2026-02-06（含），不去除重送。輸出 `event_day`、`step`、`raw_rows`，照此欄序；依 `event_day`、`step` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT CAST(event_at AS DATE) AS event_day, step, COUNT(*) AS raw_rows
    FROM app_events
    WHERE CAST(event_at AS DATE) BETWEEN DATE '2026-02-04' AND DATE '2026-02-06'
    GROUP BY CAST(event_at AS DATE), step
    ORDER BY event_day, step;
  explain: 同一天的不同步驟不能混成一組；22 號晚到仍屬 2 月 4 日，重送仍算兩筆接收。用收到日或只按步驟會改變報表。
  hints:
  - 先確定用哪個時鐘
  - 分組要同時放日期與步驟
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-03-pairs
  - sq-group-03-order
  - sq-expr-06-clocks
  - sq-group-01-rows
  tags:
  - group by
  - 分組鍵
  - 聚合
---

## 一種分類，一張小計

上一堂把輸入合起來，只得到一列。採購這次想每類商品各報一份庫存，不能把茶飲、器皿與包裝都混成一個數字。`GROUP BY` 告訴數據庫哪幾欄取值相同的列應放在一起。分組鍵（grouping key）是決定這些組的小標籤；放在 `SELECT` 裡可以讓讀表的人知道每個小計屬於哪一組。

## 語法速查

- `SELECT category, COUNT(*) FROM products GROUP BY category`：先依分類分組，數組內列。
- 多鍵用逗號分開：`GROUP BY order_date, status` 每個日期與狀態的組合一列，不是先出一份日表再出一份狀態表。
- 基本順序是 `SELECT … FROM … WHERE … GROUP BY … ORDER BY …`。`WHERE` 可省略，若有就先減少輸入。
- 結果裡放分組鍵和聚合值。若想多放一個未分組的欄位，得先定義如何從多個值得到一個結果。

數據集：`shop`。看看「商品項數」和「可用件數」是不是同一個數字：

```sql
SELECT category, COUNT(*) AS product_count, SUM(stock) AS total_stock
FROM products
GROUP BY category
ORDER BY total_stock DESC, category;
```

茶飲有薄荷茶 8 件、烏龍茶 3 件和紅茶 11 件，所以是 3 項、22 件。器皿 4 項、12 件；包裝 1 項、15 件。結果順序應是茶飲、包裝、器皿。把三組的商品項數加回去是 8，等於原表商品列數；件數合計是 49，不應拿 49 去對原表列數。這種核對要按同一單位才算有意義。

## 一組不能替你挑出代表列

若把 `product_name` 直接放到 SELECT，茶飲那列該顯示三種茶的哪一個？查詢只告訴數據庫如何合併，沒告訴它該選誰。若為了讓查詢通過而把品名加到 `GROUP BY`，結果又不再是分類一列。先確認交付的每列含義；確實要列出最熱賣品項時，應另定評比與平手規則，之後在 [ROW_NUMBER](#/lesson/sq-window-03)再練。

還有一種容易漏掉的組：按城市分組時，NULL 可形成一組，代表沒有城市值，而不代表一個真實城市。若報表不顯示這組，明寫 `WHERE city IS NOT NULL`，總表核對也要對同一批有城市的會員。換到事件日報時，每個日期加步驟才是一組；當天沒出現的步驟不會自動產生零列。需要補齊時先有完整日期和步驟清單，再連接實際數字，本堂不靠手填造一筆事件。

**換引擎怎麼說：**DuckDB 的 `GROUP BY ALL` 可從 SELECT 推出非聚合欄位；面試先明寫分組鍵，移到 MySQL 較直接。MySQL 預設 `ONLY_FULL_GROUP_BY` 會檢查未分組欄；如果確定分組鍵能唯一決定該欄，可能允許，不能拿這個例外代替定義結果。

另一個驗收方法是刻意去掉聚合，只查看屬於茶飲的輸入列；點三個編號，然後用 8、3、11 加回 22。挑一個群組直接回查，能驗證不只是報表總量對了，而且每筆數真的分到該去的那一欄。尤其分類名稱比對規則變了時，總量相同也可能分錯組。

## 常見錯誤

- **報表從每類一列變成每品項一列** → 把品名加進分組鍵 → 回到只按分類的規格。
- **群組輸出順序變了** → 分組不等於排序 → 另外寫 `ORDER BY`。
- **小計加起來比原表少** → 分組之前已有篩選 → 用相同輸入比較總數，包含或排除 NULL 組都要說清楚。
