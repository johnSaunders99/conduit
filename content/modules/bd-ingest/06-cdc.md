---
id: bd-ingest-06
module: bd-ingest
order: 6
title: CDC 與日誌位置
subtitle: 刪除也要傳下去
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-05
objectives:
- 辨認新增、更新與刪除的變更事件
- 區分營業時間、來源日誌位置與下游偏移量
- 按順序重播事件並核對物化結果
tags:
- CDC
- binlog
- 日誌位置
- 刪除
resources:
- title: Debezium：MySQL 連接器
  url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 看 binlog、刪除事件及初始快照。
concepts:
- prompt: CDC 為何能抓到已經看不見的刪除？
  answer: 讀的是來源提交的變更日誌，而不是事後再查目前有哪些列；日誌保留刪除事件。
  mcq:
    question: 刪除 1002 後再查 orders，哪一項能告訴你它何時被刪？
    answer: 1
    options:
    - order_id 最大值
    - 包含刪除的來源日誌
    - 現況表的總筆數
    - 目的端檔案的最後更新時間
    explain: 現況表不保留已硬刪的紀錄；變更日誌才有操作與位置。
  id: bd-ingest-06-changes
- prompt: 為何不能用事件時間當重啟位置？
  answer: 不同事件可有相同時鐘值，提交與抵達也可能不同步；恢復要依來源協定記錄位置。
  mcq:
    question: 同一 binlog 事件可能包含多列，位置還要看什麼？
    answer: 3
    options:
    - 最後一張單的啟用日
    - 接收端今天的時間
    - 單獨取最大的 order_id
    - 依協定看事件內列序等座標
    explain: 檔名和位置錨定日誌事件，部分介面還有事件內列序；牆上時間和業務鍵都不是通用續跑位置。
  id: bd-ingest-06-position
- prompt: 下游如何防止舊更新把已刪訂單寫回來？
  answer: 以來源可比較版本保留每鍵最後處理位置，包括刪除位置；舊事件重播不能蓋掉較新的狀態。
  interview:
    question: CDC 已有順序，為什麼落地仍常看到重複或舊值？
    answer: 來源順序不代表下游全局順序。事件可能重送，不同 Kafka 分區也沒有全局順序。我會依業務鍵路由，保留可比較的來源位置；刪除也保留版本，最後演練寫入後中斷、重播與回頭對帳。
    points:
    - 說出至少一次與分區的範圍
    - 按鍵處理舊值與刪除
    - 中斷重播驗證
  id: bd-ingest-06-replay
practice:
- kind: hands-on
  title: 從事件串重建目前訂單
  minutes: 8
  steps:
  - 在工作區存成 replay_changes.py 並執行正文程式。
  - 觀察每個位置的輸出，再把刪除事件放到清單最前面，先不改位置重跑。
  - 說明哪段排序固定了結果，並存下輸出。
  checks:
  - '位置 3 後 1002 消失，最終只剩 1001: 90。'
  - 調整清單擺放次序但保留位置後，依位置排序可重建相同結果。
  id: bd-ingest-06-p1
---

## 舊單被刪，光看今天的表看不出來

用修改時間找增量，能看到仍存在的更新列，卻查不到已被硬刪的列。**變更數據捕獲（change data capture，CDC）**把新增、更新和刪除當事件傳送。MySQL 的二進位日誌（binary log，簡稱 binlog）記錄數據庫變更；採用逐列記錄時，連接器可從日誌解析表與列的變更。它不是把每一刻的整張表都留下來。

![快照建立底本；日誌事件按位置重播，包括刪除；驗收後提交進度](assets/bd-ingest-cdc.svg)

## 每筆事件都要回答三件事

- **是哪個鍵、做了什麼？** 新增和更新帶來新值，刪除表示要移除目的端的有效列；鍵和操作不可少。前值（before）是否完整依來源設定與連接器能力而定。
- **來源讀到哪？** 日誌位置（log position）依數據庫而異；例如 MySQL 的日誌檔名、位置，某些事件還需要列序。連接器可能另外記錄全域交易識別碼（global transaction identifier，GTID）等資訊。這些欄位不能用牆上時間替代。
- **投遞讀到哪？** 若後面用 Kafka，偏移量（offset，Kafka 課程也稱位移）是某一分區內的位置，不等於來源 binlog 位置；分區是供獨立排序和消費的記錄區段。之後在[〈位移與提交〉](#/lesson/bd-kafka-05)會細講如何提交。

啟用時先完成能與日誌位置銜接的快照，再套用後續事件。來源若提早清掉尚未讀取的日誌，單把工作重啟不會補回那段；要辨識缺口，依來源重建底本並重新核對。這也是為什麼進度紀錄要附來源與分區，而不是只存一個看似一直變大的數字。

## 看見一張單消失

在 `C:\dev\conduit-lab\cdc-lab` 存成 `replay_changes.py`，執行 `py replay_changes.py`。預留 1 GB，不啟動數據庫或 Kafka。整數位置是單一來源的教學替身，排序不代表跨分區能得到全局次序。

```python
changes = [
    (1, "insert", 1002, 910),
    (2, "insert", 1001, 225),
    (3, "delete", 1002, None),
    (4, "update", 1001, 90),
]
orders = {}
for pos, op, key, value in sorted(changes):
    if op == "delete":
        orders.pop(key, None)
    else:
        orders[key] = value
    print(pos, dict(sorted(orders.items())))
```

第 3 步刪除後不能留下值為 0 的訂單；「存在、金額為 0」不是「不存在」。這段只重建一次。若實際流會重播，刪完還要保留該鍵的最後版本，否則舊的新增事件可能把它復活。後面在[〈斷點續傳與對帳〉](#/lesson/bd-ingest-08)會演練寫入中斷。

## 用位置確認「未處理」與「已處理」

畫一條只有 4 格的日誌，故意停在刪除前：你有兩筆訂單，重啟應由哪格開始？如果已把第 3 格寫進目的端卻仍記第 2 格，重播第 3 格應得到同一結果，而不是再扣一次金額。把來源座標的「最後處理」及消費介面的「下一筆」分開標註，哪個位置要包含由介面定義。順序保證也有範圍：只有單一可比較的來源序列才可整段排序；多來源必須先定義哪一個來源或業務版本有權更新同一個鍵。

## 常見錯誤

- **刪單仍在報表中 →** 只寫新增與更新；明定刪除要如何落地。
- **重啟跳了幾筆 →** 將事件時間或下游偏移量當來源位置；按協定保存各自位置。
- **訂單刪後復活 →** 舊事件覆蓋新事件；保留刪除版本及處理次序。

**重點回顧：**CDC 傳的是操作和位置；完整性來自知道從哪裡開始、按什麼順序套用、何時安全重播。
