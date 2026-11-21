---
id: cr-code-02
module: cr-code
order: 2
title: 雜湊計數限時題
subtitle: 先寫出小例子再優化
status: ready
minutes: 25
level: 2
prereqs:
- cr-code-01
objectives:
- 逐筆累加相同事件的配對數
- 在小輸入上用基準解核對
- 說出複合鍵如何改變業務定義
tags:
- 雜湊計數
- 字典
- 配對
- 限時
resources:
- title: Python：數據結構
  url: https://docs.python.org/3/tutorial/datastructures.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Dictionaries，核對字典鍵與 get。
- title: NeetCode 150 練習清單
  url: https://neetcode.io/practice/practice/neetcode150
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 從 Arrays & Hashing 挑頻率題再限時重做。
concepts:
- id: cr-code-02-increment
  prompt: 第三筆同 ID 到達時，本輪新增幾個配對？
  answer: 2 個，分別配上之前兩筆；舊配對不必重算。
  mcq:
    question: 之前已有 3 筆 E1，下一筆 E1 增加多少配對？
    options:
    - '0'
    - '1'
    - '3'
    - '6'
    answer: 2
    explain: 新一筆只與已有的三筆組對；6 是四筆的累計。
- id: cr-code-02-update
  prompt: 為何先讀舊次數、加進答案，再更新字典？
  answer: 舊次數只表示之前出現的列，更新後才讀會把自己配進去。
  mcq:
    question: 若先把 seen[E1] 更新成 1 再把它加進答案，第一次出現有何結果？
    options:
    - 多算 1 對
    - 少算 1 對
    - 正確為 0
    - 只影響排序
    answer: 0
    explain: 第一次不該有對，卻把當前列當作既有列。
- id: cr-code-02-scaling
  prompt: 為何不能只報 O(1) 記憶體？
  answer: 配對計數變數是固定個數，但字典存 u 種鍵，需要 O(u) 額外位置。
  interview:
    question: 如果每來源獨立發號，你怎樣改解並證明沒混在一起？
    answer: 我改用來源與 ID 的元組當鍵；其餘轉移不變。用東區 A、西區 A、西區 A 核對只新增一對，不會得到三對。
    points:
    - 鍵隨定義修改
    - 不改既有轉移
    - 給出異來源反例
practice:
- id: cr-code-02-p1
  kind: code
  minutes: 10
  title: 限時交付一次掃描
  steps:
  - 遮住範例，留 3 分鐘手算、7 分鐘實作與核對。
  - 把新函式與最小失敗例存進 timed_pairs.py。
  checks:
  - 三筆同號回 3；兩種鍵混合時可以手列配對。
  - 能說明先查舊次數的原因。
---

## 每來一筆，只處理它帶來的新配對

延續〈[澄清輸入與輸出](#/lesson/cr-code-01)〉：每對位置只算一次，但今天有很多筆。想像掃描到第三筆同號事件，先前兩筆已互配過；這一刻只新增第三筆與之前各一筆的兩對。把「以目前位置作右端」當計數規則，便不用在新的迴圈裡重跑左端。字典記每個 ID 在目前位置之前出現幾次，而總數只累計已經走過的右端。

先拿 A、B、A、A 手追。前兩筆沒有歷史同號，所以依序加 0、0；第三筆加 1，第四筆加 2，答案是 3。每一對都有唯一的較晚位置，所以不可能被兩輪計入。先把舊次數加到總數，再把這個 ID 的出現次數加一。這和只問有重複時可以提早回傳不同；這次仍要讀完。

## 寫完用小輸入刻意挑錯

在 `C:\dev\conduit-lab\coding` 存 `timed_pairs.py`，於該資料夾執行 `py timed_pairs.py`。把基準留在同檔，避免核對依賴別的練習檔案。

```python
def count_pairs(ids):
    seen = {}
    pairs = 0
    for event_id in ids:
        prior = seen.get(event_id, 0)
        pairs += prior
        seen[event_id] = prior + 1
    return pairs

def baseline(ids):
    return sum(ids[i] == ids[j] for j in range(len(ids)) for i in range(j))

cases = [[], ["A"], ["A", "A", "A"], ["A", "B", "A", "A"], ["A", "B", "B", "A"]]
for ids in cases:
    assert count_pairs(ids) == baseline(ids), ids
print(count_pairs(["A", "B", "A", "A"]))
```

面試時間緊時，先寫三筆同號和單筆反例，這對測試很快抓到「先更新再計算」。固定大小的鍵下，典型是 `O(n)` 時間、`O(u)` 額外空間，其中 `u` 是不同 ID 數。若 ID 只在來源內唯一，請用來源與 ID 的元組當鍵；先測跨來源同號不互配，再測某個來源內的重送還算得出來。

如果輸出改成所有配對，而不只是總數，字典的值要改成歷史位置清單。每次除了新增目前位置，還得列出每個對應位置。最壞可能有平方個輸出，所以不能保留原來的線性時間宣稱。這種回答比遇到變式就說「同樣用字典」更能顯示你知道瓶頸在哪裡。

### 把口頭證明放在程式旁

想像目前正處理第四列。字典若保存到第三列為止的次數，新增量就不會包含自己；答案累計的是所有右端在第三列及之前的配對。因此完成加總和更新後，兩個敘述同時推進一格，下一輪仍適用。把它用一句話寫在紙上，比說「用字典所以變快」多回答了正確性，也能在程式卡住時回頭找哪個變數含義變了。

時間盒內若先寫完，別只重跑成功例。試著暫把加總移到更新之後，用單筆案例確認測試會抓錯，再恢復順序。若基準解也沿用同一個字典，它可能在兩處犯同樣的錯；一個逐對比較的慢解和一張手算表更適合作獨立對照。要比較效能時不要用慢解完成大檔的時間來代表真實管道，只比較你指定的輸入與運算。

## 常見錯誤

- 一筆輸入就回 1 → 更新順序錯誤 → 先累加舊次數。
- 每次發現重送只加 1 → 算到的是額外列，而非位置對 → 改為加上全部歷史同號次數。
- 過早說空間是常數 → 忘掉字典 → 把不同鍵數記在複雜度旁邊。
