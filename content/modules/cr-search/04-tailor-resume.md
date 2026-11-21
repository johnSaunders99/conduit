---
id: cr-search-04
module: cr-search
order: 4
title: 按市場調整履歷
subtitle: 把同一份成果換成當地說法
status: ready
minutes: 25
level: 1
prereqs:
- cr-search-03
objectives:
- 用同一份證據寫出中英文履歷句
- 替四種市場選不同的第一項證據
- 把有完成與待驗證分開
tags:
- 履歷
- 職責對照
- 市場用語
- 英文摘要
resources:
- title: 大陸零售數據開發校招樣本
  url: https://www.nowcoder.com/jobs/detail/465189
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 找分層與指標職責，選對應的成果。
- title: 香港數據工程培育計畫樣本
  url: https://hk.linkedin.com/jobs/view/data-engineering-graduate-programme-jan-2027-start-date-at-fdm-group-4463232697
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看英文公告如何描述遷移與管道。
- title: 台灣製造業數據工程職缺樣本
  url: https://tw.linkedin.com/jobs/view/%E7%AB%B9%E5%8C%97-data-engineer-at-winbond-4472532306
  kind: article
  lang: zh-Hant
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 以台灣職稱與模型用語調整標題。
- title: 新加坡初階數據工程職缺樣本
  url: https://sg.linkedin.com/jobs/view/junior-data-engineer-20261042355-at-beyondsoft-singapore-4489458919
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比較批次與串流責任，不要照抄全部。
concepts:
- id: cr-search-04-consistent
  prompt: 依市場改履歷時，哪些事不能改？
  answer: 本人貢獻、環境、樣本規模與實測結果；只改用語、順序與重點。
  mcq:
    question: 同一份本機作業沒有做實時處理，新加坡職缺寫 streaming，怎麼寫？
    options:
    - 改標實時管道
    - 照實寫批次與驗證，把實時列為缺口
    - 用串流讀檔冒充實時交付
    - 刪掉本機限定
    answer: 1
    explain: 用職責選證據不等於把未做的功能換名。
- id: cr-search-04-keyword
  prompt: 台灣搜尋時為何可同時查資料工程師與數據工程師？
  answer: 相同或相近工作可能用不同職稱，最後仍按實際交付判斷。
  mcq:
    question: 英文稿和中文稿都指同一成果，最值得做的核對是？
    options:
    - 每一字逐字翻譯
    - 每句都塞足相同工具名
    - 讀一遍數字、範圍與貢獻是否一致
    - 英文版的範圍可以拿掉
    answer: 2
    explain: 措辭可因讀者換，事實必須能用同一份證據追查。
- id: cr-search-04-remote
  prompt: 看到 remote，除了職責要分開查什麼？
  answer: 僱用地、工作授權、配合時段；不能由遠端二字推定全球可應徵。
practice:
- id: cr-search-04-p1
  kind: hands-on
  minutes: 9
  title: 同一結果寫兩種市場版本
  steps:
  - 在 C:\dev\conduit-lab 建 resume-variants.md，挑一段實際練習結果。
  - 寫一條中文、一條英文，為每條補同一份輸出檔路徑與一個缺口。
  checks:
  - 數量、環境與貢獻一致。
  - 能指出哪項職責使第一句換焦點。
---

## 換第一句，不換事實

假設你真的做了本機訂單批次：10 筆虛構輸入，找到 2 筆重送，輸出 8 筆唯一訂單；同日重跑仍是 8 筆。履歷（résumé）要讓讀者知道你做了哪段、如何驗，而不是貼工具清單。先寫「我做了什麼 → 對哪個輸入 → 用什麼結果驗證 → 在哪個環境」，再依職缺換第一句。以下是示範句，不是可直接貼成自己的成果。

- **中國大陸校招／社招：** 校招對照分層、指標口徑與 SQL；初級社招若寫日常數據維護，可把重跑驗證放第一句。「以 Python 對 10 筆虛構訂單驗重並輸出清洗結果；同日本機重跑維持 8 筆唯一訂單。」若沒有上游事實表，不要說建成整個數倉。
- **香港：** 把整合、對帳放早，預備用英文口述。例：Validated a local Python batch against 10 synthetic order rows; two replays were excluded, and a same-day rerun still produced eight distinct orders. 沒有金融數據，就不填金融場景。
- **台灣：** 可在職稱搜尋使用「資料工程師」；進作品說明仍維持清晰的數據術語。對整合職缺，先講來源、清理規則與對帳；有建模證據才說事實表和維度表。

## 不為了命中關鍵詞而換掉情境

新加坡的初階樣本也可能寫串流。如果你的作品只有每日批次，就寫 batch pipeline、validation、rerun；不要把逐列讀檔寫成達到實時時效。跨國遠端則把重現方法和交接證據放早一點，另查實際僱用地、工作授權與時段。專案 `research/market-report.md` 和 `research/job-evidence.csv` 的 Kit 個案是資深職，還有時段要求，不是新人遠端的普遍樣貌。投遞前讀目標公告，不拿市場印象替自己或僱主填空白。

每寫完一條，請用手指點到可以驗證它的腳本、輸出或測試。若把「做了」改成「負責」，範圍也得有證據。如果本機樣本只有 10 筆，不該用更漂亮的百分比把樣本藏起來。〈[履歷成果與證據](#/lesson/cr-portfolio-03)〉會把每句連到更完整的驗證。

### 做一次去關鍵詞檢查

先把 Python 和管道兩個詞遮住。剩下的文字若仍能讀出拿到幾筆、辨認幾筆重送、交出什麼，內容才不會淪為品牌清單。再選一個雇主要驗的字眼加回來，例如對帳；若沒拿外部帳源比對，就只寫依固定預期值驗算，不要把同一份輸入當成兩個獨立帳源。換重點是幫讀者找證據，不是把自己套進每一項要求。

如果公告看起來是附近市場，正文卻寫必須在別的雇用地，應另記為資格問題，不要靠換措辭彌補。適合剪掉的是與當前交付弱相關的句子；適合保留的是能解釋你的貢獻與限制的數字。

## 常見錯誤

- 英文版多出未做的技術 → 對詞不對事 → 中英文回查同一份輸出。
- 一份稿同投所有角色 → 看不見最貼近的交付 → 只換最重要的證據與順序。
- 遠端直接當跨境 → 混淆工作地與居家方式 → 閱讀正文並核對到職與時段。
