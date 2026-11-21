---
id: fd-linux-01
module: fd-linux
order: 1
title: WSL 與檔案邊界
subtitle: 分清兩邊的工作目錄
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - "從 WSL 清單辨認 Ubuntu 是否使用第 2 代"
  - "用 Windows 與 Ubuntu 的路徑讀取同一份訂單檔"
  - "為密集處理與兩側交接選擇工作位置"
tags:
  - "WSL 2"
  - "Ubuntu"
  - "掛載"
  - "工作目錄"
resources:
  - title: "Install WSL"
    url: "https://learn.microsoft.com/en-us/windows/wsl/install"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看安裝前提與如何列出發行版。"
  - title: "Working across Windows and Linux file systems"
    url: "https://learn.microsoft.com/en-us/windows/wsl/filesystems"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看兩側的檔案入口與存放建議。"
concepts:
  - id: fd-linux-01-distribution
    prompt: "WSL 清單中的 Ubuntu、Stopped 和 2 分別代表什麼？"
    answer: "Ubuntu 是發行版，Stopped 表示目前停止，2 是採用的 WSL 世代。"
    mcq:
      question: "清單顯示 Ubuntu、Stopped、2，可以得出什麼？"
      options:
        - "Ubuntu 尚未安裝"
        - "Ubuntu 使用 WSL 2，目前未運作"
        - "Ubuntu 版本是 2.0"
        - "PowerShell 已切換成 Bash"
      answer: 1
      explain: "是否安裝、是否運作、採用哪一代是三件事；清單也不會切換殼層。"
  - id: fd-linux-01-mounted-file
    prompt: "為何兩側讀到同一筆訂單不是備份？"
    answer: "掛載只提供另一個入口，沒有另外保存一個副本。"
    mcq:
      question: "Windows 修改樣本後，WSL 重讀出現新值，最合理的解釋是？"
      options:
        - "兩邊各匯入一份 CSV"
        - "Ubuntu 自動重建 CSV"
        - "兩條路徑指向同一份檔案"
        - "Bash 下載了網路上的新版"
      answer: 2
      explain: "另一個入口不代表另一份檔案，不需要重建或下載。"
  - id: fd-linux-01-placement
    prompt: "主要用 Bash 大量處理小檔，要先放在哪一側？"
    answer: "優先在 Ubuntu 自己的檔案系統處理；需要 Windows 交接再匯出成果。"
    mcq:
      question: "哪個位置是 Ubuntu 原生家目錄，而非 Windows 磁碟或其入口？"
      options:
        - "~"
        - "/mnt/c/dev/conduit-lab"
        - "/mnt/d/dev/conduit-lab"
        - "C:\\dev\\conduit-lab"
      answer: 0
      explain: "在 Bash，~ 指向目前帳號的家目錄；後三項是 Windows 路徑或掛載入口。"
practice:
  - id: fd-linux-01-p1
    kind: hands-on
    title: "畫出一份訂單檔的兩個入口"
    minutes: 10
    steps:
      - "在 PowerShell 列出 WSL 發行版，記錄名稱與世代。"
      - "依正文建立同一份樣本，從兩側讀取，再將狀態改為 delivered 並重讀。"
      - "在 Windows 練習區保存 wsl-paths.txt，寫下兩個完整路徑和最後一列。"
    checks:
      - "兩側重讀都得到 o101,delivered，並註明沒有另一份備份。"
      - "缺少 Ubuntu 時，把 Linux 路徑與結果明確標成推算。"
---

上午收到一份訂單明細，Windows 編輯器讀得到，但 Ubuntu 裡的清洗工具說找不到。先不要複製出第二份數據：你要查的是**命令在哪裡執行、路徑由哪一側解讀**。本堂最後會留下同一筆訂單的兩個入口。

## 先辨認你在哪一側

適用於 Linux 的 Windows 子系統（Windows Subsystem for Linux，WSL）讓你在 Windows 主機上使用 Linux；WSL 2 在受管理的輕量虛擬機（virtual machine）中執行 Linux 核心（kernel），也就是管理記憶體、設備等資源的系統核心。Ubuntu 是發行版（distribution）：在核心之外提供常用工具、套件與自己的檔案系統。終端機（terminal）是輸入與顯示的視窗；PowerShell 或 Bash 才是讀取命令的殼層（shell）。兩個分頁長得一樣，不代表它們認得同樣的命令。

- 在 PowerShell，`wsl.exe --list --verbose` 列出發行版、運作狀態、WSL 世代；星號只標預設選項。
- 有世代為 `2` 的 Ubuntu 時，用 `wsl.exe -d Ubuntu` 進入；名稱不同就替換成清單上的名稱。停止狀態不妨礙下次啟動。
- 在 Ubuntu Bash 裡，`uname -s` 應印出 `Linux`，`pwd` 印出目前目錄。看到 Linux 單獨不能判斷 WSL 世代。`exit` 離開這個殼層。
- 若沒有 Ubuntu，先看資源的安裝前提。只在有權限的個人練習機，以系統管理員 PowerShell 執行 `wsl.exe --install -d Ubuntu`，按提示重開並完成首次設定；已有 Ubuntu 但世代為 1 時，先按官方指引備份並確認轉換。不能安裝就用文末的紙上對照。

## 跨過邊界讀同一筆

掛載（mount）是替既有檔案系統接上一個目錄入口。WSL 預設以 `/mnt/c` 接進 Windows 的 C 槽；若你的練習區在 D 槽，下面兩側一起改用 `D:` 與 `/mnt/d`。Ubuntu 家目錄通常在 `/home` 下，Bash 用 `~` 代表自己的那一個。大量小檔若由 Linux 工具處理，優先放 Ubuntu 的檔案系統；要由兩側交接時再放 Windows 練習區。

在 PowerShell 進入已建立的練習區，用專用樣本檔名；若已存在，選未使用的名稱並在兩側一併替換：

```powershell
Set-Location C:\dev\conduit-lab
@('order_id,status', 'o101,paid') | Set-Content -Encoding ascii wsl-orders.csv
Get-Content wsl-orders.csv
```

另開 Ubuntu 分頁，在 Bash 執行：

```bash
cd /mnt/c/dev/conduit-lab && pwd && cat wsl-orders.csv
```

兩邊都應看到 `o101,paid`。回 PowerShell 用同一個寫入命令將 `paid` 換成 `delivered`，再回 Ubuntu 重讀。看見新值，是因為兩條路通往同一份檔案，不是因為兩邊各有一份自動同步的備份。如果誤刪這一份，也不能指望另一個入口幫你救回。

## 選工作位置，不靠猜速度
假設每天接到一份 Windows 上的壓縮檔，要在 Ubuntu 解成上百個小檔。把原檔留在練習區；在 Ubuntu 家目錄用工作副本處理；最後只把交接用的摘要放回 Windows。這就分開了原始輸入、處理位置與交付物。如果需求改成和同事手動調整同一份小表，反而把該表留在雙方都能正確定位的一側較簡單。

## 常見錯誤

- Bash 說找不到 `C:\…` → 用了 Windows 路徑 → 從 `/mnt/c` 開始。
- 切換失敗後繼續貼命令 → 可能仍站在舊目錄 → 先查 `pwd`，或用 `&&` 只在前一步成功時往下做。
- 家目錄找不到 Windows 樣本 → 兩個目錄本來不同 → 用完整路徑定位，不要建一份同名檔掩蓋差異。

沒有 WSL 時，留下 Windows 實際路徑和預期的 Linux 路徑，註明只驗證了一側。下一堂[〈目錄與權限〉](#/lesson/fd-linux-02)會用 Linux 原生目錄，避免把 Windows 磁碟的規則誤當成 Linux 規則。
