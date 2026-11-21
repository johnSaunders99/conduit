---
id: fd-docker-03
module: fd-docker
order: 3
title: 磁碟區
subtitle: 重建容器後保留數據
status: ready
minutes: 30
level: 1
prereqs:
- fd-docker-02
objectives:
  - "分清容器可寫層、具名磁碟區和主機目錄掛載"
  - "更換容器後讀回相同的每日紀錄"
  - "用不掛載的對照驗證持久數據的來源"
tags:
  - "磁碟區"
  - "named volume"
  - "持久化"
  - "唯讀掛載"
resources:
  - title: "Volumes"
    url: "https://docs.docker.com/engine/storage/volumes/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看具名磁碟區生命週期與唯讀掛載。"
  - title: "Running containers"
    url: "https://docs.docker.com/engine/containers/run/"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看映像、執行參數與容器生命週期。"
concepts:
  - id: fd-docker-03-volume-lifetime
    prompt: "為什麼移除寫入容器後，下一個容器還能看到日報？"
    answer: "檔案寫在獨立的具名磁碟區；新容器掛回相同磁碟區與目標。"
    mcq:
      question: "只有容器被移除，沒有刪磁碟區。哪個通常留下？"
      options:
        - "原容器可寫層"
        - "原容器 ID"
        - "具名磁碟區裡的檔案"
        - "原容器開啟的網路連線"
      answer: 2
      explain: "磁碟區有自己的生命週期；容器本身的層、連線與 ID 不是跨容器的持久數據。"
  - id: fd-docker-03-source-target
    prompt: "src=order-ledger,dst=/ledger 各指哪一側？"
    answer: "src 是 Docker 管理的具名磁碟區，dst 是容器內工作程式看到的路徑。"
    mcq:
      question: "程式寫 /ledger/daily.csv，改掛到 /archive 後會怎樣？"
      options:
        - "Docker 會改寫程式路徑"
        - "程式的 /ledger 不會因此持久化"
        - "磁碟區名字改成 daily.csv"
        - "所有容器都自動讀到"
      answer: 1
      explain: "原程式路徑不隨掛載移動；必須掛回它實際使用的位置或改程式設定。"
  - id: fd-docker-03-backup
    prompt: "為什麼第二個容器讀到相同內容不等於已備份？"
    answer: "仍依賴同一個本機儲存；主機故障或誤刪該磁碟區仍可能遺失。"
    mcq:
      question: "要證明可從主機磁碟故障復原，哪項最有用？"
      options:
        - "把容器再 start 一次"
        - "將目錄改名"
        - "只記磁碟區識別碼"
        - "保有獨立副本並驗證還原"
      answer: 3
      explain: "更換容器只檢查生命週期分離，不檢查故障復原。"
practice:
  - id: fd-docker-03-p1
    kind: hands-on
    title: "驗證重建後仍讀到同一筆日報"
    minutes: 10
    steps:
      - "用全新名稱建磁碟區，依正文跑寫入、讀取與不掛載的對照。"
      - "存 daily-from-volume.csv，記下名稱、容器內位置與兩個結束碼。"
    checks:
      - "有掛載讀到 2 行且包含 2026-11-19,2；無掛載讀不到且回非零。"
      - "保留自己的樣本磁碟區供對照，也沒有把它宣稱為備份。"
---

日報工具換了 Python 版本，為什麼上次的完成紀錄不見了？若把報表放在容器自己的可寫層，刪除容器再建會把那一層留在舊生命週期裡。這堂把工具和日報分開保存，並做一個不掛載的對照。

## 替真正要留下的目錄選位置

磁碟區（volume；大陸常稱卷）由 Docker 管理。具名磁碟區（named volume）有一個穩定名稱，掛載（mount）後，程式在容器裡看到普通目錄。刪除容器不會順手刪除本堂的具名磁碟區。主機目錄掛載（bind mount）則把某條主機路徑直接帶進容器，適合本機已存在、需要用 Windows 編輯的樣本或設定。它依賴主機位置；換電腦需要重新交接路徑或檔案。兩者都不同於容器自己的可寫層。

- `docker volume create 名稱` 先建立一個具名磁碟區；`docker volume ls` 看它是否存在。
- `--mount type=volume,src=名稱,dst=/ledger` 指明來源與容器內目的。務必先查程式真正讀寫哪個目錄。
- 附上 `,readonly` 就是唯讀掛載（read-only mount），讓讀取端核對內容而不改它。
- 掛載會遮住容器在該位置原有的視圖。因此這堂把成果寫到專用新目錄 `/ledger`，不把整個系統路徑掛進去。

## 寫入端退出，讀取端是全新的

在 `C:\dev\conduit-lab` 的新 `docker\volumes` 目錄用 PowerShell。先以 `docker volume ls` 確認名稱未被使用，若重做換一個新名稱並同步替換。只用已取得的 Python 映像和虛構數據。`run --rm` 讓當次容器在完成後自動移除，不移除這次具名磁碟區。

```powershell
docker volume create order-ledger
docker run --rm --mount 'type=volume,src=order-ledger,dst=/ledger' python:3-slim sh -c 'echo day,rows > /ledger/daily.csv && echo 2026-11-19,2 >> /ledger/daily.csv && wc -l /ledger/daily.csv'
docker run --rm --mount 'type=volume,src=order-ledger,dst=/ledger,readonly' python:3-slim cat /ledger/daily.csv | Tee-Object daily-from-volume.csv
$LASTEXITCODE
docker run --rm python:3-slim cat /ledger/daily.csv
$LASTEXITCODE
```

寫入端應數到 2 行；新的讀取端仍印出表頭和 `2026-11-19,2`，結束碼為 0。最後一個容器仍使用相同映像，卻沒有掛載，應缺檔並回非零。這條對照把「內容來自映像」與「內容來自磁碟區」分開。你保留的是一個小樣本和 Windows 上的驗收副本，不是正式的持久化方案：磁碟區仍在這台電腦上，工作需要獨立備份時應有還原演練。

## 判斷保存位置，看誰需要控制它
假設同事只要用 Windows 編輯輸入設定，主機目錄掛載比較直覺，程式看到的就是你明示交給它的目錄；盡量只掛練習所需的位置。若是數據庫的工作目錄，應先查該映像要把重要數據寫在哪裡，不能拿執行檔所在的路徑來猜。這次用 `/ledger` 是我們自己控制寫入規則，不是每種工具都用這個路徑。

換一個容器前，留原紀錄的行數與範例值；換好再讀。同樣檔名不是足夠證據，空檔或其他批次也可能同名。

已停的容器下次重啟也許還有可寫層，但那不是跨容器測試；一定要讓讀取端是新實例。

## 常見錯誤

- 新容器還在讀空目錄 → 可能掛到錯路徑 → 對照程式實際用的 `/ledger` 與卷名。
- 改新名稱後讀不到舊數據 → 建的是另一個磁碟區 → 先查原名，不把空磁碟區誤當成數據已被刪除。
- 對照做完就清所有磁碟區 → 可能碰到其他工作 → 保留這個小樣本，不用全機清理命令。
