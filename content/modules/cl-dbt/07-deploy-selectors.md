---
id: cl-dbt-07
module: cl-dbt
order: 7
title: 模型部署與選擇器
subtitle: 只驗收受這次變更影響的模型
status: ready
minutes: 35
level: 3
prereqs:
- cl-dbt-06
objectives:
- 從依賴圖選出單一模型、上游或下游範圍
- 先用 dbt ls 預覽，再用 dbt build 建置與測試
- 記下候選發布、驗收與回退所需的證據
tags:
- dbt build
- 選擇器
- 依賴部署
- 發布驗收
resources:
- title: dbt：選擇圖運算子
  url: https://docs.getdbt.com/reference/node-selection/graph-operators
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 對照前置與後置加號，注意選取方向。
- title: dbt：build 指令
  url: https://docs.getdbt.com/reference/commands/build
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀資源建置順序和測試失敗的影響。
concepts:
- id: cl-dbt-07-preview
  prompt: 生產部署前想知道指令會選哪些模型，先跑哪個命令？
  answer: 用 dbt ls 並指定相同的 selector、target 和資源類型，確認實際集合。
  mcq:
    options:
    - dbt ls
    - dbt run
    - dbt build
    - dbt snapshot
    answer: 0
    explain: compile 與 build 不是純清單；改 SQL 也不能直接確認影響範圍。
- id: cl-dbt-07-parents
  prompt: 乾淨環境要建日報與依賴，應用何種加號？
  answer: 用 +fct_daily_orders 選上游和自己；外部來源仍要先準備。
  mcq:
    options:
    - fct_daily_orders+
    - +fct_daily_orders
    - fct_daily_orders
    - stg_orders
    answer: 1
    explain: 後置加號找下游，不會讓依賴自動建出；來源不由選取指令建立。
- id: cl-dbt-07-build
  prompt: 為什麼只用 dbt run 不能取代本課驗收？
  answer: run 主要執行模型；build 依選取及依賴處理模型與測試等資源，仍要查業務結果。
  mcq:
    options:
    - run 會呼叫所有來源任務
    - 兩者都會自動算對所有口徑
    - run 會替換模型文件
    - build 能把相關測試納入驗收
    answer: 3
    explain: 建置成功不保證符合付款口徑，也不代表來源已經完整。
  interview:
    question: 改了暫存狀態欄位，怎麼做到只部署受影響的模型？
    answer: 先列暫存與其下游，用清單驗證範圍，但也核對需要的上游是否已就緒。再在候選環境 build；測試通過後對帳關鍵日報，確認可回上一版，才切換消費者。
    points:
    - 預覽下游範圍
    - 確認上游與環境
    - 建置後對帳與回退
- id: cl-dbt-07-rollback
  prompt: 部署前為什麼要保存上版候選的可查結果？
  answer: 驗收失敗時才知道要還原哪個版本、怎麼用同一口徑驗證回退。
practice:
- id: cl-dbt-07-p1
  kind: sql
  category: [dbt, time]
  title: 留下候選發布的三日基準
  minutes: 4
  level: 1
  dataset: shop
  prompt: |
    取 2026-01-17 到 2026-01-19（含兩端）之訂單，只算已付款。依序輸出 `order_date`、`paid_orders`，按日期升序。無付費不補列。
  solution: |
    SELECT order_date, COUNT(*) AS paid_orders FROM orders
    WHERE status = 'paid' AND order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
    GROUP BY order_date ORDER BY order_date;
  explain: |
    發布前把日期範圍與口徑保存。只記總列數無法辨認單日差異。
  hints:
  - 按營業日篩選後分組
  - 確認不含取消
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-07-rollback
  - sq-model-01-scope
  tags:
  - dbt build
  - 選擇器
- id: cl-dbt-07-p2
  kind: sql
  category: [dbt, reconcile]
  title: 比較壞候選與上一版的日報
  minutes: 6
  level: 2
  dataset: shop
  prompt: |
    模擬候選把已付與取消都計入，上一版只認 paid。只列出 2026-01-17 至 2026-01-19（含兩端）內有差異的日子。依序輸出 `order_date`、`old_paid_orders`、`candidate_paid_orders`、`delta`（候選減舊版），依日期升序。
  solution: |
    WITH daily AS (
      SELECT order_date, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS old_paid_orders,
             COUNT(*) AS candidate_paid_orders
      FROM orders
      WHERE order_date BETWEEN DATE '2026-01-17' AND DATE '2026-01-19'
      GROUP BY order_date
    )
    SELECT order_date, old_paid_orders, candidate_paid_orders,
           candidate_paid_orders - old_paid_orders AS delta
    FROM daily WHERE old_paid_orders <> candidate_paid_orders ORDER BY order_date;
  explain: |
    只看候選是否成功建出，會漏掉 1 月 18 日的口徑改動。把差異清單當交付阻擋條件，不只看大盤總額。
  hints:
  - 先聚合兩種口徑，再在外層算差並篩選
  check:
    ordered: true
    columnNames: true
  concepts:
  - cl-dbt-07-rollback
  - cl-dbt-07-build
  - cl-dbt-06-coverage
  tags:
  - dbt build
  - 選擇器
- id: cl-dbt-07-lab
  kind: hands-on
  title: 保留一次選取與交付記錄
  minutes: 9
  steps:
  - 在 dbt-shop 按正文比較選取方向，將命令及輸出保存為 release-notes.txt。
  - 用 build 做候選驗收，附上付款日的預期、測試狀態與若不合格就保留上一版的決定。
  checks:
  - stg_orders+ 的模型清單含日報；僅用日報名稱時不主動建暫存模型。
  - 發現差異時記下日期及口徑，不以執行狀態成功代替驗收。
---

## 部署不是把所有模型再跑一次

暫存層調整 `order_status` 的標準化規則，日報必須一起驗收，但會員快照不依賴它。部署（deployment）先決定哪些產物會改、在哪個環境建，再決定如何驗收與撤回。選擇器（selector）是交給 dbt 選節點的表示式，在改數據前可用 `ls` 預覽。

- `node`：選該節點；某些指令會另外選相關測試。
- `+node`：含上游及本身，例如乾淨環境所需的依賴。
- `node+`：含本身與下游，例如暫存有改動時的影響範圍。
- `+node+`：選該節點以及兩個方向。不等於直接跑所有模型，也不是把來源載入的指令。

## 預覽、建置、看結果

在 `dbt-shop` 根目錄操作，只使用本機 `dev` 目標。已先完成暫存、日報以及[〈測試與文件〉](#/lesson/cl-dbt-06)的測試。這一輪只示範選取和驗收，不宣稱做到了雲端部署。

```powershell
.\.venv\Scripts\dbt.exe ls --select fct_daily_orders --resource-type model --target dev --profiles-dir .
.\.venv\Scripts\dbt.exe ls --select "+fct_daily_orders" --resource-type model --target dev --profiles-dir .
.\.venv\Scripts\dbt.exe ls --select "stg_orders+" --resource-type model --target dev --profiles-dir .
.\.venv\Scripts\dbt.exe build --select "stg_orders+" --target dev --profiles-dir .
.\.venv\Scripts\python.exe -c "import duckdb; print(duckdb.connect('lab.duckdb', read_only=True).execute('SELECT * FROM main.fct_daily_orders ORDER BY order_date').fetchall())"
```

第一個清單只看日報，後兩個清單應可見暫存與日報。最後的 `build` 會把所選模型與相關測試按依賴執行。回到結果核對 1 月 17 日、18 日各 1 單。若你曾更改樣本，先寫出相應預期；不要為了通過擅自改基準。

正式發布會用獨立候選環境或關聯，先準備外部來源與其權限，再檢查選取集、數據測試和關鍵對帳。指定目標不代表一定隔離：兩個目標若指同一檔案與同一 schema，就仍共用數據。記錄版本、輸入截止點、建置時間、數字差異與回退關聯；如果新的定義不能接受，保留舊讀取入口。這次只用本機小檔證明改動範圍、測試與查詢；雲端適配器的資源、權限、表替換行為、費用都要另驗。

如果在新環境連外部來源都還沒載入，先修好這個前置條件：選取來源節點不等於建立它。若是復用既有環境，也要核對上游模型並非臨時測試版。你可以用日報的列數和指定日期數據作交付基準；一旦本來同口徑的取消單變成付款單，就算所有模型在規定時間內跑完，也要視為阻擋。

保存結果時不只寫「通過」兩字。把你用的目標、選取條件、實際出現的模型、使用的來源截止與一筆可複查的輸出放在同一份紀錄。下一次修改另一個層次，就沿這份紀錄對照哪些模型真的多選或漏選。這份本機練習可保留 SQL 和設定版本；正式的已發布成品是否可以迅速恢復，還要在候選環境演練。

這也能讓同事重現你的發布範圍，而非照抄一條不知為何的命令。

## 常見錯誤

- 空環境只有日報被選 → 忘了上游先存在 → 用 `+fct_daily_orders`，並先準備外部來源。
- 清單看不到測試便說不會測 → 預覽限制了 `model` 類型 → 用完整清單核對測試範圍。
- 數據庫回報成功即切換 → 少了對帳和回退標記 → 留上版及一份可重現的驗收。
