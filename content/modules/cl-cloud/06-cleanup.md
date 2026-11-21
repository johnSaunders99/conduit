---
id: cl-cloud-06
module: cl-cloud
order: 6
title: 資源清冊與關閉
subtitle: 空閒服務仍可能計費
status: ready
minutes: 30
level: 2
prereqs:
- cl-cloud-05
objectives: ["依相依順序列出停止、保留、移除與複查","盤點仍可能計費的磁碟、快照、位址與物件版本","從用量期間判斷歷史帳務或新殘留"]
tags: ["資源清冊","退場","快照","對帳"]
resources:
  - title: "AWS Billing：非預期費用"
    url: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/checklistforunwantedcharges.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "查磁碟、快照、區域及其他服務建立的資源。"
  - title: "AWS Budgets：成本追蹤"
    url: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "核對帳務更新頻率及延遲限制。"
concepts:
  - id: cl-cloud-06-order
    prompt: "管道試驗準備退場，先防止什麼？"
    answer: "先停掉仍會建立作業或寫入數據的觸發來源。"
    mcq:
      options:
        - "先刪保存中的快照。"
        - "先取消所有警示，再看是否有人使用。"
        - "先停掉仍會建立作業或寫入數據的觸發來源。"
        - "先清空桶後才停排程。"
      answer: 2
      explain: "先停止新增並等在途工作結束，避免邊退場邊重建或寫入。"
  - id: cl-cloud-06-owner
    prompt: "一份仍要保留 14 天的快照，應如何移交？"
    answer: "列出擁有角色、原因、到期、還原證據與預期用量。"
    mcq:
      options:
        - "列出擁有角色、原因、到期、還原證據與預期用量。"
        - "先放著，不登記就不算殘留。"
        - "為了結案立即清除。"
        - "停運算服務後讓它自動不收費。"
      answer: 0
      explain: "有意保留和漏清不一樣，但兩者都應出現在清冊與帳務中。"
  - id: cl-cloud-06-reconcile
    prompt: "拆除隔天看到新出現的金額，先比對哪個時間？"
    answer: "比費用對應的使用期間與實際停用時間。"
    mcq:
      options:
        - "只看收到通知時間。"
        - "看報表匯出檔的建立時間。"
        - "只看雲端主控台目前所在區域。"
        - "比費用對應的使用期間與實際停用時間。"
      answer: 3
      explain: "較晚顯示可能是過去用量，亦可能是停用之後還有殘留。"
    interview:
      question: "主機已不存在，但成本報告還有費用，怎麼排查？"
      points:
        - "按使用期間、服務、區域拆帳"
        - "找磁碟快照及其他獨立資源"
        - "記下保留理由和複查時間"
      answer: "我先對齊停用時間和實際用量日。若有停用後的新磁碟或位址費，回清冊查用途與負責角色；保留快照的費用應能說明，未知的則追到資源擁有者，不能直接刪。"
  - id: cl-cloud-06-retain
    prompt: "來源用途查不明，能用刪除來驗證它沒被用嗎？"
    answer: "不能；先釐清用途、消費者及授權，沒有可還原證據時先保留待查。"
practice:
  - id: cl-cloud-06-p1
    title: "建立一份含複查日的退場清冊"
    kind: hands-on
    minutes: 12
    steps:
      - "在練習資料夾存 retire.py 並執行，保留輸出。"
      - "為 REVIEW 加上擁有角色及複查日；把 KEEP 填上還原證據。"
      - "寫下停用前用量延後入帳與停用後殘留的分辨依據。"
    checks:
      - "維持 2 CLOSED、1 KEEP、3 REVIEW；未處置任何雲端資源。"
      - "快照有保留期；磁碟、位址與非現行版本都有待查理由。"
---

## 成本安全：停服務不等於停止所有計費

今天只有本機清冊，不登入、不關閉或刪除線上資源。日後做雲端試驗，建立前就記下優惠條件、預算警示、區域、擁有角色與到期時間。清理也要留下一次異地與延遲帳務複查，不能用預算頁即刻歸零作完成條件。試驗的訂單補算告一段落，主機已終止，未附掛磁碟和保留物件版本仍可能收費。

資源清冊（resource inventory）逐項列出服務、區域、識別碼、依賴、擁有角色與處置證據。退場（decommissioning）先確認範圍與授權，查有無其他消費者；先停排程或入口，等在途作業完成或核准取消，再凍結寫入。確認保留內容與可還原性以後，才輪到專用運算和不必留下的儲存。名稱相似、沒有連到主機或剛好沒有流量，以上都不是刪除依據。

## 本機分類：關掉、有理由留下、尚待查

在 `C:\dev\conduit-lab\cloud` 存 `retire.py`，從該資料夾執行 `py retire.py`。這裡只有虛構的識別碼和狀態；程式不能判斷什麼可以刪除。

```python
items = [
    ("schedule", "sched-day", "closed", ""),
    ("compute", "batch-host", "closed", ""),
    ("volume", "disk-stage", "present", ""),
    ("snapshot", "snap-report", "present", "retain through day 14"),
    ("public address", "ip-temp", "present", ""),
    ("object versions", "raw-v2", "present", ""),
]
for service, identifier, state, reason in items:
    decision = "CLOSED" if state == "closed" else "KEEP" if reason else "REVIEW"
    print(f"{decision:6} {service:16} {identifier:14} {reason}")
```

停用日記為第 0 天。快照留下 14 天，移交時附上結果檔、能還原到哪一天、由誰到期複查；磁碟、位址與版本則去查誰在用。若某服務有上層排程會自動補建資源，應先處理上層。也要查其他區域、全域服務和不同資源狀態，別讓同一張運算頁代表全帳戶。

## 對帳用用量日，不用看到錢的日期

假設第 1 天看到 3 筆新增帳務紀錄：第 −1 天運算、第 1 天快照、第 1 天未登記磁碟。第一筆是停用前的歷史用量；第二筆是清冊預期的保留；第三筆才是需要查明的新用量。把查帳時間與涵蓋的使用期間留在清冊，等下一輪帳務更新再確認。若存在不可立刻解除的訂閱或承諾，另列剩餘費用和責任角色，不假設關掉機器就會終止合約。

### 清冊也要記什麼時候不准刪

例如快照雖已過了第 14 天，但報表擁有者未確認恢復證據，先維持待核准，而不是靠到期日自動判斷。一份可交接紀錄至少能回答：誰確認用途、外部依賴有沒有解除、可以恢復到哪個切點、何時再次確認。當排程已停但清冊還有待查項目，可以把「運算已停」和「成本仍待追」分開回報；兩者不需要等到同一天才成立。

若判定待查資源還屬於別的環境，應移交它的擁有角色；不要為了讓本次結案而修改共用資源的設定。

## 常見錯誤

- 刪完又出現新機器 → 上層仍會觸發 → 先停觸發並查在途工作。
- 一看到金額就再刪東西 → 沒比用量期間 → 對照停用前後再處理。
- 為了清零先刪快照 → 可能破壞還原 → 驗證恢復並尊重保留期限。
