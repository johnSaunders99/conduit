---
id: fd-docker-02
module: fd-docker
order: 2
title: 連接埠對映
subtitle: 從 Windows 找到容器
status: ready
minutes: 30
level: 1
prereqs:
- fd-docker-01
objectives:
  - "把主機位址、主機埠和容器埠讀成連線路徑"
  - "只在本機發布一個假訂單服務"
  - "通過實際回應核對埠的左右角色"
tags:
  - "連接埠對映"
  - "localhost"
  - "docker port"
  - "監聽"
resources:
  - title: "Port publishing and mapping"
    url: "https://docs.docker.com/engine/network/port-publishing/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 HOST_IP、HOST_PORT 與容器埠的方向。"
  - title: "Running containers"
    url: "https://docs.docker.com/engine/containers/run/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看映像、執行參數與容器生命週期。"
concepts:
  - id: fd-docker-02-direction
    prompt: "127.0.0.1:18080:8000 的左右端代表什麼？"
    answer: "Windows 本機在 127.0.0.1:18080 接連線，轉到容器的 8000 埠。"
    mcq:
      question: "容器內仍監聽 8000，但 Windows 的 18080 已被使用。哪個改法合適？"
      options:
        - "只改右邊成 18081"
        - "改成 127.0.0.1:18081:8000"
        - "改成 127.0.0.1:8000:18080"
        - "只改 URL 路徑"
      answer: 1
      explain: "保留服務真正監聽的右側，改左邊的主機入口。"
  - id: fd-docker-02-loopback-scope
    prompt: "為何練習明確寫主機位址 127.0.0.1？"
    answer: "只需要本機測試，不用把主機其他網路介面的入口開給外面。"
    mcq:
      question: "若主機位址省略，會與只綁本機完全一樣嗎？"
      options:
        - "是，永遠只走回送"
        - "不是，預設可能對其他介面發布"
        - "是，只要容器內用 8000"
        - "是，瀏覽器會自動限制對外"
      answer: 1
      explain: "發布範圍由主機綁定位址決定，不由瀏覽器或右側埠決定。"
  - id: fd-docker-02-mapping-vs-listen
    prompt: "已看到 docker port 的對映，能否保證回得出 CSV？"
    answer: "不能；對映說明去向，容器內的伺服器仍要在正確介面和埠監聽且有該檔。"
    mcq:
      question: "可直接證明整條路有交付預期內容的是哪項？"
      options:
        - "只看 docker port"
        - "只看到容器名"
        - "從 Windows 下載該 CSV 並核對行"
        - "查映像標籤"
      answer: 2
      explain: "只有實際讀取與比對跨過了主機入口、監聽與應用內容。"
practice:
  - id: fd-docker-02-p1
    kind: hands-on
    title: "從 Windows 取回兩行訂單"
    minutes: 10
    steps:
      - "只在本機發布正文的樣本，保存 delivered.csv 與 docker port 顯示的對映。"
      - "收掉自己的容器，再用未使用的主機埠重做並更新 URL。"
    checks:
      - "CSV 有表頭與 o501,paid；只改主機埠時，容器仍是 8000。"
      - "不停止其他服務；最後只清除自己建立的容器。"
---

服務已在容器裡醒了，Windows 的清洗工具卻拿不到訂單。兩邊各有自己的網路範圍，不能只用一個埠號猜對方會到哪裡。這堂建立一條只供自己電腦使用的入口，下載兩行假訂單核對。

## 「從哪裡進」和「送到哪裡」分開讀

發布連接埠（port publishing）把主機的一個入口指向容器的埠；這是連接埠對映（port mapping）。Docker 用 `-p 主機位址:主機埠:容器埠` 設定。`127.0.0.1:18080:8000` 表示 Windows 送到本機的 `18080`，Docker 再轉到容器的 `8000`。右邊不是瀏覽器應該輸入的埠，而是程式在容器內實際監聽的埠。只為 Windows 自己測試，左邊明寫 `127.0.0.1`，不發布到其他介面；使用目前的 Docker Desktop，舊版 Engine 的 localhost 發布有官方文件列出的網路限制差異。

- `-p 127.0.0.1:18080:8000` 設主機入口；`docker port 名稱` 查已設定的對映。
- 容器內的伺服器用 `--bind 0.0.0.0` 接容器介面。如果它只聽容器自己的 `127.0.0.1`，主機發布的路通常送不到那裡。
- 只在映像說明寫 `EXPOSE` 不會自動建立 Windows 主機入口；反過來 `-p` 也不會替你啟動伺服器。

## 驗證入口真的送到訂單檔

先有[〈映像與容器〉](#/lesson/fd-docker-01)的引擎與映像。在 `C:\dev\conduit-lab` 用 PowerShell 進新建的 `docker\ports`。確認容器名未使用。命令內的 `sh -c` 讓容器自己建立只包含樣本的目錄，HTTP 伺服器不會供應你的 Windows 練習區。這是一個輕量單容器，沒有數據庫。

```powershell
docker run -d --name orders-feed -p 127.0.0.1:18080:8000 python:3-slim sh -c 'mkdir /tmp/orders && echo order_id,status > /tmp/orders/orders.csv && echo o501,paid >> /tmp/orders/orders.csv && exec python -m http.server 8000 --bind 0.0.0.0 --directory /tmp/orders'
docker port orders-feed
curl.exe --fail --max-time 5 -sS -o delivered.csv http://127.0.0.1:18080/orders.csv
if ($LASTEXITCODE -eq 0) { Get-Content delivered.csv }
```

預期對映含 `8000/tcp -> 127.0.0.1:18080`，檔案有表頭和 `o501,paid`。剛啟動可能尚未準備好；若第一次讀失敗，先查 `docker logs orders-feed`、容器狀態和監聽，再重試，不拿先前殘留的同名檔驗收。假如主機 18080 被使用，只改左側成未用過的 18081，並用新埠組 URL；不更動別人的服務。收尾只針對自己這個名字：

```powershell
docker stop orders-feed
docker rm orders-feed
```

## 把故障切在正確的地方
連線被拒時，先用 `docker ps -a` 看容器是否還活著，再查對映和服務聽到哪一個埠。若收到 HTTP 404，則至少有應用回了訊息，下一步應確認要求的檔名，而不是先換主機埠。若已取得兩行，但是最後一列不是本堂的訂單編號，也先別說成功；可能正在讀另一個練習，或讀到前次留在磁碟上的輸出。這就是為何要同時記下對映、HTTP 結果與實際內容。

交接時把兩條地址分行記下：Windows 呼叫端使用主機的回送位址與左側埠；容器內服務聽容器介面與右側埠。只要一方換埠，你就知道另有哪些設定和驗收網址要一起改。後續如果呼叫端也進了容器，別沿用這條 Windows 入口；容器間的直接路徑在[〈容器網路〉](#/lesson/fd-docker-04)會分開做。

若要改用瀏覽器檢查，仍只打這裡的本機網址，並同時比對訂單這一列。

## 常見錯誤

- 對映左側和網址埠不同 → 問錯了入口 → 用 `docker port` 記下 Windows 那一側。
- 主機埠被占用就把右側也改掉 → 服務仍聽原來的埠 → 只改左側。
- 看到對映就算成功 → 應用可能未就緒或路徑錯 → 用實際回應內容驗收。
