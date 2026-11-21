---
id: fd-system-05
module: fd-system
order: 5
title: DNS 與連接埠
subtitle: 名稱正確仍然連不到
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-04
objectives:
  - "從網址分出主機名、連接埠和路徑"
  - "分開取得名稱解析與 TCP 監聽的證據"
  - "在本機對照已連通與未連通的兩種入口"
tags:
  - "DNS"
  - "TCP"
  - "連接埠"
  - "localhost"
resources:
  - title: "Resolve-DnsName"
    url: "https://learn.microsoft.com/en-us/powershell/module/dnsclient/resolve-dnsname"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看名稱查詢、記錄種類與 DnsOnly。"
  - title: "socket — Low-level networking interface"
    url: "https://docs.python.org/3/library/socket.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 bind、listen、connect 與逾時。"
concepts:
  - id: fd-system-05-dns
    prompt: "DNS 查到 IP 位址，為什麼還不能說服務可用？"
    answer: "它只提供名稱解析結果；指定的傳輸協定、連接埠和應用還要分開查。"
    mcq:
      question: "Resolve-DnsName 成功，但 TCP 入口沒人監聽。下列哪個說法正確？"
      options:
        - "DNS 已經證明服務正常"
        - "名稱可解析，但服務仍可能連不上"
        - "必須先改 URL 路徑才會監聽"
        - "一定是密碼錯誤"
      answer: 1
      explain: "解析不是連線；路徑與密碼都還沒有走到應用程式。"
  - id: fd-system-05-listen
    prompt: "連接埠在本例扮演什麼角色？"
    answer: "與位址及傳輸協定一起指定主機上要接哪個服務入口，服務仍須監聽。"
    mcq:
      question: "同一台機器 A 埠可連，B 埠被拒，證據最直接支持什麼？"
      options:
        - "DNS 只會解析 A 埠"
        - "B 埠的密碼可能錯"
        - "A 與 B 是不同的監聽入口"
        - "兩個埠會自動轉送"
      answer: 2
      explain: "連接埠是獨立入口；DNS 的位址記錄不等同於對每個埠的承諾。"
  - id: fd-system-05-loopback
    prompt: "127.0.0.1 從哪裡看？"
    answer: "是呼叫端自己的 IPv4 回送位址，不是別台主機，也不必等同於之後的容器外部。"
    mcq:
      question: "服務只綁 127.0.0.1，另一台電腦直接連你的區網位址能依此接到嗎？"
      options:
        - "會，所有機器共用 127.0.0.1"
        - "不會，該監聽綁在自己的回送介面"
        - "會，只要知道路徑"
        - "會，因為只需解析 DNS"
      answer: 1
      explain: "回送只在自身的網路範圍內，URL 路徑也不能改變監聽介面。"
practice:
  - id: fd-system-05-p1
    kind: hands-on
    title: "完成一張由名稱到 TCP 的排查單"
    minutes: 10
    steps:
      - "有網路時查 example.com 的 A 記錄，沒有則註明略過外部名稱。"
      - "在新 system\\endpoint 資料夾跑本機程式，把 listening 與 bound_only 兩行存進 endpoints.txt。"
    checks:
      - "第一行是 connected，第二行是連線錯誤的類別；兩行各有位址與實際埠號。"
      - "筆記把 DNS 解析、TCP 連通與應用成功分成三格。"
---

訂單匯入程式讀不到供應端。網域拼對、也查得到位址，仍可能在下一站停下來。這堂把「名稱查到」、「服務接到連線」拆成兩個證據，不需要碰任何真實服務的設定。

## 先找位址，再找入口

網址（URL）常見形狀是 `協定://主機名:連接埠/路徑`。主機名幫你找主機，路徑是交給應用的請求目標，不拿來查位址。網域名稱系統（Domain Name System，DNS）可查名稱的位址記錄，如 `A` 是 IPv4、`AAAA` 是 IPv6。名稱可能對到不只一個位址，同個名稱日後也可能換位置。

傳輸控制協定（Transmission Control Protocol，TCP）建立連線，提供有序的位元組流。位址（address）找網路上的介面，連接埠（port；大陸常稱端口）是在該位址及傳輸協定之下的入口。伺服器先綁定（bind）位址與埠，對 TCP 還要開始監聽（listen）；呼叫端才可嘗試連線。IPv4 的 `127.0.0.1` 是回送位址（loopback），只回到呼叫端本身。下一堂[〈HTTP 與 TLS〉](#/lesson/fd-system-06)才會在連通之後看應用層。

- 有網路時，在 Windows PowerShell 跑 `Resolve-DnsName example.com -Type A -DnsOnly`，只記是否有 A 記錄，不把當下位址寫死。這一步不接觸該主機的應用。
- 連線被拒一般表示到達某個能拒絕連線的端點；逾時則可能涉及路由、防火牆或對方未回應。不同的症狀需要不同的下一個檢查，不能都概括成 DNS 壞掉。

## 在同一台機器看兩種入口

在 `C:\dev\conduit-lab\system\endpoint` 存 `endpoint.py`。`socket` 是通訊端（socket；大陸常稱套接字），用來進行這次 TCP 通訊。埠寫 `0` 是請系統分配空閒埠；實際埠號從 `getsockname()` 讀回。兩個入口都只使用本機回送。第一個開始監聽；第二個故意只綁定，不對外接連線。

```python
import socket

host = "127.0.0.1"
for label in ("listening", "bound_only"):
    with socket.socket() as service:
        service.bind((host, 0))
        if label == "listening":
            service.listen(1)
        endpoint = service.getsockname()
        with socket.socket() as client:
            client.settimeout(1)
            try:
                client.connect(endpoint)
            except OSError as error:
                result = type(error).__name__
            else:
                result = "connected"
            print(f"{label}={endpoint[0]}:{endpoint[1]} result={result}")
```

在這個目錄用 PowerShell 跑：

```powershell
py endpoint.py | Tee-Object endpoints.txt
```

預期 `listening` 是 `connected`，`bound_only` 顯示 `ConnectionRefusedError` 或其他連線錯誤；實際類別依環境而異。已知位址一樣仍得到不同結果，證據指向監聽而非名稱。連上第一個也不是接到報表；程式沒有實作 HTTP，只證明這個埠可以建立 TCP 連線。

## 寫交接單時標出呼叫端
別只寫「某個服務的某個埠連不上」。補上「哪台機器或哪個環境發起、解析到哪個位址、要接哪個 TCP 埠、這次是拒絕還是逾時」。當本機測得通而另一個環境失敗，先確認兩個呼叫端是不是指到相同的位址和埠，再比對路由或介面綁定。否則即使輸入的名稱一樣，也可能測的是兩條完全不同的路。

同理，能測通一個埠不代表其餘埠也通；即使服務與測試程式都在同一台電腦，連接埠的角色仍然不一樣。

例如 Windows 原本可直接讀本機檔，搬到容器後如果仍呼叫同一個回送位址，指到的就不再是 Windows；在[〈容器網路〉](#/lesson/fd-docker-04)會直接驗證這一點。

## 常見錯誤

- DNS 查到位址就說服務能收數據 → 少了 TCP 和應用步驟 → 分層保留結果。
- 改 URL 路徑治連線被拒 → 尚未接到應用 → 先比對位址和監聽埠。
- 在另一個環境仍用 `127.0.0.1` → 回到了錯的地方 → 先說清請求是從哪裡發出。
