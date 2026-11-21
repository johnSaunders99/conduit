---
id: fd-git-02
module: fd-git
order: 2
title: 暫存區與提交
subtitle: 只留這次口徑變更
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-01
objectives:
- 指出工作區、暫存區與最新提交各保存哪一版
- 只將指定檔案的當前版本放進暫存區
- 提交後核對歷史與尚未入歷史的差異
tags:
- git add
- git commit
- git status
- 暫存區
resources:
- title: Recording Changes to the Repository
  url: https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 看 Staging 如何選定要提交的版本。
concepts:
- id: fd-git-02-stage-copy
  prompt: git add 某檔後又修改並儲存，直接 commit 會收哪版？
  answer: 會收上次 add 放進暫存區的那版，不是編輯器裡最新的版本。
  mcq:
    options:
    - 磁碟上最新的一版
    - 兩個版本各成一筆提交
    - 上次 add 的那版
    - 要看 GitHub 最新是哪版
    answer: 2
    explain: 暫存區是你選的內容，不會跟著後續存檔自動更新。
- id: fd-git-02-stage-purpose
  prompt: 為什麼不用一次把資料夾裡所有東西都 add？
  answer: 按檔選入可以把本次規則變更與草稿、產物分開。
  mcq:
    options:
    - 能選定這次要留下的內容
    - git add 只能吃一個檔案
    - 未選入的檔案會被自動刪除
    - 全部選入會改遠端地址
    answer: 0
    explain: Git 允許批次選入，但本課先精準選檔，避免無關內容入歷史。
- id: fd-git-02-status-am
  prompt: 在第一筆提交之前，git status --short 顯示 AM orders-rule.txt 表示什麼？
  answer: 第一欄 A 表示已暫存新增；第二欄 M 表示工作檔在那之後又被修改。
  mcq:
    options:
    - 兩個檔案名稱相同
    - 所有修改已提交
    - A 是工作檔，M 是遠端
    - 已暫存新增，工作檔相對暫存版本又修改
    answer: 3
    explain: 兩欄分開讀；同一個檔可以同時有已暫存與未暫存的差異。
- id: fd-git-02-snapshot
  prompt: 提交完成後，還能改工作檔而不改掉那筆提交嗎？
  answer: 能；提交是當時暫存內容的快照，後續修改要另成新提交才會進歷史。
practice:
- id: fd-git-02-p1
  kind: hands-on
  title: 讓同一個檔案出現兩個不同版本
  minutes: 11
  steps:
  - 依正文暫存 orders-rule.txt 的初版。
  - 用編輯器存下減退款的第二版；不再次 add 就提交。
  - 查短狀態和 git show HEAD:orders-rule.txt。
  checks:
  - 提交中的值是 net = sales；磁碟仍是 net = sales - refunds。
  - 短狀態的 M 只在第二欄；第二版留給下一堂。
---

今天把報表口徑的初稿放進歷史，同時留一個還沒提交的修正版。這個差別在實務很重要：改完一行不等於交付了那一版；要確認 Git 真正保留了哪一份。

## 同一個檔案可以有三個樣子

工作區是磁碟上正在編輯的檔案。暫存區（staging area，也叫 index）是準備交成下一筆的內容。提交（commit）是用暫存區做出的版本快照（snapshot），帶有一段訊息。這裡的 index 是 Git 的暫存區，與 Python 列表的位置不是同一件事。

- `git status --short`：第一欄報暫存區相對目前提交的狀態，第二欄報工作檔相對暫存區的狀態。`A` 是新增、`M` 是修改、`??` 是未追蹤。
- `git add -- orders-rule.txt`：把這個檔此刻的內容選進暫存區。`--` 分隔選項與檔名，之後可沿用。
- `git commit -m '訊息'`：從暫存區做出提交，`-m` 提供這次變更的說明。它不是上傳指令。

## 在暫存之後再改一行

在 `C:\dev\conduit-lab\report-git` 沿用上一堂的庫，先確認 `orders-rule.txt` 只有 `net = sales`、短狀態是 `??`，且沒有其他先前的暫存內容。執行這兩行後，檔名左邊第一欄應是 `A`。

```powershell
git add -- orders-rule.txt
git status --short
```

用編輯器把同一檔案改成 `net = sales - refunds` 並儲存。這只是示例中的口徑說明，不必執行那行文字。短狀態變成 `AM`：暫存區仍是初稿，工作檔已是修正版。現在**先不要再次 add**，提交一次後查證：

```powershell
git status --short
git commit -m 'Record the initial sales rule'
git show HEAD:orders-rule.txt
git status --short
```

`HEAD` 目前指向所在的提交。這條 `git show` 指令讀的是提交裡的檔案，應印 `net = sales`。工作檔仍多出減退款的修改，只在短狀態第二欄出現 `M`。保留這個狀態；[〈差異與歷史〉](#/lesson/fd-git-03)會拿兩版查證漏算原因。日後寫提交訊息時，用一個動作加上改的是哪條規則，別只寫「更新」。

## 拿三欄來對照，不背兩個字母

把這堂分成四個時間點。剛開課，工作檔是初稿，還沒有暫存或歷史。第一次選入後，工作檔與暫存區一致，都只有銷售額，但歷史仍空。存下扣退款的草稿後，只有工作檔前進，暫存區仍是初稿。第一次提交時，暫存區成為歷史快照，工作檔沒有被它覆寫，所以你眼前仍是扣退款的新規則。對照每一步，只有真的執行過的動作才會讓其中一欄改變。

如果要把這份練習交給同事看，請指出「提交中的那一行」和「工作檔的那一行」各自來自哪裡。只給一張編輯器截圖，無法證明哪份進了版本歷史。真正要交付日報修正時，應再選入更新並看暫存內容；這堂為了讓差別可見，所以故意保留工作檔變更。不要在正式報表提交已知不正確的版本來模仿此實驗。

## 常見錯誤

- 工作檔修了，但提交還是初稿 → 修完沒再暫存 → 真要交修正版時，再 `add` 並檢查暫存內容。
- `commit` 沒有可提交內容 → 還沒暫存新版本 → 先用 `status` 看分類，不反覆嘗試提交。
- 在其他練習庫找不到這筆 → 檢視位置錯了 → 先以 `git rev-parse --show-toplevel` 證明自己在指定庫。
