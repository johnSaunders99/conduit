---
id: cr-code-01
module: cr-code
order: 1
title: 澄清輸入與輸出
subtitle: 沒有事件要回什麼
status: ready
minutes: 25
level: 2
prereqs: []
objectives:
- 用最小輸入釐清重複事件要回傳什麼
- 寫出配對基準解並驗空輸入與三次出現
tags:
- 輸入契約
- 輸出契約
- 反例
- 基準解
resources:
- title: Amazon：校園數據職面試指引
  url: https://atoz.amazon/en-us/jobs/hiring-process/interview-prep/university/data
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀數據職期待，區分技術題與實際工作。
- title: 大陸數據開發面試自述
  url: https://www.nowcoder.com/feed/main/detail/a26b8971c9f943918860c405ce355714
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀一面追問，觀察同場如何切換題型。
concepts:
- id: cr-code-01-meaning
  prompt: 事件 E5 出現 3 次時，為何可能有三種合理答案？
  answer: 一種重複 ID、兩筆額外事件、三組不同位置的配對；要問輸出定義。
  mcq:
    question: 三個相同 ID，若要求不同位置的無序配對，一共有幾組？
    options:
    - '1'
    - '2'
    - '3'
    - '6'
    answer: 2
    explain: 位置對是 (0,1)、(0,2)、(1,2)，反向不再數。
- id: cr-code-01-empty
  prompt: 沒有配對時，空陣列與 0 哪個正確？
  answer: 依輸出型別；要列表就回空陣列，要配對數就回整數 0。
  mcq:
    question: 輸出契約已約定整數配對數，空輸入應回傳什麼？
    options:
    - None
    - 空陣列
    - 空字串
    - '0'
    answer: 3
    explain: 合法空輸入仍有一個整數答案；不要偷偷換回傳型別。
- id: cr-code-01-size
  prompt: 為何在動手前追問規模與能否修改輸入？
  answer: 規模影響是否能用成對掃描，能否修改原順序影響排序等方案。
  interview:
    question: 面試官說「找重送」，你會怎麼開始？
    answer: 我會先拿三筆同一 ID 問要回傳一種 ID、兩筆重送，還是三組配對。再確認 ID 的範圍、空輸入與筆數上限，寫一個小例子驗證約定。
    points:
    - 問題能改變程式行為
    - 用具體例子對齊
    - 知道規模影響方案
practice:
- id: cr-code-01-p1
  kind: code
  minutes: 8
  title: 交付可驗算的事件配對基準
  steps:
  - 存 event_pairs.py 與 contract.md；筆記只寫四項可改變程式的條件。
  - 對一個混有兩種 ID 的序列列出所有有效索引對。
  checks:
  - 腳本與紙上配對計數相同。
  - 空輸入回 0，不把自己或反向配對算進去。
---

## 先問對一個問題

面試官說：「從同日登入事件找重複。」不要立刻敲集合。拿 `E5, E5, E5` 問：要的是 1 種重複編號、原件之外的 2 筆重送，還是不同位置的 3 組配對？對方只要選一個數，往往比問「重複怎麼定義」更快。接著確認事件 ID 是全檔唯一範圍，或要連來源一起比較；最後問空輸入、輸出型別、是否可改順序與最大輸入。這些合起來是輸入／輸出契約（input/output contract），意指兩邊都能拿來驗算的規則。

這堂的約定是：收到一串已清洗的事件 ID，忽略時間，計同 ID 且左位置早於右位置的配對數。合法空輸入回整數 0，不修改原序列。不能把清洗責任偷偷加給配對函式；如果欄位可能空缺，要先說明由哪一層拒絕或另存，而不是把未知 ID 都視為同一事件。

## 基準解讓索引說話

在 `C:\dev\conduit-lab\coding` 存 `event_pairs.py`，於該資料夾執行 `py event_pairs.py`。基準解（baseline）重點是夠直接，可以當日後優化的核對答案，並不宣稱可直接跑大量輸入。

```python
def event_pairs(ids):
    pairs = 0
    for left in range(len(ids)):
        for right in range(left + 1, len(ids)):
            if ids[left] == ids[right]:
                pairs += 1
    return pairs

assert event_pairs([]) == 0
assert event_pairs(["E5"]) == 0
assert event_pairs(["E5", "E5", "E5"]) == 3
assert event_pairs(["E5", "E2", "E5"]) == 1
print(event_pairs(["E5", "E2", "E5"]))
```

右端從左端後一格開始，所以不會配自己，也不會把同一對倒著算。可以在紙上列出 E5 三次的有效配對，再對照輸出。若有 10 萬筆，不論鍵相不相同，這個版本都逐對比較，成本是平方。先讓基準解通過幾個足以分辨規格的例子，再在〈[雜湊計數限時題](#/lesson/cr-code-02)〉把同一契約改成一次掃描。

剩下的詢問應該以影響程式為準。如果已知不修改輸入、只回數量，就不用再問要不要列出每對索引；除非對方想把這當下一個變式。面試可以邊寫邊覆述：「我先確定可執行的小解，最後說明怎麼因應大輸入。」這句話要配得上你後來真的驗過的例子。

### 再用一個例子界定範圍

若序列為東區 E5、西區 E5、東區 E5，只按 ID 會回 3 組，按來源和 ID 回 1 組。如果追問後者，請明說輸入每列改成一個包含兩欄的元組，之後比較整個元組。等雙方同意，再考慮要不要用雜湊。若規格只需要配對總數，別用一個會建立所有索引對的列表才能加總；可能產生的輸出和記憶體又是另一種規模。

也要問「收到的順序」是否重要。只算無序位置對時，順序改變不會改變總數；改成報第一筆重送時，順序就會改變答案。先問這個有輸出差異的問題，再花時間問很少影響結果的細節。若面試官沒有額外線索，可以說出假設，再用空、單筆、兩種鍵及重送四類例子說明你的版本在哪個範圍正確。

## 常見錯誤

- 三筆同號回 1 → 定義的是重複鍵種類 → 先拿 1、2、3 對齊要的答案。
- 空輸入回錯誤訊息 → 把合法空況當讀檔失敗 → 按規格回 0。
- 小例通過就稱可處理任何規模 → 忽略比較數 → 回報上界並提出下一種解法。
