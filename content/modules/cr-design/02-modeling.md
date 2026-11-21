---
id: cr-design-02
module: cr-design
order: 2
title: 建模白板題
subtitle: 訂單拆單之後一列代表什麼
status: ready
minutes: 25
level: 4
prereqs:
  - cr-design-01
objectives:
  - 為訂單明細與退款事件分別宣告粒度與鍵
  - 先對齊粒度，再算同單金額與跨日入帳
tags:
  - 事實表
  - 粒度
  - 退款
  - 連接膨脹
resources:
  - title: Kimball Group：維度建模技法
    url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: 2026-11-20
    note: 讀 Declare the Grain 與不同事實表的聚合原則。
concepts:
  - id: cr-design-02-grain
    prompt: 同一訂單有 3 筆品項明細及 2 筆退款，兩張事實表各一列代表什麼？
    answer: 銷售一列是一張單中的一個明細行，退款一列是一次已入帳退款。
    mcq:
      options:
        - 兩者都應一列一天
        - 兩者都以訂單 ID 作單欄唯一鍵
        - 銷售是一筆品項明細，退款是一筆入帳事件
        - 兩者都應一列一個商品分類
      answer: 2
      explain: 兩種業務事件不同，不能為了方便連接消掉本來的粒度。
  - id: cr-design-02-fanout
    prompt: 3 條明細直接以 order_id 連 2 筆退款，中間產生多少列？
    answer: 6 列；每條明細會匹配兩筆退款，每筆退款也被重複到三條明細。
    mcq:
      options:
        - 3 列
        - 5 列
        - 6 列
        - 2 列
      answer: 2
      explain: 一對多乘一對多造成連接膨脹；先各自彙總到目標粒度。
    interview:
      question: 白板上有人讓你加一個退款維度，你怎麼問？
      points:
        - 先確認退款是度量事件還是分類
        - 分清日期口徑
        - 測多明細、多退款的反例
      answer: 我先問要看原單淨額還是退款入帳。退款金額是事件事實，不是一張標籤表。我會拿有 3 筆明細、2 次退款的單驗算，單級各自彙總後再接，按日對帳則讓銷售及退款用各自日期。
  - id: cr-design-02-date
    prompt: 原單日期與退款入帳日不同，兩張報表可以有不同答案嗎？
    answer: 可以；按原單追溯與按入帳日扣款回答不同問題，需把口徑寫明。
    mcq:
      options:
        - 不可以，退款必須回原單日
        - 可以，取決於報表目的
        - 不可以，應一律改成交接日
        - 可以，但不需給日期定義
      answer: 1
      explain: 先讓財務及營運選適用口徑，不能用無說明的同一個淨額欄。
  - id: cr-design-02-allocation
    prompt: 只有訂單級退款，為何不應直接按商品列對外公布退款額？
    answer: 來源未提供退款歸屬；隨意分攤會把未驗證的品項歸屬當成事實。
practice:
  - id: cr-design-02-p1
    kind: explain
    title: 在白板留一次退款反例
    minutes: 7
    steps:
      - 在 C:\dev\conduit-lab\interview\refund-grain.md 畫兩張事實表，標出鍵、金額及日期。
      - 完成下列題，用 1007 和 1042 解釋直接連會分別重複哪一側。
    checks:
      - 訂單 1007：成交 240、退款 10、淨額 230；訂單 1042：成交 180、退款 15、淨額 165。
      - 訂單 1084 的 3 月 1 日只記 5 元退款，不回填到成交日。
  - id: cr-design-02-p2
    kind: sql
    category: [model, join]
    title: 算出兩張已退款訂單的淨額
    minutes: 7
    dataset: shop
    prompt: |
      只算已付款訂單 1007 和 1042。成交額是 `order_items.qty * unit_price` 加總；退款額是 `refunds.amount` 加總，不限退款日期。每單一列，欄位依序 `order_id`, `gross_amount`, `refund_amount`, `net_amount`，按 `order_id` 遞增。
    solution: |
      WITH lines AS (
        SELECT order_id, SUM(qty * unit_price) AS gross_amount
        FROM order_items WHERE order_id IN (1007, 1042) GROUP BY order_id
      ), returned AS (
        SELECT order_id, SUM(amount) AS refund_amount
        FROM refunds WHERE order_id IN (1007, 1042) GROUP BY order_id
      )
      SELECT o.order_id, l.gross_amount, COALESCE(r.refund_amount, 0) AS refund_amount,
             l.gross_amount - COALESCE(r.refund_amount, 0) AS net_amount
      FROM orders o JOIN lines l ON o.order_id = l.order_id
      LEFT JOIN returned r ON r.order_id = o.order_id
      WHERE o.order_id IN (1007, 1042) AND o.status = 'paid'
      ORDER BY o.order_id;
    explain: |
      先各自做到一單一列，再相連。直連會把 1007 的退款 10 元算兩次，把 1042 的成交 180 元算兩次。`SUM(DISTINCT amount)` 或 `DISTINCT` 不能修復真正等額的不同退款。
    hints:
      - 先各寫一份以訂單為鍵的聚合。
      - 淨額要從成交額減去退款額。
    check:
      ordered: true
      columnNames: true
    concepts:
      - cr-design-02-grain
      - cr-design-02-fanout
      - sq-model-02-preaggregate
    tags:
      - 粒度
      - 一對多
  - id: cr-design-02-p3
    kind: sql
    category: [reconcile, time]
    title: 按入帳日記原單的兩次退款
    minutes: 8
    dataset: shop
    prompt: |
      只看已付款訂單 1084。成交額歸 `orders.order_date`；退款額歸 `refunds.refund_date`，以正數顯示。只輸出有成交或退款的日期。欄位依序 `ledger_date`, `gross_amount`, `refund_amount`, `net_amount`，兩類金額該日無值用 0，`net_amount` 是成交額減退款額。按 `ledger_date` 遞增。
    solution: |
      WITH ledger AS (
        SELECT o.order_date AS ledger_date, i.qty * i.unit_price AS gross, 0 AS returned
        FROM orders o JOIN order_items i ON o.order_id = i.order_id
        WHERE o.order_id = 1084 AND o.status = 'paid'
        UNION ALL
        SELECT r.refund_date, 0, r.amount
        FROM refunds r JOIN orders o ON o.order_id = r.order_id
        WHERE o.order_id = 1084 AND o.status = 'paid'
      )
      SELECT ledger_date, SUM(gross) AS gross_amount, SUM(returned) AS refund_amount,
             SUM(gross) - SUM(returned) AS net_amount
      FROM ledger GROUP BY ledger_date ORDER BY ledger_date;
    explain: |
      用 `UNION ALL` 保留所有入帳事件。內連接到銷售的日期會漏掉沒有成交的退款日；`UNION` 有可能消除金額恰好相等的合法事件。
    hints:
      - 給成交與退款各自一欄，不一定要水平相連。
      - 合併事件後，才依入帳日期聚合。
    check:
      ordered: true
      columnNames: true
    concepts:
      - cr-design-02-date
      - cr-design-02-grain
      - cr-design-02-fanout
      - sq-model-02-preaggregate
    tags:
      - 入帳日
      - 退款對帳
---

## 把一張訂單畫成兩種業務事件

面試官說：「畫出可核對大促淨額的模型。」先沿[〈業務過程與粒度〉](#/lesson/sq-model-02)宣告粒度（grain）：每列實際代表哪次事件。成交事實一列是一個已付款訂單明細，鍵是 `(order_id, line_no)`，度量為成交價乘件數；退款事實一列是一次已入帳的退款，鍵為 `refund_id`，度量為退款額。兩者都能保存 `order_id`，卻不能把它當成兩側各自的唯一鍵。維度表則供描述門市、商品、日期；若來源沒有退款分配到商品行的規則，就不要在商品層聲稱知道哪件被退。

## 先演一次錯連接

白板假設有一張單含 3 條成交行、2 筆退款。直接靠 `order_id` 連會得到 6 列，成交額累加兩次、退款額累加三次。`SUM(DISTINCT amount)` 也救不了：兩筆等額退款可能是合法的兩個事件。要做一單一列，先讓成交明細按單加總、讓退款按單加總，再把兩個一單一列的結果連起來。未退款的已付款單仍需保留；左連接沒有退款時按口徑將金額補成 0，而不是把整單丟掉。

## 同樣的淨額，有兩種日期問題

「這張單目前留下多少？」把已確認退款追溯至原單。若問「3 月 1 日收支如何？」則在各自業務日記帳：成交按 `order_date`，退款按 `refund_date`。訂單 1084 的退款跨月，2 月和 3 月各有入帳。這個反例足以請面試官選口徑，再決定以訂單或日期為彙總鍵。在本課用 `shop` 做兩次驗算（內建 DuckDB，可用 RAM 1 GB）；真實職務還會加幣別、稅額、時區和實際結帳規則，這裡先明說不納入。

依 `research/market-report.md` 與 `research/job-evidence.csv` 的製造業 EDW 樣本 4472532306，台灣投「資料工程師」或 EDW／ETL 可拿這張白板當面試材料：指出事實、維度、每個金額來自哪一列，遇到退款歸屬不明時先追來源契約，不虛構精準品項。

## 白板最後補上核對方向

可以在圖上把「每張單只對應一筆訂單主檔」和「每張單允許多行、多退款」標成不同的線。確認條件最好留兩個反例：一張從未退款的已付款單，其淨額應等於成交額；兩筆同額但事件鍵不同的退款，兩筆都應入帳。若事後部分退款被反轉，要依來源另有的退款沖正事件決定是減少退款或新增另一筆調整，不能刪掉原紀錄冒充從未發生。畫到這裡若得不到分配規則，就請面試官說明想看商品層還是單層，不一定要把表做得更複雜。再把每種口徑寫進欄位說明，下游使用者才知道何時會改變昨日的數字。

核對時同時留日期、列鍵和金額，方便將差異追回原始事件。

實際數據集裡，1007 有 2 條成交行、1 筆退款；1042 剛好相反，是 1 條成交行、2 筆退款。先預測各單直連會重複哪一側，再驗算。

## 常見錯誤
- 金額成倍增加 → 兩側未對齊粒度 → 先各自彙總，再檢查每鍵唯一。
- 等額退款被吞掉 → 用金額去重 → 用真正的退款事件鍵。
- 同日淨額被重算到原單日 → 混淆成交與入帳口徑 → 報表明寫日期欄來源。
