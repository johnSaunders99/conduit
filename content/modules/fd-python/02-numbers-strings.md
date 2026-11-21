---
id: fd-python-02
module: fd-python
order: 2
title: 數值與字串
subtitle: 別把料號前面的零吃掉
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-01
objectives:
- 保留訂單或料號前導零並辨認 str 與 int
- 用 type 檢查印起來相似的值
- 選擇該串接文字還是轉換後加總
tags:
- 數據類型
- str
- int
- 前導零
resources:
- title: An Informal Introduction to Python
  url: https://docs.python.org/3/tutorial/introduction.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Numbers 與 Text，對照加法和串接。
concepts:
- id: fd-python-02-identifier-text
  prompt: 料號 0007 應先保存成什麼類型？
  answer: 字串，例如 "0007"；前面的零屬於識別碼。
  mcq:
    options:
    - 整數 7，零只是排版
    - 字串 "0007"，保留原有文字
    - 浮點數 7.0，方便區分料號
    - 任何形式都可以再還原出原來幾個零
    answer: 1
    explain: 轉成數值通常就失去原本有幾個前導零的資訊。
- id: fd-python-02-plus
  prompt: '"2" + "5" 的結果是什麼？'
  answer: 字串 "25"，不是數值 7。
  mcq:
    options:
    - 整數 7
    - 浮點數 7.0
    - 報錯，因為加號只能加數字
    - 字串 "25"
    answer: 3
    explain: 兩個字串以加號串接；要加總應先轉換兩個數量值。
- id: fd-python-02-inspect-type
  prompt: print 顯示 7，怎麼辨認原本是字串還是整數？
  answer: 把待查的值交給 type，再用 print 顯示其類型。
  mcq:
    options:
    - 數畫面行數
    - 看文字是否靠右
    - 用 print(type(待查的值))
    - 觀察值是否剛好等於 7
    answer: 2
    explain: 印出內容時引號不一定顯示；type 直接查值的類型。
- id: fd-python-02-explicit-cast
  prompt: int("2") + int("5") 算的是什麼？
  answer: 兩個數量的整數和 7；不適用於需要保留原樣的料號。
  mcq:
    options:
    - 整數 7
    - 字串 "25"
    - 整數 25
    - 字串 "7"
    answer: 0
    explain: int 先把每段合法的整數文字轉成整數，加號才執行數值加法。
practice:
- id: fd-python-02-p1
  kind: code
  title: 替新料號保留原樣，再合計數量
  minutes: 8
  steps:
  - 依正文建立 value_check.py，先寫下預期再執行。
  - 保留原檔，另存成 value_check_extra.py；將料號改成 0010、兩個數量改成 3 和 8。
  checks:
  - 新料號輸出仍含前導零，type 是 str。
  - 直接串接顯示 38；轉成整數後加總是 11。
---

供應商把「料號 `0007`、箱數 `2`」交給你。兩個欄位都由數字組成，卻不該一律拿來算：料號要拿去找同一件商品，箱數才要相加。如果把 `0007` 和 `7` 都先轉為整數，後面就無法知道原本來的是哪一個。數據類型不是看長相決定，要先問這欄拿來做什麼。

## 看值怎麼寫，不只看它怎麼印

程式裡的值（value）有數據類型（type，台灣也常稱型別）。今天分辨以下三種：

- `7` 是整數（integer，`int`）；`2 + 5` 是數量合計。
- `7.0` 是浮點數（floating-point number，`float`）；常用於比例等近似值。浮點數可能無法精確表示某些十進位小數；今天的例子不拿它算付款金額。
- `"0007"` 是字串（string，`str`）。半形的成對引號標記文字邊界，不算進內容。`"2" + "5"` 使用串接（concatenation），得到 `"25"`。

`type(...)` 查值的類型；在腳本裡用 `print(type(...))` 才會印出。`int(...)` 是轉換（conversion）：能把合法的整數文字轉為整數，例如 `int("0007")` 得到 7，但那已無法驗收原來的零。把每個欄位的用途想清楚，比背哪個函式叫什麼更重要。

## 把同一個加號交給兩組值

在 `C:\dev\conduit-lab\python` 存成 `value_check.py`，先預測最後兩行分別是含兩個字元的文字、還是一個可以用來計算的數量，再用 `py value_check.py` 執行。`print` 內側的括號會先求出結果，外側才把結果印出。

```python
print("0007")
print(type("0007"))
print(type(7))
print(type(7.0))
print("2" + "5")
print(int("2") + int("5"))
```

預期第一行仍是 `0007`；接著三行包含 `str`、`int` 和 `float`；末兩行分別是 `25`、`7`。如果只是拿掉前導零再印好看的結果，你沒有證明來源保持完整。可靠的驗算是對識別碼檢查原字串，對數量檢查加總。現在都是合法、手寫的小樣；碰到壞掉的數量文字，不把它默認成 0。之後在[〈例外與隔離〉](#/lesson/fd-io-07)才會處理不合規的輸入。

## 先寫出欄位的用途，再選類型

試著做一張只有三行的欄位約定：料號用來辨認，箱數用來加總，抽樣比例用來比較大小。標成字串、整數、浮點數後，再對照 Python 的輸出。不能從「印出來像一樣」就推斷用途一樣：料號 `"25"` 可以查商品，箱數 `25` 卻可以和另一批箱數相加。如果先轉成數字再靠格式補回零，還得猜每種來源的規格；當來源同時可能給 4 碼和 5 碼時，猜回來不等於保留原文。

練習改成 `"0010"`、`"3"` 和 `"8"` 時，把 `38` 和 `11` 都留下，並註明結果一個是串接、一個是加總。如果實際印出的總數變成 `38`，回到該行問「加號兩邊各拿到了哪一種類型」。只改印法而不修傳入的值，下游還是會得到錯的結果。這個核對習慣會用在[〈CSV 與引號〉](#/lesson/fd-io-01)讀入真正的文字欄位。

對未知的欄位，先問是代碼還是計量值，不靠字形猜。

## 常見錯誤

- 料號少了開頭的零 → 對識別碼做了整數轉換 → 保留 `"0007"`，不要期待 7 記得原先的長相。
- 合計變成 `25` → 把兩份文字接起來 → 驗過是合法數量後，先轉整數再加。
- `"2" + 5` 報 `TypeError` → 混用了文字和數值 → 依需求統一類型；要算總量就轉為數值。
