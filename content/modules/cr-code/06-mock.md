---
id: cr-code-06
module: cr-code
order: 6
title: 模擬程式面試
subtitle: 留下複雜度與最小失敗案例
status: ready
minutes: 25
level: 2
prereqs:
- cr-code-05
objectives:
- 按時間盒完成澄清、實作與測試
- 用基準解找出最小反例
- 在加條件後說明哪些保證仍成立
tags:
- 模擬面試
- 時間盒
- 回歸測試
- 邊界
resources:
- title: Amazon：校園數據職面試指引
  url: https://atoz.amazon/en-us/jobs/hiring-process/interview-prep/university/data
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看技術與行為評量，別當所有公司流程。
- title: LeetCode 面試練習清單
  url: https://leetcode.com/problem-list/top-interview-questions/
  kind: interactive
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 另挑一題同類免費題，驗證能否獨立作答。
concepts:
- id: cr-code-06-budget
  prompt: 為什麼要保留最後幾分鐘？
  answer: 要用邊界例與反例驗算，並報告複雜度或未驗證處。
  mcq:
    question: 距結束 4 分鐘，你已寫完但未測，優先做什麼？
    options:
    - 開始另寫更快的解
    - 跑最小反例並說成本
    - 重命名所有變數
    - 把假設從筆記刪掉
    answer: 1
    explain: 先讓可執行解與契約一致，再說明優化空間。
- id: cr-code-06-changed
  prompt: 若需求從至少門檻改成嚴格大於，最佳反例是什麼？
  answer: 數值剛好等於門檻的單筆，最清楚分辨兩個條件。
  mcq:
    question: 門檻 100、要求嚴格大於，哪個案例才能抓到誤用 >=？
    options:
    - '[99]'
    - '[101]'
    - 空陣列
    - '[100]'
    answer: 3
    explain: 只有相等時，兩個比較結果不同。
- id: cr-code-06-honesty
  prompt: 只測固定小樣本，能怎麼描述驗證？
  answer: 回報測過的輸入與反例、時間複雜度推導，別稱量過大數據效能。
  interview:
    question: 最後只剩兩分鐘且變式沒完成，你怎麼交代？
    answer: 我會留住已測的原解，指出變式哪個條件改了、寫一個會失敗的反例。若改動未驗證，我會明說，而不是宣稱通過。
    points:
    - 保住可執行基準
    - 把未完成說具體
    - 有後續測試
practice:
- id: cr-code-06-p1
  kind: code
  minutes: 12
  title: 完成一場短模擬並保留反例
  steps:
  - 先遮住參考碼，用 12 分鐘完成三段：澄清 2、實作 6、驗算 4。
  - 將程式與一筆失敗前後的輸入輸出存成 mock_threshold.py 與 mock-notes.md。
  checks:
  - 空輸入無結果、門檻相等可命中、未達門檻回 None。
  - 變式改嚴格大於後補做相等反例。
---

## 一通電話做完一個可核對的問題

收到一份已按分鐘升序的作業日誌，輸出第一筆延遲達門檻的批次位置。給自己 12 分鐘，先用 2 分鐘確認輸入是否空、索引從哪開始、相等算不算、延遲本身有沒有排序，再用 6 分鐘寫解，留最後 4 分鐘做邊界測試和複雜度說明。這個時間盒（timebox）是練習用，不是對任何公司流程的預測。

雖然日誌已按分鐘排好，延遲卻不一定單調，不能拿延遲做二分搜尋。用逐筆掃描，遇到第一個符合就停。先問缺測值怎麼處理；本題假定每筆都已有整數毫秒，合法空輸入或完全未達都回 `None`，達標含相等。最壞仍要走完輸入，額外只記目前的位置；若第一筆即達標可以馬上停止。

## 模擬時間到再讀參考

在 `C:\dev\conduit-lab\coding` 建立 `mock_threshold.py`，於該資料夾執行 `py mock_threshold.py`。小基準先列出所有達標位置再取第一個；它不適合大檔，卻能供練習核對。

```python
def first_slow(delays, threshold):
    for index, delay in enumerate(delays):
        if delay >= threshold:
            return index
    return None

def baseline(delays, threshold):
    matches = [i for i, value in enumerate(delays) if value >= threshold]
    return matches[0] if matches else None

cases = [[], [100], [50], [0, 120, 70, 200], [200, 0, 120]]
for values in cases:
    assert first_slow(values, 100) == baseline(values, 100)
assert first_slow([100], 100) == 0
print(first_slow([0, 120, 70, 200], 100))
```

現在讓面試官改口：相等不算，要嚴格大於。只改比較還不夠，基準解和斷言也要按新契約改好。先用一筆恰好等於門檻的輸入鎖定變化，再檢查其他案例。另一個追問是要找所有達標位置，此時不能提前停止，還要另計輸出空間。把兩個追問分開，避免以為一個比較符號就解決全部。

模擬後把實際卡點記成「我忽略了排序鍵」「我把索引 0 當成沒有結果」之類可重做的句子，而非「表現不好」。面試不只程式：不同數據職還可能另考 SQL、數據模型、引擎概念與專案，練習記錄不要假裝覆蓋全部。

### 覆盤時只抓一個能重做的錯誤

如果看到「已排序」就開始寫二分，請用 0、120、70、200 說明延遲會先升再降，判斷是否達門檻也會在真假間翻轉。這就是排序前提失效的證據。若索引 0 被你拿去做真假判斷，新增第一筆就達標的案例，讓程式與口述都能驗到那一步。把失敗案例縮到最少，下一次可以在沒有提示下重新做，不用反覆閱讀整份參考解。

同伴若扮面試官，請先讓對方聽完你的輸入契約，再問一種變式，不能半程同時改掉門檻和輸出形狀。最後留一句驗證摘要：跑過哪些例子，推導出什麼複雜度，哪些假設仍需真實樣本支持。若只是獨練，把這三句錄成筆記，過一天再讀是否仍能講同一個可核對的故事。若下一次又在同一個前提跌倒，把它寫成開頭必問的一句。

## 常見錯誤

- 只測中間成功例 → 漏掉相等與無解 → 保留空、相等、未達三種。
- 按延遲二分搜 → 有序的是分鐘 → 用非單調延遲的反例驗證。
- 看到 0 就判找不到 → 把索引真假值當存在判斷 → 明確比對 `is None`。
