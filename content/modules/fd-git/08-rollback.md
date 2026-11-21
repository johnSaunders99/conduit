---
id: fd-git-08
module: fd-git
order: 8
title: 還原與回退
subtitle: 修錯後仍保留審查軌跡
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-07
objectives:
- 先辨認錯誤在未提交工作檔或已提交歷史，再選 restore 或 revert
- 在核對目標提交後，新增反向提交保留原識別碼
- 用淨額小算例與無關檔案證明只回退指定變更
tags:
- git restore
- git revert
- 反向提交
- 回退
resources:
- title: git-restore
  url: https://git-scm.com/docs/git-restore
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀預設來源及 --staged，分辨會更動哪一區。
- title: git-revert
  url: https://git-scm.com/docs/git-revert
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Description，比較反向提交與直接捨棄改動。
concepts:
- id: fd-git-08-select-action
  prompt: 已共享一筆錯誤提交，想保留審查軌跡，該選什麼？
  answer: 核對提交後用 git revert 產生反向提交。
  mcq:
    options:
    - 用 git restore 抹掉舊提交
    - 改掉提交訊息，不改內容
    - 用 git revert 新增一筆抵銷
    - 刪掉規則再強制推送
    answer: 2
    explain: 反向提交保留原紀錄；restore 主要取回指定區域內容，不會抵銷共享歷史。
- id: fd-git-08-restore-source
  prompt: git restore --worktree -- orders-rule.txt 在未暫存修改的本課會從哪取得內容？
  answer: 從暫存區還原工作檔；未暫存草稿會被覆寫。
  mcq:
    options:
    - 遠端 main
    - 暫存區
    - 上一個分支的根目錄
    - 上一個合併衝突標記
    answer: 1
    explain: 未指定其他來源時，修復工作檔使用暫存內容；先看差異再決定是否放棄。
- id: fd-git-08-revert-scope
  prompt: 反向提交前一筆錯誤規則時，後一筆新增的 report-window.txt 應消失嗎？
  answer: 不應；反向提交抵銷目標提交的差異，無關的後續檔案仍在。
  mcq:
    options:
    - 應消失，因為整個庫回到兩筆之前
    - 只有未追蹤檔會留下
    - 應消失，除非改遠端名稱
    - 不應，只反轉所選變更
    answer: 3
    explain: revert 將目標差異反向套在目前版本，不是整庫換回舊快照。
- id: fd-git-08-proof
  prompt: 回退後，哪些證據能說明既修正數值又可追查？
  answer: 保留誤改和反向提交編號，驗算規則輸出，再確認無關的後續檔案還在。
  interview:
    question: 報表扣退款的規則在共享主線上被改壞，你會怎麼修？
    answer: 我先找出真的改壞那行的提交，確認工作區乾淨，再新增一筆反向提交或必要的精確修正。以有退款的樣本驗出淨額，並保留原提交與修正提交，讓同事能追查。
    points:
    - 先定位提交並看內容
    - 不重寫共用歷史
    - 驗算數值及後續變更
practice:
- id: fd-git-08-p1
  kind: hands-on
  title: 讓 80 回來，但保留原錯誤與後來的規則
  minutes: 12
  steps:
  - 在練習庫依正文試一次還原未暫存草稿，再新增錯誤版本與無關視窗檔。
  - 核對再反向提交錯誤一筆；抄下兩個提交識別碼。
  checks:
  - 銷售 100、退款 20 淨額又為 80；report-window.txt 仍存在。
  - 歷史同時列出錯誤、後續規則與反向提交，短狀態乾淨。
---

報表又算成 100，正確淨額應是 80。先問錯處在哪：如果還只在工作檔，可以放棄那段草稿；如果已經是提交，尤其其他人已引用它，應增一筆修正，而不是讓舊歷史消失。這堂只用本機練習庫，不需要前一堂的網路步驟。

## 兩種動作，先看影響範圍

- `git restore --worktree -- 檔名` 把工作區檔案換成暫存區版本；會覆寫沒有暫存的修改，不增加提交。`git restore --staged -- 檔名` 通常從 `HEAD` 恢復暫存區，不替你改工作檔。本課只做前者。
- `git revert 提交` 建立反向提交（revert）：把目標相對於父提交的變動反向套到眼下的版本，原提交仍可查。太新的改動若碰同一行，可能要解衝突；這堂讓無關變更在別的檔案。

## 還原可放棄的草稿

在 `C:\dev\conduit-lab\report-git`，確認自己站在乾淨的 `main`，第一行應是 `net = sales - refunds`。在編輯器把**第一行**暫改成 `net = sales`，不暫存。先跑 `git diff -- orders-rule.txt`；只看到剛輸入的那一行才執行以下還原。本步是刻意丟棄合成草稿，若有其他想保留的修改不要執行。

```powershell
git restore --worktree -- orders-rule.txt
git status --short
```

工作檔應恢復扣退款，短狀態空白，歷史沒多一筆。若編輯器還開著舊文字，先重新載入，不要把它再存回去。

## 回退已提交的錯誤

在同一練習庫，現在把第一行**再**改成 `net = sales` 並存檔；其餘去重規則不動。提交這筆刻意的錯誤，再用編輯器新增 `report-window.txt`（僅一行 `window = daily`），讓它成為下一筆無關提交。

```powershell
git add -- orders-rule.txt
git commit -m 'Simulate ignoring refunds'
```

建立並儲存新文字檔後接著執行：

```powershell
git add -- report-window.txt
git commit -m 'Record the daily report window'
git log --oneline -2
git show 'HEAD~1' -- orders-rule.txt
git status --short
```

只有在短狀態乾淨、`HEAD~1` 確實是剛才移除扣退款的那筆時，才做反向提交。`--no-edit` 採用預設訊息；不改錯誤提交本身。

```powershell
git revert --no-edit 'HEAD~1'
git log --oneline -3
git show HEAD:orders-rule.txt
git show HEAD:report-window.txt
git status --short
```

最後三筆上到下應是反向提交、時間窗口、故意的錯誤。用 100 和 20 手算回 80，並確認 `window = daily` 和去重規則仍在。這是精確修正，不是把整個目錄換回舊版。

## 回退之後看三個互相獨立的證據

第一個看數值：有退款的樣本回到 80，退款為零的樣本維持 100。第二個看範圍：無關的時間窗口仍留在最新版本，去重也沒有退回較早草案。第三個看歷史：錯誤提交照樣可按原識別碼找到，新的反向提交用另一個識別碼說明何時修正。如果只看錯誤數字有沒有消失，容易漏掉不該回退的一部分；若只看歷史多一筆，也不能證明修對了。把三種證據抄到庫外驗收筆記，讓沒有目睹當下操作的人也能跟著核對。

## 常見錯誤

- 恢復工作檔後自己的修改不見 → `restore --worktree` 覆寫未暫存內容 → 動手前先看差異並保存要留的草稿。
- 本想修錯卻選了最新提交 → 最新筆是報表窗口 → 先查目標的識別碼與實際差異，再回退。
- 反向套用發生衝突 → 現在的改動與目標碰到同一處 → 停止連續重試，按[〈衝突處理〉](#/lesson/fd-git-06)的判讀方法確認意圖；不確定時可在尚未完成反向操作時用 `git revert --abort`。
