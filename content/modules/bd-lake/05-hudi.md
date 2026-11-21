---
id: bd-lake-05
module: bd-lake
order: 5
title: Hudi 與增量查詢
subtitle: 只取上次以後的改動
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-04
objectives:
  - 區分 Hudi 快照、增量查詢與變更明細
  - 寫出只在下游提交成功後推進的增量游標
tags:
  - Hudi
  - 時間線
  - 增量查詢
  - 寫時複製
  - 讀時合併
resources:
  - title: Apache Hudi：表與查詢類型
    url: https://hudi.apache.org/docs/table_types/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 對照 COW、MOR、Incremental 與 CDC。
concepts:
  - id: bd-lake-05-incremental
    prompt: Hudi 一般增量查詢和 CDC 查詢有何不同？
    answer: 一般增量查詢取區間內變動記錄的最新值；CDC 才用來讀操作變化及依設定提供的前後值。
    mcq:
      options:
        - 都保證回傳每次更新前後值
        - 兩者只讀基礎檔
        - 一般增量較適合最新值，CDC 才要操作明細
        - CDC 只回傳最後提交的快照
      answer: 2
      explain: 選查詢類型要先看下游需要狀態還是歷程。
  - id: bd-lake-05-cowmor
    prompt: MOR 為何可能降低每次更新的寫入開銷？
    answer: 部分更新先寫日誌，再由壓實合併；較新的讀取可能要付讀時合併成本。
    mcq:
      options:
        - 它沒有元數據
        - 它不用再讀基礎檔
        - 它拒絕更新
        - 部分更新先寫日誌
      answer: 3
      explain: 寫入成本移到讀取與後續壓實，不是消失。
    interview:
      question: 下游每小時同步庫存，Hudi 增量怎麼選？
      points:
        - 先判斷要最新狀態還是操作歷程
        - COW／MOR 的讀寫代價
        - 游標晚於下游成功
      answer: 若只同步最新庫存，我先選一般增量，另外確認刪除要如何傳。若要逐筆稽核，我會選 CDC 並確認日誌設定。游標在目的端提交後才推進；失敗用同鍵重跑。
  - id: bd-lake-05-cursor
    prompt: 取出區間後、下游未提交就崩潰，游標留在哪？
    answer: 留在上次已成功確認的位置，以便重讀區間。
    mcq:
      options:
        - 立刻推到當前牆鐘
        - 留在上次成功的位置
        - 推到本次讀取的終點
        - 清空便可略過
      answer: 1
      explain: 取到數據不等於送達；提前推進會漏。
practice:
  - id: bd-lake-05-p1
    kind: code
    title: 重跑同一段庫存異動
    minutes: 11
    steps:
      - 執行 hudi_interval.py，把 (10,13] 以外的紀錄畫在區間外。
      - 改 end 為 12；用印出的鍵與值核對 hudi-note.md。
    checks:
      - 原案例只選完成的 11、12、13，輸出 [(1, 7), (2, 4)]。
      - end=12 時變成 [(1, 7)]；未成功套用前都保留原游標。
---

## 下游想要的是最新庫存，還是每次庫存異動？

庫存鍵 1 在同一小時先從 10 件改 8，再改 7。補齊庫存看板只要 7；稽核卻得保留兩次修改。Hudi 的時間線（timeline）記錄動作和狀態。快照查詢讀指定時點的表狀態；一般增量查詢（incremental query）從一段位置內找被改動的記錄，輸出所選區間的最新值；要逐次改動、操作類型或前後影像，應選變更數據捕獲（CDC）查詢，並確認對應引擎、表設定與可保留的日誌。不能假定普通增量輸出中少了一個鍵就等於刪除通知。

### 寫時改檔與讀時合併

寫時複製（copy-on-write，COW）更新時重寫受影響的基礎檔。讀路徑單純，零星高頻更新卻可能造成反覆改寫。讀時合併（merge-on-read，MOR）可先寫日誌，快照讀取可讀合併結果；只讀基礎檔的讀取最佳化視圖可能較舊。後續壓實把日誌併回基礎檔。先看是更新慢還是看板慢，再挑要付出寫、讀還是維護成本；不要只對比一次寫入時間。

## 練一個不會跳過未提交工作的游標

在 `C:\dev\conduit-lab\lake` 存 `hudi_interval.py`，PowerShell 執行 `py hudi_interval.py`（WSL 2 用 `python3 hudi_interval.py`）。這是選取區間與歸併的模型，可用 RAM 0.25 GB；不會啟動 Hudi。此處以整數代替完成位置，明訂起點不含、終點含；正式系統查對應版本的參數語義，Hudi 1.0 起增量範圍使用完成時間，升級不能直接假定舊游標等義。

```python
# (completion position, status, key, inventory)
records = [(10, "done", 1, 10), (11, "done", 1, 8),
           (12, "done", 1, 7), (13, "done", 2, 4),
           (13, "pending", 3, 1), (14, "done", 4, 2)]
start, end = 10, 13
latest = {}
for pos, status, key, qty in sorted(records):
    if status == "done" and start < pos <= end:
        latest[key] = qty
print(sorted(latest.items()))
```

先把鍵值套到下游，再保存游標 13。如果兩步不能一起提交，重跑時應以穩定的鍵寫同一版本，不能用「再加 7」代替「庫存改為 7」。而且區間要看來源保留；若停機超過可追溯範圍，就要補全量、核對後接回新切點，不是把游標硬調到最新。

## 接手既有同步前先問三件事

第一，這個下游需要看當前狀態，還是要回覆「什麼時候改了兩次」？把例子裡鍵 1 的 8 和 7 納入驗收，若只收到 7 就不能說操作歷程完整。第二，歷程的刪除如何表示、能保留多久？以一鍵三動作跑插入、更新、刪除，並測最後一次刪除後的一次重送。第三，程序自上次停止後若連不上目的表，是暫停還是跳過？留著上次成功游標，可在紀錄裡講清楚尚待交付的範圍。若提交成功而程式在存游標前退出，重播還是會發生；用同一批鍵驗證目的端不會再扣庫存。這兩個故障點比平順完成更能分辨方案。

若上游允許補交較早請求，游標應跟讀取契約的完成位置，而非自行翻日期；舊動作可能到較晚才完成。

## 常見錯誤
- 只讀基礎檔，看板沒立刻看到更新 → MOR 的日誌還沒合併 → 按時效需求選讀取模式。
- 用最新值重建稽核歷程 → 中間的 8 已被歸併 → 選 CDC 並保留必要紀錄。
- 先存游標再更新庫存 → 失敗會跳過整段 → 目的端提交後才確認位置。
