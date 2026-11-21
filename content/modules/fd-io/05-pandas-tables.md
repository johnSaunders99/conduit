---
id: fd-io-05
module: fd-io
order: 5
title: pandas 讀表
subtitle: 別讓編號被猜成數字
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-04
objectives:
  - 指定 pandas 讀入代碼與金額的類型
  - 區分缺值與合法的 0
  - 顯示只選部分欄位的數據框
tags:
  - pandas
  - read_csv
  - 數據框
  - 類型
resources:
  - title: pandas：read_csv
    url: https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: 查讀表時如何指定欄位、類型及缺值。
concepts:
  - id: fd-io-05-frame
    prompt: 數據框與單一列表有何差別？
    answer: 數據框像表格，有具名欄位，各欄可有不同類型。
    mcq:
      question: 只取特定欄位讀入，使用哪個參數？
      options:
        - '`dtype`'
        - '`usecols`'
        - '`na_values`'
        - '`encoding`'
      answer: 1
      explain: usecols 選欄，其他選項指定類型、缺值標記或編碼。
  - id: fd-io-05-ids
    prompt: 為何門市編號應明寫字串類型？
    answer: 它是身分代碼；猜成整數會丟失前導零。
    mcq:
      question: 收到 `001`、`002`，需原樣保留，用哪個設定？
      options:
        - '`dtype={"store_id": "Int64"}`'
        - 在讀完數字後直接轉為字串
        - '`dtype={"store_id": "string"}`'
        - 對整欄取絕對值
      answer: 2
      explain: 必須在讀入時保留字元，轉回字串不能猜出已丟的零。
  - id: fd-io-05-missing-int
    prompt: pandas 的 `"Int64"` 在這裡的用途？
    answer: 保留整數與缺值，不必把缺值變成 0。
    mcq:
      question: 金額一列為 0，另一列空白；本例的缺值筆數是多少？
      options:
        - '2'
        - '0'
        - 需先把 0 轉空白才能數
        - '1'
      answer: 3
      explain: 0 是整數，空欄才標為缺值。
practice:
  - id: fd-io-05-p1
    kind: hands-on
    title: 保留有前導零的門市代碼
    minutes: 8
    steps:
      - 依正文讀表，再加入一列門市代碼 004、金額 25。
      - 分別以有無 dtype 的讀法列印第一筆和最後一筆門市代碼。
    checks:
      - 顯式讀取顯示 001 與 004，不脫落前導零。
      - amount_cents 還是可缺值的整數欄，空欄未被當成 0。
---

## 001 是代碼，不是數量

一份報表把 `001` 讀成 `1`，另一份仍保留 `001`。之後按門市比對就對不上。pandas 的數據框（DataFrame）像一張帶欄名的數據表，適合查欄與統計；但讀表時先寫清楚欄位的類型和缺值規則，不能讓程式從剛好看到的幾筆自行猜身分。

## 語法速查

- `pd.read_csv(path, usecols=[...], dtype={...})` 讀 CSV；`usecols` 選讀哪些欄位，`dtype` 指定各欄類型。
- `"string"` 用來存文字；`"Int64"`（大寫 I）讓整數欄也能存缺值。缺值（missing value）是還沒有值，和合法的整數 0 不同。
- `keep_default_na=False` 不採用內建缺值字串清單；`na_values={"amount_cents": [""]}` 明確指定只有金額欄的空字串按此規格視為缺值。這樣門市代碼 `NA` 不會被順手當成缺值。
- `frame["amount_cents"].isna()` 對各筆標記有無缺值，再用 `.sum()` 計數；用 `frame.dtypes` 查讀進來的類型。

## 親手讀兩次同一份表

在 `C:\dev\conduit-lab\python-io` 準備虛擬環境：如果還沒有 `.venv`，先跑 `py -m venv .venv`；用 `.\.venv\Scripts\python.exe -m pip install pandas` 安裝。這是學習環境的安裝指令，不需安裝到全域。本堂指令在同一資料夾執行。在這裡存 UTF-8 的 `daily_sales.csv`：

```csv
store_id,amount_cents,source
001,800,web
002,,store
003,0,store
```

同一層存 `read_daily.py`，以 `.\.venv\Scripts\python.exe read_daily.py` 執行：

```python
import pandas as pd

guessed = pd.read_csv("daily_sales.csv")
orders = pd.read_csv(
    "daily_sales.csv",
    usecols=["store_id", "amount_cents"],
    dtype={"store_id": "string", "amount_cents": "Int64"},
    keep_default_na=False,
    na_values={"amount_cents": [""]},
)
print("guessed/correct:", guessed["store_id"].iloc[0], orders["store_id"].iloc[0])
print(orders.dtypes)
print("missing:", orders["amount_cents"].isna().sum())
print(orders.to_string(index=False))
```

`.iloc[0]` 取第一個位置；預設與顯式結果是 `1 001`。正式讀法只留下兩欄，缺失金額是 1 筆，0 仍在表裡。試在代碼欄放 `NA`：它應是可見的代碼；缺值只由你宣告的規則決定。[〈pandas 合併與缺值〉](#/lesson/fd-io-06)將用門市代碼來合併兩份表。

### 先保存原樣，再討論規格

門市代碼的零不是裝飾。「001 是否等同 1」由來源契約決定，而不是報表工具決定。本堂指定保留原字元，是為了讓另一份門市清單能使用同樣的鍵。若來源現存 001 和 1 且兩者表示不同店，讀成整數後它們就無法區分。即使知道代碼通常有 3 位，也不應在失去原值後自行補零，除非來源明確承諾統一格式。

再看錢的欄位：`002` 是金額缺失，`003` 是已知 0。兩筆都對淨額不增加數字，但若你要報告「有多少筆金額尚未回傳」，答案只包含前者。用兩個測試看規則：加入字面代碼 `NA`，缺值不應增加；加入一筆完全空的金額欄，缺值應增加一筆。這才驗到 `keep_default_na` 和按欄設定的作用，而不只是「整張表能載入」。

`usecols` 是選欄，不是驗完整檔案的契約；本例不讀 `source`，但另一份稽核表可能需要它。看到不能轉換的金額，例如文字 `oops`，`dtype` 可能讓讀取直接失敗；它不會替你把壞列放到另一個檔案。想把無效列單獨隔離而保留其餘結果，等[〈例外與隔離〉](#/lesson/fd-io-07)按列驗證再發布。先能聞到問題在哪一欄，比一讀完就補值實用。

空白字串若出現在門市欄，也不應變成可加入對帳的正式代碼；這是欄位規則，而不是單靠指定數據類型就能保證的事。

## 常見錯誤

- 讀完整數再轉字串仍只有 1：前導零已失去，須回到原檔用正確的類型重讀。
- 大寫 I 寫成小寫，空欄不能轉普通整數：對此欄指定可缺值的 `Int64`。
- 用補 0 把缺值藏起來：先數缺值，只有明確的業務規格允許才補。
