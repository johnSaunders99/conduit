---
id: sq-pattern-05
module: sq-pattern
order: 5
title: 列欄轉換
subtitle: 把三類事件排成三欄
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-04
objectives:
  - "用條件聚合把類別展成固定欄位"
  - "區分類別不存在與整天沒有數據"
  - "把寬表攤回長表並保留零值"
tags:
  - "列欄轉換"
  - "條件聚合"
  - "去重"
resources:
  - title: "DuckDB：Aggregate Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/aggregates"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "找條件式計數與空群組的缺值規則。"
  - title: "MySQL：Flow Control Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 CASE 表達式如何補值或回傳 NULL。"
concepts:
  - id: "sql-pivot-zero"
    prompt: "只見瀏覽的一位用戶，怎樣讓加購欄得到 0？"
    answer: "對每列算 CASE WHEN step = 'cart' THEN 1 ELSE 0 END，再求和。"
    mcq:
      options:
        - "COUNT(step)"
        - "SUM(CASE WHEN step = 'cart' THEN 1 ELSE 0 END)"
        - "先 WHERE step = 'cart'"
        - "改成 GROUP BY user_id, step"
      answer: 1
      explain: "COUNT(step) 會數到瀏覽；WHERE 會把用戶整列濾掉；多按 step 分組也不會替缺類別產生零值。"
    interview:
      question: "報表要求新增未知類別時不改欄位，你會怎麼交付？"
      answer: "固定匯出時我會明定分類清單，未知類別另警示。需要讓圖表自動接受新類別時改交長表，一列一組和一類，不使下游欄位隨數據改變。"
      points:
        - "確定寬表欄位契約"
        - "長表保留類別欄"
        - "區分缺類與缺日"
  - id: "sql-pivot-grain"
    prompt: "按日、按管道分別去重後，兩管道人數能加成全站日活躍嗎？"
    answer: "不能；同日使用兩種管道的人會重複。"
    mcq:
      options:
        - "可以，管道名稱不同"
        - "可以，只要順序相同"
        - "不能，除非已證明用戶集合互斥"
        - "不能，因為人數必為 NULL"
      answer: 2
      explain: "不同類別不代表人互斥；求全站指標需直接在全日用戶集合去重。"
  - id: "sql-pivot-long"
    prompt: "固定兩個管道欄攤回長表，為何要保留 0？"
    answer: "0 表示該日有觀測但該管道沒有用戶；拿掉會讓下游把它誤作未提供。"
practice:
  - id: "sq-pattern-05-p1"
    kind: "sql"
    category: [pivot, aggregate]
    title: "把三種事件排成三欄"
    minutes: 6
    level: 2
    dataset: "events"
    prompt: "從 `app_events` 對 `(event_id, user_id, step)` 去重；保留所有用戶，包括缺會話鍵。每個用戶一列，計瀏覽、加購、付款事件數，缺類別為 0。輸出 `user_id`、`view_count`、`cart_count`、`pay_count`，依 `user_id` 升序。"
    solution: |-
      SELECT user_id,
             SUM(CASE WHEN step = 'view' THEN 1 ELSE 0 END) AS view_count,
             SUM(CASE WHEN step = 'cart' THEN 1 ELSE 0 END) AS cart_count,
             SUM(CASE WHEN step = 'pay' THEN 1 ELSE 0 END) AS pay_count
      FROM (SELECT DISTINCT event_id, user_id, step FROM app_events) e
      GROUP BY user_id ORDER BY user_id;
    explain: "只把命中類別轉為 1，別在 WHERE 把其他類別整列濾掉。e110 重送不能多加一。"
    hints:
      - "先挑出去重鍵，再做 GROUP BY。"
      - "每個類別各寫一個 CASE。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-pivot-zero"
      - "sq-group-06-sum"
      - "sql-funnel-late"
    tags:
      - "列欄轉換"
      - "條件聚合"
  - id: "sq-pattern-05-p2"
    kind: "sql"
    category: [pivot, distinct]
    title: "將管道日活躍還原成長表"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "面試追問：對 `login_at` 每個出現的本地日期，分別算 app 與 web 的不重複用戶數，再交付長表：無用戶的管道也要有 0。輸出 `d`、`channel`（app 或 web）、`active_users`，依 `d`、`channel` 升序。"
    solution: |-
      WITH wide AS (
        SELECT CAST(login_at AS DATE) AS d,
               COUNT(DISTINCT CASE WHEN channel = 'app' THEN user_id END) AS app_users,
               COUNT(DISTINCT CASE WHEN channel = 'web' THEN user_id END) AS web_users
        FROM login_log GROUP BY d
      )
      SELECT d, 'app' AS channel, app_users AS active_users FROM wide
      UNION ALL
      SELECT d, 'web' AS channel, web_users AS active_users FROM wide
      ORDER BY d, channel;
    explain: "條件不符返回 NULL，COUNT DISTINCT 不數它。兩個投影用 UNION ALL 疊成兩列，一天兩列；直接按管道分組會漏掉完全沒有紀錄的那一類。"
    hints:
      - "寬表先算兩個管道欄。"
      - "把各欄展成一個固定標籤和一個值，再合併。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-pivot-long"
      - "sql-pivot-grain"
      - "sql-streak-day"
    tags:
      - "列欄轉換"
      - "去重"
---

## 不改指標，先改結果的形狀

茶舖要下載每位用戶的瀏覽、加購、付款事件數。原表一列一事件；報表想要一人一列、三種事件各一欄，這是**列欄轉換（pivot / unpivot；台灣常說列欄轉置）**。先固定列代表誰，再決定哪些類別變欄。若營運下週新增「領券」，固定匯出仍應有原本三欄，欄位定義不能隨當天的事件悄悄改動。若可視化元件會自己依類別上色，保留類別欄位反而更好。

### 條件聚合（conditional aggregation）

- `CASE WHEN step = 'view' THEN 1 ELSE 0 END`：對每次事件標記是否屬於瀏覽。
- `SUM(CASE ... END)`：在同一用戶組內加總標記，得瀏覽事件數。
- `COUNT(DISTINCT CASE WHEN ... THEN user_id END)`：不符合留下 NULL，數符合且不同的用戶。這不是事件數。

在 [自由練習](#/sql?tab=free) 選 `events`。先核對用戶 12 的瀏覽，把下面查詢的 `DISTINCT` 暫時移除再比較，看看重送帶來哪一列。這個數據集的副本在用戶及步驟上相同；若它們會衝突，就得明說保留哪個版本，而不是靠這組 `DISTINCT` 判斷。

```sql
SELECT DISTINCT event_id, user_id, step
FROM app_events WHERE user_id = 12 ORDER BY event_id;
```

```sql
SELECT user_id,
       SUM(CASE WHEN step = 'view' THEN 1 ELSE 0 END) AS view_count,
       SUM(CASE WHEN step = 'cart' THEN 1 ELSE 0 END) AS cart_count,
       SUM(CASE WHEN step = 'pay' THEN 1 ELSE 0 END) AS pay_count
FROM (SELECT DISTINCT event_id, user_id, step FROM app_events) e
GROUP BY user_id ORDER BY user_id;
```

**缺類不等於缺組。** 用戶有瀏覽卻沒付款，付款欄可填零。完全沒見過的用戶不會憑空出現在結果；需要全體用戶時要從名冊左連接。缺日同理：日期骨架是一張應出現的日期清單，之後在[〈缺日補零〉](#/lesson/sq-pattern-10)會細講。

把寬表攤回長表時，為每個欄位寫一個投影：保留組鍵，新增類別字串，再把值投影成同一個欄名，以 `UNION ALL` 把它們疊起來。驗算：原表有 N 個日期且有兩個固定管道，攤回後恰好 2N 列，沒有活動的管道仍保留 0。用戶可同時出現在兩個管道，兩個欄的用戶數不能加起來當全站日活躍。

**方言。** DuckDB 和 Spark SQL 有 `PIVOT`；MySQL 面試可用本課的 `CASE` 聚合與 `UNION ALL`。Hive SQL 的 `LATERAL VIEW explode` 能將陣列元素展成列，但仍得定義每個元素代表哪個類別和值。

### 驗算表形，也要驗算數值

先只看用戶 12，把去重後的步驟列抄成三個計數，再和寬表的單列核對。對這張事件計數表，在類別互斥且涵蓋全部步驟時，三欄相加會等於去重後的事件數。換成每個類別的「用戶數」就不一定，因為同一人可以在兩類出現。報表最容易錯的不是轉置語法，而是覺得所有數字都可以加。

再想像下週有一類未列入固定欄位。你可以保留固定三欄，另外以檢查查詢列出無法分類的事件；或和使用者約好改交長表。按天重畫時，若某個已觀測的管道當天為零，圖表仍需要一列零；如果當天兩個管道都沒有明細，則要先有日期骨架才會產生那兩列。把「有組無類」與「無組」放進兩個測試，便能找出少的到底是哪一層。

## 常見錯誤

- 加購為零的用戶不見了 → 先把事件過濾成加購 → 把類別判斷移到 `CASE`。
- 去重用戶多了一個 → `COUNT(DISTINCT CASE ... ELSE 0 END)` 把 0 當用戶 → 未命中使用 NULL。
- 回轉長表缺了一個管道 → 從明細只分現有類別 → 固定類別清單，讓每組都展出全部欄。
