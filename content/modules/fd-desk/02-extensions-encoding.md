---
id: fd-desk-02
module: fd-desk
order: 2
title: 副檔名與編碼
subtitle: 同樣看起來是表格，檔案卻不同
status: ready
minutes: 25
level: 1
prereqs:
- fd-desk-01
objectives:
- 讓檔案總管列出完整副檔名，辨認真正的 .csv
- 存出含中文字的 UTF-8 訂單小樣並重開驗收
- 說明重新命名不等於轉換格式
tags:
- 副檔名
- CSV
- UTF-8
- 純文字
resources:
- title: Common file name extensions in Windows
  url: https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/common-file-name-extensions-in-windows
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看如何列出副檔名，以及為什麼改名不等於轉檔。
- title: about_Character_Encoding
  url: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看編碼和位元組的關係；指令細節可以先略過。
concepts:
- id: fd-desk-02-extension-format
  prompt: 把 orders.csv 改叫 orders.xlsx，內容會怎樣？
  answer: 只有檔名變了，裡面的逗號文字沒有變成 Excel 活頁簿。
  mcq:
    options:
    - 自動加上工作表
    - 仍是逗號文字
    - 逗號會變成定位字元
    - 中文字會自動轉為另一種編碼
    answer: 1
    explain: 副檔名可提示開啟方式，不會重寫內容或轉換編碼。
- id: fd-desk-02-encoding
  prompt: 檔名與欄位分隔都正確，只有中文重開後變亂碼，先查什麼？
  answer: 查寫入與讀取時所用的字元編碼是否一致。
  mcq:
    options:
    - 把副檔名改成 .txt
    - 刪除欄位分隔用的逗號
    - 重抄完整路徑
    - 比對讀寫時的字元編碼
    answer: 3
    explain: 能開啟檔案代表基本路徑可用；分隔符不負責把位元組讀成字。
- id: fd-desk-02-visible-name
  prompt: 存完 orders.csv 後，檔案總管為何要開啟副檔名？
  answer: 確認整個名稱確實是 orders.csv，而非看起來相似的 orders.csv.txt。
  mcq:
    options:
    - 檢查是否被補上 .txt
    - 強制轉成 UTF-8
    - 自動驗證訂單欄位
    - 移除檔名最後一個句點
    answer: 0
    explain: 這個顯示選項讓你檢查名稱，不會改動檔案。
practice:
- id: fd-desk-02-p1
  kind: hands-on
  title: 留下一份可辨識的 UTF-8 訂單
  minutes: 9
  steps:
  - 開啟副檔名顯示後，按正文把樣本存成 inputs 內的 orders.csv。
  - 關閉記事本，再使用記事本開啟完整檔名。
  checks:
  - 檔名只有 .csv 結尾，不是 .csv.txt。
  - 一行欄名、兩筆訂單，北倉與南倉皆未變成亂碼。
---

營運把一份訂單寄成表格，另一個同事卻用記事本看到滿頁逗號。兩人可能拿的是同一種數據的不同包裝。今天做一份人能直接讀的小樣，日後交接時能交代檔名、文字格式和字元編碼，而不是只說「Excel 那份」。

## 檔名、格式、編碼各管一件事

- **副檔名（file extension）**：通常是檔名最後一個點之後那一段，例如 `orders.csv` 的 `.csv`。Windows 會用它提示開啟方式，但把 `.csv` 換成 `.xlsx` 不會改寫內容。
- **檔案格式（file format）**：規定內容怎麼組織。純文字（plain text）存字與換行；逗號分隔值（comma-separated values，CSV）用文字把欄位排在一列，簡單例子用逗號分欄。`.xlsx` 則是活頁簿格式，能保存工作表與儲存格樣式，不是把逗號文字另取一個名字。之後在[〈CSV 與引號〉](#/lesson/fd-io-01)會處理欄位本身含逗號的情形。
- **字元編碼（character encoding）**：規定字如何對應到磁碟上的位元組。UTF-8 是其中一種規則；讀取時若拿另一套規則解讀同一串位元組，中文字可能變成亂碼。字能不能正確讀回，和欄位怎麼分隔是兩回事。

## 用記事本做一份小樣

在檔案總管開啟「檢視 → 顯示 → 副檔名」（Windows 10 可在「檢視」頁籤勾選「副檔名」）。用開始功能表開啟記事本（Notepad），將以下 3 行貼進空白檔案。它們都是練習用數據；第一列是欄名，後兩列各是一筆訂單。

```csv
order_id,warehouse,total
0007,北倉,120
0010,南倉,80
```

用「另存新檔」到 `C:\dev\conduit-lab\desk\inputs`，將存檔類型選「所有檔案」，檔名輸入 `orders.csv`，編碼選 `UTF-8`。如同名檔已存在，先用記事本核對是不是本課小樣，不覆寫其他內容。回檔案總管檢查完整名稱；關掉記事本，再從記事本的「開啟」選同一份（檔案類型選「所有檔案」才看得到 CSV）。確認倉名和開頭的零都還在。

為什麼用文字工具重開？試算表軟體可能把 `0007` 當數量而顯示為 `7`。即使來源檔仍是 `0007`，這個畫面也不足以證明原始文字有沒有保留。不要用試算表另存原檔來做驗收；先用能直接看文字的工具檢查。下次有人報告「數據少了零」，你可以先釐清是來源真的變了，還是讀取工具自行推斷了類型。

## 判斷問題在哪一層

假如重開時整份小樣還是 3 行，但欄名與中文都擠在一起，先檢查是否用支援 CSV 的檢視方式，再看分隔符。若逗號、英文字都正常，只有北倉與南倉變成亂碼，則優先核對讀寫編碼。每次只改讀取方式，保留原始樣本，才能知道是哪一層修好了問題。

## 常見錯誤

- 另存後看到 `orders.csv.txt` → 存檔時套用了文字檔類型 → 在「所有檔案」下另存正確名稱並重開核對。
- 改名 `.xlsx` 後試算表警告格式不符 → 檔名與實際格式不同 → 用原副檔名與相符的工具開，不靠改名轉檔。
- 倉名顯示亂碼 → 解讀使用的編碼可能不對 → 保留原檔，用 UTF-8 重開本課小樣；不要直接存回亂碼畫面。
