---
id: fd-desk-05
module: fd-desk
order: 5
title: 路徑與引號
subtitle: 穿過名稱有空格的資料夾
status: ready
minutes: 25
level: 1
prereqs:
- fd-desk-04
objectives:
- 用絕對與相對路徑切到同一個有空格的目錄
- 用引號與 -LiteralPath 讀取指定的日誌
tags:
- 相對路徑
- 絕對路徑
- 引號
- 工作目錄
resources:
- title: about_Quoting_Rules
  url: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看空格與單、雙引號的差別，先略過進階內嵌語法。
- title: Set-Location
  url: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-location
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 LiteralPath 參數，核對如何按字面指定位置。
concepts:
- id: fd-desk-05-abs-rel
  prompt: 從 desk 出發，.\daily logs 和 C:\dev\conduit-lab\desk\daily logs 差在哪裡？
  answer: 前者依賴目前位置，後者從磁碟機根目錄描述完整位置。
  mcq:
    options:
    - '前者永遠從 C: 開始'
    - 前者依起點，後者不用靠 desk 當起點
    - 兩者都是依目前目錄查找
    - 後者會自動新建 daily logs
    answer: 1
    explain: 相對位置要有起點；完整位置也必須真的存在，不會被切換指令自動建立。
- id: fd-desk-05-parent-symbol
  prompt: 在 desk\daily logs 內輸入 Set-Location -LiteralPath '..' 會到哪裡？
  answer: 到直屬的上一層 desk。
  mcq:
    options:
    - 磁碟機根目錄
    - daily logs 中下一個檔案
    - 先前瀏覽過的任意位置
    - desk
    answer: 3
    explain: 兩個句點指父目錄，不是視窗瀏覽紀錄。
- id: fd-desk-05-quotes
  prompt: 為何要把 .\daily logs 放在一對引號裡？
  answer: 讓 PowerShell 把含空格的路徑視為一個完整值。
  mcq:
    options:
    - 讓空格留在同一個路徑值中
    - 把相對路徑轉成絕對路徑
    - 把空格從磁碟上的檔名移除
    - 允許 Set-Location 建立新位置
    answer: 0
    explain: 引號改的是解譯方式；相對或絕對仍取決於路徑內容。
- id: fd-desk-05-literal
  prompt: 引號與 -LiteralPath 的工作一樣嗎？
  answer: 不一樣：引號讓文字一起傳入，-LiteralPath 要求把它按原字面當路徑。
  mcq:
    options:
    - 相同，都是切到父目錄
    - 相同，都是替檔名補副檔名
    - 不相同，一個保住整段輸入，一個避免展開路徑比對符號
    - 不相同，只有引號會建立資料夾
    answer: 2
    explain: 空格與路徑比對是兩層問題，兩個工具可一起使用。
practice:
- id: fd-desk-05-p1
  kind: hands-on
  title: 從兩個起點打開同一份日誌
  minutes: 8
  steps:
  - 建立 daily logs 和正文的 load.log。
  - 用絕對路徑抵達 daily logs，再回上一層用相對路徑抵達。
  checks:
  - 兩次查出的完整位置相同。
  - Get-Content 顯示 4 列，含 2 列 ERROR 與 1 列提到 error 的 INFO。
---

交班時同事給了你一份 `daily logs` 裡的日誌（log）。空格只是資料夾名的一部分，但解譯器通常也用空格分隔指令與選項。今天保留這個名字不改，練習把同一條路用兩種方式走通。

## 路徑從哪裡開始？

- `C:\dev\conduit-lab\desk\daily logs` 是**絕對路徑（absolute path）**，從磁碟機根目錄寫到目的地。
- `.\daily logs` 是**相對路徑（relative path）**，前綴 `.\` 表示從目前位置往下走；只有目前在 `desk` 時才是上面那一條路。
- `..` 代表直屬上一層，所以從 `daily logs` 回 `desk` 可以用 `Set-Location -LiteralPath '..'`。跟檔案總管的向上一層意思相同。

指令後面的路徑是它收到的值。用成對半形單引號把 `daily logs` 所在的整段包起來，PowerShell 就不會把空格拆成兩個值。單引號讓引號內文字照字面傳遞；雙引號也能包住空格，但對 `$` 表達式有展開規則，本課選單引號。`-LiteralPath` 是下一層：收到路徑後，要求指令不要把方括號等路徑比對符號當成模式。引號與選項各解決一件事，並不重複。

## 給下一堂準備日誌

用檔案總管在 `C:\dev\conduit-lab\desk` 下新增 `daily logs`。用既有編輯器在其中建立純文字 `load.log`，選 UTF-8，存入這 4 行自造的匯入日誌。如果同名檔已有其他用途，先保留它，不把練習內容存回去。

```text
INFO batch started
ERROR missing order_id
INFO error budget checked
ERROR invalid total
```

在 PowerShell 先從完整路徑抵達，再從上一層走相對路徑。`Get-Content` 是讀出文字檔，不會改檔；`-Encoding utf8` 明確交代讀取規則。

```powershell
Set-Location -LiteralPath 'C:\dev\conduit-lab\desk\daily logs'
Get-Location
Set-Location -LiteralPath '..'
Set-Location -LiteralPath '.\daily logs'
Get-Location
Get-Content -LiteralPath '.\load.log' -Encoding utf8
```

兩次報出的完整位置應該一致，最後正好讀到上面 4 行。若改從別處直接輸入相對路徑，就可能找不到；這是起點改變，不是日誌消失。說給同事聽時，短路徑要連同執行位置一起交代。下一堂[〈PowerShell 管道〉](#/lesson/fd-desk-06)會從這 4 行挑出錯誤。

## 先預測起點，再看結果

把目前位置想成貼在桌面地圖上的一個圖釘。人在 `desk` 時，`.\daily logs` 只要往下一層；人在 `inputs` 時，同一串字會去找 `inputs` 下的 `daily logs`，這個練習並沒有建立它。從 `inputs` 出發，有兩種說法能通：先回父目錄再往下一層，或直接指定完整地址。兩條能通的路，最後 `Get-Location` 應該報出同一個位置。

給同事一個命令時，也要給起點。如果希望人在任何資料夾都能重現，使用絕對路徑；如果同一份練習會搬到 D: 或另一台機器，可以先交代「先到自己的 `desk`」，剩下用相對路徑。兩者不是誰更進階，而是你能否保證共同起點。最後用檔案總管位址列確認完整路徑，不必因 PowerShell 把路徑拆開就重新命名資料夾。

若兩人磁碟機不同，保留後半段，再各自確認起點。

## 常見錯誤

- `daily` 和 `logs` 被當成不同值 → 忘了引號 → 包住包含空格的整段路徑。
- 路徑語法正確卻找不到 → 可能站在錯的起點，或尚未建立目的地 → 用 `Get-Location` 檢查後再走。
- 路徑從 D: 建好，指令仍找 C: → 前面選了備用磁碟機 → 本課與後續練習一致換成實際磁碟機。
