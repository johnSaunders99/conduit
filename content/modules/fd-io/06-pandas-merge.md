---
id: fd-io-06
module: fd-io
order: 6
title: pandas 合併與缺值
subtitle: 核對合併前後筆數
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-05
objectives:
  - 用 left merge 保留所有訂單
  - 用 validate 拒絕右表重複鍵
  - 區別未配對與已配對但欄值缺失
tags:
  - pandas
  - merge
  - 左連接
  - 缺值
  - 筆數核對
resources:
  - title: pandas：DataFrame.merge
    url: https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.merge.html
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: 看左連接、唯一性檢查與缺鍵提醒。
  - title: pandas：處理缺值
    url: https://pandas.pydata.org/docs/user_guide/missing_data.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 比較 isna 與直接等值比較。
concepts:
  - id: fd-io-06-left
    prompt: 左合併未配對的訂單會怎樣？
    answer: 訂單列保留，右表欄是缺值。
    mcq:
      question: 想留下不知道門市區域的訂單，選哪個？
      options:
        - '`how="inner"`，訂單放左邊'
        - 只取區域非空
        - '`how="left"`，訂單放左邊'
        - 先刪除不在對照表的訂單
      answer: 2
      explain: 左合併保留左表列，其他做法都可能丟單。
  - id: fd-io-06-validate
    prompt: '`validate="many_to_one"` 限制何者唯一？'
    answer: 右表的連接鍵必須唯一，左表可以重複。
    mcq:
      question: 右表重複了 001 時，按設計應怎樣？
      options:
        - 自動取日期最新的一筆
        - 自動求平均值
        - 保證不重複列出左表
        - 合併報錯，核對右表規格
      answer: 3
      explain: validate 防止不符合預期的鍵關係；不代做去重決策。
  - id: fd-io-06-indicator
    prompt: 如何區分右表沒配到和右表欄位是空值？
    answer: 用 `indicator=True` 看 `_merge`，再用 `isna()` 查區域。
    mcq:
      question: '`_merge` 為 `both` 但區域缺失說明什麼？'
      options:
        - 門市有配到，但區域沒有值
        - 門市一定未配到
        - 該列應被 inner 合併丟棄
        - 應自動改成 0
      answer: 0
      explain: 是否找到同一個鍵和找到的欄位是否完整是兩回事。
practice:
  - id: fd-io-06-p1
    kind: hands-on
    title: 建立門市對照核對表
    minutes: 9
    steps:
      - 先用原始樣本跑，之後在 stores.csv 加第二個 001 再跑。
      - 還原後新增 003 且門市區域為空白，再跑一次。
    checks:
      - 重複鍵應在輸出前失敗；不默默增加筆數。
      - 新增 003 後，3 筆訂單都配對，但缺區域仍有 2 筆。
---

## 合併後變多的訂單從哪來？

兩張訂單都屬同一門市，門市對照表理應每個代碼一列。若對照表不慎寫了兩個 001，每張 001 訂單就各有兩個配對，報表筆數會膨脹。合併（merge）前講清楚左右各是什麼、預期一筆配幾筆，合併後再查例外。SQL 的[〈多對多膨脹〉](#/lesson/sq-join-07)會拆解同一個現象；現在先用 pandas 看到它。

## 語法速查

`orders.merge(stores, on="store_id", how="left")` 等於以同名鍵做左連接（left join，台灣也稱左外部聯結）：保留所有左邊的訂單，右邊無對照就留缺值。`how="inner"` 則只留兩邊配到的列。`validate="many_to_one"` 要求右表的鍵唯一，容許左表有多張同門市訂單。`indicator=True` 產生 `_merge`，`both` 是匹配，`left_only` 是只在訂單那邊。

不同於一般 SQL 等值連接，pandas 可讓兩邊的缺失鍵互相匹配。此處在合併前拒絕缺失或空白代碼。右表欄位的值缺失並不代表鍵沒有匹配，兩種現象分開計數。

## 核對兩份表

在 `C:\dev\conduit-lab\python-io` 使用上一堂裝了 pandas 的 `.venv`。存 UTF-8 的 `merge_orders.csv`：

```csv
order_id,store_id
O01,001
O02,002
O03,003
```

同一層存 UTF-8 的 `stores.csv`：

```csv
store_id,region
001,North
002,
```

同層存 `match_stores.py`，執行 `.\.venv\Scripts\python.exe match_stores.py`：

```python
import pandas as pd

orders = pd.read_csv("merge_orders.csv", dtype={"store_id": "string"}, keep_default_na=False)
stores = pd.read_csv(
    "stores.csv", dtype={"store_id": "string", "region": "string"},
    keep_default_na=False, na_values={"region": [""]},
)

for table in (orders, stores):
    codes = table["store_id"]
    if codes.isna().any() or codes.str.strip().eq("").any():
        raise ValueError("missing store_id")

matched = orders.merge(
    stores, on="store_id", how="left", validate="many_to_one", indicator=True
)
print("before/after:", len(orders), len(matched))
print("unmatched:", matched["_merge"].eq("left_only").sum())
print("missing region:", matched["region"].isna().sum())
print(matched.to_string(index=False))
```

合併前後都是 3 筆。O03 沒有門市對照，O02 有對到門市但區域沒填，兩筆都缺區域，只有 1 筆沒配到。若再加一列 001，先看到驗證錯誤；應查重複列是不是不同有效日期或來源錯誤，不隨便刪第一列來消音。

### 用配對數而不是只用總列數對帳

只比長度能抓到一些錯，但不一定能說清楚何處錯：有的做法丟掉一筆未配對訂單，同時因右表重複多配一筆，總數仍可能剛好相同。這裡先要求右表每個代碼唯一，再看 `left_only` 和 `both`。O03 是左邊找不到右邊，應追查對照表的缺口；O02 是右邊有門市、只缺區域，應請來源補欄。兩者都缺區域，但解法不同。

把右表加上一列 `003,` 來試。這個改動只證明門市存在，沒有給該門市區域，所以未配對會從 1 降為 0，缺區域仍是 2。然後改成 `003,East`，缺區域才會降為 1。這是一組很小的對照，可以把「配到了哪列」和「那列有沒有值」分成兩次驗收。

門市代碼及區域的缺值標記不必一樣。範例保留代碼欄的字面文字，將右表的空區域轉成缺值；對空白代碼則在連接前報錯。還要注意 `001` 和帶前後空白的 `001 ` 雖都不算空白，仍不是同一個字串。是否可以去除空白應由代碼規格決定，而非在合併時無聲猜測。需要歸一化時，兩表先按同一條已公開的規則處理，再檢查唯一性。

除了查列數，放一筆右表存在而左表沒有的壓力樣本。左連接不應因此新增訂單；這能抓到把左右兩張表顛倒的錯誤。

## 常見錯誤

- 沒區域的訂單不見了：可能用了內連接，改用左連接並核對筆數。
- 筆數增加：先檢查右表代碼唯一性，不要等到算完金額再去重。
- 把所有缺區域都當未配對：先看 `_merge`，再為有配對但缺欄的數據處理。
