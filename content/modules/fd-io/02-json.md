---
id: fd-io-02
module: fd-io
order: 2
title: JSON 與巢狀物件
subtitle: 取出每筆訂單的品項
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-01
objectives:
  - 將 JSON 文字解析成字典及列表
  - 逐層走訪訂單與品項
  - 輸出一個可再次讀入的展開檔
tags:
  - JSON
  - 巢狀物件
  - 序列化
  - 品項
resources:
  - title: Python：json 模組
    url: https://docs.python.org/3/library/json.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 對照 load、dump 與 Python 類型轉換表。
concepts:
  - id: fd-io-02-decode
    prompt: 怎麼把已開啟的 JSON 檔解析成 Python 物件？
    answer: '`json.load(file)`，`loads` 則直接讀字串等內容。'
    mcq:
      question: '`json.loads(''{"items": []}'')` 的 items 值是什麼？'
      options:
        - 空字典
        - None
        - 空列表
        - 字串 `"[]"`
      answer: 2
      explain: 中括號代表陣列，解析後是 Python 列表。
  - id: fd-io-02-nested
    prompt: 為何從訂單到明細需要兩層迴圈？
    answer: 先取每張訂單，再走訪它的品項列表。
    mcq:
      question: 一張訂單有 2 個品項，展開後應有幾列？
      options:
        - '1'
        - '3'
        - '0'
        - '2'
      answer: 3
      explain: 輸出粒度是一個品項，不另為訂單本身造一列。
  - id: fd-io-02-null
    prompt: JSON 的 `null` 和 `[]` 有什麼差別？
    answer: 前者解析成 None；後者是已知且沒有項目的列表。
    mcq:
      question: 若規格要求 items 必須是列表，哪個有效？
      options:
        - '`"items": []`'
        - '`"items": null`'
        - '`"items": "[]"`'
        - 沒有 items 鍵
      answer: 0
      explain: 空列表符合型別規則，缺欄、null、字串都不是列表。
practice:
  - id: fd-io-02-p1
    kind: hands-on
    title: 把訂單品項展開
    minutes: 8
    steps:
      - 替第二張訂單加上一個品項，再替來源加上一張品項空白列表的訂單。
      - 重跑後用編輯器開 items_flat.json。
    checks:
      - 只有新增品項令輸出增加為 3 列；空列表不產生假品項。
      - 同一張訂單的多個品項各自保留 order_id。
---

## 訂單裡面還有一張清單

CSV 適合固定欄位的平面明細；一張訂單可能同時有 2 個品項，JSON（JavaScript Object Notation）可以直接在訂單下放一個品項列表。本堂要把「一筆一訂單」改成「一列一品項」，讓營運能數每種商品，而不是把品項當作字串的一部分切割。

## 讀寫及類型速查

- JSON 物件（object）用 `{}`，鍵名與字串使用雙引號；陣列（array）用 `[]`。逗號分隔相鄰項目，最後一項後不放逗號。
- `json.load(file)` 從已開檔案解析；`json.loads(text)` 解析內容本身。物件變字典、陣列變列表；`null` 變 `None`，`true`、`false` 變成 Python 的 `True`、`False`。
- `json.dump(value, file)` 將 Python 值序列化（serialization）到檔案；`json.dumps(value)` 回傳 JSON 字串。`indent=2` 只整理輸出縮排，`ensure_ascii=False` 讓中文能直接顯示。
- 如果 `items` 的位置沒有鍵，直接查會出現 `KeyError`；如果有鍵但值為 `null`，則不能把它當列表走訪。這是兩個不同的來源狀態。

## 展開一張有兩個品項的訂單

在 `C:\dev\conduit-lab\python-io` 存 UTF-8 的 `orders_nested.json`：

```json
{"orders":[{"order_id":"O01","items":[{"sku":"K01","qty":2},{"sku":"K02","qty":1}]},{"order_id":"O02","items":[]}]}
```

同一層存 `flatten_items.py` 並執行 `py flatten_items.py`：

```python
import json

with open("orders_nested.json", encoding="utf-8") as file:
    payload = json.load(file)

rows = []
for order in payload["orders"]:
    for item in order["items"]:
        rows.append({"order_id": order["order_id"], "sku": item["sku"], "qty": item["qty"]})

with open("items_flat.json", "w", encoding="utf-8") as file:
    json.dump(rows, file, ensure_ascii=False, indent=2)
print("orders/items:", len(payload["orders"]), len(rows))
```

畫面顯示 `orders/items: 2 2`，兩個 2 代表不同事：兩張訂單有兩筆品項，而兩筆品項都屬於 O01。看輸出檔比只看總數更可靠。品項空列表表示沒有品項，不用填一個假代碼來保留 O02；如果報表要求連空單也要算，應從原始訂單數，而不是從品項數。

下一堂[〈HTTP 與 requests〉](#/lesson/fd-io-03)讀的 JSON 不再需要先存成本地檔；內部仍可用同一種字典和列表走訪。

### 展開前先講清楚一列是什麼

本例的來源只有訂單號、商品、件數；輸出保留訂單號，是因為品項離開原本的巢狀位置後，不會自動知道屬於哪個訂單。想像 O02 後來也買 K01：若只留商品和件數，兩筆 K01 還能分別加總，卻不能回答哪張訂單購買了它。反過來，若真的只要商品集合，這時才應去重，不要在展開過程順手丟掉合法的重複品項。

試著用一張紙先畫出 O01 下兩條箭頭指向 K01、K02，O02 沒箭頭。輸出每列對應一條箭頭，與有幾個外層物件無關。再加入一筆空訂單，外層筆數增加，但品項筆數不動。這個測法能抓到有人將列印值誤換成訂單數，比剛好看到 `2 2` 更能證明程式正確。

來源格式正確和結構合規也要分兩層。JSON 文件合法，只代表標點和字面值可解析；`{"orders": null}` 仍不符合這個腳本的預期。描述問題時先說「解析不出 JSON」或「解析成功但 orders 不是列表」，別一概稱為編碼錯誤。用戶端能辨認是哪一層出錯，來源負責人就不需要重查整條流程。

想核對寫出的格式，可把輸出再讀一次。書寫成功只表示檔案有內容，重新解析才會知道它是不是可供下一步使用的 JSON。

## 常見錯誤

- 解析器拒絕單引號或尾逗號：先核對 JSON 格式，不要直接把 Python 字典的寫法當 JSON。
- 印出 2 筆便以為有 2 張有品項的訂單：核對每一列的 `order_id` 和輸出粒度。
- 用空列表默默替代所有缺欄：當規格要求欄位存在，應指出缺失，不假裝來源已回報沒有品項。
