---
id: fd-io-04
module: fd-io
order: 4
title: 分頁與逾時
subtitle: 最後一頁不要抓兩次
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-03
objectives:
  - 用回應提供的下一頁指標走訪有限頁數
  - 驗證末頁與重複指標會終止
  - 遇到失敗時不發布未完成計數
tags:
  - API 分頁
  - 逾時
  - 終止條件
  - 防重複
resources:
  - title: Requests 快速入門
    url: https://requests.readthedocs.io/en/latest/user/quickstart/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 核對 timeout 與連線例外的行為。
concepts:
  - id: fd-io-04-terminal
    prompt: 本例的末頁訊號是什麼？
    answer: 回應的 `next` 是 `null`，解碼後為 `None`。
    mcq:
      question: 最後一頁只有 1 筆但 next 指向另一頁，能直接停嗎？
      options:
        - 不能；按這套契約要繼續
        - 能；只要不滿 2 筆就停
        - 能；每頁筆數越少一定是最後
        - 要重抓該頁直到滿 2 筆
      answer: 0
      explain: 頁大小不是這個介面的終止條件。
  - id: fd-io-04-cursor
    prompt: 為何記錄已看過的頁面指標？
    answer: 若回應指回舊頁，可在重複擷取之前辨認迴圈。
    mcq:
      question: 已讀第 1 頁，後來的 next 又指第 1 頁，該怎麼做？
      options:
        - 再抓一次並照樣計數
        - 報告本批不完整，不重抓
        - 假裝自然結束，輸出完成
        - 清空 seen 後繼續
      answer: 1
      explain: 重複頁違反契約，不應計成成功或無限重試。
  - id: fd-io-04-partial
    prompt: 第 2 頁逾時，第一頁的內容可以當完整匯入嗎？
    answer: 不行；它只證明第一頁成功，不能當完成結果發布。
    mcq:
      question: 每次請求都設 3 秒逾時，能否保證 10 頁批次 3 秒完成？
      options:
        - 能，因為 timeout 會跨頁共享
        - 只要無重複頁就能
        - 不能，逾時只約束各請求的等待階段
        - 只要最後一頁不滿額就能
      answer: 2
      explain: 整批時限是另一個條件；各頁和各階段的等待不是同一個計時器。
practice:
  - id: fd-io-04-p1
    kind: hands-on
    title: 驗證兩頁匯入的終止條件
    minutes: 8
    steps:
      - 先跑正常兩頁，接著將 page-2.json 的 next 改成 page-1.json。
      - 再改成缺檔的 page-3.json，觀察失敗路徑；還原 null 後停止伺服器。
    checks:
      - 正常只有 3 筆；迴圈和缺檔情況均不印完整筆數。
      - 重複指標不會再次擷取第一頁。
---

## 有下一頁，才繼續

介面一次只送一部分結果，叫分頁（pagination）。有的用頁碼，有的回傳游標（cursor），即告訴你下一頁從何處接續的值。練習用有限的檔名代替游標：每頁含 `orders` 與 `next`；取到 JSON 的 `null` 才表示結束。不從「這頁幾筆」猜終點。

## 走訪規則

先存目前頁面；每次只允許安全清單中的檔名，確認沒有看過，取回並檢查狀態與內容，再更新下一頁。已看過的指標代表異常，不是自然完成。真實管道若允許不定長的頁面，一般也會設最大頁數或整批時間，但這裡只有 3 個已知名稱，所以迴圈有界。遇到任何一頁失敗，畫面可以顯示查到哪裡，但不應發布完成計數。

## 用本機兩頁驗收

沿用[〈HTTP 與 requests〉](#/lesson/fd-io-03)的 `python-io` 虛擬環境及本機伺服器，若已停止，從 `python-io` 重開相同指令。在 `http-samples` 內存 UTF-8 的 `page-1.json`：

```json
{"orders":["O01","O02"],"next":"page-2.json"}
```

同一層的 `page-2.json`：

```json
{"orders":["O03"],"next":null}
```

在 `python-io` 存 `get_pages.py`，同層執行 `.\.venv\Scripts\python.exe get_pages.py`：

```python
import requests

base = "http://127.0.0.1:8765/"
allowed = {"page-1.json", "page-2.json", "page-3.json"}
seen = set()
page = "page-1.json"
orders = []

try:
    while page is not None:
        if not isinstance(page, str) or page not in allowed or page in seen:
            raise ValueError("invalid or repeated page")
        seen.add(page)
        response = requests.get(base + page, timeout=3)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload["orders"], list):
            raise ValueError("orders must be a list")
        orders.extend(payload["orders"])
        page = payload["next"]
except (requests.exceptions.RequestException, ValueError, KeyError, TypeError) as error:
    print("incomplete:", error)
else:
    print("complete orders:", len(orders))
```

`extend` 依序加入一個列表的成員，不把整頁當一項。正常是 `complete orders: 3`。把第 2 頁指回第 1 頁，應在第 3 次請求前就停住；讓它指向未建立的 `page-3.json` 則測到 HTTP 失敗。這裡驗的是頁面結構和走訪，不是完整訂單欄位。真正連外服務引用的下一頁網址不能直接信任；本例僅允許固定的本機樣本。操作完以 Ctrl+C 結束伺服器。

### 手畫走訪順序，再用反例驗證

在紙上畫出目前頁、這一輪取到了幾筆、回來的 `next`，最後加上累計筆數。第一輪從 `page-1.json` 取得 2 筆，下一頁指向 `page-2.json`；第二輪只取 1 筆，下一頁是 `null`，合計才是 3。不要先記「少於 2 筆就停」：試把第 1 頁暫減為 1 筆，保留它的下一頁指標，程式還是得去第 2 頁。按這份規格，就算某一頁的訂單列表是空的也不能直接停，還要看它有沒有宣告下一頁。

將第二頁的 `next` 改成第一頁時，前兩次請求都可能成功；第三輪尚未送出請求便會因 `seen` 停住。可以查看本機伺服器的終端，對照只有兩次 GET，避免只讀兩筆已累計的數字猜它有沒有重抓。想練 HTTP 失敗，則用允許但未建立的第三頁。這三個允許名稱是固定的，正常樣本只有前兩頁；第三個刻意留給缺檔測試。

這個清單目前只保存在記憶體；大型匯入不一定先存全部項目，可以先寫暫存結果再依完整性決定是否發布。重試也要先有上限和明確失敗訊號，還要避免同一頁被加入兩次。那是正式服務的下一步；本堂先把自然完成和錯誤停止分清楚，讓之後加重試時仍有核對基準。用[〈原子替換輸出〉](#/lesson/fd-lab-04)會看到本地檔案如何延到寫完再發布。

## 常見錯誤

- 第一頁總被重抓：迴圈末尾忘記更新指標；每輪從回應更新 `page`。
- 把缺少 `next` 當 `null`：缺欄不等於宣告結束，應指出失敗。
- 逾時後直接回傳累計數：這是部分結果，不是完成批次；應保留失敗狀態。
