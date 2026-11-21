---
id: fd-python-06
module: fd-python
order: 6
title: 布林與比較
subtitle: 判斷一筆金額是否合法
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-05
objectives:
- 為閉區間金額規則組合比較與 and
- 用下限、上限及外側一格測試邊界
- 用 or 或 not 表達警示條件並核對結果
tags:
- 布林值
- 比較運算子
- and
- 邊界值
resources:
- title: 內建型別：Boolean Operations 與 Comparisons
  url: https://docs.python.org/zh-tw/3/builtins/stdtypes.html
  kind: doc
  lang: zh-Hant
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀比較與布林運算兩節，對照包含相等的符號。
concepts:
- id: fd-python-06-inclusive
  prompt: 訂單金額允許 1 到 5000 分，含端點。下限要用哪個判斷？
  answer: amount_cents >= 1；剛好 1 分也必須通過。
  mcq:
    options:
    - amount_cents > 1
    - amount_cents == 1
    - amount_cents >= 1
    - amount_cents != 1
    answer: 2
    explain: 只用大於會排除 1；只用相等會不收其他合法值。
- id: fd-python-06-and-range
  prompt: 哪個條件真正要求 amount_cents 同時達到下限和不超過上限？
  answer: 用 and 合併兩個完整比較。
  mcq:
    options:
    - amount_cents >= 1 or amount_cents <= 5000
    - amount_cents >= 1
    - amount_cents <= 5000
    - amount_cents >= 1 and amount_cents <= 5000
    answer: 3
    explain: and 才要求兩者皆成立；單邊以及 or 都會讓越界數值通過。
- id: fd-python-06-or-alert
  prompt: 已知 below_min 和 above_max 分別代表低於下限和超過上限，警示怎麼寫？
  answer: below_min or above_max；只要越過任一邊就要警示。
  mcq:
    options:
    - below_min or above_max
    - below_min and above_max
    - not below_min
    - not above_max
    answer: 0
    explain: 一筆金額不會同時低於下限又高於上限；反轉單邊不是完整警示。
- id: fd-python-06-boundary-test
  prompt: 只試 50 和 6000，為何抓不到 >= 誤寫成 >？
  answer: 兩種寫法在這兩筆的下限判斷都相同；要試恰好等於下限。
  interview:
    question: 排程驗證金額 1 到 5000 分，測試怎麼選？
    answer: 我先問清楚端點是否包含，然後用 0、1、5000、5001 各跑一次。預期是兩端合法、兩個外側不合法，也會保留一筆範圍內的普通金額做基本檢查。
    points:
    - 先定端點口徑
    - 兩端與相鄰的非法值
    - 記下預期真假而非只看無報錯
practice:
- id: fd-python-06-p1
  kind: code
  title: 留下四筆邊界測試
  minutes: 9
  steps:
  - 存成 amount_check.py，每次修改 amount_cents，儲存後重跑。
  - 把合法和警示的預期、實際結果記在 amount_cases.txt。
  checks:
  - 0、1、5000、5001 的 valid 依次是 False、True、True、False。
  - 每筆 needs_alert 都與 valid 相反。
---

訂單匯入只收 1 到 5000 分，**包含**兩端。把「至少 1」誤寫成「大於 1」，就會悄悄丟掉剛好 1 分的合法單。所謂邊界值（boundary value）是兩種判斷結果交界的值；測到邊界，比只挑一筆普通訂單更容易抓到符號錯誤。

## 把一句規則拆成兩個問題

比較（comparison）把兩個值拿來判斷，得到布林值（boolean），只有 `True` 或 `False`；開頭字母要大寫。賦值的 `=` 與比較是否相等的 `==` 不同。

- `amount_cents == 1` 等於 1；`amount_cents != 1` 不等於 1。
- `amount_cents < 1` 小於 1；`amount_cents <= 1` 小於或等於 1。
- `amount_cents > 5000` 大於 5000；`amount_cents >= 5000` 大於或等於 5000。
- `a and b` 要求兩個真假判斷都成立；`a or b` 要求至少一個成立（兩個皆真也算）；`not a` 反轉一個真假結果。

## 合法與警示要互為反面

在 `C:\dev\conduit-lab\python` 存為 `amount_check.py`，每改一個測值就存檔，再用 `py amount_check.py` 執行。這裡輸入是已整理好的整數分；「文字能否轉整數」則是另一條檢查。

```python
amount_cents = 1
valid = (amount_cents >= 1) and (amount_cents <= 5000)
below_min = amount_cents < 1
above_max = amount_cents > 5000
needs_alert = below_min or above_max
print(amount_cents, valid, needs_alert)
print("opposite:", needs_alert == (not valid))
```

第一次應印 `1 True False` 和 `opposite: True`。合法同時需要通過上下限；警示只需低於下限**或**高於上限。對 0 和 5001 重做，你能看到不同原因都得到警示；再測 5000，確認右端也算在內。這幾筆讓你找到是規則本身問錯，還是輸入少了某個範圍。下一堂[〈條件分支〉](#/lesson/fd-python-07)會用真假決定要印哪一種狀態。

## 寫出四個預期，再執行四次

在驗收筆記中用「金額、下限通過、上限通過、合法、警示」五欄。先不用程式，填好 4 個輸入的結果：

- 0 分：上限通過、下限不通過，因此不合法，要警示。
- 1 分：兩個條件都通過，不警示。這筆能抓到下限把相等排除的錯。
- 5000 分：同樣通過兩個條件，抓上限誤寫成嚴格小於的錯。
- 5001 分：下限通過、上限不通過，因此不合法，要警示。

最後加一個中間值 200，證明規則不是只許兩個端點。先比對每筆結果的理由，再比對 `opposite`。如果警示與合法剛好總是相反，但兩個規則用錯同一個上限，彼此一致也不能算通過；還得拿獨立的預期來驗。記錄「為什麼應該真」，比只記印出真更有用。

用文字覆述 `not valid` 時，說「不在合法範圍」比說「有錯」精確，因為本例只驗金額區間，沒有證明訂單識別碼、來源時間或其他欄位也有效。如果業務後來把最低金額改成 2 分，先改約定、更新邊界案例，再改程式，不能把所有舊的合法結果當永久答案。

這裡把比較放進括號，方便你把「金額達到下限」和「金額未超過上限」一段一段唸出來。Python 也能寫成 `1 <= amount_cents <= 5000`，對本課這個整數值是同一個範圍。若暫時還不熟，先保留兩段明寫的版本，逐一核對邊界，不需要為了少打幾個字而改掉已驗證的規則。

## 常見錯誤

- 剛好 1 分不通過 → 下限排除了相等 → 用 `>=`。
- 0 分通過 → 合法條件用 `or`，只滿足上限就被放行 → 同時檢查兩邊，用 `and`。
- 一寫條件就報語法錯誤 → 混用賦值和比較 → 給名稱用 `=`，檢查相等用 `==`。
