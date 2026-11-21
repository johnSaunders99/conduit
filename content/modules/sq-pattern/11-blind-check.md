---
id: sq-pattern-11
module: sq-pattern
order: 11
title: 分層驗算與盲寫
subtitle: 用五列反例挑戰自己的答案
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-10
objectives:
  - "用五列手算連接膨脹的反例"
  - "在每層用鍵的唯一性定位多算來源"
  - "盲寫訂單淨額並按日核對總數"
tags:
  - "對帳"
  - "連接膨脹"
  - "盲寫"
resources:
  - title: "DuckDB：WITH Clause"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/with"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習將明細按鍵彙總後再接合。"
  - title: "MySQL：WITH"
    url: "https://dev.mysql.com/doc/refman/8.4/en/with.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看 MySQL 如何在同一 WITH 定義多層。"
concepts:
  - id: "sql-audit-fanout"
    prompt: "一張單有 2 筆商品明細、2 筆退款，兩張明細直接按單接合是幾列？"
    answer: "4；每個品項會配上每次退款。"
    mcq:
      options:
        - "1"
        - "2"
        - "3"
        - "4"
      answer: 3
      explain: "是兩兩配對，不是兩張表的列直接相加。"
    interview:
      question: "淨額比對不起來，會從哪裡查？"
      answer: "我先固定每張已付款單一列，各自核對品項總額和退款總額，才合併算淨額。用兩品項兩退款證明直接接合會膨脹，再驗證按日加回來能對上。"
      points:
        - "能解釋各層粒度"
        - "有對照的手算反例"
        - "驗證總額與明細"
  - id: "sql-audit-unique"
    prompt: "兩條品項價格都是 60 元，SUM(DISTINCT 金額) 可以修接合倍增嗎？"
    answer: "不可以；它也會把合法的同金額品項漏算。"
    mcq:
      options:
        - "可以，只要是整數"
        - "可以，同金額一定重複"
        - "不可以，應先按正確業務鍵彙總"
        - "不可以，應移除所有同價品項"
      answer: 2
      explain: "金額不是品項鍵。一張單的兩件品項價格相同依然是兩筆。"
  - id: "sql-audit-blind"
    prompt: "盲寫開始前先記下哪三件事？"
    answer: "輸出粒度、各層唯一鍵、能讓錯解失敗的最小反例。"
practice:
  - id: "sq-pattern-11-p1"
    kind: "sql"
    category: [reconcile, join]
    title: "核對單筆訂單的明細總額"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "只看編號 1020 到 1023 的已付款訂單（含首尾）。一單一列，數明細筆數、加總件數乘成交單價；沒明細為 0。輸出 `order_id`、`line_count`、`gross`，依 `order_id` 升序。"
    solution: |-
      SELECT o.order_id, COUNT(i.line_no) AS line_count,
             COALESCE(SUM(i.qty * i.unit_price), 0) AS gross
      FROM orders o LEFT JOIN order_items i ON i.order_id = o.order_id
      WHERE o.status = 'paid' AND o.order_id BETWEEN 1020 AND 1023
      GROUP BY o.order_id ORDER BY o.order_id;
    explain: "先從訂單決定範圍，不能用 DISTINCT 金額替代按明細逐筆加總。取消單 1022 就算有明細也不列。"
    hints:
      - "先判定哪些訂單可出現在結果。"
      - "明細筆數用非空的 line_no 計算。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-audit-unique"
      - "sql-audit-blind"
      - "sql-retain-numerator"
    tags:
      - "對帳"
      - "連接膨脹"
  - id: "sq-pattern-11-p2"
    kind: "sql"
    category: [reconcile, join]
    title: "把訂單淨額按日對帳"
    minutes: 10
    level: 3
    dataset: "shop"
    prompt: "面試盲寫：只看 2026-01-23 至 2026-02-03（含首尾）的已付款訂單。按訂單日認列品項總額 `qty * unit_price`，同單全部退款也歸回訂單日，不限制實際退款日；缺明細或退款算 0，只列有已付訂單的日子。輸出 `order_date`、`gross`、`refunded`、`net`，依 `order_date` 升序。"
    solution: |-
      WITH sales AS (
        SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
      ), credits AS (
        SELECT order_id, SUM(amount) AS refunded FROM refunds GROUP BY order_id
      ), settled AS (
        SELECT o.order_id, o.order_date, COALESCE(s.gross, 0) AS gross,
               COALESCE(c.refunded, 0) AS refunded
        FROM orders o LEFT JOIN sales s ON s.order_id = o.order_id
        LEFT JOIN credits c ON c.order_id = o.order_id
        WHERE o.status = 'paid'
      )
      SELECT order_date, SUM(gross) AS gross, SUM(refunded) AS refunded,
             SUM(gross - refunded) AS net
      FROM settled WHERE order_date BETWEEN DATE '2026-01-23' AND DATE '2026-02-03'
      GROUP BY order_date ORDER BY order_date;
    explain: "各自按單彙總，再按日，避免品項與退款互乘。1042 有 1 條品項與 2 筆退款，直接接合會重計毛額；1035 有 3 條品項與 1 筆退款，則會重計退款。"
    hints:
      - "在紙上先畫兩張以 order_id 唯一的彙總表。"
      - "留意退款歸訂單日，不用 refund_date 分組。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-audit-fanout"
      - "sq-join-07-fanout"
      - "sql-audit-unique"
      - "sql-audit-blind"
      - "sql-fill-count"
    tags:
      - "對帳"
      - "連接膨脹"
      - "盲寫"
---

## 先在紙上讓錯解失敗

營運說淨額比自己手算大。這題的分層驗算（layered validation）不是把同一段查詢跑兩次，而是逐層問「這個鍵現在還唯一嗎？」先寫五列反例：1 張已付款單，2 筆商品各 60 元，2 筆已入帳退款分別 10、5 元。理論毛額 120、退款 15、淨額 105。把兩張明細直接接起來會多出 4 個配對，毛額變 240、退款變 30；用 `SUM(DISTINCT 金額)` 又會把兩件等價品項只加一次。

## 打開中間表驗鍵

在 [自由練習](#/sql?tab=free) 選 `shop`。先跑下方查詢：品項層與退款層各自按訂單彙總，才與已付款名單連接。結果只取幾張可查回去的訂單，其中 1021 有分次退款，1022 是取消單。完整數據上應先檢查合併前的兩個 CTE 是否都只有一個 `order_id`，再看已付款訂單列數有沒有改變。

```sql
WITH sales AS (
  SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
), credits AS (
  SELECT order_id, SUM(amount) AS refunded FROM refunds GROUP BY order_id
), settled AS (
  SELECT o.order_id, o.order_date, COALESCE(s.gross, 0) AS gross,
         COALESCE(c.refunded, 0) AS refunded
  FROM orders o LEFT JOIN sales s ON s.order_id = o.order_id
  LEFT JOIN credits c ON c.order_id = o.order_id
  WHERE o.status = 'paid'
)
SELECT * FROM settled WHERE order_id BETWEEN 1020 AND 1023 ORDER BY order_id;
```

下一步從一單一列改成一日一列。日總的毛額減退款應等於淨額；這只是必要條件，若兩側金額同時翻倍仍會成立。還要核對原始明細抽樣，以及結果列數是否等於有已付款單的日期數。「退款歸訂單日」量訂單最終淨額，「退款歸實際入帳日」量每天的金流。不要在最後一層才悄悄改口徑。

```sql
WITH sales AS (
  SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
), credits AS (
  SELECT order_id, SUM(amount) AS refunded FROM refunds GROUP BY order_id
), settled AS (
  SELECT o.order_id, o.order_date, COALESCE(s.gross, 0) AS gross,
         COALESCE(c.refunded, 0) AS refunded
  FROM orders o LEFT JOIN sales s ON s.order_id = o.order_id
  LEFT JOIN credits c ON c.order_id = o.order_id
  WHERE o.status = 'paid'
)
SELECT order_date, COUNT(*) AS paid_orders, SUM(gross - refunded) AS net
FROM settled GROUP BY order_date ORDER BY order_date;
```

## 蓋住上面的解法再寫一次

盲寫（closed-book practice）先用 2 分鐘寫交付欄、每列意義、包括哪些日期及狀態；接著只用自己的草稿把分層查詢還原。跑完後再找一筆沒有退款的訂單，確認它仍有毛額，退款恰為 0；再找含多筆退款的訂單，核對退款只加一次。留下「我用哪一列推翻初稿」一句，比抄一整份標準答案更值得下次看。

**方言。** MySQL、Hive SQL、Spark SQL 都能用 `WITH` 和 `LEFT JOIN` 保持這個查詢形狀。若習慣在 DuckDB 用聚合 `FILTER` 數符合狀態的列，MySQL 改成 `COUNT(CASE WHEN ... THEN 1 END)`，或先用獨立 CTE 分出已付款單。

### 檢查結果時，先問哪個條件可以推翻它

把草稿分成「能決定訂單名單的條件」、「每單的兩欄金額」、「每日匯總」三段。先查取消單是否已排除，再核對 1042 的 1 條品項和 2 筆退款，以及 1035 的 3 條品項和 1 筆退款。最後核對 2/3 有 1042、1043 兩張已付單。若只在日匯總看到差額，便回頭找哪張單的欄位不同；不需要改好幾處才試一次。這個順序也能向面試官展示你先找原因，再處理症狀。

若有人說直接相連也得到這個小樣本的總數，請挑一張缺退款的單和一張兩邊都有多列的單分別對帳。有時某些單漏算、另一些又翻倍，剛好互相抵銷；帳面總額相等不能證明每個訂單對。交付前把有用的反例留在練習筆記，下次遇到訂單、優惠券和退款三張明細時，可以不重想該怎麼開始測。

## 常見錯誤

- 金額成倍增加 → 兩張多列明細太早接合 → 兩側先按訂單聚合。
- 沒退款的已付款單消失 → 使用內連接 → 改左連接並補零。
- 毛額明細和日報都自洽但與入帳不同 → 混淆退款日與訂單日 → 先定歸屬再核對。
