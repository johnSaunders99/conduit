---
id: fd-tools-05
module: fd-tools
order: 5
title: 錯誤堆疊
subtitle: 從最後一行定位壞輸入
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-04
objectives:
  - 找出 traceback 最後一行的例外類別
  - 循堆疊找出自己的程式行和錯值
  - 修正輸入後用相同命令驗證
tags:
  - traceback
  - 例外訊息
  - 呼叫堆疊
  - ValueError
resources:
  - title: Python 教學：錯誤與例外
    url: https://docs.python.org/3/tutorial/errors.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀堆疊行號、例外名稱和上下文。
concepts:
  - id: fd-tools-05-last-line
    prompt: 一般先看 traceback 的哪一行？
    answer: 先看最後顯示的例外名稱與訊息，再往上追自己能修的程式位置。
    mcq:
      question: '最後一行是 `ValueError: ... ''8x''`，下一步應該？'
      options:
        - 直接刪掉所有 print
        - 找這個錯值傳到哪次轉換
        - 忽略這批錯值但回傳成功
        - 只改最外層的函式名
      answer: 1
      explain: 訊息給你類型與可能的值，位置需由堆疊查。
  - id: fd-tools-05-frame
    prompt: 一個堆疊框架常能告訴你什麼？
    answer: 檔名、行號、所在函式與相關程式行。
    mcq:
      question: 看到函式呼叫列與內部炸掉的列，先核對哪個？
      options:
        - 只讀最上層檔名
        - 一定只需改第三方套件
        - 先讀內部發生位置，再往上找誰傳入該值
        - 只看總執行時間
      answer: 2
      explain: 呼叫鏈讓你把錯誤動作追溯到來源。
  - id: fd-tools-05-followup
    prompt: 修正後為何還要用原命令重跑？
    answer: 證明在同一入口和步驟下，錯誤消失且得到預期結果。
    mcq:
      question: 哪個結果才支持修好了這筆金額？
      options:
        - 只把例外訊息藏起來
        - 印出 0 便算成功
        - 改接另一份訂單檔
        - 同一命令不報錯且得到 800
      answer: 3
      explain: 要證明正確值進入計算，不只證明沒顯示錯誤。
practice:
  - id: fd-tools-05-p1
    kind: hands-on
    title: 保存一份修正前後的診斷紀錄
    minutes: 8
    steps:
      - 把正文樣本故意跑出錯誤，記下例外類別及自己程式最深的呼叫。
      - 只改輸入 8x 為 800，用同一命令重跑。
    checks:
      - 能指向 int 轉換那一行並說出是哪筆值。
      - 修正後輸出 800，不再出現 traceback。
---

## 看見錯誤，不急著加 except

批次在算一筆金額時停住了。終端顯示好幾行，你可能會盯著第一個檔名猜是哪個函式壞了。先找最後一行：它說明這次發生什麼例外。然後回頭追程式檔、行號與函式，找見錯值在哪一層變成無法處理的輸入。這份呼叫歷程叫錯誤堆疊（traceback，大陸也稱異常堆棧）。

## 三步讀堆疊

1. 先讀最後一個例外的類別和訊息。`ValueError` 常表示值不符合某個操作，和「找不到檔案」不是同一個問題。
2. 從下面往上找你能修改的呼叫框架（stack frame，大陸稱棧幀）。看 `File`、行號與函式名；一般這一段是較接近實際出錯動作的位置。
3. 再往上看呼叫者，把「誰交了什麼值」說成一句話，而不是只背行號。不同 Python 版本顯示的線段和標示可能不一樣，意思仍可沿檔名和函式追。

[〈例外與隔離〉](#/lesson/fd-io-07)教的是已知可以處理的錯值如何隔離；這裡先保留最小重現，診斷尚未確定前別用廣泛的 `except` 把證據藏掉。

## 製造一筆可解釋的失敗

在 `C:\dev\conduit-lab\tools` 存 `trace_amount.py`，執行 `py trace_amount.py`。這次故意讓程式報錯。

```python
def to_cents(raw):
    return int(raw)

def summarize(order):
    return to_cents(order["amount_cents"])

record = {"order_id": "O01", "amount_cents": "8x"}
print(summarize(record))
```

最後看到 `ValueError`，訊息含 `'8x'`。在它上面找到 `to_cents` 的 `return int(raw)`，再上一層是 `summarize` 用字典中的金額呼叫；最上層才是入口。於是可把診斷寫成：「O01 的金額原文 8x 經 summarize 交給 int，這不是整數字串。」這比說「第 2 行壞了」更能幫來源修正數據。

現在把樣本值改為 `"800"`，同一命令應輸出 800。若真實系統不能回頭改來源，才回到列級驗證，把該列的行號與原因交給修數據的人；不要在轉換函式裡把任何錯值一律改為 0。示範用的是虛構代碼，正式日誌不要把整筆含敏感內容的訂單複製到診斷紀錄。

### 有時候檔名指出的是症狀，不是原因

最靠近例外的位置，是程式第一次無法照要求做事的地方；不一定是原始錯誤被引入的地方。本例真正不合規的是傳進來的 `"8x"`。把這段轉換移到別處，堆疊行號雖然改變，錯誤仍會出現。診斷時寫下兩句：操作不接受什麼值，以及這個值是從哪裡來的。第二句常能把責任從「換個程式寫法」轉回「修來源或拒收」。

試著另外把鍵名誤改成 `"amount"`，這次應該看到 `KeyError`，而且最後出現的自寫位置是在 `summarize`，不是轉換函式。把整筆輸出留在課堂診斷檔，並排辨認兩種情況：找不到欄位，或找到欄位但值不能轉換。這些分別會在[〈輸入契約〉](#/lesson/fd-lab-01)轉成可明確驗證的規則，遇到問題不再靠人工猜。

## 常見錯誤

- 只看第一個呼叫：它也許只是啟動點；從尾端找出實際轉換的位置。
- 修完只看沒報錯：還要核對正確金額真的到達輸出。
- 只記行號不記輸入及動作：行號會變，把函式與錯值的關係也寫下。
