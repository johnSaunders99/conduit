---
id: fd-algo-05
module: fd-algo
order: 5
title: 堆疊與佇列
subtitle: 回放與排隊要不同容器
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-04
objectives:
- 用堆疊回退最後一步
- 用 deque 依先進先出順序派送待處理檔案
tags:
- 堆疊
- 佇列
- deque
- FIFO
resources:
- title: Python：數據結構
  url: https://docs.python.org/3/tutorial/datastructures.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Using Lists as Stacks and Queues。
- title: Python：collections
  url: https://docs.python.org/3/library/collections.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 deque 的 append 與 popleft。
concepts:
- id: fd-algo-05-stack
  prompt: 哪個容器最適合撤回最後一個轉換設定？
  answer: 後進先出的堆疊；最後加入的設定先取回。
  mcq:
    question: 依次推入 parse、filter、rename，再彈出一次會得到？
    options:
    - parse
    - rename
    - filter
    - 三個一起拿出
    answer: 1
    explain: 堆疊只從同一端加入與取出，最後的 rename 在頂端。
- id: fd-algo-05-queue
  prompt: 為何以 deque 管理先進先出的待處理工作？
  answer: 兩端新增或取出約為常數時間；list 的 pop(0) 要移動其餘元素。
  mcq:
    question: 哪一對 deque 操作保持 FIFO？
    options:
    - append 與 pop
    - appendleft 與 popleft
    - pop 與 popleft
    - append 與 popleft
    answer: 3
    explain: 同一端進出是堆疊；FIFO 必須一端加入、另一端取出。
- id: fd-algo-05-retry
  prompt: 工作取出等於已成功完成嗎？
  answer: 不等於；執行仍可能失敗，要另外協調確認、重試及不重複寫入。
  interview:
    question: 用 deque 能保證重開程式後工作不掉嗎？
    answer: 不能，那只是一個記憶體容器。我會先問是否要跨重啟保留，若需要就另有持久來源，並區分取出與完成確認。
    points:
    - 分清順序與可靠性
    - 跨重啟才需要持久化
    - 說出成功確認
practice:
- id: fd-algo-05-p1
  kind: code
  minutes: 8
  title: 留一份回退與派工順序
  steps:
  - 執行 work_order.py。
  - 新增一份待處理檔案，將派工順序寫進 work-order.md。
  checks:
  - 回退 rename 後保留 parse、filter。
  - 新增檔案必須排在原來兩個之後。
---

## 同樣是取下一筆，順序不同

你在實驗批次中依序設定解析、篩選、改欄名。發現最新規則不對時，第一個撤回的是改欄名。堆疊（stack，亦稱棧）一端進出，稱為後進先出（last in, first out，LIFO）。Python list 可用 `append(value)` 加在尾端、`pop()` 取走尾端；空容器取值會報錯，取之前用 `if history:` 判斷。這裡只回退記憶體裡的設定，不會自動復原已發布的數據。

另一邊有 2 份 CSV 按抵達順序等待；若要先處理較早抵達的檔案，採佇列（queue，亦稱隊列）的先進先出（first in, first out，FIFO）。雙端佇列（double-ended queue）在 Python 叫 `deque`：`append(value)` 放尾端、`popleft()` 取頭端；也可以 `appendleft(value)` 從頭放、`pop()` 從尾取，但要成對使用才能保留所需順序。

## 同時看看回退和派工

在 `C:\dev\conduit-lab\algorithms` 存為 `work_order.py`，於該資料夾執行 `py work_order.py`。以不同的容器命名區分工作狀態，不把撤銷操作當成下一個檔案。

```python
from collections import deque

history = ["parse", "filter"]
history.append("rename")
undone = history.pop() if history else None

pending = deque(["orders-01.csv"])
pending.append("orders-02.csv")
served = []
while pending:
    served.append(pending.popleft())

assert undone == "rename"
assert history == ["parse", "filter"]
assert served == ["orders-01.csv", "orders-02.csv"]
print("Undo:", undone, "Dispatch:", served)
```

如果對待處理檔案也從尾端拿，新來的會先跑。持續有新檔時，舊檔甚至可能長期排不到。用 list 的 `pop(0)` 雖能模擬先進先出，卻要將後面參照前移；一口氣取完大量列會重複搬動。deque 兩端的增刪約為常數時間，但不擅長按中間位置查詢。若你還得反覆找中間某筆，先問能否另存按 ID 查詢的結構，不要讓單一容器負擔兩個相反的需求。

這個佇列不寫磁碟，也沒有成功確認。不應從「依序派出」推論「必定依序成功」：例如第一個檔案正在重試，第二個工作可能先完成。若業務要求前者交付後才開始後者，那是依賴關係，在〈[圖與拓撲排序](#/lesson/fd-algo-09)〉會學如何表示；若要求重啟後還能補跑，在〈[重試與冪等](#/lesson/bd-orch-03)〉會細講成功與重試的界線。

### 記一小段狀態，再換一個容器

把三份檔案的抵達順序寫在紙上；每次執行取出時，用箭頭畫出頭端。若前兩份已取出，第三份才到，先進先出只約束仍待處理的項目。再假設第一份派出後報錯，你把它放回尾端，它將排在當時的等候者之後。若要求重試仍先於其他任務，需要另定策略，不是容器替你決定。

堆疊也只負責順序。例如設定依序為篩選、改欄名、去重，撤掉去重後不能假定輸出自動回到篩選完的版本；如果先前已寫出檔案，還需要重跑原流程或有可復原版本。練習時用兩張不同的紙記「設定歷史」與「派工歷史」，不要把待處理工作與已套用設定放在同一堆。最後嘗試空的堆疊和空的佇列，說清楚要回傳空值、略過，還是由上層記錄錯誤。兩個容器都要明確處理空值。

## 常見錯誤

- 取檔順序總是相反 → 加入與取出都用尾端 → FIFO 改用 `popleft()`。
- 空佇列觸發索引錯誤 → 在沒有工作時取值 → 先檢查容器。
- 取完就說工作已完成 → 把派工當成功確認 → 分開記錄兩種狀態。
