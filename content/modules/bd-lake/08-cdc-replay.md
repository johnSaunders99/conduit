---
id: bd-lake-08
module: bd-lake
order: 8
title: CDC 湖倉重播
subtitle: 核對快照切換前後的刪除
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-07
objectives:
  - 畫出全量快照與變更日誌的交接邊界
  - 重播含舊更新和刪除的事件並檢查鍵未復活
  - 比較來源位置、目的端提交與保留窗
tags:
  - CDC
  - 重播
  - 刪除標記
  - 來源位置
resources:
  - title: Debezium：MySQL 連接器
    url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀初始快照，以及刪除與空值事件的差異。
  - title: Uber：由批次改做實時攝取
    url: https://www.uber.com/us/en/blog/from-batch-to-streaming-accelerating-data-freshness-in-ubers-data-lake/
    kind: article
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看改架構的時效原因，不移植規模。
concepts:
  - id: bd-lake-08-boundary
    prompt: 全量以位置 200 一致讀取，何時起接增量？
    answer: 按來源契約從不漏數的交接位置讀取；本例是大於 200，重疊時需有去重規則。
    mcq:
      options:
        - 從下一天開始
        - 從目的端的最大金額開始
        - 本例從來源位置大於 200 開始
        - 從程式重新啟動的時間開始
      answer: 2
      explain: 來源位置才可重播；牆鐘時間會有交接間隙。
  - id: bd-lake-08-delete
    prompt: 如何阻止已刪除的鍵被舊更新復活？
    answer: 保留該鍵的最後刪除位置，拒絕低於或等於它的舊事件。
    mcq:
      options:
        - 比收到訊息的牆鐘時間
        - 保留刪除位置並比來源順序
        - 忽略所有刪除
        - 把鍵對應的全部歷史移除
      answer: 1
      explain: 若直接丟掉版本證據，舊更新會被當首次到達。
    interview:
      question: 消費端重播兩天發現有已刪訂單復活，你怎麼縮查？
      points:
        - 找快照切點及刪除來源位置
        - 查寫端是否保留刪除版本
        - 演練同段重播及合法重建
      answer: 我會先對一個復活鍵查快照切點與來源刪除位置，確認下游把它當刪除而不是忽略空值。再用刪除後重送舊值的反例跑兩次，最後加一筆較新的重建，確定防重不會誤殺真的新數據。
  - id: bd-lake-08-retention
    prompt: 停機超過來源日誌可讀期限，能跳到目前位置嗎？
    answer: 不能用它假裝追平；須重新建立一致快照、核對並接上新的切點。
    mcq:
      options:
        - 能，因為下游一定沒漏
        - 能，只要游標記錄錯誤
        - 不能，須重建切點與對帳
        - 不能，只能永久停止
      answer: 2
      explain: 保留窗是恢復能力的一部分，不是單純節省儲存。
practice:
  - id: bd-lake-08-p1
    kind: code
    title: 驗證同一段 CDC 能重跑
    minutes: 13
    steps:
      - 執行 replay.py，保存兩次可見輸出與 commit 位置到 replay-note.md。
      - 把第二批增添 (204, 7, 120)，再跑兩次。
    checks:
      - 原本每次只見鍵 8，游標可提交至 203。
      - 204 重建後兩次都見鍵 7 為 120；較舊事件不會改掉它。
---

## 先接好快照的邊，再把重播當成日常

全量快照（initial snapshot）若在位置 200 一致地讀取，增量應按同一來源契約接上；本例讀嚴格大於 200 的操作，不按「今天零點」。有些來源以同一位置排序一群事件，必須再納入交易內序號或來源提供的複合順序；不同來源的序號不能直接互比。變更數據捕獲（change data capture，CDC）送的是操作，不只是一張最後狀態表，因此寫端要知道如何處理插入、更新與刪除。

![一致快照在位置 200，重播 201 到 203，寫端提交後才推進游標](assets/bd-lake-replay.svg)

Debezium 的 MySQL 刪除事件用操作碼 `d` 表示刪除，之後可另送 tombstone（同鍵空值，用於 Kafka 日誌壓縮）；不是所有空值都等於業務刪除。建議為目標鍵保留刪除的位置證據，至少涵蓋可能接受的舊事件範圍；若跨系統要補回更早歷史，須另訂重建策略。

## 讓同一批跑兩次

在 `C:\dev\conduit-lab\lake` 存 `replay.py`。執行 `py replay.py`；WSL 2 用 `python3 replay.py`（可用 RAM 0.25 GB）。清單的第 3 欄為目前金額或本模型中的刪除標記。位置 201 重送，但不得改掉 203 刪除。本模型以單一來源、唯一整數位置模擬歸併，不模擬日誌連接器、雙寫交易或保留窗。

```python
state = {7: (200, 90)}
batch = [(201, 7, 110), (203, 7, None),
         (202, 8, 60), (201, 7, 110)]
for attempt in (1, 2):
    for pos, key, value in batch:
        if pos > state.get(key, (200, None))[0]:
            state[key] = (pos, value)
    visible = sorted((k, v) for k, (_, v) in state.items() if v is not None)
    print(attempt, visible, "safe after full batch", max(p for p, _, _ in batch))
```

到達順序刻意打亂，所以抵達 203 時不能立刻跳過尚未套用的 202。完整批次成功才確認該連續切點；這種確認要靠讀取範圍的契約，而不是只拿觀察到的最大值就宣稱無缺。對帳時同時比可見鍵、刪除鍵的版本和未完成區間；筆數相同不等於刪除正確。停機超過日誌保留範圍時，標為需要重建，安排一致快照與新切點。

## 把「重播成功」變成能驗的交接條件

做三份清單：來源事件範圍、表中目前可見鍵，以及刪除鍵的最後位置。第一份用來回答能不能完整重播；第二份給報表核對；第三份防止看不到那一列就忘了它曾被刪除。把來源位置及目的表版本記在同一張交班單，明確說哪個版本可以繼續使用。停機很短時，先回放同一段並驗冪等；如果刪除證據已過期，先隔離舊重送，不應把它與一般新事件一起套回去。這才解釋了為何維護策略要同時考慮來源日誌、表快照和刪除證據，而不是只留夠一天的磁碟。實時數倉職可用這張交班單說明可重播，不用把小樣本冒充真正線上事故。

同一家近實時數倉招聘樣本列有 Flink 與 Paimon（`research/job-evidence.csv`，463572）；這份固定案例可用來演示，不證明會操作該公司的環境。

## 常見錯誤
- 漏了快照切換後一筆 → 以工作機時間切分 → 記錄來源的一致位置並驗邊界。
- 第二次重送讓訂單復活 → 刪除時忘了保留最後版本 → 把刪除證據納入策略。
- 只報重播作業完成 → 沒核對目的端是否提交 → 對同批鍵及游標留下可查紀錄。
