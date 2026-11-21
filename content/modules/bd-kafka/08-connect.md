---
id: bd-kafka-08
module: bd-kafka
order: 8
title: Kafka Connect
subtitle: 把連接器和業務處理分開
status: ready
minutes: 35
level: 3
prereqs:
- bd-kafka-07
objectives:
- 畫出 Kafka Connect 來源與目的連接器的方向
- 分開 Connector、Task、Worker 的責任
- 以進度、鍵與錯誤處置寫出接入驗收
tags:
- source-connector
- sink-connector
- Connect task
- worker
resources:
- title: Kafka Connect：架構與工作者
  url: https://kafka.apache.org/44/kafka-connect/overview/
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀核心概念、部署模式與連接器方向。
concepts:
- id: bd-kafka-08-direction
  prompt: 從數據庫讀訂單變更到 Kafka 是哪種連接器？
  answer: 來源連接器；用 Kafka 的視角命名。
  mcq:
    question: 把 Kafka 付款紀錄輸出到物件儲存，使用哪種？
    options:
    - 來源連接器
    - 目的連接器
    - 分區器
    - 生產者交易協調器
    answer: 1
    explain: 方向以 Kafka 為中心：進來是 source，出去是 sink。
  interview:
    question: 如何驗收一條 Kafka Connect 接入而不只看 RUNNING？
    points:
    - 檢查重啟接續的進度
    - 以事件身分對帳及處置壞列
    - 確認來源與目的端的真實寫入保證
    answer: 我會用小批樣本做一次續傳和一次無法解析的紀錄。核對起終進度、Kafka 事件鍵和目的端列數，確定壞列可定位；最後用重送驗證目的地不重複入帳。
- id: bd-kafka-08-tasks
  prompt: tasks.max=4 是否保證有四個任務在處理？
  answer: 不保證；它是上限，實際還看連接器支援和來源可切分程度。
  mcq:
    question: 來源只可切成 1 份，調 tasks.max 為 4 最合理預期為何？
    options:
    - 保證提速 4 倍
    - 主題自動加區
    - 不保證建立 4 個有工作的任務
    - 來源自動變成 4 份
    answer: 2
    explain: 平行度還需要實際可分工的來源與任務實作。
- id: bd-kafka-08-converter
  prompt: Connect 轉換器不懂某筆訊息的格式，該怎麼查？
  answer: 查鍵和值的編解碼及結構設定，定位錯誤列；不應悄悄丟掉。
  mcq:
    question: 目的表少列，任務仍運行，第一個有用的檢查是什麼？
    options:
    - 是否有被隔離的錯誤紀錄
    - 來源端使用的是單機還是分散式模式
    - 多開一個完全相同來源
    - 先把消費組位移重設到最早
    answer: 0
    explain: 運行狀態無法證明每筆都成功；以樣本和明確錯誤路徑核對。
practice:
- id: bd-kafka-08-p1
  kind: explain
  title: 寫一張連接器接入單
  minutes: 12
  steps:
  - 在 kafka-connect-plan.md 畫訂單來源、Kafka、物件儲存三站。
  - 列出來源位置、Kafka 鍵、序列化格式、目的位置，並定義重新啟動、重送與壞列驗收。
  - 標記每段誰負責，哪一步應另開 Flink 處理。
  checks:
  - 正確標 source 與 sink；每個進度都有指定觀察點。
  - 錯誤列能回溯且有件數，不把任務 RUNNING 當作處理完成。
---

訂單服務已把變更存在數據庫，分析團隊還要一份可回放的 Kafka 日誌，再落到物件儲存。Kafka Connect 解的是「系統之間反覆搬紀錄」的工作。來源連接器（source connector）把外部數據送進 Kafka；目的連接器（sink connector）從 Kafka 取出並寫到外部。方向從 Kafka 看，不是從看板看。連接器不負責替你決定哪些退款要扣除，這種業務規則交給能獨立測試的處理作業。

## 搬運有人分工，位置有人記

- 連接器（connector）讀設定、決定如何拆工作。例如根據數據庫清單拆任務。
- 任務（task）執行讀寫；`tasks.max` 是上限，不保證來源可以切出等量工作。
- 工作者（worker）執行連接器與任務。分散式模式能在多個工作者之間接手；單機模式適合開發，不拿它當故障接管證據。
- 轉換器（converter）處理 Kafka 鍵和值的格式邊界。格式或結構不匹配時，看到工人還在運行，不代表壞列已寫入。

來源進度可能是數據庫日誌的位置，不是 Kafka 位移；同一批紀錄進 Kafka 後才有主題、分區與位移。目的連接器從 Kafka 讀時又有自己的進度。把來源位置和目的位移混成一欄，重啟後就無法證明缺的是來源沒讀、沒送進 Kafka，還是寫端失敗。分散式模式用 Kafka 的內部主題管理所需的設定、狀態與來源進度，不應把測試用主題和正式環境共用。

## 只做紙上接入，不裝外掛

在 `kafka-connect-plan.md` 寫下原始變更位置 `120–123`，假設最後一筆格式不合。你希望連接器停止並告警，還是隔離錯誤後繼續？兩種都可以，但要寫明「剩幾筆」「哪裡找得到壞列」「修復後怎樣補」。死信佇列（dead-letter queue，DLQ）是保存部分可隔離錯誤紀錄的地方；連接器或錯誤類型不支援時，就不能假設所有錯誤都會入列。將這套對照寫成驗收單，後面[〈Flink CDC〉](#/lesson/bd-flink-09)再看數據庫快照如何接日誌增量。

最後各做一次同筆重送與任務重啟的紙上推演。若目的端按原始事件鍵寫，同一筆補送可辨認；若只是附加新行，則要另設對帳或去重。連接器寫著「支援恰好一次」仍需核對運行模式、版本、來源或目的端的條件；不將某一插件的能力推到另一個插件。

驗收快照與持續接入之前，對 120 到 123 先寫一份預期清單，別只記共四筆。若 123 隔離，目的端此輪只應看到三筆，加一筆可查的錯誤。重試後只允許把缺的 123 補齊，不能重新附加前面三筆。這份表也替上游訂好了重送的識別方式，之後換插件仍可以照相同合約檢查。

## 常見錯誤

- 把 Kafka→歸檔當來源 → 方向看反了 → 以 Kafka 為中點畫兩個箭頭。
- 加 `tasks.max` 後預期線性變快 → 來源可能不可切 → 查實際任務與工作量。
- 狀態亮綠就不看落地列數 → 狀態不等於交付 → 查樣本、位移與錯誤件數。
