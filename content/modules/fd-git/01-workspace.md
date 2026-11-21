---
id: fd-git-01
module: fd-git
order: 1
title: Git 與工作區
subtitle: 把練習區變成可追蹤目錄
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
- 確認終端機能呼叫 Git for Windows
- 在獨立練習資料夾初始化儲存庫並辨認根目錄
- 用 git status 辨認第一個未追蹤的規則檔
tags:
- Git for Windows
- git init
- 儲存庫
- 工作區
resources:
- title: Git for Windows 安裝
  url: https://git-scm.com/install/windows
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 需要安裝時，比對 Windows 安裝程式與系統類型。
- title: git-init
  url: https://git-scm.com/docs/git-init
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀描述與 initial-branch，核對初始化主線的用途。
concepts:
- id: fd-git-01-repo-vs-file
  prompt: 初始化儲存庫會把現有的檔案自動寫進歷史嗎？
  answer: 不會；它建立 Git 管理資訊，檔案仍需另選入並提交。
  mcq:
    options:
    - 會，備份整個磁碟
    - 不會，只在所選目錄建立儲存庫
    - 會，並同步至 GitHub
    - 不會，因為必須先安裝 Python
    answer: 1
    explain: 初始化、選入、上傳各是不同動作；本課只有本機儲存庫。
- id: fd-git-01-root-check
  prompt: 如何確認 Git 管理的是 report-git，而不是較外層的練習目錄？
  answer: 用 git rev-parse --show-toplevel 查儲存庫根目錄。
  mcq:
    options:
    - 看 Git 的版本號
    - 看命令是否沒報錯
    - 查儲存庫根目錄並對照完整路徑
    - 看檔案是否以 .txt 結尾
    answer: 2
    explain: Git 可在某個儲存庫的子資料夾執行；目前位置和根目錄不一定相同。
- id: fd-git-01-untracked
  prompt: git status --short 出現 ?? orders-rule.txt 代表什麼？
  answer: Git 看見它，但它目前未被追蹤，沒有進入提交。
  mcq:
    options:
    - 未追蹤檔案
    - 尚未下載的遠端檔案
    - 有衝突的兩行
    - 已完成的第一筆提交
    answer: 0
    explain: 問號標示未追蹤，不需要修復檔案內容。
practice:
- id: fd-git-01-p1
  kind: hands-on
  title: 立一個練習庫，不動其他專案
  minutes: 12
  steps:
  - 依正文在練習區建立 report-git，核對目前位置後初始化 main。
  - 建立 orders-rule.txt，執行根目錄與狀態檢查。
  checks:
  - 根目錄以 /conduit-lab/report-git 結尾，狀態顯示 ?? orders-rule.txt。
  - 沒有提交或上傳；設定只作用在這個練習庫。
---

每次報表規則一改就把檔名加「終版」，很快就分不清哪個終版算了退款。Git 是版本控制（version control）工具；它把更改留成可追溯的順序。Git 不等於 GitHub：今天即使沒有帳號、沒連外網，只要裝好工具也能建立一個本機練習庫。

## 先確認在哪裡工作

一般 PowerShell 執行 `git --version`。有版本就沿用；找不到指令且允許安裝時，從官方 Git for Windows 頁面選符合系統類型的安裝程式，使用可從 PowerShell 呼叫 Git 的安裝選項，裝完重開 PowerShell 再確認。沒有安裝權限則先保留課堂小樣，不修改系統安全設定。

儲存庫（repository）保存追蹤設定與版本歷史；工作區（working tree，也稱工作目錄樹）是你用編輯器讀寫的那份檔案。儲存庫根目錄（repository root）是這份專案的最上層。今天只管理規則小樣，不要在 `C:\`、`C:\dev` 或整個 `conduit-lab` 初始化，以免把不相關的課堂檔案納入。

## 看見第一份未追蹤檔

用檔案總管在 `C:\dev\conduit-lab` 建立新的空資料夾 `report-git`。如果同名目錄不是你的練習庫，停下來先選定另一個空的練習資料夾，後續指令也用那個名稱。先執行下列兩行，看到完整位置恰好是新資料夾才繼續。

```powershell
Set-Location -LiteralPath 'C:\dev\conduit-lab\report-git'
Get-Location
```

進到這個空資料夾後，先執行 `git rev-parse --show-toplevel`：若它印出既有根目錄，表示你位在另一個庫裡，先換到真正獨立的位置；顯示不在 Git 儲存庫才是本課預期的初始化前狀態。核對後才執行下列命令。`-b main` 命名初始分支（branch，即一條可前進的版本路線）；之後在[〈分支與合併〉](#/lesson/fd-git-05)會練切換與整合。`git config --local` 只替這個庫設定提交紀錄用的虛構標記，不是登入，也不改其他庫的設定。

```powershell
git init -b main
git rev-parse --show-toplevel
git config --local user.name 'Conduit Practice'
git config --local user.email 'practice@example.invalid'
```

在此處用編輯器建立 `orders-rule.txt`，存成 UTF-8 純文字，內容只有 `net = sales` 一行。回 PowerShell（仍在 `report-git`），執行 `git status --short`。預期 `?? orders-rule.txt`。沒有被追蹤不是失敗：你只是存了檔，還沒決定把哪一版留下。Git 建立的隱藏 `.git` 資料夾是管理區，不要手動改裡面內容。下一堂[〈暫存區與提交〉](#/lesson/fd-git-02)才會做第一筆快照。

## 把安裝、初始化與追蹤分開驗收

首次執行版本查詢，只證明電腦找得到工具；成功查出新的根目錄，才證明這個練習庫建在正確地方；最後看見問號，證明的只是庫裡有這份還沒被追蹤的檔案。若把三個結果混在一起，遇到狀態還沒有歷史時可能誤以為工具沒有裝好。有疑問時依序回查版本、根目錄與狀態。

把「可見」和「已記錄」分開看。編輯器存好文字之後，檔案總管能開啟它，Git 也會在狀態裡列出它；但此時沒有一筆提交可以讓別人回到這個時間點。別人若把你的一條終端輸出當備份，根本無法還原那一行口徑。從下一堂開始，才會明確選出該追蹤的檔案與版本。

## 常見錯誤

- 根目錄顯示 `conduit-lab` → 在過大的位置操作 → 停止後查清實際的練習資料夾，別猜測或刪除原有的 `.git`。
- `status` 找不到 `orders-rule.txt` → 檔還沒存，或存到外面 → 從根目錄重開正確位置核對。
- 想透過登入修好版本檢查 → 安裝入口與帳號不同 → 先讓 PowerShell 能呼叫 `git --version`。
