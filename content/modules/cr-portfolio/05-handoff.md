---
id: cr-portfolio-05
module: cr-portfolio
order: 5
title: 交接與展示
subtitle: 先展示失敗再展示恢復
status: ready
minutes: 25
level: 2
prereqs:
- cr-portfolio-04
objectives:
- 在乾淨目錄示範一次拒絕與一次恢復
- 驗證失敗沒有覆寫本練習中既有輸出
- 交付另一位讀者可照做的操作卡
tags:
- 交接
- 演示
- 失敗恢復
- 乾淨目錄
resources:
- title: GitHub：README 的用途
  url: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對照開始方式與問題回報的入口。
- title: Python：虛擬環境
  url: https://docs.python.org/3/library/venv.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀環境隔離與可重建性，分清目錄測試。
concepts:
- id: cr-portfolio-05-demo
  prompt: 為何展示失敗後還要展示恢復？
  answer: 只看錯誤不能證明下一步可操作；修正輸入後重跑要能回到預期結果。
  mcq:
    question: 故障示範應該改哪個檔？
    options:
    - 原始唯一一份數據
    - 新的虛構輸入副本
    - 正式環境的輸出
    - 上一堂的已保存驗證記錄
    answer: 1
    explain: 故障注入只動可重建的副本；其他是原件或不屬於練習。
- id: cr-portfolio-05-stale
  prompt: 故障後還看見昨日輸出就成功了嗎？
  answer: 不是；先確認這次退出狀態及舊輸出是否被改動，舊輸出不能代表本次成功。
  mcq:
    question: 衝突輸入執行失敗，但輸出檔仍存在，下一步？
    options:
    - 當這次已成功
    - 刪掉原始檔
    - 核對失敗狀態與上次輸出，修正副本再跑
    - 忽略錯誤把舊檔當新
    answer: 2
    explain: 有檔不等於本批發布；演示應明確區分輸出來源。
- id: cr-portfolio-05-handoff
  prompt: 交接記錄要留下哪些可觀察檢查？
  answer: 命令、必要檔案、失敗訊息、退出狀態、重跑條件和預期數字。
  interview:
    question: 如果演示時 Python 啟動失敗，如何繼續？
    answer: 我會指出壞在哪個步驟，轉到有日期和輸入版本的既存輸出解釋，不冒稱這次跑通。演示後補記啟動條件與修復結果。
    points:
    - 保留原始現象
    - 備援有來源
    - 把重現差異補回文件
practice:
- id: cr-portfolio-05-p1
  kind: hands-on
  minutes: 11
  title: 交付一次拒絕與恢復的操作卡
  steps:
  - 在 C:\dev\conduit-lab\orders-portfolio\handoff 新建練習目錄並依正文示範。
  - 將命令、狀態、輸出前後寫進 handoff.md，再用另一個空目錄核對必要檔案。
  checks:
  - 衝突輸入退出非零且既有輸出未改。
  - 修正副本後退出為 0，結果仍為 3 張已付、250 元。
---

## 演示不是只有成功路徑

接手的人不會帶著你的歷史檔、暫存或設定來。交接（handoff）要留下入口、必要檔案、工具與復原方式。這次演示原先已跑通的虛構訂單，刻意讓 O2 在副本有兩個不同金額，確認報錯後上次輸出還在；接著換回可驗的輸入並確認重跑。這是故障注入（fault injection）：有意產生一個受控錯誤，不修改原始樣本，更不在正式環境動手。

準備專用空資料夾 `C:\dev\conduit-lab\orders-portfolio\handoff`，只放〈[可重現的 README](#/lesson/cr-portfolio-02)〉的 `daily_orders.py` 和 `orders.csv`。將執行時所在位置也寫進卡片；以下命令只在這個全新專用目錄使用，會建立 `daily.csv` 和 `orders-conflict.csv`。若你剛跑過，換另一個全新目錄，不必清掉存檔。

```powershell
py daily_orders.py --input orders.csv --date 2026-11-18 --output daily.csv
if ($LASTEXITCODE -ne 0) { throw 'Baseline failed' }
$before = Get-Content -Raw -LiteralPath .\daily.csv
$rows = Get-Content -LiteralPath .\orders.csv
$rows[3] = 'O2,paid,81'
$rows | Set-Content -LiteralPath .\orders-conflict.csv -Encoding utf8
py daily_orders.py --input orders-conflict.csv --date 2026-11-18 --output daily.csv
if ($LASTEXITCODE -eq 0) { throw 'Conflict was not rejected' }
if ((Get-Content -Raw -LiteralPath .\daily.csv) -cne $before) { throw 'Output changed' }
py daily_orders.py --input orders.csv --date 2026-11-18 --output daily.csv
if ($LASTEXITCODE -ne 0) { throw 'Recovery failed' }
Get-Content -LiteralPath .\daily.csv
```

Windows 的 `$LASTEXITCODE` 是外部程式退出狀態，這裡 0 表示成功；預期那次衝突會列印錯誤。PowerShell 的 `Get-Content` 讀檔；有 `-Raw` 時把整份內容讀成一個字串，便於前後比對。`Set-Content` 則將改過的列寫到衝突副本。行號從 CSV 第一行標頭起算，陣列索引則從 0 起，索引 3 對應第 4 行。修正後應回到 `2026-11-18,5,4,3,250`。舊檔留著，是因為這個錯誤在開啟輸出前被擋住，而不是程式能抵抗所有寫入或電源故障。清楚說出這個界線，是演示的一部分。

## 把第一個卡點寫得能重現

演示完請讀者只看操作卡，在另一個空資料夾重建。如果忘了複製 CSV，它說找不到檔時，就把必要檔案補到第一步，不請對方猜工作目錄。若現場無法跑，只用先前同版輸入的已存日報輔助解釋，口頭標明不是當場產物。最後把觀察、恢復命令、未測環境放在同一頁，下一位就知道從哪一步接手。

### 不只記成功，還要記成功來自哪次執行

操作卡分三行記錄：基準輸入成功、衝突輸入失敗、換回有效輸入恢復。第一行記輸出欄與金額；第二行記是哪個 ID、衝突出現在哪一列、程式退出是否非零，以及舊輸出有沒有改；第三行再核對欄位和數值。範例以內容對照確認衝突分支不覆寫，不用從檔案時間猜測。這並未測到磁碟寫入失敗，也不能代表正式的重試、恢復策略已經完成。

交接給另一位讀者時，請對方按步驟念出現在正使用哪份 CSV、期待什麼輸出，而不是代替對方執行。如果讀者選到有衝突的一份又說程序故障，就把輸入檔名與成功條件加到同一行。卡片完成後再分享正確的兩個示例檔；不分享練習者工作目錄、終端歷史或真實訂單。本機可重現、同機換目錄和跨機驗證是三件事，分開寫能省掉接手者猜測。若只有本機結果，就寫出本機的作業系統與直譯器版本。

## 常見錯誤

- 改掉原始範例 → 失去可比較的基準 → 只改新副本。
- 把舊日報當最新結果 → 只檢查有檔 → 同時查退出狀態與內容。
- 說已驗全新機器 → 只換了資料夾 → 記下實際環境與未驗條件。
