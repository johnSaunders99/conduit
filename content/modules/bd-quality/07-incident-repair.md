---
id: bd-quality-07
module: bd-quality
order: 7
title: 事故復盤與修復
subtitle: 留下誰都能重跑的最小反例
status: ready
minutes: 30
level: 2
prereqs:
- bd-quality-06
objectives:
- 用同一最小反例重現錯帳與驗證修復
- 將緩解、根因、補跑與預防分開記錄
- 設計能在下一次相同重送時失敗的自動測試
tags:
- 事故復盤
- 回歸測試
- 最小反例
- 重送
resources:
- title: Google SRE：事故復盤文化
  url: https://sre.google/sre-book/postmortem-culture/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀不究責的復盤、影響範圍與後續行動。
- title: dbt：數據測試
  url: https://docs.getdbt.com/docs/build/data-tests
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看如何把業務失敗條件做成檢查。
concepts:
- prompt: 好的最小反例應該包含什麼？
  answer: 有代表性的必要輸入、會觸發故障的條件及可驗證的期望值，移除與根因無關的數據。
  mcq:
    question: 同一筆退款被重送，應用哪個反例？
    answer: 2
    options:
    - 只放一筆正常退款
    - 用來源一整年數據且無期望值
    - 同鍵重送一筆，另留不同鍵但同額一筆
    - 將所有相同金額都標重複
    explain: 同一事件鍵送兩次和另一筆真實等額退款，才能同時驗證去除重送且保留合法等額事件。
  id: bd-quality-07-repro
- prompt: 為何復盤要分緩解與根因修復？
  answer: 回切或暫停能減少讀者受害，不代表製造錯帳的程式已修正。
  mcq:
    question: 先切回舊版且看板恢復，下一步仍需什麼？
    answer: 1
    options:
    - 直接宣告永久修好
    - 重現、修正並以測試和補跑驗收
    - 刪掉錯版證據
    - 只提高重試次數
    explain: 舊值可用不保證新流程不再出錯，要修根因並重算受影響窗口。
  id: bd-quality-07-mitigate
- prompt: 可驗收的改進事項應長什麼樣？
  answer: 有負責角色、完成條件與檢查證據，例如寫入端增加重送案例，修正後 CI 必須通過。
  interview:
    question: 同一錯帳已發生兩次，你會怎麼寫復盤避免第三次？
    answer: 把可觀測的時間線、影響日期與緩解動作列開，找出重送為何能二次入帳。做一份最小測資讓舊邏輯必敗、新邏輯通過，再安排受影響區間補跑與驗收。預防行動標負責角色、期限與測試證據，不把問題歸咎個人。
    points:
    - 可重現的根因證據
    - 區分恢復、修復及預防
    - 行動可指派且有通過條件
  id: bd-quality-07-action
practice:
- kind: hands-on
  title: 留下重現、修復與批次驗收的紀錄
  minutes: 9
  steps:
  - 用正文章節中的 refund_regression.py，先加 --old 執行，再用修正版執行。
  - 把錯誤的 30 元與正確的 20 元、去重鍵和驗收日期寫進 incident.md。
  - 為「防止重發」寫一條可驗收行動，註明負責角色、預計時限與測試通過條件。
  checks:
  - 舊程式印出 30 後失敗；修正版印出 20 並成功。
  - 復盤有時間線、影響、緩解、根因、補跑驗收與預防，沒有以刪除異常數據代替修復。
  id: bd-quality-07-p1
---

## 不只說修好了，要重現原來怎麼錯

01-18 的退款多了 10 元，因為同一事件送了兩次。切回舊日報降低了當下影響，但真正**事故復盤（postmortem）**要留下能讓下一個人驗證的時間線：何時偵測、哪些報表與日期受影響、先做什麼緩解、哪段邏輯製造錯誤、如何修及證明。不要以「操作不小心」代替可改進的系統條件。

最小反例（minimal reproducer）不是抓整張表，而是留下能分辨對與錯的最少輸入。兩筆不同退款剛好都為 10 元，另有一筆同事件重送。如果只測同鍵重送，不測等額但不同鍵的正常退款，就可能寫出按金額去重的假修復。把反例放進回歸測試（regression test），讓問題在數據出現在看板前就被抓住。

## 讓舊邏輯真的失敗

在 `C:\dev\conduit-lab\quality-lab` 儲存 `refund_regression.py`，預留 1 GB、不開容器。執行 `py refund_regression.py --old` 應失敗；執行 `py refund_regression.py` 應成功。範例假設事件鍵相同的重播負載相同；遇到同鍵不同金額先報衝突，不任意選一筆。

```python
import sys

rows = [("r1", 10), ("r2", 10), ("r1", 10)]
if "--old" in sys.argv:
    total = sum(amount for _, amount in rows)
else:
    by_event = {}
    for event_id, amount in rows:
        if event_id in by_event and by_event[event_id] != amount:
            raise ValueError(f"conflicting payload: {event_id}")
        by_event[event_id] = amount
    total = sum(by_event.values())

print(f"refund_total={total}", flush=True)
if total != 20:
    raise SystemExit(f"expected 20, got {total}")
```

錯誤案例應印 `refund_total=30`，修正版印 `refund_total=20`。這個差異是數據質量閘門，不是報表修復本身；還需沿血緣確定會讀這份退款的日期與指標，依[〈回填與補數〉](#/lesson/bd-orch-04)小批重算，核對逐事件鍵、金額及下游看板。用「輸入是重播，去重鍵是退款事件識別」把規則記在相應任務旁，不是只將舊報表數值改對。

## 復盤必須把哪些事分開

緩解問「如何先停止更多人讀到錯數」；根因問「為何同一事件能產生兩次有效寫入」；修復問「對同鍵重送和合法等額退款都能得出正確結果嗎」；補跑問「哪些營業日要用正確版本重新發布」。各段應有自己的證據：讀者的報表、原始事件重送記錄、反例輸出、逐日對帳清單。只知道總額變成 20，不代表所有讀者已看到修正後的產物。

將預防的工作寫到能指派且能驗收。比方說由寫入端維護者在下次改版前加入同鍵重送、同額異鍵、同鍵異額三個案例；若舊邏輯沒有失敗或新邏輯吞掉衝突，不可合格。修復後再回看告警是否能更早發現：一漏一重可能不改變筆數，所以除了數量，也要讓關鍵業務鍵及金額差異可以逐批觀察。把這些改善落到管道旁，比一份只有結論的復盤更有下一次可用的價值。

## 常見錯誤

- **只留下整份錯帳截圖 →** 下次難以重現；附最小輸入、舊錯值和修正後的預期值。
- **舊程式也通過 →** 測資沒有碰到重送；加同鍵重播及正常等額事件。
- **行動寫「往後小心」 →** 無從驗收；明列誰修改、何時完成、哪個測試必須通過。

**重點回顧：**恢復要看讀者的數字；預防要讓原來那個反例再也過不了關，並把修復證據留給下一位值班者。
