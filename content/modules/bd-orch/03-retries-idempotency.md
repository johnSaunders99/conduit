---
id: bd-orch-03
module: bd-orch
order: 3
title: 重試與冪等
subtitle: 第二次寫入不能讓金額翻倍
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-02
objectives:
- 分辨短暫失敗和重試無效的錯誤
- 讓同日結果反覆執行也不累加
- 驗證失敗中間產物不會頂替已發布版
tags:
- 重試
- 冪等
- 覆寫
- 退避
resources:
- title: Airflow：最佳實務
  url: https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀任務交易邊界及重跑寫入規則。
concepts:
- prompt: 連線暫斷和欄位消失，哪一種優先重試？
  answer: 暫斷可有限次退避重試；持續的結構錯誤應停止並修正契約。
  mcq:
    question: 來源回報 amount 欄位不存在，首選做法是？
    answer: 3
    options:
    - 每秒重試一次
    - 改把全批寫成 0
    - 讓排程器標成功
    - 停住並釐清欄位契約
    explain: 缺欄不會靠等待恢復；增加次數或補 0 都可能延誤或掩蓋錯帳。
  id: bd-orch-03-retry
- prompt: 兩次執行產生同一個結果叫什麼？
  answer: 冪等指同一請求或批次再次套用，不多產生一次效果。
  mcq:
    question: 同日報表用 append 重試，哪種作法更安全？
    answer: 1
    options:
    - 附上不同的當前時間再追加
    - 驗收後以同日固定鍵替換
    - 直接把半份覆蓋舊檔
    - 每次另建相同內容的正式檔
    explain: 安全方案以固定產物鍵覆寫已驗收結果；加時間或增加暫存不是冪等。
  id: bd-orch-03-idempotent
- prompt: 暫存寫完才對外切換，主要避免什麼？
  answer: 避免讀者看見逐步寫入的半成品，也讓失敗時可保留舊版。
  interview:
    question: 請求逾時後不知目的端是否提交，你會怎麼設計重試？
    answer: 同一個業務日或事件必須有固定的冪等鍵。寫入先暫存並驗收，再以同鍵提交；若對外呼叫支援冪等鍵就沿用。我要測提交後收到逾時的反例，確認同批重播結果與副作用都只生效一次。
    points:
    - 明確定義冪等鍵
    - 覆蓋未知提交結果
    - 驗收副作用與中斷反例
  id: bd-orch-03-atomic
practice:
- kind: hands-on
  title: 兩次成功加一次失敗，還是同一份報表
  minutes: 8
  steps:
  - 在工作區用正文程式產生日報；先執行 py idempotent_day.py。
  - 執行 py idempotent_day.py fail，開啟原報表確認仍可讀，再不帶參數重跑。
  - 在筆記寫出哪種錯誤應重試及哪個檔案不對外發布。
  checks:
  - 兩趟成功都只有一份 report-2026-01-18.json，金額一致。
  - 故障保留 .tmp 供觀察，既有 .json 未受影響；下一趟成功後 .tmp 不再存在。
  id: bd-orch-03-p1
---

## 第一次可能做完了，只是沒回成功

凌晨任務寫入日報之後，在回傳成功之前斷線。排程器看見失敗就會**重試（retry）**，但你不能由失敗狀態推斷沒有寫。若原本用追加（append），兩次都成功提交就會有兩個相同日子的報表。改用固定營業日當鍵，重跑要改寫同一份已驗收輸出，不再額外新增一次金額。這就是**冪等（idempotency）**：同一次業務請求做多次，效果仍是一份。

並非什麼錯都應重試。網路短斷可用有限次退避（backoff），讓間隔逐步拉長；欄位被移除或輸入不符合規格應先停，等待沒有用。加上少量隨機抖動（jitter）可減少很多任務一起重打同一服務。真正要避免的是重試把同一副作用做兩遍；例如寄報表通知或呼叫計費介面，也要有各自的冪等鍵或明確不要重送。

## 同一個營業日只讓一份完整結果生效

本例在 `C:\dev\conduit-lab\retry-lab` 存成 `idempotent_day.py`，預留 1 GB，不開容器。先成功，再模擬暫存後失敗，再做一次成功。下列替換發生在同一目錄，是單一寫者的檔案示範，並不等於跨儲存服務的交易，也不保證斷電後的持久性。

```python
import json
import sys
from pathlib import Path

target = Path("report-2026-01-18.json")
stage = target.with_suffix(".tmp")
payload = {"business_date": "2026-01-18", "amount": 320}
stage.write_text(json.dumps(payload) + "\n", encoding="utf-8")
if "fail" in sys.argv:
    raise SystemExit("failed before publish")
assert json.loads(stage.read_text(encoding="utf-8")) == payload
stage.replace(target)
print(target.read_text(encoding="utf-8").strip())
```

故障時下游仍讀 `report-2026-01-18.json`，而不是搜尋所有最新檔案。重試用同樣的輸入版本與營業日；若業務要求對同一天用新口徑重算，這是另一個發布版本，不是同一請求的重試。實務上還要限制同日寫者數，或加一個能檢查版本是否已變的提交條件；不然兩趟各自完整，後到的舊工作也可能覆蓋較新結果。多日補跑見[〈回填與補數〉](#/lesson/bd-orch-04)。

## 為每一種副作用訂鍵

如果日報有一份檔和一則通知，只有檔案採覆寫還不夠。通知可以把「管道、營業日、交付版本」組成鍵，第一次成功的投遞和重試要用同一鍵；換版本更新才是另一則訊息。若外部服務沒有冪等機制，你需要先說明哪種副作用可能重複，不可以由一次排程綠色就宣稱端到端只有一次。把副作用的恢復契約一併列到驗收單，像核對訂單數一樣核對寄出的筆數。

練習時刻意對比兩種失敗：內容還沒驗收就停，以及內容已成功替換、返回之前才停。第一種讀者會沿用舊版；第二種要證明下一次替換仍是同一結果，不能因收到錯誤就先刪除最新檔案。這兩種情況一起驗證，才覆蓋重試前「不確定是否做完」的核心問題。

## 常見錯誤

- **每重試一次就多一份同日結果 →** 每次用新檔名追加；固定業務鍵及發布規則。
- **數據永遠不合格卻不停重試 →** 未分錯誤類型；把結構錯誤交給修復，把暫斷交給有限退避。
- **舊結果突然變成半份 →** 邊計算邊公開；先產生並驗收暫存，再切換。

**重點回顧：**重試是調度行為；冪等是數據與副作用的契約，需各自設計。
