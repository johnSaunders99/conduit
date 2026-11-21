---
id: fd-python-05
module: fd-python
order: 5
title: 格式化字串
subtitle: 印一張看得懂的收據
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-04
objectives:
- 用 f-string 插入欄位和單位
- 以 :.2f 固定顯示兩位小數，以 :04d 補齊批次流水號
- 驗證顯示格式沒有更改原始數值
tags:
- f-string
- 格式規格
- 小數位
- 格式化輸出
resources:
- title: Input and output
  url: https://docs.python.org/3/tutorial/inputoutput.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Formatted String Literals，對照大括號與格式規格。
concepts:
- id: fd-python-05-literal-prefix
  prompt: print("total={total}") 印出大括號，如何讓它代入 total？
  answer: 在引號前加 f，成為 print(f"total={total}")。
  mcq:
    options:
    - 在 total 後再補一個 f
    - 在開頭引號前加 f
    - 把大括號改成括號
    - 把 total 變數改成字串
    answer: 1
    explain: f 位於字串引號之前，告訴 Python 求出大括號內的值。
- id: fd-python-05-display-format
  prompt: f"{rate:.2f}" 會改掉 rate 嗎？
  answer: 不會；它回傳顯示時有兩位小數的字串，原數值還在。
  mcq:
    options:
    - 會，rate 被永久四捨五入
    - 會，rate 被改成字串
    - 不會，因為 .2f 只數字串長度
    - 不會，只輸出固定小數位的文字
    answer: 3
    explain: 顯示與計算是兩層，只有另外賦值才會重新綁定名稱。
- id: fd-python-05-zero-pad
  prompt: batch_no 為整數 7，哪種寫法可在這份報表顯示 0007？
  answer: f"{batch_no:04d}"；用 0 補到至少 4 位的整數格式。
  mcq:
    options:
    - f"{batch_no:04d}"
    - f"{batch_no:.2f}"
    - f"{batch_no:d}"
    - f"{batch_no}000"
    answer: 0
    explain: 固定小數位會產生小數點；d 不指定寬度，而直接加 000 把零加在末端。
practice:
- id: fd-python-05-p1
  kind: code
  title: 存一張可重做的到貨收據
  minutes: 8
  steps:
  - 儲存正文的 receipt.py，先預測批次 7 的兩行輸出。
  - 把批次改成 10、總分改成 400，儲存並重跑。
  checks:
  - 第二次收據是 B0010 | total=4.00 CNY；來源仍是整數 400 分。
  - 保留腳本和兩筆預期輸出，單位都寫清楚。
---

班表要記兩筆金額，其中一筆正好是 4 元。表格如果一處寫 `4`、另一處寫 `12.50`，人眼能解讀，但核對時容易忘記哪裡是元、哪裡是分。把計算用的原數值與顯示用的字串分開：前者保留整數分，後者統一補足小數位和單位。

## 讀一個 f-string

格式化字串（formatted string literal，f-string）在開頭的引號前加 `f`。在 `f"batch={batch_no}"` 裡，`batch=` 固定印出，`{batch_no}` 換成當下的值。大括號裡也可以放運算式（expression，就是可以算出值的片段），例如 `{total_cents / 100}`；單位留在括號外。

- `{value}`：用預設方式把值放進文字。
- `{value:.2f}`：冒號後是格式規格（format specifier）；`.2f` 指定顯示小數點後 2 位。
- `{batch_no:04d}`：`d` 是十進位整數格式，寬度至少 4，不足的位置用 `0` 補在前面。更長的整數不被截斷。
- `{{` 和 `}}`：如果報表真的要印出大括號，連寫兩次表示一個字面大括號。

## 把分轉成可讀的一行

在 `C:\dev\conduit-lab\python` 儲存 `receipt.py`，用 `py receipt.py` 執行。這裡除以 100 只用於展示小額樣本；不要把格式化後的文字再拿去累加付款。

```python
batch_no = 7
total_cents = 1250
receipt = f"B{batch_no:04d} | total={total_cents / 100:.2f} CNY"
print(receipt)
print("source cents:", total_cents)
```

結果第一行應是 `B0007 | total=12.50 CNY`，第二行是 `source cents: 1250`。第一行是看報表的人讀的；第二行驗證底層保留的是原本的 1250 分。把變數改為 400 分，報表應仍印 `4.00`，而不是少了兩位小數。「固定寬度」在批次流水號這裡是顯示規則；上課前面那種已經以文字收到的料號，則要保留原本幾個零，不應先轉成數字再猜寬度。

## 不靠肉眼比兩張收據

第一次跑出金額 12.50 時，先確認它是 1250 分除以 100 的結果，不是把小數點的位置猜對。第二次改為 400 分時，特別看同一條格式是否還保留兩個小數位。計算的來源是整數分，顯示需要小數是報表的契約；因此兩張收據都可以用同一種排版，而原始數值仍能拿去加總。

批次流水號也做兩個反向驗算：7 要在這張報表顯示成 0007；把值改成 10000 時，它不會被截成 0000，而是保留 5 碼，因為 4 是最小寬度。若接收方真的要求剛好 4 碼，這是要另訂輸入範圍的需求，不能把補零當成驗證。把來源料號與報表流水號分清楚：前者本來就可能含零與字母；後者由自己按既定規則排版。

有同事希望把標籤改成「總金額」時，只需動大括號以外的文字。若希望以分顯示，就調整大括號內的計算，並改對應單位。把這兩個修改分開做：改標籤不能使數字變化；改單位必須重驗換算結果。日後要把一筆摘要寫到檔案，[〈檔案讀寫〉](#/lesson/fd-data-08)會介紹如何保存文字，不用為了輸出換掉原始金額的類型。

## 常見錯誤

- 畫面印出 `{batch_no}` → 引號前漏了 `f` → 加上前綴再執行。
- 明明規格是元，卻印成 `1250.00 CNY` → 只改排版，沒換單位 → 先把整數分除以 100 再顯示。
- 之後加總讀到字串型別錯誤 → 用格式化字串覆蓋原數值 → 把輸出放進 `receipt`，保留 `total_cents`。
