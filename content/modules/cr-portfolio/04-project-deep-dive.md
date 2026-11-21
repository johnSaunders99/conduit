---
id: cr-portfolio-04
module: cr-portfolio
order: 4
title: 專案深挖與取捨
subtitle: 為何不用另一種更大的工具
status: ready
minutes: 25
level: 2
prereqs:
- cr-portfolio-03
objectives:
- 沿一筆訂單解釋從來源到日報的決策
- 比較本機腳本、SQL 引擎與分散式執行的適用條件
- 預告下一步會量的訊號而不冒稱已驗
tags:
- 專案深挖
- 取捨
- 重送
- 方案比較
resources:
- title: Amazon：校園數據職面試指引
  url: https://atoz.amazon/en-us/jobs/hiring-process/interview-prep/university/data
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀數據工程期待，練習連結技術與業務。
- title: Data Engineering Zoomcamp
  url: https://github.com/DataTalksClub/data-engineering-zoomcamp
  kind: course
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 從專案要求找規模、工具與交付的取捨。
concepts:
- id: cr-portfolio-04-tradeoff
  prompt: 如何回答為何沒有用 Spark？
  answer: 從輸入規模、依賴成本及實際需求說明；本次用單機標準庫完成，若單機量測不足再比較替代方案。
  mcq:
    question: 本機 5 筆能準確核對，但未測規模，哪句合適？
    options:
    - Spark 一定更慢
    - 目前解符合小樣本範圍，擴展前要量測
    - 現在已可承載正式流量
    - 永遠不需要數據庫
    answer: 1
    explain: 沒有同條件量測，不可斷言其他方案更慢或無需求。
- id: cr-portfolio-04-failure
  prompt: 同 ID 金額不同為何不直接取最後一筆？
  answer: 沒有版本或可信時間，最後一筆未必是正本；本作品拒絕並記位置。
  mcq:
    question: 何種新證據能合理改成取較新版本？
    options:
    - 輸入碰巧按檔名排好
    - 不同值都取最大
    - 上游定義可信版本欄與並列規則，且已驗
    - 發現拒絕太醜
    answer: 2
    explain: 版本規則是業務契約，必須能處理變更與平手。
- id: cr-portfolio-04-trace
  prompt: 為何挑一筆重送帶著走完整管道？
  answer: 讀者能從輸入、規則到報表手算，不需信任截圖或概念圖。
  interview:
    question: 輸入放大到單機記憶體吃不下，你會先怎麼辦？
    answer: 先量在哪一段滿：是否字典累積太多唯一鍵。我會用同規模樣本，比一個能用磁碟做彙總的本機方案；若吞吐或時限仍不夠，再評估分散執行。
    points:
    - 辨明真正瓶頸
    - 提出公平比較
    - 把規模假設說清楚
practice:
- id: cr-portfolio-04-p1
  kind: explain
  minutes: 9
  title: 留下一張三分鐘深挖卡
  steps:
  - 在 C:\dev\conduit-lab\orders-portfolio 建 walkthrough.md。
  - 將 O2 從原始兩列追到一次入帳；再寫一種替代方案與切換條件。
  checks:
  - 可手算 250 元並指出 O2 只加 80。
  - 卡片有一項實測、一項尚待驗證及一個失敗反例。
---

## 從一筆重送講起，不從架構圖講起

面試的專案深挖（project deep dive）不是按工具名稱逐一報告。先說營運要核對單日付款；再沿 O2 兩筆完全相同的送達記錄，說明怎麼進唯一訂單集合，最後只加一次 80 元到 250 元。如果第二筆金額不同，沒有可靠版本欄就不能假定最後到的一筆一定新；本例先拒絕整批。用 3 分鐘講清輸入、決策、可看結果與未覆蓋邊界，讀者會知道往哪裡追問。

取捨（trade-off）要說明在什麼條件下作某個選擇。用 Python 標準庫的好處是可直接執行、易追單筆；代價是唯一 ID 留在記憶體。本機 SQL 引擎則能更自然表達分組、與其他表對帳，再衡量磁碟與查詢開銷。若有多個來源且單機在容許時間交不出，才考慮分散式執行（distributed execution）：把工作拆往多個執行單位，但也會增加協調與診斷。這三者不是價目表；不量就不能宣稱哪一個更快。

## 把「那如果」變成一個要量的條件

如果面試官問「數據量放大 100 倍呢」，先確認是重送量、唯一鍵還是檔案本身放大。讀 100 倍列、只增加相同 ID，字典可能不成長 100 倍，但掃描時間仍會變；若每筆都是新 ID，記憶體會跟著長。可提出用同分布與規模的虛構樣本，記峰值記憶體、端到端時間和核對值，再決定是否要把中間狀態移到磁碟。沒有量之前，把答案留在假設與方案，而不是結果。

報告萬一沒產出，不要用備用截圖冒稱當場成功。先說出第一個偏離預期的位置，再用標上日期和條件的已存輸出講決策。〈[交接與展示](#/lesson/cr-portfolio-05)〉會把這套主路徑和備案排成短演示。

### 排好一段可被打斷的說明

前 30 秒說明為什麼營運需要這張表以及自己負責什麼；下一分鐘在兩筆 O2 旁解釋規則與結果；再留一分鐘答替代方案，最後用一句話標出未測環境。若中途問「更正單應該怎麼辦」，不需要把全部架構重新講一遍。先回到可驗證的條件：本例沒有可信版本，也沒有退款欄，兩筆衝突必須拒絕；真的要支援變更，先向來源確認穩定版本，再用兩個相反到達順序驗證結果一致。

能預先挑出一個不該被接受的案例，也能讓審查者看見你何時會否定自己原本的方案。與其多畫幾個尚未實作的箭頭，不如留一個清楚的測量條件，說明何時擴展才值得。

## 常見錯誤

- 只介紹工具名 → 僱主無法定位你的決策 → 示範一筆訂單怎麼入帳。
- 一遇規模就換分散式 → 沒有看瓶頸落在哪 → 先量單機輸入、狀態和時限。
- 只保存成功值 → 無法證明錯誤會被擋住 → 準備同 ID 不同金額的對照。
