---
id: sq-pattern-02
module: sq-pattern
order: 2
title: 連續登入
subtitle: 同一天登入兩次不能多一天
status: ready
minutes: 30
level: 2
prereqs:
- sq-pattern-01
objectives:
  - "先去重至每用戶每天一列"
  - "寫出連續段的起日、迄日與長度"
  - "以跨月和重複登入驗證最長連續段"
tags:
  - "連續登入"
  - "窗口函式"
  - "去重"
resources:
  - title: "DuckDB：Window Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/window_functions"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 ROW_NUMBER 的分區與排序語義。"
  - title: "DuckDB：Date Functions"
    url: "https://duckdb.org/docs/stable/sql/functions/date"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "對照日期與整數相減的回傳類型。"
  - title: "MySQL：Date and Time Functions"
    url: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html"
    kind: "doc"
    lang: "en"
    minutes: 4
    required: false
    checked: "2026-11-20"
    note: "對照 DATE_SUB 與 DATEDIFF 的參數。"
concepts:
  - id: "sql-streak-day"
    prompt: "算連續登入前，同一用戶同一天兩次應保留幾列？"
    answer: "1 列；粒度是用戶日，不是登入事件。"
    mcq:
      options:
        - "0 列"
        - "2 列"
        - "1 列"
        - "每個管道各 1 列"
      answer: 2
      explain: "去重只看用戶與日期；管道不改變登入天數。"
    interview:
      question: "重複登入加上跨月怎麼算最長連續？"
      answer: "我先只保留用戶和登入日期，再按用戶排日期。日期減序號在連續段內不變，分段後取首日、末日及筆數。會用同日兩次和月底隔天測試。"
      points:
        - "事件時間取日和去重"
        - "說清連續段鍵不變的理由"
        - "用反例驗證邊界"
  - id: "sql-streak-island"
    prompt: "日期加 1 天且序號加 1，日期減序號的值會怎樣？"
    answer: "相同，兩列同屬一段。"
    mcq:
      options:
        - "增加一天"
        - "相同"
        - "跨月會歸零"
        - "只在本週相同"
      answer: 1
      explain: "日期相減走日曆，不看日號或週界。遇到缺日才換鍵。"
  - id: "sql-streak-best"
    prompt: "兩段一樣長，只交一段時怎樣令答案唯一？"
    answer: "在長度降序後加起日升序等明定的平手規則，再取第一。"
practice:
  - id: "sq-pattern-02-p1"
    kind: "sql"
    category: [streak, window]
    title: "會員一號的所有連續段"
    minutes: 6
    level: 2
    dataset: "logins"
    prompt: "只看 `user_id = 1`，按 `login_at` 的本地日期去重。找出所有連續登入段，單日也算。輸出 `start_day`、`end_day`、`streak_days`，依 `start_day` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log WHERE user_id = 1
      ), numbered AS (
        SELECT user_id, d,
               d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INTEGER) AS island
        FROM days
      ), segments AS (
        SELECT user_id, MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*) AS streak_days
        FROM numbered GROUP BY user_id, island
      )
      SELECT start_day, end_day, streak_days FROM segments ORDER BY start_day;
    explain: "段長等於去重後的列數。若先排名才去重，單日多登會讓日期減序號在同一天就產生兩個值。"
    hints:
      - "只投影用戶與日期再 DISTINCT。"
      - "日期減序號相同的列落在同一組。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-streak-day"
      - "sq-group-05-entity"
      - "sql-streak-island"
    tags:
      - "連續登入"
      - "窗口函式"
  - id: "sq-pattern-02-p2"
    kind: "sql"
    category: [streak, top-n]
    title: "每位會員最早的最長連續段"
    minutes: 9
    level: 3
    dataset: "logins"
    prompt: "面試追問：每個有登入的用戶只交一段最長連續登入；同長取起日最早的一段。用 `login_at`，不按月切段。輸出 `user_id`、`start_day`、`end_day`、`streak_days`，依 `user_id` 升序。"
    solution: |-
      WITH days AS (
        SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
      ), numbered AS (
        SELECT user_id, d,
               d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INTEGER) AS island
        FROM days
      ), segments AS (
        SELECT user_id, MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*) AS streak_days
        FROM numbered GROUP BY user_id, island
      ),
      picked AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY user_id ORDER BY streak_days DESC, start_day
        ) AS pos FROM segments
      )
      SELECT user_id, start_day, end_day, streak_days FROM picked WHERE pos = 1
      ORDER BY user_id;
    explain: "第一次排序用於分段，第二次用於挑段；只取 MAX(streak_days) 會丟掉那段日期，同長也不能任選。"
    hints:
      - "先交出每個用戶的所有段。"
      - "取段時再套用固定名額的 Top N。"
    check:
      ordered: true
      columnNames: true
    concepts:
      - "sql-streak-day"
      - "sq-group-05-entity"
      - "sql-streak-island"
      - "sql-streak-best"
      - "sq-window-03-filter"
      - "sql-top-fixed"
    tags:
      - "連續登入"
      - "Top N"
      - "窗口函式"
---

## 先把登入換成日曆上的記號

會員在 1/30 登入兩次、1/31 登入一次、2/1 登入一次、2/3 再登入。第一段長 3 天，第二段長 1 天。**日期跨月不斷，沒有登入的 2/2 才讓它斷開。** 如果營運用這張表發放連續登入獎勵，多算一天不只是差一格報表，也會給錯獎勵。

在 [自由練習](#/sql?tab=free) 選 `logins`。先決定輸入粒度（grain）：每列是同一個人某天有登入，不是每次按下登入。`login_at` 是本地時間，`received_at` 是收到紀錄的時間；延遲接收不能把登入移到隔天。執行下面這段，核對同人同日只出現一次。要回查登入次數時，再回到原始數據，不要把次數塞到這層。

```sql
SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log ORDER BY user_id, d;
```

### 用日期減序號辨認連續段

- `CAST(login_at AS DATE)`：丟掉時分秒，只留下日曆日期。
- `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d)`：每位會員自己的序號。
- `d - CAST(序號 AS INTEGER)`：往前移序號那麼多天。段內日期與序號逐列各加 1，差不變；一旦跳日，序號只加 1，差就變了。

用紙把剛才的 4 個日期寫左欄，右欄寫 1 至 4。前三列的差都是 1/29；最後一列的差是 1/30。這就是間斷與連續段（gaps and islands）的段鍵。它不是實際起日，不能直接交給營運；真實起日由同段最小日期取得。不同會員可能有同一個段鍵，所以要同時按會員與段鍵分組。

```sql
WITH days AS (
  SELECT DISTINCT user_id, CAST(login_at AS DATE) AS d FROM login_log
), numbered AS (
  SELECT user_id, d,
         d - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) AS INTEGER) AS island
  FROM days
), segments AS (
  SELECT user_id, MIN(d) AS start_day, MAX(d) AS end_day, COUNT(*) AS streak_days
  FROM numbered GROUP BY user_id, island
)
SELECT * FROM segments ORDER BY user_id, start_day;
```

結果的每列是一段。要回答「每人最長的一段」，在這一層結束後才另做排名，依段長由大到小、起日由早到晚挑選。驗算時抄出某段的起迄日，手算日曆差再加 1，應等於段長；再用跨月的兩列看它們是否被分到同一段。如果題意問的是「截至昨天還沒斷的那段」，先限制段末日是昨天，不取歷史最長。只有一天的人也有一段，不應在基礎段表消失。

**方言。** DuckDB 的 `DATE - INTEGER` 按天退回；Hive SQL／Spark SQL 可用 `date_sub(d, n)`，MySQL 用 `DATE_SUB(d, INTERVAL n DAY)`。驗算天數用 DuckDB 的 `date_diff('day', start_day, end_day)`；另三者的 `DATEDIFF` 是迄日在前。

### 如果不用日期減序號

可以先找每列的前一個登入日，用 `LAG(d) OVER (PARTITION BY user_id ORDER BY d)`。首列、或前一日加一天仍不等於當日，就標 1；連續的列標 0。按同一順序把旗標做前綴和，也就是從該用戶首列加到當列，便得到段號。這個寫法稍長，但如果規則將來改成「相隔不超過 2 天也算同段」，改比較條件即可，不必重新推導段鍵。之後在[〈會話切分〉](#/lesson/sq-pattern-09)會用同樣的思路切時間戳，而不只切日期。

抽一段驗收時，不要只看最長結果。先挑兩個同日事件，證明去重後只剩一列，再從兩段之間找一個沒有登入的日期。這兩步分別證明沒有多計和沒有誤接。若面試要回答為何分兩個窗口，指出第一個按日排名產出段鍵，第二個是在段已聚合後才有段可排。

## 常見錯誤

- 同一天登入兩次就斷段 → 直接對事件排名 → 先去重到用戶日。
- 一月底必定斷開 → 在窗口多按月份分區 → 只按用戶分區，用完整日期。
- 不同人被併成同一段 → 只按日期差分組 → 加上用戶鍵。
