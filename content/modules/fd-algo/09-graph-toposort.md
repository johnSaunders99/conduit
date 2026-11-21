---
id: fd-algo-09
module: fd-algo
order: 9
title: 圖與拓撲排序
subtitle: 找出誰卡住了排程
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-08
objectives:
- 把排程先後轉成指向下游的邊
- 用入度與佇列找合法執行順序
- 說明剩餘節點不一定都在循環上
tags:
- 有向圖
- 入度
- 拓撲排序
- DAG
resources:
- title: Python：graphlib
  url: https://docs.python.org/3/library/graphlib.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 TopologicalSorter 的前置任務定義。
concepts:
- id: fd-algo-09-edge
  prompt: 若 B 必須等 A，本課的邊朝哪裡？
  answer: A → B；完成 A 會解除 B 的一項前置條件。
  mcq:
    question: 匯入完成後才能聚合，哪個敘述正確？
    options:
    - 聚合指向匯入
    - 匯入指向聚合
    - 兩個方向都要畫
    - 兩者的入度都必須為零
    answer: 1
    explain: 邊按解除依賴的方向；聚合因此至少有一條入邊。
- id: fd-algo-09-ready
  prompt: 入度何時下降至 0？
  answer: 當所有尚未處理的前置節點都已被移出時。
  mcq:
    question: A、B 都是 C 的前置，完成 A 後能馬上選 C 嗎？
    options:
    - 可以，完成任一即可
    - 可以，若 C 名稱較短
    - 不一定，還得確認 B 已完成
    - 永遠不行
    answer: 2
    explain: 將入度減一不等於歸零；名稱不影響約束。
- id: fd-algo-09-residual
  prompt: 排不完的節點為何不全是環的成員？
  answer: 依賴循環的下游同樣永遠等不到，其本身可能並未指回上游。
  interview:
    question: 什麼時候可讓兩個報表任務同時開始？
    answer: 在圖上只要各自所有前置都已成功，就可能同時開始，但我還會檢查它們是否寫同一輸出或受共用資源限制。
    points:
    - 用零入度找候選
    - 區分完成與被排到
    - 實際還有資源限制
practice:
- id: fd-algo-09-p1
  kind: code
  minutes: 9
  title: 核對依賴順序而非固定答案
  steps:
  - 執行 schedule_order.py。
  - 加入 validate 節點，令 report 同時依賴 validate 與 aggregate，檢查兩者都排在 report 前。
  checks:
  - 不依賴彼此的兩項可以互換。
  - 加上一條從 report 回到 ingest 的邊後，不能再產出完整順序。
---

## 一張圖列清楚每個報表在等誰

原始訂單須先匯入，再聚合成報表；品質檢查也必須在報表前完成。用有向圖（directed graph）表示這種關係：任務是頂點（vertex），箭頭是邊（edge）。本課約定前置指向下游，`A → B` 意思是 A 必須先完成。鄰接串列（adjacency list）為每個點保存直接下游；入度（in-degree）記還有幾條前置限制沒有解除。沒有任何邊的任務也要列出，否則順序會漏掉它。

若所有箭頭都能從順序中較早的位置指向較晚位置，這個順序就是拓撲排序（topological sort）。先把入度為 0 的點放進佇列；拿出一個點，就沿箭頭解除一項限制、讓下游的入度減一，降到 0 再入列。佇列先拿哪個零入度任務，可能影響結果，但不影響合法性。數據開發常把沒有循環的依賴圖叫有向無環圖（directed acyclic graph，DAG）；之後在〈[DAG 與依賴](#/lesson/bd-orch-01)〉會把它對到排程。

## 讓排序結果能被驗算

在 `C:\dev\conduit-lab\algorithms` 存成 `schedule_order.py`，於該資料夾執行 `py schedule_order.py`。每條邊輸入一次，並先列出所有任務名稱。

```python
from collections import deque

def arrange(tasks, edges):
    children = {task: [] for task in tasks}
    inbound = {task: 0 for task in tasks}
    for before, after in edges:
        children[before].append(after)
        inbound[after] += 1
    ready = deque(task for task in tasks if inbound[task] == 0)
    order = []
    while ready:
        task = ready.popleft()
        order.append(task)
        for child in children[task]:
            inbound[child] -= 1
            if inbound[child] == 0:
                ready.append(child)
    return order if len(order) == len(tasks) else None

tasks = ["ingest", "aggregate", "report", "validate"]
edges = [("ingest", "aggregate"), ("aggregate", "report"), ("ingest", "validate")]
order = arrange(tasks, edges)
assert sorted(order) == sorted(tasks)
assert all(order.index(a) < order.index(b) for a, b in edges)
assert arrange(tasks, edges + [("report", "ingest")]) is None
print(order)
```

佇列空了卻仍缺點，就代表存在環：若剩下每個點都還等另一個剩餘點，沿前置反覆往回找，在有限圖上終會到達已見的點。這不代表所有剩餘點都在環裡。假如 validate 只等 ingest，環卡住 ingest 時 validate 也排不出，但它不會走回任何上游。之後在〈[圖的循環檢查](#/lesson/cr-code-05)〉會練習報告這個區別。

排序主體每個點與每條邊各處理一次，時間與空間都是 `O(V+E)`，分別以頂點數、邊數計量。範例的最後驗算刻意用小圖；在大圖可先建立任務到位置的字典，避免每條邊都重查陣列。

### 先畫解鎖，再核對順序

若報表同時等待 aggregate 和 validate，初始入度是 2。假設先排 ingest，它只解除 aggregate 與 validate 各自的一條限制，並沒有直接解除 report。再排 aggregate 時，report 還剩 1；直到 validate 完成，report 才進入可排佇列。這能用來拆穿「只要做完任何上游就可接著跑」的直覺。反過來，假如兩個上游都沒有其他前置，互換它們不會讓品質檢查消失。

排序是一份靜態計畫，不是已執行結果：真正執行時，任務被排到不等於成功，也不會由這段程式紀錄執行時間。可讓零入度候選並行的前提是彼此不干擾；若寫同一輸出還要另外協調。練習加入全然獨立的通知任務，檢查它仍出現在有效順序中，卻不需要限制放在哪一格。驗算時先確認每個任務出現一次，再對每條邊檢查前置是否真的在下游前面。兩個檢查合用，可抓出漏節點與箭頭畫反。

## 常見錯誤

- 報表先於匯入 → 箭頭畫反 → 先把每條邊念成「A 做完才能做 B」。
- 忘了孤立任務 → 只從邊收集待跑工作 → 先讀完整任務清單。
- 把每次輸出差異當成錯誤 → 合法排序可能不唯一 → 比每條邊的相對順序。
