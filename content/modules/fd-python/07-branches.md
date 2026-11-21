---
id: fd-python-07
module: fd-python
order: 7
title: 條件分支
subtitle: 把退款跟訂單分流
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-06
objectives:
- 以 if、elif、else 把負額、正額、零分到不同狀態
- 用縮排標明只在該分支執行的指令
- 以三個相鄰值驗證分流互斥
tags:
- if
- elif
- else
- 縮排
resources:
- title: 深入了解流程控制
  url: https://docs.python.org/zh-tw/3/tutorial/controlflow.html
  kind: doc
  lang: zh-Hant
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 if 陳述式，觀察多條條件如何依序選一條。
concepts:
- id: fd-python-07-first-match
  prompt: 同一組 if / elif 有兩個條件都為真，執行哪些區塊？
  answer: 只執行先遇到為真的那一個；後面的 elif 不再判斷。
  mcq:
    options:
    - 兩個都執行
    - 只執行最後一個
    - 只執行第一個符合的區塊
    - 改成走 else
    answer: 2
    explain: 同一組分支是互斥的；獨立的兩個 if 則各自判斷。
- id: fd-python-07-zero-route
  prompt: if amount < 0 後接 elif amount > 0，何時會走 else？
  answer: amount 為 0 時，這兩個比較都不成立。
  mcq:
    options:
    - amount 是 -1
    - amount 是 0
    - amount 是 1
    - 任一比較為真時
    answer: 1
    explain: else 接的是前面的條件全不成立的情形。
- id: fd-python-07-indentation
  prompt: 要讓 print("refund") 只在退款條件成立時執行，應怎麼排？
  answer: 把它放進對應 if 的區塊，通常比 if 多縮排 4 個空格。
  mcq:
    options:
    - 和 if 對齊
    - 和 else 對齊並移到最後
    - 在 if 前面執行
    - 放在 if 下方並向右縮排 4 格
    answer: 3
    explain: 縮排是語法，不是排版喜好；退回外層就不屬於該分支。
- id: fd-python-07-broad-first
  prompt: 為何不能先用 amount >= 0 代表訂單，再用 elif amount == 0 來隔離零元？
  answer: 0 先符合 >= 0，且後面的 elif 不會再執行；訂單應用 > 0，或先明確處理 0。
practice:
- id: fd-python-07-p1
  kind: code
  title: 保留一張三路分流卡
  minutes: 8
  steps:
  - 在 route_order.py 依序測 -1、0、1，每筆儲存後執行。
  - 把金額、命中的分支與輸出抄到 routes.txt。
  checks:
  - 三筆各只輸出一行；依次是 refund、review_zero、sale。
---

帳務數據用負數記退款、正數記訂單，0 分要送人工確認。上一堂會問真假，這堂要讓真假導致不同的動作。一筆數據只能進一條路；若一筆結果同時印「退款」與「待確認」，下游就不知道以誰為準。

## 先問，成立就走進去

條件分支（conditional branch）把程式分成只能擇一的區塊（block）。

- `if 條件:` 問第一個真假問題。成立時只執行它下方縮排的區塊。
- `elif 另一條件:` 是「前面都沒選到，才問這題」，可以沒有或有多個。
- `else:` 不帶條件，接住前面全部不成立的情形，可以省略。
- 冒號結束標頭；區塊內比標頭多縮排（indentation）4 個空格。`if`、`elif`、`else` 的標頭對齊。退回原本的縮排後，就已離開這串分支。

想做「每個條件都獨立檢查」，才分開寫兩個 `if`。本課明確要求一條路，因此用同一組。這也是規則順序重要的原因：條件若重疊，先匹配的會先拿走那筆數據。

## 用零旁邊的兩個值驗答

在 `C:\dev\conduit-lab\python` 存成 `route_order.py`，執行 `py route_order.py`。本例的 `amount_cents` 是已整理好的整數；空字串不是 0，遇到無法轉換的輸入，之後在[〈例外與隔離〉](#/lesson/fd-io-07)再處理。

```python
amount_cents = -1
if amount_cents < 0:
    print("refund")
elif amount_cents > 0:
    print("sale")
else:
    print("review_zero")
```

`-1` 進第一條路，不再判斷是否大於 0。把值依序改為 `0`、`1`，儲存後每次重跑。0 的兩個比較都不成立才落到 `review_zero`；1 的第一個比較不成立、第二個成立，所以是 `sale`。對照三筆才能證明不是只走過退款那條路。

## 替每條路寫一張行程卡

先不要執行。針對 -1、0、1 各畫一行，寫下第一個條件的結果、第二個條件有沒有被問、最後看見哪個狀態。對 -1，第二個條件應標「未執行」，而不是「假」；它的值雖然在紙上可算，但程式沒有走到。對 0，你才會實際走過兩個比較並落到最後一條路。對 1，第二個條件成立，後面不再走。這張卡能幫你理解為何沒有輸出時，可能不是印字那行有問題，而是整個分支從未被選到。

故意把訂單條件改為 `>= 0`，只用 0 重跑。它會被列成 `sale`；這不是 Python 判斷錯，而是口徑寫進符號時少了區別。如果新增單獨的零元分支，也要擺在會攔走零的條件之前。實驗後改回 `> 0` 再跑三筆，避免把反例本身留成下一堂的正常版本。

日後分流的不一定是文字輸出，可能是把合格紀錄與待查紀錄分別保存在兩份數據中。規則要先確定互斥或允許重疊，再選程式結構：分類通常只要一個狀態，但若要給一筆紀錄加上多種獨立提醒，才值得分成互不排斥的判斷。單看某一筆程式剛好印出對的話，還無法確認其他路沒有重疊。

## 常見錯誤

- 0 被算進訂單 → 用了 `>= 0`，提前攔走了零 → 按口徑用 `> 0`。
- 看到 `IndentationError` → 區塊未向右縮排或混用了空格和 Tab → 對齊標頭，區塊內統一空格。
- 同一筆印出兩種狀態 → 兩個 `if` 各自成立，或有一行退到分支外 → 核對哪些行意圖互斥。
