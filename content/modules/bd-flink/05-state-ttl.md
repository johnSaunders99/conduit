---
id: bd-flink-05
module: bd-flink
order: 5
title: 鍵控狀態與期限
subtitle: 記住用戶但不能永遠記住
status: ready
minutes: 35
level: 3
prereqs:
- bd-flink-04
objectives:
- 用同一鍵保留計算所需的狀態
- 比較 TTL 更新條件及過期後的重複風險
- 用小腳本驗收重送與過期
tags:
- keyed state
- TTL
- DataStream
- 去重期限
resources:
- title: Flink：狀態與 TTL
  url: https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/state/
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀 keyed state 與 State Time-To-Live 區段。
concepts:
- id: bd-flink-05-key
  prompt: DataStream 用 keyBy(event_id) 時，A 與 B 共用同一個狀態值嗎？
  answer: 不會；狀態依鍵隔離，運算只讀寫目前鍵的值。
  mcq:
    question: 哪個鍵適合判定付款事件本身是否重送？
    options:
    - 每次都變的接收列 id
    - 穩定的事件 id
    - 來源服務固定代號
    - 接收時間
    answer: 1
    explain: 同一業務事件重送需有同一鍵；不同意圖的付款不能共用一鍵。
  interview:
    question: 去重 TTL 怎麼定，才不會把重送算兩遍？
    points:
    - 看來源可重播／重送範圍
    - 區分處理時間 TTL 與事件時間規則
    - 估算鍵數並補上長期去重策略
    answer: 我先量最大可預期重播與重送延遲，再從容量估算期限。若三天後仍可補數，就不能只靠一天的記憶體去重；長期靠持久事件鍵核對。
- id: bd-flink-05-expiry
  prompt: 用處理時間 TTL 的去重狀態過期後，同一事件重送會怎樣？
  answer: 去重標記不可用時會被當新事件；需要較長期限或其他驗證。
  mcq:
    question: 來源可能 48 小時重送，TTL 只有 24 小時，後果？
    options:
    - 原窗口一定可以恢復
    - 同一事件可能被算第二次
    - 引擎延長 TTL 為 48 小時
    - 設定與重送無關
    answer: 1
    explain: TTL 是去重能記住多久，不是數據來源重送會在多久內發生的承諾。
- id: bd-flink-05-scope
  prompt: TTL 剛到期就能承諾實體儲存立即釋放嗎？
  answer: 不能；可見性與背景清理依設定和狀態後端而異。
  mcq:
    question: 記憶體曲線不在 TTL 到期一刻立刻掉下來，先查什麼？
    options:
    - 清除策略和實際使用中的鍵數
    - 把事件時間加一天
    - 改 SQL 欄位名稱
    - 將所有副本歸零
    answer: 0
    explain: 邏輯過期和實體清理不同，不能以牆上時間推斷資源立即回收。
practice:
- id: bd-flink-05-p1
  kind: code
  title: 重現期限內外的重送差異
  minutes: 12
  steps:
  - 存正文程式為 flink_ttl.py，用 PowerShell 執行 py flink_ttl.py。
  - 把 TTL 改為 12 分鐘再跑，比較第 3 筆；在旁註明這是處理時間模型。
  checks:
  - TTL=10 時結果依次為 accept、duplicate、accept。
  - TTL=12 時 A 在第 11 分鐘仍被判重複。
---

以付款事件畫看板時，有時送件服務在超時後把同一事件發兩次。倘若只寫「每來一列就加 1」，重送就使筆數增加。前面先用 Flink SQL 寫查詢；現在看 DataStream 的想法：它讓你對每筆事件指定分流的鍵、讀取先前狀態，再決定要不要更新或輸出。鍵控狀態（keyed state）是跟著鍵走的記憶，不是每個工作者所有事件共用一格。

## 分清「誰共用」與「記多久」

第一步 `keyBy` 以事件鍵分組，使同鍵紀錄進到同一狀態分工。對這個例子每鍵只需一個值，可用值狀態（ValueState）記「曾入帳」。鍵選接收序號就抓不到重送，因為一次重送會收到另一個序號；選用戶 ID 又會把同人的第二筆真付款當重複。正確的鍵要能表達「同一意圖」，例如在原始付款建立時產生且重送沿用的事件 ID。狀態還要被故障後找回，這點留給[〈檢查點與屏障〉](#/lesson/bd-flink-06)。

狀態期限（state time-to-live，TTL）限制作業能記得多久。DataStream 的這項 TTL 使用處理時間，典型策略有「建立及寫入時更新」或「讀與寫皆更新」。它不是由事件時間的浮水印推進。過期是否還可能讀到、物理上何時清掉，取決於可見性及狀態儲存實作。若只需空閒 10 分鐘就忘，不要每次讀重複時又無意續期；若要保存最近被觀察到的鍵，就應明說讀取也延長。

## 用幾行程式驗證邊界

在 Windows 工作區存成 `flink_ttl.py`，以 `py flink_ttl.py` 執行。它模擬「只在接受時刷新、過期即不可讀」，不用安裝 Flink；時間以處理分鐘計。它只用記憶體，不模擬 Flink 的清理、計時器或恢復。

```python
ttl_min = 10
expires = {}
for minute, event_id in [(0, "pay-A"), (4, "pay-A"), (11, "pay-A")]:
    if minute < expires.get(event_id, -1):
        outcome = "duplicate"
    else:
        expires[event_id] = minute + ttl_min
        outcome = "accept"
    print(minute, event_id, outcome)
```

狀態粗估先從「每分鐘新增唯一鍵 × 保留分鐘」起算，再加每鍵所需位元組及後端開銷。若每分鐘多 1000 個鍵，10 分鐘約 1 萬有效鍵；改成一天約 144 萬，不能直接假設資源不變。若業務承諾跨週可補數，短期記憶體不能獨自守住去重承諾；另在目的端保有可持久的事件身分，並用[〈交付語義與交易〉](#/lesson/bd-kafka-07)的重播方法查效果。練習最後把兩次執行結果和一個可接受的重送期限寫在同一份筆記，才知道究竟驗收了什麼。

把同樣的腳本再加一個不同事件鍵，觀察它的首次事件不該被前一個鍵的計時擋住。若把期限改成每次讀取都延長，重送的高頻鍵可能一直有效；要與過期後何時允許判定成新作業分開寫。這項差異比把期限數值加長更容易被忽略。

期限算在狀態上，不是收到事件就把事件本身刪除；原始日誌的保留是另一項決策。

## 常見錯誤

- 用接收列作鍵 → 每次重送具新鍵 → 回到來源事件身分。
- 用事件時間推演這個 TTL → 不是同一時鐘 → 用明確的處理時間測期限。
- 一直調長期限卻不估成本 → 有效鍵變多 → 先量新增鍵率及狀態大小。
