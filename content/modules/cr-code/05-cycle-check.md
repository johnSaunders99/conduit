---
id: cr-code-05
module: cr-code
order: 5
title: 圖的循環檢查
subtitle: 兩個排程互等時如何報錯
status: ready
minutes: 25
level: 2
prereqs:
- cr-code-04
objectives:
- 用拓撲排序檢查任務循環
- 區分環上的任務與被阻塞的下游
- 用孤立節點與自環驗證結果
tags:
- 循環依賴
- Kahn
- 排程
- 阻塞
resources:
- title: Python：graphlib
  url: https://docs.python.org/3/library/graphlib.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 CycleError 與未被循環阻塞的任務。
concepts:
- id: cr-code-05-length
  prompt: Kahn 演算法如何判定排程有環？
  answer: 在處理完所有可啟動點後，比對已排與總任務數；小於總數表示有循環。
  mcq:
    question: 全部 5 個任務中只能排 3 個，且所有已知節點邊都正確建圖，能確定什麼？
    options:
    - 剩餘 2 個一定都在同一個環
    - 至少有一個環
    - 一定是孤立節點造成
    - 只要重排佇列就可排完
    answer: 1
    explain: 減不掉的入度證明存在環，但部分剩餘點可能只是下游。
- id: cr-code-05-self
  prompt: 任務依賴自己會怎樣？
  answer: 一條自環入邊永遠無法解除，應判成循環。
  mcq:
    question: 任務 A 的唯一依賴是 A，它有機會進入零入度佇列嗎？
    options:
    - 初始化會進入
    - 第二輪自動進入
    - 不會，因為入度為 1
    - 有沒有其他節點決定
    answer: 2
    explain: 其他節點不會解除 A 的自我依賴。
- id: cr-code-05-direction
  prompt: graphlib 的字典值和本課手寫鄰接表方向有何不同？
  answer: graphlib 的值是鍵的前置集合；手寫鄰接表的值是鍵的下游清單。
  interview:
    question: 排程發現一個環，為什麼不把所有未排任務標成環成員？
    answer: 例如 A 與 B 互等，C 只等 B，C 也卡住卻不在環上。我會先報未排集合，再用具體循環路徑協助定位，不把兩種訊息混在一起。
    points:
    - 能提供下游反例
    - 區分路徑和影響
    - 不稱未執行為失敗
- id: cr-code-05-validate
  prompt: 邊的端點不在任務清單時，是發現環嗎？
  answer: 不是；設定不合法，要先回報缺少的任務名稱。
  mcq:
    question: 清單只有 extract、report，卻出現 verify → report，先回報什麼？
    options:
    - report 在循環上
    - extract 已成功
    - verify 未定義
    - 所有任務都能跑
    answer: 2
    explain: 輸入要先成立才能談循環，未定義不等於有環。
practice:
- id: cr-code-05-p1
  kind: code
  minutes: 9
  title: 交付一份卡住任務的診斷
  steps:
  - 執行 cycle_check.py。
  - 另加一個 a 指向 a 的自環測試，再拿掉互等的反向邊。
  checks:
  - 互等時剩餘 a、b、report，不含 backup。
  - 拿掉環之後所有任務都可排序。
---

## 有些任務可以跑，不代表全部能跑

在〈[圖與拓撲排序](#/lesson/fd-algo-09)〉，我們用入度排出先後。面試題換成驗證一份排程設定：a 等 b、b 等 a，報表只等 b，而備份獨立。這時不只要回答是否有循環（cycle），還要告訴維運哪些工作可能受影響。Kahn 拓撲排序演算法用零入度佇列逐步解除依賴；輪到佇列空了，未排的節點還有正入度，就不能給出完整順序。

例子中 a 與 b 都不會變成零入度，報表也在等，但報表沒有回頭指向 a 或 b。要證明哪條路才是環，得另找一條能回到起點的依賴路徑，不能只重述剩下有哪些節點。如果要讀現有 API，Python 的 `TopologicalSorter` 吃的是「任務 → 前置任務」，與本例建的「前置 → 下游」不同；看到結構相同時，先確認值的方向。

## 印出排得出來與排不出來的兩組

在 `C:\dev\conduit-lab\coding` 存 `cycle_check.py`，於該資料夾執行 `py cycle_check.py`。任務清單定義全集；邊的兩端都要存在。

```python
from collections import deque

def diagnose(tasks, edges):
    inbound = dict.fromkeys(tasks, 0)
    children = {task: [] for task in tasks}
    for first, later in edges:
        children[first].append(later)
        inbound[later] += 1
    queue = deque(task for task in tasks if inbound[task] == 0)
    ready_order = []
    while queue:
        task = queue.popleft()
        ready_order.append(task)
        for later in children[task]:
            inbound[later] -= 1
            if inbound[later] == 0:
                queue.append(later)
    blocked = [task for task in tasks if inbound[task] > 0]
    return ready_order, blocked

tasks = ["a", "b", "report", "backup"]
edges = [("a", "b"), ("b", "a"), ("b", "report")]
order, blocked = diagnose(tasks, edges)
assert order == ["backup"]
assert blocked == ["a", "b", "report"]
assert diagnose(tasks, [("a", "b"), ("b", "report")])[1] == []
print("Sortable:", order, "Blocked:", blocked)
```

兩組名單表示靜態可排序性，不意味已執行或有權部分發布。面試追問時先確認呼叫者要在有環時整份拒絕，還是預覽不受影響任務；後者也不能默默改動真實排程。掃描總成本 `O(V+E)`，因為每個任務入列至多一次，每條邊最多被解除一次。自環是最後必測的小案例：只有 a 且 a 指向自己時，兩組應是空與只含 a。

### 用一張紙區分三種訊息

先畫 a 指向 b、b 指回 a、b 再指向 report，獨立的 backup 沒有箭頭。初始化只有 backup 可排；取出後不會為另外三個點減入度。這時至少一條循環是 a 到 b 再回 a，影響清單則還要包含 report。若把 report 刪掉，環仍在；若只拿掉 b 回到 a 的邊，a 能先解鎖 b，接著解鎖 report。把這些細節寫進診斷，比一句「排程有問題」更能讓人定位。

診斷資訊可以分三層：能否完整排序、哪些點被阻塞、哪一段邊構成環的證明。這堂函式實作前兩層，沒有重建循環路徑；如果面試官追問第三層，可以提議另對剩餘子圖做深度優先，只把指回目前走訪路徑的邊當作環的線索，而非把所有已走過的頂點都當成循環。在真實設定裡還要先驗未知任務與重複定義；那是輸入不合法，不應冒充合法圖中真的有環。可以先在測試表上分開記「圖錯了」與「圖合法但排不完」。前者的回應要指出未知名稱；後者則要讓維運知道卡住範圍。縮小案例之前，先不要把能排到的節點誤當成真的執行成功。

## 常見錯誤

- 備份從清單消失 → 從邊推全集漏了孤立任務 → 先列所有任務。
- 報表被誤標為環成員 → 把未排清單當循環證據 → 另找真正繞回的路徑。
- 任何第二次探訪都當環 → 匯合點也可能被多方指向 → 檢查依賴方向與剩餘入度。
