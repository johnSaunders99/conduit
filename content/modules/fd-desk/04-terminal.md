---
id: fd-desk-04
module: fd-desk
order: 4
title: 終端與目前位置
subtitle: 看懂提示符所在的目錄
status: ready
minutes: 25
level: 1
prereqs:
- fd-desk-03
objectives:
- 分辨終端介面與 PowerShell 的工作
- 用 Get-Location 讀出目前目錄，再用 Get-ChildItem 找到訂單檔
tags:
- 終端機
- PowerShell
- 目前工作目錄
- 提示字元
resources:
- title: Get-Location
  url: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-location
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀描述與第一個例子，對照輸出的目前位置。
concepts:
- id: fd-desk-04-terminal-shell
  prompt: 終端機和 PowerShell 有什麼分工？
  answer: 終端機接收輸入、呈現輸出；PowerShell 解讀並執行指令。
  mcq:
    options:
    - 兩個名稱都只代表同一個程式
    - PowerShell 只畫畫面，終端機解讀指令
    - 終端機是介面，PowerShell 是解譯器
    - 終端機永遠只能開 PowerShell
    answer: 2
    explain: 終端機可以開不同類型的分頁，但指令要由所在的解譯器處理。
- id: fd-desk-04-location
  prompt: 在檔案總管切到 inputs，已開著的 PowerShell 也會切過去嗎？
  answer: 不會；用 Get-Location 查該 PowerShell 的位置。
  mcq:
    options:
    - 會，因為同一台電腦只有一個工作目錄
    - 不會，這個 PowerShell 維持自己的位置
    - 會，但需要先在總管重新整理
    - 不會，所以兩者無法看同一個檔案
    answer: 1
    explain: 各視窗可在不同位置；明確切到同處，就能看到同一份檔案。
- id: fd-desk-04-prompt
  prompt: 畫面是 PS C:\dev>，想查目前位置應輸入什麼？
  answer: 只輸入 Get-Location，不抄前面的提示字元。
  mcq:
    options:
    - PS C:\dev> Get-Location
    - C:\dev
    - PS Get-Location
    - Get-Location
    answer: 3
    explain: PS C:\dev> 是等待輸入的提示，不是指令的一部分。
practice:
- id: fd-desk-04-p1
  kind: hands-on
  title: 從文字畫面驗收訂單位置
  minutes: 8
  steps:
  - 用 Windows PowerShell 依正文切到 inputs，依序執行 Get-Location 與 Get-ChildItem -Name。
  - 將位置和看到的檔名記在 checks\location.txt。
  checks:
  - 位置以 \desk\inputs 結尾，清單內有 orders.csv。
  - 只抄位置與檔名；PS 與大於符號不是輸入的一部分。
---

夜間工作寫著「找不到 `orders.csv`」，但你明明能在檔案總管點開那份訂單。先別急著重做檔案。程式尋找檔名時可能從別處出發。今天用兩條指令回答：「這個視窗從哪找？它看得見什麼？」

## 看懂等待輸入的那一行

終端機（terminal）是讓你輸入指令、觀看輸出的介面；命令解譯器（shell）才是解讀指令的程式。Windows Terminal 能承載不同種類的解譯器，今天用開始功能表搜尋並開啟 **Windows PowerShell** 即可，不需以系統管理員身分執行。看到 `PS C:\dev>` 之類的提示字元（prompt），表示它在等你輸入；這串文字本身不用重抄。預設提示通常顯示目前位置，但外觀可以設定，確認時以指令輸出為準。

目前工作目錄（current working directory）是用短檔名找檔案時的起點。檔案總管與已開著的 PowerShell 各有自己的位置；兩個 PowerShell 視窗也不會自動一起移動。畫面上看到的舊提示仍然是當時的紀錄；需要核對時，要在最後一個提示輸入，不是捲回去找最順眼的一行。

## 先問位置，再問有哪些檔案

本課指令可從任何檔案系統資料夾開始。每貼一行按一次 Enter，等下一個提示再執行下一行。不把範例裡描述的結果也貼進去。

- `Get-Location` 說出目前的目錄，不搬動任何檔案。
- `Get-ChildItem -Name` 列出目前目錄直接底下可見項目的名稱；`-Name` 是讓指令只顯示名稱的選項。不加遞迴選項時，它不會代你翻遍子資料夾。
- `Set-Location -LiteralPath '完整路徑'` 要求切到指定的既有位置，不會新建資料夾。之後在[〈路徑與引號〉](#/lesson/fd-desk-05)會拆開解釋每一段。

```powershell
Get-Location
Set-Location -LiteralPath 'C:\dev\conduit-lab\desk\inputs'
Get-Location
Get-ChildItem -Name
```

第一行輸出視原本的開啟位置而定；第三行應以 `\desk\inputs` 結尾，清單應至少有 `orders.csv`。接著只移動檔案總管到上一層，**不要**在 PowerShell 切換，重跑 `Get-Location`。輸出不變是預期行為。這能解釋為什麼同事在介面裡看見檔案，不等於執行中的工作也從那裡找。

## 練習說清楚「沒有找到」

在同一個 PowerShell 視窗切到 `C:\dev\conduit-lab\desk`，再執行上述兩個查詢。你應該能看到 `inputs`，而不是直接看到目錄裡的 `orders.csv`。試著把這兩次結果記在 `checks\location.txt`：一欄寫查詢起點，另一欄寫該起點直接看到的內容。若有人說「指令說檔案不存在」，你可以用這個對照追問：「是哪個位置沒有這份檔？」這比立刻重複下載或重新建立一份更容易定位。紀錄時只寫練習路徑，不抄其他目錄或終端機全文。

查不到不能證明檔案被刪除，只證明這次查詢沒有列到它。

## 常見錯誤

- 把 `PS …>` 複製進指令後報錯 → 那是提示而不是輸入 → 只複製 `Get-Location` 再按 Enter。
- 清單有 `inputs` 卻沒有 `orders.csv` → 你多半在父目錄 → 核對位置並切到 `inputs` 再列一次。
- 新視窗列出的內容不同 → 兩個解譯器的起點不同 → 在每個視窗分別執行 `Get-Location`，不要用一個視窗的結果猜另一個。
