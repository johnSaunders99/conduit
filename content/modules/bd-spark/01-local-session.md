---
module: "bd-spark"
id: "bd-spark-01"
order: 1
title: "本機 Spark 與工作階段"
subtitle: "單機也能看見執行階段"
minutes: 30
level: 2
status: "ready"
prereqs: []
objectives:
  - "在 WSL 用 PySpark 啟動 local[2] 並產生查詢結果"
  - "截取 Spark UI 的 Jobs、Stages 與 Tasks 位置"
tags:
  - "PySpark"
  - "SparkSession"
  - "local mode"
  - "Spark UI"
resources:
  - title: "PySpark Installation"
    url: "https://spark.apache.org/docs/latest/api/python/getting_started/install.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 Python 支援版本與 JAVA_HOME 的要求。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "先找 Jobs、Stages 及任務明細。"
  - title: "Apache Spark Downloads"
    url: "https://spark.apache.org/downloads.html"
    kind: "doc"
    lang: "en"
    minutes: 3
    required: false
    checked: "2026-11-20"
    note: "核對目前正式版本，不使用預覽版。"
concepts:
  - id: "bd-spark-01-driver"
    prompt: "Spark 的 Driver 負責什麼？"
    answer: "Driver 建立應用與查詢計畫、安排工作，收集執行狀況與需要回傳的結果。"
    mcq:
      question: "若要看本機應用的作業紀錄，去哪裡？"
      options:
        - "到 Hive 的數倉目錄"
        - "在應用尚未停止時查看 Spark UI"
        - "只查 Python 套件版本"
        - "只看輸出檔名"
      answer: 1
      explain: "本機 UI 跟著應用；套件資訊和檔名不提供執行紀錄。"
  - id: "bd-spark-01-local"
    prompt: "local[2] 中的 2 是什麼？"
    answer: "本機模式可用的 2 個工作執行緒，不是 2 台機器。"
    mcq:
      question: "local[2] 測通，哪個結論成立？"
      options:
        - "已部署兩台 Executor 主機"
        - "證明工作可承受機器故障"
        - "此計算在本機有最多 2 個工作槽可用"
        - "所有查詢一定剛好有 2 個任務"
      answer: 2
      explain: "執行緒數不是主機數，也不決定任務總數。"
    interview:
      question: "為何先用本機模式，什麼不能因此證明？"
      points:
        - "可驗證 API 與小數據結果"
        - "能看作業與計畫"
        - "不能量跨機網路或叢集容錯"
      answer: "我用 local[2] 快速核對結果和 UI，不用為小例子起叢集。它不能模擬多節點的交換成本、資源爭用或故障域。"
  - id: "bd-spark-01-session"
    prompt: "為何程式先取得 SparkSession？"
    answer: "它是建立 DataFrame、讀取檔案和執行 SQL 的主要入口，保管同一工作階段的設定。"
  - id: "bd-spark-01-runtime"
    prompt: "只裝得了 PySpark，不代表哪一項通過？"
    answer: "不代表相容的 JVM 可啟動；還要檢查實際 JDK 和 JAVA_HOME。"
    mcq:
      question: "已安裝 PySpark 但目前 java -version 是 11，應先做什麼？"
      options:
        - "把 local[2] 改成 local[*]"
        - "選相容的 JDK 並核對 JAVA_HOME"
        - "用 Hive 代替 Python 解譯器"
        - "把 JVM 當不存在"
      answer: 1
      explain: "增加執行緒不能修正 Java 相容性；先解決本機執行前提。"
practice:
  - id: "bd-spark-01-lab"
    kind: "hands-on"
    title: "交第一份 Spark UI 截圖"
    minutes: 12
    steps:
      - "建立 bd-spark 的虛擬環境及 lab_session.py"
      - "執行 spark_intro.py，讓提示停在終端"
      - "依印出的網址打開 Spark UI，記下完成工作與階段的連結"
      - "回終端按 Enter 關閉應用"
    checks:
      - "表格顯示 0、1、2 三列"
      - "截圖或筆記能指出 Jobs 的一筆完成紀錄與該階段的任務明細"
---

## 同一台機器也可以看見分工

Spark 是把大計算拆成工作來執行的引擎。第一次不需要多台電腦，先讓本機把小數據算完，並親眼看到執行紀錄。PySpark 是它的 Python 介面：Python 送出計畫，Spark 在 Java 虛擬機（JVM）裡執行許多內建運算。因此，只裝一個 Python 套件還不夠，負責執行的 JVM 也要能正常啟動。

![程式把計畫交給 Driver，再由工作執行緒處理分區](assets/bd-spark-execution.svg)

驅動程式（driver）協調工作，執行器（executor）負責跑任務。在本機模式（local mode）下先把它們理解為同機的協調和執行角色，沒有多台工作主機。`local[2]` 允許最多 2 個本機工作執行緒同時處理任務；即使有 8 個任務，也只是分批完成。今天認識工作階段（SparkSession）：它是取得表格、讀檔及送查詢的入口。至於作業（job）、階段（stage）和任務（task），先在 UI 看三層位置，[〈Job 與 Stage〉](#/lesson/bd-spark-05)再拆給你看。

## 在 WSL 2 準備一次

Windows 上開 WSL 2 Ubuntu，本組實驗使用 Spark 4.3.0、Python 3.11 以上與 JDK 21；`JAVA_HOME` 指向實際的 JDK 目錄。PySpark 安裝完成不代表 Java 版本相容，先驗兩者。本機練習預留 3 GB RAM，不與其他大型服務同跑。若工作區在 D 槽，以下路徑改成 `/mnt/d/dev/conduit-lab/bd-spark`。`python3` 需指向符合需求的解譯器，並要有對應 `venv` 模組。
若尚未準備環境，Ubuntu 24.04 可用 `sudo apt update` 後由學習者執行 `sudo apt install python3-venv openjdk-21-jdk`。這是一次性的 Ubuntu 套件安裝；已裝相容版本就跳過。若電腦有多個 JDK，先用 `update-alternatives --list javac` 找到 JDK 21 的完整路徑，將 `JAVA_HOME` 設成該路徑拿掉結尾的 `/bin/javac`，再用 `"$JAVA_HOME/bin/java" -version` 確認。此設定至少要在執行練習的同一個終端生效。

```bash
java -version
python3 --version
mkdir -p /mnt/c/dev/conduit-lab/bd-spark
cd /mnt/c/dev/conduit-lab/bd-spark
python3 -m venv .venv
.venv/bin/python -m pip install pyspark==4.3.0
```

在該目錄存 `lab_session.py`，後續本模組都從它啟動。`builder.master(...)` 設執行位置，`appName(...)` 為 UI 中的名稱，`getOrCreate()` 取得或建立 Session，最後應用用 `stop()` 釋放。
```python
from pyspark.sql import SparkSession

def start(name):
    return (SparkSession.builder.master("local[2]").appName(name)
            .config("spark.sql.shuffle.partitions", "4").getOrCreate())
```

存成 `spark_intro.py`，在同一資料夾執行 `.venv/bin/python spark_intro.py`。`range(3)` 給出 0 到 2，`show()` 要求 Spark 計算並顯示結果。
```python
from lab_session import start

spark = start("Conduit First Spark Job")
try:
    spark.range(3).show()
    print(spark.sparkContext.uiWebUrl)
    input("Open Jobs, Stages and Tasks, then press Enter: ")
finally:
    spark.stop()
```

在等待輸入時開瀏覽器。Spark UI 通常從 4040 起；若印出的名稱無法從 Windows 解出，可用 `127.0.0.1` 搭配實際連接埠，請勿為了練習把 UI 發佈到外網。打開一個已完成的 Job，再點它的 Stage 到任務明細。關閉程式後，這個即時 UI 通常也會關閉，先把證據留下。

### 看懂一次執行的三層證據

先在 Jobs 確認應用名稱對不對、工作完成了沒有。點進工作看它等哪些階段，再進階段看各任務的花費。你會發現一個小查詢可能還有未涉及的任務或額外階段；今天先把這三個頁面的位置認熟，不必從一次輸出反推固定規則。

對於一個已執行的批次，留下一張圖和三行交接文字：這是什麼應用、它產出什麼、要去哪個頁籤追蹤某個任務。若 4040 已被另一個應用佔用，根據程式輸出的網址，不用猜。即時 UI 是現場證據，不是歷史服務；如果之後想保留多批次紀錄，需要另外規劃事件日誌與歷史伺服器，而不是讓所有練習應用都一直開著。

若只有終端能看到輸出，先確保程式還停在提示，並從 Ubuntu 端確認它印出的連接埠，接著再判斷是不是 Windows 到 WSL 的網路轉送問題。先保留結果，不用更改防火牆來完成這堂。

## 常見錯誤

- 安裝成功卻啟動不了 → JVM 和 Python 是兩個條件 → 核對版本與 JAVA_HOME。
- 網頁找不到 → 應用可能結束或改用了其他連接埠 → 保留終端並看它印出的網址。
- 有兩個執行緒就當作兩台節點 → 本機沒有跨機故障域 → 只對本機的行為下結論。
