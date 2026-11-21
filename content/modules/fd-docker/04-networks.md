---
id: fd-docker-04
module: fd-docker
order: 4
title: 容器網路
subtitle: 不要把另一台服務叫作本機
status: ready
minutes: 30
level: 1
prereqs:
- fd-docker-03
objectives:
  - "從發出請求的容器判斷 localhost 指誰"
  - "讓兩個容器在自訂橋接網路用名稱傳送樣本"
  - "用無發布埠仍取到數據的證據驗收"
tags:
  - "橋接網路"
  - "容器名稱"
  - "DNS"
  - "localhost"
resources:
  - title: "Bridge network driver"
    url: "https://docs.docker.com/engine/network/drivers/bridge/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看自訂橋接網路的名稱解析與隔離。"
  - title: "Networking in Compose"
    url: "https://docs.docker.com/compose/how-tos/networking/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看服務名如何保持穩定，以及應使用哪個埠。"
concepts:
  - id: fd-docker-04-origin
    prompt: "在讀取容器用 localhost 會接到哪裡？"
    answer: "接到讀取容器自己；不是報表服務容器，也不是 Windows 主機。"
    mcq:
      question: "讀取端與 reports-feed 服務在同一自訂網路，服務聽 8000，讀取端應用哪個網址？"
      options:
        - "http://localhost:8000/orders.csv"
        - "http://127.0.0.1:18080/orders.csv"
        - "http://reports-feed:8000/orders.csv"
        - "http://reports-feed:18080/orders.csv"
      answer: 2
      explain: "透過共同網路查服務名，用服務的容器埠；18080 是前一堂的主機入口。"
  - id: fd-docker-04-name
    prompt: "為何流程應記名稱而非一次查到的 IP？"
    answer: "重建容器可能換 IP；同一自訂網路能解析重新登記的名稱。"
    mcq:
      question: "重建後 IP 變了，雙方仍在同一網路，且名稱一致。要先改什麼定位？"
      options:
        - "程式應繼續用名稱，不更新寫死的舊 IP"
        - "改成 Windows 的回送"
        - "多發布一個埠"
        - "把連接埠設為 0"
      answer: 0
      explain: "名稱提供穩定稱呼；若仍失敗，再查是否已就緒或是否用對目的埠。"
  - id: fd-docker-04-no-publish
    prompt: "兩個容器互通一定要寫 -p 嗎？"
    answer: "不一定；在同一自訂橋接網路，呼叫端可直接連服務埠。"
    mcq:
      question: "docker port reports-feed 沒有對映，但讀取端拿到了 CSV，為什麼？"
      options:
        - "讀取端只是讀本機舊快取"
        - "Docker 忽略了 URL"
        - "容器經共享網路直接互通，不必走主機入口"
        - "容器的所有埠預設對 Windows 開放"
      answer: 2
      explain: "連接埠清單只列主機發布；互通由網路與服務監聽決定。"
practice:
  - id: fd-docker-04-p1
    kind: hands-on
    title: "畫一條不繞 Windows 的報表路徑"
    minutes: 10
    steps:
      - "在 docker\\network 執行正文，保留 fetched.txt 與網路名稱。"
      - "寫下誰發起請求、對方名稱與埠、docker port 為何無輸出。"
      - "停掉並移除自己的服務，再移除自建的空網路。"
    checks:
      - "fetched.txt 有 o601,paid；沒有使用主機發布。"
      - "記錄 localhost 從哪一端看，不把容器 IP 當成永久資訊。"
---

把讀取器也搬進容器後，昨天能用的 `localhost` 突然找不到報表。不是要再多開一個主機埠；你已換了發出請求的位置。本堂讓兩個使用同一映像的輕量容器在同一網路裡對話，Windows 不當中繼。

## 名稱只在對的網路裡有意義

自訂橋接網路（user-defined bridge network）把本機加入的容器接在同一虛擬網路。Docker 能在這個網路內將容器名稱或別名解析為目前的 IP 位址。在這堂，`reports-feed` 是命令指定的容器名；下一堂[〈Compose 服務〉](#/lesson/fd-docker-05)則由 Compose 管理服務名稱。名稱是不變的入口約定，位址可能在重建時換掉，連接埠仍要填對。

- 從讀取容器看，`localhost` 就是讀取容器本身；伺服器健康檢查若在伺服器自己的容器內執行，才用自己的回送位址。
- 服務之間使用「對方名稱:容器埠」。主機的 `-p` 對映用於從主機來訪，不是容器之間互通的前提。
- `docker network create 名稱` 建網路，`docker run --network 名稱 …` 加入；`docker network inspect 名稱` 看現有成員。一次性容器退出後，清單不一定還有它。

## 從真正的讀取端拿檔

在 `C:\dev\conduit-lab` 新建 `docker\network`，用 PowerShell 進入。先以 `docker network ls`、`docker ps -a` 確認網路與容器名未用過；有衝突就一致換名。這次容器內的報表值和前一堂不同，收件時要讀實際內容，不靠命令的顏色。

```powershell
docker network create reports-net
docker run -d --name reports-feed --network reports-net python:3-slim sh -c 'mkdir /tmp/reports && echo order_id,status > /tmp/reports/orders.csv && echo o601,paid >> /tmp/reports/orders.csv && exec python -m http.server 8000 --bind 0.0.0.0 --directory /tmp/reports'
docker run --rm --network reports-net python:3-slim python -c 'import sys, urllib.request as u; print(u.urlopen(sys.argv[1], timeout=3).read().decode())' http://reports-feed:8000/orders.csv | Tee-Object fetched.txt
docker port reports-feed
```

讀取端的 Python 從 `sys.argv[1]` 取網址；預期印出表頭和 `o601,paid`。末行命令沒有發布記錄是預期結果。若剛開機還未監聽，查 `docker logs reports-feed` 後再試。將兩端名稱、共同網路和埠畫成一條線，就能交接哪裡需要改、哪裡不必改。在確認名稱都是本堂新建後收尾：

```powershell
docker stop reports-feed
docker rm reports-feed
docker network rm reports-net
```

## 當一條路徑失敗，先問是哪一段
如果讀取端說找不到名稱，先確認兩端加入的網路與名稱，不改報表格式。若名稱已解析，但服務不接連線，改查容器狀態、監聽介面和埠。若收到了狀態但不是要的數據，再查應用的路徑與內容。這和[〈DNS 與連接埠〉](#/lesson/fd-system-05)的分層判讀是同一件事，只是此處「從哪裡發問」格外重要。

這個練習不是說容器網路能替你驗證權限；同一網路內可找到彼此，也不代表應用應該接受每個請求。報表供應端只發布虛構數據，而且沒有把主機路徑放進去。真正部署時，要另外定義哪些工作應加入這張網路、能看見什麼。別把「Windows 開不了」誤以為內部也隔離了；本堂正是從內部成功讀到了報表。

這次用的報表不含帳號與權杖；不要把正式數據拿來當網路是否暢通的探針。

## 常見錯誤

- 容器內用上一堂 Windows 的 18080 → 選到主機入口的數字 → 改用這次的容器埠 8000。
- 名稱找不到就把服務對外發布 → 沒解決共同網路問題 → 先核對網路與名稱。
- 查到名字就算具備報表 → 名稱解析不檢查內容 → 實際取一次並核對樣本列。
