---
id: bd-ingest-08
module: bd-ingest
order: 8
title: 斷點續傳與對帳
subtitle: 故意中斷後檢查有沒有漏寫
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-07
objectives:
- 說明寫入後與保存進度前中斷的風險
- 重跑同一批次並比對筆數、金額和位置
- 判斷何時可以聲稱端到端結果不重不漏
tags:
- 斷點續傳
- 冪等
- 對帳
- 提交
resources:
- title: Python：sqlite3
  url: https://docs.python.org/3/library/sqlite3.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀交易控制及參數位置標記。
- title: Debezium：MySQL 連接器
  url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀連接器故障與重啟可能重送的情境。
concepts:
- prompt: 寫入後、保存進度前當機，重啟時先看到什麼？
  answer: 看見的是較舊的進度，所以已落地的變更可能再送；目的端要能安全重播。
  mcq:
    question: 若先保存進度，還沒寫入就當機，後果為何？
    answer: 1
    options:
    - 必然會重讀全部
    - 可能永久跳過尚未寫入的事件
    - 只會多出重複
    - 不影響，因為位置已保存
    explain: 後續從較新位置開始，沒有自動重送這段。反過來的風險是重播。
  id: bd-ingest-08-gap
- prompt: 為什麼對帳不能只有同批的筆數？
  answer: 用錯金額、改錯鍵、少一筆又補錯一筆，總數都能一樣；還需金額、鍵差集與精選反例。
  mcq:
    question: 來源與目的兩列、總額都一樣，還要比什麼？
    answer: 2
    options:
    - 無需比對
    - 只比執行分鐘
    - 按鍵比對欠缺、多出與金額
    - 只比最大的金額
    explain: 同樣的總額可以分配給不同訂單；要按鍵查缺、多及欄位差異。
  id: bd-ingest-08-check
- prompt: 為何重送不必等於重複效果？
  answer: 使用共同提交或目的端以事件唯一鍵去重、依業務鍵及版本冪等寫入，可以讓同批重播不重複改變結果。
  interview:
    question: 如何解釋端到端不丟不重，而不只講 Kafka 或 Flink 的產品名？
    answer: 我先說清範圍：來源位置可重讀，處理中狀態可隨檢查點恢復，目的端結果要與進度能共同提交，或靠具備版本保護的冪等寫入。最後做兩個斷點測試，另外核對鍵、金額、刪除。單靠一個元件的交付保證不夠。
    points:
    - 來源到目的端的保證邊界
    - 寫入與進度故障窗口
    - 故障注入及持久結果對帳
  id: bd-ingest-08-semantics
practice:
- kind: hands-on
  title: 真的中斷一次，再安全重跑
  minutes: 10
  steps:
  - 在工作區新資料夾依正文章節建立 resume.py。
  - 先執行 py resume.py crash，再執行 py resume.py，最後再跑一次不帶參數。
  - 保存三次輸出，逐次核對 rows、amount、checkpoint。
  checks:
  - 第一趟中斷前顯示 rows=2 amount=1135 checkpoint=0。
  - 恢復後兩趟皆顯示 rows=2 amount=1135 checkpoint=2。
  id: bd-ingest-08-p1
---

## 寫進去但沒寫完進度

連接器讀了 2 條事件，目的端已提交，接著斷電，進度仍停在 0。重啟再投遞這 2 條是正常的；若接收端把它們當成「再加一次款」，帳就翻倍。反過來先把進度推到 2，還沒寫就斷電，下一次會直接漏過。**斷點續傳（resume from checkpoint）**需要的是一個能恢復的邊界。

一種做法是讓結果與進度進同一交易。若分屬不同系統，採用至少一次交付（at-least-once delivery）加寫端冪等（idempotency），也就是重播同一事件不改變已正確的結果。對「以新值取代」的寫入，加事件版本條件防止倒退；對「餘額加 5」這種累加，要用事件唯一鍵做去重，並與累加效果一同提交。刪除也必須有可保留的版本線索。

## 刻意在兩次提交之間停下

使用 `C:\dev\conduit-lab\resume-lab` 的全新資料夾，存成 `resume.py`。本機預留 1 GB，無容器。第一次執行 `py resume.py crash`、再執行 `py resume.py` 兩次。練習只建立本資料夾的 `resume-demo.sqlite`；若要從乾淨狀態再演練，另開一個資料夾。程式刻意分開兩個提交，以便看見這個缺口。

```python
import sqlite3
import sys
from contextlib import closing

events = [(1, 1001, 225), (2, 1002, 910)]
with closing(sqlite3.connect("resume-demo.sqlite")) as db:
    with db:
        db.execute("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, amount INT, pos INT)")
        db.execute("CREATE TABLE IF NOT EXISTS checkpoint (id INTEGER PRIMARY KEY, pos INT)")
        db.execute("INSERT OR IGNORE INTO checkpoint VALUES (1, 0)")
    start = db.execute("SELECT pos FROM checkpoint WHERE id = 1").fetchone()[0]
    with db:
        for pos, key, amount in events:
            if pos > start:
                db.execute("""INSERT INTO orders VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET amount=excluded.amount, pos=excluded.pos
                    WHERE excluded.pos > orders.pos""", (key, amount, pos))
    crash = "crash" in sys.argv
    if not crash:
        with db:
            db.execute("UPDATE checkpoint SET pos = ? WHERE id = 1", (events[-1][0],))
    rows, amount = db.execute("SELECT COUNT(*), SUM(amount) FROM orders").fetchone()
    pos = db.execute("SELECT pos FROM checkpoint WHERE id = 1").fetchone()[0]
    print(f"rows={rows} amount={amount} checkpoint={pos}", flush=True)
    if crash:
        raise SystemExit(2)
```

目的端的鍵只保留一份結果，版本條件不會讓重播累加。故障後雖然沒有保存進度，兩列與金額已在檔中；再次執行，總額應仍是 1135。這裡比對的是單一來源的正常列；實務還要列出雙方缺失的業務鍵、逐鍵金額差與刪除樣本。之後在[〈跨層對帳〉](#/lesson/bd-quality-04)會把這些比較分層做出來。Flink 的檢查點會協調來源進度和運算狀態；外部寫端仍有自己的提交契約，細節見[〈檢查點與屏障〉](#/lesson/bd-flink-06)。

## 在兩條斷點各做一次反向檢查

即使練習只模擬結果先提交的故障，也要在紀錄畫出另一條線：讀入、預先推進、尚未提交便停止。它的下一趟會少哪兩筆？這個反例解釋為什麼不能把進度推進當成寫入的預約。若改成同交易提交，須保證數據列與進度真的落在同一個交易資源；分別呼叫兩個服務，不會因為放在同一段程式就擁有共同提交。

正式作業常用每日對帳表保存來源位置、目的端已確認位置、上次驗收金額和異常鍵。若位置不連續，先停發布以保留證據；若業務狀態能按鍵重建，才由安全位置重播。從同一個案例往後想一步：若日誌保留期已過，較舊的位置未必讀得回來，此時要重新做可銜接的快照，不能盲目反覆重試。

## 常見錯誤

- **成功重啟卻少數據 →** 存進度早於落地；改用共同提交或兼容重播的提交順序。
- **同批兩次金額翻倍 →** 寫的是累加又沒有事件去重；去重記錄與累加需共同提交。
- **筆數一致卻仍錯帳 →** 忽略鍵或金額；對帳要涵蓋逐鍵差異。

**重點回顧：**把恢復方式設計到寫入契約裡，再用中斷和對帳證明它真的可重播。
