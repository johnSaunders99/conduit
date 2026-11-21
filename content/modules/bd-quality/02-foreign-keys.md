---
id: bd-quality-02
module: bd-quality
order: 2
title: 參照完整性
subtitle: 明細找不到對應商品
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-01
objectives:
- 用反連接找出孤兒商品鍵
- 區分缺少外鍵、孤兒與維度鍵重複
- 用同一批輸入量化 JOIN 遺失的金額
tags:
- 外鍵
- 參照完整性
- 反連接
- 孤兒列
resources:
- title: PostgreSQL：外鍵約束
  url: https://www.postgresql.org/docs/current/ddl-constraints.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看被參照鍵及 NULL 的處理。
- title: DuckDB：FROM 與 JOIN
  url: https://duckdb.org/docs/lts/sql/query_syntax/from
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 anti join 和 left join。
concepts:
- prompt: 何謂孤兒明細？
  answer: 明細填了外鍵，但在約定的維度或上游表找不到對應鍵；外鍵為 NULL 應另報。
  mcq:
    question: 哪一筆是孤兒商品鍵？
    answer: 3
    options:
    - product_id 為 NULL
    - product_id 103 在商品表有兩列
    - product_id 103 在商品表有一列
    - product_id 999 不在商品表
    explain: 只有鍵存在卻找不到參照是孤兒。缺值與被參照鍵重複屬其他規則。
  id: bd-quality-02-orphan
- prompt: 為何應在 INNER JOIN 之前查孤兒？
  answer: INNER JOIN 先移除了未匹配明細；結果看不出少掉哪些列或金額。
  mcq:
    question: 要保留缺對象的明細，哪種查詢條件最直接？
    answer: 0
    options:
    - 非空外鍵且 NOT EXISTS 匹配
    - INNER JOIN 匹配鍵
    - 對匹配列做 DISTINCT
    - WHERE 外鍵 = NULL
    explain: NOT EXISTS 明確保留找不到匹配的列；內連接會消失，NOT IN 還受 NULL 影響。
  id: bd-quality-02-join
- prompt: 孤兒為零就能證明連接沒問題嗎？
  answer: 不能；被參照鍵有重複時，正常明細會被放大。要另外驗證右表鍵唯一。
  interview:
    question: 商品維度晚到造成明細查不到，你會直接丟掉嗎？
    answer: 先保留原明細與缺鍵樣本，查是來源錯碼還是維度晚到。若規格允許暫用未知類別，就明標原因並補修；財務不允許缺歸屬就擋發布。還會驗維度鍵唯一，避免補齊後把金額乘大。
    points:
    - 保留原始事實與診斷理由
    - 晚到與錯碼的決策
    - 檢查連接放大
  id: bd-quality-02-dimension
practice:
- kind: sql
  category: [join, reconcile]
  title: 列出孤兒、不把缺欄混在一起
  minutes: 5
  dataset: shop
  prompt: 建立小批：`order_items` 中 1001 的全部列（欄位 `order_id, line_no, product_id`），再加 `(1001,3,999)` 與 `(1001,4,NULL)`。列出非 NULL、但在
    `products` 不存在的商品鍵。欄序 `order_id`、`line_no`、`product_id`，按前兩欄遞增。
  solution: |-
    WITH incoming AS (
      SELECT order_id, line_no, product_id FROM order_items WHERE order_id = 1001
      UNION ALL SELECT 1001, 3, 999
      UNION ALL SELECT 1001, 4, NULL
    )
    SELECT i.order_id, i.line_no, i.product_id
    FROM incoming i
    WHERE i.product_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM products p WHERE p.product_id = i.product_id)
    ORDER BY i.order_id, i.line_no;
  explain: 結果只保留 1001/3/999。`NOT EXISTS` 只檢查匹配，若不另排除空鍵，缺鍵列也會被算成孤兒。DuckDB 的 `ANTI JOIN` 也可用；MySQL 通常寫 `NOT EXISTS` 或左連接。
  hints:
  - 先定義有填外鍵，再問右表是否存在
  concepts:
  - bd-quality-02-orphan
  - bd-quality-02-join
  - sq-join-06-anti
  tags:
  - 孤兒鍵
  - 反連接
  check:
    ordered: true
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-02-p1
- kind: sql
  category: [reconcile, join]
  title: 量化內連接少掉的錢
  minutes: 5
  dataset: shop
  prompt: 從 `order_items` 取訂單 1001 的商品鍵及金額（`qty * unit_price`），再加 `(999, 40)` 當孤兒商品的一列金額。比對這批完整金額與 INNER JOIN `products` 後的金額，輸出一列：`raw_amount`、`joined_amount`、`lost_amount`（前者減後者）。不要求排序。
  solution: |-
    WITH incoming AS (
      SELECT product_id, qty * unit_price AS amount FROM order_items WHERE order_id = 1001
      UNION ALL SELECT 999, 40
    )
    SELECT (SELECT SUM(amount) FROM incoming) AS raw_amount,
           SUM(i.amount) AS joined_amount,
           (SELECT SUM(amount) FROM incoming) - SUM(i.amount) AS lost_amount
    FROM incoming i JOIN products p ON p.product_id = i.product_id;
  explain: 輸入 265 元，內連接後 225 元，少 40 元。不能用內連接的結果同時當前後兩個分母；本題假設商品鍵唯一。
  hints:
  - 先用一個子查詢取得未連接的合計
  concepts:
  - bd-quality-02-join
  - bd-quality-02-dimension
  - bd-quality-01-grain
  tags:
  - 對帳
  - 外鍵
  check:
    ordered: false
    columnNames: true
    mode: result
    allowEmpty: false
  id: bd-quality-02-p2
---

## 找不到商品，不表示那筆成交不存在

訂單明細寫著商品 999，商品表卻只有 101 到 108。如果報表先做內連接（inner join），商品 999 那筆會整列消失；看板就少了金額，並不一定有錯誤訊息。**參照完整性（referential integrity）**要求明細上的外鍵（foreign key）若有值，能找到約定版本的被參照列。找不到的列常稱**孤兒列（orphan row）**。外鍵本身沒填則屬非空或其他業務規則，不是同一原因。

有些數據庫會在交易中強制外鍵約束，但落地檔、跨系統匯入和部分數倉不一定如此。即使產品平台支援宣告，仍要查是否真的強制。商品晚到不是商品錯碼，處置也不同：先留失敗的事實列和原因；能否暫歸「未知商品」、後續是否補齊，必須由報表規格決定。若維度按歷史版本保留多列，要用同一業務鍵與有效期間比對，不能只因找到任何一列就放行。

## 先用反連接看缺口

反連接（anti join）保留左邊有、右邊找不到的列。可以用 `NOT EXISTS`：對每筆明細問商品表「有沒有同一個鍵」。另一寫法是從明細做左連接，再找右表應有的鍵為 NULL；右表原本可為 NULL 的普通欄位不能當作未匹配證據。`NOT IN` 若子查詢含 NULL，可能讓原本應取出的列也被排除，可回看[〈半連接與反連接〉](#/lesson/sq-join-06)。

在 SQL 練習場選 `shop`，無容器，預留 1 GB。下面為同單多補一條未知商品，不寫入表。結果是一筆 1001、999。

```sql
WITH incoming AS (
  SELECT order_id, product_id FROM order_items WHERE order_id = 1001
  UNION ALL SELECT 1001, 999
)
SELECT i.order_id, i.product_id
FROM incoming i
WHERE i.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.product_id = i.product_id);
```

孤兒數是 0 也還不是發布證明。如果商品 103 在商品表有兩列，訂單 1001 的第 1 筆明細會連上兩次，金額反而變大。正式檢查要分開記「明細缺鍵、非空外鍵未匹配、右表鍵重複」；再用同批前後的列數和金額衡量影響。

## 哪些金額可以延後，哪些不可交付

若這張報表只按訂單合計，可先把沒有維度的金額列在未歸類欄，總額仍守住；若報表要核發個別商品的獎金，未歸類列就可能造成錯付，應先擋住。做選擇時留下「缺哪個商品鍵、有哪些營業日、涉及多少金額」，並在維度補齊後驗證同一批，不用任意挑一個相似商品鍵代替。隔離和補修會在[〈隔離與例外清單〉](#/lesson/bd-quality-05)細講。

另外，參照契約的時間點要與事實一致。假如今天的商品清單停止販售某品項，過去已銷售的明細仍可能合法；不能用今天的活動清單來聲稱歷史訂單都是孤兒。先閱讀維度是保留歷史還是只保留目前，再挑會驗出真異常的查詢。

## 常見錯誤

- **報表變少卻找不到缺哪筆 →** 已由內連接刪掉證據；先用反連接列出原明細。
- **孤兒清單混入缺鍵 →** 只寫了不存在；另外判斷外鍵是否有值。
- **補了維度之後金額翻倍 →** 維度鍵不唯一；確認粒度及有效版本再連接。

**重點回顧：**驗證的是可參照、且只參照到正確的一列，不只是看 JOIN 有沒有執行成功。
