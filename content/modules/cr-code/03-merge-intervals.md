---
id: cr-code-03
module: cr-code
order: 3
title: 區間合併
subtitle: 邊界相接要不要合成一段
status: ready
minutes: 25
level: 2
prereqs:
- cr-code-02
objectives:
- 用半開區間釐清相接與重疊
- 排序後合併重疊區間
- 以包覆區間驗證右界不會縮短
tags:
- 區間合併
- 半開區間
- 重疊
- 排序
resources:
- title: Python：排序指南
  url: https://docs.python.org/3/howto/sorting.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 sorted 與原地 list.sort 的差別。
- title: 大陸數據開發面試自述
  url: https://www.nowcoder.com/feed/main/detail/a26b8971c9f943918860c405ce355714
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 區分合併與移除最少重疊區間的輸出。
concepts:
- id: cr-code-03-touch
  prompt: '[1,3) 和 [3,5) 是否共享時間？'
  answer: 不共享；前者不含 3。是否合併相接段則由業務另定。
  mcq:
    question: 半開區間只合併重疊，前段右端是 3，新段起點也是 3，怎麼做？
    options:
    - 必須合併
    - 另開一段
    - 移除新段
    - 把兩段截成 [3,3)
    answer: 1
    explain: 相等只代表相接，不是共享時間。
- id: cr-code-03-right
  prompt: 新段完全包在目前區間內時右界如何更新？
  answer: 取兩個右界的最大值，避免縮短涵蓋範圍。
  mcq:
    question: 已保留 [1,9)，新段是 [3,4)，合併後是？
    options:
    - '[1,9)'
    - '[1,4)'
    - '[3,9)'
    - '[3,4)'
    answer: 0
    explain: 舊區間已覆蓋新段；起點仍用舊起點，右端取最大值。
- id: cr-code-03-sort
  prompt: 為何排序後只需看最後一段？
  answer: 先前不相接且不重疊的段，其右端已不會再被較晚的起點碰到。
  interview:
    question: 相接的兩次故障算兩件還是一件？
    answer: 我先把重疊的時間定義成半開區間，再問要算獨立事故還是連續不可用時間。前者可能保留相接事件，後者可以合併相接，我會把兩個判斷分開測。
    points:
    - 區分口徑與端點
    - 提出邊界反例
    - 不擅自改業務規則
practice:
- id: cr-code-03-p1
  kind: code
  minutes: 9
  title: 驗證三種區間關係
  steps:
  - 執行 merge_windows.py。
  - 把空輸入、相接、包覆、部分重疊各寫一個斷言。
  checks:
  - 只合併重疊時，[1,4) 與 [4,6) 是兩段。
  - 包覆段不會縮掉已保存的右界。
---

## 報表停了多久，與工單開了幾張是兩件事

維運收到幾段停機窗口，不可把每張工單的時間直接相加：兩個來源可能為同一段時間各報一次。用半開區間（half-open interval）`[start, end)` 表示含起點、不含終點。這意味著 `[1,4)` 和 `[4,6)` 沒有重疊，但確實相接。算整段不可用時間可以合成一段；若規格要求保留相接的區段，就只能在新起點小於前段右端時融合。題目若要計工單數，合併結果也不能代替原工單索引。

先依起點排序，從左往右維護已合併的片段。每遇新段，只需和最後一段比。若未達重疊條件，另開；若重疊，保留最早起點，把右界擴到兩者最大值。前面的段已和最後一段分開，更晚的起點也不可能碰到它們。這個維護條件是不變量（invariant）：每一步後都是真的，最後也是真的。只寫 `end` 而忘了舊右界，包覆例就會出錯。

## 同一份樣本，切換相接規則

在 `C:\dev\conduit-lab\coding` 存 `merge_windows.py`，於該資料夾執行 `py merge_windows.py`。只接受起點嚴格小於終點的整數分鐘區間。

```python
def merge_windows(windows, join_touching=False):
    merged = []
    for start, end in sorted(windows):
        if start >= end:
            raise ValueError("start must be before end")
        if not merged:
            merged.append((start, end))
            continue
        left, right = merged[-1]
        if start < right or (join_touching and start == right):
            merged[-1] = (left, max(right, end))
        else:
            merged.append((start, end))
    return merged

windows = [(4, 6), (1, 4), (2, 3)]
assert merge_windows(windows) == [(1, 4), (4, 6)]
assert merge_windows(windows, join_touching=True) == [(1, 6)]
assert merge_windows([]) == []
print(merge_windows(windows))
```

排序花 `O(n log n)` 時間，後面的掃描花 `O(n)`，此實作的排序副本與輸出至多各有 n 個區間。不保留合併後的區間、只要停機分鐘總數時，還可以在關閉當前段時累加，但仍須先有按起點排列的輸入。如果被問「最少拿掉幾段才不重疊」，那是另一個目標，不能把合併後的段數直接當答案。遇到兩題字眼很像，先說清楚你最後要交的是一個整數，還是一份區間清單。

### 核對一次連續擴張

把 `[2,6)、[4,8)、[7,10)` 依序放進去。第一個重疊擴到 8，因此下一個從 7 開始仍能合併。若比對時每次都用了最初的右端 6，就會錯把最後一段另開。合併過程必須更新「目前聯集」的右界，不能只記上一筆原始輸入。再加一段 `[12,13)`，它與前面有空隙，所以最後維持兩段。

若要用日期與時間而非整數分鐘，先把所有端點統一成同一時區與精度，再比較。否則字串看似能排序，未必代表實際時間先後；同一時刻也可能寫成不同格式。這堂把端點當同一條時間軸上的整數，先把演算法說清楚，沒有處理跨日時間解析。測試時先用包覆、交疊、相接、完全分離四對，避免幾個成功例都只測到同一條分支。對只合併重疊的版本，另外把輸出再餵回函式，結果應保持不變；若仍有重疊，表示前一輪沒有維護好右界。

## 常見錯誤

- 掩蓋過的舊區間尾巴消失 → 沒取較大右界 → 用 `max(right, end)`。
- 相接被當必然重疊 → 忘了數據採半開區間 → 先用等端點的反例對齊定義。
- 跳過排序卻只看最後一段 → 未維持起點有序 → 先排序或驗證上游保證。
