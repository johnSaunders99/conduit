---
id: fd-lab-01
module: fd-lab
order: 1
title: 輸入契約
subtitle: 記下幣別與必填欄位
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - 寫清楚欄名、編碼、幣別及每列代表什麼
  - 以手算樣本驗證接受及拒收口徑
  - 拆開讀檔驗證和發布
tags:
  - 輸入契約
  - CSV 表頭
  - 整數金額
  - 隔離
resources:
  - title: Python：csv 模組
    url: https://docs.python.org/3/library/csv.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看 DictReader 如何讀表頭及不等長的列。
concepts:
  - id: fd-lab-01-contract
    prompt: 輸入契約除了欄名還要說什麼？
    answer: 每列的意義、編碼、金額單位和允許值，以及壞列與整批失敗的處置。
    mcq:
      question: 一個 order_id 有 sale 和 refund，按本課的粒度怎麼算？
      options:
        - 永遠只留最早列
        - 各是一筆金額事件
        - 只要重複就拒收整檔
        - 每個代碼只算一張，金額欄不用看
      answer: 1
      explain: 本課一列一個事件，不是以 order_id 去重。
  - id: fd-lab-01-currency
    prompt: 為何不把 USD 和 TWD 的分直接相加？
    answer: 單位不同，沒有換匯規則便不能讓同一個數字代表同一口徑。
    mcq:
      question: refund 的輸入 150 應如何處理？
      options:
        - 輸入只有 -150 才合法
        - 直接加 150
        - 先驗正整數，再在淨額算成 -150
        - 退款不屬於接受列
      answer: 2
      explain: 輸入保存金額大小，正負方向由事件類別決定。
  - id: fd-lab-01-validation
    prompt: 為何把驗證和發布分開？
    answer: 先知道整批輸入可解讀，再決定是否安全地發布，不邊讀邊覆寫正式結果。
    mcq:
      question: 表頭錯了但某些欄看起來合理，怎麼辦？
      options:
        - 沿位置猜欄名
        - 把整檔當零筆成功
        - 隨機重排欄
        - 停整批並修正來源表頭
      answer: 3
      explain: 表頭契約不能用猜的，否則金額可能落錯欄。
practice:
  - id: fd-lab-01-p1
    kind: hands-on
    title: 保存一份供應商訂單契約
    minutes: 10
    steps:
      - 照正文保存 3 筆 CSV 與驗證模組，跑出接受數、拒收數與淨額。
      - 在 README.md 記下規則，再加 1 筆 USD 並重跑。
    checks:
      - 原輸入為 2 筆接受、1 筆拒收，淨額 650 分。
      - 加入 USD 後多 1 筆拒收，淨額不變；讀檔驗證不產生報表。
---

## 寫程式前先寫口徑

接手[〈例外與隔離〉](#/lesson/fd-io-07)的試跑：同一份訂單日報，不能今天算付款、明天卻把退款當付款。輸入契約（input contract，大陸也稱輸入約定）是供應者與讀取程式之間可驗證的約定。先訂好哪種檔能讀、一列表示什麼，以及錯了如何回報，再寫結果。

- 格式：UTF-8 CSV，可有檔首標記（byte order mark，BOM）；表頭順序及名稱固定為 `order_id,kind,amount_cents,currency`。引號規則照 CSV 模組。
- 粒度（grain）：一列是一個金額事件。`order_id` 去外部空白後不得為空，可在不同事件重複；本批不做去重。`kind` 為 `sale` 或 `refund`，`currency` 只收 `TWD`。
- 金額：`amount_cents` 是新台幣的分，只接受 1 至 9 個 ASCII 數字且值大於 0。銷售加、退款減，不把小數字串或其他幣別默默換算。
- 已讀的事件列若欄數或值無效就隔離，保留行號及欄值；空白行由讀取器略過。表頭不符或檔案不能完整解析就停止整批。日後發布條件是至少一筆有效，不代表拒收為 0。

## 寫出專門讀取與驗證的模組

在 `C:\dev\conduit-lab\batch` 開始新專案，以下 6 堂都用這個資料夾。存 UTF-8 的 `orders.csv`：

```csv
order_id,kind,amount_cents,currency
O01,sale,800,TWD
O02,refund,150,TWD
O03,sale,oops,TWD
```

同一層存 `order_input.py`。`Path` 表示檔案路徑；`path.open()` 就是在那條路徑開檔。`restkey` 給多出來的欄值一個專用鍵，缺欄預設填 `None`。

```python
import csv

HEADER = ["order_id", "kind", "amount_cents", "currency"]

def signed_cents(row):
    if "_extra" in row or None in row.values():
        raise ValueError("wrong field count")
    if not row["order_id"].strip() or row["currency"] != "TWD":
        raise ValueError("missing order_id or unsupported currency")
    if row["kind"] not in ("sale", "refund"):
        raise ValueError("unknown kind")
    raw = row["amount_cents"]
    if not (raw.isascii() and raw.isdigit() and len(raw) <= 9 and int(raw) > 0):
        raise ValueError("amount_cents must be positive integer cents")
    amount = int(raw)
    return amount if row["kind"] == "sale" else -amount

def read_batch(path):
    accepted = net = 0
    rejects = []
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file, restkey="_extra", strict=True)
        if reader.fieldnames != HEADER:
            raise ValueError("unexpected CSV header")
        for row in reader:
            try:
                net += signed_cents(row)
            except ValueError as error:
                rejects.append({"line": reader.line_num, "reason": str(error), "raw": row})
                continue
            accepted += 1
    return {"accepted": accepted, "rejected": len(rejects), "net_cents": net}, rejects
```

在同層執行 `py -c "from pathlib import Path; from order_input import read_batch; print(read_batch(Path('orders.csv')))"`。結果可手算：800 減 150 得 650，接受 2、拒收 1，隔離的原始行號是 4。若換成少欄或多欄，那一列會因欄數不符隔離，而不會讓其他列停止。程式把被拒收的原始欄值先保存在記憶體，適合課堂小檔；若放大到大批次，應另設拒收的容量與保存策略。

### 接手人用同一份表理解失敗

驗收時先不要加新規則，逐項拿能區分兩種結果的小範例：O02 扣 150 但仍被接受；O03 無法解析所以隔離；再造一列未知類別，確認沒有把未知值當成銷售。若將同一個 O01 再作退款來源，這一列仍可有效，因為這份初版沒有去重；要防止事件重送，就得另請來源提供可辨認事件的鍵，而不是靠訂單號猜測。

把規則先寫給讀者，再寫到測試裡。這次的使用者應能分辨「檔案完全不可讀」和「一筆值不合要求」。問題出在文件規格時，不該用預設值去猜；問題只在某列，隔離後仍可用其他列。規則修改的時候，不只改程式，也要更新 README 的範例與預期。否則兩個人看同一張表，會以為同一個結果代表了不同的口徑。

若需要將拒收內容交回供應商，可先給行號和原因，不必在一般報表附上所有原文。此處的合成數據可完整保留；正式環境應另訂交付權限。

## 常見錯誤

- 把相同訂單號一律去重：粒度是一列一個事件，這可能刪掉退款；先依契約確定鍵。
- 把 8.00 和 800 都當成 800 分：規則只有整數分，前者應拒收。
- 表頭有錯仍用位置猜：停止這一批，避免錯欄產出看似正常的報表。
