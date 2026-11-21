---
id: fd-python-09
module: fd-python
order: 9
title: for 與 while
subtitle: 遇到結束記號就停下
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-08
objectives:
- 用 for 逐筆累計並在結束記號處停下
- 用 while 搭配條件與更新可用重試次數
- 區分走訪既有值與用 range 產生整數
tags:
- for
- while
- break
- range
- 累計
resources:
- title: 深入了解流程控制
  url: https://docs.python.org/zh-tw/3/tutorial/controlflow.html
  kind: doc
  lang: zh-Hant
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 for、range 和 break；略過迴圈的 else。
concepts:
- id: fd-python-09-for-value
  prompt: for pieces in [12, 9] 的第一輪，pieces 是什麼？
  answer: 是 12，for 逐筆交來列表中的值，不是索引。
  mcq:
    options:
    - '0'
    - '1'
    - '12'
    - 整個列表
    answer: 2
    explain: 直接走訪列表得到值；只有有意產生位置時才需要整數序列。
- id: fd-python-09-stop-break
  prompt: 遇到 STOP 後要連後面的補登也不處理，應用什麼？
  answer: 在判斷到 STOP 時執行 break，結束目前迴圈。
  mcq:
    options:
    - 只印一個 STOP
    - 把 STOP 當 0 後加總
    - 重設 total 後繼續
    - 在該分支 break
    answer: 3
    explain: 提示或跳過單筆都會繼續讀；這裡的 STOP 意味整個有效區段到此為止。
- id: fd-python-09-while-progress
  prompt: while retries_left > 0 若每輪都不更新 retries_left，會怎麼樣？
  answer: 如果一開始大於零且無其他停止途徑，它會不停重複。
  mcq:
    options:
    - Python 會自動減到 0
    - 條件一直真，可能無限迴圈
    - 只執行一次
    - 一律不進入迴圈
    answer: 1
    explain: while 不替你推進狀態，每輪要能改變條件或結束。
- id: fd-python-09-range-end
  prompt: range(1, 4) 產生哪些整數？
  answer: 1、2、3，不包含上界 4。
  mcq:
    options:
    - 1、2、3
    - 1、2、3、4
    - 0、1、2、3
    - 只有 4
    answer: 0
    explain: 第一個參數指定起點，第二個指定不包含的停止點。
  interview:
    question: 日報比預期多算了結束記號之後的數據，你怎麼查？
    answer: 我用幾列小樣保留停止記號前後各一筆，逐輪看是否先檢查記號，再轉成數字累加。記號後那筆不應出現在小計，否則檢查是只跳過當筆還是確實結束。
    points:
    - 前後都放測資
    - 先檢查記號再轉換
    - 用小計證明提前停止
practice:
- id: fd-python-09-p1
  kind: code
  title: 留下結束記號的反例
  minutes: 9
  steps:
  - 保存 batch_loop.py，確認原始清單的總量與兩次重試輸出。
  - 另存副本，把 STOP 往前移到第一個元素之後，其他元素照舊。
  checks:
  - 總量從 21 改為 12；99 兩個版本都不計入。
  - '第二段各印 retry left: 2、retry left: 1，然後結束。'
---

到貨批次有 2 筆真實數量，後面出現 `STOP`，再後面還有一筆不應計入的測試數據。每天靠手看很容易多算。迴圈（loop）反覆執行同一段規則；寫之前先決定每輪處理什麼、什麼時候停。

## 兩種走法，兩種停止條件

- `for item in amounts:` 依序取現有列表的值，每輪綁給 `item`，讀完就停。若只要產生編號，`range(3)` 產生 0、1、2；`range(1, 4)` 則產生 1、2、3，終點不包含。
- `while 條件:` 每輪開始前先看條件；只有仍為真才執行。必須想清楚讓條件變假的更新，否則可能停不下來。
- `break` 立刻離開所在的那一層迴圈。本例是遇到結束記號就不再走訪後續數據。
- 累計（accumulation）在迴圈前先給總數一個起值，迴圈內只更新。放進迴圈每輪重新設為 0，會把前一輪的成果擦掉。

## 把小計和重試次數分開看

在 `C:\dev\conduit-lab\python` 存成 `batch_loop.py`，執行 `py batch_loop.py`。這批數字以已知有效的整數文字表示；只要看到 `STOP`，就先離開，不試著把它轉成整數。

```python
counts = ["12", "9", "STOP", "99"]
total = 0
for text in counts:
    if text == "STOP":
        break
    total = total + int(text)
    print("subtotal:", total)
print("total:", total)

retries_left = 2
while retries_left > 0:
    print("retry left:", retries_left)
    retries_left = retries_left - 1
```

逐輪應印小計 12、21，總量 21。`99` 還在列表，但沒有走訪到那一筆。後面的 `while` 是另一個獨立例子，模擬重試額度，每輪扣 1，印完 2、1 後條件變假。若初始額度設為 0，這段應完全不印。真的誤寫成不停的迴圈時，回到 PowerShell 用 **Ctrl＋C** 中斷，再修更新式。

## 停下來的位置比總數更能定位錯誤

先把三輪預期寫出來：第一輪讀到文字 12，小計 12；第二輪讀到文字 9，小計 21；第三輪看見 `STOP`，沒有小計。第四筆雖然仍在原列表，卻不應進入迴圈區塊。若只有總數不對，先看最後一個正確的小計，再比對下一筆來源；不用一開始就把所有條件一起改。把結束記號移到第一筆之後，末筆仍然不應被處理；這是比只試一個固定位置更有力的驗證。

重試的迴圈另記「讀條件時的額度」和「這輪結束後的額度」。初值 2 時，更新依序是 2 變 1、1 變 0，下一輪看見 0 就不進入。若把扣除那行縮排退到外面，它反而等不到迴圈停止才會執行。用初始額度 0 的案例可以證明這不是至少跑一次的設計；初始額度 2 則證明每次執行確實有向停止條件推進。

如果來源的列表已經有各筆數據，直接走訪值最省事；自己生位置只在要對照第幾列時有用。不必為了讓 `for` 看起來像 `while` 而額外維護位置。稍後在[〈迭代器與生成器〉](#/lesson/fd-tools-03)會看到數據也可以逐筆產生，不必先把所有來源放進同一個列表。本堂先用四筆固定樣本，把要處理與不該處理的範圍說清楚。

## 常見錯誤

- 印出總量 9 → 在迴圈裡每輪把總量歸零 → 把起值移到迴圈前。
- `int("STOP")` 報錯 → 先轉換才檢查記號 → 先判斷和 `break`。
- 特定輸出一直刷出來 → `while` 每輪沒改變停止條件 → 確認扣除額度的那行位於迴圈內。
