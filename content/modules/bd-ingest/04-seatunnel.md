---
id: bd-ingest-04
module: bd-ingest
order: 4
title: SeaTunnel 連接器
subtitle: 對齊來源與目的欄位
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-03
objectives:
- 用來源、轉換、目的端說明 SeaTunnel 作業
- 定義欄位名、型別與拒收條件
- 執行一個檢查欄位契約的例子
tags:
- SeaTunnel
- 連接器
- 欄位映射
- 數據契約
resources:
- title: SeaTunnel：作業如何執行
  url: https://seatunnel.apache.org/docs/introduction/how-it-works/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看來源、轉換與目的端的作業結構。
- title: SeaTunnel：FakeSource
  url: https://seatunnel.apache.org/docs/connectors/source/FakeSource/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 查來源欄位結構與測試記錄設定。
- title: SeaTunnel：Console sink
  url: https://seatunnel.apache.org/docs/connectors/sink/Console/
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 看如何先以控制台核對輸出。
concepts:
- prompt: 同一個 SeaTunnel 作業如何串起讀寫？
  answer: 用來源連接器讀出列，按需要轉換，再交給目的端連接器；欄位、順序與型別要對齊。
  mcq:
    question: 要先確認映射、又不想寫進正式庫，用什麼目的端最合適？
    answer: 0
    options:
    - 控制台測試目的端
    - 正式表直接覆蓋
    - 忽略型別錯誤後輸出
    - 把並行度調到最大
    explain: 先用控制台看少量輸出。直接寫正式庫、關掉錯誤或盲加併發都不會驗證映射。
  id: bd-ingest-04-connector
- prompt: 同名欄位為何仍可能不相容？
  answer: 欄位名相同不表示型別、單位或可否為 NULL 相同。
  mcq:
    question: 來源 amount 是以分計的字串，目的端要整數元，先做什麼？
    answer: 2
    options:
    - 只換欄位順序
    - 只把字串轉整數
    - 訂好換算及拒收規則
    - 改用更大的緩衝區
    explain: 必須定義解析、單位與小數處理；改順序或直接轉整數仍會留錯單位。
  id: bd-ingest-04-contract
- prompt: 為何先核對連接器和執行引擎版本？
  answer: 可用插件、讀寫能力與模式可能不同；語法上能寫出設定，不代表套件能載入或支援該模式。
  interview:
    question: 既有 CSV 同步要改成 JDBC 到另一張表，怎麼驗？
    answer: 我會先驗證目標連接器與引擎相容，拿幾筆含正常、NULL、超界和格式錯誤的列走一次，確認欄位型別、錯誤策略和輸出筆數，再測提交與重跑。小樣驗過才接正式路徑。
    points:
    - 版本與模式相容
    - 用好壞反例驗契約
    - 具體驗證與隔離
  id: bd-ingest-04-support
practice:
- kind: hands-on
  title: 把金額欄位契約變成驗收證據
  minutes: 8
  steps:
  - 執行正文章節中的 connector_contract.py，記下轉換失敗的原始欄位值與原因。
  - 把第三列改成空字串，再改成 0045 各跑一次；在工作區存下三種輸出。
  - 在紀錄末尾寫出來源欄位、轉換規則、目的欄位三者。
  checks:
  - 初次得到 2 筆有效記錄與 1 筆拒收。
  - 空字串不會變成 0；字串 0045 轉成 45，通過 3 筆。
  id: bd-ingest-04-p1
---

## 設定接得上，不表示欄位接得對

上游 CSV（逗號分隔檔）的 `amount_cents` 是文字，像 `"22500"`；接收表把同名欄位當整數。若壞值 `"N/A"` 被悄悄寫成 0，作業可能全綠，帳卻對不上。SeaTunnel 是一個用設定組裝數據整合任務的工具。先試幾筆，再把同一份欄位契約帶到真正的作業。

## 看懂作業的四個區塊

- `env` 管作業模式和執行條件。批次（batch）有有限輸入，讀完會結束；串流（streaming）持續等新數據。
- `source` 選來源連接器（connector）；連接器封裝怎麼與該系統讀寫，例如 CSV 檔案或數據庫。來源仍要指定欄位、結構與範圍。
- `transform` 放必要的欄位選取及轉換，說清型別、單位、缺值、超界要怎麼處理。
- `sink` 選目的端與可用寫入方式。先用 Console 看幾列再接真正的 Writer。沿用上一堂的分段觀測：已解析的列和目的端已提交的列不是一回事。

數據契約（data contract）是上下游同意的交付規格。比方說「`amount_cents` 是非負整數分，任何非純數字拒收」，比「可以轉成數字」更清楚。若來源欄位名不變、內容卻由分改為元，只靠欄位比對抓不到這類變更；最好有一筆能核對的已知金額和單位。之後在[〈欄位契約與版本〉](#/lesson/cl-contract-02)會再談如何維護這樣的約定。

## 只跑契約，不開引擎

在 `C:\dev\conduit-lab\seatunnel-lab` 存成 `connector_contract.py`，執行 `py connector_contract.py`，本機可預留 1 GB，不開容器。這是先於上引擎的驗收程式；正負號、空白和小數都不符合本例的純數字規格。真實作業再依連接器文件核對欄位、引擎與模式，不能把這段程式當 SeaTunnel 設定。

```python
source = [(1001, "22500"), (1002, "0"), (1003, "N/A")]
for order_id, raw in source:
    if not (raw.isascii() and raw.isdecimal()):
        print("reject", order_id, repr(raw), "invalid_amount_cents")
        continue
    print("ready", order_id, int(raw))
```

輸出中第 1002 張金額確實是 0，第 1003 張則沒有合法金額。若在轉換時將缺值以 0 代替，這兩種語義就合併了。規劃正式作業時，也要明定整數最大值，讓過大的數字在轉換就被隔離，而不是到目的端才發現超界。

## 拿三筆反例當欄位對照

分別記下正常金額、真實的 0 與無法解析的值。為每筆寫出從來源欄位到目的欄位的預期，並記下該去控制台、隔離區或正式表。這不是替插件寫一套新規格，而是避免它因版本或寫入模式不同，默默做出與業務不符的轉換。例如目的端只接受有符號的 32 位元整數時，轉型即使在 Python 成功也可能在目的端超界；在讀入處明確檢查範圍並讓錯值可查。

如果把來源換成另一家供應商，先重看這三筆，再問目的端會不會把舊數據重寫。逐列通過只表示值合法，不能證明這一整批的來源欄位齊全，仍須驗收筆數與最後切點。這樣投入真實作業時，失敗可以縮到讀取、契約或寫入的其中一段。

## 常見錯誤

- **連接器載入不了 →** 用了別的發行版的設定或缺套件；對照同版文件確認執行引擎和插件。
- **合計差 100 倍 →** 保留欄位名稱但忽略元與分；用一筆已知價格確立換算。
- **每次重跑多一批 →** 目的端選了追加；根據業務鍵制定重跑方式，再做整批驗證。

**重點回顧：**連接器只完成對話；欄位、單位和拒收規則仍需要你說清楚。
