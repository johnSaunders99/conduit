---
id: bd-orch-07
module: bd-orch
order: 7
title: SLA 與告警
subtitle: 區分沒來和來得太晚
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-06
objectives:
- 分開判斷尚未到齊、已到但超時、準時完成
- 用業務日和交付截止時間設計告警輸出
- 說明任務失敗告警不能替代交付告警
tags:
- SLA
- 交付時限
- 告警
- 晚到
resources:
- title: Airflow：Deadline Alerts
  url: https://airflow.apache.org/docs/apache-airflow/stable/howto/deadline-alerts.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看截止告警的參考點和觸發條件。
- title: dbt：Source freshness
  url: https://docs.getdbt.com/docs/deploy/source-freshness
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 區分來源新鮮度與任務執行狀態。
concepts:
- prompt: 任務成功與日報準時有什麼差別？
  answer: 成功代表任務到達終態，準時則還要在承諾時間內，且數據通過完整性檢查。
  mcq:
    question: 排程畫面全綠，但到 02:10 少了一份退款檔，應判為？
    answer: 2
    options:
    - 準時完成
    - 只算執行失敗
    - 未到齊且已逾時
    - 已到齊但逾時
    explain: 這是未到齊、已超過交付期限；綠色任務不代表交付成立。
  id: bd-orch-07-deadline
- prompt: 為什麼區分缺數據和晚到？
  answer: 未到齊要找少哪個來源；已到齊但晚到重點在延遲及補救，處置與告警訊息不同。
  mcq:
    question: 已於 02:08 到齊，期限是 02:00，應該如何記錄？
    answer: 1
    options:
    - 刪掉曾逾時的紀錄
    - 記錄已恢復且本次晚到
    - 一直標缺來源
    - 只看最後任務成功即可
    explain: 已到齊應關閉未到事件，但保留晚到記錄供趨勢統計。
  id: bd-orch-07-classify
- prompt: 實用的交付告警最少要有什麼？
  answer: 受影響的營業日、截止時間、缺少或晚到的產物、可定位的執行識別與下一步。
  interview:
    question: 凌晨通知日報延遲，你會怎麼減少同一事件連發？
    answer: 我會用管道、營業日、規則作告警鍵，分開記錄未到齊和已恢復。訊息指名缺哪份輸入、截止時間和哪次執行；重複查到同一狀態就合併通知，影響範圍變大或恢復才更新。
    points:
    - 清楚的去重鍵
    - 按交付狀態分類
    - 提供可行下一步
  id: bd-orch-07-signal
practice:
- kind: hands-on
  title: 把三種交付狀態寫成值班紀錄
  minutes: 8
  steps:
  - 在工作區執行 delivery_alert.py，把 3 行輸出抄到 delivery-alert.md。
  - 把 complete_at 從 02:08 改成剛好 02:00，驗證期限當下的規則。
  - 為未到齊那列補上缺少的產物、查執行的線索與由誰接手的角色。
  checks:
  - 原輸出依序是 incomplete_late、delivered_late、delivered_on_time。
  - 恰在截止時間完成屬準時，未到齊的告警有可執行的下一步。
  id: bd-orch-07-p1
---

## 「失敗」和「沒按時交」是兩種訊息

茶舖承諾 02:00 前交付昨日訂單與退款的整張日報。任務可能 01:58 執行成功，但只有訂單；也可能 02:08 才到齊，最後圖上全綠。**服務等級協議（service-level agreement，SLA；台灣也稱服務水準協議）**在這堂用來描述誰承諾交什麼、何時算違約。內部目標未必是正式對外協議，但也要明訂時區、日曆、交付時限與判定依據。

以完成時間與驗收訊號做兩軸判斷：截止前還缺，通常先等；截止時或之後還缺，通知缺哪些；到齊且驗過的時間超過截止，記一次晚到並結束「仍缺」狀態。只有已到齊並且不晚於截止時間通過驗收才算準時。Airflow 3 的 Deadline Alerts 是排程器依參考時間與期限追蹤執行的機制，並不會自行知道完整數據；若你關心交付，還要另外依批次清單與質量規則產生訊號。下一模組的[〈新鮮度與完整度〉](#/lesson/bd-quality-03)會用 SQL 把兩者分開核對。

## 把條件寫成能檢查的決策

在 `C:\dev\conduit-lab\orch-lab` 存為 `delivery_alert.py`，執行 `py delivery_alert.py`，預留 1 GB，無排程器。三個案例都假設同一日期與同一時區；完整時間是完成**驗收**時，不是檔案開始傳輸時。真實跨日比較要用完整日期時間。

```python
def classify(now, deadline, complete_at=None):
    if complete_at is not None:
        return "delivered_on_time" if complete_at <= deadline else "delivered_late"
    return "incomplete_late" if now >= deadline else "pending"

print(classify(130, 120))
print(classify(130, 120, 128))
print(classify(130, 120, 119))
```

數字是午夜過後的分鐘。第一行代表已逾時仍不全，不能和第二行共用「仍缺」通知。實際告警至少帶營業日、截止時間、規則版本、缺的產物、可定位的執行識別和接手方法。重複檢查同一個缺口時，用一致的事件鍵合併；恢復時更新同一事件，保留實際延遲供下次調整。以訂單日報來說，合理的第一步是查退款來源交付清單，而不是盲目重跑每一支工作。

## 區分營運時限與工具時限

從任務排進佇列後算 15 分鐘，適合看系統何時處理太慢；從營運日約定的截止時刻算，才知道承諾是否失守。若工作根本沒被排程，第一種計時甚至沒有開始，第二種仍會報未交付。這兩類應保留不同訊號，避免一個工作靜默消失時沒有告警。查原因可以依序問「來源已交付嗎」「等待排程多久」「驗收為何不通過」，讓處理更有方向。

若早班報表只服務隔日營運，假日不發表可能是明文規則。這時先套用營業日曆，再算應到清單和期限；不可因每天的排程沒有啟動就一律報錯。相反，預期要交的日子查不到排程實例，也要能靠交付規則發現。

## 常見錯誤

- **工作流成功就解除缺數告警 →** 成功不是驗收證據；以實際到齊和質量通過判定。
- **已到的晚批仍一直告警 →** 未區分仍缺與已晚到；到齊後記錄恢復與延遲。
- **通知只寫「任務失敗」 →** 值班者找不到日期與輸入；補上影響範圍與可查線索。

**重點回顧：**標準不是任務有沒有綠，而是哪份數據在何時已經可以使用。
