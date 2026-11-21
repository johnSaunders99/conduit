---
id: fd-system-06
module: fd-system
order: 6
title: HTTP 與 TLS
subtitle: 分開連線時間與服務時間
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-05
objectives:
  - "辨認 TCP、TLS 和 HTTP 各階段解決的問題"
  - "用 curl 的累積時間拆出幾段耗時"
  - "區分 HTTP 非成功狀態與連線或憑證失敗"
tags:
  - "HTTP"
  - "TLS"
  - "HTTPS"
  - "首位元組"
  - "curl"
resources:
  - title: "RFC 9110: HTTP Semantics"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看請求、回應與 HTTP 狀態類別。"
  - title: "RFC 8446: The Transport Layer Security Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc8446.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看協定目標與交握流程。"
  - title: "curl manual: --write-out"
    url: "https://curl.se/docs/manpage.html#-w"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "找各項 time 欄位的起算及終點。"
concepts:
  - id: fd-system-06-tls
    prompt: "TLS 憑證校驗與 HTTP API 登入有何不同？"
    answer: "TLS 驗證連到的伺服器身分並保護通道；API 登入判斷這個呼叫者可否使用資源。"
    mcq:
      question: "HTTPS 成功建立且回 HTTP 401，表示什麼？"
      options:
        - "一定是 DNS 沒查到"
        - "TLS 一定未完成"
        - "有 HTTP 回應，接下來查應用驗證"
        - "應關閉憑證檢查才可比較時間"
      answer: 2
      explain: "401 是應用層回覆；不能拿停用憑證檢查處理應用登入。"
  - id: fd-system-06-time-delta
    prompt: "怎麼從兩個累積時刻估算這次 TLS 建立的增量？"
    answer: "直連的新 HTTPS 請求中，用 time_appconnect 減 time_connect，並記住代理等中介會影響解讀。"
    mcq:
      question: "TCP 完成於 0.10 秒，TLS 完成於 0.30 秒，增量是多少？"
      options:
        - "0.10 秒"
        - "0.20 秒"
        - "0.30 秒"
        - "0.40 秒"
      answer: 1
      explain: "兩個欄位是自請求起點起算，應相減而非直接讀或相加。"
    interview:
      question: "匯入突然要等一秒才開始收到回應，你會先量什麼？"
      answer: "我先固定同一個網址和呼叫環境，保留 HTTP 狀態和客戶端各階段時間。若 TCP 和 TLS 都正常、首位元組才變慢，我會拿對得上的時間窗請服務端查排隊或處理；不會直接把差值都算成服務端耗時。"
      points:
        - "固定呼叫條件並保存狀態"
        - "分解累積時間，定位變慢的區間"
        - "拿時間窗比對服務端證據"
  - id: fd-system-06-ttfb
    prompt: "首位元組減去 TLS 完成時刻，是純伺服器處理時間嗎？"
    answer: "不是；還有傳送請求、往返、代理或排隊。若要拆純處理時間，需要伺服器端量測。"
    mcq:
      question: "要證實 600 毫秒都花在服務端程式，最該補什麼？"
      options:
        - "只再量一次 DNS"
        - "curl 的總時間除以二"
        - "本機 CPU 溫度"
        - "服務端的處理日誌或追蹤"
      answer: 3
      explain: "客戶端時間無法扣除全部網路與中介開銷；還需服務端證據。"
practice:
  - id: fd-system-06-p1
    kind: hands-on
    title: "保留一份 HTTPS 耗時交接卡"
    minutes: 10
    steps:
      - "有網路就保存正文 curl 輸出；不能連網則用正文樣本標成紙上判讀。"
      - "計算 TCP、TLS 與首位元組前剩餘時間，用一句話說明各自不代表什麼。"
    checks:
      - "樣本的 TCP、TLS、TLS 後到首位元組分別是 0.08、0.20、0.52 秒。"
      - "筆記同時留 HTTP 狀態，不把失敗連線的零值當免費階段。"
---

供應方的 HTTPS 檔案要等 1 秒才開始回。如果一股腦說「對方算了 1 秒」，可能完全找錯地方。這堂保存一份分段時間：先問在哪一段變慢，再決定要查自己的連線還是請對端補量測。

## 一個請求經過哪幾層？

超文本傳輸協定（Hypertext Transfer Protocol，HTTP）定義請求的方法、標頭、內容以及回應狀態。練習用 `GET` 讀取資源。常見回應有 `200` 成功、`401` 缺有效驗證、`404` 找不到資源、`503` 服務目前無法處理。傳輸層安全性（Transport Layer Security，TLS）在這次的 TCP 上建立加密、完整性與伺服器身分驗證；HTTPS 就是受 TLS 保護的 HTTP。用憑證核對主機名與可信鏈，不等於替 API 呼叫者驗證帳號。憑證有誤應查時鐘、主機名或信任鏈，不關閉校驗。

本課選一次新的 HTTP/1.1 請求，不跟隨重新導向。curl 的時間是從同一起點起算的秒數，不是每段各自歸零：

- `time_namelookup`：名稱查找完成；`time_connect`：TCP 連到對端或代理。直連時兩者相減可估 TCP 階段。
- `time_appconnect`：TLS 交握（handshake）完成；減去 `time_connect` 得到交握階段的近似值。
- `time_starttransfer`：收到首位元組，與前一時刻的差包含請求送出、往返、排隊和處理；不是純服務端時間。`time_total` 到傳輸完成為止。

## 保存一次量測，不下載報表內容

在 `C:\dev\conduit-lab` 的新 `system\https` 目錄，用 PowerShell 明確呼叫 Windows 的 `curl.exe`，避免呼叫到同名別名。只請求公開教學頁，不附帳號或憑證資料；`NUL` 丟棄回應本文。

```powershell
curl.exe --http1.1 --max-time 15 -sS -o NUL -w 'http=%{http_code} dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} first=%{time_starttransfer} total=%{time_total}\n' https://example.com/ | Tee-Object https-timing.txt
$LASTEXITCODE
```

若機器沒有網路，或代理、憑證或站點阻擋，記錄真實錯誤；改用下面的**紙上樣本**，不期待實測數字跟它一樣。使用代理時，TCP 時間可能是在連代理；不要照直連的方式推斷對面服務耗時。

```text
http=200 dns=0.02 tcp=0.10 tls=0.30 first=0.82 total=1.00
```

TCP 增量 `0.10 − 0.02` 為 0.08 秒，TLS 增量 0.20 秒；TLS 完成到收到首位元組 0.52 秒。最後一段可以促使你請服務端提供處理日誌，卻不能憑這兩個時刻說 0.52 秒全在應用內。另存這些差值和狀態，即可讓下一個人比較總時間相同、瓶頸卻不同的案例。

## 用同樣條件比較兩次
若這次是首次連線、下一次卻沿用一條已開啟的連線，DNS 和交握就不一定各走一次。對比不同時段時，先交代是否每次都由新命令啟動、是否同站同路徑、是否同樣走代理。也保留 HTTP 狀態與結束碼；快速收到 503 和順利下載不是同一件事。

可以先找最有區別力的下一個檢查：若從建立連線開始就高，請同事用相同地點與網路條件重測；若連線階段穩定但首位元組等很久，優先向服務端要一次可對照的時間窗，而不是先更換報表格式。

下一次把 HTTP 狀態與耗時放在同一行，別只保存總秒數。

## 常見錯誤

- 記 `tls=0.30` 就說 TLS 單獨用了 0.30 秒 → 時刻是累積值 → 減前一個時刻。
- 回傳 HTTP 404 就說 TCP 不通 → 應用已經發回狀態 → 查路徑與資源。
- 出現 HTTP 000 仍做正常耗時比較 → 未收到 HTTP 狀態 → 先看錯誤與結束碼，零值可能代表該段沒完成。
