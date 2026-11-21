---
id: cr-search-03
module: cr-search
order: 3
title: 校招與實習資格
subtitle: 先確認畢業窗口與到職日
status: ready
minutes: 25
level: 1
prereqs:
- cr-search-02
objectives:
- 按正文寫下畢業資格、每週工時與最早到職
- 把符合、待確認及不符合分欄
- 對未知門檻寫一個不含個資的確認問題
tags:
- 校招
- 實習
- 畢業窗口
- 到職
resources:
- title: 大陸零售數據開發校招樣本
  url: https://www.nowcoder.com/jobs/detail/465189
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀屆別與申請區間，辨別兩種日期。
- title: 大陸保險數據開發校招樣本
  url: https://www.nowcoder.com/jobs/detail/467165
  kind: article
  lang: zh-Hans
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 比對另一份校招的畢業要求及優先項。
- title: 香港數據工程培育計畫樣本
  url: https://hk.linkedin.com/jobs/view/data-engineering-graduate-programme-jan-2027-start-date-at-fdm-group-4463232697
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 核對計畫名稱中的到職月份。
- title: 美國數據工程實習樣本
  url: https://amazon.jobs/en/jobs/10553907/data-engineer-internship-2027-us
  kind: article
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 查實習後仍在學的條件及工作安排。
concepts:
- id: cr-search-03-window
  prompt: 投遞區間尚未結束，就代表畢業條件符合嗎？
  answer: 不代表；一個是何時可申請，一個是申請者資格。
  mcq:
    question: 公告接受 2027 屆；申請頁仍開；已於 2025 畢業，該怎麼記？
    options:
    - 依正文判定屆別不符
    - 有按鈕所以符合
    - 有作品即可取代屆別
    - 按本月日期重新定義屆別
    answer: 0
    explain: 申請入口不會改變明列的資格；其他渠道可另查。
- id: cr-search-03-unknown
  prompt: 公告未說每週可否只到場 3 天，如何處理？
  answer: 標待確認，問最低工時、到場天數與是否可配合課表，別猜可行。
  mcq:
    question: 不知道每週到場要求時，哪個動作最好？
    options:
    - 默認全遠端
    - 寫成不符合
    - 記待確認並到官方渠道核對
    - 把「實習」當成可隨時到場
    answer: 2
    explain: 未寫不代表允許或禁止；它是需要核對的條件。
- id: cr-search-03-parallel
  prompt: 若校招屆別不符，要把學習和投遞都停下嗎？
  answer: 不用；保留真實經歷，改查可接受的社招或其他初階職務。
practice:
- id: cr-search-03-p1
  kind: hands-on
  minutes: 9
  title: 做一頁資格檢查單
  steps:
  - 在 C:\dev\conduit-lab 建 eligibility.md，用虛構的畢業月份及每週可到班數對照兩份公告。
  - 為一個待確認欄寫一個精確問題，不填個資、不送出。
  checks:
  - 畢業日期、投遞截止、到職日沒有混在一欄。
  - 確定不符和未刊出區分清楚。
---

## 先確認自己能不能進入這輪

校園招聘（campus recruitment，簡稱校招）常用畢業屆別界定對象；社會招聘（experienced or open hiring，簡稱社招）是另一套渠道，未必每份都要求同樣年資。不要用自己的月份猜「應屆」的範圍，更不要把同公司不同編號的條件合在一起。畢業窗口（graduation window）說的是何時畢業可以申請；投遞窗口說的是何時收件；到職窗口則說你何時要開始。三種日期分欄記。

用一個虛構決策：假設自己是 2027 屆，只能每週到場 3 天，2027 年年底才可開始。下方大陸零售與保險校招樣本都寫了 2027 屆，這只說暫時符合其中一欄，還要核對其他資格與到職安排。香港培育樣本標明 2027 年 1 月開始，即使同屆也要核對該月份能否到職。美國實習樣本把實習結束後仍須至少留有一個學期或學季、及工作安排另寫；不能只讀職稱中的年份。這些是單一公告的條件，不是通則；今天能讀到的文本也不保證入口仍在收件。

## 把不確定拆開處理

在檢查單為每列留「原文、符合／待確認／不符合、下一步」。還沒看到每週工時、到場天數、最短期間、工作地或工作授權要求，就標待確認。可以把問題寫到對方容易回答：「這個編號的實習每週最低到場天數是多少？可否在指定月份開始？」去雇主刊登頁或正式招聘渠道確認，不必把個人證明、帳號或文件先放在練習檔。

已畢業且屆別不符時，記下明確缺口，並平行找可接受背景的初級 ETL 或整合社招。只有一個模糊欄位時，可以先準備符合方向的證據，同時求證。香港、新加坡、台灣以至遠端僱主，即使寫畢業生或可在家，也要各自核對工作地與實際雇用條件；不要拿另一市場的標籤套用。地域與時區個案見 `research/market-report.md`；不要從個案推論個人身分或工作授權。

### 別讓相似詞替你做決定

「全職實習」可能要求整段期間的完整工作日；「畢業生培育」也可能要求指定日期一次到職。以必要條件為準，不只看名稱。假如你能符合畢業窗口但時間還不確定，先標為待確認；若工時明列且確實不能配合，就不該在材料裡暗示可以開始。將一份符合的職缺和一份要確認的分清楚，練習成果仍可兩邊復用。把核對日寫在每張檢查單上，下一週遇到新版公告才不會忘記重看。

## 常見錯誤

- 有投遞入口就想當作可投 → 把申請期間和資格混在一起 → 各自標記。
- 先說自己時間彈性再看限制 → 可能承諾做不到的到職日 → 以真的可用天數核對。
- 擅自把待確認欄改成符合 → 資訊仍缺 → 留明確問題與日期。
