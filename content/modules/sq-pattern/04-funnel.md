---
id: sq-pattern-04
module: sq-pattern
order: 4
title: 漏斗轉換
subtitle: 只有依序發生的步驟才算
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-03
objectives:
  - "去除重送並建出會話入口表"
  - "依發生時間找出有效加購與付款"
  - "按入口日期驗證漏斗三層計數"
tags:
  - "漏斗"
  - "事件時間"
  - "去重"
resources:
  - title: "DuckDB：WITH Clause"
    url: "https://duckdb.org/docs/stable/sql/query_syntax/with"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 WITH 基本語法，對照逐階段查詢。"
  - title: "MySQL：Flow Control Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "看查找不成功時如何用 CASE 標記。"
concepts:
  - id: "sql-funnel-order"
    prompt: "view → pay → cart，之後沒再 pay，最遠到哪一步？"
    answer: "cart；沒有晚於有效 cart 的付款。"
    mcq:
      options:
        - "pay"
        - "cart"
        - "view"
        - "沒有入口"
      answer: 1
      explain: "有付款事件不等於合法付款；瀏覽和加購已依序成立。"
    interview:
      question: "如何避免付款早於加購也被算進結果？"
      answer: "我先固定入口瀏覽，再按事件時間找其後最早加購，最後找那次加購之後的付款。每層同會話一列，拿逆序和重送測試。"
      points:
        - "事件時間而非到達順序"
        - "同會話且逐步約束"
        - "未達成者仍保留在入口"
  - id: "sql-funnel-key"
    prompt: "缺會話鍵且沒有補救約定，應怎麼做？"
    answer: "排除在這張會話漏斗之外，再量化缺失。"
    mcq:
      options:
        - "統一填同一個鍵"
        - "每人將缺鍵事件合併成一個會話"
        - "將每一個缺鍵事件視為獨立會話"
        - "排除並量化缺失"
      answer: 3
      explain: "全局填鍵或每人填鍵都可能將不同造訪併在一起；逐一拆開又可能切碎同一造訪。沒約定就不能推斷。"
  - id: "sql-funnel-late"
    prompt: "哪個時間排步驟，哪個決定保留哪次接收？"
    answer: "event_at 排行為；received_at 再以 raw_id 打破平手，決定保留哪個副本。"
practice:
  - id: "sq-pattern-04-p1"
    kind: "sql"
    category: [funnel, interval]
    title: "首個瀏覽後的加購"
    minutes: 7
    level: 2
    dataset: "events"
    prompt: "每個 `event_id` 保留 `received_at` 最早的列，同時取 `raw_id` 最小。排除缺 `session_id` 的事件；每個有瀏覽的 `(user_id, session_id)` 出現一列。輸出 `user_id`、`session_id`、`view_at`（首個瀏覽）、`cart_at`（嚴格晚於瀏覽的首個加購，找不到為 NULL），依 `user_id`、`session_id` 升序。"
    solution: |-
      WITH clean AS (
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
          FROM app_events
        ) e WHERE pos = 1
      ), views AS (
        SELECT user_id, session_id, MIN(event_at) AS view_at FROM clean
        WHERE step = 'view' AND session_id IS NOT NULL GROUP BY user_id, session_id
      ), carts AS (
        SELECT v.user_id, v.session_id, v.view_at, MIN(c.event_at) AS cart_at
        FROM views v LEFT JOIN clean c
          ON c.user_id = v.user_id AND c.session_id = v.session_id
          AND c.step = 'cart' AND c.event_at > v.view_at
        GROUP BY v.user_id, v.session_id, v.view_at
      )
      SELECT user_id, session_id, view_at, cart_at FROM carts ORDER BY user_id, session_id;
    explain: "加購條件放 ON，未達成者仍保留。s9 瀏覽晚到，但 event_at 仍早於加購。"
    hints:
      - "左連接的鍵要包含用戶與會話。"
      - "通過時間條件以後才取最早加購。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-funnel-order"
      - "sql-funnel-key"
      - "sql-funnel-late"
      - "sq-window-03-winner"
    tags:
      - "漏斗"
      - "事件時間"
  - id: "sq-pattern-04-p2"
    kind: "sql"
    category: [funnel, interval]
    title: "依入口日交付三級漏斗"
    minutes: 10
    level: 3
    dataset: "events"
    prompt: "面試追問：按接收時間、raw_id 升序按 event_id 去重，排除缺會話鍵的事件。以每個 `(user_id, session_id)` 的首個 view 日為入口日，數有 view、行為時間嚴格晚於 view 的首個 cart、嚴格晚於該 cart 的 pay 的會話各幾個；可跨午夜。輸出 `entry_day`、`viewed`、`carted`、`paid`，依 `entry_day` 升序。"
    solution: |-
      WITH clean AS (
        SELECT * FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
          FROM app_events
        ) e WHERE pos = 1
      ), views AS (
        SELECT user_id, session_id, MIN(event_at) AS view_at FROM clean
        WHERE step = 'view' AND session_id IS NOT NULL GROUP BY user_id, session_id
      ), carts AS (
        SELECT v.user_id, v.session_id, v.view_at, MIN(c.event_at) AS cart_at
        FROM views v LEFT JOIN clean c
          ON c.user_id = v.user_id AND c.session_id = v.session_id
          AND c.step = 'cart' AND c.event_at > v.view_at
        GROUP BY v.user_id, v.session_id, v.view_at
      ), stages AS (
        SELECT c.user_id, c.session_id, c.view_at, c.cart_at, MIN(p.event_at) AS pay_at
        FROM carts c LEFT JOIN clean p
          ON p.user_id = c.user_id AND p.session_id = c.session_id
          AND p.step = 'pay' AND p.event_at > c.cart_at
        GROUP BY c.user_id, c.session_id, c.view_at, c.cart_at
      )
      SELECT CAST(view_at AS DATE) AS entry_day, COUNT(*) AS viewed,
             COUNT(cart_at) AS carted, COUNT(pay_at) AS paid
      FROM stages GROUP BY entry_day ORDER BY entry_day;
    explain: "先把每個會話壓成一列，三層都用入口日。s5 有付款但沒有加購，不能進入已付層。"
    hints:
      - "各階段限定同一個會話且時間遞增。"
      - "每日總數分別數各層非 NULL 的時間。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-funnel-order"
      - "sql-funnel-key"
      - "sql-funnel-late"
      - "sq-window-03-winner"
      - "sql-retain-numerator"
    tags:
      - "漏斗"
      - "事件時間"
      - "跨日"
---

## 不是收集三個字，而是走完三步

茶舖 App 想知道多少次造訪從瀏覽走到加購再走到付款。漏斗（conversion funnel，也稱轉換漏斗）量的是**依序走到每一步的會話**（session）。如果一個會話有瀏覽、付款、加購，卻沒再付款，只走到了加購。不要因為三種事件都出現過就算完成。這堂先信任現有會話鍵；缺鍵怎樣依閒置時間另切會話，之後在[〈會話切分〉](#/lesson/sq-pattern-09)會細講。

## 先做可以查回去的入口

在 [自由練習](#/sql?tab=free) 選 `events`。`raw_id` 是接收鍵，重送沿用 `event_id`。按接收時間和接收鍵取首列得到固定版本；排行為卻要看事件時間（event time）`event_at`。檢查 `e110` 的兩個副本，去重後只留最早收到的列。缺會話鍵先排除，不能把全站的 NULL 補成同一會話。

```sql
WITH clean AS (
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
    FROM app_events
  ) e WHERE pos = 1
), views AS (
  SELECT user_id, session_id, MIN(event_at) AS view_at FROM clean
  WHERE step = 'view' AND session_id IS NOT NULL GROUP BY user_id, session_id
)
SELECT * FROM views ORDER BY user_id, session_id;
```

每個「用戶、會話」一列，最早瀏覽定為入口。用左連接找加購：同鍵、`step = 'cart'`、`event_at > view_at`。**先通過條件，才取最小時間。** 如果全會話第一次加購在瀏覽前，瀏覽後其實又加購一次，直接取全會話最早加購會把後一次漏掉。取最早的合法加購能讓後續付款有最大的可匹配範圍。沒有合法加購時，付款條件與 NULL 比較不會成立，所以付款也缺值。

```sql
WITH clean AS (
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at, raw_id) AS pos
    FROM app_events
  ) e WHERE pos = 1
), views AS (
  SELECT user_id, session_id, MIN(event_at) AS view_at FROM clean
  WHERE step = 'view' AND session_id IS NOT NULL GROUP BY user_id, session_id
), carts AS (
  SELECT v.user_id, v.session_id, v.view_at, MIN(c.event_at) AS cart_at
  FROM views v LEFT JOIN clean c
    ON c.user_id = v.user_id AND c.session_id = v.session_id
    AND c.step = 'cart' AND c.event_at > v.view_at
  GROUP BY v.user_id, v.session_id, v.view_at
), stages AS (
  SELECT c.user_id, c.session_id, c.view_at, c.cart_at, MIN(p.event_at) AS pay_at
  FROM carts c LEFT JOIN clean p
    ON p.user_id = c.user_id AND p.session_id = c.session_id
    AND p.step = 'pay' AND p.event_at > c.cart_at
  GROUP BY c.user_id, c.session_id, c.view_at, c.cart_at
)
SELECT CAST(view_at AS DATE) AS entry_day, COUNT(*) AS viewed,
       COUNT(cart_at) AS carted, COUNT(pay_at) AS paid
FROM stages GROUP BY entry_day ORDER BY entry_day;
```

驗算先找單列再找總體：會話 `s5` 跨過午夜才付款，但無加購，只能算入口；`s9` 瀏覽晚到，發生仍比加購早。逐日核對付款數不得高於加購數，加購不得高於瀏覽。若要交比例，先說是付款除以全部瀏覽（整體），還是除以加購（階段）。如果需求要「各步在 30 分鐘內完成」，必須再問是各階段相隔 30 分鐘，還是從入口起算最多 30 分鐘；不能用同一條件含糊帶過。

**方言。** DuckDB 可寫聚合 `FILTER`；MySQL 或 Hive SQL 可用 `COUNT(CASE WHEN cart_at IS NOT NULL THEN 1 END)`。已有一會話一列時，本例的 `COUNT(cart_at)` 更直接。Hive／Spark SQL 的 `collect_set` 可列出種類，不能證明順序。

### 抽樣時要看到哪一層開始掉人

把最終查詢暫時改成不按日彙總，只列會話鍵和三個階段時間。先找一個只有入口的會話，再找有加購但沒有有效付款的會話；這兩列都應留著，不同的是哪一個時間開始為 NULL。最後挑一個有三個時間的會話，逐一核對嚴格遞增。若同一時刻的兩種事件在來源沒有可靠的先後，本題不猜順序；若業務能提供可靠的排序鍵，必須明說加入後會怎麼改變「先」的定義。

數據有晚到時，完整結果與當時收到的結果可能不同。先跑完整版本，再假想只看到一個接收截點以前的紀錄，看看哪個入口尚未到。不要為了讓歷史圖形穩定就改用接收時間作為行為時間。這兩者需要各自命名、各自留一份口徑。

## 常見錯誤

- 跳步付款也算成交 → 只比較種類 → 加上上一階段及嚴格時間條件。
- 晚到瀏覽沒配到加購 → 依接收時間排行為 → 改用 `event_at`。
- 瀏覽總數被放大 → 連接加購後留下多列 → 每階段先以 `MIN` 壓回會話粒度。
