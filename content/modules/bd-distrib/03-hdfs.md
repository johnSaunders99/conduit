---
module: "bd-distrib"
id: "bd-distrib-03"
order: 3
title: "HDFS 區塊與節點"
subtitle: "名稱服務和數據服務分工"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-distrib-02"
objectives:
  - "沿 NameNode 查位置後從 DataNode 讀區塊"
  - "由檔案大小估邏輯區塊數與複本數"
tags:
  - "HDFS"
  - "NameNode"
  - "DataNode"
  - "區塊"
resources:
  - title: "HDFS Architecture"
    url: "https://hadoop.apache.org/docs/r3.5.0/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 NameNode and DataNodes 與 Data Blocks。"
concepts:
  - id: "bd-distrib-03-metadata"
    prompt: "HDFS 讀取時 NameNode 回傳什麼？"
    answer: "回傳檔案對應的區塊與位置資訊，客戶端向 DataNode 讀內容。"
    mcq:
      question: "讀大檔時，數據內容的主要路徑在哪？"
      options:
        - "客戶端從 NameNode 下載所有內容"
        - "DataNode 先把內容寫到 NameNode"
        - "客戶端向 DataNode 讀"
        - "客戶端只讀區塊清單"
      answer: 2
      explain: "清單用於定位；真正的數據從 DataNode 傳回。"
  - id: "bd-distrib-03-block"
    prompt: "300 MiB 檔案用 128 MiB 區塊大小會有幾個邏輯區塊？"
    answer: "3 個，最後一塊為 44 MiB；複本另計。"
    mcq:
      question: "一個 44 MiB 檔案使用 128 MiB 區塊大小，下面哪個敘述對？"
      options:
        - "一塊儲存 44 MiB 的檔案內容"
        - "預先填滿 128 MiB 的數據"
        - "切成 44 個區塊"
        - "複本 3 時有三個邏輯區塊"
      answer: 0
      explain: "區塊大小是切分上限；複寫不改邏輯區塊數。"
    interview:
      question: "為何同樣 1 GiB，很多小檔案會讓 HDFS 更難管理？"
      points:
        - "命名空間每個檔案有紀錄"
        - "區塊與位置也有管理成本"
        - "以合併並保留必要分區應對"
      answer: "小檔案不會各填滿區塊，但檔案與區塊紀錄變多，列舉和開檔也更頻繁。我會先看每個日期分區的檔案分布，再合併已穩定的輸出。"
  - id: "bd-distrib-03-reports"
    prompt: "心跳與區塊報告有何區別？"
    answer: "心跳回報節點存活，區塊報告提供該節點持有哪些區塊的資訊。"
  - id: "bd-distrib-03-layer"
    prompt: "NameNode 備援能恢復什麼？"
    answer: "讓名稱與位置服務有機會接手，不會重建所有複本皆已遺失的區塊。"
    mcq:
      question: "兩份 B 都失去，但備援 NameNode 仍正常，哪一項成立？"
      options:
        - "它會用別的區塊改名還原 B"
        - "重新啟動客戶端可重建 B"
        - "位置服務可用，B 的內容仍需健康來源或備份"
        - "把複本因子調高就會生出 B"
      answer: 2
      explain: "備援保護控制路徑；沒有健康數據時不能靠更改目標數重建。"
practice:
  - id: "bd-distrib-03-lab"
    kind: "explain"
    title: "留下讀取路徑與區塊帳"
    minutes: 9
    steps:
      - "在 bd-distrib 練習資料夾畫 300 MiB 檔案的區塊清單"
      - "標出每塊三份的放置表並讓一個節點失效"
      - "保留可讀路徑與缺少複本的清單"
    checks:
      - "三個邏輯區塊、完整時九份區塊複本"
      - "仍有任一份健康時，可從該節點讀取本塊"
---

## 找位置與讀內容是兩件事

HDFS（Hadoop Distributed File System）是 Hadoop 的分散式檔案系統，目標是讓多台機器共同存大檔案，並讓工作可以順序讀取大量數據。對使用者，`orders.csv` 還是一個檔名；對系統，它是有次序的區塊（block）清單，每個區塊可在多台節點保有複本。先區分使用者看到的路徑、邏輯區塊與實際的區塊複本。

NameNode（名稱節點）管理命名空間（namespace），也就是目錄、檔名、權限，以及檔案對應哪些區塊等資訊。這些描述數據的資訊叫中繼數據（metadata；大陸多稱元數據）。DataNode（數據節點）保存區塊內容，回報心跳（heartbeat）與區塊報告（block report），讓 NameNode 知道哪些節點活著、持有哪些區塊。檔案系統的使用者程式稱為客戶端（client）。

![讀取路徑：客戶端先問位置，再讀數據節點](assets/bd-distrib-hdfs.svg)

## 走一遍讀取

1. 客戶端向 NameNode 查 `orders.csv`，取得檔案的區塊位置資訊。
2. 客戶端直接接上合適的 DataNode，依序讀取需要的區塊；若其中一個讀取來源失效，可改用該區塊的其他健康複本。
3. NameNode 發現回報異常後會依情況安排補複本。讀取是否能繼續，取決於所需區塊是否還有健康複本；同時不能忽略名稱服務本身的可用性。

一個 300 MiB 檔案，假定區塊大小是 128 MiB，拆成 `128 + 128 + 44`，不是 3 塊都填滿。複本因子 3 時，是 3 個邏輯區塊各存 3 份，共 9 個區塊複本。忽略額外中繼數據，存的內容約 `300 × 3 = 900 MiB`。對照 300 個各 1 MiB 的檔案；內容同樣多，卻有 300 筆檔案紀錄、300 個邏輯區塊。小檔問題不必靠填滿區塊才會發生。到[〈小檔案合併〉](#/lesson/bd-hive-07)會練如何減少管理成本又能證明數據沒改。

## 用一張紙代替迷你叢集

在 `C:\dev\conduit-lab\bd-distrib` 存 `hdfs-read.md`，做一張 `A: 1,2,3 / B: 2,3,4 / C: 1,3,4` 的表，寫下每塊位元組量所對應的 MiB 數，再劃掉 3 號。模擬讀者依序讀 A、B、C，每塊為它選一個備援讀取點。這個案例三塊都能讀，但都少一份，需要補回 3 份；不是重傳三次完整檔案。這是單機紙面演練，無服務或額外 RAM 需求，也不把一台主機的多個模擬節點算成真實容錯。

### 寫入和讀取方向不同

讀取是客戶端找到一個健康來源；典型 HDFS 寫入則由 NameNode 依放置策略挑出 DataNode，客戶端把數據送進寫入管線（pipeline），管線中的節點接收後再傳給下一個節點。不能因為讀時只找一份，就推論寫時也只處理一份。若一個節點離開，哪些區塊失去複本與哪個檔可讀，必須回到區塊對應表，不能只看節點總數。

名稱服務也可以有高可用（high availability）設計，讓另一個 NameNode 在主節點失效時接手。這與 DataNode 的區塊複本是兩層保護：有備援名稱節點不會憑空重建全失的區塊。

## 常見錯誤

- NameNode 流量想成每次都傳完整大檔 → 混淆查位置與傳內容 → 把 2 條路徑分開畫。
- 以 128 MiB 乘所有塊數估小檔大小 → 把區塊上限當實際長度 → 分開計內容位元組與管理項目數。
- 替 B 改讀 A 的複本 → 兩個區塊內容不同 → 必須選同一個區塊的健康複本。
