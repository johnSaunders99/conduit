---
id: bd-quality-06
module: bd-quality
order: 6
title: 血緣與影響分析
subtitle: 哪張報表需要標記延遲
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-05
objectives:
- 畫出從來源欄位到營運指標的血緣
- 沿下游邊找出需要標記延遲的看板
- 區分血緣證據與已證明受影響的範圍
tags:
- 血緣
- 影響分析
- 欄位血緣
- OpenLineage
resources:
- title: OpenLineage：簡介
  url: https://openlineage.io/docs/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 Dataset、Job、Run 各自代表什麼。
- title: OpenLineage：欄位血緣
  url: https://openlineage.io/docs/spec/facets/dataset-facets/column_lineage_facet/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看輸出欄如何描述輸入欄及轉換。
concepts:
- prompt: 表級血緣和欄位級血緣有何差別？
  answer: 表級指出哪些表相互產出，欄位級能指出某個輸出欄從哪些輸入欄或條件得來。
  mcq:
    question: refund.amount 變了，哪種證據最能縮小受影響指標？
    answer: 1
    options:
    - 任務執行耗時
    - 欄位級依賴與轉換
    - 所有表的大小
    - 看最新工作流狀態
    explain: 用欄位級依賴找直接和間接讀到該欄的輸出；只看表級會把同表無關欄一併列入。
  id: bd-quality-06-lineage
- prompt: 排根因與找影響各要沿血緣哪個方向？
  answer: 從異常欄反向找來源與任務；從確認有問題的來源沿下游找衍生結果。
  mcq:
    question: 營運先質疑 KPI 值，要找最初輸入，從哪裡走？
    answer: 0
    options:
    - 由 KPI 反向追上游
    - 從所有表平行向下走
    - 從任務最晚完成者找起
    - 只查排程器最後一個節點
    explain: 先從異常指標向上追其輸入和轉換，確認根因後再往下估影響。
  id: bd-quality-06-direction
- prompt: 圖上有路徑就等於所有歷史結果都錯嗎？
  answer: 不等於。圖只證明存在依賴，還需執行時間、輸入版本、日期範圍與實際差異驗證。
  interview:
    question: 查到退款欄位寫錯，如何列出需要通知誰？
    answer: 先用欄位血緣正向找含該欄或用該欄過濾的報表，再以 affected run、分區及版本收斂。圖沒有涵蓋手工下載時我會找擁有者核實；通知分已確認與待排查，附日期與恢復條件。
    points:
    - 含直接和間接依賴
    - 日期、版本及執行證據
    - 承認追蹤缺口並向讀者核實
  id: bd-quality-06-evidence
practice:
- kind: hands-on
  title: 交付一份看板影響清單
  minutes: 8
  steps:
  - 執行正文章節中的 trace_impact.py，把結果存入 impact.md。
  - 把事故範圍寫為 2026-01-18 的退款金額 v2；說明為何訂單量看板不在目前候選清單。
  - 為利潤看板寫一行通知，註明尚須核對的實際輸入版本。
  checks:
  - 候選含 clean.refund_amount、ads.net_amount、dashboard.margin。
  - 不含 dashboard.volume；文件將候選影響與已確認影響分開。
  id: bd-quality-06-p1
---

## 找到錯欄位，再問誰真的用到它

退款金額改錯，團隊知道日報同時有營收和訂單量。要不要把兩張看板一起標記？**數據血緣（data lineage，台灣也稱資料血緣）**記錄輸出從哪份輸入、經哪次轉換得來。表級血緣可以告訴你原始退款進了明細；欄位級血緣（column lineage）進一步指出 `refund_amount` 由哪欄計算，並能紀錄哪些欄被用在篩選、分組等間接影響。任務依賴是何時能跑，數據血緣則關心執行讀寫了什麼。

![退款金額流向淨額與利潤看板；訂單量看板是另一條分支](assets/bd-quality-lineage.svg)

OpenLineage 以數據集（Dataset）、工作（Job）與執行（Run）等實體描述證據：同一項工作每天可有不同的執行與輸入輸出。排查根因時，從異常欄逆向追到來源與加工程式；做影響分析（impact analysis）時，從已確認有問題的輸入順向找衍生物。兩個方向要用同一套欄位識別，才不會把同名欄誤串。修復前應核對實際執行讀到的版本和營業日，圖有路不表示每一天都錯。

## 用一張小圖列出影響

在 `C:\dev\conduit-lab\quality-lab` 存成 `trace_impact.py`，執行 `py trace_impact.py`，預留 1 GB，無容器。以下只是人工已知的小圖，不會自動發現正式環境的訂閱者。

```python
from collections import deque

used_by = {
    "raw.refund_amount": ("clean.refund_amount",),
    "clean.refund_amount": ("ads.net_amount",),
    "ads.net_amount": ("dashboard.margin",),
    "ads.order_count": ("dashboard.volume",),
}
start = "raw.refund_amount"
todo = deque([start])
seen = {start}
while todo:
    current = todo.popleft()
    for target in used_by.get(current, ()):
        if target not in seen:
            seen.add(target)
            todo.append(target)
            print(target)
```

只從退款這個欄一路往下，會看到淨額與利潤看板，不會走到只用訂單量的支線。反過來若營運先報利潤錯，就把同一組邊的方向反過來查來源。正式跟進需附上出問題的版本、讀到它的執行、可能的日期窗口以及需要延後或補跑的對象。下載到試算表等未接追蹤的路徑要另核實，不能以「圖上沒邊」當作「肯定沒人用」。

## 圖上沒有直連，也可能受同一份輸入影響

退款欄不一定出現在利潤看板的輸出；可能只在數據整理時做篩選，讓本來該保留的一筆被排除。因此欄位級血緣最好區分「用來計算輸出」和「用來決定哪些列進入」，並保留轉換的描述。不能因沒有同名欄就將該看板排除。若只能拿到表級紀錄，可以先把讀了整張表的任務列入候選，查實際 SQL 和執行輸入再縮小。

準備通知時可分成「已核對用過錯版」「可能使用、待查」「確認無關」三類，各附上原因。維持營運狀態可用的同時，保留尚未確定的範圍，不讓圖上的路徑被誤讀成事故結論。

## 常見錯誤

- **發了一圈通知卻無人能行動 →** 只有表名，沒有受影響欄、日期與版本；把訊息縮到可核對的範圍。
- **找了很久仍只看見衍生表 →** 根因方向走反；從異常指標回溯計算及輸入。
- **認為沒追到就沒影響 →** 工具不見得覆蓋手工工作流；加上已知缺口並核實。

**重點回顧：**血緣先給你一份候選名單；實際版本與讀值才證明誰受影響。
