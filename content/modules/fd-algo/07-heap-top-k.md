---
id: fd-algo-07
module: fd-algo
order: 7
title: 堆積與 Top K
subtitle: 只保留最忙的十間店
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-06
objectives:
- 用最小堆只保留固定數量的高分店家
- 用並列規則確認最終名單
- 說明堆頂排序與完整排序的差別
tags:
- 最小堆
- heapq
- Top K
resources:
- title: Python：heapq
  url: https://docs.python.org/3/library/heapq.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 heappush、heapreplace 與比較規則。
concepts:
- id: fd-algo-07-root
  prompt: 保留最大的 K 筆時，最小堆堆頂代表誰？
  answer: 目前保留名單中最差、下一個可能被取代的候選。
  mcq:
    question: 已保留分數 11、15、21，新分數 14 應如何處理？
    options:
    - 捨棄 14
    - 淘汰 21
    - 淘汰 11
    - 把容量增為 4
    answer: 2
    explain: 堆頂 11 是保留組的最小值；14 更好，就取代 11。
- id: fd-algo-07-output
  prompt: 堆內陣列能直接當高到低名次嗎？
  answer: 不能；堆只保證親子順序和堆頂極值，交付時需另排序保留的 K 筆。
  mcq:
    question: 哪種讀法可保證取得全部保留者的高到低順序？
    options:
    - 依原堆索引直接列印
    - 另對 K 筆做降序排序
    - 只反轉原堆
    - 省略堆頂再輸出
    answer: 1
    explain: 堆內兄弟及不同子樹沒有全域順序；反轉也不保證。
- id: fd-algo-07-cost
  prompt: 當 1≤K≤n，維護候選的時間和額外空間上界是什麼？
  answer: 時間 O(n log(K+1))、候選空間 O(K)；交付排序另花 O(K log(K+1))。
  interview:
    question: 營運只要前 10 間店，你一定選堆嗎？
    answer: 我先問輸入是否已按店彙總。若確實一店一筆且只要前 10，堆省候選空間；如果本來就有全量排序的用途，小輸入直接排序更容易維護。
    points:
    - 交代一店一筆假設
    - 比較 n 與 K
    - 說明並列及交付順序
- id: fd-algo-07-ties
  prompt: 榜尾同分全收還能保證結果最多 K 筆嗎？
  answer: 不能，最壞全部同分且都要列出。
  mcq:
    question: K 是 2，4 間店全部同分且榜尾同分全收，輸出幾間？
    options:
    - '0'
    - '1'
    - '2'
    - '4'
    answer: 3
    explain: 同分全收與硬容量是兩種不同的契約，不能同時承諾。
practice:
- id: fd-algo-07-p1
  kind: code
  minutes: 8
  title: 測試低分淘汰與並列
  steps:
  - 執行 store_top.py。
  - 加入並列但更早出現的店號測試，將容量改成 1。
  checks:
  - 同分時店號較小者排前。
  - K 為 0 時結果是空陣列。
---

## 名單只剩 K 個位置

每天的門店彙總已有一店一筆，你只需要最忙的 10 間。前 K 名（Top K）可以先排序後切片；當輸入很大而 K 很小，不必保留整份排序結果。堆積（heap，亦稱堆）用父節點不大於子節點的規則維護最小堆（min-heap），最小值留在第一格。這樣就能立刻知道保留名單裡最該換掉的是誰。堆不是排好序的陣列，只保證親子優先順序。

Python 用普通陣列承載堆：`heapq.heappush(heap, item)` 加入，`heap[0]` 看堆頂，`heapq.heappop(heap)` 取出最小值。`heapq.heapreplace(heap, item)` 在非空堆移出堆頂、納入新值；在本題要先比過資格才呼叫。若有一份既有陣列，可用 `heapq.heapify(heap)` 原地整理成堆，但這裡不必先收齊。

## 平手也要有規則

在 `C:\dev\conduit-lab\algorithms` 存 `store_top.py`，於該資料夾執行 `py store_top.py`。訂單數越大越好，同分時店號越小越好。元組先比第一格再比第二格，所以使用負店號作第二格，令較差的同分店成為較小值。

```python
import heapq

def top_stores(rows, k):
    kept = []
    if k <= 0:
        return []
    for store_id, count in rows:
        item = (count, -store_id)
        if len(kept) < k:
            heapq.heappush(kept, item)
        elif item > kept[0]:
            heapq.heapreplace(kept, item)
    return [(-neg_id, count) for count, neg_id in sorted(kept, reverse=True)]

rows = [(4, 21), (2, 15), (8, 11), (1, 15)]
assert top_stores(rows, 2) == [(4, 21), (1, 15)]
assert top_stores(rows, 0) == []
print(top_stores(rows, 2))
```

第 3 筆比堆頂差，不進名單；第 4 筆和店 2 同分，但店號較小，於是取代店 2。最後才為報表排序。每筆先看堆頂，只有要加入或取代才沿堆調整；容量始終不超過 K。比較固定大小的分數與店號時，維護成本至多 `O(n log(K+1))`，最後只排序保留下來的候選。當 K 和全部筆數差不多，直接排序通常更簡單。當 K 大於筆數，本例就回傳全部可用的店。

這不是從原始訂單直接做精確的店家計數。原始列可能有同一店反覆出現；用本函式排名會把交易列當店，甚至讓同一間店佔多席。若還沒彙總，要先有按店累計的階段，記憶體也得另外估算。〈[串流 Top K](#/lesson/cr-code-04)〉會把一次讀取與是否已有分數拆開。

### 手追堆頂，別手追整份排名

容量 2、分數依次為 40、20、30、10。前兩筆先填滿，不論誰先到，此時堆頂為 20；30 取代 20 後，下一個可淘汰的是 30。10 比 30 還差，所以不需要再動候選。堆頂是目前名單裡的門檻，不是全部輸入出現過的最小值，也不是第一名。可以在紙上每步只寫保留集合與堆頂，最後才排出兩名。

如果營運說「並列都要上榜」，任務就不是精確留下 K 筆；最壞可能每一間店同分。請先確認要固定容量、穩定分勝負，還是榜尾同分全收。這兩種規格的空間上限不同，甚至輸出都可能大於 K，不能直接使用此版本。練習時把容量設成 1，特別適合核對平手的第二鍵是否跟交付規則一致。兩間店同分也要算不同候選，不可像集合那樣用分數去重。

## 常見錯誤

- 每筆都換掉堆頂 → 較差的新值也進榜 → 只在新值更好時取代。
- 直接印底層陣列 → 親子有序不等於整體有序 → 交付前排序 K 筆。
- 平手時結果與規格相反 → 忘了檢查第二鍵方向 → 用兩筆同分不同店號驗算。
