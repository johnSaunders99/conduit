---
id: bd-ingest-03
module: bd-ingest
order: 3
title: DataX 與批次通道
subtitle: 拆成讀端轉換與寫端
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-02
objectives:
- 把批次同步拆成讀端、通道、轉換與寫端
- 從讀入、拒收、寫出計數定位故障
- 區分限制髒數據與保證批次成功
tags:
- DataX
- Reader
- Writer
- 拒收
resources:
- title: DataX 專案說明
  url: https://github.com/alibaba/DataX
  kind: repo
  lang: zh-Hans
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀架構圖、讀寫插件與通道的分工。
concepts:
- prompt: Reader、Channel、Writer 分別負責什麼？
  answer: Reader 向來源取數，Channel 在讀寫間傳遞記錄，Writer 將記錄送往目的端。
  mcq:
    question: 讀端成功讀了 3 列，但目標寫入逾時，應先查哪一側？
    answer: 2
    options:
    - 先調大讀取條件
    - 重算來源筆數
    - 查 Writer 與目的端提交
    - 改欄位顯示名稱
    explain: 先查寫端連線、交易與目的端限制；讀端計數不表示目的端已提交。
  id: bd-ingest-03-roles
- prompt: 有 1 列轉型失敗，通過的筆數怎麼解讀？
  answer: 3 筆讀入、1 筆拒收、2 筆有效，必須跟批次容許門檻比對，不能宣稱全數到齊。
  mcq:
    question: 3 進、2 寫、1 拒收代表什麼？
    answer: 0
    options:
    - 可核對流向，不代表可發布
    - 數據一定全部落地
    - 來源少抓了 1 筆
    - 加大通道即可恢復第 3 筆
    explain: 少的 1 筆有明確去向，但批次可否發布還要看規則。
  id: bd-ingest-03-dirty
- prompt: 把通道加到 8 就會快 8 倍嗎？
  answer: 不一定；數據拆分失衡、來源負載、目的端吞吐與網路都可能先到上限。
  interview:
    question: 同步從每秒 2 萬筆降到 2 千筆，你會先加 Channel 嗎？
    answer: 我會分開看 Reader 取數、Channel 等待和 Writer 往返；若寫端在等提交，加通道可能放大鎖等待。先比對壓力和失敗率，在同一份輸入逐步調整，再驗收來源少了什麼、目標到底提交多少。
    points:
    - 依分段指標找瓶頸
    - 勿盲目加併發
    - 觀察提交與拒收
  id: bd-ingest-03-parallel
practice:
- kind: hands-on
  title: 產生一份讀寫計數與拒收檔
  minutes: 8
  steps:
  - 在工作區建立 datax_flow.py，貼上正文章節中的程式並執行。
  - 開啟 clean.csv 和 rejected.csv，找出多出的欄位。
  - 把第三列改成 120 重跑，記下正常筆數與拒收筆數如何改變。
  checks:
  - 初次終端顯示 read=3 valid=2 rejected=1。
  - 拒收列的 reason 是 invalid_amount；改正後拒收檔只剩表頭，正常檔有 3 列。
  id: bd-ingest-03-p1
---

## 把慢寫和壞列分開

茶舖每天從交易數據庫搬訂單到數倉。有天控制台顯示讀了 3 筆，報表只看到 2 筆。是讀少了、轉換失敗，還是寫端中途停了？如果只有「開始、完成」兩個狀態，你無法分辨。DataX 是以插件分離來源與目的端的批次同步工具，不是替業務自動決定哪些數據可接受的數倉。

![讀端取數，通道傳遞，轉換失敗進例外清單，正確數據交寫端](assets/bd-ingest-channel.svg)

在一份工作（job）裡，**讀端（Reader）**決定讀哪些列與欄位，**通道（Channel）**傳遞記錄並可配合限速與並行，**寫端（Writer）**映射欄位並提交到目的端。轉換（transform）若有，就要定義型別與失敗規則。拆成多個讀取任務（task）時，每個任務都必須有不重疊且合起來完整的範圍；分配更多通道不會讓 90% 的數據自動離開同一熱門區段。插件的參數會隨來源和目的端不同，不能把別人的欄位對應當成通用設定。

## 做一份最小觀測紀錄

這堂用 Python 演示責任邊界，不是啟動 DataX，不含真實 JDBC（Java 數據庫連接介面）或並行。工作區 `C:\dev\conduit-lab` 下開新資料夾 `datax-lab`，儲存 `datax_flow.py`，執行 `py datax_flow.py`。重跑只會覆寫該資料夾內的兩份練習檔；預留 1 GB，不開容器。

```python
import csv

records = [(1001, "225"), (1002, "910"), (1003, "unknown")]
clean, rejected = [], []
for order_id, raw in records:
    try:
        clean.append((order_id, int(raw)))
    except ValueError:
        rejected.append((order_id, raw, "invalid_amount"))

for name, header, rows in [
    ("clean.csv", ("order_id", "amount"), clean),
    ("rejected.csv", ("order_id", "raw_amount", "reason"), rejected),
]:
    with open(name, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(header)
        writer.writerows(rows)

print(f"read={len(records)} valid={len(clean)} rejected={len(rejected)}")
```

這裡 `valid` 經檔案寫入成功後才印出；若寫檔報錯，不要把清單長度當成已提交。真實任務可以把「讀了幾筆」「轉換拒收幾筆」「目的端確認了幾筆」分別記錄。遇到瞬斷可以重試，遇到型別不合則保留原始值及拒收原因；同一種壞列反覆重試只會拖延處理。正式環境能否放行 2 筆，要看是否允許部分交付；對需要全到的帳務，即使拒收有紀錄也要阻止發布。

## 把三個數字配上同一個範圍

先記下本次批次識別，否則上一輪補送的成功列可能被誤加進這一輪。以讀進 3 筆的範例，三段計數應對同一來源範圍。讀端若自己跳過取消單，必須在範圍寫明；轉換若拒收 1 筆，應指出是第 1003 張；寫端若在收到 2 筆後失敗，又不能將收到當成已提交。這三個位置要看的訊號與接手方法都不同。你可以拿 1003 做第二次驗收：來源修好之後，若目的端儲存按訂單鍵取代，先前的 2 筆不會多出一份。

真實任務的讀端可能靠分段條件卸載壓力，但來源會持續變動。若不同通道對一致性視圖沒有共同約定，讀寫計數即使能守恆，內容也可能不是同一切點。回到快照清單核對位置和範圍，再談調整吞吐；先替業務守住正確性。

## 常見錯誤

- **吞吐不升反降 →** 寫端已滿還加通道；先量每段等待、鎖和重試，再逐次調整。
- **目標欄位對不上 →** 用位置映射但欄位順序已改；核對讀寫欄位和型別，在小批先試。
- **顯示成功但少帳 →** 把允許拒收當成允許漏數；核對批次口徑及拒收門檻。

**重點回顧：**讀入、轉換與落地各自可失敗；看清每一步的數字，才知道下一步要修哪裡。
