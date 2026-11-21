---
id: fd-algo-10
module: fd-algo
order: 10
title: 遞迴與動態規劃
subtitle: 先辨認重複子問題
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-09
objectives:
- 寫出補跑分段方法數的狀態與初值
- 比較直接遞迴、記憶化和由小到大填表
- 依錯因排一週的簡單到中等練習
tags:
- 遞迴
- 動態規劃
- 記憶化
- 狀態轉移
resources:
- title: Python：functools
  url: https://docs.python.org/3/library/functools.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 cache 如何重用相同參數的結果。
- title: NeetCode 150 練習清單
  url: https://neetcode.io/practice/practice/neetcode150
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 選 Arrays & Hashing、Heap 和 1-D DP。
- title: LeetCode 面試練習清單
  url: https://leetcode.com/problem-list/top-interview-questions/
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 先挑免費簡單題，再選同類中等題驗遷移。
concepts:
- id: fd-algo-10-state
  prompt: ways[n] 代表什麼？
  answer: 用長度 1、2 的有序區段恰好覆蓋 n 天的方法數。
  mcq:
    question: 為什麼 ways[0] 是 1？
    options:
    - 不選任何區段就恰好覆蓋零天
    - 零天可以補跑任意多次
    - 為了避免索引錯誤
    - 因為零天等於一天
    answer: 0
    explain: 空序列是恰好覆蓋零天的一種做法，不是沒有合法做法。
- id: fd-algo-10-reuse
  prompt: 直接遞迴慢在哪裡？
  answer: 不同呼叫路徑會遇到相同剩餘天數，從頭重算同一答案。
  mcq:
    question: 填 ways[4] 前至少要求哪兩格？
    options:
    - ways[0] 與 ways[1]
    - ways[4] 與 ways[5]
    - ways[1] 與 ways[2]
    - ways[2] 與 ways[3]
    answer: 3
    explain: 最後一段長 1 或 2，因此前綴長 3 或 2。
- id: fd-algo-10-order
  prompt: 由小到大填表有什麼好處？
  answer: 算目前格時依賴已經存在，不須建立遞迴呼叫鏈。
  interview:
    question: 你為什麼把補跑分段題判成動態規劃，而非貪心？
    answer: 我要數所有可行分段，不是選一個最大的段長。先按最後一段長度分成不重疊的兩類，再復用前綴答案。
    points:
    - 狀態用完整句定義
    - 最後一步分類互斥
    - 初值有業務意義
- id: fd-algo-10-bit-cost
  prompt: 只報線性時間時，要說明哪個計量假設？
  answer: 以加法次數計；如果答案非常大，還須考慮整數位數。
  mcq:
    question: 方法數逐步超出固定寬度整數時，哪項說明最準確？
    options:
    - 整數位數不影響任何操作
    - 加法次數仍為線性，但一次加法可能更貴
    - 填表一定變為平方時間
    - 動態規劃不再適用
    answer: 1
    explain: 次數與一次操作的成本不同，不能由位數直接判定整體為平方。
practice:
- id: fd-algo-10-p1
  kind: code
  minutes: 9
  title: 驗證空序列並留練習表
  steps:
  - 執行 backfill_ways.py。
  - 手列 4 天的覆蓋方式，再在 algo-plan.md 排下週 4 次練習與複習日。
  checks:
  - 4 天共 5 種，空範圍有 1 種。
  - 練習表記錯因與隔日重做，而非只打勾。
---

## 最後一段決定前面在算什麼

排程支援每次補跑 1 天或 2 天。要恰好覆蓋連續 4 天且不重疊，一共有幾種分段？1 天後接 2 天和反過來是不同的做法。遞迴（recursion）讓函式用更小的同類問題求解；每次需逼近能直接作答的基底情況（base case）。空範圍恰有一個空做法，一天則只可用一段。對更長範圍，把最後一段拿掉，之前是長度少 1 或少 2 的相同問題；兩類不重疊，所以相加。

直接遞迴求 4 天會算 3 天和 2 天，而求 3 天又會再算 2 天。動態規劃（dynamic programming，DP）只求一次各種長度：定義狀態（state）為「覆蓋前 n 天的方法數」，再用狀態轉移（state transition）從前兩格算出這格。記憶化（memoization）保留每次呼叫的結果；若已知道順序，由小到大填表就不必走遞迴呼叫鏈。

## 先列小答案再填表

在 `C:\dev\conduit-lab\algorithms` 存 `backfill_ways.py`，於該資料夾執行 `py backfill_ways.py`。本練習只接受非負整數天數。

```python
def slow(days):
    if days <= 1:
        return 1
    return slow(days - 1) + slow(days - 2)

def table(days):
    counts = [1] * (days + 1)
    for n in range(2, days + 1):
        counts[n] = counts[n - 1] + counts[n - 2]
    return counts

assert table(4) == [1, 1, 2, 3, 5]
assert all(table(n)[-1] == slow(n) for n in range(8))
print(table(4))
```

填表只做線性次加法、保存線性個整數；若只要最後一格可滾動保留兩個值。這是用操作次數和整數個數計算，對非常大的答案，整數位數也會成長。基準遞迴只拿來核對小例子，不要拿大天數等它跑完。題目若改成最少啟動次數，狀態不再是方法數，轉移也要從相加改成比較方案。

## 一週面試練習

用下方免費清單選題：第 1 天做雜湊；第 2 天做已排序雙指標；第 3 天做排序後找二分界線；第 4 天做最小堆選前 K；第 5 天做一維 DP；第 6 天從最常錯的類型挑一道中等變式。每次先手算一個反例，再計時寫解，隔天不看答案重做失敗處。免費題目可直接閱讀，外站提交不是必需；若遇付費題，換同類開放題即可。大陸數據開發面試可用這些題練說明成本，但不要因此減掉 SQL 手寫與專案追問的練習。

### 用初值找出錯的合併規則

2 天可以是兩段單日，也可以一段雙日。3 天則可寫成單日、單日、單日；單日、雙日；雙日、單日。先人工列這兩組，等於測了初值有沒有漏掉整段雙日，以及是否誤把不同順序合成一種。若題目變成「允許 1 天或 3 天」，最後一段不再有兩日選項，不能只改表格大小。先寫兩種前綴各少多少，並說明負長度沒有合法覆蓋，再拿剛好 3 天測是否兩種都算到了。

練新題的門檻是能自己用一個句子寫出狀態，而不是記得它像哪一道題。重做時遮住程式，只留目的、基底與轉移；如果只能背輸出，先回頭手列一組。

## 常見錯誤

- 空範圍回 0 → 把不出手的一種方法漏掉 → 手列 0 天與 2 天對照。
- 只會背公式 → 沒說一格代表什麼 → 先用一句話寫出狀態與最後一步。
- 拿慢解跑大輸入 → 重複展開相同子題 → 只讓基準核對小例。
