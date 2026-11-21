---
id: bd-orch-08
module: bd-orch
order: 8
title: 發布與回滾
subtitle: 先還原產物再補跑下游
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-07
objectives:
- 區分回滾程式、切回已驗收產物與重新計算
- 切換練習中的讀取指標並驗證讀者結果
- 列出回切後仍需處理的下游衍生輸出
tags:
- 發布
- 回滾
- 版本指標
- 回切
resources:
- title: Airflow：最佳實務
  url: https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看暫存、交易及跨任務產物原則。
- title: Google SRE：事故復盤文化
  url: https://sre.google/sre-book/postmortem-culture/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀復盤如何把事件變成後續行動。
concepts:
- prompt: 為何不直接把 v2 檔改回 v1 內容？
  answer: 保留兩份可核對的版本，再換讀取指標，可分開追查錯版及恢復服務。
  mcq:
    question: 數據 v2 錯了但 v1 驗過，最快恢復讀者的方式？
    answer: 0
    options:
    - 讓讀者改讀已驗收的 v1
    - 只還原程式版本
    - 先移除兩版再重算
    - 讓讀者自行挑最新檔
    explain: 在確認相容後切回已驗版本；只回滾程式不會變更已發布產物。
  id: bd-orch-08-pointer
- prompt: 回切成功後，為何還要看下游？
  answer: 已由錯版產生的快取或報表不會因上游指標改回而自動更新。
  mcq:
    question: 看板曾讀 v2 並保存聚合表，回切後先做什麼？
    answer: 3
    options:
    - 不需再動，指標已切回
    - 刪除所有歷史報表
    - 只截圖最新排程狀態
    - 標記並重做受影響的下游
    explain: 需辨認受錯版影響的輸出並再次建置或使快取失效；切回上游本身不修改它。
  id: bd-orch-08-downstream
- prompt: 什麼情況不能直接回切？
  answer: 新讀端可能不再相容舊結構，或新系統已做無法逆轉的狀態改動；要先驗證並採前向修復或相容路徑。
  interview:
    question: 上線某日新報表出錯，你如何決定回滾或前向修復？
    answer: 我先停住新發布、鎖定受影響日期和版本。若舊版完整且與讀端相容，就切回並核對看板與衍生表；若已改結構或破壞舊數據，不冒然回切，改走相容輸出或前向修復。最後按影響窗口補跑。
    points:
    - 先限縮影響
    - 確認結構與讀端相容
    - 讀者驗收和最小補跑
  id: bd-orch-08-compat
practice:
- kind: hands-on
  title: 保存一次可逆發布的證據
  minutes: 8
  steps:
  - 在工作區執行正文的 switch_report.py，記下發布前、預覽錯版、回切後的金額。
  - 打開 active.txt 和兩份 CSV，確認沒有覆寫任一版本內容。
  - 列出一個仍可能讀到舊快取的下游，補上重新驗收步驟。
  checks:
  - 終端顯示 v1 320、v2 620、v1 320。
  - 指標最終指向 v1，兩份原版均存在。
  id: bd-orch-08-p1
---

## 先讓人讀到可用數據，再找錯版

一份 320 元的日報被新公式算成 620 元。回滾（rollback）可以是還原程式，也可以是切回上一份通過驗收的產物，但兩者不等同。程式改回去不會把前一趟已寫的報表改回來。若舊版本仍在且讀端相容，先停止錯版繼續發布，再改讀取指標（pointer）指回可用版本，可以縮短下游看錯帳的時間。

![已驗收版本保持可讀，候選版經檢查才切讀取指標，必要時指回舊版](assets/bd-orch-release.svg)

合法的發布流程是「建候選 → 驗收 → 切指標 → 從讀端驗證」，保留足夠期間的上一版。若錯版已被下游用過，要標出受影響日期、結果版本與讀者，才能重做最小一段。不能因為上游已切回，就宣稱下游保存的聚合或快取也自動恢復。若新程式只讀新版結構，先確認兼容或採前向修復；未驗證的回切可能製造新的故障。

## 在練習區切換一次

開新資料夾 `C:\dev\conduit-lab\release-lab`，存成 `switch_report.py` 後執行 `py switch_report.py`，預留 1 GB，無容器。程式只覆寫練習資料夾中同名檔案；先保留錯版證據，再模擬預覽錯版和回切，不在正式環境發布錯值。

```python
import csv
from pathlib import Path

def activate(version):
    staged = Path("active.tmp")
    staged.write_text(version, encoding="utf-8")
    staged.replace("active.txt")

def show():
    version = Path("active.txt").read_text(encoding="utf-8")
    with Path(f"{version}.csv").open(encoding="utf-8", newline="") as file:
        print(version, next(csv.DictReader(file))["amount"])

for version, amount in [("v1", 320), ("v2", 620)]:
    Path(f"{version}.csv").write_text(f"amount\n{amount}\n", encoding="utf-8")
for version in ("v1", "v2", "v1"):
    activate(version)
    show()
```

檢查實際讀出的金額，而不只看 `active.txt`。這個單寫者練習用同目錄取代模擬同時切換讀者指標；真正的對象儲存或多寫者系統需要自己的版本提交條件，不能照搬本機檔案語義。若看板保存了聚合快取，要重新從正確版本計算並確認 320 才算修好。

## 什麼證據才允許切回

回切前看到舊檔存在還不夠：查它是哪一個營業日、來源切點和欄位版本，並確認依賴它的看板仍能讀。若讀者透過快取看到的是 620 元，切指標後可先標記該報表延遲，等快取更新及核對完成再解除。若要回切的日子只是某段日期，集中處理那段，不能把所有正常歷史一併換回。

對此練習，保存錯版不是為了再交一次，而是給之後分析公式與逐鍵對帳。正式流程要定義保留期和讀者範圍；不要依檔名或修改時間推測哪份有效。可再驗證一個情境：若刪除的不是紀錄而是結構欄位，舊版程式不一定能讀新版數據，先尋找可兼容的轉換方式，再評估回切。逐步完成這些驗收，比僅在排程器按一次重跑更能保護正在用報表的人。

## 常見錯誤

- **程式還原但報表仍錯 →** 發布物未切回；獨立盤點程式、數據及衍生輸出版本。
- **找不到錯在哪裡 →** 直接覆寫候選舊檔；保留版本、來源切點、實際讀值和變更記錄。
- **切回後讀端無法解析 →** 沒檢查欄位結構相容性；先驗讀端，再選回切或前向修復。

**重點回顧：**回滾完成的證據是下游又正確，不是一次指標更新顯示成功。
