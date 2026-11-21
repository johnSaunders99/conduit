---
module: "bd-distrib"
id: "bd-distrib-04"
order: 4
title: "YARN 資源分配"
subtitle: "排隊不等於任務真的慢"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-distrib-03"
objectives:
  - "從時間線分離首個容器等待與執行時間"
  - "指出 ResourceManager、ApplicationMaster 與 NodeManager 的責任"
tags:
  - "YARN"
  - "排隊時間"
  - "容器"
  - "資源配額"
resources:
  - title: "Apache Hadoop YARN"
    url: "https://hadoop.apache.org/docs/r3.5.0/hadoop-yarn/hadoop-yarn-site/YARN.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "對照資源排程器、應用管理器、節點管理器。"
concepts:
  - id: "bd-distrib-04-roles"
    prompt: "YARN 的 ResourceManager 和 NodeManager 分別管什麼？"
    answer: "前者統籌分配叢集資源；後者在各節點啟動與監看容器。"
    mcq:
      question: "誰負責在指定節點實際啟動容器？"
      options:
        - "NameNode"
        - "ResourceManager 的排程器"
        - "NodeManager"
        - "提交工作的使用者"
      answer: 2
      explain: "排程器分配，NodeManager 才是節點上的執行者。"
  - id: "bd-distrib-04-am"
    prompt: "每個應用的 ApplicationMaster 做什麼？"
    answer: "向 ResourceManager 協商資源，協調該應用的容器並追蹤工作。"
    mcq:
      question: "哪個元件最直接知道此應用哪個任務需要重試？"
      options:
        - "所有節點的 NameNode"
        - "此應用的 ApplicationMaster"
        - "ResourceManager 的隊列配額設定"
        - "所有應用共用的客戶端"
      answer: 1
      explain: "應用層協調者追蹤任務；配額不是任務進度，NameNode 管儲存。"
  - id: "bd-distrib-04-wait"
    prompt: "怎麼區分啟動等待與真正運算慢？"
    answer: "對照提交、容器分配、第一個任務起跑與結束時間，再查空檔落在哪個區段。"
    interview:
      question: "日報提交後 10 分鐘才開始執行，怎麼查？"
      points:
        - "先拆時間線"
        - "查隊列容量與容器請求"
        - "有資源後才查任務慢點"
      answer: "我先比分配容器與任務開始的時點。若卡在分配前，先查隊列容量、其他應用及請求規格；若已起跑且少數工作拖尾，才查讀取量和傾斜。"
practice:
  - id: "bd-distrib-04-lab"
    kind: "explain"
    title: "留下一份排隊判讀表"
    minutes: 8
    steps:
      - "在 bd-distrib 建立 yarn-timeline.md"
      - "按正文案例填兩次等待、啟動、執行時間"
      - "在表尾說明下一步要找哪個元件"
    checks:
      - "第一輪等待容器 7 分鐘，第二輪 2 分鐘"
      - "兩輪實際計算都是 3 分鐘"
---

## 十一分鐘都在運算嗎？

凌晨的日報十一分鐘才出來，但 CPU（中央處理器）並沒有一直在忙。YARN（Yet Another Resource Negotiator）讓不同應用共享叢集的記憶體與 CPU；它分配資源，不替 Hive 或 Spark 算訂單。把「我已送出工作」、「工作拿到資源」和「程式正在算」分開，才知道該找排程器還是翻查詢計畫。

YARN 容器（container）在這裡指執行程式的一份資源分配與執行環境，例如某一台節點上的 2 GiB 記憶體及 1 個虛擬運算核心（vcore）。它不是叫你先寫 Docker 映像。排隊規則可以在同一份叢集容量中給不同隊列不同配額；因此「看到整個叢集還有記憶體」不等於「這個應用現在拿得到要求的容器」。

## 三個角色如何接棒

![提交、協商容器、啟動工作：三個責任分開](assets/bd-distrib-yarn.svg)

1. 客戶端把應用交給 ResourceManager（資源管理器）。它管理叢集的分配；其中的排程器（scheduler）按照容量、隊列與資源請求做決策。
2. 先取得讓 ApplicationMaster（應用管理器）能啟動的容器。它是這個應用自己的協調者，繼續協商執行工作的容器，並追蹤任務。
3. NodeManager（節點管理器）在自己的節點啟動、監看容器並回報狀況；實際業務計算跑在容器內。容器請求過大，可能沒有任何單一節點符合，不是把各台剩餘記憶體相加就能啟動。

把 ResourceManager 想成管全店座位的櫃檯，ApplicationMaster 是這批貨的負責人，NodeManager 是把貨和工具送進各工位的人。工具拿到了但載入數據還沒起跑，不能把那段也算成排隊。任務失敗可否重跑，由應用或執行引擎決定；[〈分散式重試〉](#/lesson/bd-distrib-07)會拆開執行與寫入的界線。

## 用兩次時間線交接

在 `C:\dev\conduit-lab\bd-distrib` 寫 `yarn-timeline.md`。這是取樣紀錄的紙面練習，不啟動叢集、不需額外 RAM。第一次：02:00 提交；02:07 首個工作容器分配；02:08 任務開始；02:11 計算結束。第二次：03:00 提交；03:02 分配；03:03 開始；03:06 結束。這裡的「提交到工作容器」包含先啟動應用管理器，不是精確的隊列等待指標；真實值班要再查它何時啟動與何時提出請求。

第一輪的 7 分鐘與第二輪的 2 分鐘發生在容器分配前；啟動各 1 分鐘，計算各 3 分鐘。先比隊列的用量與請求，不要用同事一句「今天比較快」就歸功於 SQL 調優。若多個應用同時等待，再檢查是否有容量限制；若只有這個應用等待，先查它的容器請求有沒有節點放得下。

### 剩餘資源不一定能湊用

例如某個容器要 4 GiB，兩台節點各空 3 GiB，合計雖有 6 GiB，仍沒有一台能接。記錄容器要求的大小、而不只記錄要幾個容器，才能判斷是容量不足還是請求不合適。

## 常見錯誤

- 延遲全算到查詢 → 提交到完成含其他時間 → 先對齊各時點再定位。
- 把 YARN 容器當作 Docker 映像 → 混淆資源分配與封裝 → 查容器的記憶體與核心請求。
- 叢集加總夠大仍排隊 → 單一節點或隊列放不下 → 查每節點可用資源及容量限制。
