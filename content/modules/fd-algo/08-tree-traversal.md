---
id: fd-algo-08
module: fd-algo
order: 8
title: 樹與走訪
subtitle: 逐層列出商品分類
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-07
objectives:
- 表示一棵有多個子分類的樹
- 比較深度優先與廣度優先的出場順序
- 用深度與寬度解釋待處理空間
tags:
- 樹
- DFS
- BFS
- 分類
resources:
- title: Open Data Structures
  url: https://opendatastructures.org/ods-python/
  kind: book
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀 Binary Trees 的走訪段落，對照一般樹。
concepts:
- id: fd-algo-08-bfs
  prompt: 為何逐層列出商品分類要用佇列？
  answer: 早入列的同層節點先處理，子節點排在當層後面。
  mcq:
    question: 根有 A、B，A 的子項是 A1。由左到右逐層應輸出什麼？
    options:
    - 根、A、B、A1
    - 根、A、A1、B
    - A1、A、B、根
    - 根、B、A、A1
    answer: 0
    explain: 逐層先列完第 1 層，A1 在第 2 層。
- id: fd-algo-08-dfs
  prompt: 用堆疊實作由左到右 DFS，子項為何反向放進去？
  answer: 堆疊後進先出；右邊先放，左邊才先取。
  mcq:
    question: 子項是 A、B、C，要先走 A，應按什麼順序推入堆疊？
    options:
    - A、B、C
    - A、C、B
    - C、B、A
    - B、A、C
    answer: 2
    explain: 最後推入 A 才先彈出；反向推入還能保持其餘同層次序。
- id: fd-algo-08-shape
  prompt: 哪種樹會讓 BFS 的待處理量變大？
  answer: 某一層特別寬的樹；佇列可能暫存大量同層或下一層節點。
  interview:
    question: 商品分類表可能把同一節點掛到兩個上層，可直接跑樹走訪嗎？
    answer: 我先確認規格允不允許多父節點。若不允許，匯入時拒絕；若允許，就把它當圖，決定每個節點只列一次還是按不同路徑各列一次，並驗證沒有循環。
    points:
    - 先問樹模型限制
    - 辨別去重與路徑
    - 防止循環
practice:
- id: fd-algo-08-p1
  kind: code
  minutes: 8
  title: 比較兩種分類清單
  steps:
  - 執行 categories.py，再加入一個同層節點和一個更深節點。
  - 把實際 BFS、DFS 輸出存入 categories.md，標記第一個不同的位置。
  checks:
  - BFS 不會在 drinks 之前先印 fruit。
  - DFS 先走完 food 的子樹。
---

## 分類有上層，但報表要哪種順序？

商品目錄的根是全部商品，下層有食品與飲料，再下層才是水果、麵包、茶。樹（tree）有根節點（root），除根以外每個節點只有一個父節點（parent），子節點（child）可有多個，沒有子節點的叫葉節點（leaf）。本例子項次序也有意義；層數從根的 0 開始。樹的走訪（traversal）不是一定要照原始檔列順序，而是由父子關係決定下一個節點。

需要逐層寄給營運時，用廣度優先搜尋（breadth-first search，BFS）：從佇列頭取節點，子項加到尾端。若想按分類輸出完整子樹，用深度優先搜尋（depth-first search，DFS）：從堆疊取節點，把子項按反方向放入，先走完第一支，再回來走第二支。這裡的 DFS 先列自己再列子項；先處理子項、最後列自己也是另一種走法，不要只靠縮寫推論出場順序。

## 用同一棵分類樹跑兩遍

在 `C:\dev\conduit-lab\algorithms` 建立 `categories.py`，於該資料夾執行 `py categories.py`。用「節點 → 子項清單」的字典表示，不存在子項清單時視為葉節點。

```python
from collections import deque

children = {"all": ["food", "drinks"], "food": ["fruit", "bread"], "drinks": ["tea"]}

def walk(root, breadth_first):
    pending = deque([root])
    output = []
    while pending:
        node = pending.popleft() if breadth_first else pending.pop()
        output.append(node)
        sub = children.get(node, [])
        pending.extend(sub if breadth_first else reversed(sub))
    return output

layers = walk("all", True)
branches = walk("all", False)
assert layers == ["all", "food", "drinks", "fruit", "bread", "tea"]
assert branches == ["all", "food", "fruit", "bread", "drinks", "tea"]
print(layers)
print(branches)
```

每個節點進出一次，時間是線性。BFS 的佇列受層寬影響，寬層可能一下排進大量子項；本例 DFS 堆疊也不是永遠只存樹深那麼多：一個節點若有很多子項，全部一起推入時就會暫存許多兄弟。說空間時分清待處理容器與為了交作業保留的輸出；輸出兩種順序，各需要一份完整陣列。

這段程式假設數據真的是一棵樹。如果茶又被掛到食品下，兩條路都可能走到茶；若錯把上層掛回下層，甚至會一直重複。〈[圖與拓撲排序](#/lesson/fd-algo-09)〉會先檢查節點之間能不能按依賴排完。從原始匯出建樹時，記得把無父節點、失聯父節點與多父節點分開統計，別用一個空清單掩蓋關係缺失。

### 用層序做一次核對

根節點入列時，佇列裡還只有根。把根取出，食品和飲料同時入列。下一輪取出食品，將水果、麵包放到飲料之後；因此飲料即使還未展開，也一定在水果前出現。深度優先則先把飲料放在較底下，把食品放到頂端，展開食品後的新工作又放上去，所以水果和麵包都先於飲料。可先用字條手推，不必相信程式回傳的順序。

如果報表要列每一層的數量，不能只輸出平坦名稱後猜深度。可在待處理容器連同深度保存一個元組，加入子項時深度加一，就能按層計數。若顯示順序和來源檔原本的順序不同，先說報表按哪種遍歷，不要把排序後畫面當成來源本身已整理好。

## 常見錯誤

- DFS 次序左右顛倒 → 按原順序推進堆疊 → 推入前反向。
- BFS 中葉節點比同層上游先出現 → 用了後進先出 → 改從佇列頭取。
- 異常分類讓程式不結束 → 未驗證樹的無循環假設 → 先驗數據關係。
