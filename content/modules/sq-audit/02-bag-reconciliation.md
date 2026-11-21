---
id: sq-audit-02
module: sq-audit
order: 2
title: 多重集合對帳
subtitle: 兩份結果的重複次數不同
status: ready
minutes: 30
level: 2
prereqs:
- sq-audit-01
objectives:
- 用 EXCEPT ALL 找同鍵多出的接收列
- 用每鍵計數及完整外連接保留單邊鍵
tags:
- 多重集合
- EXCEPT ALL
- 重複次數
resources:
- title: Spark SQL：EXCEPT ALL
  url: https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-setops.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀保留重複數的差集範例。
- title: MySQL：EXCEPT ALL
  url: https://dev.mysql.com/doc/refman/8.4/en/except.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 確認 ALL 與 DISTINCT 在同值多列的行為。
concepts:
- id: sq-audit-02-multiset
  prompt: 原始有三份 X，目標有一份 X，來源 EXCEPT ALL 目標出幾份？
  answer: 2 份；同值抵銷一對後剩 2 份。
  mcq:
    options:
    - 0 份，因目標已出現 X
    - 1 份，因差集必定去重
    - 2 份
    - 3 份，因目標份數不參與
    answer: 2
    explain: 多重集合比次數；普通 EXCEPT 在這裡才會沒有 X。
- id: sq-audit-02-grouped
  prompt: 怎麼在同一列顯示兩邊同鍵各有幾筆？
  answer: 兩邊先各自按鍵計數，再完整外連接，缺少一側的次數以 0 表示。
  mcq:
    options:
    - 先連接原表再各數一次
    - 只連接有出現的鍵
    - 先對來源去重再計數
    - 先聚合，再完整外連接
    answer: 3
    explain: 若左右同鍵各有數筆，直接連接會乘開。
  interview:
    question: 一個事件收兩次，但兩邊事件鍵集合一樣，怎麼查？
    answer: 要看這層要保留接收列還是業務事件。如果兩邊應同粒度，我會比較每鍵次數和差值，再用接收編號回查；若目標本來每事件一列，先把規則和預期差額註明。
    points:
    - 區分接收與業務粒度
    - 比較每鍵次數
    - 帶接收編號供追查
- id: sq-audit-02-sum
  prompt: 總列數相同為何仍需按鍵比較？
  answer: 一個鍵多一份，另一鍵少一份可以抵銷，總數差為零但內容已改。
  mcq:
    options:
    - 一多一少會抵銷
    - 總列數相同就必定每鍵相同
    - 排序可以補回漏列
    - 只有 NULL 會造成此現象
    answer: 0
    explain: 總列數只是總量，不足以定位哪個鍵的次數不同。
practice:
- id: sq-audit-02-p1
  kind: sql
  category: [reconcile, set]
  title: 保留每個多出的接收事件
  minutes: 5
  level: 1
  dataset: events
  prompt: |
    以 app_events 的 event_id 投影作來源；目標為同一來源每個 event_id 各留一次。找來源 EXCEPT ALL 目標的剩餘列，輸出 event_id，依 event_id 字串升冪；若有兩份剩餘，要輸出兩列。
  solution: |
    SELECT event_id FROM app_events
    EXCEPT ALL
    SELECT DISTINCT event_id FROM app_events
    ORDER BY event_id;
  explain: |
    e110 等重送事件多出一份；普通 EXCEPT 找不到已在對方出現的鍵。MySQL 8.4 和 Spark SQL 也支援 EXCEPT ALL。
  hints:
  - 來源不能先 DISTINCT
  - 差集需要 ALL
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-02-multiset
  - sq-audit-01-membership
  tags:
  - 多重集合
  - EXCEPT ALL
  - 重複次數
- id: sq-audit-02-p2
  kind: sql
  category: [reconcile, set]
  title: 列出重送與缺列的差額
  minutes: 8
  level: 3
  dataset: events
  prompt: |
    只核對 raw_id 介於 25 至 29 的接收列。目標模擬每事件保留一次且漏掉 e112。輸出 event_id、src_count、dst_count、delta（來源減目標），只保留差額非零，依 event_id 字串升冪。
  solution: |
    WITH src AS (
     SELECT event_id, COUNT(*) AS n FROM app_events WHERE raw_id BETWEEN 25 AND 29 GROUP BY event_id
    ), dst AS (
     SELECT DISTINCT event_id, 1 AS n FROM app_events
     WHERE raw_id BETWEEN 25 AND 29 AND event_id <> 'e112'
    ), compared AS (
     SELECT COALESCE(s.event_id, d.event_id) AS event_id,
            COALESCE(s.n, 0) AS src_count, COALESCE(d.n, 0) AS dst_count
     FROM src s FULL OUTER JOIN dst d ON s.event_id = d.event_id
    )
    SELECT event_id, src_count, dst_count, src_count - dst_count AS delta
    FROM compared WHERE src_count <> dst_count ORDER BY event_id;
  explain: |
    e110 是 2 對 1，e112 是 1 對 0；只用內連接會漏掉 e112。MySQL 沒有原生 FULL OUTER JOIN，需用左右差異並聯或先造鍵集合。
  hints:
  - 分開算來源、目標
  - 缺少一側的計數用 0
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-audit-02-grouped
  - sq-audit-02-sum
  - sq-audit-02-multiset
  tags:
  - 多重集合
  - EXCEPT ALL
  - 重複次數
---

原始事件交來兩筆 e110，明細只保留一筆。若約定原始層保留每次接收，兩筆是正確的；若約定目標也應保留每次接收，少一筆就是缺數。看見差異後還要問：兩邊約定的一列是不是同一件事？

## 比有幾份，不只比有沒有

多重集合（multiset；也稱 bag）保留相同值的出現次數。假設左邊是 A、A、B，右邊是 A、C：普通差集是 B，`EXCEPT ALL` 則剩 A、B；A 在左右抵銷一份。要看右邊多出什麼，仍要再反過來算一次。差集按你寫出的所有比較欄位判斷相同：只選事件鍵時看鍵的份數，多選一個接收編號就改成比較各次接收。

在 SQL 練習場選 `events`，先對同一事件做下面的核對。原始兩列都有事件鍵 e110，但接收編號是 26 與 27。差集輸出的單列並沒有指出應該丟棄哪一筆；它只是證明左邊比右邊多一份。去重該留哪筆，還是必須另寫規則。

```sql
SELECT event_id FROM app_events WHERE event_id = 'e110'
EXCEPT ALL
SELECT DISTINCT event_id FROM app_events WHERE event_id = 'e110'
ORDER BY event_id;
```

## 想追問題，就把兩側的次數都寫出來

先從兩份輸出各按事件鍵做 `GROUP BY`，得到每鍵的 `COUNT(*)`。用完整外連接（full outer join）接起來，兩側無論誰有列都保留；只在這一步，缺少一側的計數才補 0。這時可同列顯示來源次數、目標次數和差額，不必肉眼對兩張清單。若比對鍵允許空值，先釐清空鍵是非法還是可合併為同一組，不可悄悄把空鍵都當同一個事件。

組合前可以先問兩個反例：總筆數相同但 X 多一份、Y 少一份，方法能不能找出？一個鍵只有來源有，方法會不會因接不上就消失？通過這兩項測試，才把流程套到大量數據。

## 怎麼確認比較的方向和粒度

先用 2 對 1 的小例驗證結果只多出一份，然後故意刪去一個完整事件，看查詢能不能分成「多一份」和「整個事件沒有」。若要讓輸出能追查原始接收，可另用事件鍵回連接收列，但那應該是第二張清單，不要混在每鍵一列的差異表。在正式流程裡，對照數字先由兩邊各得出一組計數，再只比較相同日期與截點的版本。若一份已去重、另一份還是原始層，就應把這些差額記成流程預期，而不是直接當作需要補寫的漏單。

遇到可空鍵，先明定缺值策略再出差額。

## 常見錯誤

- 差集完全看不見重送 → 用的是普通差集 → 改 `EXCEPT ALL`，或各自計數。
- 左右都顯示 6 而不是 3 和 2 → 未聚合就把同鍵接成 3 乘 2 → 先各自分組。
- 缺列完全消失 → 內連接只留共同鍵 → 改完整外連接並補計數。

## 方言與面試

Spark SQL、MySQL 8.4 及 DuckDB 都可用 `EXCEPT ALL`。MySQL 不支援原生完整外連接，可先用 `UNION` 建好兩側的鍵集合，再從這張清單分別左連接兩邊計數。無論語法，交付的差額必須區分「需要重播」、「重送已按規則去掉」和「另一側還沒到齊」。
