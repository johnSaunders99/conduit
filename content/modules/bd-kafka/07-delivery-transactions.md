---
id: bd-kafka-07
module: bd-kafka
order: 7
title: 交付語義與交易
subtitle: 端到端不重複需要誰配合
status: ready
minutes: 35
level: 3
prereqs:
- bd-kafka-06
objectives:
- 判斷至多一次、至少一次與恰好一次的業務效果
- 說出冪等生產與交易分別處理的重試
- 為 Kafka 到外部數據庫畫出一致性邊界
tags:
- exactly-once
- idempotence
- read_committed
- transaction
resources:
- title: Kafka：訊息交付語義
  url: https://kafka.apache.org/44/design/design/
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 比較寫 Kafka 與外部目的地的保證。
- title: Kafka：生產者設定
  url: https://kafka.apache.org/44/configuration/producer-configs/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 enable.idempotence 和 transactional.id。
- title: Kafka：消費者設定
  url: https://kafka.apache.org/44/configuration/consumer-configs/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 isolation.level，辨認未提交的輸出。
concepts:
- id: bd-kafka-07-idempotent
  prompt: Kafka 的冪等生產者能辨認應用程式兩次主動提交同一業務事件嗎？
  answer: 不能；它處理生產者協議層對同筆寫入的重試，不以業務鍵去重。
  mcq:
    question: 哪種重複是冪等生產者直接針對的？
    options:
    - 同一筆協議寫入因回覆超時而重試
    - 兩筆應用程式重新建立的獨立紀錄
    - 兩次寫外部數據庫
    - 全量重播時重跑兩次扣款
    answer: 0
    explain: 業務重複需要事件身分與目的端認得；Kafka 協議層重試不是同一件事。
  interview:
    question: 有人說 Kafka 設了 exactly-once 就是不丟不重，你會補問什麼？
    points:
    - 來源進度與輸出原子提交
    - read_committed 的可見性
    - 外部目的端是否有交易或冪等
    answer: 我先問保證覆蓋到哪裡。讀 Kafka、算完寫回 Kafka，可在同一交易提交輸出及輸入位移，讓下游只讀已提交；若要扣外部餘額，我會在數據庫交易內以事件鍵防重，再做故障重播對帳。
- id: bd-kafka-07-scope
  prompt: Kafka 到 Kafka 的交易要一起提交什麼？
  answer: 將輸出紀錄與對應輸入位移一起提交；下游讀已提交的輸出。
  mcq:
    question: 只把輸出放進交易，輸入位移另提交，留下什麼？
    options:
    - 留下兩者不同步的故障窗口
    - 必定無法寫入訊息
    - Kafka 會自動將外部庫加進交易
    - 結果必然丟失
    answer: 0
    explain: 原子邊界要包含兩者；可以各自成功不代表必定同時成功。
- id: bd-kafka-07-visibility
  prompt: read_committed 的下游會交付已中止交易的紀錄嗎？
  answer: 不會；它只交付可見的已提交交易紀錄及非交易紀錄。
  mcq:
    question: 測試看見被中止輸出，優先查哪裡？
    options:
    - 分區雜湊
    - retention.ms
    - 下游 isolation.level
    - 消費者組數
    answer: 2
    explain: 隔離級別決定是否濾掉中止輸出，不是分區或保留設定。
- id: bd-kafka-07-semantics
  prompt: 重跑兩次但餘額只扣一次，還算恰好一次嗎？
  answer: 若談的是可見業務效果，可以。它不承諾程式實體只執行一次。
  mcq:
    question: 下列哪項能核實扣款效果恰好一次？
    options:
    - 程式只有一行扣款程式碼
    - 處理日誌僅看見一次
    - 故障重播後每個事件鍵只造成一次餘額變動
    - 分區沒有位移空洞
    answer: 2
    explain: 看實際可見的效果，不能用執行次數或位移外觀代替。
practice:
- id: bd-kafka-07-p1
  kind: explain
  title: 畫出不丟不重的故障矩陣
  minutes: 13
  steps:
  - 在 kafka-delivery.md 分別畫 Kafka→Kafka、Kafka→外部數據庫。
  - 對每條路徑列出中止、重試以及目的端會看到哪些結果。
  - 在外部帳務路徑補一個以事件鍵與交易保護扣款的反例測試。
  checks:
  - 中止交易的輸出對 read_committed 不可見且位移未一起前進。
  - 明確指出外部數據庫不在 Kafka 交易內；兩筆相同事件不可造成兩次扣款。
---

「服務可能會重跑，但同一筆退款最後只能入帳一次」比「永不重跑」更接近需求。交付語義（delivery semantics）描述故障後觀測到的結果。至多一次（at-most-once）容許漏做、不重做；至少一次（at-least-once）讓未完成可以重做，但接受重複；恰好一次（exactly-once）要界定哪一端看到的效果不多不少。若故障前事件已超出保留期，不能只靠交付設定把它變回來。

## 先找誰在重試，再決定機制

生產者送出一筆 Kafka 紀錄，broker 已寫，但回覆在網路途中遺失。冪等生產（idempotent producer）讓 broker 能辨認該生產者協議層對同筆寫入的重試。不過，如果接單程式本身重開，再把同一退款包成另一條新紀錄，Kafka 不知道那兩筆是同一業務事件。用唯一事件鍵記錄業務效果，是另一層機制，和[〈位移與提交〉](#/lesson/bd-kafka-05)的結果端去重相同。

當輸入和輸出都在 Kafka，可用 Kafka 交易（transaction）：開始交易，送出轉換後的紀錄，用交易內提交把本批輸入位移附上，最後一次確認。若中途失敗並中止，輸出不算提交，輸入位移也不因這筆交易前進。下游要用 `isolation.level=read_committed` 讀取，才不會消費已中止的結果；若交易長時間未決定，也可能延後能交付的後續紀錄。這裡的交易假設消費者所有權與提交時機都正確，不是將一段任意外部程式包起來就安全。

## 在外部目的端驗證真正的效果

若寫入的是數據庫，Kafka 交易不能把外部扣款包進來。可先在同一筆數據庫交易中以事件鍵插入「已處理」，只在新鍵插入成功時扣款；兩步一起確認，才提交 Kafka 位移。若中間故障，重播可能再跑判斷，但不會讓已完成事件多扣一次。去重紀錄本身也得保留足夠久，不能在可重播的晚到事件之前過期。

在 `kafka-delivery.md` 做 4 格驗收：傳出前失敗、送出後回覆遺失、Kafka 交易中止、外庫寫入後沒提交位移。每格寫「從哪讀」「看得見幾筆」「需哪方配合」。證明外庫結果一致的方式不是看到日誌無錯，而是刻意在寫後斷開，接著重播並比事件鍵與餘額。這個邊界會在[〈背壓與端到端一致性〉](#/lesson/bd-flink-10)再出現：流引擎內部狀態有一致性，不代表每種目的地都跟著一致。

驗收時刻意製造一類不會由 Kafka 自動消除的重複：應用程式建立兩筆相同的退款，兩筆都成功上日誌。只查 Kafka 看到兩筆並不是錯，要到帳務側數同一退款造成多少次金額變動；這能區分來源重複、重讀和重複入帳。

## 常見錯誤

- 打開冪等生產就不查來源重送 → 它不做業務去重 → 持久化事件鍵。
- 交易中止但測試讀到輸出 → 檢查下游的隔離級別 → 以 `read_committed` 觀察。
- 位移和輸出分開提交卻承諾一起成功 → 中間可以中斷 → 劃清原子邊界。
