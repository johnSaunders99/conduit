---
id: fd-algo-03
module: fd-algo
order: 3
title: 雜湊與集合
subtitle: 一次掃描找重複編號
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-02
objectives:
- 用集合回報第一個重送事件
- 用不同鍵的數量估算記憶體
tags:
- 雜湊
- 集合
- 字典
- 事件去重
resources:
- title: Python：數據結構
  url: https://docs.python.org/3/tutorial/datastructures.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 Sets、Dictionaries 與可當鍵的值。
- title: Open Data Structures
  url: https://opendatastructures.org/ods-python/
  kind: book
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀 Hash Tables 的查找與碰撞。
concepts:
- id: fd-algo-03-seen
  prompt: 找第一個重送為何先檢查再加入？
  answer: 集合表示之前看過的編號；先加會把目前這筆也算進歷史。
  mcq:
    question: 順序為 E7、E2、E2、E7，第一個重送是哪個？
    options:
    - E7
    - E2
    - 兩者同時
    - 無重送
    answer: 1
    explain: 第二筆 E2 先於第二筆 E7 到達；不是最早第一次出現的編號。
- id: fd-algo-03-key
  prompt: 為何清單不能直接當字典鍵？
  answer: 清單不可雜湊；由可雜湊元素組成的元組可用於複合鍵。
  mcq:
    question: 事件 ID 只在來源內唯一，哪個鍵避免跨來源誤合併？
    options:
    - 全轉成同一來源
    - 只用事件 ID
    - 用來源與事件 ID 的元組
    - 只用來源
    answer: 2
    explain: 兩個欄位一起決定身分；只看任一欄會混在一起。
- id: fd-algo-03-memory
  prompt: n 筆只有 u 種編號，集合最多保留多少鍵？
  answer: 至多 u 個；若每筆不同，u 才等於 n。
  interview:
    question: 去重程式的記憶體一直漲，你會先看什麼？
    answer: 我先看不同鍵數和去重範圍。確認業務允許後才設定過期；若不能漏跨批重送，就要改用可持久查找的方案。
    points:
    - 看唯一鍵數
    - 確認去重範圍
    - 說明過期代價
practice:
- id: fd-algo-03-p1
  kind: code
  minutes: 8
  title: 驗證跨來源不撞號
  steps:
  - 執行 first_replay.py。
  - 用一份副本暫改成只按 ID 查找，再和原本結果比較。
  checks:
  - 空輸入回 None。
  - 前兩列用複合鍵不算重送，只按 ID 則誤判。
---

## 用已見過的鍵做一次掃描

每日登入匯出偶爾重送事件。你要找到掃描時第一個發現的重複，而不是找字母順序最早的事件。逐筆與歷史所有列比較可能走到平方級；雜湊表（hash table，中國大陸也稱哈希表或散列表）把鍵的雜湊值用作查找位置的線索，再核對鍵是否相等。不同鍵可能得到相同位置，這叫碰撞（collision），不代表兩筆事件相同。Python 的集合與字典已負責處理這件事，不需要把雜湊值拿來當業務 ID。

先選容器：集合（set）回答「見過嗎」，用 `set()` 建立，`key in seen` 測是否已存在，`seen.add(key)` 登記。字典（dictionary）還能回答見過幾次或第一次在哪裡；用 `counts.get(key, 0)` 讀取沒有時的預設值，再存回。某鍵共 3 次，總次數是 3，以第一筆為原件的額外重送次數是 2。兩種統計不要共用一個含糊的欄名。

## 把身分範圍寫進鍵

在 `C:\dev\conduit-lab\algorithms` 建立 `first_replay.py`，於該資料夾執行 `py first_replay.py`。東、西兩個來源各自發號，事件身分是兩欄組合；兩欄都相等才算重送。

```python
def first_replay(events):
    seen = set()
    for source, event_id in events:
        key = (source, event_id)
        if key in seen:
            return key
        seen.add(key)
    return None

rows = [("east", "E2"), ("west", "E2"), ("west", "E2"), ("east", "E2")]
assert first_replay(rows) == ("west", "E2")
assert first_replay([]) is None
assert first_replay(rows[:2]) is None
print(first_replay(rows))
```

掃到第 2 筆時，雖同是 E2、來源不同，所以尚未重送。第 3 筆才命中。把輸入順序與集合用途分開：輸入決定先後，集合只做查找，不用走訪集合來還原順序。若要指出重送發生的位置，可以在迴圈裡記下列號，並寫清從 0 或從 1 開始。〈[澄清輸入與輸出](#/lesson/cr-code-01)〉會用反例鎖定這類輸出契約。

對固定大小的鍵，查找和加入通常均攤接近常數，因此一次掃描通常是線性時間，不能宣稱所有情況都保證常數。額外空間隨儲存的不同鍵數增加。假如把集合放在函式裡，下次處理另一個檔案時集合會重建；這不會避免跨檔重送。界線是每天、每個來源，還是一段保留期，要先按業務定義。舉例，如果允許隔天補送前一天的事件，只在午夜清空就可能算兩遍。換一個容器不會替你解除這項限制。

### 用相同事件做三種輸出

拿 `A、B、A、A` 寫成一張追蹤表。集合看見第三列就能回報第一個重送；字典若走到結尾，A 總共有三列。若請求變成「列出每種鍵的額外重送數」，輸出 A 對應 2，B 對應 0，不能看見第三列就停止。也可以問是不是要所有相同位置的配對；四列中 A 有三組配對，和兩筆額外重送不同。

再把第一個 A 的來源設成 east，後面兩個設成 west。只按 ID 會錯把來自兩處的事件合起來；只按來源則會連不同編號也合起來。這個反例能測出鍵的兩種錯法。若真實輸入缺來源，不要把所有未知都視為同一來源；由契約決定拒絕、隔離，或使用另一個有證據的鍵。

## 常見錯誤

- 第一筆就說重複 → 先加入再查找 → 把 `in` 判斷移到 `add` 之前。
- 用 `{}` 後沒有 `add` → 那是空字典 → 改用 `set()`。
- 跨來源莫名少一列 → 鍵少了來源 → 用元組保留身分範圍。
