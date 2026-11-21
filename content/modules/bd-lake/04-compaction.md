---
id: bd-lake-04
module: bd-lake
order: 4
title: 合併與小檔整理
subtitle: 重寫後讀者仍看到完整版本
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-03
objectives:
  - 區分重寫數據檔、過期快照和清孤兒檔
  - 在壓實前後核對列多重集合與檔案數
tags:
  - 壓實
  - 小檔案
  - 檔案重寫
  - 孤兒檔
resources:
  - title: Apache Iceberg：維護作業
    url: https://iceberg.apache.org/docs/latest/maintenance/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 比較數據檔重寫與快照過期的影響。
concepts:
  - id: bd-lake-04-rewrite
    prompt: 壓實數據檔預期會改變什麼？
    answer: 在沒有其他業務更新時，改變物理檔案與掃描成本，不改符合條件的邏輯列。
    mcq:
      options:
        - 金額欄全改為小數
        - 檔案布局改變、邏輯列不變
        - 舊版本立刻不見
        - 合併後每個訂單只留一次
      answer: 1
      explain: 重寫不是去重、也不是過期作業。
    interview:
      question: 掃描 900 個小檔要 4 分鐘，你怎麼安全驗證壓實？
      points:
        - 固定讀取切點
        - 比檔數及查詢表現
        - 比逐鍵列並保留回查
      answer: 我先固定同一營業日與兩個可比較版本，比檔案數、已讀位元組與耗時。再比逐鍵數據，含重複筆數和刪除；回查需求沒滿足前，不會急著過期快照。
  - id: bd-lake-04-multiset
    prompt: 列數與加總都相同，足以證明等價嗎？
    answer: 不足，金額可在不同鍵之間互換；要比較逐列值與出現次數。
    mcq:
      options:
        - 足夠，兩個聚合覆蓋所有差異
        - 不足，需要逐列及重數
        - 足夠，只要檔少了
        - 不足，只需再比較檔名
      answer: 1
      explain: 同總和可以由不同的列組成。
  - id: bd-lake-04-lifetime
    prompt: 壓實後，能立即刪被替換的小檔嗎？
    answer: 不能用此次快照不再引用作為唯一條件；舊快照可能仍需舊檔。
    mcq:
      options:
        - 能，現在查不到即可
        - 能，保留大檔即可
        - 不能，先查保留與引用
        - 不能，表永遠不能回收檔案
      answer: 2
      explain: 重寫與快照清理是分開的工作。
practice:
  - id: bd-lake-04-p1
    kind: code
    title: 留下壓實前後的逐列核對
    minutes: 12
    steps:
      - 執行 compact_check.py，把檔數與比較結果保存至 compaction.md。
      - 把 after 裡兩個不同訂單的金額互換，再查看錯在哪。
    checks:
      - 原結果 3→1 檔、逐列相等。
      - 互換後列數 4、總額 135 仍相同，但逐列比較失敗。
---

## 每 15 秒一檔，是誰在付代價？

門市寫入每隔 15 秒就送一個小檔。查一天的總額，需要規劃多個檔案、發出多次開檔或請求、再解碼小量內容。即使總位元組不大，固定成本仍可能壓過運算。壓實（compaction，也叫小檔合併）會把適合的檔重寫成較少、較大的檔，再用新提交原子替換引用。先比較候選檔分布與讀取開銷，不用以「檔越大越好」為目標；太大的檔可能減少平行度。

壓實要尊重現有的刪除語義及並行提交。如果有另一個寫入者同時修改同一範圍，須用引擎提供的衝突驗證，不能把整個舊輸出覆蓋回去。若要評估這項維護本身，選沒有其他邏輯變更的前後版本，否則差異可能只是晚來一筆訂單。

## 用一個反例保住金額意義

在 `C:\dev\conduit-lab\lake` 存為 `compact_check.py`，PowerShell 執行 `py compact_check.py`；WSL 2 同資料夾用 `python3 compact_check.py`。標準函式庫模型（可用 RAM 0.25 GB），不跑 Iceberg 壓實引擎。每個內層清單代表一個檔，列的格式是「訂單、金額」。使用 `Counter` 比多重集合（multiset），也就是比較相同完整列各出現幾次；保留重複是刻意的。

```python
from collections import Counter

before = [[(1, 40), (2, 25)], [(3, 45)], [(2, 25)]]
after = [[(2, 25), (3, 45), (2, 25), (1, 40)]]

def rows(files):
    return [row for file in files for row in file]

a, b = rows(before), rows(after)
print("files", len(before), len(after))
print("rows", len(a), len(b), "amount", sum(v for _, v in a), sum(v for _, v in b))
print("equal", Counter(a) == Counter(b))
print("missing", Counter(a) - Counter(b), "extra", Counter(b) - Counter(a))
```

原結果檔案 3→1、列數 4、金額 135、逐列相等。把 after 裡訂單 1 與 3 的金額互換，總和仍為 135，但缺列及多出的列都會被列出。這比只問「壓實完成了嗎」更直接：假如今天得到不同內容，先停在驗證，不讓新檔數掩蓋錯誤。

實務上，檔重寫不等於釋出磁碟。舊快照的原檔可能仍用來追查；快照過期後才有機會回收不再引用的檔。孤兒檔（orphan file）是另一路徑，例如寫到一半失敗而沒納入提交的檔；清理窗須避開尚在執行的寫入，且確認使用的檔案路徑表示一致。

## 工程上如何選第一個整理範圍

先找一個高頻查詢、輸入已大致穩定的營業日，別從全倉或仍密集寫入的分區開始。記下同口徑查詢在維護前的候選檔、真正開檔數、讀取量、耗時與逐鍵結果；重寫後先用等價檢查擋住算錯，再反覆量讀取端，不把第一次暖身算成穩定收益。還要獨立記重寫本身的成本：它需要讀舊檔、寫新檔，短時間可能同時留兩組。如果節省的查詢只出現一次、寫入每天重新製造大量小檔，先調整上游輸出頻率可能更有效。逐列通過但耗時沒有改善，也是有用的結論；不需要為了湊出加速比例把歷史一起重寫。

## 常見錯誤
- 只看總額就通過 → 不同訂單間可能互換金額 → 比逐鍵完整列及重複次數。
- 新版檔少了就估算磁碟立即下降 → 舊快照仍保留引用 → 分開記錄快照保留與實際儲存。
- 一律傳全表重寫 → 無謂消耗 I/O 並干擾寫入 → 從熱點分區安排維護。
