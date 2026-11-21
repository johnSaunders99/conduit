---
id: cl-contract-06
module: cl-contract
order: 6
title: 交付驗收與停用
subtitle: 舊模型何時才可以退休
status: ready
minutes: 35
level: 3
prereqs:
- cl-contract-05
objectives:
- 用消費者清單、驗收樣本和回退條件判斷是否發布
- 為舊模型規劃並存、通知、切換與停用的先後
- 用 SQL 核對新舊版本在相同口徑下的差異
tags:
- 發布驗收
- 棄用
- 使用者遷移
- 回退
resources:
- title: dbt：版本遷移
  url: https://docs.getdbt.com/docs/mesh/govern/model-versions
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看如何讓消費者固定舊版並有時間遷移。
- title: dbt：deprecation_date
  url: https://docs.getdbt.com/reference/resource-properties/deprecation_date
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀棄用時間、警告與實際移除的差別。
concepts:
- id: cl-contract-06-acceptance
  prompt: 兩個版本總額相同為何仍不能直接發布？
  answer: 總額可能互相抵銷；要比每天、按共同鍵的數值和缺列，還要驗結構和使用方。
  mcq:
    options:
    - 因為只能比較最大值
    - 只能依部署日期
    - 需逐鍵核對並驗實際消費
    - 有一個總額相同就必然相容
    answer: 2
    explain: 總額不能揭露分組錯、欄位改名或行缺失；運作成功也不是驗收。
- id: cl-contract-06-deprecation
  prompt: 公告舊模型棄用日期是否等同於立刻刪表？
  answer: 不等同；公告提供遷移時限，移除仍要按消費者遷移證據與回退窗口決定。
  mcq:
    options:
    - 相同，日期會立即刪除
    - 不同，仍需驗收後停用
    - 沒公告也可以假設沒人在用
    - 棄用期間只能用新版本
    answer: 1
    explain: 到期警告不是清除指令；有依賴未轉不應直接刪除。
  interview:
    question: 你怎麼證明 v1 可以退休？
    answer: 我先列 dbt 依賴與外部消費者，讓各方驗 v2 並確認切換。看交付窗口內的實際讀取和排程，讓回退期跑完才核可停用，留下可回建的定義與證據。
    points:
    - 識別圖內及圖外消費者
    - 有切換與觀察證據
    - 退場與回退分開
- id: cl-contract-06-migration
  prompt: 改名但未改口徑，要把正在用 v1 的報表怎麼遷移？
  answer: 讓 v1 與 v2 並存；更新新欄引用，在同一截止與口徑比較，使用方驗收後切換。
  mcq:
    options:
    - 直接刪 v1 逼遷移
    - 全部使用 SELECT *
    - 改名後無需驗收
    - 並存、對帳、確認切換
    answer: 3
    explain: 先刪舊版會破壞回退；自動跟最新未必讓所有舊查詢相容。
- id: cl-contract-06-rollback
  prompt: 切換後發現舊式匯出中斷，第一步是什麼？
  answer: 依已演練的流程把受影響讀取方導回未停掉的舊版，保留證據再修相容性。
practice:
- id: cl-contract-06-p1
  kind: sql
  category: [dbt, time]
  title: 驗收舊報表的固定日期樣本
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    寫出 2026-01-17 至 2026-01-19（含兩端）已付單日報。依序輸出 `order_date`、`paid_orders`，無已付不補列，日期升序。保留此結果當基準。
  solution: |
    SELECT order_date, COUNT(*) AS paid_orders FROM orders
    WHERE status = 'paid'
      AND order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
    GROUP BY order_date ORDER BY order_date;
  explain: |
    選含取消單的日期可辨認是否誤計。固定區間而不依現在日期，讓不同版本可重跑。
  hints:
  - 先篩選口徑與時間，再依日期分組
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-06-acceptance
  - cl-contract-02-version
  tags:
  - 發布驗收
  - 棄用
- id: cl-contract-06-p2
  kind: sql
  category: [dbt, reconcile]
  title: 找出新版缺日與計算差異
  minutes: 8
  level: 3
  dataset: shop
  prompt: |
    舊版為 2026-01-17 至 2026-01-19（含兩端）每日已付單數；壞掉的新版只覆蓋 1 月 18 至 19 日，且誤計所有單。只列出缺日或數字不同的日期。依序輸出 `order_date`、`old_count`、`new_count`、`issue`，新版缺日標 `missing_new`、舊版缺日標 `missing_old`、有列但數不同標 `different`。缺席側計數保留 NULL，日期升序。
  solution: |
    WITH old_result AS (
      SELECT order_date, COUNT(*) AS n FROM orders
      WHERE status = 'paid'
        AND order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
      GROUP BY order_date
    ), revised AS (
      SELECT order_date, COUNT(*) AS n FROM orders
      WHERE order_date BETWEEN DATE '2026-01-18' AND DATE '2026-01-19'
      GROUP BY order_date
    )
    SELECT COALESCE(o.order_date, r.order_date) AS order_date,
           o.n AS old_count, r.n AS new_count,
           CASE WHEN r.order_date IS NULL THEN 'missing_new'
                WHEN o.order_date IS NULL THEN 'missing_old'
                ELSE 'different' END AS issue
    FROM old_result o FULL OUTER JOIN revised r ON o.order_date = r.order_date
    WHERE o.order_date IS NULL OR r.order_date IS NULL OR o.n <> r.n
    ORDER BY order_date;
  explain: |
    用全外連接保留缺日，先判缺列再比較數字。INNER JOIN 會讓 1 月 17 日消失；填零也會把有零值與沒出列混為一談。MySQL 可先 UNION 取日集合再做兩個 LEFT JOIN。
  hints:
  - 用不同條件建兩個日彙總
  - FULL OUTER JOIN 保留兩邊
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-contract-06-acceptance
  - cl-contract-06-migration
  - sq-model-06-drill-across
  - cl-contract-02-version
  tags:
  - 發布驗收
  - 棄用
- id: cl-contract-06-lab
  kind: build
  title: 做一張有阻擋條件的停用卡
  minutes: 7
  steps:
  - 在 dbt-shop 寫 migration-checklist.md；列兩個下游、通知與切換狀態、對帳證據、回退窗口與可停用條件。
  - 附上 App 壞候選的日期差異，寫出此時的發布決策；不移除現有模型。
  checks:
  - 1 月 17 日為新版缺日，18 日為誤計取消；在這兩處未修復前不得切換。
  - 舊式匯出若未確認遷移或還在回退期，舊版不能停。
---

## 先交付新版，不急著拆舊橋

日報新版把 `paid_orders` 改名為 `paid_count`。分析組的儀表板已更新，但財務每週一下載固定欄位的匯出檔。只看 dbt 模型依賴，很可能漏掉後者。交付驗收（acceptance）要證明使用者能做原本的事；棄用（deprecation）則是告知舊介面要停止支援、讓使用者有時間遷移，不等於馬上移除。

先保留 `report_orders_v1` 和 `report_orders_v2`。新版列明改名、日期範圍與口徑；既有報表暫時固定引用 v1。盤點完整名單：依賴圖內模型、圖外的報表、匯出和定期手寫查詢都可能用到。每個使用方要有切換狀態、驗收時間與誰確認；不要只寫「已通知」就算完成。dbt 可給模型版本設 `deprecation_date` 作棄用資訊與警示；實際下線仍是另一步，不由日期自動刪掉表。

## 設清楚切換與停止條件

1. **發候選**：輸入範圍、截止與舊版相同。確認欄名、型別和固定欄數的消費者，進行按日逐鍵對帳。總額相同仍可能一日多、一日少。
2. **使用方試讀**：讓使用者真的走一次平常的匯出或更新路徑。遇到缺欄、缺日或口徑不同，應停發而不是悄悄放行。
3. **切換與觀察**：記錄回退入口，在至少涵蓋原工作頻率的窗口觀察。週一才執行的工作不能只用一天無讀取當退場證據。
4. **核可停用**：須確認每個使用方完成或明確退出，且回退期已過；保留可重建版本、變更紀錄與相關核准。若試讀失敗，先回前版讀取，再修候選。

在 `shop` 附一份會真的失敗的對帳：壞候選漏掉 1 月 17 日，又在 18 日把取消算進去。17 日舊版 2 筆而新版沒有日期；18 日舊版 1 筆、新版 2 筆。這是不發布的證據；19 日相同不用報成錯誤。DuckDB 用全外連接保住差異，Spark SQL、Hive SQL 也支援這種寫法，MySQL 可用兩方日期的聯集配合左連接。

對帳的證據要跟著版本走。附同一份來源截止、模型定義版、數據測試、日期差異以及外部讀取方的確認，就能分辨「新模型有錯」和「兩次取數時間不同」。遷移若是有意修改口徑，不能用全相等當唯一門檻；改為先列預期差異、可接受門檻、預期之外的阻擋項，並取得使用方確認。

最後問一個具體的回退問題：「如果週一的匯出壞了，同事能在不改一次性 SQL 的情況下重新指定舊讀取入口嗎？」若不知道該入口在哪裡，舊版就不應退休。演練只保存切換說明，不刪表或提早撤權。

回退也要有明確的負責角色。

## 常見錯誤

- 比總額一樣就放行 → 日別差異可能抵銷 → 依共同鍵比缺列和數值。
- 找不到誰還用舊版 → 只看 dbt 血緣 → 追蹤外部排程和實際匯出。
- 到棄用日就刪 → 把通知當遷移完成 → 保留上一版直到證據與回退條件都符合。
