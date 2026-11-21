---
id: cl-wh-05
module: cl-wh
order: 5
title: 阿里雲計算與排程
subtitle: 把表與排程責任拆開
status: ready
minutes: 35
level: 3
prereqs:
- cl-wh-04
objectives: ["把計算、排程、發布的責任分開標在流程圖","用業務日辨認遲到及重跑的作業","依失敗的階段選擇先看哪一份證據"]
tags: ["MaxCompute","DataWorks","業務日","排程補數"]
resources:
  - title: "阿里雲：MaxCompute"
    url: https://www.alibabacloud.com/help/en/maxcompute/user-guide/what-is-maxcompute
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "看數倉如何儲存與運算批次數據。"
  - title: "阿里雲：DataWorks"
    url: https://www.alibabacloud.com/help/en/dataworks/user-guide/what-is-dataworks
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "讀開發、工作流排程與運維監控。"
concepts:
  - id: cl-wh-05-service
    prompt: "MaxCompute 和 DataWorks 在本例各做什麼？"
    answer: "MaxCompute 執行轉換並儲存數據；DataWorks 編排與監控作業。"
    mcq:
      options:
        - "MaxCompute 只發警示，DataWorks 親自掃描全部數據。"
        - "DataWorks 只提供物件儲存，MaxCompute 只排程。"
        - "MaxCompute 執行轉換並儲存數據；DataWorks 編排與監控作業。"
        - "兩者是同一個引擎的兩個名稱。"
      answer: 2
      explain: "DataWorks 可協調不同引擎工作；須看實際節點指定的運算服務。"
  - id: cl-wh-05-date
    prompt: "2 月 4 日凌晨回補 2 月 3 日數據，目標分區是哪天？"
    answer: "以作業指定的業務日 2 月 3 日為準，不拿啟動日替代。"
    mcq:
      options:
        - "以作業指定的業務日 2 月 3 日為準，不拿啟動日替代。"
        - "固定是 2 月 4 日，因為在那天執行。"
        - "固定是最近有數據的日期。"
        - "用錯誤通知的日期。"
      answer: 0
      explain: "執行時間是觀察，業務日是輸入及輸出的口徑。"
  - id: cl-wh-05-failure
    prompt: "下游報表沒跑，先看到上游 SQL 失敗，第一步查什麼？"
    answer: "從排程找到對應的業務日和引擎作業，再看 MaxCompute 失敗訊息。"
    mcq:
      options:
        - "重跑下游，先不管上游。"
        - "刪掉整月表來消除錯誤。"
        - "增大所有工作負載的並行度。"
        - "從排程找到對應的業務日和引擎作業，再看 MaxCompute 失敗訊息。"
      answer: 3
      explain: "沿相依關係找失敗點，保留作業識別碼，比盲目重試容易定位。"
    interview:
      question: "歷史日報要回補一週，你會先定什麼？"
      points:
        - "明確業務日及上游切點"
        - "核對引擎結果和排程依賴"
        - "限量重跑且可重複發布"
      answer: "我先定要回補的業務日，以及各天原料是否齊全。用一天驗證同一切片重跑不追加重複結果，再限制一週的並行數；可從編排看到卡在哪，從引擎找到實際錯誤。"
practice:
  - id: cl-wh-05-p1
    title: "保存兩個日期的作業審閱紀錄"
    kind: hands-on
    minutes: 13
    steps:
      - "在 C:\\dev\\conduit-lab\\warehouse 存 schedule.py 並執行。"
      - "把某天的上游標成 READY 後重跑，寫下可推進的階段。"
      - "各記一個排程面與引擎面應追的證據。"
    checks:
      - "原輸出為第 3 日 HOLD、第 4 日 SUBMIT。"
      - "改動不使第 3 日的工作誤寫第 4 日分區，且本機沒有提交任何雲端作業。"
---

## 成本安全：先在紙上排兩天，不啟用資源

本堂不啟用阿里雲工作空間。日後試用先分別查 DataWorks 編排與 MaxCompute 運算、儲存的費率和免費範圍，限一個業務日、重試及並行數；到期列出該停的排程及仍保留的表。即使排程顯示免費，也不能推定提交給另一個引擎的工作免費。日報缺了週二，重跑究竟要修排程，還是要修引擎內的工作？

MaxCompute 是雲端數倉運算及儲存服務，可執行大批數據的轉換。DataWorks 是數據開發和治理平台，這裡只用它做工作流編排（orchestration）：決定先後順序、發送工作、追蹤結果、管理重試與警示。它不等於執行所有查詢的引擎。同一個工作流還可能送工作到其他實際運算服務，查錯時要先找這個節點到底送往哪裡。

## 先分責任，才知道到哪裡查

- 接收：來源到齊，能指出這次輸入的業務日（business date）和批次。
- 轉換：DataWorks 發送對應日期的工作；MaxCompute 當本例的引擎，讀上游、算明細及產出目標分區。
- 驗收和發布：比對列數或對帳值，成功才讓下游看到新分區。補數（backfill；台灣常稱回填）重做指定切片，不追加兩份同一天報表。

排程顯示「等待」時，先查依賴或資源排隊；已提交但引擎失敗，就帶引擎作業識別碼去查輸入或執行錯誤。兩面都要記啟動時間和業務日，否則半夜重跑很容易查錯日期。這一堂只辨認責任，不假定已學某個編排工具；有向無環圖（directed acyclic graph，DAG）用節點與箭頭表示有先後依賴的流程，可回看[〈DAG 與依賴〉](#/lesson/bd-orch-01)複習。

## 本機閘門模擬

在 `C:\dev\conduit-lab\warehouse` 存 `schedule.py`，執行 `py schedule.py`。兩筆都是教學狀態；不連引擎、不查日曆。

```python
inputs = [("2026-02-03", "MISSING"), ("2026-02-04", "READY")]
for day, input_state in inputs:
    target = f"daily_orders/day={day}"
    action = "SUBMIT" if input_state == "READY" else "HOLD"
    print(day, action, target)
```

第 3 日缺料應停在 HOLD，即使第 4 日能做也不能用它替代第 3 日輸入。數據補齊後，把同一日改為 READY；目標仍是同一分區。真實發布還需檢查重跑是否覆蓋同一切片，及失敗時舊版是否仍可供下游讀，不能把 SUBMIT 當成功。

### 值班交接不只抄一個紅燈

為第 3 日的缺料留「預期批次、實際到達、排程執行識別碼、引擎識別碼」欄。尚未提交時，引擎識別碼應空白，不要把它當成紀錄漏填。若引擎完成而對帳失敗，目標分區仍不能發布，並要保住上一個可用版本。隔天接手的人才能分辨是要等來源、重跑引擎，還是修正驗收規則，而不是看到失敗就把所有節點再跑一遍。

源端遲到但目標未改，則可安全等待而非發布空表。

## 常見錯誤

- 重跑時寫到今天 → 用執行日當業務日 → 把業務日當明確參數。
- 找不到錯誤詳情 → 只看排程狀態 → 從該節點找到對應引擎作業。
- 補算後每天多一份 → 用追加代替切片更新 → 按同一日期比對重跑前後的鍵和列數。
