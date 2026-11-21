---
id: fd-git-04
module: fd-git
order: 4
title: 忽略檔案
subtitle: 不要上傳原始訂單
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-03
objectives:
- 用根目錄規則忽略 raw 資料夾與暫存檔
- 用 git check-ignore 證明哪一行規則生效
- 分辨未追蹤的忽略項目與已在歷史中的檔案
tags:
- gitignore
- git check-ignore
- 未追蹤檔
- 原始數據
resources:
- title: gitignore
  url: https://git-scm.com/docs/gitignore
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀模式規則，區分已追蹤檔案與忽略項目。
concepts:
- id: fd-git-04-root-directory-rule
  prompt: 根目錄的 .gitignore 內放 /raw/ 是為了忽略什麼？
  answer: 儲存庫根目錄下的 raw 資料夾及其內容。
  mcq:
    options:
    - 整台電腦所有名為 raw 的檔案
    - 儲存庫根目錄的 raw 資料夾
    - 所有 .csv，不限位置
    - 整個儲存庫
    answer: 1
    explain: 開頭斜線把位置限制在這一層，結尾斜線指定資料夾。
- id: fd-git-04-already-tracked
  prompt: 已提交的檔案符合新 .gitignore 規則，會從歷史消失嗎？
  answer: 不會；忽略規則主要針對未追蹤項目，不會從歷史抹除已提交內容。
  mcq:
    options:
    - 會，立即重寫所有歷史
    - 會，下次 push 時會刪除所有舊副本
    - 會，但只要副檔名是 .csv
    - 不會，舊提交仍含原內容
    answer: 3
    explain: 新增忽略規則不是追蹤移除或敏感內容補救。
- id: fd-git-04-prove-rule
  prompt: 要確認是哪一條規則擋住 raw/orders-local.csv，用什麼？
  answer: 用 git check-ignore -v -- raw/orders-local.csv，會顯示規則來源與行。
  mcq:
    options:
    - git check-ignore -v -- raw/orders-local.csv
    - git log --oneline
    - git diff --cached
    - git remote -v
    answer: 0
    explain: 其他命令查歷史、暫存或遠端，沒有直接回答忽略自何規則。
- id: fd-git-04-scope
  prompt: 為何不使用 *.csv 忽略所有訂單檔？
  answer: 會連原本想提交的公開合成測資一起藏掉；應依用途限制目錄。
  interview:
    question: 有人剛把真實訂單提交到共用庫，現在加 .gitignore 就夠嗎？
    answer: 不夠。我先確認是否已分享，暫停再次推送，按團隊的數據事件流程通報並處理已散出的版本。再把原檔移出正常追蹤路徑，用忽略規則和合成測資降低重犯。
    points:
    - 已提交的內容仍在歷史
    - 先止住分享並通報
    - 以範圍小的規則預防再發
practice:
- id: fd-git-04-p1
  kind: hands-on
  title: 驗收一條會擋、也會放行的規則
  minutes: 10
  steps:
  - 依正文做 raw\orders-local.csv、review.tmp、orders-example.csv 與 .gitignore。
  - 核對規則後只提交 .gitignore 與 orders-example.csv。
  checks:
  - check-ignore 顯示 /raw/ 及 *.tmp；合成範例沒有被忽略。
  - 提交後一般短狀態無輸出，用 --ignored 則可看到 !! raw/ 與 !! review.tmp。
---

日報庫應該留下計算規則與同事能共用的小樣，不該順手收進每天收到的原始訂單。就算今天沒有遠端，按用途分路也比事後找「哪份不能傳」更穩。今天做兩個應忽略的例子，另外留一個不能被誤擋的例子。

## 用路徑決定，不用猜內容

`.gitignore` 是 Git 忽略規則（ignore rule）的純文字檔，不是終端機指令。名稱開頭是點，沒有 `.txt` 後綴。規則可按資料夾或寫成樣式（pattern）：`/raw/` 排除本庫根目錄的 `raw` 資料夾，尾端斜線表示只匹配資料夾；`*.tmp` 則匹配此處及下層任意名稱的 `.tmp`。一條廣泛的 `*.csv` 會把你想留的合成 CSV 也攔下來。

忽略不等於刪除：檔案仍在磁碟。也不等於保密；已追蹤（tracked）的檔案不會因一條忽略規則離開索引，已提交的版本更不會消失。原始訂單不拿來練；以下檔案即使名字像原件，內容也都是虛構。

## 讓兩個該擋的例子和一個該放行的例子同時存在

在 `C:\dev\conduit-lab\report-git` 接續上一堂的乾淨練習庫。用檔案總管建 `raw`；用編輯器各建 `raw\orders-local.csv` 和根目錄的 `orders-example.csv`，兩份都可填以下兩行。根目錄再建 `review.tmp`，內容只寫 `preview`。

```csv
order_id,total
0007,120
```

在同個根目錄儲存 `.gitignore`，檢查完整名稱。

```gitignore
/raw/
*.tmp
```

在 PowerShell（位置仍是 `report-git`）檢查規則來源：前兩個檔案會列出匹配的行，合成範例不列出。`--ignored` 讓狀態另外顯示被忽略的項目（`!!`）。

```powershell
git check-ignore -v -- raw/orders-local.csv review.tmp orders-example.csv
git status --short --ignored
```

確定只要交付示例和規則，才選入這兩份。最後的 `status` 一般應空白；被忽略的檔案仍可在檔案總管看見。

```powershell
git add -- .gitignore orders-example.csv
git diff --cached
git commit -m 'Track a synthetic sample and ignore local outputs'
git status --short
```

## 把保留的例子與拒絕的例子放在一起

可以把三個路徑寫成一張檢查清單：領到的本機日報副本放在 `raw`；工具產生的暫存文字以 `.tmp` 結尾；可分享的合成訂單留在庫根。目錄規則問的是位置，副檔名規則問的是名稱；兩者都不讀欄位內容。所以如果有人手動把真實數據另存到一個沒有規則擋住的檔名，Git 不會神奇地知道裡面是什麼。選入前仍要看檔名與暫存差異。

只測原始檔被擋，可能得到假的信心：假設你寫的規則擋住所有檔案，這個單一檢查也會通過。加一份應該保留的例子，可以同時證明範圍沒畫得過大。這種「該擋和該放行」的驗法也用於日後的數據規則。若協作者看到 `raw` 裡有檔卻在庫裡找不到，告訴對方去看合成範例；不要為了讓範例可重做，不加分辨地解除忽略。

本課的 `review.tmp` 內容可以重建，原始數據卻未必可以。因此忽略是一個版本管理決定，不是刪除或備份策略。真正的原始訂單應留在有權限控管的位置，不靠工作副本的忽略名單來保護。

## 常見錯誤

- `raw` 仍顯示未追蹤 → 先查規則檔是不是 `.gitignore.txt` 或存錯層 → 顯示完整檔名，核對根目錄。
- 合成小樣沒出現在狀態 → 規則可能太寬 → 用 `git check-ignore -v` 找是哪一行，縮小到用途明確的目錄。
- 真實數據已在提交中 → 加忽略規則不會回收版本 → 停止分享並循團隊通報與移除流程處理。
