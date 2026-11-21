---
id: fd-data-03
module: fd-data
order: 3
title: 字典與累計
subtitle: 按門市累計到貨件數
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-02
objectives:
  - 以字典依門市累加件數
  - 用 get 處理首次出現的鍵
  - 同時核對分組小計與輸入總量
tags:
  - 字典
  - 鍵值對
  - 分組
  - 累計
resources:
  - title: Python 教學：字典
    url: https://docs.python.org/3/tutorial/datastructures.html#dictionaries
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看鍵值宣告、查找與項目走訪。
concepts:
  - id: fd-data-03-lookup
    prompt: 字典用什麼取值？
    answer: 用鍵查對應的值，而不是依第幾個位置。
    mcq:
      question: '`totals["S01"] = 7` 再設為 8，結果如何？'
      options:
        - 同一鍵留下 7 和 8
        - 同一鍵對應 15
        - 值沒變，新增一個鍵
        - 一個鍵對應 8
      answer: 3
      explain: 賦值只是替換；要累加須先取原值。
  - id: fd-data-03-get
    prompt: '`totals.get("S05", 0)` 找不到時會插入嗎？'
    answer: 不會，只回傳 0。
    mcq:
      question: 首次出現也能正確累加的寫法是？
      options:
        - '`totals[s] = totals.get(s, 0) + qty`'
        - '`totals[s] = qty`'
        - '`totals[s] = totals[s] + qty`'
        - '`totals.get(s, qty)`'
      answer: 0
      explain: 覆寫不會累計；直接查空鍵會報錯；單獨呼叫 get 不會寫入。
  - id: fd-data-03-items
    prompt: '`totals.items()` 的每一項是什麼？'
    answer: 一對鍵和值，可在迴圈中拆成兩個變數。
    mcq:
      question: 只寫 `for s in totals`，`s` 是什麼？
      options:
        - 值
        - 鍵
        - 鍵值對
        - 位置索引
      answer: 1
      explain: 預設走訪的是鍵；要鍵值對用 `items()`。
practice:
  - id: fd-data-03-p1
    kind: hands-on
    title: 製作到貨小計
    minutes: 8
    steps:
      - 加入 S03 到貨 4 件與 S01 到貨 1 件。
      - 在新增後的結果裡手算 S01 並核對所有門市總量。
    checks:
      - S01 為 8、S02 為 7、S03 為 4；總量 19。
      - 每個門市只輸出一列。
---

## 到貨次數不等於到貨件數

S01 上午到 5 件、下午又到 2 件；S02 到了 7 件。倉務要的是兩個 7，而不是 S01 有兩筆、S02 有一筆。集合只能說門市有沒有到貨；字典（dictionary）讓每間門市都有自己的累計格子。這是先分組再做聚合（aggregation）的雛形：把同組的多筆數據算成摘要。

## 語法速查

- `{}` 或 `dict()` 得到空字典；`{"S01": 5}` 建一組鍵值對（key-value pair），冒號左邊是鍵，右邊是值。
- `totals[store]` 讀既有鍵；`totals[store] = qty` 寫入或取代值。讀不存在的鍵會出現 `KeyError`。
- `totals.get(store, 0)` 在鍵不存在時交回 0，不會插入；`store in totals` 只問鍵有沒有。
- `for store, qty in totals.items():` 依序拿每個鍵和值；若只走訪字典本身，就只會拿到鍵。

門市代碼是分類用的鍵，不是加總的數字。用筆數當鍵會讓兩間剛好同樣件數的門市撞在一起；要按「門市和日期」分組時，可以回到[〈切片與元組〉](#/lesson/fd-data-01)，用兩個穩定值組成鍵。也別把顯示位置當身分：列表今天第 3 列的門市，明天不一定還在那一列。

## 跑一次，比對小計和總量

在 `C:\dev\conduit-lab\python-data` 存 `arrival_totals.py`，執行 `py arrival_totals.py`。`sum()` 用來把一串數值相加；`values()` 提供字典中的所有值。

```python
arrivals = [("S01", 5), ("S02", 7), ("S01", 2)]
totals = {}
received = 0
for store, qty in arrivals:
    received += qty
    totals[store] = totals.get(store, 0) + qty

for store, qty in totals.items():
    print(store, qty)
print("same total:", received == sum(totals.values()))
```

第一次見到 S01，右邊是 `0 + 5`；再來一筆是 `5 + 2`。輸出應為 `S01 7`、`S02 7` 和 `same total: True`。若改成每次直接寫 `qty`，S01 就只剩 2，總量也對不起來。但總量對得上仍不是全部：如果程式把 S01 的 2 件誤加到 S02，總量同樣是 14。至少抽查一個有重複來源的門市，才能抓住分錯組的問題。

只有「這間店此前沒有累加」才用 0 起算。輸入裡缺到貨件數，不代表真的到貨 0 件；應把這筆視為待處理，規則會在[〈例外與隔離〉](#/lesson/fd-io-07)細講。

### 用紙上四欄追一次累加

把紙分為來源門市、本列件數、舊小計、新小計。第一列舊小計空白時寫 0，新小計 5；第二列換成 S02，舊小計也是 0，而不是上一輪的 5；第三列回到 S01，舊小計才是先前留給 S01 的 5。看字典的關鍵是「目前這個鍵的舊值」，不是「剛才迴圈的上一個數字」。用同一張表對照程式跑一次，下次看到部分小計偏低就知道先查哪條更新式。

若要呈現從未到貨的門市，這個字典不會憑空知道有哪些店。不能把沒出現在輸出當成來源忘記傳，也不能說已經確定到貨 0 件。你需要一張完整的門市名單，先確認統計涵蓋的對象，再決定是否添上 0 列。這和 `get(store, 0)` 在逐筆累計時給新鍵一個起點，是不同層次的決定。

最後把樣本縮成同一門市的兩筆到貨，保持件數不同。只應有一個鍵，值是兩筆之和；這能同時抓到重複建鍵與覆寫舊值。

## 常見錯誤

- 第二次看到 S01 後只剩 2：把累加寫成覆寫；取出舊值再加回去。
- 新門市一來就遇到 `KeyError`：第一次還無鍵；明確指定初值 0。
- 代碼多了空白而分成兩組：先查來源約定，再選擇用 `strip()` 清理或拒收，不要默默改寫代碼。
