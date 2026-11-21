---
id: cr-code-04
module: cr-code
order: 4
title: 串流 Top K
subtitle: 輸入不能一次全部載入
status: ready
minutes: 25
level: 2
prereqs:
- cr-code-03
objectives:
- 從逐列產出的延遲分數維護固定大小候選
- 與全排序小樣本比對相同順序
- 區分已有分數與尚待彙總的計數問題
tags:
- 串流
- Top K
- heapq
- 一次掃描
resources:
- title: Python：heapq
  url: https://docs.python.org/3/library/heapq.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 nlargest 的 key 與適用範圍。
- title: Python：CSV 讀寫
  url: https://docs.python.org/3/library/csv.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 DictReader 如何逐次交付一列。
concepts:
- id: cr-code-04-linear-consume
  prompt: 為何不要先做 list(reader)？
  answer: 它會收集全部輸入，使原可只保留 K 筆的方案多用線性空間。
  mcq:
    question: 數據來源只允許走訪一遍，何者仍可核對？
    options:
    - 先數行再用相同迭代器掃第二遍
    - 先 sorted，再說沒有存完整數據
    - 在線更新固定大小候選；另用小樣本核對
    - 先任意捨棄一半輸入
    answer: 2
    explain: 每列只讀一次；全排序基準另用可重建的小樣本。
- id: cr-code-04-scored
  prompt: 原始店家事件能直接套固定 K 堆求精確計數嗎？
  answer: 不能；晚到事件會提高店家累計，通常需要另外保存或外移每店狀態。
  mcq:
    question: 若晚到事件會改變店家總分，何者是本課堆解的正確前置？
    options:
    - 只保留前 K 個店名
    - 不斷把同店新分數追加成新候選
    - 只讀前 K 筆事件
    - 先取得每店的最終總分
    answer: 3
    explain: 不在候選堆的店也可能再上升，早丟掉歷史不能保證精確。
- id: cr-code-04-tie
  prompt: 平手如何保證多次輸出相同順序？
  answer: 用固定的次排序鍵並讓候選比較與輸出遵守同一規則。
  interview:
    question: 輸入每天上億列，你會說這個程式能上線嗎？
    answer: 不會。我只能保證候選大小，還要看解析、磁碟、上游是否已算好分數，以及真實延遲和資源量測。
    points:
    - 區分候選與端到端空間
    - 知道上游前提
    - 不過度宣稱
practice:
- id: cr-code-04-p1
  kind: code
  minutes: 9
  title: 從單次輸入留下一份延遲榜
  steps:
  - 執行 delay_top.py。
  - 修改輸入，把最高延遲移到最後，核對候選能取代堆頂。
  checks:
  - 以延遲降序、批次號升序列出前 2。
  - K 大於筆數時保留全部，不需第二次讀取。
---

## 串流讀取不代表每個問題都能只留 K 筆

每日作業輸出一列一個批次的最終延遲，監控要找最慢的 K 筆。串流（streaming）在這題只指一列列讀進來，不意味著使用實時引擎。迭代器（iterator）每次交付下一個元素，可能只能消耗一次。把它轉成 `list` 或直接全排序會先收下所有列；若分數已定案，〈[堆積與 Top K](#/lesson/fd-algo-07)〉的最小堆就能只保留候選。延遲越高越前，平手時較小的批次號領先。

先說清楚另一種題目：「找今天訂單最多的 K 間店」，但輸入是原始訂單。尚未上榜的店也可能在尾端收到很多筆；如果把它的舊計數丟掉，最後就不精確。應先按店彙總，或讓外部儲存承擔狀態，再於已定案的分數上選前 K。這是兩階段，不是把原始事件直接餵進同一個堆。

## 用單次輸入驗名次

在 `C:\dev\conduit-lab\coding` 存 `delay_top.py`，於該資料夾執行 `py delay_top.py`。用 `iter(rows)` 建一個只能從頭到尾消耗一次的來源；另用小清單算全排序作對照。這堂使用標準庫的 `nlargest`，面試若要求手寫，仍應能說出何時進堆和換堆頂。

```python
from heapq import nlargest

def rank(row):
    batch_id, delay_ms = row
    return delay_ms, -batch_id

def worst_delays(rows, k):
    if k <= 0:
        return []
    return nlargest(k, rows, key=rank)

rows = [(3, 30), (7, 90), (2, 90), (5, 10)]
source = iter(rows)
result = worst_delays(source, 2)
assert result == sorted(rows, key=rank, reverse=True)[:2]
assert result == [(2, 90), (7, 90)]
assert next(source, None) is None
print(result)
```

輸出順序也算契約，不能只比相同批次集合。有相同延遲時，同一把比較鍵要同時用於保留與交付。若數據真的來自 CSV，先把毫秒與批次號解析為整數；字串排序可能讓 90 排在 100 前面。小樣本把所有數據放在記憶體只是驗算，不是生產讀法；實際計算可把從檔案逐列解析的迭代器傳給函式。別為了先問長度把迭代器耗盡。

### 請解釋榜尾為什麼會變

將例中的高分移到最後，不該讓結果變差。對容量 2，一開始的兩筆會填滿候選；第三筆若分高於目前第二名，就淘汰第二名。後來相同分數是否替代，要按批次號比。從這個過程可以說明為何最大延遲落在尾端也不會漏掉，也可以驗證你不是只留下開始的 K 筆。在此單次來源上，典型堆解每筆至多調整一次；時間上界 `O(n log(K+1))`，候選佔 `O(K)`。實際上函式可能針對特例採不同路徑，最容易驗的是沒有把整個來源先變成清單。

若分數不是一列就能定案，先提出一個三筆反例：店甲早期略領先，店乙的兩筆分散在頭尾，合在一起才超過甲。原始列不能直接當排名分數，也不能在乙暫時不在榜時把它的歷史丟掉。要精確交付，先明確哪一個元件負責全量狀態，再談候選維護的空間。

## 常見錯誤

- 大檔突然吃滿記憶體 → 呼叫前先把迭代器轉成陣列 → 直接傳遞逐列來源。
- 平手有時換榜 → 比較不含明確次鍵 → 補上批次 ID 排序規則。
- 說解法能替代彙總 → 混淆既有分數和持續更新 → 分開測兩個階段。
