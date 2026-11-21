---
id: cr-search-01
module: cr-search
order: 1
title: 職缺取樣與編碼
subtitle: 別被一篇全能清單嚇退
status: ready
minutes: 25
level: 1
prereqs: []
objectives:
- 把公告拆成職責、基本條件、加分與待確認
- 用一個頁面識別一次職缺
- 把一項常見交付轉成一個練習
tags:
- 職缺抽樣
- 條件編碼
- 研究偏差
- 職務分類
resources:
- title: 大陸零售數據開發校招樣本
  url: https://www.nowcoder.com/jobs/detail/465189
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對照職責提及的工具與任職條件。
- title: 新加坡初階數據工程職缺樣本
  url: https://sg.linkedin.com/jobs/view/junior-data-engineer-20261042355-at-beyondsoft-singapore-4489458919
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 查看職稱標為 Junior 但仍列年資的例子。
- title: 台灣製造業數據工程職缺樣本
  url: https://tw.linkedin.com/jobs/view/%E7%AB%B9%E5%8C%97-data-engineer-at-winbond-4472532306
  kind: article
  lang: zh-Hant
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 找一項職責和一項會改變投遞的條件。
concepts:
- id: cr-search-01-coding
  prompt: 工作會用 Spark 等於入職前必須精通 Spark 嗎？
  answer: 不等於；先看職責與任職條件如何措辭，有歧義先記待確認。
  mcq:
    question: 公告說「維護批次管道；會 Spark 優先」，Spark 如何編碼？
    options:
    - 硬性條件
    - 必須有上線年資
    - 加分
    - 與職缺無關
    answer: 2
    explain: 「優先」不是必備，而維護管道是另一欄的職責。
- id: cr-search-01-dedup
  prompt: 同一刊登編號被三站轉貼，算幾份？
  answer: 算一份；保留原始刊登位置和補充來源。
  mcq:
    question: 哪個數字不能從本課的幾份樣本推出？
    options:
    - 樣本內已見幾份職責提到對帳
    - 樣本中多少項條件仍未知
    - 完成去重後的樣本筆數
    - 全市場初階缺額
    answer: 3
    explain: 目的抽樣偏向找得到的頁面，不能替代全市場普查。
- id: cr-search-01-output
  prompt: 遇到一長串工具時，最先該提取什麼？
  answer: 每週交付的產物與驗收，例如每天對帳無異常，而不只是工具名稱。
practice:
- id: cr-search-01-p1
  kind: hands-on
  minutes: 9
  title: 拆三份職缺並選一個練習
  steps:
  - 在 C:\dev\conduit-lab 新建 job-samples.md。
  - 挑三份看得到正文的不同職缺，記頁面識別、觀測日、職責、基本、加分、待確認。
  - 用一條職責寫「輸入→輸出→驗收」。
  checks:
  - 同一轉貼未重複計；未看到截止日就標未知。
  - 能從原文指認哪一句支持你的分類。
---

## 你讀的是工作，還是一串工具？

一份公告同時寫 SQL、Spark、數據建模，這不代表要先補完三門才可投。職缺取樣（job sampling）是挑一組能回到正文的職缺來觀察；編碼（coding）在這裡是把句子歸類，不是寫程式。先限定市場與職級，例如台灣初階、香港畢業生或中國大陸校招，不把主管位和實習混成一個門檻。再用職稱、刊登者、地點和職缺編號辨識，同編號跨站轉貼只算一次。

每一列留下原頁與觀測日，分成「職責：進去要交付」「基本條件：公告說要有」「加分：有會更好」「待確認：沒寫清楚」。觀測日不是刊登日。有投遞按鈕不等於今天一定能送出；不要為了做樣本填表。把交付物寫到能驗收，例如「每天將兩份訂單檔整合成一張表，比對來源與報表筆數」。之後〈[橋接職務](#/lesson/cr-search-02)〉會用交付物挑入口。

## 三種寫法，三種處置

- 下方大陸零售校招樣本：數倉分層與建模是工作，SQL 與 Java 或 Python 擇一寫在要求，熟悉指定引擎另有優先措辭。別把「擇一」編成兩樣都必備。
- 台灣製造業樣本：把「訪談需求、設計數據模型、整合來源」讀成工作，練習可縮成一張每日表，附上口徑與核對方式；不把一份公司的工具棧外推成全職種。
- 新加坡初階樣本：同時寫批次與串流管道、數據驗證及技術年資。初階是職稱，不是免年資的承諾。應把年資照實標在基本條件裡，而非從職稱反推。

上述是公開樣本，詳見專案 `research/market-report.md` 的分組說明，逐則核對可查 `research/job-evidence.csv`。研究頁和工作地不一樣：用職缺正文的地點，不用搜尋頁的地區。市場樣本也不代表你的入門清單；比較時分開工作地與交付物，再從符合自己投遞條件的幾份中找交集。下週若換了市場，保留前一批，別無聲混入分母。

### 從原句到練習題

練習先用虛構句子：「每週更新門店訂單表；會 SQL；做過排程者優先；工作地點面談。」你可以拆出每週交付一份報表、基本能力是寫查詢、排程經驗是加分、地點尚不確定。若已掌握查詢，下一步不是讀完整排程框架，而是做一個星期的固定輸入並驗證相同一天不會算兩次。對方若沒有說能否接受這種證據，只標「可展示」，不要替對方判定你已滿足要求。把原句旁留一欄證據位置，下次即使同類工作換了措辭，也能檢查你的判讀是否一致。

## 常見錯誤

- 把 3 個轉貼算成 3 份 → 重複高估 → 用刊登者與職缺編號去重。
- 把「優先」標為硬條件 → 混淆措辭 → 把原句縮寫成可回查的證據。
- 把取樣結果當全市場趨勢 → 取樣有地域與可見度偏差 → 只描述觀察到的範圍。
