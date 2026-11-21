---
id: fd-data-05
module: fd-data
order: 5
title: 排序鍵
subtitle: 讓同價商品輸出穩定
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-04
objectives:
  - 用函式及 lambda 指定排序鍵
  - 安排價格降序且同價商品代碼升序
  - 區分新列表與原地排序
tags:
  - 排序鍵
  - 穩定排序
  - lambda
  - 次要鍵
resources:
  - title: Python 排序技法
    url: https://docs.python.org/3/howto/sorting.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 對照 key、reverse 和排序穩定性的範例。
concepts:
  - id: fd-data-05-sort-copy
    prompt: '`sorted(rows)` 和 `rows.sort()` 差在哪？'
    answer: 前者傳回新列表；後者就地改列表，回傳 None。
    mcq:
      question: 要保留來源順序，應用哪個？
      options:
        - '`result = rows.sort()`'
        - '`result = sorted(rows)`'
        - '`rows.sort(); result = rows`'
        - '`result = rows; rows.sort()`'
      answer: 1
      explain: 只有第一種建立新列表而不改來源。
  - id: fd-data-05-key-fn
    prompt: '`key` 收的是什麼？'
    answer: 收一個函式，對各筆算出比較用的鍵。
    mcq:
      question: 價格高到低、同價代碼 A 到 Z，鍵是？
      options:
        - '`(row[1], row[0])`'
        - '`(row[0], -row[1])`'
        - '`(-row[1], row[0])`'
        - '`(-row[1], row[0])` 加 `reverse=True`'
      answer: 2
      explain: 用負價格做升序，價格方向才翻轉，代碼依舊升序。
  - id: fd-data-05-stable
    prompt: 穩定排序是什麼？
    answer: 比較鍵相同的項目維持原先相對順序。
    mcq:
      question: 價格相同且只按價格排序，哪個保證成立？
      options:
        - 同價一定按代碼順序
        - 多次亂序輸入都得到同一列表
        - 只留同價的第一筆
        - 同價的相對次序跟輸入相同
      answer: 3
      explain: 穩定排序保留平手順序，不自行新增次要鍵或去重。
practice:
  - id: fd-data-05-p1
    kind: hands-on
    title: 穩定輸出促銷價目
    minutes: 8
    steps:
      - 在原數據加 K00，同樣定價 199 分；將兩筆 199 的來源次序交換。
      - 跑出結果並核對排序前後來源是否保持當次輸入的樣子。
    checks:
      - 兩次均為 K00、K01、K03、K02。
      - 只保留價格鍵時，同價輸出會受輸入順序影響。
---

## 結果一樣多，還不一定交得出去

今天和昨天的價格相同，輸出卻把兩個同價商品交換位置。營運第一眼以為價格改了，其實只是來源檔順序不同。給排序一條明確規則：先依價格從高到低，再依商品代碼 A 到 Z。這條次要規則不是裝飾，而是可以驗收的輸出條件。

## 語法速查

- `sorted(rows)` 建立新的已排序列表；`rows.sort()` 原地改變列表，回傳 `None`。
- `sorted(rows, key=price_of)` 把函式交給排序，`price_of(row)` 則是先呼叫一次，不是同一回事。
- `lambda row: row[1]` 是只計算一個運算式的小函式，這裡等同定義一個取第二欄的函式。
- `key=lambda row: (-row[1], row[0])` 產生元組。先比負價格；只有價格相同才比代碼。
- `reverse=True` 反轉整組鍵的方向，不是只反轉第一欄。這裡只要價格降序，就用負數鍵而不加 `reverse`。

穩定排序（stable sort）是指排序鍵（sort key）相同時保留輸入的相對順序，不是說來源任意換順序都會產生同一份結果。若輸出規格要求即使來源換順序也不變，排序鍵必須包含足夠的平手規則；本例假定商品代碼在這張價目表中唯一。

## 比較兩種輸入

在 `C:\dev\conduit-lab\python-data` 存 `price_ranking.py`，執行 `py price_ranking.py`。

```python
prices = [("K03", 199), ("K02", 129), ("K01", 199)]

def price_of(row):
    return row[1]

print("price only:", sorted(prices, key=price_of, reverse=True))
print("two keys:", sorted(prices, key=lambda row: (-row[1], row[0])))
print("source:", prices)
```

只比價格時是 K03、K01、K02；比兩個鍵時是 K01、K03、K02，來源仍以 K03 開頭。把來源中兩筆 199 分互換再試，只按價格的輸出會跟著變，兩鍵的結果不會變。負價格只是排序時的臨時值，輸出金額仍是正的 199；不是在做退款運算。

如果商品代碼不是唯一，兩個鍵都相同的紀錄仍會依來源次序。這時要先問兩筆算不算不同的商品版本，才知道該不該加上第 3 個鍵。先用小樣本把這條規則定清楚，比看到報表跳動就對所有欄位亂排序有效。

### 用一張便條寫清楚平手規則

先把比較用的鍵寫成 K03 對 `(-199, "K03")`、K02 對 `(-129, "K02")`、K01 對 `(-199, "K01")`，再試著不用程式就比較兩筆。第一欄相同時，才輪到第二欄；若第一欄已分出先後，代碼即使更小也不能插隊。這樣做也能解釋為什麼把代碼放第一欄會失敗：那會先依代碼排序，價格只能在同一代碼時才有作用。

有時報表只要前 2 名：先完成整份排序再取 `[:2]`，不是先切出原始前 2 筆才排序。拿同一組數據手算兩者，前者保留兩個 199 分，後者只看到了 K03、K02。兩個操作都合法，但解答不同問題。若不少於 2 筆才算可發布，還得另外驗筆數；排序和切片都不替你補不存在的商品。

排序後顯示時仍保留整筆商品。只排序金額列表雖能找到最大值，卻會丟失那筆金額屬於誰；排整列並使用比較鍵才保留兩者關係。

## 常見錯誤

- `key=price_of()` 立刻報缺參數：要給函式本身，不要先加括號。
- 同價代碼變成 Z 到 A：`reverse=True` 反轉了整個元組；只把價格反號。
- 排完的變數成了 `None`：`sort()` 不回傳排序列表，需要回傳值就用 `sorted()`。
