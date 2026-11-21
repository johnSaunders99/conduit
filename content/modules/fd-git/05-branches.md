---
id: fd-git-05
module: fd-git
order: 5
title: 分支與合併
subtitle: 同時試兩種去重規則
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-04
objectives:
- 自相同主線開兩條試驗分支並各留一份去重規則
- 用 git show 比較分支版本且不改工作檔
- 在接收分支上確認方向並完成快轉合併
tags:
- git switch
- git merge
- 快轉
- 去重規則
resources:
- title: Basic Branching and Merging
  url: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀分支分開走與快轉合併的圖，對照接收方向。
concepts:
- id: fd-git-05-branch-pointer
  prompt: 剛建一個新分支，Git 是否複製了整個工作資料夾？
  answer: 沒有；分支名指向一筆提交，之後會隨該線的新提交往前。
  mcq:
    options:
    - 會，另存到上一層
    - 會，把所有未追蹤內容也複製
    - 不會，只新增指向提交的名稱
    - 不會，要先 push 才會出現分支
    answer: 2
    explain: 分支隔離的是版本路線，不是每個名稱都配一份磁碟副本。
- id: fd-git-05-merge-direction
  prompt: 想讓 main 接收 dedup-order，應站在哪個分支執行 merge？
  answer: 先切到 main，再執行 git merge --ff-only dedup-order。
  mcq:
    options:
    - 站 dedup-order，合進 main
    - 站另一個實驗分支
    - 站在哪都相同
    - 站 main，要接收哪條才把那個名交給 merge
    answer: 3
    explain: merge 影響目前分支；參數指定要接進來的分支。
- id: fd-git-05-fast-forward
  prompt: main 沒有新增提交，而實驗分支從 main 多一筆，快轉會做什麼？
  answer: 讓 main 的指標前移到該筆，不另做合併提交。
  mcq:
    options:
    - main 前移到實驗分支的提交
    - 刪除實驗分支歷史
    - 新增一筆必然有兩位父提交的紀錄
    - 只暫存更改，不動 main
    answer: 0
    explain: 接收端是對方祖先時可快轉；各走一步則 --ff-only 會拒絕。
- id: fd-git-05-clean-switch
  prompt: 為何先檢查工作區乾淨再切分支？
  answer: 未提交更改可能隨切換保留，也可能因會覆寫而使切換失敗，不屬於某條已提交的歷史。
practice:
- id: fd-git-05-p1
  kind: hands-on
  title: 保留兩案，只採用一個去重鍵
  minutes: 11
  steps:
  - 從同一條 main 建 dedup-order 與 dedup-retry，按正文各提交一條候選規則。
  - 比較兩條分支；只把 dedup-order 快轉合併到 main。
  checks:
  - main 顯示 dedup = by order_id；dedup-retry 仍保有 dedup = by retry_id。
  - 短狀態乾淨，沒有為此次快轉另做合併提交。
---

同一筆訂單重試兩次，可能收到兩份紀錄。去重（deduplication）就是依指定規則決定哪些紀錄只保留一份。同事提議按訂單號與按重試號各試一版，不必把兩種規則都疊在主線上。今天先留兩個可查的方向，再讓主線接收其中一個。

## 指標向前，不是複製資料夾

分支（branch）是指向提交的名稱；在某一分支新提交後，那個名稱往前，其他分支不必跟著移動。`git switch -c 名稱` 從目前提交建立並切換到新分支；`git switch 名稱` 切換到已有分支。未儲存或未提交的改動不是隔離好的實驗，切換前先確認短狀態沒有輸出。

合併（merge）有接收方向：站在哪條分支，就試著讓哪條承接結果。如果接收端就是對方歷史的祖先，只需把接收端的指標往前挪，叫快轉（fast-forward）。`--ff-only` 確保本次只做快轉，不能快轉就停下，不另做整合提交。

## 兩條分支從同一份規則開始

在 `C:\dev\conduit-lab\report-git`，從上一堂已提交且乾淨的 `main` 開始。用 `git branch --show-current` 可核對分支名。先建立 A 案：

```powershell
git status --short
git branch --show-current
git switch -c dedup-order
```

在 `orders-rule.txt` 既有規則下新增一行 `dedup = by order_id`，儲存後選入這個檔，提交 A 案，再回主線從同一起點切出 B 案。

```powershell
git add -- orders-rule.txt
git commit -m 'Try deduplication by order ID'
git switch main
git switch -c dedup-retry
```

B 案看到的原檔應只有淨額規則。在它下方新增 `dedup = by retry_id`，再選入並比較兩案。`git show 分支:檔名` 只讀指定版本，不必切過去，也不改工作檔。

```powershell
git add -- orders-rule.txt
git commit -m 'Try deduplication by retry ID'
git show dedup-order:orders-rule.txt
git show dedup-retry:orders-rule.txt
```

先採 A 案：同一個 `order_id` 即使有兩個不同重試號，這個樣本也只算一筆。保留 B 案作對照，切回主線才合併。

```powershell
git switch main
git merge --ff-only dedup-order
git show HEAD:orders-rule.txt
git status --short
```

目前主線應看到 `dedup = by order_id`；B 案仍能單獨查。若兩條路各自新增提交，就不能快轉；[〈衝突處理〉](#/lesson/fd-git-06)正好安排這種情況。

## 先用兩筆數據決定哪一條進主線

寫下兩列樣本：訂單 0007、重試 R1，以及同一訂單 0007、重試 R2。按訂單號計是 1 筆，按重試號計是 2 筆。這不是 Git 能判斷的對錯，而是你要先說清楚「想數訂單，還是想數嘗試」。同事若日後要追查重試量，仍可以回到 B 案閱讀，不必在主線混入兩種不同業務規則。

合併後，執行 `git log --oneline --decorate -1` 可看主線和 A 案指向同一筆。如果靠兩個名稱猜有兩份內容，就會誤會快轉；它們可以同時指向一筆提交。B 案則留在分岔處的另一側。如果切到 B 案仍看見自己的未提交修改，那不是分支整理失效，而是草稿沒有進入任何提交。回到開始時的準則：先核對目前分支與短狀態，再輸入切換或合併。

不刪掉不用的 B 案，就可以直接用 `git show` 交代為何它曾是候選。保留這個小對照，之後才有證據討論「如果當時採另一條會怎樣」。

## 常見錯誤

- 建 B 案時就看見 A 案內容 → 從 A 分支岔出去 → 建立前先切回正確的 `main` 起點。
- 無法切換 → 改動可能被覆寫 → 先檢查並保存想留的工作，勿強制切換。
- `--ff-only` 拒絕 → 接收端相對於另一端已走過不同的路 → 停下比較歷史，再決定如何整合。
