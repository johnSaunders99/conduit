---
id: fd-python-08
module: fd-python
order: 8
title: 列表與索引
subtitle: 取出清單最後一筆
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-07
objectives:
- 用 0 與 -1 讀取非空列表首尾兩筆
- 就地校正某筆而不增加列表長度
- 使用 append 和 pop 更新尾端並核對回傳值
tags:
- list
- 索引
- append
- pop
resources:
- title: Data Structures
  url: https://docs.python.org/3/tutorial/datastructures.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 More on Lists，對照 append、pop 的用途。
- title: An Informal Introduction to Python
  url: https://docs.python.org/3/tutorial/introduction.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Lists，核對索引從零開始和原地修改。
concepts:
- id: fd-python-08-index-last
  prompt: 3 筆數據的最後一筆，哪個寫法必定取到？
  answer: 對有 3 筆的列表用 amounts[-1]。
  mcq:
    options:
    - amounts[3]
    - amounts[-1]
    - amounts[0]
    - amounts[len(amounts)]
    answer: 1
    explain: 有效正索引 0、1、2；用 -1 從尾端數第一筆。
- id: fd-python-08-change-one
  prompt: 要修掉第 2 筆錯值但不增減筆數，應怎麼做？
  answer: 用 amounts[1] = 新值，改既有位置。
  mcq:
    options:
    - amounts.append(新值)
    - amounts.pop()
    - amounts[2] = 新值
    - amounts[1] = 新值
    answer: 3
    explain: append 會增加一筆，pop 會移除；索引 1 才是第 2 筆。
- id: fd-python-08-pop-return
  prompt: amounts.pop() 做了哪兩件事？
  answer: 移除尾端項目並交回它，所以能用 removed = amounts.pop() 記下它。
  mcq:
    options:
    - 移除最後一筆並交回那筆
    - 只看最後一筆，內容不變
    - 刪掉最後一筆但一定回傳 0
    - 修改第一筆並把長度減一
    answer: 0
    explain: 要讀取不變更，用 [-1]；pop 本身會變更列表。
- id: fd-python-08-same-list
  prompt: backup = amounts 後修改 amounts[1]，backup 會看到舊值嗎？
  answer: 不會；這裡兩個名稱指同一個可變列表，改列表本身會同時看見。
practice:
- id: fd-python-08-p1
  kind: code
  title: 驗收一次校正與一次撤回
  minutes: 8
  steps:
  - 存下 arrivals.py，記錄正確的中間那筆與移除值。
  - 另存副本，把追加的 20 改為 25，確認撤回的是哪一筆。
  checks:
  - 兩個版本最後都剩 [12, 9, 15]，長度 3。
  - 移除值各為 20 和 25；calibrated 行不會顯示 4 筆。
---

三個棧板依到貨順序記下件數：12、8、15。第二筆事後發現少記 1 件，還有一筆 20 件的測試數據要確認能撤回。不同的動作有不同影響：校正是改原本的一格，新增和移除才會變動筆數。

## 位置不是筆數

列表（list，台灣也稱串列）把多個值依順序放進一個值。寫法是 `[12, 8, 15]`，以逗號分隔；空列表寫作 `[]`。索引（index）是位置，從 0 開始；三筆的位置依序為 0、1、2。`len(amounts)` 是筆數 3，而非最後的位置。`-1` 表示從尾端往回第一筆，空列表沒有這個位置。

- `amounts[0]` 讀第一筆；`amounts[-1]` 讀最後一筆，不改列表。
- `amounts[1] = 9` 原地修改第 2 筆。這和讓 `amounts` 指向整個新列表不同。
- `amounts.append(20)` 加到末端；`amounts.pop()` 拿走末端並回傳被拿走的值。

## 用長度驗收每一步

在 `C:\dev\conduit-lab\python` 儲存 `arrivals.py`，執行 `py arrivals.py`。先預測改完第 2 筆時筆數是否會動，再看追加與撤回。

```python
amounts = [12, 8, 15]
print("first and last:", amounts[0], amounts[-1])
amounts[1] = 9
print("calibrated:", amounts, len(amounts))
amounts.append(20)
print("appended:", len(amounts))
removed = amounts.pop()
print("removed:", removed)
print("kept:", amounts, len(amounts))
```

第一行應印 12 和 15。校正結果為 `[12, 9, 15]`，仍是 3 筆；追加後 4 筆，撤回後又是 3 筆，被移除的是 20。列表是可變（mutable）的，意思是同一個列表可以在原地修改。如果只寫 `backup = amounts`，這不是做了副本；兩個名稱仍會看到同一份改動。之後在[〈切片與元組〉](#/lesson/fd-data-01)會介紹如何另取一段，以及何時需要固定內容。

## 三種操作要看不同證據

用筆記把原案例拆成三段。校正時，核對第二筆從 8 到 9，第一筆和第三筆沒動；只查長度 3，抓不到改錯格。追加時，確認新值出現在尾端且長度增加，避免把原本最後一筆覆寫。撤回時，核對交回的值等於新追加的值，並確認原始三筆的內容和順序維持不變。單看「長度回到 3」抓不到拿錯一筆的問題。

你也可以在副本試一個空到貨批次：把開頭的列表變成 `[]`，先只印 `len(amounts)`，應得到 0。要取尾端前，可以沿用上一堂的條件分支，用 `if len(amounts) > 0:` 保護取值；空批次就印另一種提示，而不是造一筆 0 件的紀錄冒充到貨。這裡「沒有紀錄」和「有一筆件數為 0」不是同一件事。

若同事請你保留校正前的清單，想一想整數的小抄為何不能直接搬來。上一堂餘額案例是改綁名稱，不動舊整數；此處 `amounts[1] = 9` 是更動列表本身，因此兩個指向它的名稱都看見 9。要查原先的 8，可以先拿出那一格整數另存，或在後續學會複製列表後保存獨立版本。把內容是否原地改動想清楚，才能在大量數據上真正留住對照。

這份列表雖有順序，但不是依件數排好；最後一筆是最後收到的，不一定是最大件數。遇到「找最新」時，要先確認來源本來就按時間排，也就是位置和業務順序是否一致。列表只保存你給它的順序，不會自動幫你排序。

## 常見錯誤

- `IndexError` → 用長度當索引，或對空列表取最後一筆 → 先確認非空，再取 `[-1]`。
- 校正後多了一筆 → 把修改寫成 `append` → 對既有索引賦值。
- 只是想看最後一筆卻少了一筆 → 用了會移除的 `pop()` → 改用 `amounts[-1]`。
