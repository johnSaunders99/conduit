---
id: fd-python-04
module: fd-python
order: 4
title: 字串方法
subtitle: 清掉欄位前後的空白
status: ready
minutes: 25
level: 1
prereqs:
- fd-python-03
objectives:
- 用 strip 移除首尾空白，不擅自修改欄位內部
- 依口徑使用 upper 和 replace 正規化代碼
- 保留原始字串並用界線與長度驗證新值
tags:
- strip
- replace
- upper
- 欄位清洗
resources:
- title: 內建型別：Text Sequence Type
  url: https://docs.python.org/zh-tw/3/builtins/stdtypes.html
  kind: doc
  lang: zh-Hant
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 找 str.strip、str.replace 與 str.upper 的說明。
concepts:
- id: fd-python-04-strip-boundaries
  prompt: '"  north  dock  ".strip() 會保留哪些空格？'
  answer: 首尾空白被去除，north 與 dock 中間兩個空格保留。
  mcq:
    options:
    - 一個都不保留
    - 內部只剩一個
    - 只去左側空格
    - 中間兩個空格都保留
    answer: 3
    explain: strip 只處理兩端，不會壓縮中間的文字。
- id: fd-python-04-return-new
  prompt: 單獨執行 raw.strip()，下一行印 raw 會讀到什麼？
  answer: 原字串；要保留處理結果，可用 clean = raw.strip()。
  mcq:
    options:
    - 清好的字串
    - 空字串
    - 原字串
    - 只有首尾空白
    answer: 2
    explain: 方法交回新結果，不替原名稱賦值。
- id: fd-python-04-replace-order
  prompt: 把代碼中的連字號換成底線，哪個方法呼叫正確？
  answer: code.replace("-", "_")，先給舊片段，再給新片段。
  mcq:
    options:
    - code.replace("-", "_")
    - code.replace("_", "-")
    - code.strip("-")
    - code.upper()
    answer: 0
    explain: replace 的參數有方向；strip 管兩端，upper 轉大寫。
- id: fd-python-04-source-evidence
  prompt: 清洗後為何還要保留原始值？
  answer: 比對處理前後能判斷是來源有問題，還是轉換規則改過頭。
  interview:
    question: 相同倉庫因首尾空白被拆成兩組，你會怎麼修？
    answer: 我先保留原欄位，再建一個去首尾空白的比對值。用正常值和多空白的值驗證能合併，再確認內部空白、符號、空值不會被當成同一個有效代碼。
    points:
    - 保留原欄位便於追查
    - 先修有證據的差異
    - 加不該被合併的反例
practice:
- id: fd-python-04-p1
  kind: code
  title: 畫出原欄位和清洗欄位的界線
  minutes: 8
  steps:
  - 依正文保存並執行 clean_code.py。
  - 另存副本，將測資改為只有 3 個空格，看看清洗結果；再測一個中間有空格的代碼。
  checks:
  - 原值、去空白、正規化的長度分別為 11、7、7。
  - 純空白得到長度 0 的空字串；strip 不改中間空格。
---

昨晚的到貨單把同一倉庫寫成 `north-2` 和 `  north-2  `。看畫面差不多，程式卻會把它們視為不同的文字。先把首尾空白清掉，再依這份樣本的約定轉大寫、換分隔符；不要把每份來源的文字都一律套這個規則。

## 方法跟著值走

方法（method）是某個值提供的操作，寫作 `值.方法(要給它的值)`。[〈物件與方法〉](#/lesson/fd-tools-01)會再細講這種關係。字串不可變（immutable）：這些方法交回新的結果，不在原字串上改字。用賦值接住結果，必要時保留原值以供追查。

- `raw.strip()`：取掉兩端連續的空白，保留中間。
- `trimmed.upper()`：把字母換成大寫，數字與連字號照舊。
- `upper_code.replace("-", "_")`：把舊片段 `-` 替換成新片段 `_`，預設替換每個符合處，不只首尾。
- `len(raw)`：查字串的長度。今天的代碼只含簡單英數與空白，不是測文字占多少畫面寬度。

## 讓肉眼看見空白

在 `C:\dev\conduit-lab\python` 新增 `clean_code.py`，用 `py clean_code.py` 執行。用方括號當成畫面上的界線；括號是另外接上的，不會改寫欄位。

```python
raw = "  north-2  "
trimmed = raw.strip()
upper_code = trimmed.upper()
key = upper_code.replace("-", "_")
print("[" + raw + "]", len(raw))
print("[" + trimmed + "]", len(trimmed))
print("[" + key + "]", len(key))
```

依序應看到 `[  north-2  ] 11`、`[north-2] 7`、`[NORTH_2] 7`。從第一行到第二行少 4 個字元，是首尾各去兩格。從第二行到第三行等長，只有標準寫法改了。若交班規則沒有寫「大小寫視為同一個倉」，就別任意使用 `upper()`，因為它可能把兩個本來不同的代碼改成同一個。先保存原值，才有機會回頭用正確的規則重做。

## 用口徑擋住「清得太乾淨」

試著把 `raw` 換成 `" north dock "`，先預測拿掉哪兩個空格，再看輸出。首尾的空格不是位置代碼的一部分；中間空格可能有意思，不能只因為看起來整齊就拿掉。比如倉位名稱允許 `NORTH DOCK` 與 `NORTHDOCK` 分別代表不同位置，將它們壓成同一個代碼，日報就會把兩處的到貨數量合計。此時該修的是首尾或來源明定的分隔方式，不是無差別移除全部空白。

再試一個只含 3 個空格的值。初版欄位印出 `[   ]`，清洗結果印出 `[]` 且長度 0；它不是「清洗成功的合法倉庫」。儲存到後續欄位時，需要依口徑保留空值或送去檢查，不能替它猜一個倉。這堂不寫自動判斷；在[〈布林與比較〉](#/lesson/fd-python-06)會先確認真假條件，而[〈條件分支〉](#/lesson/fd-python-07)會讓不同狀態走不同的路。

核對清洗前後時，記下三個問題：換掉了哪些字，長度為什麼變了，有沒有正常值也被改成別的代碼。以原值、清洗值、原因三欄記錄；發現規則改太多，保留第一欄才能重跑。只看最終的大寫字樣像不像標準答案，不足以確認哪些數據發生了變動。

## 常見錯誤

- 呼叫 `raw.strip()` 後印 `raw`，空白還在 → 沒接住結果 → 用 `trimmed = raw.strip()`。
- `north  dock` 仍有兩個內部空格 → `strip()` 只做首尾 → 明確核對內部空白是否真的該清。
- 去空白後看起來「什麼都沒有」 → 原值可能全是空白 → 印出界線與 `len(trimmed)`，把空字串與正常代碼分開。
