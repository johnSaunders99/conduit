---
id: bd-kafka-01
module: bd-kafka
order: 1
title: 主題與分區
subtitle: 同一訂單的變更去哪裡
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
- 畫出主題、分區與複本的層級
- 用分區與位移找回一筆訊息
- 在單節點建立有 3 個分區的主題並核對描述
tags:
- topic
- partition
- broker
- offset
resources:
- title: Kafka 快速入門
  url: https://kafka.apache.org/quickstart/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀啟動與建立主題段落。
- title: Kafka：日誌設計
  url: https://kafka.apache.org/44/design/design/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看分區日誌如何讓寫入與讀取各自前進。
- title: Kafka：映像 JVM 注意事項
  url: https://kafka.apache.org/blog/2026/11/19/mitigating-cve-2026-114938-java4shell-in-apache-kafka-deployments/
  kind: article
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 Docker 映像小節，理解實驗的 JVM 設定。
concepts:
- id: bd-kafka-01-scope
  prompt: 位移 8 能單獨識別 Kafka 中的訊息嗎？
  answer: 不能；至少要連同主題、分區和位移一起看。
  mcq:
    question: 同主題的 P0 與 P1 都有位移 8，代表什麼？
    options:
    - 可能是兩筆不同訊息
    - 一定是一筆的兩份複本
    - 兩筆有相同的業務鍵
    - P1 的訊息排在 P0 後面
    answer: 0
    explain: 位移只在其分區內定位；複本保存的是同一分區，不會另起一個分區編號。
  interview:
    question: 為何 Kafka 用多分區，代價是什麼？
    points:
    - 並行讀寫與分散負載
    - 順序只在分區內
    - 挑業務鍵保護局部順序
    answer: 分區讓不同工作者同時處理，但 P0 的位移不能和 P1 比先後。若訂單內要有順序，我會把訂單鍵送往同一分區；再量熱門訂單有沒有把負載推歪。
- id: bd-kafka-01-append
  prompt: 新的紀錄進到分區哪裡？
  answer: 附加到尾端，由 Kafka 配位移，不覆寫前面的紀錄。
  mcq:
    question: P0 收到下一筆紀錄，寫在哪裡？
    options:
    - 寫到最舊紀錄的位置
    - 附加到 P0 尾端
    - 用業務鍵覆寫舊列
    - 一定和 P1 同步寫入
    answer: 1
    explain: 這是可追加的日誌，不是用鍵原地改列的數據表。
- id: bd-kafka-01-replicas
  prompt: 3 個分區、複本因子 1 代表共有多少份分區日誌？
  answer: 3 份，每個分區只有一份；不是每區有 3 份。
  mcq:
    question: 哪一個設定直接決定同一分區存幾份？
    options:
    - 主題數
    - 分區數
    - 複本因子
    - 消費者組數
    answer: 2
    explain: 分區拆工作，複本存副本，兩者解不同問題。
practice:
- id: bd-kafka-01-p1
  kind: hands-on
  title: 留下主題拓撲證據
  minutes: 12
  steps:
  - 照正文建立本機主題並執行 describe。
  - 把可見的 3 個分區和 leader 記入 kafka-topic.md。
  - 結束整個 Kafka 模組後關閉本實驗。
  checks:
  - 主題顯示分區數 3、複本因子 1。
  - 逐區記下分區編號 0、1、2；單節點都在同一 broker。
---

營運服務發出訂單狀態，風控和看板都想讀，但兩者的速度不同。Kafka 把紀錄留下來，讀者就不必和寫者同時在線。主題（topic）像一卷數據的名稱，例如 `order_events`；主題可以拆成分區（partition），每個分區都是只往尾端追加的日誌（append-only log）。新紀錄抵達後，Kafka 在該分區給它一個位移（offset；台灣也稱偏移量）。同一分區的位移往前增加，但不承諾連號，更不是全主題的流水號。

![訂單主題分成三條日誌；位移 0 分別屬於不同分區。](assets/bd-kafka-partitions.svg)

## 分區不是複本

Kafka 伺服器叫代理節點（broker）；一個節點可存多個分區，一個分區也可跨節點保有複本（replica）。圖中的 P0:0 和 P1:0 是兩筆不同的紀錄；P0 在另一節點的複本才是 P0 內容的另一份。寫入會找該分區的領導複本（leader）；[〈複本與確認〉](#/lesson/bd-kafka-03)會用 3 個節點推演確認。今天只用 1 個節點確認「一個主題拆成三條日誌」，不拿它證明高可用。

讀取不會像取走信件一樣刪掉訊息。看板讀到 P0 的位移 5，風控仍可從 P0 的位移 0 讀起；兩方的進度是各自的，之後在[〈位移與提交〉](#/lesson/bd-kafka-05)會細講。若看板要求「同一訂單先建立再付款」，就要讓這兩筆紀錄進同一條日誌；[〈生產者與訊息鍵〉](#/lesson/bd-kafka-02)會實際發送。分區裡的順序仍是 Kafka 收到並追加的順序，不保證等於商家系統所記的發生時間。

## 在一台 Windows PC 建主題

啟動 Docker Desktop，在 `C:\dev\conduit-lab\kafka`（C 槽不可用就改 D 槽）建立 `compose.yaml`。Docker 記憶體預留約 2 GB，容器上限 1536 MB。本課 Kafka 4.4.0 的官方 JVM 映像自帶 Java 25；若不用映像而直接跑 Kafka 代理節點，4.4 版至少需要 Java 17。固定這個映像標籤讓同一份命令可重做；按 Kafka 公告關閉該映像受影響的 JVM 最佳化。本實驗不對主機公佈連接埠，只從容器內呼叫工具。

```yaml
services:
  kafka:
    image: apache/kafka:4.4.0
    mem_limit: 1536m
    environment:
      KAFKA_HEAP_OPTS: "-Xms256m -Xmx512m"
      KAFKA_OPTS: "-XX:-UseBASE64Intrinsics"
```

在同一資料夾的 PowerShell 開啟服務。`--bootstrap-server` 是初次聯絡節點的位址，`--topic` 是主題；`--create` 建立，`--describe` 列出規格。若節點尚未就緒，等日誌顯示服務已啟動再跑後兩行。

```powershell
docker compose up -d
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic order_events --partitions 3 --replication-factor 1
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic order_events
```

留下一份描述或截圖：`PartitionCount: 3`，各區都有 leader，且各自只有一份複本。這是拓撲證據，不是吞吐量測試。下一堂沿用服務；想暫停用 `docker compose stop`，模組實驗都做完才在同一資料夾執行 `docker compose down`。`down` 移除實驗容器，不是本課的數據保留方法；重要日誌不要只存在練習容器。

有時維運會問「第 8 筆在哪」。若同一主題有 3 條分區，光這句話不足以查找。工單最好附上日誌座標、來源事件鍵和觀察時間：座標供管道人員找實際接收列，事件鍵供帳務人員查結果。把這兩種識別分開，也能避免將後面出現的重送誤認為另一張訂單。

## 常見錯誤

- 想用位移 8 查一筆訂單 → 沒說是哪個分區 → 同時記主題、分區和位移，另外保留業務鍵。
- 3 區都顯示同一個 leader → 這是單節點，不是建立失敗 → 查分區編號與複本因子。
- CLI 連不上 → 服務還沒就緒或在容器外找內部位址 → 先查 `docker compose logs kafka`，從該容器執行。
