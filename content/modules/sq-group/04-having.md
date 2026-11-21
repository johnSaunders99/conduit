---
id: sq-group-04
module: sq-group
order: 4
title: HAVING
subtitle: 先挑付款單，再挑達標日
status: ready
minutes: 30
level: 1
prereqs:
- sq-group-03
objectives:
- 用 WHERE 選明細、HAVING 選達標群組
- 用剛好等於門檻的日期核對 >= 與 >
- 辨認把條件放錯階段會改掉計數的原因
tags:
- having
- 分組後篩選
- 門檻
- where
resources:
- title: HAVING Clause
  url: https://duckdb.org/docs/stable/sql/query_syntax/having
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 HAVING 與 WHERE 的篩選對象。
- title: MySQL Handling of GROUP BY
  url: https://dev.mysql.com/doc/refman/8.4/en/group-by-handling.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 看 MySQL 允許 HAVING 用輸出別名的例外。
concepts:
- id: sq-group-04-phase
  prompt: 要求每天付款至少兩張，兩種限制各放哪裡？
  answer: 付款限制在 WHERE；分組後的 COUNT(*) 門檻在 HAVING。
  mcq:
    question: 哪一個條件應放 HAVING？
    options:
    - status = 'paid'
    - COUNT(*) >= 2
    - order_date >= DATE '2026-01-01'
    - order_id IS NOT NULL
    answer: 1
    explain: 其他項都能在單列判斷；計數門檻要等群組做完才知道。
- id: sq-group-04-threshold
  prompt: 「至少 2 張」對剛好 2 張的組怎麼判定？
  answer: 保留，用 `>= 2`，不是 `> 2`。
  mcq:
    question: 某天有一張付款、一張取消，先篩付款再用 HAVING COUNT(*) >= 2，結果如何？
    options:
    - 保留，因為原始列為 2
    - 查詢會失敗
    - 排除，因只有一張付款
    - 保留，而且數量算成 0
    answer: 2
    explain: WHERE 已先拿掉取消列；不能用原始列數判斷。
- id: sq-group-04-alias
  prompt: HAVING 中如何寫聚合門檻較易移植？
  answer: 重寫聚合運算式，例如 `HAVING COUNT(*) >= 2`，避免依賴同層輸出別名。
  interview:
    question: 用 HAVING 篩付款狀態，是否能得到每日的付款計數？
    answer: 我會先逐列篩付款，再按天數，只用 HAVING 決定哪一天達標。若先把兩種狀態都算進同一日，再看群組，不會自動從計數裡扣掉取消單。
    points:
    - 清楚說明兩次篩選的對象
    - 用一付一取消的日子驗證
practice:
- id: sq-group-04-p1
  kind: sql
  category: [aggregate]
  title: 至少兩項商品的分類
  minutes: 4
  level: 1
  dataset: shop
  prompt: 在 `products` 列出至少有 2 項商品的分類。輸出 `category`、`product_count`，依此欄序；依 `product_count` 降冪，平手依 `category` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT category, COUNT(*) AS product_count
    FROM products
    GROUP BY category
    HAVING COUNT(*) >= 2
    ORDER BY product_count DESC, category ASC;
  explain: 包裝只有一項被排除；應對整個分類的列數做門檻，而不是查個別商品庫存是否至少 2。
  hints:
  - 先按分類分組，再篩聚合數字
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-04-phase
  - sq-group-04-threshold
  - sq-group-03-key
  tags:
  - having
  - 分組後篩選
  - 門檻
- id: sq-group-04-p2
  kind: sql
  category: [aggregate]
  title: 兩張以上付款單的營業日
  minutes: 7
  level: 2
  dataset: shop
  prompt: 查看 `orders` 在 2026-01-14 到 2026-01-20（含）的訂單，只有 `paid` 算付款。按天只列付款至少 2 張的日期；輸出 `order_date`、`paid_orders`，欄序照此，依 `order_date` 升冪。
  starter: 'SELECT '
  solution: |
    SELECT order_date, COUNT(*) AS paid_orders
    FROM orders
    WHERE status = 'paid'
      AND order_date BETWEEN DATE '2026-01-14' AND DATE '2026-01-20'
    GROUP BY order_date
    HAVING COUNT(*) >= 2
    ORDER BY order_date;
  explain: 1 月 18 日表面有兩張單，但只有一張付款；1 月 14 日剛好兩張付款必須保留。先篩文字狀態，再篩各日計數。
  hints:
  - 先在 WHERE 同時限制日期與付款
  - 分組後用 HAVING
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  concepts:
  - sq-group-04-phase
  - sq-group-04-threshold
  - sq-group-03-key
  - sq-read-08-inclusive
  tags:
  - having
  - 分組後篩選
  - 門檻
---

## 明細門檻和小計門檻不在同一步

營運要找付款達 2 張的日子，把清單交給會計抽查。要求有兩道關卡：不是付款的訂單不算；只有計數達到門檻的日子才交付。先用 `WHERE` 問「這張單是否符合」，再用 `HAVING` 問「這組加起來是否符合」。兩個子句看起來都在篩資料，對象卻不同。

## 語法速查

- `WHERE status = 'paid'` 在分組前篩單列。
- `GROUP BY order_date` 把符合的單分到各日。
- `HAVING COUNT(*) >= 2` 在計數後篩整組；少於 2 張的日子不輸出。
- SQL 寫法順序是 `SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY …`。若照人類讀表的順序驗算，先找來源，再選明細、按鍵分組、算組內數值、取達標列，最後才排好輸出。

數據集：`shop`。用幾個相鄰日期確認門檻：

```sql
SELECT order_date, COUNT(*) AS paid_orders
FROM orders
WHERE status = 'paid'
  AND order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-20'
GROUP BY order_date
HAVING COUNT(*) >= 2
ORDER BY order_date;
```

應看到 17、19、20 日各 2 張。18 日原表有 1010、1011 兩列，但 1011 取消，所以當天只有一張付款。若移除 `HAVING`，18 日應回到日計數表且顯示 1；若反而移除付款條件，18 日會在達標清單裡變成 2。這組實驗能分開兩種錯誤：少了達標門檻，或讓不該入組的明細進了組。再把 `>=` 換成 `>`，剛好達標的日子也會消失；問題是讀錯「至少」，不是分組出錯。

## 同一張日報還要看取消數呢？

先在 WHERE 把取消列刪掉，就再也不能在同一份聚合中數那些被排除的列。如果營運改成要在同一天列出付款數與取消數，再按付款數挑日期，先留兩種明細，按照條件各自計數。這叫條件聚合（conditional aggregation），會在[條件聚合](#/lesson/sq-group-06)細講；本堂兩道關卡只服務「只看付款」的需求。用這個延伸先分清楚：篩選輸入是在改分母，篩選群組是在決定是否顯示整列。

**換引擎怎麼說：**MySQL 和 DuckDB 都能在一定條件下用輸出別名寫 `HAVING paid_orders >= 2`；為了跨引擎範例更直接，手寫時先用原本的聚合式。這也避免別名碰巧和原欄同名，讓讀者誤以為是逐列數值。有些 MySQL 查詢會被允許在 HAVING 寫普通欄的檢查，不能因此把明細條件移到那裡。

遇到數字不對時，先只執行分組小計，暫時拿掉 HAVING。小計若已錯，例如把 18 日列成 2，就回查該日的原明細和付款條件；別在錯誤的數字上反覆調門檻。小計正確而最終清單不對，再查比較運算子與門檻值。也可以把日期換成只出現一筆付款的 13 日，驗證沒有任何日組達標時是 0 列，不是回一列寫 0。這種逐步驗法還能說明為何要留著一份不設門檻的小計作對照。保留小計時記下原本的輸入日期；如果重跑改了起訖，兩份清單的差異就不能只用門檻解釋。

## 常見錯誤

- **WHERE 裡的 COUNT 報錯** → 還沒分組就要求組內計數 → 將計數門檻移到 `HAVING`。
- **取消單混進付款數** → 按天計了全部訂單 → 將 `status = 'paid'` 放回 `WHERE`。
- **剛好兩張的日期沒了** → 把「至少」寫成嚴格大於 → 用 `>= 2` 再用達標邊界驗算。
