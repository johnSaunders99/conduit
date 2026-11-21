---
id: fd-data-08
module: fd-data
order: 8
title: 檔案讀寫
subtitle: 關檔後還能還原昨天的結果
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-07
objectives:
  - 以 with 讀寫 UTF-8 純文字檔
  - 判斷 r、w、a、x 對已有輸出的影響
  - 從另一個位置辨認相對路徑的基準
tags:
  - 檔案讀寫
  - UTF-8
  - with
  - 路徑
resources:
  - title: Python 教學：檔案讀寫
    url: https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀開啟模式、編碼和 with 關檔範例。
concepts:
  - id: fd-data-08-modes
    prompt: '`w` 和 `a` 開啟既有檔案會怎樣？'
    answer: w 先清空；a 在尾端寫，不會清掉既有內容。
    mcq:
      question: 只在檔案不存在時建立，哪種模式合適？
      options:
        - '`x`'
        - '`w`'
        - '`r`'
        - '`a`'
      answer: 0
      explain: x 會拒絕寫到已存在的檔案，w 和 a 不會。
  - id: fd-data-08-with
    prompt: 為什麼把開檔放在 `with` 裡？
    answer: 離開區塊就會關閉，即使區塊內出現例外。
    mcq:
      question: 離開 with 後還能從同一個 file 讀嗎？
      options:
        - 可以，有變數就能讀
        - 不能，檔案物件已關閉
        - 可以，除非 write 過
        - 只能在 Windows 讀
      answer: 1
      explain: 關閉和變數是否仍存在是兩回事。
  - id: fd-data-08-encoding
    prompt: 讀寫為何指定同一套字元編碼？
    answer: 同樣的位元組要用一致規則轉回原本字元。
    mcq:
      question: 相對路徑 `handoff.txt` 一般從哪裡找？
      options:
        - 一定從程式檔旁邊找
        - 一定從使用者家目錄找
        - 程序目前工作資料夾
        - 每個專案都由 Python 猜位置
      answer: 2
      explain: 相對路徑以目前位置為基準，請在指定目錄執行。
practice:
  - id: fd-data-08-p1
    kind: hands-on
    title: 保留批次交班記事
    minutes: 8
    steps:
      - 把範例輸出改成新檔 handoff_history.txt，將 w 改成 a。
      - 執行兩次，第二次把 batch 改成 trial-02。
    checks:
      - 兩列依序為 trial-01 與 trial-02；舊交班檔不受影響。
      - 用 r 讀回能辨認中文，列數為 2。
---

## 關掉程式，結果還在嗎？

昨天看螢幕知道試跑完成，今天卻答不出有幾筆。`print()` 把內容送到畫面；寫到檔案才會留下可重新讀取的產物。先存一行批次號和筆數，隔著一次關檔，再用程式把原字串讀回來。這比單純看到「完成」更接近你之後交付的日報。

## 語法速查

- `open(path, "r", encoding="utf-8")` 開文字檔讀取；`"w"` 寫新內容，有舊檔會先清空；`"a"` 追加，沒有就建立；`"x"` 只允許建立新檔，已存在就報錯。
- `with open(...) as file:` 在縮排區塊內使用檔案物件，離開時自動關閉。`file.write(text)` 寫字串，不會替你補換行。
- `file.read()` 取剩下所有文字；`for line in file:` 逐行取，行尾通常包含換行符號 `\n`。大檔不用為了看一行把全部讀進記憶體。
- 字元編碼（character encoding，大陸稱字符編碼）是文字與位元組的轉換規則。讀與寫都指定 `utf-8`，不依賴不同電腦的預設。遇到帶 UTF-8 BOM（檔首標記）的來源，下一堂[〈CSV 與引號〉](#/lesson/fd-io-01)示範用 `utf-8-sig` 讀取。

## 留一行，再從檔案證明它存在

在 `C:\dev\conduit-lab\python-data` 存 `write_handoff.py`，執行 `py write_handoff.py`。下例每次覆寫自己的範例檔 `handoff_latest.txt`，不要把檔名改成已有的正式報表。

```python
batch = "trial-01"
rows = 3
with open("handoff_latest.txt", "w", encoding="utf-8") as file:
    file.write(f"{batch} 訂單 {rows} 筆\n")

with open("handoff_latest.txt", "r", encoding="utf-8") as file:
    saved = file.read()

print(saved, end="")
```

結果是 `trial-01 訂單 3 筆`，用編輯器開檔也應看到同一句。把批次改成 `trial-02` 再跑，原檔只剩第 2 次的紀錄；若要保留每次交班，請用另一個檔名和追加模式。不要把「日報最新版本」和「交班歷史」混在同一個檔；日報常要重算覆寫，歷史則要保留兩次操作。

相對路徑以目前工作資料夾為基準，不是程式碼檔的位置。若切到上一層再用程式檔的相對路徑執行，可能在另一層生成同名輸出。依[〈終端與目前位置〉](#/lesson/fd-desk-04)用 `Get-Location` 核對位置。之後[〈原子替換輸出〉](#/lesson/fd-lab-04)會避免正式日報被打開清空後才發現寫入失敗。

### 「覆寫」和「追加」都要先想讀者

最新摘要通常是一個已知位置，讀者只需一份；來回檢查兩次是否成功時，追查紀錄反而要保存先後。這兩種結果若存在同一個檔名，任何選項都會有一邊被破壞：覆寫使前一次無法查，追加使只應讀一筆的程式看到舊紀錄。先把用途寫在檔名與使用說明裡，再選模式。嘗試把追加版本的第一筆筆數改成 2，第二筆改成 3，確認讀者能知道哪個是目前狀態、哪個是歷史，而不是把兩筆合計成 5。

讀與寫分開兩個 `with`，也讓你能從檔案重新取回文字驗證：不是拿原本的變數再次印出。對照同一份中文在編輯器與 Python 的輸出；若只有終端顯示不對，但讀回後存檔文字仍正確，先分辨是終端顯示還是實際檔案內容出了問題。

## 常見錯誤

- 舊日誌只剩最後一筆：用了 `w`；對需要累積的獨立歷史檔使用 `a`。
- 兩次追加卻黏在同一行：`write` 不補換行；每筆最後加 `\n`。
- 編輯器看到亂碼：核對檔案和讀取使用的編碼，不要把亂碼當作內容再覆寫。
