---
id: fd-docker-05
module: fd-docker
order: 5
title: Compose 服務
subtitle: 用一份檔案啟動實驗
status: ready
minutes: 30
level: 1
prereqs:
- fd-docker-04
objectives:
  - "用同一份 Compose 設定管理供應端與讀取端"
  - "用健康檢查區分開始運作與可供讀取"
  - "從日誌和退出碼驗證一次性讀取作業"
tags:
  - "Docker Compose"
  - "compose.yaml"
  - "healthcheck"
  - "depends_on"
resources:
  - title: "Control startup and shutdown order in Compose"
    url: "https://docs.docker.com/compose/how-tos/startup-order/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 service_healthy 和單純開始運作的差別。"
  - title: "Compose services reference"
    url: "https://docs.docker.com/reference/compose-file/services/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 image、command 和 healthcheck 的寫法。"
concepts:
  - id: fd-docker-05-service
    prompt: "Compose 的服務與容器是同一名詞嗎？"
    answer: "服務是描述一種工作及其設定；容器是按這個設定建立的執行實例。"
    mcq:
      question: "重建 Compose 的 feed 容器後，讀取端在預設網路仍應用什麼？"
      options:
        - "舊容器 IP"
        - "現在的容器 ID"
        - "服務名稱 feed 與容器埠"
        - "讀取端自己的 localhost"
      answer: 2
      explain: "服務名稱是共同網路可用的稱呼，不應綁死某一次容器的 IP 或 ID。"
  - id: fd-docker-05-healthy
    prompt: "短寫 depends_on 為何不足以確認能讀 CSV？"
    answer: "它約束啟動順序而不等內容可讀；應設能驗證服務的 healthcheck，再要求 service_healthy。"
    mcq:
      question: "怎樣明確等供應端真的能回 CSV？"
      options:
        - "只把供應服務寫在檔案第一個"
        - "讀取端固定休息一秒"
        - "只有 depends_on 的服務名清單"
        - "healthcheck 搭配 service_healthy"
      answer: 3
      explain: "順序與固定等待不等同可用；健康條件才以觀察結果當作啟動前提。"
    interview:
      question: "讀取端偶發連不到剛啟動的供應端，你會先改哪裡？"
      answer: "我會先確認供應端啟動時到底有沒有把 CSV 準備好。用能真的取到檔案的健康檢查做就緒條件，讀取端等通過才開始；供應端日後仍可能重啟，常駐讀取端還需要自己的重試。"
      points:
        - "區分啟動與就緒"
        - "驗證真正的交付入口"
        - "之後的失敗仍需處理"
  - id: fd-docker-05-oneshot
    prompt: "reader 顯示 Exited (0) 為什麼是好事？"
    answer: "它是一個只讀一次並交付內容的作業；應搭配日誌驗證，不期待它常駐。"
    mcq:
      question: "驗收 reader 應找哪個組合？"
      options:
        - "永遠 Running，沒有日誌"
        - "Exited (0)，日誌有虛構訂單"
        - "只有 feed 開始"
        - "主機瀏覽器能打開 feed 名稱"
      answer: 1
      explain: "一次性工作的契約是交付後退出；Compose 沒有發布主機入口。"
  - id: fd-docker-05-recovery
    prompt: "初次的健康檢查通過代表供應端以後也不會斷線嗎？"
    answer: "不代表；長時間用戶端仍需要處理之後的失敗與重試。"
practice:
  - id: fd-docker-05-p1
    kind: hands-on
    title: "交接一份可重啟的訂單實驗"
    minutes: 10
    steps:
      - "在新目錄存 compose.yaml，驗證、啟動，保存 reader 日誌。"
      - "用 ps -a 分別記錄常駐服務的健康與一次性工作退出狀態。"
      - "使用同一個專案名 down，保留設定和 reader.txt。"
    checks:
      - "feed 是 healthy，reader 以 0 退出，日誌含 o701,paid。"
      - "沒有發布主機埠，驗證設定與容器結果分開。"
---

上一堂用命令手動接起兩個容器。交接時若漏掉啟動順序，讀取器可能在檔案還不能讀時先退出。這次把設定寫進一個檔案，交接的不只是「先啟動誰」，還有「供應端真的可讀」的驗收規則。

## 用設定描述工作、網路與就緒

Docker Compose 用 YAML（可讀文字的設定格式）描述同一專案的一組服務（services）。服務是在說要用什麼映像及命令，容器則是這種工作的實例。Compose 預設替專案建立網路，裡面用服務名找到對方。

- `services` 下每個名稱定義一種工作，`image` 決定執行環境，`command` 指定啟動後要做什麼。
- `healthcheck` 是在受測容器內定期執行的檢查；回 0 表示這次測試通過。測 HTTP 檔案比只查行程有沒有存在更接近這次的契約。
- `depends_on` 指定相依關係。用長寫法 `condition: service_healthy`，等指定的健康檢查通過後才開讀取端。單純啟動順序不能保證服務已就緒。

## 啟動一份報表和一個讀取工作

在 `C:\dev\conduit-lab\docker\compose` 新目錄存 `compose.yaml`，縮排用空白。兩個容器共用同一個輕量映像，無須開數據庫或發布主機埠。健康檢查在 `feed` 內用它的回送位址；`reader` 則問網路上的服務名稱。

```yaml
services:
  feed:
    image: python:3-slim
    command:
      - sh
      - -c
      - >-
        mkdir -p /tmp/orders &&
        echo order_id,status > /tmp/orders/orders.csv &&
        echo o701,paid >> /tmp/orders/orders.csv &&
        exec python -m http.server 8000 --bind 0.0.0.0 --directory /tmp/orders
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/orders.csv', timeout=2).read()"]
      interval: 2s
      timeout: 3s
      retries: 10
  reader:
    image: python:3-slim
    depends_on:
      feed:
        condition: service_healthy
    command: ["python", "-c", "import urllib.request as u; print(u.urlopen('http://feed:8000/orders.csv', timeout=3).read().decode())"]
```

在該目錄用 PowerShell。`-p` 此處是 Compose 的專案名，不是 `docker run` 的連接埠旗標。先用 `docker compose ls -a` 確認 `order-lab` 未被使用；若有，換未使用的新名並套到每一行。第一個命令只校驗設定，不能驗收服務。

```powershell
docker compose -p order-lab config --quiet
docker compose -p order-lab up -d
docker compose -p order-lab ps -a
docker compose -p order-lab logs --no-color reader | Tee-Object reader.txt
```

預期 `feed` 為健康，`reader` 讀到 `o701,paid` 並以 0 退出。短時間還在跑就稍後重查；若根本沒啟動，先看供應端健康；已啟動卻回非零，先看讀取端實際錯誤。仍在同一目錄收尾：

```powershell
docker compose -p order-lab down
```

留下設定和日誌給下一班。健康只代表某次測試已通過，長時間工作仍要處理服務後續重啟；不能把這次成功當永久承諾。

## 問的是能不能工作，而不是有沒有行程
這裡測的是程式能開啟這個 CSV，而不是檔案是否包含今天的批次。若昨天的快取還留著，健康檢查可能通過，讀取端也可能正常退出，但內容不符合日報要求。把條件分開：就緒（readiness）決定可不可以開始請求，交付驗收決定收到的是不是這次需要的數據。讀取端在日誌印出預期樣本，正是補上第二層；正式工作通常還要核對日期與欄位。

如果同事只拿了 `compose.yaml`，能用相同的服務名稱與命令重建；若要精確重現相同軟體內容，還要一併記下映像摘要。交接時可以附「設定已解析」、「供應端變健康」、「讀取成功」三條，避免將第一條寫成整套已通過。

## 常見錯誤

- 只用相依服務名卻偶爾取檔失敗 → 只排序，沒等待就緒 → 使用健康條件。
- 讀取服務一直在重啟 → 把一次性作業當成常駐服務 → 按退出碼與輸出驗收。
- 主機瀏覽器打不開 `feed` 就判失敗 → 名稱在專案網路內 → 從 `reader` 的日誌驗收。
