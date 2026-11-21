---
id: fd-algo-06
module: fd-algo
order: 6
title: 排序與二分搜尋
subtitle: 在已排序日誌中找界線
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-05
objectives:
- 用排序鍵排列日誌且保持同鍵的輸入相對順序
- 求出第一筆不早於某分鐘的索引
- 驗證重複值與查不到時的回傳
tags:
- 排序鍵
- 二分搜尋
- bisect_left
- 邊界
resources:
- title: Python：排序指南
  url: https://docs.python.org/3/howto/sorting.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 key functions 和 sort stability。
- title: Python：bisect
  url: https://docs.python.org/3/library/bisect.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 bisect_left 的插入點定義。
concepts:
- id: fd-algo-06-stable
  prompt: 排序穩定性保證什麼？
  answer: 排序鍵相同時，元素維持原先的相對次序。
  mcq:
    question: 兩筆同分鐘的日誌以分鐘穩定排序後會怎樣？
    options:
    - 自動按事件 ID 排
    - 保留彼此的輸入順序
    - 自動去重
    - 總是顛倒順序
    answer: 1
    explain: 排序只比較指定鍵；穩定性不添加新排序規則，也不去重。
- id: fd-algo-06-boundary
  prompt: 二分下界比找到任一相等值多保證了什麼？
  answer: 回傳第一個大於或等於目標的位置；若沒有符合者則回傳長度。
  mcq:
    question: '[2, 5, 5, 8] 對 5 求下界（索引從 0 起）得到？'
    options:
    - '1'
    - '2'
    - '3'
    - '4'
    answer: 0
    explain: 索引 1 已是第一個不小於 5 的位置。
- id: fd-algo-06-precondition
  prompt: 若只有一次查找且日誌未排序，何時直接掃更合理？
  answer: 只需一次就能以線性掃描找出符合條件的最小鍵，不必先付排序成本。
  interview:
    question: 每天要對同一份日誌切出許多時間區間，你會怎麼做？
    answer: 我會先把日誌按分鐘排好，保留同分鐘的處理規則，再用兩次下界得到起點和不含右端的終點。如果只有一次查詢，我會比較直接掃描的成本。
    points:
    - 先說有序前提
    - 分清兩端排除規則
    - 計入準備成本
practice:
- id: fd-algo-06-p1
  kind: code
  minutes: 9
  title: 用三個閾值驗證下界
  steps:
  - 執行 log_boundary.py。
  - 增加比所有值大、比所有值小、落在兩個值之間的三組斷言。
  checks:
  - 查 50 得 0，查 100 得 4。
  - 查 65 得索引 3，不是找不到就回 -1。
---

## 先把能問的問題排成一條界線

維運要查每日匯出第一筆不早於第 60 分鐘的日誌。排序（sorting）把鍵排成固定順序；在〈[排序鍵](#/lesson/fd-data-05)〉用過的 `sorted(rows, key=...)` 會產生新陣列，`rows.sort(key=...)` 則原地修改並回傳 `None`。預設升序，可用 `reverse=True` 反向。本例取每列的分鐘欄，對同分鐘日誌不再指定第二鍵；Python 排序有穩定性（stability），所以同鍵會維持輸入的相對次序，不代表已按真實事件時間排好。

在排序後的分鐘中，目標左方全是「小於」，右方全是「不小於」。二分搜尋（binary search，亦稱折半查找）就是找這條分界。這裡求下界（lower bound）：第一個大於或等於目標的位置。搜尋期間把答案放在從 `lo` 到 `hi` 的界線之中；一開始右界是陣列長度，代表沒有符合者時也能回傳合法界線。

## 手寫後和標準函式對答案

在 `C:\dev\conduit-lab\algorithms` 存成 `log_boundary.py`，於該資料夾執行 `py log_boundary.py`。

```python
from bisect import bisect_left

def lower_bound(values, target):
    lo, hi = 0, len(values)
    while lo < hi:
        mid = (lo + hi) // 2
        if values[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo

rows = [(70, "E3"), (60, "E2"), (55, "E1"), (60, "E4")]
ordered = sorted(rows, key=lambda row: row[0])
minutes = [row[0] for row in ordered]
start = lower_bound(minutes, 60)
assert start == bisect_left(minutes, 60) == 1
assert lower_bound([], 60) == 0
assert ordered[start] == (60, "E2")
print(ordered[start:])
```

遇到小於目標的中點，中點本身與之前都可排除；遇到相等或更大的中點，答案可能恰是中點，因此把右界移到中點，不提前回傳。每次排除約一半，查一次要對數時間。先排序與另外建立分鐘列也有成本；若只是想找一次不早於門檻的最小分鐘，掃未排序輸入一次就能做完。有多次查詢才更容易攤平準備工作。

要取得從 60 分鐘起但不含 70 分鐘的日誌，對兩個門檻分別求下界，再用這兩個索引切片。這是半開區間（half-open interval）：含起點、不含終點，能讓相接的批次不重複計算端點。〈[區間合併](#/lesson/cr-code-03)〉會進一步比較相接是否算重疊。

### 把搜尋答案理解成插入點

用分鐘 55、60、60、70 對目標 60 手追：中點先碰到後一個 60，但第一個相等值可能更靠左，因此收右界。等兩界相遇在索引 1，才知道左側都比目標小。若目標是 65，沒有相等列也會得到位置 3，因為如果把 65 插進去，該位置才能保持升序。兩種結果都可回傳位置，只有在另外問「有沒有精確命中」時，才檢查位置未超界且該值等於目標。

Python 標準庫另有 `bisect_right`，它會跳過等於門檻的列，找第一個嚴格更大的位置。想抽出所有分鐘等於 60 的記錄，可以用左插入點作起點、右插入點作終點。若要因為新到一筆而插到已排序陣列中，不要誤把找到插入位置的對數時間當作整次插入的時間：位置找到後，後面的格子可能仍得移動。若只是讀取時間段，就不需要做這個插入動作。

## 常見錯誤

- 有重複時只找到中間那筆 → 相等就返回 → 讓右界向左收斂。
- 目標比全部大時出現索引錯誤 → 長度是界線而非元素 → 先判斷結果是否等於長度。
- 用降序輸入卻沿用相同判斷 → 兩側前提反了 → 改回升序或重寫排除依據。
