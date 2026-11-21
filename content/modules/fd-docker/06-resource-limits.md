---
id: fd-docker-06
module: fd-docker
order: 6
title: 資源上限與停止
subtitle: 驗收後把記憶體還給電腦
status: ready
minutes: 30
level: 1
prereqs:
- fd-docker-05
objectives:
  - "設定並查核一個練習容器的 CPU 與記憶體上限"
  - "解釋整體容器上限為何不同於 JVM 堆上限"
  - "只停止並移除自己建立的實例"
tags:
  - "Docker stats"
  - "記憶體上限"
  - "CPU 配額"
  - "docker stop"
resources:
  - title: "Resource constraints"
    url: "https://docs.docker.com/engine/containers/resource_constraints/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 --memory、--memory-swap 與 --cpus。"
  - title: "docker compose down"
    url: "https://docs.docker.com/reference/cli/docker/compose/down/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看預設移除範圍與磁碟區選項。"
concepts:
  - id: fd-docker-06-cpu
    prompt: "--cpus 0.50 是固定半個核心嗎？"
    answer: "它限制可用的 CPU 時間，約為 0.5 個邏輯核心的容量，不綁定一個特定核心。"
    mcq:
      question: "stats 顯示接近 0%，和 --cpus 0.50 矛盾嗎？"
      options:
        - "矛盾，配額就是實際用量"
        - "不矛盾，上限不保證會用滿"
        - "矛盾，等於保留了半顆實體 CPU"
        - "不矛盾，但代表限制自動取消"
      answer: 1
      explain: "配額控制可用上限；程式在等候時實際 CPU 可能遠低於它。"
  - id: fd-docker-06-headroom
    prompt: "為何不把 Java 的 Xmx 設成容器記憶體上限？"
    answer: "行程還要用堆外記憶體；容器需容納全部相關用量，而非只有 JVM 堆。"
    mcq:
      question: "容器上限 512 MiB，哪種做法較合理？"
      options:
        - "直接給堆 512 MiB，不用留空間"
        - "關掉所有驗證"
        - "量整體用量，替堆外與容器開銷保留餘量"
        - "只看今早一次 stats 就設定全環境"
      answer: 2
      explain: "容器與 JVM 是不同邊界；需要基於實際負載保留餘量。"
  - id: fd-docker-06-stop-vs-remove
    prompt: "Docker stop、rm 與 Compose down 有什麼不同？"
    answer: "stop 結束執行但保留容器；rm 移除停止的實例；down 收掉本專案的容器與預設網路，預設不刪磁碟區。"
    mcq:
      question: "只想釋放執行中的資源並保留原容器可再啟動，選哪項？"
      options:
        - "docker stop 指定名稱"
        - "docker rm 指定名稱"
        - "docker compose down -v"
        - "全機清理"
      answer: 0
      explain: "stop 保留容器身分與設定；後幾種可能移除容器或儲存。"
practice:
  - id: fd-docker-06-p1
    kind: hands-on
    title: "保存停止前後的資源收據"
    minutes: 10
    steps:
      - "在新目錄啟動一個有上限的睡眠容器，保存 inspect 與 stats 輸出。"
      - "用 stop 確認退出，再 rm 自己的容器，比對兩次清單。"
    checks:
      - "上限為 128 MiB 與 0.50 CPU；睡眠時的即時用量不必接近上限。"
      - "停止後容器仍可列出，移除後用相同名稱過濾沒有實例；未移除任何磁碟區。"
---

在自己的電腦做數據實驗，不該讓局部測試拖慢整台機器。容器很輕不代表永遠使用很少的資源；要能為它設上限，驗收後也要能只收掉這次的工作。本堂的容器只有一個有時間上限的等待程式，不用真的製造記憶體不足。

## 可用額度不是目前用量

- `--memory 128m` 是容器的記憶體硬上限，128 MiB。接近上限要看實際負載與引擎證據，不能只根據一次樣本判斷該加多少。
- `--memory-swap 128m` 與記憶體額度設同值，在支援限制的環境代表不容許該容器額外使用交換空間。這不是把 Windows 的交換功能關掉。
- `--cpus 0.50` 是 CPU 時間配額（CPU quota），約 0.5 個邏輯核心的算力上限；不綁定某顆核心，也不是保留半個核心。
- `docker inspect` 查設定，`docker stats --no-stream` 查此刻使用情形。若看到記憶體不大但用量增加很快，先檢查工作是否在累積尚未交付的數據。設上限不會替應用處理積壓。

如果跑 JVM，堆積上限與容器上限是兩層：堆之外還有堆疊、原生空間和直接緩衝。先量整體工作，再替堆外留出餘量；不要拿本堂的 128 MiB 直接套到 Spark 或 Flink。

## 限制一個只會等待的容器

在 `C:\dev\conduit-lab` 的 `docker\limits` 新目錄用 PowerShell，先看 `docker ps -a`，若下方名稱已用過，就換未使用的名稱並同步使用。Python 最多等 180 秒自動退出；`--init` 讓小型初始行程轉送停止訊號。第一行成功才繼續查。

```powershell
docker run -d --init --name budget-probe --memory 128m --memory-swap 128m --cpus 0.50 python:3-slim python -c 'import time; time.sleep(180)'
docker inspect --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.NanoCpus}}' budget-probe | Tee-Object limits.txt
docker stats --no-stream budget-probe | Tee-Object live-usage.txt
```

設定應是 `134217728 134217728 500000000`：前兩個是位元組，後者的 10 億單位等於 1 顆 CPU。即時用量只是快照，不必等於上限。我們只停自己的容器；`stop` 嘗試要求主行程結束，逾時後才強制終止。退出不等於報表已存，所以先確定輸出已保存再停。

```powershell
docker stop budget-probe
docker ps -a --filter 'name=^/budget-probe$'
docker rm budget-probe
docker ps -a --filter 'name=^/budget-probe$'
```

第一張清單還看得到已停止的容器，且不再有執行中的負載；第二張沒有那個實例。如果是[〈Compose 服務〉](#/lesson/fd-docker-05)的整組環境，用相同專案名與設定目錄執行 `down`；預設不加 `-v`，以免把專案管理的磁碟區也移除。映像與練習記錄仍可保留供下次使用。

## 收工後還會留下什麼
停止釋放的是執行中的容器負載，不表示立刻回收 Windows 上整個 Docker Desktop 的基礎用量。已停止容器的可寫層也還在；移除容器才丟掉這部分。驗收時只查被你指定的實例和同名的清單，不拿 Windows 記憶體下降多少當作唯一證據。若實驗還有日報或磁碟區，先確認要保留的是哪一份，再決定是否需要另外匯出。

停止和移除之前的兩張清單，也是在交接時可以保存的復原線索。

## 常見錯誤

- CPU 很低就以為額度沒生效 → 用量不等於上限 → 用 inspect 驗證設定。
- 把兩份記憶體欄相加，以為有 256 MiB → 相等表示沒有額外 swap → 查看兩者關係。
- 想停一個實驗卻使用全機清理 → 影響範圍錯了 → 只指定本次名稱或 Compose 專案。
