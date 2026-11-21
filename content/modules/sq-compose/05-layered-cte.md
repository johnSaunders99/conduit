---
id: sq-compose-05
module: sq-compose
order: 5
title: 多層 CTE
subtitle: 替每層留下可查的結果
status: ready
minutes: 30
level: 1
prereqs:
- sq-compose-04
objectives:
- 在同一句 WITH 依序定義多層結果
- 記下每層輸出鍵與列數
- 用中間輸出找第一個偏差
tags:
- cte
- 分層驗算
- 對帳
resources:
- title: DuckDB：WITH 子句
  url: https://duckdb.org/docs/stable/sql/query_syntax/with
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀多個 CTE 範例，對照中間結果的依賴。
- title: MySQL：WITH 子句
  url: https://dev.mysql.com/doc/refman/8.4/en/with.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀同一句 WITH 下如何列出多個 CTE。
concepts:
- id: sq-compose-05-dependency
  prompt: 如何在同一句查詢中定義兩個普通 CTE？
  answer: 只寫一個 WITH，用逗號隔開定義；先列出後面會依賴的那一層。
  mcq:
    options:
    - 先 SELECT 最終結果再寫 WITH
    - WITH 一次、定義以逗號隔開
    - 每層各寫 WITH 並以分號隔開
    - 把上一層名字放 ORDER BY
    answer: 1
    explain: 分號會結束作用範圍；依賴先列出才能從上到下核對。
- id: sq-compose-05-diagnose
  prompt: 哪一步最適合開始找總額放大的原因？
  answer: 先找第一個不符合預期粒度的中間結果，核對該層使用的鍵。
  mcq:
    options:
    - 去掉最終排序
    - 只看最後一欄的最大值
    - 定位第一層偏離預期的輸出鍵
    - 直接替最後金額除以 2
    answer: 2
    explain: 先定位最早偏差，看到的反例更接近原因。
  interview:
    question: 你會怎麼在交接時留下一段可除錯的查詢？
    points:
    - 明寫每層粒度與依賴
    - 切換最終 SELECT
    - 留一個手算反例
    answer: 我會在每層旁標一列代表什麼。先查一張帶多次退款的單，再把最末 SELECT 依序改讀金額層、退款層、合併層；哪一層開始一單多列就查那一層。
- id: sq-compose-05-later
  prompt: 一個後續步驟怎麼重用已過濾的輸入？
  answer: 直接 FROM 上游 CTE，讓之後的彙總依同一份口徑，不需要複製篩選。
  mcq:
    options:
    - 總是讀回原表
    - 把篩選複製到每個 COUNT
    - 讓排序決定要用哪一層
    - 直接讀上游 CTE
    answer: 3
    explain: 名稱把依賴指出來；讀回原表可能把排除的列帶回來。
- id: sq-compose-05-dedup
  prompt: 每個 event_id 應只有一列，但接收重送時怎麼做到？
  answer: 先按 event_id 選一個代表 raw_id，再回接該接收列；不可把所有欄一起 DISTINCT 就當成事件去重。
  mcq:
    options:
    - 先按 event_id 選代表 raw_id
    - 對全部欄做 DISTINCT
    - 只對 step 做 DISTINCT
    - 依 raw_id 分組算重送
    answer: 0
    explain: 重送可能有不同 raw_id 與 received_at，整列不會相同。
practice:
- kind: sql
  category: [cte, reconcile]
  title: 交付每單的退款對帳欄
  minutes: 6
  level: 1
  dataset: shop
  prompt: |
    用兩層 CTE：先按訂單加總已退款金額，再把合計接回付款單。列出付款單及其退款合計（無退款填 0），命名 `refund_amount`。

    只輸出以下欄位，欄序固定：`order_id`、`refund_amount`。

    排序：`order_id` 升序。
  solution: |
    WITH refund_by_order AS (
      SELECT order_id, SUM(amount) AS refund_amount FROM refunds GROUP BY order_id
    ), paid_orders AS (
      SELECT o.order_id, COALESCE(r.refund_amount, 0) AS refund_amount
      FROM orders AS o LEFT JOIN refund_by_order AS r ON o.order_id = r.order_id
      WHERE o.status = 'paid'
    )
    SELECT order_id, refund_amount FROM paid_orders ORDER BY order_id;
  explain: |
    refund_by_order 對 1021 應只有 15 元的一列；paid_orders 對 1001 則有 0 元的一列。若用內連接，無退款的付款單會被漏掉。
  hints:
  - 退款先聚合成一單一列。
  - 用 CTE 名稱指向已算好的合計。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-05-dependency
  - sq-compose-05-diagnose
  - sq-join-07-left
  tags:
  - cte
  - 對帳
  id: sq-compose-05-p1
- kind: sql
  category: [cte, distinct]
  title: 重送不重算的會員事件盤點
  minutes: 10
  level: 3
  dataset: events
  prompt: |
    對每個 event_id 保留 raw_id 最小的接收列，用它代表一個事件；再計算每位會員的事件數 `event_count` 和付款事件數 `pay_count`。缺會話鍵也計入；所有出現過的會員都要列出。

    只輸出以下欄位，欄序固定：`user_id`、`event_count`、`pay_count`。

    排序：`user_id` 升序。
  solution: |
    WITH keep AS (
      SELECT event_id, MIN(raw_id) AS raw_id FROM app_events GROUP BY event_id
    ), one_event AS (
      SELECT a.user_id, a.step FROM app_events AS a JOIN keep AS k ON a.raw_id = k.raw_id
    )
    SELECT user_id, COUNT(*) AS event_count,
           SUM(CASE WHEN step = 'pay' THEN 1 ELSE 0 END) AS pay_count
    FROM one_event
    GROUP BY user_id
    ORDER BY user_id;
  explain: |
    接收列 26 和 27 代表同一個 e110，保留 26 才按業務事件計數。若在第一層選完代表後用 event_id 接回整表，會把 27 再帶回來。
  hints:
  - 選代表時先按 event_id 分組，得到一個 raw_id。
  - 回接時用唯一的 raw_id。
  - 最後才按會員聚合。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-compose-05-dedup
  - sq-compose-05-later
  - sq-join-07-grain
  tags:
  - cte
  - 事件去重
  - 條件聚合
  id: sq-compose-05-p2
---

值班接到一句「會員事件數比昨天的口徑多了」。若每個人都自己重寫篩選找原因，最後會得到好幾份不能比較的結果。這堂讓查詢保留可檢查的步驟：同一份原始事件，先選代表，再取對應事件，最後才數。要找偏差就換掉最末那個 `SELECT`。

## 一個 WITH，多個命名步驟

- `WITH first_step AS (...), second_step AS (... FROM first_step ...) SELECT ... FROM second_step`：定義之間用逗號，最後一個定義後直接接主查詢。一開始就把依賴的定義排在使用者前面，讀者能照順序驗算。
- 每一層先寫一列代表什麼，再決定鍵。事件去重（deduplication）在本例是「一個事件鍵只保留一份」，不是把每個用戶壓成一列。
- 查錯時保留原定義，暫時切換最後的輸出，看看某個已知鍵出現幾次。例如先看代表鍵，再看回接以後的實際欄位。若某一步已經多列，不必先調整最終計數。

在 SQL 練習場的「自由練習」選 `events` 數據集，執行：

```sql
WITH keep AS (
  SELECT event_id, MIN(raw_id) AS raw_id FROM app_events GROUP BY event_id
), one_event AS (
  SELECT a.event_id, a.raw_id, a.step
  FROM app_events AS a JOIN keep AS k ON a.raw_id = k.raw_id
)
SELECT event_id, raw_id, step FROM one_event WHERE event_id = 'e110';
```

成品只看 `e110`：保留 `raw_id = 26`；27 是重送，不能再回到成品。如果先按事件鍵選好代表，回接卻仍用事件鍵，就會得到 2 列；拿唯一接收鍵接回才保有一個實際接收紀錄。這跟用 `DISTINCT` 對所有欄去重不同，因為接收時間或識別碼本來就可能不同。

你可另核對兩個列數：選代表的結果應等於原表不同事件鍵的個數；代表回接不應再增列。若第二個數變大，先檢查配對用的是事件鍵還是接收鍵。正式報表才把每列的步驟標為付款或非付款，而不是用「有一筆紀錄」直接代表有付款。

普通多層 CTE 可用在 DuckDB、Hive SQL、Spark SQL、MySQL；MySQL 同一查詢層級也只寫一個 `WITH`。移植時別假定每層都被實體保存；要保留驗算結果，需要主動選出或存成另一個產物。

## 交付前留兩個計數

有一個簡單的記錄方式：先寫下「選代表這層應一事件一列」，再寫「從代表回接實際事件不應增列」。先用 e110 的兩個接收號驗一次，再把最後一段換成按會員彙總的輸出。別把用來驗收的單一事件篩選加在最上游後忘了移除，否則整份最終報表可能只反映一個事件。

代表的選擇也是口徑。這道練習用最小接收識別碼，不把它當作一切事件來源永遠最早到達的證明；需要最早時間、還要保留該列其他欄位時，可在[〈ROW_NUMBER〉](#/lesson/sq-window-03)學如何明確選出整列。只要分層時讓口徑顯眼，就能替換其中一層並再次驗算，不必把整份報表打掉重寫。

對一單多退款也可做同樣的階段檢查：注意 1021 的合計應從「多次動作」收成「單一金額」，不是在最後選其中一次。

## 常見錯誤

- 第二層找不到第一層 → 定義應依依賴排列，不在每層之後加分號。
- 去過重又出現重送 → 回接使用會重複的事件鍵；改接被選出的接收鍵。
- 最後數字不合理卻只改 COUNT → 先核對哪一層從「一鍵一列」變成「一鍵多列」。
