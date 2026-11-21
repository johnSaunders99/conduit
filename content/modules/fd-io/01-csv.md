---
id: fd-io-01
module: fd-io
order: 1
title: CSV 與引號
subtitle: 店名有逗號也不能錯欄
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - 辨認 CSV 的表頭、引號與空欄
  - 用 DictReader 以欄名讀出訂單並驗證不錯位
tags:
  - CSV
  - 引號
  - 空欄
  - DictReader
resources:
  - title: Python：csv 模組
    url: https://docs.python.org/3/library/csv.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 newline 規則、引號與 DictReader。
concepts:
  - id: fd-io-01-quote
    prompt: 欄位含有逗號時怎麼表示？
    answer: 用成對雙引號包住該欄，欄內雙引號寫兩個。
    mcq:
      question: '`"North, Dock",80` 有幾欄？'
      options:
        - '3'
        - '2'
        - '1'
        - '4'
      answer: 1
      explain: 引號內的逗號是內容，只有引號外逗號是分隔符。
  - id: fd-io-01-dict-reader
    prompt: DictReader 預設從哪裡取欄名？
    answer: 把第一筆記錄當表頭，後續每筆映射成字典。
    mcq:
      question: 原始最後一欄是空白欄位，讀出何值？
      options:
        - 整數 0
        - None
        - 空字串
        - 整欄被移除
      answer: 2
      explain: 空欄與缺欄不同；若實際少了一欄，預設才用 None 補。
  - id: fd-io-01-newline
    prompt: 為何開 CSV 時需要 `newline=""`？
    answer: 把換行解讀交給 CSV 模組，讓引號內換行能正確處理。
    mcq:
      question: 檔案開頭帶 UTF-8 BOM 應如何讀？
      options:
        - 改成用逗號切字串
        - 跳過第一筆數據
        - 將表頭欄名轉成整數
        - 指定 `encoding="utf-8-sig"`
      answer: 3
      explain: utf-8-sig 會略過檔首標記，並可讀無標記的 UTF-8。
practice:
  - id: fd-io-01-p1
    kind: hands-on
    title: 核對有逗號的門市名稱
    minutes: 8
    steps:
      - 照正文準備兩列，加入 `O03,"East ""Lab""",90` 並重跑。
      - 將每筆的門市名稱與金額對回原檔。
    checks:
      - 第 1 筆門市名包含逗號；第 2 筆第三欄是空字串。
      - 第 3 筆門市名為 `East "Lab"`，金額仍為字串 `90`。
---

## 門市名裡的一個逗號

有人用 `split(",")` 讀報表，帶逗號的門市讓整列變成 4 欄；下一欄本來是金額，現在卻是店名的後半。CSV（comma-separated values，逗號分隔值）不只是用逗號隔開的字串。先辨認欄位是否受引號保護，再讀成可用欄名查找的訂單。

## 格式及語法速查

- 第一列可用作表頭（header），明寫順序和欄名；以下的表頭不是一筆訂單。
- 常見的 CSV 格式用逗號切欄、雙引號包住含逗號或換行的欄值。欄內真的要留一個雙引號，就在引號內寫兩個 `""`。
- `csv.reader(file)` 每筆給列表；`csv.DictReader(file)` 預設用第一筆作欄名，後續每筆交給你一個字典；一般欄值是字串。
- `open(name, encoding="utf-8-sig", newline="")` 可讀有無 UTF-8 BOM 的來源，不讓檔案層先改換行；把換行與引號交給 CSV 解析器。

最後有分隔用的逗號但沒填值，代表有最後一欄，值是空字串。完全沒寫最後一欄則是缺欄，DictReader 預設補 `None`。兩者都不等於數值 0，讀檔和決定怎麼處理缺值是兩個步驟。

## 印出解析後的欄位

在 `C:\dev\conduit-lab\python-io` 建立 UTF-8 的 `store_orders.csv`：

```csv
order_id,store,amount_cents
O01,"North, Dock",800
O02,South,
```

同一層存 `read_stores.py` 並執行 `py read_stores.py`。`!r` 讓列印結果顯出字串引號，空字串不會看成漏印。

```python
import csv

with open("store_orders.csv", encoding="utf-8-sig", newline="") as file:
    reader = csv.DictReader(file)
    print("header:", reader.fieldnames)
    for row in reader:
        print(f'{row["order_id"]}: {row["store"]!r} {row["amount_cents"]!r}')
```

第一筆應顯示店名 `'North, Dock'` 和金額 `'800'`；第二筆金額顯示 `''`。試著暫時拿掉店名外的引號，你會看到讀成門市 `'North'`、金額 `' Dock'`，而不是顯示「格式一定有錯」。讀取器不替你判斷每欄內容是否合業務規則；[〈例外與隔離〉](#/lesson/fd-io-07)會檢查多欄、缺欄和金額。

### 先把欄名和一筆內容一起看

拿到陌生的交換檔，先看表頭、再對照一筆你認得的樣本。第一欄應是訂單號，第二欄可含標點，第三欄是金額原文；若表頭改順序，按名稱讀通常仍能找到當欄，但若供應者換了欄名，程式就不知新名字代表什麼。不要用「讀到了三個值」代替規格驗證。兩個不同欄位都可能是字串，欄位對調也不一定立即報錯。

還有一種比逗號更容易誤判的格式：引號包住的門市名可以分成兩個實體文字行，但 CSV 讀取器把它視為同一筆記錄。試在有引號的門市名中按一次 Enter，再跑原程式。`!r` 顯示字串中的換行記號，訂單數仍是兩筆。這就是「檔案的行數」和「CSV 的筆數」不一定相同的原因。若上游規格不允許門市名含換行，那是一條驗證規則，不應靠錯誤的解析方式強迫它消失。

值得刻意核對兩種空白：保留 O02 最後的逗號讀一次，再移除逗號讀一次。前者是空字串，後者是 `None`。營運稍後若想把缺欄視為格式錯誤、空欄視為待補數值，你已能提供分辨兩者的證據。改完請還原樣本，讓下一次可以重做同一個對照。

## 常見錯誤

- 有引號的列被錯切成多欄：不要用 `split(",")` 解析整行；改用 CSV 模組。
- 明明有表頭卻找不到第一欄：核對編碼與 BOM，UTF-8 來源可用 `utf-8-sig`。
- 空欄直接轉數字時出錯：先決定空欄如何處理，不要自動補成 0。
