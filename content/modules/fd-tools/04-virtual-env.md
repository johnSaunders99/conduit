---
id: fd-tools-04
module: fd-tools
order: 4
title: 虛擬環境
subtitle: 避免兩個專案互相踩套件
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-03
objectives:
  - 建立專案專用的虛擬環境
  - 以直譯器路徑確認環境與 pip 的歸屬
  - 區分套件清單和 Python 本身的版本
tags:
  - venv
  - pip
  - 直譯器
  - 依賴
resources:
  - title: Python 教學：虛擬環境與套件
    url: https://docs.python.org/3/tutorial/venv.html
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: 讀環境建立、執行檔和列出套件。
concepts:
  - id: fd-tools-04-interpreter
    prompt: 為什麼用 `python.exe -m pip` 而不是不帶路徑的 pip？
    answer: 讓安裝或查詢用這個直譯器所屬的環境。
    mcq:
      question: 哪個可確認 pip 屬於目前資料夾的 .venv？
      options:
        - '`.\.venv\Scripts\python.exe -m pip --version`'
        - 只看終端標題
        - 用任何 pip 都相同
        - 只列出系統 PATH 就夠
      answer: 0
      explain: 直接用指定直譯器可核對 pip 位置和版本。
  - id: fd-tools-04-activation
    prompt: 一定要啟用虛擬環境嗎？
    answer: 不需要；啟用只是方便從命令名稱找到該環境，也可以直接用其執行檔。
    mcq:
      question: PowerShell 不允許執行 Activate.ps1 時，怎麼做？
      options:
        - 修改全機執行政策
        - 直接呼叫 .venv 的 python.exe
        - 刪除系統 Python
        - 切到其他資料夾用全域 pip
      answer: 1
      explain: 直接指定執行檔不需更改系統設定。
  - id: fd-tools-04-freeze
    prompt: '`pip freeze` 能說明哪些事？'
    answer: 可列出目前環境的套件版本；不會記錄作業系統、Python 或樣本內容。
    mcq:
      question: 換機重建，除了套件清單還應保留什麼？
      options:
        - 只需上傳整個 .venv
        - 不需要保存任何東西
        - Python 版本與輸入、操作方法
        - 只要執行一次就知道所有設定
      answer: 2
      explain: 依賴版本只是重現的一部分，環境應能依紀錄重建。
practice:
  - id: fd-tools-04-p1
    kind: hands-on
    title: 留下可辨認的環境清單
    minutes: 8
    steps:
      - 依正文執行版本、路徑及 pip 檢查。
      - 將展示的 freeze 指令導向練習專用清單；記下 Python 版本。
    checks:
      - 環境與 pip 的路徑都在 .venv 下。
      - 知道 freeze 可能為空，也不包含 Python 版本。
---

## 專案各用自己的工具箱

前面裝過 requests 和 pandas。若另一個專案要用不同的套件版本，全部裝到同一份 Python 可能互相影響。「這台能跑」也不等於拿到程式的人能跑。虛擬環境（virtual environment）把專案用的執行檔入口與套件安裝位置分開；套件（package，大陸也稱軟件包）是可以裝入環境供其他程式使用的程式集合。這堂先不裝新套件，只辨認環境。

## 命令速查

- `py -m venv .venv` 用目前 `py` 選到的 Python 建環境。`-m` 表示將後面的模組當命令執行。
- Windows 直接用 `.\.venv\Scripts\python.exe`；macOS／Linux 在該資料夾用 `python3 -m venv .venv` 建立後，可用 `.venv/bin/python`。啟用（activation）只是調整目前終端的搜尋路徑，不是必要條件。
- 在目標直譯器後加 `-m pip --version` 查 pip 的位置；安裝時也用同一支直譯器的 `-m pip install`，不混用其他專案的 pip。
- `-m pip freeze` 列出目前環境中的套件版本，通常不包含啟動管理工具；它不是 Python 或作業系統版本清單。

## 看清楚現在是哪一個 Python

在 `C:\dev\conduit-lab\tools` 的 PowerShell 依序執行：

```powershell
py --version
py -m venv .venv
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -c "import sys; print(sys.executable); print(sys.prefix != sys.base_prefix)"
.\.venv\Scripts\python.exe -m pip --version
.\.venv\Scripts\python.exe -m pip freeze
```

`sys.executable` 印出目前直譯器路徑，應包含 `tools\.venv\Scripts`；最後的 `True` 表示目前的環境前綴與基礎 Python 不同。pip 那一行的安裝位置也應在 `.venv`。新環境尚未裝任何練習套件時，freeze 可沒有輸出；不用為了讓它有字而隨便裝東西。

練習時要記錄版本，可在這個新資料夾執行 `.\.venv\Scripts\python.exe -m pip freeze | Set-Content -Encoding ascii requirements-lab.txt`；本課沒有外部套件，空清單是合理的。重建另建環境再依實際需求清單安裝；不要把某台電腦的 `.venv` 當成可攜的交付檔。[〈乾淨環境重現〉](#/lesson/fd-lab-06)會實際驗收標準函式庫就能執行的批次。

### 遇到環境不一致，先列出證據

如果終端已有原本的 `py`，新建環境不會替你改掉它，也不必改。比較全域與環境各自的 `--version`，版本字串相同也完全合理：虛擬環境本來就是由某個基礎 Python 建立。真正的差別是套件去哪裡查找、安裝到哪裡。請同時記下執行檔與 pip 顯示的位置，不能因兩個版本號一樣就斷言隔離失敗。

有兩個專案時，更容易看出隔離的價值：一個要維護舊依賴，另一個要試新版。各自在自己的資料夾建立環境、以該環境的 Python 啟動，只更新需要改動的那一個。若報表突然不能跑，先定位工作目錄及直譯器，再查套件是否真的不存在。重新下載不但費時，還可能改動原本作用正常的環境。

`requirements-lab.txt` 是紀錄這一次工具箱的內容，並不決定哪個 Python 必須使用。寫交接說明時，再補上啟動命令和一份小樣本的預期結果。即使未來改用別人的版本，仍有具體輸出可對照；「裝好了」不等於能算出相同數字。

## 常見錯誤

- 看見 `ModuleNotFoundError` 就重裝：先查 `sys.executable`，也許只是啟動了另一支 Python。
- 啟用指令被擋便改全機設定：直接呼叫虛擬環境的執行檔。
- 把 freeze 當成完整環境記錄：另外記 Python 版本、輸入樣本及執行位置。
