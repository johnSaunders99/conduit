---
id: bd-serve-07
module: bd-serve
order: 7
title: Kappa 架構
subtitle: 重播日誌能否還原昨日結果
status: ready
minutes: 35
level: 3
prereqs:
- bd-serve-06
objectives:
- 比較單流回放與批流雙路的成本
- 用分區範圍判斷是否能完整重播
- 隔離重建輸出並寫出核對與切換條件
tags:
- Kappa
- replay
- 日誌保留
- 重建
resources:
- title: Microsoft：大數據架構
  url: https://learn.microsoft.com/en-us/azure/architecture/databases/guide/big-data-architectures
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Kappa 的單一路徑與歷史回放。
- title: Kafka：可重播日誌與保留
  url: https://kafka.apache.org/44/design/design/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀消費位置與保留，確認能回放的限制。
concepts:
- id: bd-serve-07-retain
  prompt: 要以 Kafka 回放 14 天，歷史只留 7 天，可以直接重建嗎？
  answer: 不能；缺段要由完整歸檔供應，否則不能宣稱重建完整。
  mcq:
    question: 發現起讀位置早於最早可讀位置，先做什麼？
    options:
    - 跳過缺段照常發布
    - 停下並找符合口徑的歸檔或可信基底
    - 把所有結果設為零
    - 讓新的結果直接覆蓋舊結果
    answer: 1
    explain: 保留不足是可恢復性的前提失敗，不是改重播程式即可解決。
  interview:
    question: 如何用 Kappa 換版而不停看板？
    points:
    - 隔離輸出並以單套邏輯重播
    - 分區切點對齊後核對
    - 保留容量與回切路徑
    answer: 我會讓舊作業繼續服務，讓新版從可信日誌重播到另一張表。對齊每區位置後用業務鍵及指標對帳，追到允許的差距才切換。缺少保留或追不上就先不切。
- id: bd-serve-07-capacity
  prompt: 現場每秒到 1000 筆，重播最多做 900 筆／秒，新版能追上嗎？
  answer: 不能；重播和追流合計得快於新增，或另安排追趕策略。
  mcq:
    question: 新版落後 60000 筆、可做 1500 筆／秒，活流每秒 1000，理想多久追上？
    options:
    - 40 秒
    - 60 秒
    - 120 秒
    - 600 秒
    answer: 2
    explain: 追趕淨速是每秒 500 筆，60000 / 500 = 120 秒。
- id: bd-serve-07-compare
  prompt: 重播直接寫正式看板，最大的風險是什麼？
  answer: 讀者可能看到部分歷史結果或被舊值覆蓋，失敗也難回退。
  mcq:
    question: 哪種順序較安全？
    options:
    - 覆寫正式結果後才決定比較口徑
    - 隔離重播、對帳、再切讀取
    - 停所有來源後不記位置
    - 使用同組分工讓新舊版分別只讀部分事件
    answer: 1
    explain: 先隔離結果，再以可核驗邊界切換，正常查詢不見半成品。
practice:
- id: bd-serve-07-p1
  kind: code
  title: 驗證完整與缺段的兩次重播
  minutes: 12
  steps:
  - 將正文存成 serve_replay.py，用 PowerShell 執行 py serve_replay.py。
  - 記下兩次可讀邊界的輸出。在 serve-kappa.md 寫完整段通過後如何切換隔離結果。
  checks:
  - 最早可讀為 100 時，得到總額 150。
  - 最早只到 101 時拒絕發布，不視 30 為完整總額。
---

假設昨天的看板要改計算規則：退款要扣回付款。Lambda 會讓批次與實時都改；Kappa 架構（Kappa architecture）則讓同一套流式轉換重播（replay）歷史並追新事件，避免維護兩套計算邏輯。代價是來源要夠完整、作業能追上，且單套程式仍可能存在新舊版本同時運行。共用邏輯不等於免回填、免對帳。

## 要能說明回放到哪裡

原始輸入要有不可混淆的分區與位移、可核對的時間範圍，以及足夠保留或可回放歸檔。想回放 14 天但只留 7 天，從最早可讀位置開始也補不回缺段。若用某一已核對快照當起點，記清楚已覆蓋到哪個位移，且後續連續可讀；不要把[〈保留與壓縮〉](#/lesson/bd-kafka-06)的僅存最新值壓實流，誤當成每次變更的完整歷史。多分區要各記起終點，不能宣稱「整個作業讀到 102」就算對齊。

## 先拒絕不完整，再算總額

在 Windows 專用工作區存成 `serve_replay.py`，以 `py serve_replay.py` 執行。下面只有一區與 3 筆已知、連續位移，純 Python 不需容器。100、101、102 的金額分別是 120、40、-10；兩次輸入只改「最早可讀」。實際 Kafka 位移可有空洞，不能把範例的連續假設用來斷言生產日誌一定不完整。

```python
events = [(100, 120), (101, 40), (102, -10)]
start, stop = 100, 103
for earliest in (100, 101):
    if earliest > start:
        print(earliest, "gap: not published")
        continue
    result = sum(amount for offset, amount in events if start <= offset < stop)
    print(earliest, result)
```

得到 `100 150`，以及缺段時不發布的訊息。若去掉防護並只讀由 101 起的值，會得到 30，還能畫出看似正常的數字。這才是切換條件要設在發布前的原因。正式作業通常讓新版寫隔離目的地，直到追到已登記的各分區位置，與舊版相同口徑的部分對帳，差異也能由規則變更解釋，再切看板讀取；舊版本暫留以便回退。

若新事件每秒 1000 筆、趕路總速率每秒 1500 筆，淨追趕為 500 筆；落後 6 萬筆至少先估 120 秒，還要實測共享資源如何互相影響。若追不上可以安排回放配額或隔離容量，而不是犧牲正式查詢。接著[〈尾端延遲與容量〉](#/lesson/bd-serve-08)會用負載觀測這個取捨。

回放要能重現，不只取決於原始輸入。假如新規則會去外部系統查今日的商品分類，回跑昨天可能用錯版本。要保存當時的維度版本或明訂用哪一版規則重算，同樣記在回放清單。切換時先對齊業務可見的截至時間和輸入位移，各區都追上才有比較基礎。若兩張表的差是預計的退款扣除，另列正常差異總額及明細，不強求每項完全相同，也不以有差就任其通過。

回放還要確認舊表能維持服務，直到新版讀取入口完成切換。

## 常見錯誤

- 重播視窗比日誌保留更長 → 可能缺段 → 找歸檔或可信快照再公開結果。
- 新舊共用同一輸出 → 看板讀到半成品 → 重播用獨立結果，最後切換。
- 用總吞吐算追趕時間 → 未扣正在到達的流量 → 先算淨追趕速率。
