---
id: fd-data-02
module: fd-data
order: 2
title: 集合與去重
subtitle: 同一個訂單號只記一次
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-01
objectives:
  - 用集合辨認重送的訂單
  - 分別以交集和差集比對兩批訂單
  - 保留訂單首次出現的順序
tags:
  - 集合
  - 去重
  - 交集
  - 差集
resources:
  - title: Python 教學：集合
    url: https://docs.python.org/3/tutorial/datastructures.html#sets
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看空集合、成員測試與四種集合運算。
concepts:
  - id: fd-data-02-membership
    prompt: '`in` 用在集合時回答什麼？'
    answer: 這個值是不是成員，回傳布林值。
    mcq:
      question: 新建空集合應用哪個？
      options:
        - '`{}`'
        - '`[]`'
        - '`set()`'
        - '`()`'
      answer: 2
      explain: 其他三項依序是空字典、列表、元組。
  - id: fd-data-02-compare
    prompt: 怎麼找只在第一批出現的鍵？
    answer: '`first - second`，方向不能交換。'
    mcq:
      question: 同時在兩批才算，該用什麼？
      options:
        - '`first - second`'
        - '`second - first`'
        - '`first | second`'
        - '`first & second`'
      answer: 3
      explain: 交集才要求兩邊都有；差集排除另一邊，聯集接受任一邊。
  - id: fd-data-02-keep-first
    prompt: 如何去重又保留首次出現的順序？
    answer: 用集合記見過的成員，用列表保存依序首次出現的鍵。
    mcq:
      question: 為何要另外保留原始列表？
      options:
        - 才能查出重送次數和原順序
        - 才能用 `in` 檢查集合
        - 集合會改寫原列表
        - 集合只接受一筆訂單
      answer: 0
      explain: 集合只保存不同成員，不保存重複的次數或原順序。
practice:
  - id: fd-data-02-p1
    kind: hands-on
    title: 保存訂單重送比對
    minutes: 9
    steps:
      - 在 B 批加入 S02 的 O21，印去重清單及交集。
      - 再在 B 批重複加入同一組鍵，比對原始筆數與交集。
    checks:
      - 交集第一次增加 1 組；第二次不變。
      - B 批的原始筆數兩次都會增加。
---

## 數重送，還是數訂單？

第一批有 4 列，第二列和第三列是同一組「門市、訂單號」。若只是重新投遞，我們想在訂單名單裡只列一次，卻仍要留著原始紀錄，以便解釋為何匯入時有 4 列。集合（set）只保留不同的成員，適合回答「見過沒」，不能拿來還原重送過程。

## 語法速查

- `set()` 建空集合；`{("S01", "O21")}` 建一個有成員的集合；`set(batch)` 從現有列表取不同成員。`{}` 不是空集合。
- `key in seen` 檢查有無，`seen.add(key)` 記為見過；重加同一值不會多一項。
- 交集（intersection）`a & b` 是兩邊都有；聯集（union）`a | b` 是至少一邊有；差集（difference）`a - b` 是左邊有而右邊沒有；`a ^ b` 是剛好只在一邊出現。

集合沒有可依賴的輸入順序，也不能用索引拿第一筆。成員必須是可雜湊（hashable，大陸也稱可哈希）的值：在本例用兩個字串組成的元組，不用可增刪的列表來當鍵。若接著要按門市累計件數，而不是只記一個「有」，[〈字典與累計〉](#/lesson/fd-data-03)會改用能給每個鍵存一個值的容器。

## 跑一次，再加一筆重送

在 `C:\dev\conduit-lab\python-data` 存 `dedupe_orders.py`，執行 `py dedupe_orders.py`。`sorted()` 先當作讓代碼依固定順序顯示的工具，下一步會在[〈排序鍵〉](#/lesson/fd-data-05)拆開看。

```python
batch_a = [("S01", "O21"), ("S01", "O22"), ("S01", "O22"), ("S02", "O21")]
batch_b = [("S01", "O22"), ("S03", "O05")]
seen = set()
first_seen = []
for key in batch_a:
    if key not in seen:
        seen.add(key)
        first_seen.append(key)

other = set(batch_b)
print("raw/unique:", len(batch_a), len(first_seen))
print("first seen:", first_seen)
print("both:", sorted(seen & other))
print("only A:", sorted(seen - other))
```

第一行是 `4 3`；首次清單中的 O22 只出現一次，兩間門市的 O21 則各保留一筆。交集只有 S01 的 O22；只在 A 的是兩間門市的 O21。現在想像你只看交集：無法知道 O22 在 A 原本出現 1 次還是 100 次。這就是保留來源與輸出兩份數據的理由。若兩列鍵相同但金額不同，也不能直接把後者當重送丟掉；先問來源究竟是重送還是更正，才能訂保留第一筆或最後一筆的規則。

### 先把問題改寫成「哪邊有」

若告警說「A 有、B 沒有」，紙上先圈出 A 而不是先合併兩批。用這組來源，`other - seen` 只會找到 S03 的 O05；前後方向分別代表補抓哪一邊，選錯方向可能補抓已經到貨的那份檔。相反地，若要計算兩批合計多少不同訂單，用聯集可得到 4 組，不是兩邊不同數相加的 5 組。少的那一組正是交集中的 O22。

這裡集合的大小只表示不同鍵的數量。若要回答「每個門市送了幾次」，應走訪原始列表，重送也要計數；若回答「這批有幾個不同門市」，集合成員要改用門市代碼，而不是整組訂單鍵。決定集合裡放什麼，就是決定你在數哪一種身分。核對時挑一筆同門市不同單、一筆同單號不同門市，不要只測四個全都不同的鍵。

遇到欄值較複雜的重送，先把可比較的身分抽成鍵。不要把整列所有欄位都當成訂單的身分，否則只改備註也可能被誤判為新單。

## 常見錯誤

- 列印順序變了就以為數據少了：先比較成員；有展示順序要求再額外排序。
- 問「只在 B」卻輸出 A 的項目：差集方向寫反，應用 `other - seen`。
- 將 `batch_a` 原地改成去重結果：失去了重送證據，改用不同變數存。
