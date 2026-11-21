---
id: fd-git-03
module: fd-git
order: 3
title: 差異與歷史
subtitle: 找出少算退款的那一行
status: ready
minutes: 30
level: 1
prereqs:
- fd-git-02
objectives:
- 選對檢查工作檔、暫存區與兩筆提交的 git diff 端點
- 用 git log 和路徑限制找出新增退款扣除的版本
- 拿具體差異與小算例說明日報為何不同
tags:
- git diff
- git log
- HEAD
- 提交歷史
resources:
- title: git-diff
  url: https://git-scm.com/docs/git-diff
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 在描述裡分辨工作檔、暫存區與兩個提交的比較。
- title: git-log
  url: https://git-scm.com/docs/git-log
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看 --oneline 與以路徑限制結果的基本用法。
concepts:
- id: fd-git-03-diff-endpoints
  prompt: git diff 空白，能斷定沒有任何修改嗎？
  answer: 不能；它只比較工作檔和暫存區，兩者相同仍可能有尚未提交的變更。
  mcq:
    options:
    - 能，代表連未追蹤檔都沒有
    - 不能，可能改動已暫存
    - 能，只要歷史至少有一筆
    - 不能，因為它永遠不印任何差異
    answer: 1
    explain: 用 git diff --cached 看已暫存內容；用 status 看整體分類。
- id: fd-git-03-cached
  prompt: 提交前想看這次選入的內容，應執行哪條？
  answer: git diff --cached，比暫存區與目前提交。
  mcq:
    options:
    - git log --oneline
    - git diff
    - git rev-parse --show-toplevel
    - git diff --cached
    answer: 3
    explain: log 看歷史摘要；不帶 --cached 的 diff 看未暫存修改。
- id: fd-git-03-diff-direction
  prompt: 在線性兩筆歷史中，git diff 'HEAD~1' HEAD 的 + 行屬於哪個端點？
  answer: 屬於右側 HEAD 的新增內容；減號顯示相對於左側移除的內容。
  mcq:
    options:
    - 右側 HEAD
    - 左側 HEAD~1
    - 目前未儲存的編輯頁
    - 只有遠端看得到的版本
    answer: 0
    explain: 前面是從哪一版出發、後面是到哪一版，反過來比較會反轉加減方向。
  interview:
    question: 日報少扣退款，要怎麼指出是哪一次修好的？
    answer: 我先用路徑篩出涉及規則檔的提交，再比較修正前後的同一檔案；指出新增的扣退款那行，並用一筆有退款的數字算給對方看。
    points:
    - 按規則檔縮小歷史
    - 確認差異方向與提交編號
    - 用小算例驗證業務影響
practice:
- id: fd-git-03-p1
  kind: hands-on
  title: 找出讓淨額少 20 的那行
  minutes: 10
  steps:
  - 先重現未暫存與已暫存差異，再按正文提交修正。
  - 比較 HEAD~1 與 HEAD，記錄提交識別碼、加減行與算例。
  checks:
  - 初版 sales=100 得 100；修正版 refunds=20 得 80。
  - 新提交排在舊提交上方，逐行比較只變動一條規則。
---

同一筆銷售 100、退款 20，昨日日報算成 100，修正版應算 80。要查明原因，光問「有沒有改過」不夠；要指出哪兩份內容不同，以及差異何時進到歷史。

## 先選要比較哪兩份

逐行差異（diff）用 `-` 表示左邊有而右邊沒有，`+` 表示右邊新增。另有檔名與區段的標頭；讀時先找實際內容，不把 `+++` 檔名當新規則。`HEAD` 在這裡是目前提交；`HEAD~1` 沿第一父提交往前一筆。在這堂的直線歷史，就是上一版。

- `git diff -- orders-rule.txt`：暫存區 → 工作檔，查尚未選入的變更。
- `git diff --cached -- orders-rule.txt`：目前提交 → 暫存區，查準備提交的變更。
- `git diff 'HEAD~1' HEAD -- orders-rule.txt`：上一筆提交 → 最新提交，不會讀工作檔。
- `git log --oneline -2 -- orders-rule.txt`：列出最近影響這檔案的兩筆歷史摘要。開頭識別碼用來指定提交，不靠字母或數字大小推時間。

## 找到減退款的證據

在 `C:\dev\conduit-lab\report-git` 接續上一堂：暫存和歷史是 `net = sales`，工作檔則是 `net = sales - refunds`。先查未暫存差異，再選入。暫存之後重跑第一種差異，應變空；同樣的加減行現在進入 `--cached` 的比較。

```powershell
git diff -- orders-rule.txt
git add -- orders-rule.txt
git diff -- orders-rule.txt
git diff --cached -- orders-rule.txt
```

確認暫存差異只補上退款扣除，再提交並比較歷史。加號那行應含 `sales - refunds`；短歷史的第一筆是剛新增的說明。

```powershell
git commit -m 'Subtract refunds from net sales'
git log --oneline -2 -- orders-rule.txt
git diff 'HEAD~1' HEAD -- orders-rule.txt
git status --short
```

把兩個提交識別碼、規則差異與手算寫在練習筆記。預期短狀態沒有輸出：工作檔與暫存相符，暫存也和最新提交相符。這次的空白由整體狀態支持，不只是用某一種差異猜。若一條查詢在終端機停住顯示 `(END)`，按 **q** 離開分頁檢視再輸入下一條。

## 從一筆報表異常縮小查找範圍

假如練習庫多出另一本欄位說明，日報錯誤不代表那份說明也改過。把檔名放在 `--` 後，可以先縮小到計算規則；沒有檔名時，則用來找未知落在哪個檔的相關變更。兩種查法都合理，取決於你是要定位哪個檔，還是已知道檔名、要查是哪一版。用路徑限制時沒有列出某筆提交，不表示那筆不存在，只表示這個查詢沒有把它列入。

逐行差異也只證明文字變了。要證明業務結果跟著變，拿一筆有退款的訂單手算，在筆記寫清「舊規則 100；新規則 80；差異 20」。再補一筆退款為 0 的反例，兩條規則都算 100，不足以辨認那次修正有沒有生效。交接時請同時留下目標提交、改動行和能區別兩版的樣本，別只說 Git 有一條新紀錄。這個習慣下次在[〈還原與回退〉](#/lesson/fd-git-08)定位目標時也會用到。

短狀態與差異各有用途：一個告訴你更改所在區域，另一個告訴你具體文字。只有查兩者，才知道這行是未選、已選，或已成為可查的歷史。

## 常見錯誤

- `git diff` 沒字就以為改動不見 → 差異可能已暫存 → 查 `git diff --cached`。
- 看到退款那行是減號 → 把兩個歷史端點對調了 → 按「舊版 → 新版」比較。
- `HEAD~1` 找不到 → 只有第一筆提交或站錯庫 → 先用 `git log --oneline` 和根目錄檢查歷史。
