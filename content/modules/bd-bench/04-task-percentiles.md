---
id: bd-bench-04
module: bd-bench
order: 4
title: 任務分位數
subtitle: 平均三秒可能藏著兩分鐘長尾
status: ready
minutes: 35
level: 3
prereqs:
  - bd-bench-03
objectives:
  - 依最近秩法算出 p50、p95 並保留最大值
  - 用任務時間搭配輸入與 Shuffle 讀量提出可驗證假設
tags:
  - 任務分位數
  - p95
  - 長尾
  - Shuffle Read
resources:
  - title: Apache Spark：Web UI
    url: https://spark.apache.org/docs/latest/web-ui.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Stages Detail 的分位數與逐任務指標。
concepts:
  - id: bd-bench-04-rank
    prompt: 最近秩法的 p95 在 20 筆中取哪一筆？
    answer: 由小到大排序後取第 19 筆，以 ceil(0.95 × 20) 計算。
    mcq:
      options:
        - 第 18 筆
        - 第 20 筆
        - 第 19 筆
        - 每筆平均
      answer: 2
      explain: 排名從 1 起算；p95 不一定等於最大值。
  - id: bd-bench-04-tail
    prompt: p50 和 p95 都很低，代表沒有長尾嗎？
    answer: 不能只下這個結論；樣本少或僅少數慢任務時，仍要看最大值與原始分布。
    mcq:
      options:
        - 有 p95 就能排除最慢任務
        - 還須看最大值與樣本數
        - p50 必然高於 p95
        - 只需改報平均
      answer: 1
      explain: 最近秩法可能把最慢 1 筆留在 p95 之外。
  - id: bd-bench-04-diagnosis
    prompt: 慢任務應先和哪些數值一起檢查？
    answer: 同一階段的輸入、Shuffle 讀量、溢寫及執行位置，以區分偏斜與執行環境。
    mcq:
      options:
        - 只看總作業名稱
        - 只看磁碟總容量
        - 輸入、Shuffle 讀量及任務資源指標
        - 只看是否有多少總任務
      answer: 2
      explain: 時長指出症狀，其他量測用來區分原因。
    interview:
      question: p95 遠大於 p50，能直接說鍵傾斜嗎？
      points:
        - 同階段及同口徑
        - 對照任務讀量與機器
        - 提一個反證
      answer: 不能。我會在同一 Stage 對照慢任務的讀量和溢寫。若它讀得跟其他任務差不多，但都落同一工作節點，我會改查該節點的磁碟或記憶體，而不是先加鹽。
practice:
  - id: bd-bench-04-p1
    kind: code
    title: 用 20 個任務留下分位數證據
    minutes: 10
    steps:
      - 執行 tail.py，保存統計及最慢任務到 task-tail.md。
      - 把 90 秒那筆改成 2，再比較 p95、max 和診斷。
    checks:
      - 原始 p50=2、p95=90、max=120；改後 p95=2，max 仍是 120。
      - 筆記說明下一步要比較慢任務和一般任務的讀量。
---

## 分位數不是另一種平均值

某個 Spark 階段有 20 個任務（task），大部分 2 秒完工，少數等了 90、120 秒。平均耗時可以描述整體，卻不能回答「最慢一批讓整個階段多等多久」。分位數（percentile）先排序，再在分布上找位置。本堂用最近秩法（nearest rank）：位置為 `ceil(p × n)`，以第 1 筆起算，`p` 用 0 到 1 的比例，樣本必須非空且 `p` 大於 0。不同系統可能用插值或近似法；報告寫明演算法與樣本數就不會拿兩種數字硬比。

## 跟著慢任務回去看讀量

先挑同一 Stage，避免把掃描任務和寫端任務合算。標出 p50、p95、最大值，再挑慢、中各一筆，讀其 Shuffle 讀量（shuffle read bytes）、輸入列數、溢寫（spill）與工作節點。溢寫是工作緩衝不足時把中間數據寫到儲存，可能是讀量過多造成，也可能是同節點記憶體競爭。若兩個慢任務都讀得特別多，再用鍵頻率核對是否某個鍵集中；只憑一個箱形圖不夠。

在 `C:\dev\conduit-lab\bench` 存 `tail.py`，執行 `py tail.py`；WSL 2 用 `python3 tail.py`（可用 RAM 0.25 GB）。這是示例任務，不是 Spark 實測紀錄。

```python
from math import ceil
from statistics import mean

seconds = sorted([2] * 18 + [90, 120])

def percentile(p):
    return seconds[ceil(p * len(seconds)) - 1]

print("n", len(seconds), "mean", mean(seconds))
print("p50", percentile(0.50), "p95", percentile(0.95), "max", max(seconds))
```

結果平均 12.3 秒、p50 為 2、p95 為 90、最大值 120。把 90 秒改成 2，p95 變成 2，最後一個仍需 120 秒。假設同階段沒有重試且慢任務和其他任務同時起步，最後一個完成時間才決定這批何時可交給下一步；真實環境還須看排程等待與任務重試。之後在[〈鍵分布與加鹽〉](#/lesson/bd-bench-05)會針對確定的熱門鍵做一次可對帳的拆分。

## 把分位數對到現場要採取的動作

最近秩法在 20 筆用第 10 筆描述 p50；如果兩個中間值不同，某些工具會用兩者平均，不該用不同方法互相驗答案。先把同一觀察窗的任務次數、成功或失敗、是否包含重試說清楚。例：同一分區逾時後重試成功，若你只保存成功任務，長尾原因可能從報告消失；若把每次重試混進完成一次的分布，則同一分區又可能被重複加權。可分開呈現成功任務分布，以及重試與失敗數。

下一步只取兩筆真正可比的紀錄：一個慢、一個接近中位。若慢任務讀 900 MB 而典型只讀 40 MB，回查相關鍵頻率；若慢任務與典型讀量接近，但都在同一工作節點，就查可用資源或 I/O。若兩者都有現象，拿另一個正常節點的重試對照。能說明「哪個新觀察會令我改判」，比只交出 p95 圖更有用。也別把任務分位數當作整條管道的客戶延遲；後者還含排程與各階段等待。

若同事追問整條作業為什麼沒跟著 p95 改善，就拿階段起訖和排程等待另做一條時間線。

## 常見錯誤
- p95=2 就宣告無慢任務 → 第 20 筆未計入 → 同報最大值與樣本數。
- Stage 慢就調所有工作者 → 不知道哪個階段慢 → 先比同一 Stage 的逐任務指標。
- 單一節點重複變慢就說數據傾斜 → 讀量可能不偏 → 查節點及資源指標。
