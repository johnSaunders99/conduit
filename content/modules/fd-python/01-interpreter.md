---
id: fd-python-01
module: fd-python
order: 1
title: Python 與直譯器
subtitle: 執行自己的第一個檔案
status: ready
minutes: 25
level: 1
prereqs: []
objectives:
- 辨認 py 與 Python 直譯器各自的角色
- 核對本機 Python 版本並執行一份已儲存的腳本
- 用兩次輸出驗證讀到的是指定檔案
tags:
- Python 安裝管理員
- py
- 直譯器
- 腳本
resources:
- title: Using Python on Windows
  url: https://docs.python.org/3/using/windows.html
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Python install manager 與啟動說明。
- title: Python Releases for Windows
  url: https://www.python.org/downloads/windows/
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 還沒有可用直譯器時，從此頁取得官方安裝管理員。
concepts:
- id: fd-python-01-interpreter
  prompt: py 與 Python 直譯器有何分工？
  answer: py 是 Windows 上啟動或選擇 Python 的入口；直譯器負責讀取並執行程式。
  mcq:
    options:
    - py 負責寫入程式，直譯器只開資料夾
    - 兩者都是文字編輯器
    - py 啟動執行環境，直譯器執行程式
    - 直譯器只顯示版本，py 自己執行每行程式
    answer: 2
    explain: 能呼叫入口不等於腳本已跑過，還要另看腳本輸出。
- id: fd-python-01-version-vs-run
  prompt: py --version 有結果，這證明今天的 probe.py 已跑成功嗎？
  answer: 沒有，只證明有可回報版本的 Python；還需用檔名執行並檢查輸出。
  mcq:
    options:
    - 沒有，版本與腳本要分開驗收
    - 有，只要檔案已儲存
    - 有，即使在別的目錄
    - 沒有，所以每次都要重裝 Python
    answer: 0
    explain: 版本檢查定位環境；已知輸出定位腳本與檔案路徑。
- id: fd-python-01-prompt-mode
  prompt: 看到 >>> 時，該在那裡輸入 py probe.py 嗎？
  answer: 不該，>>> 是 Python 互動模式；先 exit() 回 PowerShell。
  mcq:
    options:
    - 可以，因為 >>> 和 PS 相同
    - 可以，只要使用雙引號
    - 不行，必須關閉整台電腦
    - 不行，要回到 PowerShell 再輸入
    answer: 3
    explain: 解譯器不同，Python 互動模式要讀 Python 程式，不讀 PowerShell 指令。
practice:
- id: fd-python-01-p1
  kind: code
  title: 製作第一份環境驗收卡
  minutes: 8
  steps:
  - 依正文存好 probe.py 並執行。
  - 把檔中數字 3 改成 4，儲存後用同一條命令再執行。
  - 將版本、命令、兩次輸出記在 python\environment.txt。
  checks:
  - 兩次使用相同檔名；輸出依序是 sample_orders=3 與 sample_orders=4。
---

「我的電腦有 Python」和「我的電腦能執行這份程式」是兩件事。等你接手每日報表，先確認是哪個執行環境在跑、讀了哪份檔，比照著錯誤訊息重裝工具有用。今天先做一份小到能目測的驗收腳本，不讀真實訂單。

## 檢查入口，再檢查程式

直譯器（interpreter）負責讀取與執行 Python 程式。Windows 的 `py` 是啟動或選擇 Python 的入口；文字編輯器負責改檔，不會因按下儲存就替你執行。先開一般權限的 PowerShell，輸入：

```powershell
py --version
```

看到 `Python 3` 開頭的版本資訊，先用現有的執行環境，不用因為別人的版本不同就重裝。尚無可用環境且有安裝權限時，從下方官方 Windows 下載頁取得 Python 安裝管理員（Python install manager），依畫面安裝並重開 PowerShell。使用新安裝管理員時，`py list` 可列出已安裝環境；需要手動取得 Python 3 時用 `py install 3`，再查一次版本。舊版啟動器不支援這些管理指令，即使已有能執行腳本的 Python 也可能報錯。受管理的電腦若不許安裝，記下缺的是入口還是執行環境，不自行提升權限。

## 把數字印給自己看

在 `C:\dev\conduit-lab` 用檔案總管建立 `python` 資料夾。用[〈編輯器與儲存〉](#/lesson/fd-desk-03)的工具，把下面 2 行存成 UTF-8 的 `probe.py`；不是 `probe.py.txt`。這類存成檔案、交給直譯器執行的短程式叫腳本（script）。`print(...)` 把括號內的值顯示出來；引號包住要保留的文字，逗號把這裡要顯示的兩個值分開。之後在[〈函式與回傳〉](#/lesson/fd-python-10)會拆開介紹這種呼叫。

```python
print("orders probe")
print("sample_orders=", 3, sep="")
```

`sep=""` 先讀作「兩個值中間不補分隔字」，所以等號後面緊貼數字。回 PowerShell 執行：

```powershell
Set-Location -LiteralPath 'C:\dev\conduit-lab\python'
py probe.py
```

預期第一行是 `orders probe`，第二行是 `sample_orders=3`。數字是寫在程式裡的驗收值，不是 Python 自動去讀了訂單。刻意修改成 4 後重跑，如果結果沒動，先重查目前目錄、完整副檔名和是否儲存。若只輸入 `py` 看到 `>>>`，現在是在 Python 互動模式（interactive mode），一行一行試 Python；輸入 `exit()` 回 PowerShell 才能再跑上面的命令。

## 把三種結果分開記

第一格記版本，例如只需要抄 `py --version` 回報的那行；第二格記命令和練習資料夾；第三格記自己預期的兩行文字。第一次符合不夠，修改數字後再跑一遍，要同時看到識別用的第一行不變、第二行的數字變動。若第二次印出舊數字，先用檔案總管確認檔案只存在一份，再按儲存並重試。版本資訊從頭到尾都相同，並不能幫你分辨哪一次讀對了檔。

日後換電腦時，也用這張卡逐關核對：先判斷終端機能否啟動 Python，再判斷直譯器能否打開這個檔名，最後比對輸出。這三關各有不同的修法，不把它們都叫成「Python 壞了」。

## 常見錯誤

- `py` 無法辨認 → 目前視窗找不到入口 → 安裝允許的官方工具後先重開視窗再驗版本。
- Python 說找不到檔案 → 已啟動，但路徑或檔名不對 → 用 `Get-Location` 與 `Get-ChildItem -Name` 找到 `probe.py`。
- 出了 `SyntaxError` → 直譯器讀到了內容但看不懂寫法 → 核對程式行與半形引號，不先重裝環境。
