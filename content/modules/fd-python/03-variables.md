---
id: fd-python-03
module: fd-python
order: 3
title: 變數與賦值
subtitle: 留下尚未扣款的餘額
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-02
objectives:
- 按先右後左的順序追蹤賦值
- 在更新餘額前用另一個名稱保留舊整數
- 替變數名稱寫出用途與單位
tags:
- 變數
- 賦值
- 重新賦值
- 命名
resources:
- title: Simple statements
  url: https://docs.python.org/3/reference/simple_stmts.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 Assignment statements 開頭，對照先求值再綁定名稱。
concepts:
- id: fd-python-03-read-right
  prompt: balance = balance - 30 怎麼執行？
  answer: 先用更新前的 balance 取值與運算，再把結果交給左側名稱。
  mcq:
    options:
    - 先用舊值計算，再綁定新值
    - 先把 balance 清零，再減 30
    - 把兩邊當數學方程求解
    - 把 balance 永遠綁成「每次讀取就再扣 30」
    answer: 0
    explain: 右邊只在執行這行時算一次；之後讀名稱拿的是已更新的值。
- id: fd-python-03-keep-old
  prompt: balance 為 120；先做 before = balance，再將 balance 更新為 90。before 是多少？
  answer: 120；另一個名稱 balance 改指新整數不會改掉舊整數。
  mcq:
    options:
    - '90'
    - '30'
    - '120'
    - 取決於 print 的先後
    answer: 2
    explain: 兩個名稱先指向同一個整數，重新賦值只替換左邊指定的名稱。
- id: fd-python-03-units
  prompt: 要記錄「扣款金額，整數分」以便加減，哪個寫法最清楚？
  answer: fee_cents = 30；單位說明可放進名稱，不混入數值。
  mcq:
    options:
    - fee = "30 cents"
    - fee_cents = 30
    - fee = "30"
    - 30 = fee_cents
    answer: 1
    explain: 前兩種文字寫法不能直接拿去當整數運算；數字也不能當賦值的左側名稱。
practice:
- id: fd-python-03-p1
  kind: code
  title: 留下可驗算的兩次扣款
  minutes: 8
  steps:
  - 儲存正文的 balance.py 並核對初版輸出。
  - 另存 balance_twice.py，在第一次扣完後另設 second_fee_cents = 10，更新餘額再印出。
  checks:
  - 最初仍是 120、第一次扣款後 90、第二次扣完是 80。
  - 在學習筆記用三行記錄每次更新後的名稱和值。
---

匯入批次要扣掉處理費，營運要在同一張核對表看到扣款前與扣款後。你可以手寫兩個數字，但下次費用一變就會漏改。今天讓程式自己算，並先留下原值。這一課的金額用整數分表示，不必碰小數的精度問題。

## 等號是一次動作

變數（variable）是你替值取的名稱；賦值（assignment，台灣也稱指定）用 `名稱 = 值或算式`。先算等號右側，再把得到的值綁到左側的名稱。`balance_cents = balance_cents - 30` 不是要解一個方程式，而是先拿舊餘額減掉 30，再把結果交給餘額這個名稱。把已經存在的名稱綁到新值，叫重新賦值（reassignment）。

名稱可以用英文字母、數字和底線，不能以數字起頭；大小寫不同會被視為不同名稱。避開 Python 保留的字（例如 `for`，之後的[〈for 與 while〉](#/lesson/fd-python-09)會用到），也不要拿 `print` 這種現成工具的名稱當自己的數據欄位。`fee_cents` 同時說明用途和單位，數值則只放可計算的 30。比較兩個值要用的符號不是單等號；[〈布林與比較〉](#/lesson/fd-python-06)會教怎麼問兩個值是否相等。

## 沿著腳本走三步

在 `C:\dev\conduit-lab\python` 存成 `balance.py`，執行 `py balance.py`。你可以先在紙上畫出名稱、當前值兩欄：每讀到一個等號，只改左邊那格。

```python
balance_cents = 120
fee_cents = 30
before_cents = balance_cents
balance_cents = balance_cents - fee_cents
print("before", before_cents)
print("after", balance_cents)
```

建立 `before_cents` 時，`balance_cents` 還指向 120。下一行算出 90，改綁的只有左側 `balance_cents`，沒有回去重算上一行。結果應是 `before 120`、`after 90`。若先更新後才保存，兩個欄位都會變成 90：計算本身沒有錯，但證據被你在錯誤的時間點擷取。

這個結論針對整數等不會在原處被改寫的值；「多取一個名字」不等於複製任何內容。之後在[〈列表與索引〉](#/lesson/fd-python-08)會碰到可以原地修改的數據，兩個名稱可能真的看見同一份更新。

## 跟著名稱做第二次扣款

先在紙上寫下初始餘額 120。讀到第一筆費用時，新增「費用 30」，別把紙上所有看見的 120 一起劃掉。下一步把「扣款前」記成 120；程式更新餘額後，紙上只把「餘額」一格改成 90。這個逐行表能驗收哪一行改了哪個名稱，並能更快找出重複扣款。

做第二筆扣款時，先決定報表要驗哪三個時間點：第一筆前、第一筆後、第二筆後。想讓三個都在最後同時可讀，就在第二次扣費前再保存一次當時的餘額；不要拿已存的第一筆前金額去減第二筆費用。兩筆處理費分別是 30 和 10，差異表應從 120 到 90，再到 80。若得到 110，表示第二次可能拿最初餘額當起點。看到錯的數字先查賦值順序，再調整算式。

## 常見錯誤

- 找不到 `balance_cents`，出現 `NameError` → 名稱拼法不一致或還沒賦值 → 從第一次使用往上找有沒有完全同名的賦值。
- 扣款前和扣款後一樣 → 保存舊值的那行在更新之後 → 將它移到更新前。
- 做減法卻報類型錯誤 → 把金額連單位存成字串 → 名稱用 `_cents` 標單位，值保留整數。
