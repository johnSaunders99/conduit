---
id: fd-python-10
module: fd-python
order: 10
title: 函式與回傳
subtitle: 把含稅金額交給下一步
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-09
objectives:
- 以 def 定義接收兩個數值並回傳含稅分數的函式
- 分辨參數、引數與回傳值
- 把計算交給函式而由外層加總和顯示
tags:
- def
- return
- 參數
- 引數
- None
resources:
- title: More Control Flow Tools
  url: https://docs.python.org/3/tutorial/controlflow.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Defining Functions，對照參數、return 與 None。
concepts:
- id: fd-python-10-define-call
  prompt: 執行 def 定義時，函式內的計算是否立刻跑？
  answer: 不會；要呼叫函式才會用傳入數據執行內部程式。
  mcq:
    options:
    - 會，且只執行一次
    - 會，即使沒有給參數值
    - 不會，呼叫時才執行
    - 只要名稱有小括號就表示已呼叫
    answer: 2
    explain: def 綁定可呼叫的名稱；呼叫的語句不帶 def。
- id: fd-python-10-parameter-argument
  prompt: 在 gross_cents(1200, 60) 中，1200 和 60 是什麼？
  answer: 是呼叫時送進去的引數，依位置交給定義中的參數。
  mcq:
    options:
    - 引數
    - 函式名稱
    - 回傳值
    - 沒有用途的標籤
    answer: 0
    explain: 參數是定義裡的名稱，引數是在這次呼叫時實際送進去的值。
- id: fd-python-10-return-not-print
  prompt: 若函式只 print 金額而沒有 return，外層拿它的結果加總會怎樣？
  answer: 函式回傳 None，不是畫面上的金額；拿它與整數相加會報類型錯誤。
  mcq:
    options:
    - 加上畫面上的數字
    - 因為印過所以加 0
    - 自動回傳最後一行的值
    - 回傳 None，加整數會報錯
    answer: 3
    explain: 顯示和交回結果是不同工作；沒有明確回傳值時拿到 None。
- id: fd-python-10-contract-case
  prompt: 怎麼證明含稅函式交回的是數值而不是看起來像數字的句子？
  answer: 把回傳值接起來，再用另一筆已知金額加總並核對數字。
  interview:
    question: 日報和驗算腳本都要用同一個含稅算法，你會怎麼拆？
    answer: 我讓函式收未稅與已算好的稅額，兩個都用整數分，回傳它們的和。格式與輸出留給呼叫端；先用有稅、免稅兩筆樣本驗證回傳值能直接加總。
    points:
    - 明確輸入與單位
    - 計算回傳與顯示分離
    - 含稅和零稅例驗證回傳
practice:
- id: fd-python-10-p1
  kind: code
  title: 用同一個函式合計兩筆到貨
  minutes: 9
  steps:
  - 保存 gross_report.py，確認首筆含稅與第二筆免稅。
  - 添加未稅 300 分、稅額 15 分的第三筆，將回傳值加入總額。
  checks:
  - 原本為 1260 與 500，合計 1760 分；三筆為 2075 分。
  - 函式內沒有 print；總額由外面顯示。
---

兩份報表都要把未稅與稅額相加。把規則散在兩處，修一次就可能漏一次；只把結果印出來，另一個步驟又拿不到數字。函式（function）給計算一個名稱並約定輸入與結果，可以用同一種方式驗算多筆。

## 定義後，再呼叫

`def` 後是名稱、括號中的參數、冒號；下一層縮排寫要做的事。參數（parameter）是定義裡用來接值的名稱。呼叫（call）用名稱加括號，把這次要處理的引數（argument）依位置交給對應參數。像 `gross_cents(1200, 60)`，第一個值是未稅金額，第二個是已算好的稅額，單位都是分。

`return` 把值交回呼叫處，並結束這次執行。`print` 只是把文字給人看。函式沒有執行帶值的 `return`，例如直接跑到末尾，呼叫端拿到 `None`，代表沒有交回一個數字。定義只建立這個可呼叫的工具；不寫呼叫句子，裡面的計算不會執行。

## 用回傳值做下一步

在 `C:\dev\conduit-lab\python` 存為 `gross_report.py`，執行 `py gross_report.py`。本課只示範「把兩個已知整數相加」，不主張任何商品的稅率。

```python
def gross_cents(net_cents, tax_cents):
    return net_cents + tax_cents

first = gross_cents(1200, 60)
second = gross_cents(500, 0)
batch_total = first + second

print("first:", first)
print("second:", second)
print("total cents:", batch_total)
```

兩次呼叫用的是同一定義，結果各為 1260、500；外層拿到兩個可用的數字，再求 1760。這個過程才證明不是只有螢幕印過數字。日後改成一句顯示給財務的文字，可以不動計算規則；要換幾筆數據驗算，也不用另外寫一套函式。之後在[〈參數與預設值〉](#/lesson/fd-data-06)再看如何用參數名稱送入值及省略某些引數。

## 用三組輸入檢查同一個承諾

把函式的承諾寫成「收兩個整數分，回傳一個整數分」。先個別手算三組：未稅 1200 加稅 60 是 1260；未稅 500 加稅 0 是 500；未稅 300 加稅 15 是 315。第一組證明有把稅加上，第二組證明零稅仍回傳有效數值，第三組則給後續步驟再用一次相同寫法。第三筆不是去修改函式內容；它只加一處呼叫，呼叫端多累加一個結果。

遇到報表要改格式時，可以試著只把 `print` 的標籤換成另一句，再檢查三組回傳值一樣。反過來，如果業務核准改變含稅算法，要修的是函式內的規則，而且同一組測值也要更新對應的預期。這就是拆開計算與顯示的好處：知道哪部分能獨立修改，也知道哪組檢查最能抓到影響。若只是為了讓人知道某個步驟跑完，印一行提示可以有用，但不能用這行提示取代下一步要消費的值。

本例加法剛好不在意交換順序，不代表命名可以隨便。當未稅和稅額會各自進入不同規則時，兩個引數反過來也可能照樣跑，卻算錯業務結果。真正可重用的函式，除了能執行，還要讓讀程式的人知道每個位置代表什麼、採用什麼單位。

## 常見錯誤

- 只有定義，畫面沒結果 → 沒有呼叫或顯示 → 在定義之外呼叫並印出回傳值。
- 函式已印 1260，外層加法卻報 `TypeError` → 函式只印，回傳 `None` → 用 `return` 交回數字。
- 呼叫後出現缺少引數的訊息 → 定義有兩個必要參數，但少給一個值 → 照約定給未稅與稅額，即使免稅也給 0。
