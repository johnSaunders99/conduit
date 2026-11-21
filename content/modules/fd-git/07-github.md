---
id: fd-git-07
module: fd-git
order: 7
title: GitHub 與遠端
subtitle: 交付一個可複製的範例
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-06
objectives:
- 分開核對本機分支、遠端名稱、目的地址與上游分支
- 只在自有私有練習庫推送已檢查的合成示例
- 不連網時仍能交付含分支與提交識別碼的本機交接卡
tags:
- GitHub
- 遠端
- origin
- 上游分支
- git push
resources:
- title: Managing remote repositories
  url: https://docs.github.com/en/get-started/git-basics/managing-remote-repositories
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 選 Windows，讀驗證地址及新增遠端的段落。
- title: Creating a repository for your project on GitHub
  url: https://docs.github.com/en/get-started/start-your-journey/uploading-a-project-to-github
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看建立儲存庫的選項，本練習只選自有私有庫。
- title: git-push
  url: https://git-scm.com/docs/git-push
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 --set-upstream，對照首次成功推送如何設定追蹤。
concepts:
- id: fd-git-07-origin-name
  prompt: origin 就等於 GitHub 嗎？
  answer: 不是，origin 只是本機替某個遠端地址取的慣用名稱。
  mcq:
    options:
    - 是，它永遠代表 GitHub
    - 不是，需檢查地址才能知道收件處
    - 是，它就是本機主線的全名
    - 不是，它表示第一次提交
    answer: 1
    explain: 名字可自訂，收件端要用實際推送地址判斷。
- id: fd-git-07-push-upstream
  prompt: 首次成功執行 git push -u origin main，-u 有什麼用途？
  answer: 替本機 main 設定追蹤的上游分支；不是建立 GitHub 帳號。
  mcq:
    options:
    - 預先忽略原始數據
    - 改寫遠端所有分支
    - 把工作區未儲存內容上傳
    - 設定本機 main 的上游關係
    answer: 3
    explain: push 送已提交內容；-u 讓該本機分支知道對應哪個遠端分支。
- id: fd-git-07-verify-history
  prompt: 確認這次能推送前，只看工作檔沒有真實數據夠嗎？
  answer: 不夠；push 傳送提交歷史。要確認歷史從頭都是合成練習內容，並核對地址與可見性。
  mcq:
    options:
    - 不夠，要檢查將分享的整段歷史與目的地
    - 夠，只傳目前工作檔
    - 夠，私有庫就不需檢查
    - 不夠，只要另外加一行 *.csv
    answer: 0
    explain: 刪工作檔或加忽略規則不會從舊提交回收內容。
- id: fd-git-07-clone-meaning
  prompt: 在另一個資料夾執行 clone，是把近期未提交草稿也帶過去嗎？
  answer: 不會；它從指定遠端複製可取得的版本歷史與工作副本，不會帶自己沒推送的本機草稿。
practice:
- id: fd-git-07-p1
  kind: hands-on
  title: 做一張可核對的交接卡
  minutes: 10
  steps:
  - 在 report-git 查根目錄、main 與最新提交，把分支和識別碼記於庫外 checks\git-delivery.txt。
  - 有自有私有庫且選擇連網時，依正文核對地址、推送與比對頁面；否則註記僅本機。
  checks:
  - 本機卡有分支、提交與合成檔名。
  - 若實際分享，頁面最新 main 的提交與本機一致；卡上不記任何帳號或憑證。
---

本機留有時序清楚的口徑變更，現在想交給另一個人重現。Git 管理歷史；GitHub 是託管 Git 儲存庫的服務。先能指出要交付哪一筆，再決定是否傳出去；練習不需要公開或使用公司的數據與帳號。

## 地址、分支、提交不要混在一起

遠端（remote）是本機替另一個儲存庫記下的連線名稱。`origin` 是常用別名，不保證是你以為的位置。推送（push）把本機指定分支的相關提交送到遠端；它不是上傳目前畫面。`-u` 在成功推送（或該分支已一致）時替本機分支設定上游分支（upstream branch），例如本機 `main` 追蹤 `origin/main`。複製（clone）則在另一個目錄取得遠端的歷史與工作副本，不會帶走尚未提交的草稿。

## 先完成本機交接

在 `C:\dev\conduit-lab\report-git` 接續上一堂。以下指令不連網；`git log --oneline --name-only main` 列出主線的提交與涉及的檔名，可用來巡查從課首建立的小樣。檔名列表不能驗證內容，有疑慮就用 `git log -p main` 看逐筆變更，未確定安全以前不要推送。

```powershell
git rev-parse --show-toplevel
git status --short --branch
git log -1 --oneline
git log --oneline --name-only main
```

把本機分支、最新提交識別碼和 `orders-example.csv` 記在庫外的 `desk\checks\git-delivery.txt`。不連網就在最後寫「僅本機」，本課可完成；下一堂也不靠遠端繼續。

## 選做：推到自有的私有練習庫

只有在確認主線從頭到尾都是本課的合成示例、沒有任何私密內容時，才在 GitHub 按官方說明建一個**自有、私有、空白**的練習庫（不初始化 README 或授權檔）。從頁面複製 HTTPS 地址，不把帳號、權杖或密碼貼進教材或筆記。

先在 `report-git` 執行 `git remote -v`。沒有 `origin` 才新增：把下面的 `PASTE_PRIVATE_CLONE_URL` 換成該庫的 HTTPS 地址；已有 `origin` 時只查證，若不符便停止，不在陌生目的地上試傳。

```powershell
git remote add origin 'PASTE_PRIVATE_CLONE_URL'
git remote get-url --push origin
```

比對實際推送地址、私有可見性、目前 `main` 及乾淨狀態後，才執行 `git push -u origin main`。有登入提示時使用官方身分驗證流程，勿把憑證放進命令。成功後看 GitHub 的 `main` 頁面，核對最新提交與本機卡一致。這一步只分享 `main`，不是所有本機實驗分支。

## 分享之後用另一份工作副本驗收

若已完成前段推送，可在 `C:\dev\conduit-lab`（不是 `report-git` 內）另開 PowerShell，確認還沒有 `report-copy` 資料夾。只對自己剛核對過的私有地址使用下面的命令，先用真正地址替換標記，再執行。複製後不必上傳任何東西。

```powershell
git clone --branch main 'PASTE_PRIVATE_CLONE_URL' report-copy
Set-Location -LiteralPath '.\report-copy'
git log -1 --oneline
Get-ChildItem -Name
```

新副本的最後一筆應吻合交接卡，合成範例可重新開啟，原練習庫中被忽略的本機檔案不會被帶來。這一步驗的是交付成果，不是登入成功本身。若未連網，只留下「本機已核對」，不要說成別人已能下載。

## 常見錯誤

- 看見 `origin` 就以為收件端正確 → 要查的是地址 → 先用 `git remote get-url --push origin`。
- 遠端拒絕推送，說有本地沒有的歷史 → 練習庫可能非空或有人先傳過 → 停下確認，不強制推送。
- 頁面沒有工作檔最新修改 → 推送的單位是提交 → 先在本機看狀態與歷史，不用再次盲推。
