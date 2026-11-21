---
id: fd-git-06
module: fd-git
order: 6
title: 衝突處理
subtitle: 保留兩邊真正需要的條件
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-05
objectives:
- 在受控練習庫辨認合併衝突與目前、引入兩端
- 根據業務意圖改成一條可驗證的完整規則
- 用暫存、合併提交與狀態確認收尾
tags:
- 合併衝突
- 共同祖先
- git merge
- 衝突標記
resources:
- title: Basic Branching and Merging：Basic Merge Conflicts
  url: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Basic Merge Conflicts，對照標記與完成合併的步驟。
concepts:
- id: fd-git-06-marker-sides
  prompt: 一般 git merge 產生的衝突裡，<<<<<<< HEAD 下方是哪一側？
  answer: 目前檢出的接收分支，在本課是 main。
  mcq:
    options:
    - 永遠是 GitHub 的版本
    - 要被併進來的一方
    - 目前接收分支的一方
    - 共同祖先的原文
    answer: 2
    explain: HEAD 表示現在接收的分支；下半邊是這次要併入的一側。
- id: fd-git-06-resolution
  prompt: 移除衝突符號後，還要做什麼才能完成合併？
  answer: 先驗收合併後內容，再 add 標記已解決，最後提交合併。
  mcq:
    options:
    - 直接關掉編輯器
    - 再做一遍原本的 merge
    - 只執行 git log
    - 驗收、add、完成合併提交
    answer: 3
    explain: 沒有標記不等於 Git 知道它已解決，更不保證業務規則完整。
- id: fd-git-06-intent
  prompt: 一邊規定只在批次內去重，另一邊要求留最新一筆，應留哪一側？
  answer: 不必二選一；把兩個不互斥的意圖整合成同一條規則。
  mcq:
    options:
    - 整合同批次範圍與留最新一筆
    - 永遠只選目前分支
    - 永遠只選引入分支
    - 原樣保留衝突符號和兩段規則
    answer: 0
    explain: 要合併的是行為，不只是挑一段文字；兩項可以共存。
- id: fd-git-06-abort-purpose
  prompt: 何時可以用 git merge --abort？
  answer: 在本課以乾淨狀態開始、仍在未完成的合併時，若要放棄本次整合，可以用它回到合併前。
  interview:
    question: 你怎麼證明一次數據規則合併不是只讓紅字消失？
    answer: 我先確認兩邊意圖，再設計同批次的重複樣本和跨批次的反例。看合併後能不能在同批挑最新、跨批各留一筆，最後才檢查沒有未合併項目。
    points:
    - 先確認兩端意圖
    - 正反例都驗收
    - 用 Git 狀態確認已完成
practice:
- id: fd-git-06-p1
  kind: hands-on
  title: 合併同批次與最新事件兩條意圖
  minutes: 12
  steps:
  - 在練習庫依正文製造兩邊改同一行的衝突。
  - 把該行改成同時含批次範圍與保留最新的版本；按樣本手算再暫存提交。
  checks:
  - 同批次較舊紀錄去除，另一批次保留。
  - 最後短狀態無輸出，最新一筆有兩個父提交。
---

一位同事說「只在同一批次內去重」，另一位說「有重複時要留最新」。兩人剛好改到同一行。合併衝突（merge conflict）不是 Git 在判誰錯，而是它無法自動決定這個位置的最終內容。

## 看清楚誰改了什麼

Git 比對兩邊及其共同祖先（merge base）：也就是分岔前能用作比較基準的提交。一般合併衝突中，`<<<<<<< HEAD` 下方是目前分支的版本，`=======` 分隔兩側，`>>>>>>>` 結束要併入的版本。若設定了其他衝突樣式，還可能顯示原本那一版。標記是提示，不是應發佈的規則。解法不是刪除符號就算完：先合成業務意圖，再把檔案選入並提交。

## 在練習庫造出一次衝突

於 `C:\dev\conduit-lab\report-git`，從乾淨的 `main` 開始，檔案第二行應是 `dedup = by order_id`。建立分支後，將第二行改成 `dedup = keep the latest event_time for each order_id`。

```powershell
git status --short
git switch -c dedup-policy
```

上述修改儲存後，提交並回主線。確認切回時又看到原本的第二行。

```powershell
git add -- orders-rule.txt
git commit -m 'Keep the latest event for each order'
git switch main
```

主線把第二行改成 `dedup = by order_id within the batch`，儲存再提交，接著合併。這次兩側各自有新提交，並且故意改同一行，所以預期合併暫停。

```powershell
git add -- orders-rule.txt
git commit -m 'Scope deduplication to each batch'
git merge dedup-policy
git status --short
```

`UU orders-rule.txt` 表示同一檔在兩邊被改到且尚未完成合併。打開檔案，保留第一行淨額規則，以這**一行**替換衝突區段（包括標記與兩份版本）：

```text
dedup = by order_id within the batch; keep the latest event_time
```

手算驗收：批次 B1 的訂單 0007 有 09:00 和 09:05 兩筆，只留 09:05；B2 的訂單 0007 另有 09:10，要保留。這樣不是只消除符號，也保住範圍和留存規則。儲存後完成合併：

```powershell
git add -- orders-rule.txt
git status --short
git commit -m 'Combine batch scope and latest-event policy'
git status --short
git log -1 --format='%h parents: %p'
```

短狀態應空白，最新提交列出兩個父提交。被整合的是兩份已提交的歷史，與上一堂的快轉不同。

## 拿掉任何一條意圖都會讓一筆測試失敗

用剛才 3 筆例子驗證正確規則應留 2 筆。若只留下「每批次內」而沒規定保留最新，第一批留下哪個時間仍不確定；若只留下「同訂單留最新」而沒限制批次，三筆可能最後只剩第二批的 09:10。這兩種結果都可能是沒有任何衝突標記的乾淨文字，卻不符合交接。先手算結果再改檔，有助於在尚未寫自動檢查時找出遺失的規則。

共同祖先是原來的 `dedup = by order_id`，它沒有承諾範圍或保留哪筆。不要抄祖先來讓輸出安靜；解決後應能逐段說「哪個字來自批次那邊，哪個字保留最新那邊」。最後看父提交，是為了確認真的把兩條已知歷史接到一起，而不是在衝突中途另外寫一份文字就離開。

這是演練用的文字規則，不會實際讀取訂單。真正上線前，除了這三筆，還要問事件時間相同時如何選；需求未定就不替報表猜一條規則。把已驗證的行為和還要確認的條件分開記錄。

## 常見錯誤

- 從主線直接採整份引入版 → 批次範圍消失 → 用跨批次反例驗收，不盲選一側。
- 編輯完仍出現 `UU` → 還沒標記已解決 → 存檔後執行 `git add -- orders-rule.txt`。
- 不想繼續合併 → 只在這次合併尚未完成、且你確定是從乾淨工作區開始時，可用 `git merge --abort` 放棄本次整合；想保留的手動解法先抄到庫外。
