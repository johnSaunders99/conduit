---
id: cr-sql-05
module: cr-sql
order: 5
title: SQL 模擬面試
subtitle: 先解釋再用反例守住答案
status: ready
minutes: 25
level: 2
prereqs:
- cr-sql-04
objectives:
  - "在 11 分鐘內完成每城訂單淨額的排名"
  - "用訂單粒度、退款口徑與平手規則解釋查詢"
  - "分別核對欄位、列數、值與輸出排序並留練習紀錄"
tags:
  - "模擬面試"
  - "限時手寫"
  - "Top N"
  - "對帳"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "複習每組固定名額的排名方式。"
  - title: "MySQL：WITH"
    url: "https://dev.mysql.com/doc/refman/8.4/en/with.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "對照先彙總再排名的拆層寫法。"
concepts:
  - id: "sql-mock-sequence"
    prompt: "先算退款後淨額再取每城前 2 張，第一個關鍵中間結果是？"
    answer: "每張合資格訂單一列，淨額已算對。"
    mcq:
      options:
        - "每個商品前兩名"
        - "每張訂單一列的淨額表"
        - "每個城市的退款金額總和"
        - "退款次數最多的前兩筆"
      answer: 1
      explain: "排名對象是訂單，不能在明細粒度排名，也不能先彙總到城市。"
    interview:
      question: "你的題目通過了，你會如何描述測過的部分？"
      answer: "我核對了無退款、多品項與分次退款造成的兩種膨脹，以及城市未知的訂單。再檢查每組至多兩列、同額按訂單鍵排列。這只證明這份樣本行為，若要投產會再測全量、晚到退款和缺失值比例。"
      points:
        - "先核對中間粒度"
        - "具體說明反例及列序"
        - "區分樣本驗證與實際上線"
  - id: "sql-mock-nulls"
    prompt: "缺城市仍要當成一組且最後顯示，哪種做法符合？"
    answer: "保留 NULL 參與分區；最外層把 NULL 排後。"
    mcq:
      options:
        - "在 WHERE 排除 NULL"
        - "保留 NULL，最外層指明排後"
        - "只要在窗口內排序即可"
        - "把 NULL 改成空字串，再用一般升序"
      answer: 1
      explain: "NULL 可在分區中成一組。排除會漏一組；改空字串無法保證排最後，也可能與原本空字串的城市混在一起。"
  - id: "sql-mock-disclose"
    prompt: "口述追問「會不會跑得慢」，尚未測性能時該怎樣答？"
    answer: "說明可檢查接合基數及執行計畫的步驟；不要用小樣本宣稱已量到全量性能。"
practice:
  - id: "cr-sql-05-p1"
    kind: "sql"
    category: [reconcile, join]
    title: "核對二月已付單的淨額底表"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "以 `orders` 的 2026 年 2 月已付款單為範圍。淨額 = 品項件數乘成交單價的合計，減去該單全部退款（不論入帳日）；缺任何一側以 0 計。輸出 `order_id`、`net`，依 `order_id` 升序。"
    solution: |-
      WITH line_totals AS (
        SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
      ), refunds_by_order AS (
        SELECT order_id, SUM(amount) AS refunded FROM refunds GROUP BY order_id
      ), net_orders AS (
        SELECT o.order_id, o.user_id, COALESCE(i.gross, 0) - COALESCE(r.refunded, 0) AS net
        FROM orders o LEFT JOIN line_totals i ON i.order_id = o.order_id
        LEFT JOIN refunds_by_order r ON r.order_id = o.order_id
        WHERE o.status = 'paid' AND o.order_date >= DATE '2026-02-01'
          AND o.order_date < DATE '2026-03-01'
      )
      SELECT order_id, net FROM net_orders ORDER BY order_id;
    explain: "兩側先按訂單聚合再接。用 1042 驗證分次退款不會重計毛額、用 1056 驗證三條品項不會重計退款。"
    hints:
      - "先寫一單一列的品項表與退款表。"
      - "合併後才決定淨額。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-mock-sequence"
      - "sql-audit-fanout"
      - "sql-audit-unique"
    tags:
      - "對帳"
      - "連接膨脹"
  - id: "cr-sql-05-p2"
    kind: "sql"
    category: [top-n, reconcile]
    title: "模擬題：每城挑出兩張最高淨額單"
    minutes: 11
    level: 4
    dataset: "shop"
    prompt: "只看 2026 年 2 月已付款訂單。按上題規則算訂單淨額；在 `users.city` 每組最多取淨額最高的 2 張，同淨額取較小訂單編號。NULL 城市獨立成一組。輸出 `city`、`order_id`、`net`、`pos`（組內位置），依 `city` 升序且 NULL 最後、`pos` 升序。"
    solution: |-
      WITH line_totals AS (
        SELECT order_id, SUM(qty * unit_price) AS gross FROM order_items GROUP BY order_id
      ), refunds_by_order AS (
        SELECT order_id, SUM(amount) AS refunded FROM refunds GROUP BY order_id
      ), net_orders AS (
        SELECT o.order_id, o.user_id, COALESCE(i.gross, 0) - COALESCE(r.refunded, 0) AS net
        FROM orders o LEFT JOIN line_totals i ON i.order_id = o.order_id
        LEFT JOIN refunds_by_order r ON r.order_id = o.order_id
        WHERE o.status = 'paid' AND o.order_date >= DATE '2026-02-01'
          AND o.order_date < DATE '2026-03-01'
      ), ranked AS (
        SELECT u.city, n.order_id, n.net,
               ROW_NUMBER() OVER (PARTITION BY u.city ORDER BY n.net DESC, n.order_id) AS pos
        FROM net_orders n LEFT JOIN users u ON u.user_id = n.user_id
      )
      SELECT city, order_id, net, pos FROM ranked WHERE pos <= 2
      ORDER BY city ASC NULLS LAST, pos;
    explain: "先通過單級淨額才有資格排名；同淨額不放寬筆數，也不能在最外層才加訂單編號當平手規則。"
    hints:
      - "寫下每個 CTE 的粒度：單、單、單、城市內名次。"
      - "保留未知城市，並在最外層寫出 NULL 最後。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-mock-sequence"
      - "sql-mock-nulls"
      - "sq-window-02-sort"
      - "sql-top-fixed"
      - "sql-audit-fanout"
    tags:
      - "Top N"
      - "對帳"
      - "限時手寫"
  - id: "cr-sql-05-p3"
    kind: "explain"
    title: "留下模擬面試的驗收紀錄"
    minutes: 5
    steps:
      - "先錄一輪 11 分鐘紙筆答案；不提前看提示。"
      - "用 90 秒解釋歸屬、數值、排序各一個驗收樣本，再按檢查答案。"
      - "在練習筆記記下時間、提示或解答有沒有用、最先錯的一層與下次重練標籤。"
    checks:
      - "清楚交代退款按訂單日歸屬，不說成現金流。"
      - "各舉一個行為正確和未驗證的部分。"
---

## 一場面試，重點不只最後查詢

今天不做看解答的模擬。用問題「找每城二月淨額最高的 2 張已付款單」練一次完整交付。先確認退款歸原訂單日、同額怎麼取、缺城市是否算一組。說清楚淨額不是實際每日入帳，指標單位仍是「一張訂單」。接著手算一張 2 項合計 120 元、兩次退款合計 15 元的單，淨額應 105；這一筆就能讓兩張明細直接相連的解法失敗。

## 十一分鐘手寫，九十秒答辯

- **第 0–2 分鐘：確認題意。** 紙上記「已付款、左閉右開的二月、每城最多兩張、同額用訂單鍵」。你不必逐字重述題目，但要說清最能改答案的條件。
- **第 2–6 分鐘：先交底表。** 品項與退款各自按訂單聚合，以符合狀態的訂單接合。核對每單仍只有一列，再算淨額。用 1042 核對分次退款、1056 核對多筆品項；兩張單分別能抓到毛額與退款的放大。
- **第 6–11 分鐘：加城市及排名。** 不排除未知城市，按城市分區、淨額降序、編號升序，最後才取前 2 張及整理輸出順序。剩下時間確認排序與題意相符，不改寫整段。
- **計時後：答辯。** 用 90 秒依序說指標和粒度、反例、未測項。若問規模，提出要查執行計畫與真實分區數量，不要用這個小樣本編造耗時。

去 [SQL 練習場](#/sql) 在 **對帳與數據質量** 分類熱身[淨額底表](#/sql/cr-sql-05-p1)，正式做[每城前兩張](#/sql/cr-sql-05-p2)。先獨立核對欄位、結果列數、選出的金額、以及列順序。空城市不該憑空消失，每城不得超過 2 張。若自動檢查通過，仍把最關鍵的樣本與一個沒驗證的情況寫下來。隔天搜尋「限時手寫」找另一題重做，不是重抄今天最終的 SQL。

**方言。** DuckDB 可寫 `NULLS LAST`，MySQL 可在原欄前用 `city IS NULL` 由小到大排序。窗口取名次仍用 CTE 加外層篩選；只換顯示排序，不換分組的空值語義。

### 把答辯拆成已驗證與下一步

可以這樣收尾：「我已手算驗過 1042 的底表；品項毛額 180 元、分次退款共 15 元，淨額是 165 元。本樣本也看到缺城市被當成一組，列在最後。還沒量全量性能，下一步會用執行計畫與接合前後列數核對讀取量和基數。」讀者能分清哪一項是本輪拿到的證據，哪一項只是檢查方向。

追問若改成「第二名同額都留」，不必調整淨額計算層。先解釋哪兩層保持不變，然後改排名函式的平手定義及驗收列數。別還拿「每城最多兩列」判對錯，因為新題允許超出。把這個追問和一筆沒有城市的手算結果記在筆記裡，下次練習就能重演一次從規則到測試的變更。

## 常見錯誤

- 金額對但名次錯 → 沒指定同額規則 → 在窗口排序補訂單鍵。
- 某城只得一列 → 該城可能本來不足兩張 → 從淨額底表查合資格單數，不為了湊兩列補單。
- 測完就說「效能沒問題」 → 小樣本未涵蓋真實規模 → 如實標記尚未驗證。
