---
module: "bd-distrib"
id: "bd-distrib-07"
order: 7
title: "分散式重試"
subtitle: "失敗分片不要造成重複入帳"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-distrib-06"
objectives:
  - "從工作失敗與提交時間線找出重複入帳的缺口"
  - "重跑同一批事件並用穩定鍵保住一次效果"
tags:
  - "重試"
  - "冪等"
  - "提交"
  - "事件鍵"
resources:
  - title: "MapReduce Tutorial"
    url: "https://hadoop.apache.org/docs/r3.5.0/hadoop-mapreduce-client/hadoop-mapreduce-client-core/MapReduceTutorial.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Task Execution、OutputCommitter 與任務嘗試。"
concepts:
  - id: "bd-distrib-07-retry"
    prompt: "失敗的任務重跑時，哪些動作可能再發生？"
    answer: "該次嘗試執行的讀取、計算和外部寫入都可能再做；只有明確隔離或冪等的效果才安全。"
    mcq:
      question: "第一次已寫入，但成功回報遺失，重試純追加會怎麼樣？"
      options:
        - "引擎一定自動回滾"
        - "第一筆會自動變成缺值"
        - "業務列可能出現兩次"
        - "只要同一台機器就安全"
      answer: 2
      explain: "引擎沒有證據能分辨回報遺失和寫入沒成功；追加可能重複。"
  - id: "bd-distrib-07-key"
    prompt: "什麼鍵能讓重送後仍指同一筆業務事件？"
    answer: "使用來源在重送時不變的事件識別碼，並在輸出端約束其唯一或用它做更新。"
    mcq:
      question: "哪個鍵最能識別同一支付事件的重送？"
      options:
        - "本次執行的時間"
        - "重試流水號"
        - "會員編號"
        - "來源支付事件編號"
      answer: 3
      explain: "前兩個每次都變；會員可多次支付，只有穩定事件鍵符合粒度。"
    interview:
      question: "任務重試和 exactly-once 業務效果有何不同？"
      points:
        - "指出寫成功但回報丟失的窗口"
        - "使用穩定事件鍵與唯一性或原子提交"
        - "重放驗證筆數和金額"
      answer: "我預期任務能執行多次。若第一次已入帳但回報沒到，重跑用同一事件鍵，讓輸出端唯一約束或交易去保證只生效一次。我會故意重放整批，核對唯一事件數和總額。"
  - id: "bd-distrib-07-publish"
    prompt: "暫存輸出和正式輸出的分界是什麼？"
    answer: "暫存可容納未完成的嘗試；提交是讓通過檢查的一次輸出變成讀者所見的正式結果。"
practice:
  - id: "bd-distrib-07-lab"
    kind: "hands-on"
    title: "保留一次失敗後的重跑紀錄"
    minutes: 11
    steps:
      - "在 bd-distrib 執行 retry.py"
      - "保留純追加與以鍵寫入的兩行結果"
      - "再把第三筆換成新付款事件，確認同一會員也能再次付款"
    checks:
      - "純追加 4 列共 300 元，以鍵寫入 2 列共 150 元"
      - "新事件鍵不會錯誤覆蓋舊事件"
---

## 失敗不一定發生在寫入前

退款工作處理 2 筆事件。第一個嘗試把 100 元與 50 元都送到入帳端，程式卻在回報成功之前斷線。排程器只知道沒有收到完成訊息，不知道入帳端已經寫完。重試（retry）會再執行一次處理；如果每次都是追加（append），最終不是 150 元而是 300 元。這就是「執行成功」和「業務效果只發生一次」必須分開談的理由。

![兩次任務嘗試，一次正式結果](assets/bd-distrib-retry.svg)

能重放的輸入最好有穩定範圍與排序規則，例如固定來源檔版本、同一批日期，以及同一個來源事件鍵。冪等（idempotency）指以同一輸入重複執行，不會讓可見結果繼續累加。用重跑時新生成的識別碼沒有用；用會員鍵也太寬，一位會員可以有多筆退款。約束必須落在業務粒度（grain），也就是「一列代表什麼」。

## 讓外部看見結果的時點

提交（commit）是把經檢查的結果變成正式可見。檔案批次可為每次嘗試寫到不同暫存位置，所有分片完成後才按照儲存系統支援的原子操作或提交協議發佈；原子（atomic）表示讀者不應看見一半新一半舊。數據庫也可依穩定鍵設唯一約束並在交易中寫入或更新。MapReduce 的輸出提交器（OutputCommitter）能協調框架管理的檔案輸出，但不會替程式發送的通知或外部寫入收回重複效果。不要把本機改名的性質直接套到所有物件儲存。

恢復時應確認**最後一份對讀者一致的輸出**，從相同輸入範圍重算，而不是從看起來最後修改的檔案接著追加。日後會看到來源讀到的位置叫偏移量（offset），見 [〈位移與提交〉](#/lesson/bd-kafka-05)；引擎保存的復原狀態叫檢查點（checkpoint），見 [〈檢查點與屏障〉](#/lesson/bd-flink-06)。這些能協助重放，不能取代輸出端的唯一效果規則。

## 把同一批送兩次

在 `C:\dev\conduit-lab\bd-distrib` 將下方存為 `retry.py`，執行 `py retry.py`，預留 0.25 GB RAM。記憶體字典只模擬唯一鍵效果，不是耐久的交易系統。
```python
events = [("r-01", 100), ("r-02", 50)]
append_only = []
by_event = {}
for attempt in (1, 2):
    for event_id, amount in events:
        append_only.append(amount)
        if event_id in by_event:
            assert by_event[event_id] == amount
        by_event[event_id] = amount
print("append", len(append_only), sum(append_only))
print("by_key", len(by_event), sum(by_event.values()))
```
若同一事件鍵金額不同，程式會停下，不能默默以最後一次的值蓋過。業務若允許更正，要定義更正的版本或新事件，先定規則再談重跑。這也是為什麼練習要保留兩種輸出，不只看無錯誤訊息。

### 在紀錄上標出真正的交付

畫出讀取、暫存、驗收、正式發佈、回報五個時點。用一條箭頭標出「正式發佈之後、回報之前」的缺口，再寫下外部讀者會看到什麼。真正的一次效果必須跨過這個缺口，不能只靠縮短重試等待。

## 常見錯誤

- 看到任務失敗就當成沒寫 → 失敗可能在回報途中 → 先核發佈紀錄與穩定鍵。
- 用嘗試識別碼去重 → 每次嘗試的值都不同 → 認來源事件鍵。
- 先看輸出總額相同就交件 → 可能一筆多算另一筆漏算 → 同時核唯一鍵與列數。
