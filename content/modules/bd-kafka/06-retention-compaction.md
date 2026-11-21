---
id: bd-kafka-06
module: bd-kafka
order: 6
title: 保留與壓縮
subtitle: 為何舊訊息會消失
status: ready
minutes: 35
level: 3
prereqs:
- bd-kafka-05
objectives:
- 按用途區分 delete、compact 與兩者合用
- 用同鍵更新及空值刪除推導可恢復狀態
- 評估落後的讀者是否仍能補齊
tags:
- cleanup.policy
- retention.ms
- log compaction
- tombstone
resources:
- title: Kafka：日誌壓實
  url: https://kafka.apache.org/44/design/design/
  kind: doc
  lang: en
  minutes: 7
  required: false
  checked: '2026-11-20'
  note: 讀 Log Compaction，留意位移與刪除標記。
- title: Kafka：主題清理設定
  url: https://kafka.apache.org/44/configuration/topic-configs/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀 cleanup.policy 與刪除標記的期限。
concepts:
- id: bd-kafka-06-history
  prompt: 稽核要完整看到同訂單每次改價，應只依賴 compact 嗎？
  answer: 不應；同鍵舊值可以被清理，完整歷史要靠合適的保留和歸檔。
  mcq:
    question: 需要保留每次改價多年，最適合什麼？
    options:
    - 只留每鍵最新值
    - 設好歷史歸檔與可讀期限
    - 將時間保留改到 1 秒
    - 用更新值覆寫來源檔案
    answer: 1
    explain: 還原當前狀態和回放每次改價是不同需求；後者需要原始紀錄。
  interview:
    question: 怎樣選 compact 和 delete 給訂單主題？
    points:
    - 區分歷史日誌與當前狀態
    - 空值墓碑有期限
    - 落後太久需重建或歸檔
    answer: 我會把履約事件當可回放歷史，設定明確保留並歸檔；狀態分發可另用 compact。還會測訂單取消後的墓碑被慢讀者錯過時，怎樣重建結果，而不是只改一個設定。
- id: bd-kafka-06-tombstone
  prompt: 在壓實主題收到有鍵、值為 NULL 的紀錄，通常代表什麼？
  answer: 它是刪除標記，提示下游移除該鍵；不是字串 'NULL'。
  mcq:
    question: 要刪除狀態表中的 X，典型壓實日誌紀錄是什麼？
    options:
    - 無鍵且值是 X
    - 鍵 X 加真正的空值
    - 鍵 X 加字串 NULL
    - 鍵 X 加原值
    answer: 1
    explain: 有鍵才知道刪誰，真正空值的記號與普通字串不同。
- id: bd-kafka-06-gaps
  prompt: 壓實時移除 offset 9 後，10 會遞補成 9 嗎？
  answer: 不會；剩餘紀錄保有原位移，讀者可能跳過空洞。
  mcq:
    question: 讀取見到位移 8 接 10，單靠這一點能證明什麼？
    options:
    - broker 一定故障
    - 消費者一定漏寫
    - 位移有空洞，需查清理及其他原因
    - 新紀錄排序已改寫
    answer: 2
    explain: 壓實不重編位移；空洞不是端到端漏做的充分證據。
practice:
- id: bd-kafka-06-p1
  kind: explain
  title: 為兩個主題寫保存契約
  minutes: 12
  steps:
  - 在 kafka-retention.md 抄下正文的 4 筆紀錄，分別列歷史訂閱與狀態重建的要求。
  - 寫下壓實後可能看不到哪些紀錄、目前狀態有哪些鍵。
  - 另假設某讀者落後 10 天、歷史保留僅 7 天，寫補齊來源。
  checks:
  - 當前狀態為 A=paid，不包含 B。
  - 說出為何不能承諾即時只剩一列，以及如何避免已過期的歷史無從補齊。
---

凌晨修復看板時，發現上週的事件已讀不到；另一張表卻只想要每個訂單最新狀態。同樣都是日誌，兩個需求不能共用一句「保留久一點」。保留策略（retention policy）回答歷史能回放多久；日誌壓實（log compaction；本課標題稱壓縮）回答各鍵的最新狀態怎麼重建。這裡的壓實是刪除被新值取代的舊紀錄，不是將位元組改用更短編碼。

## 看同一份日誌的兩種讀法

一個分區先後寫入：位移 0 為 A=created，1 為 B=created，2 為 A=paid，3 為 B 的真正空值。最後一筆是刪除標記（tombstone），下游讀到要移除 B；若寫成普通字串 `"NULL"`，那只是 B 的新值。從空表讀完整紀錄，最後只剩 A=paid。壓實後舊版 A、B 可能被移除，A 最新值仍可用；墓碑本身保留一段時間後也能被清理。若舊讀者還帶著 B，又錯過墓碑，它需要從可信快照重建或對帳，不能當成「沒收到更新就是沒事」。

- `cleanup.policy=delete`：依時間或大小刪除符合條件的舊日誌區段；`retention.ms` 不是每筆到期即移除的排程。
- `cleanup.policy=compact`：背景工作按鍵清理被取代的值，保留有效鍵的最新值；同一鍵的多個版本可暫時共存。
- `cleanup.policy=compact,delete`：兩種清理均會發生，時間或大小仍能移除符合條件的區段，不再承諾無限期保存每個鍵的最新值。

清理區段和寫入不是同步的。今天先推導哪些紀錄可以消失，不要寫「15:03 一定只剩 1 列」；也不應用手上一次讀到 4 筆，就反推系統沒有開壓實。壓實不會把剩下紀錄的位移重新編號，接續時仍然用原來的位置向前。

## 給讀者一份可恢復的契約

假設風控需要回看 10 天，而業務主題只有 7 天保留。設 `earliest` 也只能回到仍在的紀錄；要從長期檔案或另一個可信來源補上缺的範圍，再按[〈位移與提交〉](#/lesson/bd-kafka-05)記錄接續點。此時「只看到最晚狀態」尤其不好拿來估計舊交易總額，因為中間變更都可能已經不在。把事件歷史與發布當前狀態拆成兩個主題，才容易為兩者分別寫補齊測試。

辦交接時另外記錄目的端需要多少時間重建。例如整張狀態表須讀 2 小時，就不應把墓碑保留預算設得比一次完整掃描更短。要測慢讀者，先造一個鍵、刪掉它，再讓帶舊狀態的副本晚些接起；若仍留下該筆，就要設計重建路徑，而不是只延長任務逾時。

把實際可讀的最早位置列進維運觀測，就能提前發現保留量不足。

## 常見錯誤

- 清理後缺少某個位移 → 存在空洞不等於其餘紀錄被重新排序 → 同查清理規則與起讀位置。
- 把墓碑當正常空字串 → 下游不會刪鍵 → 在交付測試對照實際刪除操作。
- 規定回看 10 天卻只留 7 天 → 來源不夠 → 保存歸檔或縮短可承諾的重播範圍。
