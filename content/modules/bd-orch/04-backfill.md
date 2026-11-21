---
id: bd-orch-04
module: bd-orch
order: 4
title: 回填與補數
subtitle: 只重算受影響的三天
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-03
objectives:
- 從有影響的輸入日推導下游補數日
- 區分重試、自動追趕和指定回填
- 交付含並行上限、驗收及回切條件的補跑單
tags:
- 補數
- 回填
- backfill
- 影響範圍
resources:
- title: Airflow：Backfill
  url: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀重處理策略、併發與試算日期。
- title: Airflow：DAG Runs
  url: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 對照 catchup 與指定區間的補跑。
concepts:
- prompt: 補 01-12 的日表，為何 3 日滾動報表不只補 01-12？
  answer: 若報表讀該日及前 2 日，同一輸入也被 01-13 和 01-14 的窗口使用。
  mcq:
    question: 哪個是受 01-12 單日錯帳影響的最小 3 日滾動輸出集合？
    answer: 2
    options:
    - 01-12
    - 01-10、01-11、01-12
    - 01-12、01-13、01-14
    - 01-11 至 01-15
    explain: 包含 01-12 的向後看 3 日窗口結尾只有這 3 天。更早的輸出看不到新輸入，更晚已滑出窗口。
  id: bd-orch-04-scope
- prompt: 重試、追趕和回填有何不同？
  answer: 重試處理同一次執行，追趕按排程補未建立的歷史區間，回填明確指定要重做的歷史範圍。
  mcq:
    question: 修正公式後要重做已成功的 3 天，應先選什麼？
    answer: 0
    options:
    - 指定回填範圍與重處理策略
    - 重啟排程器即可
    - 只提高重試次數
    - 把下次排程移到現在
    explain: 已成功的歷史 run 不會因一般重試或追趕自動重算；應明確選範圍及重處理策略。
  id: bd-orch-04-run
- prompt: 回填數據為什麼要限併發與先驗小批？
  answer: 避免搶現行作業資源和覆蓋同一日，也先驗證新規則不放大錯帳。
  interview:
    question: 要補 90 天，用什麼順序上線最安全？
    answer: 我先由血緣找最小輸入和下游影響窗口，凍結輸入版本及區間，試算要跑的日期。先低併發跑 1 個代表日對帳，確認重跑不累加、沒有與當班寫同一目標，再分批發布。若驗收超標，停新批並切回上一版。
    points:
    - 依影響推導最小範圍
    - 先試算及小批驗收
    - 限制併發並保留回切
  id: bd-orch-04-guard
practice:
- kind: hands-on
  title: 產生只重做三天的回填單
  minutes: 8
  steps:
  - 按正文章節執行 backfill_plan.py，把三行日期複製到 backfill-plan.md。
  - 註明來源只需修 01-12 日表、滾動輸出需重算哪三天，以及先跑哪一天。
  - 寫下併發先設 1、避免覆蓋當前日報的條件，以及逐日筆數與金額驗收方式。
  checks:
  - 輸出日期為 01-12、01-13、01-14。
  - 計畫區分受影響輸出和供計算讀取的日期，沒有聲稱要重做所有讀入日。
  id: bd-orch-04-p1
---

## 改的是一天，動到的是三張報表

01-12 的原始日表重複算了一筆退款。日表可以只修 01-12，但另一份指標是當日加前 2 天的 3 日滾動總額。因為 01-12 會進入 3 個不同結尾的窗口，補數（backfill，也稱回填）要重算的輸出日期是 01-12、01-13、01-14。01-13 和 01-14 的原始數據未必壞掉，不要把需要讀取的日期誤當需要替換的日期。

重試（retry）用原來參數再做同一次執行。追趕（catchup）依排程補上歷史間隔；指定回填則由你決定範圍和已成功執行是否要重算。兩者都不應由 `now` 猜日期。遇到每天產物讀前一天結果的任務，要問影響會延伸多久；若前值向後逐日傳遞，不能只照三天窗口的規則。

## 先試算日期，不直接重跑整月

在 `C:\dev\conduit-lab\orch-lab` 存成 `backfill_plan.py`，執行 `py backfill_plan.py`，預留 1 GB，不開排程器。標出單一輸入日落在哪些窗口，不去寫實際報表。

```python
from datetime import date, timedelta

changed = date.fromisoformat("2026-01-12")
window = 3
for offset in range(window):
    output_day = changed + timedelta(days=offset)
    start = output_day - timedelta(days=window - 1)
    end = output_day + timedelta(days=1)
    print(f"{output_day}: [{start}, {end})")
```

第一列顯示輸出 01-12 需讀 `[01-10, 01-13)`。把這份清單交給排程器前，先確認日期參數對應的分區、程式版本和預期數據版本。本例沒有互相等待的輸出窗口；若後一天依賴前一天的重算結果，就要按依賴次序執行，不宜任意倒序或全平行。

先以併發 1 跑一個受影響日，限制回填不要和正常排程同時覆寫同一產物。比對來源、修復後日表和下游指標，並留舊版本。若第一個日期不合格，其餘批次先不要放下去。待影響窗口的必要結果到齊，才解除下游延遲標記；下一堂實作 Airflow 圖，先不對正式表提交任何回填。

## 把可停止的點寫在回填單

一份可執行的回填單該寫「先跑 01-12；訂單筆數與帳務清單相同，且退款按鍵差異清空，才進下一批」，而不是只寫「補三天」。如果結果已發布但你後來看到某一天仍有差異，知道該停哪個日期的下游、保留哪個已驗收版本，才不會在爭相修復時產生下一次錯帳。起訖日期也應用排程器認得的時間基準，先檢查它將建立哪些執行，而不是猜測指令的端點是否包含。

另外區分重用舊原始數據和照現在重新抽取。後者可能讀到已修正、已刪除或新增的列，此時差額不一定來自新公式。若驗證目的是證明公式修正有效，先固定同一份輸入版本再比新舊輸出；之後才為最新交易另排一個更新版本。

## 常見錯誤

- **補完日表仍有三日指標不符 →** 只看一層；按時間窗口推導受影響的輸出。
- **回填與日常作業互相覆寫 →** 無優先順序與上限；限併發並避免同日重疊寫入。
- **同月全部重算但找不到差 →** 沒做最小日期試算；先固定版本、輸入與一個代表日。

**重點回顧：**先證明該補哪些日子，再決定怎樣補；完成狀態不能替代對帳。
