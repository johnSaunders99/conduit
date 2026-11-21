---
id: fd-io-03
module: fd-io
order: 3
title: HTTP 與 requests
subtitle: 辨認伺服器是否真的回答
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-02
objectives:
  - 對本機 HTTP 端點發送 GET 請求
  - 分辨 HTTP 狀態、網路例外與 JSON 內容
tags:
  - HTTP
  - GET
  - requests
  - 狀態碼
resources:
  - title: Requests 快速入門
    url: https://requests.readthedocs.io/en/latest/user/quickstart/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 GET、JSON、狀態碼及逾時。
  - title: Python：本機 HTTP 測試伺服器
    url: https://docs.python.org/3/library/http.server.html#command-line-interface
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 核對綁定位址與指定服務資料夾的方式。
concepts:
  - id: fd-io-03-http
    prompt: HTTP 狀態碼是誰回的？
    answer: 是回應方提供的結果代碼；網路未連上時可能根本沒有回應。
    mcq:
      question: 404 代表什麼可觀察現象？
      options:
        - Python 沒有安裝
        - 必定是逾時
        - 成功但訂單是空列表
        - 伺服器回應找不到指定資源
      answer: 3
      explain: 404 是實際收到的 HTTP 回應，與未連上不同。
  - id: fd-io-03-raise-status
    prompt: '`raise_for_status()` 檢查什麼？'
    answer: 會替 4xx／5xx 回應擲出 HTTPError，不驗證 JSON。
    mcq:
      question: HTTP 200 可以保證 JSON 結構嗎？
      options:
        - 不行，仍需解析並檢查必要欄位
        - 保證是物件但未必有欄位
        - 保證是列表
        - 只要是 GET 就能保證
      answer: 0
      explain: 狀態碼屬於傳輸結果，不是業務內容驗證。
  - id: fd-io-03-timeout
    prompt: 為何請求寫明 `timeout`？
    answer: 避免連線或讀取停滯時一直等待；不是整趟下載的總時間上限。
    mcq:
      question: 無法連到本機服務時應先核對什麼？
      options:
        - 直接把空數據當成功
        - 伺服器是否仍執行且 URL 的埠正確
        - 只改 JSON 欄名
        - 把逾時設成無限制
      answer: 1
      explain: 沒有回應時先處理連線，尚未到數據解析。
practice:
  - id: fd-io-03-p1
    kind: hands-on
    title: 保留成功與缺檔回應紀錄
    minutes: 8
    steps:
      - 依正文啟動伺服器，跑一次成功請求。
      - 把路徑改成不存在的 missing.json 再試，將兩次結果記在 http_notes.txt 後停止伺服器。
    checks:
      - 成功有 200 和訂單號；缺檔印 404 且不把回應當訂單。
      - 停止本機伺服器後，再跑應是請求失敗而非 404。
---

## 伺服器有回應，不代表拿到訂單

數據管道常從應用程式介面（application programming interface，API；大陸常稱應用程序編程接口）取數。本堂只連自己的電腦：一個測試伺服器送出訂單 JSON，客戶端發兩次請求，一次成功、一次查不存在的資源。辨別「沒有回應」「回了錯誤」「回應不是預期數據」，能避免把昨天的抓取失敗當成今天的零筆。

## 請求速查

HTTP（Hypertext Transfer Protocol）是一套請求與回應的約定。用 GET 讀資源；網址（URL）包括要連的位址、埠（port，像是同一台機器上指定服務的門牌）和路徑。`requests.get(url, timeout=3)` 送出請求並等回應；`response.status_code` 讀狀態碼，常見為 200 成功、404 找不到。先用 `response.raise_for_status()` 辨識 4xx、5xx，再用 `response.json()` 解析內容。

`timeout=3` 約束連線或讀取等待，不保證整趟請求在 3 秒內完成。網路離線時可能沒有任何狀態碼。`try` 區塊中某操作失敗時，匹配的 `except` 會接手；[〈例外與隔離〉](#/lesson/fd-io-07)會細講接住哪一類錯誤。

## 在自己的電腦練習

在 `C:\dev\conduit-lab\python-io` 的 `http-samples` 新資料夾只放 UTF-8 的 `one_order.json`：

```json
{"order_id":"O01","amount_cents":800}
```

第一個 PowerShell 視窗由 `python-io` 執行 `py -m http.server --bind 127.0.0.1 --directory http-samples 8765`。只服務合成樣本，不開整個工作區、不綁到其他網路介面。第二個視窗在 `python-io` 跑以下指令。`venv` 為這個練習隔離套件；在[〈虛擬環境〉](#/lesson/fd-tools-04)會細講。安裝套件需要網路；伺服器與請求只用本機。若 `.venv` 已按這堂課建好，可跳過建立與重裝。

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install requests
```

同一層存 `get_order.py`，用 `.\.venv\Scripts\python.exe get_order.py` 執行：

```python
import requests

url = "http://127.0.0.1:8765/one_order.json"
try:
    response = requests.get(url, timeout=3)
    print("status:", response.status_code)
    response.raise_for_status()
except requests.exceptions.RequestException as error:
    print("request failed:", error)
else:
    try:
        order = response.json()
        order_id = order["order_id"]
        if not isinstance(order_id, str) or not order_id.strip():
            raise ValueError("invalid order_id")
        print("order:", order_id)
    except (ValueError, TypeError, KeyError):
        print("unexpected response content")
```

`isinstance(order_id, str)` 問取到的值是不是字串，再查它是否非空。200 時見到 `order: O01`；改成不存在的檔名會走到 `request failed`。這是互動試跑，不是排程用的結束碼契約；完成練習後在第一個視窗按 Ctrl+C 停止。下一堂會用同樣方式在本機模擬跨頁回應。

### 把兩種成功和兩種失敗分開

先從瀏覽器打開同一個本機 URL 看合成樣本，再跑程式。瀏覽器能顯示文字，只證明指定位置有回應；程式還需要用約定的欄名取出訂單。要驗這一層，在確定沒有其他人使用樣本資料夾時，把 `one_order.json` 暫改成 `{"status":"ready"}` 後重跑。狀態仍為 200，卻會顯示內容不符。用同樣的 URL 下指令，改變的只有本機測資，這使原因很容易對照。復原後應再次印出 O01。

對照另一個情境：只停止伺服器，不碰檔案，再送請求。若埠沒有其他程式使用，本次沒有 200 或 404，那不是「API 表示查無訂單」，而是未能連上。真正交付日報時，這類故障不該被改成「零筆」；前者要找回連線，後者還是要看介面是否回報合法的空結果。

看 HTTP 狀態及內容前，先確認端點（endpoint）就是這支練習要連的位置。`127.0.0.1` 永遠指目前電腦；本機 8765 和外部網站不是同一個服務。如果 PowerShell 說這個埠被占用，停止自己上次留下的練習伺服器，或把伺服器與客戶端兩處一起換到一個未使用的埠；不需要停掉不相干的程式，也不用開放防火牆給外部連線。

## 常見錯誤

- `ModuleNotFoundError`：套件裝在另一個環境；以 `.venv` 的同一個 Python 安裝和執行。
- JSON 解析失敗卻還在查逗號：先看 HTTP 狀態，缺檔回應可能是 HTML。
- 頁面打不開便當作 404：沒有狀態碼先查本機伺服器和埠，不把網路錯誤當空數據。
