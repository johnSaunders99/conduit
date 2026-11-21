---
id: bd-kafka-03
module: bd-kafka
order: 3
title: 複本與確認
subtitle: 寫入成功到底誰已經收到
status: ready
minutes: 35
level: 3
prereqs:
- bd-kafka-02
objectives:
- 按 ISR 描述領導與追隨複本的寫入路徑
- 以 acks 與 min.insync.replicas 判斷能否確認
- 分開判斷可用性、耐久性與業務去重
tags:
- replica
- leader
- ISR
- acks
resources:
- title: Kafka：複本與交付保證
  url: https://kafka.apache.org/44/design/design/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀複本同步與三種寫入確認的保證。
- title: Kafka：主題設定
  url: https://kafka.apache.org/44/configuration/topic-configs/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 min.insync.replicas 的失敗條件。
- title: Kafka：可接管領導的複本
  url: https://kafka.apache.org/44/operations/eligible-leader-replicas/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 區分可接管領導與目前參與確認。
concepts:
- id: bd-kafka-03-minimum
  prompt: RF=3、ISR=1、min ISR=2 時，acks=all 新寫入能確認嗎？
  answer: 不能；同步複本未達最低門檻。
  mcq:
    question: RF=3、ISR=2、min ISR=2，acks=all 要等誰？
    options:
    - 只等 leader
    - 等 ISR 兩份複本
    - 永遠等 3 份指派複本
    - 等最慢的消費者
    answer: 1
    explain: all 是同步複本集合，不是設定的所有複本，也不是消費端確認。
  interview:
    question: 想做到 Kafka 不丟數據，你會怎樣設和驗證？
    points:
    - acks=all 與最低 ISR 配合
    - 同步複本不足拒絕寫入
    - 複本故障域與端到端限制
    answer: 我會讓至少兩份同時確認並把複本分散到不同故障域。ISR 不足寧願拒絕並告警，驗證故障時真的沒回成功。這只是 Kafka 寫入端，我還會問來源重送與目的端去重。
- id: bd-kafka-03-acks-one
  prompt: acks=1 的成功回覆留下什麼風險窗口？
  answer: 領導複本已寫但追隨複本未同步時，領導故障可能使這筆已確認的事件消失。
  mcq:
    question: 成功後立刻故障且新 leader 沒那筆，最吻合哪種路徑？
    options:
    - 只等領導複本即確認
    - 所有消費者都已提交
    - 所有副本都收到後才確認
    - 生產者停用所有重試
    answer: 0
    explain: 根因是成功與同步的邊界不同；是否重試不是這次已確認紀錄遺失的條件。
- id: bd-kafka-03-ack-scope
  prompt: acks=all 能證明目的數據庫入帳一次嗎？
  answer: 不能。它描述代理節點的確認，不約束應用程式的目的端寫入。
  mcq:
    question: 要查同退款是否重複入帳，應補哪項證據？
    options:
    - 提高分區數
    - 查看目的端以事件鍵核對的結果
    - 只數複本
    - 將 acks 改為 0
    answer: 1
    explain: 目的端的實際副作用要在目的端查核；副作用是寫入或扣款一類可見變化。
practice:
- id: bd-kafka-03-p1
  kind: explain
  title: 製作複本故障決策表
  minutes: 10
  steps:
  - 在 kafka-acks.md 畫 3 個複本，標記各輪 ISR 大小 3、2、1。
  - 填入 acks=all、min ISR=2 的結果和等待對象；再寫一條 acks=1 的損失時間線。
  checks:
  - ISR 3、2 可確認；ISR 1 不可確認。
  - 時間線明確標出領導確認、故障與追隨複本尚未追上。
---

收到「寫入成功」的回覆，不表示每一份複本都收到，更不表示帳務已經過帳。沿用訂單事件，現在把 P0 想成放在 3 個節點：L 對外接寫，F1、F2 是追隨複本（follower），向領導複本拉取日誌。同步複本集合（in-sync replicas，ISR）會隨節點能否持續追上而變動，也包含領導複本。複本因子（replication factor，RF）是分配了幾份，不是當下同步了幾份。

![同一分區的領導與兩個追隨複本，確認只看當時符合條件的同步複本。](assets/bd-kafka-replicas.svg)

## 三種確認讀法

- `acks=0`：生產者不等伺服器確認，不能把「送出」當作入日誌。
- `acks=1`：領導寫入本地日誌即可回覆；若它倒下時追隨者尚未追到該筆，完成過確認的紀錄有遺失風險。
- `acks=all`：等當前 ISR 的複本完成確認；ISR 若低於 `min.insync.replicas`，寫入不能成功確認。此處的「全部」不是全部指派的複本。

所以 RF=3、最低 ISR=2 時，健康的 3 份都同步就等 3 份；F2 落後到離開 ISR 時，仍可等另外 2 份成功；只剩 L 時就拒絕。反過來，如果最低 ISR 設成 1，`acks=all` 在 ISR 只剩一份時仍可能成功，不能用 `all` 字面推導「一定有多份」。實務上「拒絕」不應消失在錯誤日誌：來源要有重送或保留機制，並對同步複本不足告警。

失敗回覆也不是「肯定沒寫」：例如先附加但確認尚未到達，生產者就等到逾時。重送會遇到「可能已有一筆」；[〈交付語義與交易〉](#/lesson/bd-kafka-07)會再分清楚冪等生產者與端到端保證。單一 PC 的單代理節點能跑指令，不能用來測試跨節點接管。放在同一台實體主機的三個程序也不是三個故障域，因為停電可以讓三份同時不可用。

Kafka 4.1 起新叢集預設啟用可接管領導的複本（eligible leader replicas，ELR）。它補充的是故障後誰可以安全接管，不是把所有可接管者算成當前的同步確認。查事故時應分開讀 ISR、ELR 與寫入回覆。

## 把結果寫成能交班的判斷表

取一張紙或在 Windows 工作區寫 `kafka-acks.md`，先固定 RF=3、最低 ISR=2，針對 ISR=3、2、1 三欄各標「可否確認、等誰、來源下一步」。試著把最低值升到 3：會把原本 ISR=2 的成功變成拒絕，提高確認門檻，但少一份就無法接受寫入。再畫反例：`acks=1` 的 L 回成功，F1、F2 尚未收到，L 故障。把「沒有同步」和「已確認」同時畫出來，才解釋得了為何原訂單服務見到成功，稍後查日誌卻沒有。

面試說「不丟」時先講範圍：多個故障域、乾淨選主、來源對失敗的處置，以及目的端可以用何種事件身分對帳。今天切的是複本確認這一段，沒有證據就別把結果推到整條管道。

面對「寫入不可用」的告警，也不要先降低最低 ISR。先查是追隨複本落後、磁碟寫不動，還是整個故障域掉線；縮小門檻是拿已確認紀錄的耐久性換可用性，不能當作例行修復。

## 常見錯誤

- RF=3 就認為必等 3 份 → RF 不是當前 ISR → 查同步名單與最低門檻。
- 沒有成功回覆就重送後又入帳 → 逾時不代表沒寫 → 檢查冪等生產與目的端事件鍵。
- 單節點示範一切正常就承諾耐故障 → 沒有第二份可接管 → 用可控的多故障域測試另作驗證。
