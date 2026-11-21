---
id: fd-algo-04
module: fd-algo
order: 4
title: 雙指標與滑動窗口
subtitle: 不重算整段區間
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-03
objectives:
- 在已排序的金額中找兩筆和為目標的訂單
- 以加新值減舊值更新固定寬度的分鐘窗口
tags:
- 雙指標
- 滑動窗口
- 區間加總
resources:
- title: NeetCode 150 練習清單
  url: https://neetcode.io/practice/practice/neetcode150
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 找 Two Pointers、Sliding Window 的免費題。
concepts:
- id: fd-algo-04-discard
  prompt: 兩端總和過小時，為何能排除左端？
  answer: 現有右端已是最大搭檔，左端配上任何更小值也達不到目標。
  mcq:
    question: 升序 [2, 4, 7, 9] 要找和 13，第一步為何移左？
    options:
    - 左端比較靠近目標
    - 右端是 2 能配到的最大值，和仍太小
    - 右端一定屬於答案
    - 有兩個指標所以必須輪流移動
    answer: 1
    explain: 排除理由只來自已排序與目前範圍，不能推論右端一定是答案。
- id: fd-algo-04-window
  prompt: 固定寬度窗口右移時，總和要怎麼改？
  answer: 扣掉離開的最左值，加上進來的右側值。
  mcq:
    question: '[4, 1, 7] 的前 2 格滑到後 2 格，怎樣更新總和？'
    options:
    - 5 加 7
    - 5 減 1 加 7
    - 5 減 4 加 7
    - 5 減 4 加 1
    answer: 2
    explain: 離開的是 4，進來的是 7，1 留在窗口。
- id: fd-algo-04-calendar
  prompt: 缺了一分鐘時，固定 3 筆還等同固定 3 分鐘嗎？
  answer: 不一定；先補上有意義的零或改按時間戳界線，再計算。
  interview:
    question: 遇到負金額，所有滑動窗口都不能用嗎？
    answer: 固定寬度加減仍成立。如果題目是靠總和達標才縮窗口，負數會破壞擴大總和必升的推論，我會重查排除條件。
    points:
    - 區分固定與可變窗口
    - 指出負數破壞單調性
    - 先驗證前提
practice:
- id: fd-algo-04-p1
  kind: code
  minutes: 9
  title: 比對一次兩指標與窗口的邊界
  steps:
  - 執行 pointers.py，把兩種操作的最小輸入寫成斷言。
  - 將固定窗口寬度設成輸入長度，核對只產出一個總和。
  checks:
  - 只剩同一位置時不能配對。
  - 使用 [4, 1, 7]、寬度 3 得 [12]。
---

## 移動指標的理由比移動更重要

客戶要找兩筆不同的已付款訂單，湊成指定金額。金額已升序時，雙指標（two pointers）用兩個索引表示還沒排除的左右端點。兩端和太小：目前右端已經是左端能配到的最大值，因此排除左端。和太大：目前左端已經是右端能配到的最小值，因此排除右端。等於目標就回傳位置。用 `left < right` 保證不會把同一筆算兩次；相同金額若在不同位置，則可以配對。沒有排序就沒有這項排除依據；若要補排序又須保留原列號，可以一起存金額與原位置。

滑動窗口（sliding window，台灣也稱滑動視窗）也用兩個邊界，但保留的是相鄰的一段。固定 2 分鐘的登入總數每右移一格，只要減掉離開的值、加上新值。下方函式約定每一格是一個連續分鐘，寬度不合法時回傳空陣列。這不是「任取兩筆」，中間的值不能跳過。窗口與時間標記的關係，之後在〈[滾動與滑動窗口](#/lesson/bd-flink-04)〉會繼續用到。

## 跑兩種不重算的掃描

在 `C:\dev\conduit-lab\algorithms` 存成 `pointers.py`，於該資料夾執行 `py pointers.py`。

```python
def find_pair(amounts, target):
    left, right = 0, len(amounts) - 1
    while left < right:
        total = amounts[left] + amounts[right]
        if total == target:
            return left, right
        if total < target:
            left += 1
        else:
            right -= 1
    return None

def window_totals(counts, width):
    if not 1 <= width <= len(counts):
        return []
    total = sum(counts[:width])
    result = [total]
    for right in range(width, len(counts)):
        total += counts[right] - counts[right - width]
        result.append(total)
    return result

assert find_pair([2, 4, 7, 9], 13) == (1, 3)
assert find_pair([5], 10) is None
assert window_totals([4, 1, 7], 2) == [5, 8]
print(window_totals([4, 1, 7], 2))
```

前例第一對是 2 加 9，不夠 13，因此左端右移，下一對正好成功。窗口例先加總 4 和 1，再扣 4 加 7，保留中間的 1。兩者在既有陣列上都是線性時間；配對只保留幾個變數，窗口版本除了輸出，初次切片還暫存了寬度那麼多的值。不能光憑每步移動一次，就說整個函式沒有額外配置。

缺失的一分鐘和確實沒有事件不同。若你只收到 09:00、09:01、09:05 三筆，直接取 3 筆不叫三分鐘；要先核對缺值口徑，再補格或依時間做界線。若題目要找「至少達標的最短段」，也不能照抄固定寬度：有負增量時，擴大區間不一定增加總和。先說出為何可以扔掉某段，再寫移動規則。

### 畫出還不能丟掉的區段

目標若改為 8，用 2、4、7、9 手追：先遇到 2 加 9 太大，捨右；改成 2 加 7 仍太大，再捨右；2 加 4 太小，左端右移，此時兩端相遇。這不是說「值太大的一定沒用」，而是站在目前還沒排除的範圍內，右端已連最小搭檔都太大。每丟掉一端，都要能說明同一筆不可能和剩下的任何值成功配對。

用相同的排除想法核對窗口：寬度 2 時，原來的第二格應該留下。若寬度改 1，加上新格、減掉舊格後應等於新格本身。寬度等於長度時，沒有新值可以移入，所以只能產生一次加總。若無法用這兩個最小情況說清哪一格留下來，就先畫出窗口再寫索引。

## 常見錯誤

- 未排序的數列漏掉配對 → 兩端不再是極值 → 按同一鍵排序或改用雜湊。
- 最後一格與自己配對 → 使用了小於等於 → 條件改成 `left < right`。
- 值永遠偏大 → 只加新值未扣舊值 → 手追一次滑動驗算。
