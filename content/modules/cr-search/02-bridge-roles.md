---
id: cr-search-02
module: cr-search
order: 2
title: 橋接職務
subtitle: 從報表維護走向管道開發
status: ready
minutes: 25
level: 1
prereqs:
- cr-search-01
objectives:
- 按交付物判斷職務是否能銜接數據開發
- 查清審查、值班與下一段能力
- 把現有證據對到一項可練的缺口
tags:
- ETL
- BI
- 橋接
- 交付物
resources:
- title: 大陸初級數據開發社招樣本
  url: https://www.zhaopin.com/jobdetail/CCL1520625040J40858908201.htm
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比較經驗欄與實際腳本、數據維護職責。
- title: 香港數據工程培育計畫樣本
  url: https://hk.linkedin.com/jobs/view/data-engineering-graduate-programme-jan-2027-start-date-at-fdm-group-4463232697
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看培育計畫的管道工作與入職條件。
- title: 台灣製造業數據工程職缺樣本
  url: https://tw.linkedin.com/jobs/view/%E7%AB%B9%E5%8C%97-data-engineer-at-winbond-4472532306
  kind: article
  lang: zh-Hant
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 由模型與整合職責判斷橋接方向。
concepts:
- id: cr-search-02-bridge
  prompt: 為什麼工具相同的兩份職缺不必然是同一入口？
  answer: 使用者、交付物和維運責任可能不同；先讀工作會交什麼。
  mcq:
    question: 想往數倉走，以下哪個入口較能直接累積所需證據？
    options:
    - 每天只重排報表顏色
    - 只填工單但看不到輸入
    - 維護整合腳本並對帳、有人審查
    - 只有熟悉熱門引擎的課程
    answer: 2
    explain: 該工作同時產生腳本、核對與審查證據；工具曝光不是同一回事。
- id: cr-search-02-oncall
  prompt: 外包或顧問職應問清什麼？
  answer: 誰雇用、誰審查、能否碰源至表的流程、值班失敗時誰負責。
  mcq:
    question: 公告只寫「客戶數倉維護」，什麼不能推定？
    options:
    - 工作涉及某種維護
    - 會直接受雇於客戶
    - 可詢問帶教
    - 可詢問有無對帳工作
    answer: 1
    explain: 服務商代為交付不等於客戶是實際僱主。
- id: cr-search-02-gap
  prompt: 做過報表的人想往管道走，最好先補什麼？
  answer: 把手工操作變成可重跑的輸入、方法和核對，證明同一天重跑不會重複加總。
practice:
- id: cr-search-02-p1
  kind: hands-on
  minutes: 9
  title: 做一張兩職務對照卡
  steps:
  - 在 C:\dev\conduit-lab 的 bridges.md 寫下兩個職務的交付、已有證據與一項缺口。
  - 為較想投的一個寫兩個需要招聘方確認的問題。
  checks:
  - 問題包含審查或維運責任至少一項。
  - 下一個練習能交付檔案或對帳輸出，不是多學一整套工具。
---

## 一個入口該讓你帶走什麼？

橋接職務（bridge role）的價值，是在有人審查下接觸下一份工作需要的產物。ETL（extract, transform, load）是擷取、轉換、載入；整合支援可能讓你維護定時匯入、處理異常列和核對兩端。商業智慧（business intelligence，BI）開發也可能含數據模型與更新管道，但若主要工作只換視覺格式，就不一定是同一段經驗。先看權責，再看職稱或工具清單。

從分析轉開發，選一個每週人工重做的報表：保留原始檔，讓轉換可重跑，新增一個對帳，驗證重做同一天不會翻倍。若原先做後端，可沿用測試與日誌的習慣，再補粒度（grain，即輸出每列代表什麼）與歷史版本。這樣拿同一份小作品挑兩種入口時，有明確差異：整合支援先展示異常列如何查；BI 開發先展示分母、輸出和刷新時點。

## 沿著市場樣本找可累積的事

- **大陸社招：** 對照初級 ETL、數倉開發與數據集成。下方經驗不限的樣本仍要 SQL 及能獨立寫簡單腳本；問是否有帶教、誰核對和誰處理晚班異常。外包交付先辨明僱主與客戶，不能把兩者寫成同一家公司。
- **香港：** 看 ETL 支援、BI 整合、畢業生培育。下方培育樣本含遷移與 SQL，學習計畫不等於入職條件沒有先修；準備用英文說出來源異常、核對方式與業務影響。
- **台灣與新加坡：** 台灣可同查「資料工程師」與「數據工程師」，從製造、金融整合看誰驗收數據；新加坡用 graduate 或 associate 等關鍵字找合資格職位，不把所有 Junior 都當無年資。這是根據專案 `research/market-report.md` 的樣本提出的搜尋做法，不是錄用或年資規則。

把盡可能短的下一段寫進對照卡：「第一項是我現在就能證明的；第二項需要核對；第三項若不足，下週補一個能跑的反例。」不要因為沒有某個引擎就停全部投遞，也不要因有作品而略過明寫的資格。〈[校招與實習資格](#/lesson/cr-search-03)〉會把時間與身分做成判斷。

### 同一個標籤，問兩份不同的問題

看到「BI 開發」不要立刻判為只拉圖。A 職缺若需要維護原始到報表的轉換，可確認誰訂規則、如何核對新舊結果；B 職缺若只用別人交付的指標，則問可否參與指標更新和例外處理。面談前把兩個問題寫進對照卡，你可以接受一份邊界較窄的工作，但應知道下一段能力要從哪裡累積。確定後把這個條件放到投遞優先序中。

## 常見錯誤

- 工具一樣便說工作等價 → 忽略產物、影響與誰負責 → 要求看實際交付。
- 只問培訓有沒有 → 看不出是否會參與真實驗收 → 加問審查、帶教與發生異常由誰處理。
- 一個缺口補完才看其他職缺 → 需求不同 → 保持兩條線：可投一類、補一項證據。
