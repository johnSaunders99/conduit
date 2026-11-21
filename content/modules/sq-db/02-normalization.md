---
id: sq-db-02
module: sq-db
order: 2
title: 正規化
subtitle: 同一個地址不必改三處
status: ready
minutes: 30
level: 2
prereqs:
- sq-db-01
objectives:
- 用第一、第二、第三正規形說明欄位應放哪一表
- 用鍵把訂單、會員和明細接回並保留成交單價
tags:
- 正規化
- 函數相依
- 更新異常
resources:
- title: Microsoft：數據庫正規化入門
  url: https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀前三種正規形，對照欄位依賴哪個鍵。
concepts:
- id: sq-db-02-dependency
  prompt: 一個會員只有一個目前城市時，城市依賴哪個鍵？
  answer: 城市由會員編號決定；它不是由訂單明細的行號決定。
  mcq:
    options:
    - 單內行號
    - 商品分類
    - 會員編號
    - 明細成交單價
    answer: 2
    explain: 任何同會員編號的目前數據都應只有一個城市；不應靠訂單副本各自擁有這個值。
- id: sq-db-02-third
  prompt: 若明細上有商品編號與商品分類，哪種拆法符合第三正規形的目的？
  answer: 把商品分類放到商品表；明細只保留商品編號參照和本次成交欄位。
  mcq:
    options:
    - 把商品分類併進主鍵
    - 把每張單的分類存成逗號字串
    - 用 DISTINCT 每晚覆寫重複分類
    - 商品分類隨商品表維護
    answer: 3
    explain: 這是欄位透過商品編號依賴主鍵的例子；改鍵或事後去重不會消除多處更新。
- id: sq-db-02-price
  prompt: 為何成交單價不應改成現行標價？
  answer: 成交單價是那次成交的事實，改商品標價不應改寫歷史訂單。
  mcq:
    options:
    - 成交單價留在訂單行
    - 永遠以商品現價回填歷史
    - 凡欄名有價格都移入商品表
    - 改價時同步更新所有舊訂單行
    answer: 0
    explain: 標價和成交價不是同一個業務事實，因此不是單純重複。
  interview:
    question: 遇到一張大寬表，你如何判斷哪些欄位要拆？
    answer: 我先看每列代表什麼、哪個鍵決定欄位，再確認是否需要保留歷史值。以會員城市和成交價為例，前者若定義為目前城市就跟會員走，後者屬於那筆訂單行；最後比較接回前後的列數與金額。
    points:
    - 先寫粒度和欄位依賴
    - 分清目前屬性與歷史事實
    - 接回核對列數與金額
practice:
- id: sq-db-02-p1
  kind: sql
  category: [model, join]
  title: 接回訂單的目前城市
  minutes: 5
  level: 1
  dataset: shop
  prompt: |
    對 1012 至 1014 的訂單接回 users 的目前城市；缺城市原樣保留。輸出 order_id、user_id、city，依 order_id 升冪。
  solution: |
    SELECT o.order_id, o.user_id, u.city
    FROM orders o LEFT JOIN users u ON u.user_id = o.user_id
    WHERE o.order_id BETWEEN 1012 AND 1014
    ORDER BY o.order_id;
  explain: |
    每張單有一個會員鍵；不以城市相接，也不把會員城市缺值當成失聯。
  hints:
  - 連接使用會員編號
  - 不移除 NULL 城市
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-02-dependency
  - sq-db-01-fk
  tags:
  - 正規化
  - 函數相依
  - 更新異常
- id: sq-db-02-p2
  kind: sql
  category: [model, join]
  title: 拆開商品屬性與成交事實
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    還原訂單 1001 至 1003 的品項，從 products 取 category；模擬 103 號商品現行標價比 price 高 10，其餘不變，顯示為 list_price。從 order_items 保留 unit_price，且用 qty × unit_price 得到 line_amount。輸出 order_id、line_no、category、list_price、unit_price、line_amount，依 order_id、line_no 升冪。
  solution: |
    WITH updated_products AS (
      SELECT product_id, category,
             CASE WHEN product_id = 103 THEN price + 10 ELSE price END AS price
      FROM products
    )
    SELECT i.order_id, i.line_no, p.category, p.price AS list_price,
           i.unit_price, i.qty * i.unit_price AS line_amount
    FROM order_items i JOIN updated_products p ON p.product_id = i.product_id
    WHERE i.order_id BETWEEN 1001 AND 1003
    ORDER BY i.order_id, i.line_no;
  explain: |
    連回商品屬性，但金額來自交易行；不要改用商品標價。模擬改價後，1001 的 103 商品標價是 55，成交單價仍是 45。
  hints:
  - 在 SELECT 區分兩種價格
  - 用明細的複合鍵排序
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-db-02-third
  - sq-db-02-price
  - sq-db-01-pk
  tags:
  - 正規化
  - 函數相依
  - 更新異常
---

客服改了會員的目前地址，卻發現同一人的 3 張訂單各留一份地址，只有一份被更新。如果這欄代表「目前地址」，哪一份才算數？若它代表「當時配送地址」，又不該跟著會員搬家一起改。拆表以前，先寫清楚欄位的時間含義。

## 用鍵問欄位跟誰走

正規化（normalization，大陸也稱範式化）把同一個事實放到合適的表，減少更新異常（update anomaly，例如同一個目前地址只改了一半）。函數相依（functional dependency，台灣也稱函數依賴）可讀成「已知左邊，就能決定右邊」；它來自業務規則，不是今天測到兩欄恰好一樣就算成立。

| 正規形 | 先檢查哪件事 | 茶舖例子 |
| --- | --- | --- |
| 第一正規形（1NF） | 欄位放單一值，不把重複群組塞成字串 | 不把商品塞成「101,102」；每個明細各一列 |
| 第二正規形（2NF） | 非鍵屬性不能只依賴候選鍵的一部分 | 明細鍵是訂單編號加行號，訂單日期只依賴訂單編號，放到訂單表 |
| 第三正規形（3NF） | 典型問題：非鍵屬性透過另一個非鍵屬性依賴主鍵 | 明細有商品編號，分類由商品決定，放在商品表 |

候選鍵（candidate key）是欄位組合中能唯一識別列且無法再刪欄的一組；主鍵是選中的一組。上述表格是拆訂單的檢查順序，不是單靠數欄位便能判斷每一種正規形。像「成交單價」由這個訂單行決定，不是商品當下的標價；即使樣本都同價，把兩者當同一欄仍是錯的。

## 拆完再接回去

在 SQL 練習場選 `shop`。下例讓訂單維持一列一單，再從會員表帶回目前城市。1013 找得到會員，但城市沒有填。對照結果，想想如果將城市空白硬改成「港灣」，你會不會把一張單算進錯誤的城市。

```sql
SELECT o.order_id, u.city
FROM orders o LEFT JOIN users u ON o.user_id = u.user_id
WHERE o.order_id BETWEEN 1012 AND 1014
ORDER BY o.order_id;
```

用同一個習慣檢查拆開的明細：一張明細接一個商品時，連接前後的列數應一樣；若多了，先查商品對照鍵是否唯一，再決定怎麼修。報表可以為速度做去正規化（denormalization），也就是預先整理寬表，但需註明更新來源與時間點。分析表為何常保留冗餘描述，之後在[〈星型與雪花模型〉](#/lesson/sq-model-05)會細講。

## 常見錯誤

- 訂單 1001 連接後只剩一列 → 直接以訂單號去重，吞掉了品項 → 比對訂單號和行號兩欄。
- 商品改價後舊訂單總額變了 → 用了現行標價 → 以明細成交單價乘數量。
- 三張單要改三次目前地址 → 同一事實散在多處 → 將目前地址移到會員表，保留明確命名的歷史配送地址。

## 方言與面試

正規化不綁語法；PostgreSQL 與 MySQL InnoDB 都可用複合主鍵保護拆表後的唯一性。Spark SQL 的檔案型表不可假定會像交易數據庫強制檢查複合鍵，應自己跑重複鍵檢查。拆完後帶走一個能重建報表的查詢，以及一組能證明列數沒有膨脹的核對結果。
