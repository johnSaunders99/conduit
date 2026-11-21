---
module: "bd-hive"
id: "bd-hive-08"
order: 8
title: "Hive 數據傾斜"
subtitle: "把熱門空鍵隔離計算"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-07"
objectives:
  - "用鍵頻率與 NULL 行為辨認兩種傾斜來源"
  - "將空鍵與有效鍵分流後驗證結果全量保留"
tags:
  - "熱鍵"
  - "NULL key"
  - "UNION ALL"
  - "Hive skew join"
resources:
  - title: "Hive Configuration Properties"
    url: "https://hive.apache.org/docs/latest/user/configuration-properties/"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "查 hive.optimize.skewjoin，再對照適用引擎與版本。"
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Skew Join，對照執行時的證據。"
concepts:
  - id: "bd-hive-08-null"
    prompt: "把所有缺鍵換成同一個預設值有什麼代價？"
    answer: "可能把缺失列變成單一超熱鍵，JOIN 還可能把本不應匹配的列配在一起。"
    mcq:
      question: "普通等值內連接中，兩側鍵都是 NULL 時會怎樣？"
      options:
        - "彼此配對"
        - "不會以普通等值匹配"
        - "一定由廣播解決"
        - "每個空鍵都分到不同區"
      answer: 1
      explain: "普通等值條件遇 NULL 不成立為真；NULL-safe 比較才有不同語意。"
  - id: "bd-hive-08-branch"
    prompt: "何時可把空鍵獨立處理後用 UNION ALL 合回？"
    answer: "在兩支互斥且聯集覆蓋需要保留的數據時；必須維持欄位、匹配規則與重複次數。"
    mcq:
      question: "兩支是缺鍵列與有效鍵列，想保留所有原列，應使用什麼？"
      options:
        - "UNION 去重"
        - "INNER JOIN"
        - "UNION ALL"
        - "DISTINCT 後再取交集"
      answer: 2
      explain: "兩支互斥但各支內可能有合法重複，UNION ALL 保留列。"
    interview:
      question: "Hive JOIN 一個 reducer 跑很久，且缺值很多，你會怎麼查？"
      points:
        - "先看任務讀量與鍵頻率"
        - "確認 JOIN 類型與 NULL 語意"
        - "只分流可安全處理的列並對帳"
      answer: "我先量慢任務讀量和鍵頻率。普通內連接可剔除無法配對的缺鍵；若左連接要留明細，缺鍵走獨立分支並補右側空欄，再和其他列合回，核對列數和鍵。"
  - id: "bd-hive-08-hot"
    prompt: "若不是空值而是熱門正常鍵，加鹽 JOIN 有何陷阱？"
    answer: "不能讓兩邊各自隨機加鹽；常見做法是大側以穩定列鍵分鹽，小側對那個熱鍵擴成各鹽值，並驗證原有配對基數。"
practice:
  - id: "bd-hive-08-p1"
    kind: "sql"
    category: [missing-values, aggregate]
    title: "查出空鍵與熱門會話桶"
    minutes: 5
    level: 2
    dataset: "events"
    prompt: "對 `app_events` 依 `session_id` 分組，把 NULL 保留為一組。輸出依序為 `session_id`、`received_rows`（接收列數），依 `received_rows` 降序，同數按 `session_id` 升序且 NULL 最後。"
    solution: |
      SELECT session_id, COUNT(*) AS received_rows FROM app_events
      GROUP BY session_id ORDER BY received_rows DESC, session_id ASC NULLS LAST;
    explain: "`COUNT(session_id)` 會漏計空鍵組；這裡量接收負載，不先消除重送。計畫是否真的只慢在一區，仍需在 Hive 查實際任務。"
    hints:
      - "COUNT(*) 才計 NULL 組內每一列"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-08-null"
      - "sq-group-01-nulls"
      - "bd-distrib-06-tail"
    tags:
      - "空鍵"
      - "熱鍵診斷"
  - id: "bd-hive-08-p2"
    kind: "sql"
    category: [set, missing-values]
    title: "各走一條路仍保留重送"
    minutes: 7
    level: 2
    dataset: "events"
    prompt: "把 `app_events` 的會話空鍵與有效鍵分別處理後合回：空鍵標 `missing`，其餘標 `known`。輸出 `raw_id`、`event_id`、`route`，按 `raw_id` 升序。不因為 `event_id` 重送而去重；允許以等價 CASE 寫法。"
    solution: |
      SELECT raw_id, event_id, 'missing' AS route FROM app_events WHERE session_id IS NULL
      UNION ALL
      SELECT raw_id, event_id, 'known' AS route FROM app_events WHERE session_id IS NOT NULL
      ORDER BY raw_id;
    explain: "兩支互斥且完整，`UNION ALL` 不做無需求的去重；用 CASE 也能維持這個邏輯結果。本題不模擬 Hive 的實體分支或交換成本。"
    hints:
      - "IS NULL 與 IS NOT NULL 完整切開輸入"
      - "對聯集結果排序"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-08-branch"
      - "bd-hive-08-null"
      - "sq-read-04-missing"
    tags:
      - "分流"
      - "空值"
---

## 單一熱鍵讓其他人都在等

日庫的事件要接上會話表，工作進度很快到九成，最後幾個任務卻卡很久。回到[〈Shuffle 與傾斜〉](#/lesson/bd-distrib-06)的檢查法：在同一階段比較任務讀取量和耗時，確認熱點不是故障節點。再按連接鍵計數，將熱門正常鍵和缺鍵分開看。把缺失會話都寫成 `unknown`，會把原本互不相關的事件強迫送給同一鍵；若維表有一筆同名，就連業務結果也變了。

缺鍵在不同運算不是同一件事。`GROUP BY session_id` 會把 NULL 值放成一組，`COUNT(*)` 能量出這組列數；普通的等值 `JOIN ON a.session_id = b.session_id` 不會配對兩個 NULL。必須保留左表缺鍵列時，不可一律用 `IS NOT NULL` 丟掉：例如 `LEFT JOIN` 的該列仍應出現，右欄補 NULL。若原本採 NULL-safe 相等，空鍵則可能真的配對，不能套同一個分流策略。

## 先分流可以安全分開的列

可把左表「有鍵」與「無鍵」分成互斥分支；有鍵分支按正常規則 JOIN，無鍵分支若在普通左連接下應保留，就直接保留左欄與相同型別的空白右欄，最後 `UNION ALL`。這是追加所有列，不要求引擎去掉合法重複。用兩次 `COUNT` 與核心業務鍵核對總數，別只看時間。若是正常熱鍵造成，聚合可分段；若是 JOIN，可只對熱門鍵用一側分鹽、另一側複製相應鹽值，核對重複配對沒有異常放大。兩側獨立分鹽會漏配。

在 SQL 練習場選 `events`，做兩份結果：先量空鍵和熱門鍵，再檢查分流覆蓋輸入。預留 0.5 GB RAM，不要把這兩個 DuckDB 結果當成 Hive 的效能報告。在 `C:\dev\conduit-lab\bd-hive\skew.md` 記下哪個鍵最多、空鍵筆數、分流後原始接收鍵是否完整。拿重送事件對照一次：它們有相同 `event_id`，但每列的 `raw_id` 不同，不能為了修傾斜擅自改成一筆。

Hive 的傾斜選項和引擎、版本及策略有關。先有異常分區的證據再試，不因為看到某個設定就照抄。若慢的是有效鍵，且維表確實小，可優先考慮廣播（broadcast：將小側送給各執行者）；Spark 的比較在[〈廣播與合併連接〉](#/lesson/bd-spark-08)。

### 為分流設一個反例

想像原左表有兩筆無鍵紀錄，明細欄恰好相同；右表也有一筆 NULL。在普通等值左連接，右邊那筆不該被配上，兩筆左列卻都要保留。用聯集去重會少一筆；用預設鍵填滿兩邊又會多出原本不合法的配對。保持配對與不匹配的區別，才能一面改善搬運、一面保有來源粒度。

最後用實際任務指標比較分流前後，確認重工作變少，而不是由一個慢階段轉移到另一個寫入步驟。若數據太小，不以執行秒數推論提速。

## 常見錯誤

- 用固定預設鍵填滿缺值 → 人為製造熱鍵或假配對 → 依 JOIN 語意另外處理缺值。
- 用 UNION 合回 → 可能刪合法重複 → 兩支互斥時用 UNION ALL。
- 調參後只看平均秒數 → 長尾可能仍在 → 比較最大讀取量、慢任務與結果口徑。
