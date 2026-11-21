---
id: fd-docker-01
module: fd-docker
order: 1
title: 映像與容器
subtitle: 重開後不必重裝服務
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - "從 Docker 版本資訊分辨用戶端與引擎"
  - "用同一映像建立容器並重啟同一個容器"
  - "說明映像標籤與容器可寫層的差別"
tags:
  - "Docker Desktop"
  - "映像"
  - "容器"
  - "docker run"
resources:
  - title: "Install Docker Desktop on Windows"
    url: "https://docs.docker.com/desktop/setup/install/windows-install/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 WSL 2 後端、系統需求及授權條件。"
  - title: "Running containers"
    url: "https://docs.docker.com/engine/containers/run/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看映像、執行參數與容器生命週期。"
  - title: "Python Docker Official Image"
    url: "https://hub.docker.com/_/python"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看受維護的 Python 標籤與 slim 變體。"
concepts:
  - id: fd-docker-01-image
    prompt: "映像和容器怎麼分？"
    answer: "映像是可重用的唯讀範本；容器是帶執行設定和可寫層的實例。"
    mcq:
      question: "跑兩次 docker run 使用同一映像，發生什麼？"
      options:
        - "必定重啟第一個容器"
        - "建立兩個容器實例"
        - "在映像加上兩份輸出"
        - "重新安裝 Docker Desktop"
      answer: 1
      explain: "run 會建立再啟動容器；不會把工作輸出寫回映像。"
  - id: fd-docker-01-lifecycle
    prompt: "為何 docker run … python --version 跑完後不在 docker ps 裡？"
    answer: "主程式執行完就退出；沒有自動移除的話，在 docker ps -a 仍可看到。"
    mcq:
      question: "一次性匯入工具完成並回 0，下列哪句正確？"
      options:
        - "不在 docker ps 就一定失敗"
        - "它一定已被刪除"
        - "它可處於已退出狀態，應查 ps -a"
        - "必須永遠運作才算完成"
      answer: 2
      explain: "ps 預設只看運作中的實例；一次性工作結束是預期。"
  - id: fd-docker-01-mutable-tag
    prompt: "為何不能把 python:3-slim 當成永遠相同的版本？"
    answer: "標籤可以更新；需要精確重現時應記映像摘要，而不只記可移動的標籤。"
    mcq:
      question: "想日後精確取得同一個映像版本，最可靠的記錄是？"
      options:
        - "容器的顯示名稱"
        - "啟動時刻"
        - "暫時 IP"
        - "映像摘要（digest）"
      answer: 3
      explain: "名稱、時刻和 IP 不識別映像內容；標籤也可能被更新。"
practice:
  - id: fd-docker-01-p1
    kind: hands-on
    title: "留下一個可重啟的 Python 工具容器紀錄"
    minutes: 10
    steps:
      - "跑正文並保存版本、兩次容器狀態與日誌到 python-probe-notes.txt。"
      - "標記兩次執行是否為同一容器識別碼；核對完才移除自己的停止容器。"
    checks:
      - "Server 可用；python --version 兩次同版，容器仍是相同 ID。"
      - "若 Desktop 無法使用，筆記區分已觀察的用戶端、未驗證的引擎與預期輸出。"
---

交接一支每日清洗工具時，不必讓每個人重灌同樣一組執行環境。你可以交出一份環境範本，讓下一個人啟動自己的實例。這堂用 1 個 Python 容器觀察建立、退出與重啟，先不碰複雜的服務。

## 先分清模板、實例與管理者

映像（image；大陸常稱鏡像）是一套可重用的唯讀範本；容器（container）是用它建立的實例，帶啟動設定與自己的可寫層（writable layer）。同一映像可以啟動多個實例，彼此的可寫層不會自動合在一起。比起重新安裝 Python，重啟既有容器是再跑同一份設定；刪掉容器再建立則是換一個實例，不能指望舊的可寫層跟著來。

Docker Desktop 是 Windows 上管理本機容器的應用；Docker 引擎（engine）執行容器，`docker` 命令列用戶端（client）向它提出請求。看到用戶端版本不表示引擎可用。這個模組使用 Desktop 的 WSL 2 後端與 Linux 容器。若還沒安裝，先看官方資源核對 Windows、WSL、虛擬化和組織授權條件，只在允許安裝的電腦上照指引做。開啟 Desktop 後用 PowerShell 的 `docker version` 確認 Client 與 Server 都有版本；若 Server 不通，先處理環境，不繼續貼命令。

## 讓同一個容器完成兩次

PowerShell 在 `C:\dev\conduit-lab` 的 `docker\images` 新目錄執行。整個實驗只需要一個輕量的 Python 工具容器，初次取官方映像需要網路。先用 `docker ps -a` 確認名稱沒有被使用；如已存在，選新名稱並替換整堂命令。

- `docker run --name 名稱 映像 命令` 建立並啟動新的實例。
- `docker ps` 只列運作中的容器；加 `-a` 包括已退出的實例。
- `docker start -a 名稱` 從相同設定重新啟動該容器，並接回輸出；`docker logs` 讀已留下的日誌。
- `docker rm 名稱` 移除已停止的實例，不會把它的可寫層收回映像。

```powershell
docker run --name python-probe python:3-slim python --version
docker ps -a --filter 'name=^/python-probe$'
docker start -a python-probe
docker ps -a --filter 'name=^/python-probe$'
docker logs python-probe
```

第一次和第二次應列出同一個容器識別碼（container ID），狀態都是 `Exited (0)`；日誌有兩次版本輸出。工具一印完就結束是預期結果。`3-slim` 是會移動的標籤（tag），所以不同日期取得的版本可以不同；需要精確重現時，要記映像摘要（digest），而不只是方便讀的標籤。記下本次狀態後，只移除自己剛建立的停止容器：

```powershell
docker rm python-probe
```

工具下回仍可由映像啟動，不必重新安裝執行環境。真正需要跨次保留的數據，例如每日成功清單，不放在容器可寫層當唯一副本；[〈磁碟區〉](#/lesson/fd-docker-03)會替它安排獨立位置。

## 哪些交接得走映像之外？
工具、預設執行命令與交付數據，是三件不同的事。假設新同事只要補跑某一天，你可以交接映像來源、執行命令和樣本輸入；核對兩人的工具版本是第一步。若同事還需要昨天的輸出，必須另給持久位置或檔案，不能以「都用了同一映像」推定看得到彼此的結果。

## 常見錯誤

- 有 Client 沒有 Server → 命令存在但尚未和引擎通訊 → 先確認 Desktop 已起來且使用 Linux 容器。
- `docker ps` 沒看到工具 → 它可能正常結束 → 用 `docker ps -a` 查退出狀態。
- 用第二次 `run` 認為會重啟同一份 → run 建立新實例 → 要重跑原設定用 `start`。
