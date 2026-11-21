---
id: cl-wh-04
module: cl-wh
order: 4
title: Redshift 架構
subtitle: 查詢慢在節點內還是節點間
status: ready
minutes: 35
level: 3
prereqs:
- cl-wh-03
objectives: ["沿領導節點、運算節點與切片說明一條查詢","用連接鍵預測是否搬移數據","用訂單鍵分布找出傾斜，再檢查是否共置"]
tags: ["Redshift","分布鍵","重分布","數據傾斜"]
resources:
  - title: "Redshift：數倉系統架構"
    url: https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "讀領導節點、運算節點與切片。"
  - title: "Redshift：評估查詢計畫"
    url: https://docs.aws.amazon.com/redshift/latest/dg/c_data_redistribution.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "對照 DS_DIST_NONE、廣播及雙側重分布。"
concepts:
  - id: cl-wh-04-slice
    prompt: "切片（slice）在查詢裡做什麼？"
    answer: "承接節點的一部分記憶體及運算，平行處理分到的數據。"
    mcq:
      options:
        - "替每條 SQL 提供一個獨立帳戶。"
        - "承接節點的一部分記憶體及運算，平行處理分到的數據。"
        - "只負責把字串解析成 SQL。"
        - "把跨區傳輸一律變為節點內操作。"
      answer: 1
      explain: "領導節點協調；切片是節點內的平行工作單位。"
  - id: cl-wh-04-colocate
    prompt: "兩張表以相同相容的鍵值分布，按該鍵 JOIN，主要能減少什麼？"
    answer: "匹配列可能同置於切片，連接時少搬移數據。"
    mcq:
      options:
        - "不必掃描任何表。"
        - "省掉任何形式的聚合。"
        - "匹配列可能同置於切片，連接時少搬移數據。"
        - "保證所有切片負載一樣。"
      answer: 2
      explain: "共置減少 JOIN 交換，不保證無掃描、無後續交換或無傾斜。"
    interview:
      question: "計畫沒有 JOIN 重分布，查詢還是慢，怎麼查？"
      points:
        - "先定位慢階段與每片負載"
        - "檢查熱門鍵及輸出量"
        - "用代表性查詢比較分布方案"
      answer: "我會先看是掃描、某個切片拖尾，還是後續排序與聚合慢。若熱門鍵把大量列塞給一片，即使 JOIN 已共置也先用各切片的數據量及耗時驗證，然後再比較分布方式。"
  - id: cl-wh-04-skew
    prompt: "共用鍵有一個值占將近半數，該鍵做分布時有何風險？"
    answer: "該鍵的大量列落到同一切片，平行工作變得不均。"
    mcq:
      options:
        - "該鍵的大量列落到同一切片，平行工作變得不均。"
        - "同值會平均分散到所有切片。"
        - "只會影響表名查找。"
        - "把排序鍵設成該欄就能保證消除。"
      answer: 0
      explain: "依鍵分布時相同值同置；排序和跨切片分布是不同決策。"
practice:
  - id: cl-wh-04-p1
    title: "畫出熱門會員的訂單分布"
    kind: sql
    category: [top-n, aggregate]
    minutes: 6
    dataset: shop
    level: 2
    prompt: |
      用 `shop` 的 `orders` 統計每個有下過單的 `user_id` 的訂單列數，包含取消單。只列至少 5 筆的會員，欄位依序為 `user_id`、`order_rows`；列按 `order_rows` 降序，再按 `user_id` 升序。
    solution: |
      SELECT user_id, COUNT(*) AS order_rows
      FROM orders
      GROUP BY user_id
      HAVING COUNT(*) >= 5
      ORDER BY order_rows DESC, user_id;
    explain: |
      先分組，再限制哪些計數要呈現。在 WHERE 先按狀態移除取消單就低估分布。如果把會員當分布鍵，熱門值會在同一切片；本題不模擬 Redshift 的雜湊。
    hints: ["門檻檢查的是聚合後的列數。","只有 ORDER BY 才約定輸出順序。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-04-skew","sq-group-03-key","sq-group-04-phase"]
    tags: ["分布鍵","數據傾斜"]
  - id: cl-wh-04-p2
    title: "驗證同一會員的連接與件數"
    kind: sql
    category: [join, aggregate]
    minutes: 9
    dataset: shop
    level: 2
    prompt: |
      從 `shop` 的 `orders` 和 `order_items` 連接訂單鍵，限 `user_id = 1` 及 `paid` 訂單。每筆訂單輸出一列，欄位依序為 `order_id`、`units`（該訂單 `qty` 合計），列按 `order_id` 升序。
    solution: |
      SELECT o.order_id, SUM(i.qty) AS units
      FROM orders AS o JOIN order_items AS i ON o.order_id = i.order_id
      WHERE o.user_id = 1 AND o.status = 'paid'
      GROUP BY o.order_id
      ORDER BY o.order_id;
    explain: |
      以真正的訂單鍵匹配品項，依訂單彙總件數。用 COUNT 只能算品項列，不能算件數。DuckDB 驗連接語義；Redshift 的數據搬移須在該平台以執行計畫驗證。
    hints: ["先寫出兩表共有的連接鍵。","用 SUM 加總 qty，不是計列。"]
    check: {"ordered":true,"columnNames":true}
    concepts: ["cl-wh-04-colocate","sq-group-07-lines","sq-read-02-filter"]
    tags: ["訂單明細","聚合"]
---

## 成本安全：先估數據搬移，不建 Redshift

本堂用 DuckDB 查樣本，讀 Redshift 文件上的計畫標記，不開叢集或 Serverless 工作組。上雲前先查適用優惠、運算方案與儲存、跨區及快照費用，設定試驗期限；停止後依[〈資源清冊與關閉〉](#/lesson/cl-cloud-06)複查。現在先回答：兩張表做 JOIN 時，是數據太大，還是剛好分在不同地方？

Redshift 配置式叢集的領導節點（leader node）接收 SQL、規劃和協調。運算節點（compute node）各有切片（slice），切片分擔所在節點的運算與記憶體，處理分配到的數據。不同切片可同時掃描訂單。若要配對的兩列不在一起，必須先把數據搬到能碰面的切片，這叫重分布（redistribution）；把小表送到多處則稱廣播（broadcast）。網路搬移、掃描和最慢切片是不同的慢點。

## 看兩種分布鍵，不先決定哪個「最快」

分布鍵（distribution key；中國大陸亦稱分佈鍵）指定按哪個欄的值分到切片，並不決定切片內的排序。若訂單與品項以相容的 `order_id` 分布，又以相同鍵連接，匹配列可共置（colocation）。若把訂單按 `user_id`，品項卻按 `order_id`，同一張單的兩側不能保證共置；引擎可能要依查詢計畫移動一側或兩側。Redshift 計畫裡，`DS_DIST_NONE` 表示該連接不重分布，`DS_BCAST_INNER` 表示廣播內側；這些是診斷訊號，不是整條查詢效能保證。

同值共置也有代價：某個會員訂單特別多，可能讓一個切片工作遠多於其他切片，形成數據傾斜（data skew）。先看這個鍵的計數，再問那個鍵是否常作連接。小維表的搬移代價和兩張大事實表不同，不能以一條固定規則替所有表選鍵。

## 本機找出傾斜線索

選 SQL 練習場的 `shop`，先由大到小看各會員承載量，再練習把訂單與品項對齊。只查一位會員也可能有很多品項，勿把品項列當訂單列。

```sql
SELECT user_id, COUNT(*) AS order_rows
FROM orders
GROUP BY user_id
ORDER BY order_rows DESC, user_id
LIMIT 5;
```

頭部的 `user_id = 1` 明顯比其他會員多。這是若按會員分布會失衡的線索，不是實際切片監控。正式評估要用代表性用量，看每片的列數、耗時及連接計畫；再以相同查詢與正確輸出比較提案。

### 做一張比較表，不只看一個計畫標記

選 2 種具有代表性的查詢：一個每天按訂單鍵取明細，一個看特定會員整週的行為。對每種分布方式記錄同一數據量下的數據搬移、最慢切片與整體時間；也記錄載入時間，避免讀取變快但每日寫入成本大增。若兩種負載互相衝突，先以最常見或有明確時限的工作為準，保留其他工作不退化太多的界線。

## 常見錯誤

- 排序後還在搬移 → 排序鍵不是分布鍵 → 查兩表的連接條件及分布方式。
- 計畫顯示共置但仍拖尾 → 熱門值集中 → 查每片負載而非只看平均。
- DuckDB 結果正確就判定不搬移 → 本機沒模擬叢集 → 用 Redshift 計畫核對。
