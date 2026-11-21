---
id: cr-behavior-04
module: cr-behavior
order: 4
title: 技術英文口述
subtitle: 用九十秒交代一次重跑
status: ready
minutes: 25
level: 4
prereqs:
  - cr-behavior-03
objectives:
  - 用英文在 90 秒內交代受影響輸出、重跑範圍與驗收
  - 讓接手者重述下次檢查時間、差異門檻及行動
tags:
  - 技術英文
  - 交班
  - replay
  - 對帳
  - utc
resources:
  - title: Google Technical Writing：短句
    url: https://developers.google.com/tech-writing/one/short-sentences
    kind: course
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 練一句只交代一個可行動的重點。
  - title: Google SRE Workbook：事件應變
    url: https://sre.google/workbook/incident-response/
    kind: book
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 看交班時如何明確移交責任。
concepts:
  - id: cr-behavior-04-impact
    prompt: 技術交班開頭應先說什麼？
    answer: 清楚交代延遲的是每日摘要；原始收款仍然可用。
    mcq:
      options:
        - 說一串服務版本
        - 說 all services are down
        - 先說摘要未發布、來源仍可用
        - 先猜代碼根因
      answer: 2
      explain: 先讓接手者知道業務影響與仍可用的部分。
  - id: cr-behavior-04-window
    prompt: 英文說 more than zero，差異恰好等於 0 要怎麼做？
    answer: 不觸發這條通報條件，但仍要核對其餘指標才能發布。
    mcq:
      options:
        - 照這條立即通報
        - 不觸發，仍核對其他條件
        - 宣告都修好
        - 解讀成補寫 1 列
      answer: 1
      explain: more than 不含等號；單個指標沒有差異不等於所有驗收都通過。
  - id: cr-behavior-04-handoff
    prompt: 怎麼用英文回報一次未證實根因的重跑？
    answer: 指出已驗的營業日和數值、未確認根因、下一班的動作。
    mcq:
      options:
        - 已驗單日便說 everything is fixed
        - 用術語代替時間和對帳
        - 分開 verified、not confirmed 和 next action
        - 不量化任何觀察
      answer: 2
      explain: 一個清楚的下一步比更肯定的語氣有用。
    interview:
      question: Please hand off a delayed daily payment summary.
      points:
        - 先說使用者影響及仍可用部分
        - 說明 UTC、日期與驗收值
        - 交下一個檢查角色和門檻
      answer: The daily summary is late, but raw payments are available. At 08:10 UTC I reran only the affected business day. We matched two unique
        payments and 1,600 cents. The trigger is still unknown. At 08:20 UTC, the next operator will check again and keep publication paused if the
        numbers do not match.
practice:
  - id: cr-behavior-04-p1
    title: 錄一段能回讀的英文交班
    kind: explain
    minutes: 10
    steps:
      - 在 C:\dev\conduit-lab\behavior 存 english-handoff.txt，自行改寫範例而非照念。
      - 以 90 秒為上限口述，然後用接班角色回讀下一步。
      - 試筆數差 0、總額差 800 分的變體；寫下應採取的動作。
    checks:
      - 英文有來源、受影響日期、時間與單位；沒把未知寫成事實。
      - 回讀指出 08:20 UTC 要再對帳；即使筆數相符，差 800 分也不發布。
---

## 交班的目標是讓下一個人知道該做什麼
「We reran the pipeline. It looks fine.」這兩句英文不難，卻沒說影響對象、重跑範圍、什麼算通過。交班（handoff）把工作交給沒有你上下文的角色。先用中文回答誰失去什麼、我重新做了哪段、用哪兩個量確認，才把它們改成短英文。不要一開口就用一長串架構術語解釋原因；先給能做決策的現況。

## 用四段短句：Impact、Action、Evidence、Next
- Impact：先說延遲的是日摘要（daily summary），原始付款仍可用。不要把一張表未更新講成整個系統掛掉。
- Action：`We reran only ...` 說做過的部分，給營業日與時區；不要把作業啟動的 UTC 時間誤作營業日期。
- Evidence：核對（reconciliation；此處指對帳）可說 `We matched two unique payments and 1,600 cents.` 金額有單位，`unique` 指事件鍵不重複。
- Next：講誰在什麼時間查什麼，什麼條件不符就維持停發。根因未知可說 `We have not confirmed the trigger.`；不是「沒有根因」。

## 一份可直接回讀的虛構交班
將下面的結構改寫後保存在 `C:\dev\conduit-lab\behavior` 下的 `english-handoff.txt`。不放姓名、連結或真實帳號，只保留可核對的條件。

```text
The daily payment summary is late. Raw payments are still available.
At 08:10 UTC I reran only the April 3 business day, using the store's time zone.
We matched two unique payments totaling 1,600 cents. Publication is still paused.
We have not confirmed what triggered the duplicate.
At 08:20 UTC, the next operator will reconcile that day again.
Publish only if both the count and the amount match. If either differs, keep
the summary unpublished and tell the reporting team.
```

接著扮演另一班做回讀（read-back）：「At 08:20 UTC I will check the April 3 count and amount before publishing.」光回覆 `Got it` 不表示接住條件。若有人問要查多少筆，回答兩筆不同付款事件，不是「兩列就一定正確」；若筆數相同但金額差 800 分，仍不能發布。對英文動詞不熟時可重複主詞與名詞，不必硬用 it 和 they，讓對方不用猜它們指原始付款還是發布作業。

### 用目標市場選一個追問
`research/market-report.md` 與 `research/job-evidence.csv` 的新加坡初階平台樣本 4489458919 明列流處理及技術經驗。投類似職責可補答積壓（backlog，還沒處理的事件）與重播（replay，從已知位置重讀先前事件），但分清你做的是日批還是實時。香港的對帳樣本則可練用同一份稿，先向業務解釋哪個輸出可用。這是依職務調整稿件的練習，不宣稱當地面試都用同一語言或流程。

### 將技術證據和使用者公告拆成兩句
對工程同事，值得說的是重跑只涵蓋一個營業日，且筆數與分值都經核對。對正在等報表的營運，第一句改成「The April 3 summary is not ready to use.」然後給下一次更新時間，不把根因猜測塞進對外說明。技術稿仍保留哪些證據尚不足：即使同一天重跑對帳一致，也沒有證明其他日期或故障重啟時一定相同。

若面試官接著問哪個事件造成差額，先以一行回答：「One event was counted twice. We found the same event ID in two input rows.」再看對方是否想知道去重的取捨。會話不只是把整個稿子背完；能即時把解釋切到影響、驗收或重跑邊界，才讓對方跟得上。

## 常見錯誤
- 說 `It is normal now.` → 根因或發布還未驗 → 分開「來源可用」與「摘要未發布」。
- 用 `Check later.` → 沒有交付時間與人 → 說 `At 08:20 UTC, the next operator will...`。
- 將 `more than` 當成含等號 → 門檻會誤判 → 若包含等於，用 `at least`。

## 小結
先講可用性，再講限在哪裡，最後讓另一班用一句話回讀要做的事。英文深度來自證據，不是形容詞。
