---
id: bd-orch-05
module: bd-orch
order: 5
title: Airflow 任務與交換
subtitle: 不要把整張表塞進訊息
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-04
objectives:
- 用 TaskFlow 建出寫檔與驗收兩個任務
- 用 XCom 只傳路徑與筆數
- 啟動一個有容器記憶體上限的官方 Compose 教學環境
tags:
- Airflow
- TaskFlow
- XCom
- 工作流
resources:
- title: Airflow：Docker Compose 快速開始
  url: https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 查服務分工、啟動順序及本機登入。
- title: Airflow：TaskFlow
  url: https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 @dag、@task 與傳回值如何建立依賴。
- title: Airflow：XCom
  url: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/xcoms.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看適合傳送的訊息大小與範圍。
- title: Docker Compose：合併規則
  url: https://docs.docker.com/reference/compose-file/merge/
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 查如何用 !override 取代對外埠。
concepts:
- prompt: XCom 適合放什麼？
  answer: 短小的路徑、列數、版本等跨任務資訊；表格本身應放到上下游可存取的儲存。
  mcq:
    question: 兩個任務要傳 1 GB 訂單，最合理的是？
    answer: 1
    options:
    - 把全表塞進 XCom
    - 用共用儲存，XCom 傳路徑與筆數
    - 用環境變數保存整份 CSV
    - 令下游猜上一個工作者檔名
    explain: 工作者到共用儲存讀取，XCom 只帶定位和驗收資訊。壓縮後塞進元數據庫仍是大載荷。
  id: bd-orch-05-xcom
- prompt: 在 DAG 函式裡把一個任務的結果傳給另一個時，代表什麼？
  answer: TaskFlow 建出依賴與結果引用；任務執行時才用 XCom 取得傳回值，不在定義階段搬整份數據。
  mcq:
    question: 寫成 verify(stage()) 後，stage 裡的寫檔何時發生？
    answer: 3
    options:
    - 每次載入瀏覽器
    - 匯入 DAG 檔時立即
    - 編輯器存檔時
    - 該次 stage 任務執行時
    explain: 解析圖建立任務引用，不應在頂層寫檔或連庫；排程實際派給執行者時才寫。
  id: bd-orch-05-taskflow
- prompt: 為何不能只傳容器內任意暫存路徑？
  answer: 若另一個執行者不掛相同儲存，它看不到路徑；傳位置還要保證可讀及版本正確。
  interview:
    question: Airflow 用 XCom 交接大表，怎麼改且如何驗？
    answer: 我會將數據輸出到受控共用儲存，寫完校驗後只交接 URI、版本及列數，再由下游讀回比對。每次執行要有清楚的命名規則；中斷重試或不同 worker 也能拿到同一版。元數據庫不承擔批量輸送。
    points:
    - XCom 只帶小型訊息
    - 保證跨執行者可讀
    - 版本、重試與驗收
  id: bd-orch-05-storage
practice:
- kind: hands-on
  title: 跑出一列訂單交接清單
  minutes: 14
  steps:
  - 按正文章節啟動 Compose，從 UI 手動執行 conduit_order_handoff。
  - 查看 stage 的 XCom 及 verify 日誌；在 artifacts 目錄打開 CSV。
  - 保留圖和一行成功日誌，然後依正文停止專案。
  checks:
  - XCom 只存路徑及 rows=1，CSV 的內容不在 XCom。
  - 下游日誌出現 rows=1 amount=225，停止後練習產物仍在。
  id: bd-orch-05-p1
---

## 任務之間交棒，不是搬一整張表

Airflow 把 DAG 定義、排程與實際執行分開。排程器（scheduler）依圖與狀態選下一個任務；工作者（worker）執行；介面接到的狀態存在元數據庫（metadata database）。在 Airflow 3 的 TaskFlow API 中，`@dag` 組圖，`@task` 定義任務，把一個任務的結果交給另一個會建立依賴。跨任務通訊（XCom）適合傳小型訊息；本例交的是檔案位置和筆數，不是 CSV 本身。

## 啟動單機版，不把練習端口暴露到網路

先複習[〈Docker 本機實驗室〉](#/module/fd-docker)。關掉其他大數據實驗，給 Docker Engine 預留 8 GB；以下只跑本課使用的服務，容器上限合計 6960 MiB（計入初始化也低於 8 GB），不啟動 triggerer、Flower，也不載入示範 DAG。主機不用裝 Java。請用能支援 `!override` 的 Docker Compose（至少 2.24.4）。首次會下載映像；請先確認 Docker Desktop 已啟動且工作區可掛載。若本機不足 8 GB，先完成下文的圖和交接設計，不勉強啟動。

用 PowerShell 建立全新練習目錄。這份課程固定 Airflow 3.4.0，因為 Compose 檔案的服務名稱及 TaskFlow 匯入方式是本課的一部分。

```powershell
New-Item -ItemType Directory -Force C:\dev\conduit-lab\airflow-lab | Out-Null
Set-Location C:\dev\conduit-lab\airflow-lab
New-Item -ItemType Directory -Force -Path dags,logs,plugins,config,artifacts | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri 'https://airflow.apache.org/docs/apache-airflow/3.4.0/docker-compose.yaml' -OutFile docker-compose.yaml
@'
AIRFLOW_UID=50000
FERNET_KEY=
'@ | Set-Content -Encoding ascii .env
```

在這個資料夾新增 `compose.lab.yaml`。用以下覆蓋檔保留官方設定中的健康檢查與初始化；替換公開端口，不要只是再加一筆端口。工作者的共用目錄才是檔案放置處，`AIRFLOW__CELERY__WORKER_CONCURRENCY` 控制同時跑的任務數。

```yaml
x-lab-env: &lab-env
  AIRFLOW__CORE__LOAD_EXAMPLES: "false"
services:
  postgres:
    mem_limit: 600m
  redis:
    mem_limit: 160m
  airflow-init:
    mem_limit: 1000m
    environment: *lab-env
  airflow-apiserver:
    mem_limit: 1200m
    environment:
      <<: *lab-env
      AIRFLOW__API__WORKERS: "1"
    ports: !override
      - "127.0.0.1:8080:8080"
  airflow-scheduler:
    mem_limit: 1200m
    environment: *lab-env
  airflow-dag-processor:
    mem_limit: 1200m
    environment: *lab-env
  airflow-worker:
    mem_limit: 1600m
    environment:
      <<: *lab-env
      AIRFLOW__CELERY__WORKER_CONCURRENCY: "1"
    volumes:
      - ./artifacts:/opt/airflow/artifacts
```

在 `dags/order_handoff.py` 放入以下內容。每次執行只用一列固定訂單；真實環境要依營業日及版本產生不重疊的發布鍵，並讓所有執行者能讀該儲存。

```python
import csv
from pathlib import Path

from airflow.sdk import dag, task

@dag(dag_id="conduit_order_handoff", schedule=None, max_active_runs=1)
def order_handoff():
    @task()
    def stage():
        path = Path("/opt/airflow/artifacts/daily_orders.csv")
        temp = path.with_suffix(".tmp")
        temp.write_text("order_id,amount\n1001,225\n", encoding="utf-8")
        temp.replace(path)
        return {"path": str(path), "rows": 1}

    @task()
    def verify(manifest):
        with Path(manifest["path"]).open(encoding="utf-8", newline="") as file:
            rows = list(csv.DictReader(file))
        if len(rows) != manifest["rows"]:
            raise ValueError("row count mismatch")
        print(f"rows={len(rows)} amount={sum(int(row['amount']) for row in rows)}")

    verify(stage())

order_handoff()
```

回到 PowerShell 先初始化，再啟動這兩個任務用得到的服務。初始化若非成功退出，先看其日誌，不要往下做。

```powershell
docker compose -p conduit-airflow -f docker-compose.yaml -f compose.lab.yaml up airflow-init
docker compose -p conduit-airflow -f docker-compose.yaml -f compose.lab.yaml up -d airflow-apiserver airflow-scheduler airflow-dag-processor airflow-worker
docker compose -p conduit-airflow -f docker-compose.yaml -f compose.lab.yaml ps
```

在瀏覽器開本機 `127.0.0.1:8080`；登入方式見資源的「Accessing the web interface」。等到看見 `conduit_order_handoff`，先啟用該 DAG，再手動執行並檢查 `verify` 日誌與 XCom。沒有間隔排程，這趟只驗證交接。完畢後在同一資料夾執行下列指令，保留掛載產物，不刪卷宗。

```powershell
docker compose -p conduit-airflow -f docker-compose.yaml -f compose.lab.yaml down
```

## 你在畫面上要找的兩份證據

先在圖上確認驗收只有一條來自寫檔的邊，再打開這次執行的交接內容。若位置和列數皆可讀，卻不是你想要的營業日，問題在交付參數，不是訊息傳輸。要在正式工作避免這類錯誤，可把營業日、數據版本與檔案校驗值放進短小清單，而不是把輸出整份放進交換訊息。工作者重試時要能根據同一份清單讀回正確版本。

想再測一種故障，可以把寫端回傳的筆數改成 2，只重跑練習圖。寫端仍留下 1 列完整檔案，下游驗收卻理應失敗；這是「上游成功」不等於「下游可用」的好證據。恢復為 1 後再手動執行，保留兩次任務實例的結果。

## 常見錯誤

- **找得到 DAG，但驗收說檔案不存在 →** 上下游未共享同一目錄；核對執行者掛載及傳回路徑。
- **記憶體吃緊、服務一直重啟 →** 疊開其他實驗或未套覆蓋檔；用 `ps` 與日誌查實際啟動的服務，先關無關實驗。
- **切到正式環境後再次覆寫不同日 →** 用了這堂固定檔名；改成以營業日及版本定位，並驗證讀權限。

**重點回顧：**排程器協調依賴，worker 讀寫產物，XCom 只交付產物的位置和少量驗收資訊。
