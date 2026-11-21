---
id: fd-desk-06
module: fd-desk
order: 6
title: PowerShell 管道
subtitle: 只留下錯誤訊息
status: ready
minutes: 25
level: 1
prereqs:
- fd-desk-05
objectives:
- 用管道依日誌等級篩選整行文字
- 先核對篩選後的列，再計數並另存驗收檔
tags:
- Get-Content
- Where-Object
- Measure-Object
- 日誌篩選
resources:
- title: One-liners and the pipeline
  url: https://learn.microsoft.com/en-us/powershell/scripting/learn/ps101/04-pipelines?view=powershell-7.6
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀管道的基本例子，分辨下一段收到的內容與畫面排版。
concepts:
- id: fd-desk-06-pipeline-flow
  prompt: Get-Content 透過 | 把什麼交給本課的 Where-Object？
  answer: 逐行交出文字，每一行是一個字串物件。
  mcq:
    options:
    - 整個檔名
    - 已排版的表格圖片
    - 一列一列的字串物件
    - 只交符合 ERROR 的列
    answer: 2
    explain: Get-Content 不負責選等級；篩選是第二段的工作。
- id: fd-desk-06-prefix-match
  prompt: 要保留本課所有 ERROR 等級，但排除 INFO error budget checked，選哪個比對？
  answer: 用 -like 'ERROR *' 比對完整行是否以 ERROR 加空格開頭。
  mcq:
    options:
    - -like 'ERROR *'
    - -like '*error*'
    - -like 'INFO *'
    - -like 'ERROR'
    answer: 0
    explain: 中間有 error 不代表等級是 ERROR；沒有星號又只能找到恰好是 ERROR 的一行。
- id: fd-desk-06-measure
  prompt: Measure-Object 應放在篩選之前還是之後，才能數錯誤列？
  answer: 放在篩選之後；收到的每一筆才都是符合條件的列。
  mcq:
    options:
    - 之前，因為先知道原始列數會自動扣除 INFO
    - 前後一樣，只要讀的是同一檔
    - 不需 Measure-Object，管道會自動只印總數
    - 之後，讓它只計入篩選結果
    answer: 3
    explain: 原檔有 4 列，只有 2 列通過，先計數答的是原檔有幾列。
- id: fd-desk-06-literal-level
  prompt: 為什麼要先看篩選結果，再相信錯誤列數？
  answer: 總數相同也可能挑錯列；先核對等級與內容，再用計數跟預期比對。
  interview:
    question: 錯誤列數突然從 2 變成 3，你怎麼確認是不是多了一筆真錯誤？
    answer: 我先固定同一份來源與編碼，單獨印出篩選結果。再檢查比對是否限定在等級欄，而不是把內文提到 error 的 INFO 也算進去。確認列對了才量 Count。
    points:
    - 先固定來源檔與讀取方式
    - 核對實際保留的列
    - 辨認等級與內文的差異
practice:
- id: fd-desk-06-p1
  kind: hands-on
  title: 保留兩筆錯誤與一次計數
  minutes: 10
  steps:
  - 用正文的管道把 ERROR 列輸出至 checks\errors.log，並讀回檢查。
  - 在 load.log 加一行 INFO error retry tested，重跑計數；再加一行 ERROR extra retry failed，重跑計數。
  checks:
  - 原本與多一筆 INFO 都是 Count = 2；再多一筆 ERROR 是 Count = 3。
  - 初版 errors.log 只有兩筆原本的 ERROR；驗收後將原始小樣還原為 4 行。
---

夜間匯入的日誌裡，不是每一行出現 `error` 都代表工作出了錯。昨晚的 `INFO error budget checked` 是正常訊息。今天做一個能解釋的查法：先看實際留下哪幾列，再回答「有幾列」。

## 讀取、篩選、計數

管道（pipeline）把左側輸出的數據交給右側指令，符號是 `|`。PowerShell 在指令間通常傳的是物件（object），就是可以處理的值，不是畫面上的排版。`Get-Content` 讀本課檔案時，左邊交出的是一行一行的字串（string，即文字值）；右邊拿每一行來判斷。並非所有管道都傳文字，例如之前列檔時也可以取得帶檔名、大小等特徵的檔案物件。

- `Get-Content -LiteralPath '.\load.log' -Encoding utf8`：先把來源文字按列交出。
- `Where-Object { $_ -like 'ERROR *' }`：大括號裡是篩選規則；`$_` 代表目前這一列，`-like` 做樣式比對，`*` 可比對零個或更多任意字元。模式從 `ERROR` 與一個空格開頭，內文提到 error 的 INFO 不符合。預設不區分大小寫；格式若要求大寫才算等級，可以改用 `-clike`。
- `Measure-Object`：接到幾筆就計入幾筆，看輸出的 `Count`。移到篩選前就不再回答同一個問題。

## 逐段驗收，再把證據存下來

用上一堂的 4 行 `load.log`。在 PowerShell 切到 `C:\dev\conduit-lab\desk\daily logs`，先讀保留列，應看到 `missing order_id` 和 `invalid total` 兩筆，再加計數。按 Enter 執行一整行；不要把每個 `|` 切成獨立命令。

```powershell
Set-Location -LiteralPath 'C:\dev\conduit-lab\desk\daily logs'
Get-Content -LiteralPath '.\load.log' -Encoding utf8 | Where-Object { $_ -like 'ERROR *' }
Get-Content -LiteralPath '.\load.log' -Encoding utf8 | Where-Object { $_ -like 'ERROR *' } | Measure-Object
```

`Count` 應是 2。把計數那段換成 `Out-File`，即可把兩列另存到練習區。確認 `checks` 內沒有要保留的同名檔再執行；`-NoClobber` 會拒絕覆寫，不清空原始日誌。如已存過且只想查驗，可以只執行最後一行。

```powershell
Get-Content -LiteralPath '.\load.log' -Encoding utf8 | Where-Object { $_ -like 'ERROR *' } | Out-File -LiteralPath '..\checks\errors.log' -Encoding utf8 -NoClobber
Get-Content -LiteralPath '..\checks\errors.log' -Encoding utf8
```

## 用反例證明條件沒有選太廣

本課計的是**錯誤日誌列數**，不是失敗的訂單數。同一筆訂單可能重試 3 次，每次印一列；此時有 3 列錯誤，卻不代表 3 筆不同的訂單失敗。另存的 `errors.log` 保留錯誤內容，讓你能在有人追問時指出每一列，而不是只交一個沒法稽核的總數。這份小樣沒有訂單識別碼，無法從中推回不同訂單的筆數。

驗收時先預測再操作。先在自造的來源檔末尾加一列 `INFO error retry tested`，只重跑計數那條，應仍然是 2；再加 `ERROR extra retry failed`，應成為 3。這個對照同時檢查「應排除的沒有混入」和「應保留的沒有被漏掉」。如果兩次都增加，先把計數拿掉，單看篩選後的文字；如果兩次都不增加，先用 `Get-Content` 看剛存的新列有沒有真的被讀到。

驗收完成後把自造來源復原成舊的 4 行，保留初版的錯誤檔和自己的三個預測。日後接到不同格式的日誌，先看它把等級寫在哪裡，再換比對規則；這個固定前綴不適用所有日誌。

## 常見錯誤

- 印出 3 列卻只預期 2 列 → `'*error*'` 也選中 INFO 內文 → 以等級開頭並保留後面的空格。
- 看見 `Count` 為 4 → 算到原始日誌，而非通過篩選的結果 → 把計數放在最後。
- 準備存檔時目的地仍指 `load.log` → 把來源與產物指向同一個檔 → 改存 `checks` 的獨立檔名。不要用原件冒險。
