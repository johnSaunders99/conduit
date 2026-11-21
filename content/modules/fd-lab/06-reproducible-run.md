---
id: fd-lab-06
module: fd-lab
order: 6
title: 乾淨環境重現
subtitle: 從說明文件驗收每日摘要
status: ready
minutes: 30
level: 1
prereqs:
  - fd-lab-05
objectives:
  - 寫一份第三人能照做的批次說明
  - 只複製明列的交付物重跑
  - 以結束碼、報表及拒收紀錄驗收
tags:
  - 可重現性
  - 交付
  - README
  - 環境驗證
resources:
  - title: Diátaxis：教學如何引導讀者完成成果
    url: https://diataxis.fr/tutorials/
    kind: article
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 比較步驟中的可見成果與說明次序。
  - title: Python 教學：虛擬環境與套件
    url: https://docs.python.org/3/tutorial/venv.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 核對建立新環境及直接呼叫直譯器。
concepts:
  - id: fd-lab-06-manifest
    prompt: 為什麼複製交付物而不是整個工作目錄？
    answer: 確定文件列出的檔案已足夠，不靠作者機器的舊產物與設定。
    mcq:
      question: 哪些不應拷入乾淨驗收資料夾？
      options:
        - README
        - 原始碼
        - 舊 out、原本的 .venv 和暫存檔
        - 合成的 orders.csv
      answer: 2
      explain: 帶舊環境或結果會掩蓋漏步驟，其他是可重建的交付物。
  - id: fd-lab-06-scope
    prompt: 同一台 Windows 的新資料夾通過，證明了什麼？
    answer: 在已核對的工具與作業系統上，明列交付物可重跑；不代表換機或其他版本已通過。
    mcq:
      question: 如何如實記錄驗證範圍？
      options:
        - 寫所有平台都可用
        - 只寫已通過
        - 只抄出報表日期
        - 記 Windows、Python 版本及新位置，說明沒測的平台
      answer: 3
      explain: 具體條件才讓別人知道何時可以沿用結果。
  - id: fd-lab-06-readme
    prompt: README 要放哪個可觀察的成功訊號？
    answer: 規定樣本應產生的結束碼、摘要數字、拒收行和日誌。
    mcq:
      question: 某人看到已有摘要但本次碼 1，是否驗收通過？
      options:
        - 沒有，先處理本次失敗，舊檔不能作證
        - 通過，因為檔名存在
        - 通過，只要印出 650
        - 沒有，應刪除整個程式重裝
      answer: 0
      explain: 驗收的是這次從輸入到發布的行為，不靠舊檔。
practice:
  - id: fd-lab-06-p1
    kind: hands-on
    title: 用乾淨資料夾驗收交付
    minutes: 12
    steps:
      - 補完 README，按正文只複製交付物到未使用的新資料夾。
      - 在副本的虛擬環境跑三項測試、實際批次，再嘗試缺檔。
    checks:
      - 乾淨副本的成功結果為結束碼 0、2 接受、1 拒收、650 分。
      - 缺檔有碼 1 且不產生缺檔批次的摘要；記錄通過的環境範圍。
---

## 作品要能離開原本的工作資料夾

你已能跑日報，但接手者沒有你的終端歷史，也不知道 `out` 裡哪些檔案是昨天留下來的。可重現性（reproducibility）在這裡很具體：只拿指定原始碼、樣本和說明，從未使用過的資料夾能跑到同樣的可核對結果。不要刪原資料夾來冒充乾淨環境；另開副本就能測出少帶了什麼。

## 寫交付說明

在 `C:\dev\conduit-lab\batch\README.md` 記下[〈輸入契約〉](#/lesson/fd-lab-01)和本次驗收規格：

- 交付物：`batch_args.py`、`order_input.py`、`order_batch.py`、`test_order_batch.py`、`orders.csv`、`README.md`。`logging_probe.py` 是前一堂的展示，不是執行依賴。
- 環境：Windows 上可用的 Python 3。本模組使用 Python 3.9 起才支援的日誌 `encoding` 參數；請使用仍受支援的版本。只使用標準函式庫，不需要 pip 安裝。
- 起點與命令：在清單檔案同層執行下面的指令。成功例結束碼 0，`trial-01.summary.json` 的接受數 2、拒收數 1、淨額 650；`trial-01.rejects.jsonl` 只有第 4 行的壞金額，`batch.log` 有同編號的 `start` 與 `done`。
- 失敗如何確認：參數錯誤為 2；缺檔或無有效列等批次失敗為 1，不可把舊摘要當這次結果。允許部分拒收，只要至少有一筆有效且成功發布。

## 只帶必要檔案走一遍

從 `C:\dev\conduit-lab\batch` 的 PowerShell 複製到全新的子資料夾；若名稱已用過，改用新的名稱，不複製任何舊輸出。

```powershell
New-Item -ItemType Directory -Path .\verify-trial -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath batch_args.py,order_input.py,order_batch.py,test_order_batch.py,orders.csv,README.md -Destination .\verify-trial -ErrorAction Stop
Set-Location -LiteralPath .\verify-trial
py -m venv .venv
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m unittest -v test_order_batch
.\.venv\Scripts\python.exe order_batch.py --input orders.csv --output-dir out --batch-id trial-01
$LASTEXITCODE
Get-Content -LiteralPath .\out\trial-01.summary.json
Get-Content -LiteralPath .\out\trial-01.rejects.jsonl -Encoding utf8
Get-Content -LiteralPath .\out\batch.log -Encoding utf8
.\.venv\Scripts\python.exe order_batch.py --input absent.csv --output-dir out --batch-id missing-demo
$LASTEXITCODE
Test-Path -LiteralPath .\out\missing-demo.summary.json
```

每一步若與預期不同就停下檢查，不硬走完。測試應有 3 項通過；接著核對成功檔案；最後缺檔應顯示 1 與 `False`。如果第一個不符是找不到 `README.md` 或指令必須在特定位置執行，把這個必要資訊補回說明，重新用一個空目錄驗。保留成功時的指令和數字，但不必把 `.venv`、舊 `out` 或終端歷史一起交出去。

這次驗收只證明同一台電腦上的新工作資料夾可重建；在 README 末段記錄實際使用的作業系統及 Python 版本，換電腦、換版本或全新安裝的結果尚未由此證明。至此你交付的不是一張抄好的報表，而是別人可以重新產生、知道怎麼判斷失敗的日報。

### 交付時寫下第一個卡點

讓接手者只看 README，用明列檔案試跑。若對方先問「從哪一層開 PowerShell」，就在命令前寫清楚位置；若跑過卻不知道是否正確，就加上期望金額和拒收筆數，而不是再貼整頁說明。每次驗收補的資訊，應對應一個觀察到的卡點。先用成功、缺檔兩組驗收，接手者才知道既能產出，也能辨別錯誤。

也可以把成功後的摘要留在一張截圖裡幫人快速理解，但不要把截圖當交付成果的唯一證據。可執行的程式、可分享的合成樣本、能獨立重跑的測試與操作文件，才是別人有辦法核對的整套作品。

## 常見錯誤

- 複製整個工作目錄來重跑：容易帶到舊結果；只放交付清單中的檔案。
- README 只有「執行 Python」：補上工作位置、完整命令和預期數字。
- 當次結束碼 1 卻把已有摘要算通過：看當次日誌，修好後重新從乾淨副本驗。
