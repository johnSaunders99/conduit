---
id: cl-cloud-01
module: cl-cloud
order: 1
title: 免費額度與預算
subtitle: 預算通知不是硬性停機
status: ready
minutes: 30
level: 2
prereqs: []
objectives: ["把運算、儲存、請求和傳輸拆成可重算的用量模型","判斷預測警示與實際警示各自代表什麼","寫下超過練習預算時的停止與清理步驟"]
tags: ["預算警示","免費額度","用量估算"]
resources:
  - title: "AWS Budgets：預算與警示"
    url: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "讀通知延遲與預算動作的範圍。"
  - title: "AWS Free Tier：方案條件"
    url: https://aws.amazon.com/free/
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "核對適用帳戶、方案期限與服務範圍。"
  - title: "阿里雲：預算管理"
    url: https://www.alibabacloud.com/help/en/user-center/how-to-manage-a-budget
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "對照實際支出及預測支出的警示。"
  - title: "Azure Cost Management：預算"
    url: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "看預算範圍及警示不會停止用量的說明。"
concepts:
  - id: cl-cloud-01-alert
    prompt: "實際成本預算發出通知，可以直接判定管道已停嗎？"
    answer: "不能；通知反映已彙整成本達到條件，不會自行停止管道。"
    mcq:
      options:
        - "可以；達門檻的查詢與排程已取消。"
        - "不能；通知反映已彙整成本達到條件，不會自行停止管道。"
        - "可以；所有新費用都會被折抵。"
        - "不能；但可以判定該月已結帳。"
      answer: 1
      explain: "警示不是停機、折抵或結帳；用量與帳務更新也有時間差。"
    interview:
      question: "每月只能花 100 元，怎麼讓一條試驗管道不超支？"
      points:
        - "分項試算與較壞情境"
        - "通知與執行前限制分工"
        - "退場後複查殘留用量"
      answer: "我會先在本機跑通。上雲前限定樣本、區域和重試次數，先用服務允許的限制擋掉大工作；警示交給能停排程的人，最後按服務核對是否還有新的用量。我不會用通知承諾帳單封頂。"
  - id: cl-cloud-01-forecast
    prompt: "只收到預測警示，可以說同等金額已花掉嗎？"
    answer: "不行；預測估計期末花費，不是已入帳金額。"
    mcq:
      options:
        - "可以；預測只是實際帳單換個顯示名稱。"
        - "可以；預測值必定高於最終費用。"
        - "不行；預測估計期末花費，不是已入帳金額。"
        - "不行；預測只顯示儲存容量。"
      answer: 2
      explain: "它是用來及早查相較預期的變化，不代表已用掉同樣多的錢。"
  - id: cl-cloud-01-unit
    prompt: "運算停止後物件還保存一個月，試算怎麼記？"
    answer: "運算計已用時數；儲存另計容量與保留期。"
    mcq:
      options:
        - "運算計已用時數；儲存另計容量與保留期。"
        - "兩項都只計運算小時。"
        - "只算傳出，物件不再算。"
        - "兩項都改用整月運算時數。"
      answer: 0
      explain: "運算、儲存、請求與傳輸的計價單位各自獨立。"
  - id: cl-cloud-01-free
    prompt: "換了一個帳戶或區域，原本免費的試驗可直接重做嗎？"
    answer: "先核對新帳戶、方案、服務及區域是否符合當前優惠條件。"
practice:
  - id: cl-cloud-01-p1
    title: "交一張訂單重跑的預算單"
    kind: hands-on
    minutes: 12
    steps:
      - "在 C:\\dev\\conduit-lab\\cloud 存 budget.py，執行後保存輸出。"
      - "把單次運算工時從 4 改成 14，再保存一次輸出。"
      - "在兩次結果旁寫出警示收件角色、停止條件和清理複查日。"
    checks:
      - "兩次總額應為 65 與 105 點，第二次仍完整列出超支金額。"
      - "註明假設費率，並列出停止排程後仍需清查的儲存。"
---

## 先不開帳戶：為訂單補算畫出退場線

本堂不註冊、不綁卡、不上傳數據。先在本機試算，只有在會查優惠及收尾後才考慮雲端。免費額度（free tier）要核對帳戶方案、適用服務、區域、有效期限與用量；抵用金（credit）不是每種費用都能抵。不要拿教學點數當報價，也不要以為另一個團隊的優惠會跟著工作移過來。

訂單日報少了一天，值班想重跑 4 小時。即使工時很短，暫存輸出可能還要留一個月，營運拉回的檔案也可能有傳輸費。先把工作寫成幾列，不要把不同單位加成一個「用量」。每列是「用量 × 同單位費率」：運算按小時、儲存按容量月、請求按次數或每千次、傳輸按方向與容量。試算時另記區域、方案、幣別和報價日期；沒有確認的項目先列待查，不默認為零。

## 警示在帳本上，限制在工作入口

在 AWS Budgets 建立成本預算（cost budget）的思考順序是：定出範圍（例如單一試驗）、期間、金額，然後才加預算警示（budget alert）。實際成本基於已彙整的用量；預測成本（forecasted cost）是用目前趨勢估期末。收到預測達 80% 的通知，要查變動原因，不是說已付了 80%。用量產生、帳務更新、通知送達不是同一刻。另設預算動作只能在授權及指定範圍內處置，不能當整個帳戶的即時硬上限。阿里雲費用與成本的預算管理、Azure Cost Management 的 Budgets 都有類似的通知用途，不能照搬各自的可用範圍與控制方式。

把動作寫在通知旁：值班先核對重試與每日用量；若下一次預估超過剩餘預算，先不送出重跑。工作入口另限單日切片和重試次數；若服務支援，設單次工作上限。課後的資源確認與對帳會在[〈資源清冊與關閉〉](#/lesson/cl-cloud-06)細講。

## 本機試算：通知後金額還會增加

在 `C:\dev\conduit-lab\cloud` 存 `budget.py`，從該資料夾執行 `py budget.py`。例中傳出量和請求量固定，方便單獨觀察工時超過預期的影響。

```python
limit = 100
rows = [("compute hours", 4, 4), ("GB-month", 20, 1),
        ("outbound GB", 8, 3), ("thousand requests", 5, 1)]
total = 0
for label, usage, rate in rows:
    subtotal = usage * rate
    total += subtotal
    print(f"{label}: {subtotal} points")
print(f"total: {total}; alert: {total >= 0.8 * limit}")
```

原本 65 點，不觸發警示；拉到 14 小時是 105 點。其他小計不動，說明這次增加是運算，而不是保存或拉回的成本。試著為其中一列再寫一個最壞情境，例如每天有人下載兩次。即使運算估得準，下載仍有獨立的用量風險。

### 交接時把未確認的折扣留在表外

若只知道本月有抵用金，不知道這個服務能否抵，就先算未折抵小計，再寫「待查」；切勿把折扣當成減掉的實際成本。預算線可用來提醒值班，但重跑單上必須另有誰批准、最多跑多少的決定。

## 常見錯誤

- 假期沒人看通知就超支 → 寄信沒有停止作業 → 另外限制工作切片與重試，指定接手角色。
- 報價單只看每 GB → 把儲存容量和傳輸量混在一起 → 寫清楚是 GB-month 還是單向傳輸 GB。
- 實驗關閉後還有當天費用 → 可能是先前用量遲到，也可能有殘留 → 留下處置時間，對照用量期間再查。
