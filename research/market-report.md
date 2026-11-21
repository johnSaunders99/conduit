# 數據開發的第一份工作：先交一張對得起帳的表

**研究截止：2026-11-20。** 82 則可辨識的職缺中，69 則提 SQL、57 則提 Python、54 則明說質量或核對。這些數字支持先教「把一個問題寫成查詢，再證明結果正確」，不支持「先集齊所有引擎」。[零售校招](https://www.nowcoder.com/jobs/detail/465189)把 SQL、分層、業務口徑與 AI 同時寫進職責；[台灣一份 AI／數據職缺](https://tw.linkedin.com/jobs/view/ai%EF%BC%8F%E8%B3%87%E6%96%99%E5%B7%A5%E7%A8%8B%E5%B8%AB%EF%BD%9Cai-data-engineer-at-peqaboo-4470973351)甚至明說自主作品也可，重點是能解釋個人貢獻、失敗與驗證。作品不是錄用保證，但能把「學過」變成面試官能追問的證據。

## 樣本怎麼來，數字怎麼讀

用中英職稱加城市、職級、產業和技術詞目的抽樣，時間窗為 2025-06-01 至觀測日。納入的是一個可辨識職位、一個公開詳情頁、有相關職責，以及可落入窗口的證據。時間證據優先用原頁投遞區間或職缺結構化刊登日期；其次用職缺標頭相對日期；最後才用觀測時有完整描述與申請入口。入口不是已測試能投；取樣當日不等於刊登日，沒有把搜尋引擎索引日、招聘者在線時間或相似職缺的日期當證據。已截止但在窗內開過的也保留。多地同一頁算一次；同僱主跨屆、不同實習／社招編號可各算一則，不當成不同僱主。

中國大陸 49（校招 27、實習 9、社招 12、企業培育計畫 1）；香港 12、台灣 9、新加坡 4、美國 7、跨國遠端 1。僱主為直接招聘或實際刊登的服務／招聘商，未知客戶不猜名稱。例：[財務集市外包](https://www.zhaopin.com/jobdetail/CC000544460J40826265116.htm)不等於受聘於銀行。[一份標「Anywhere」的美國職缺](https://job-boards.greenhouse.io/baublebar/jobs/8303479)在內文限制居住地及工作授權，故計美國；[Kit](https://jobs.ashbyhq.com/kit/cecc518c-2f11-433f-9f75-e9960330ccb9)才列跨國遠端，仍需配合美東工作時段。這不是全市場普查：大陸偏向公開校招，香港偏金融，新加坡刻意找串流，美國刻意找分析工程，不能拿兩地百分比差異推論總職缺量、薪資或年度成長率。

原始索引見 [jobs.csv](jobs.csv)，逐則查核見 [job-evidence.csv](job-evidence.csv)，所有標籤、分母與百分比見 [skill-frequency.csv](skill-frequency.csv)。職稱保留來源識別用語；技能統一小寫，同一職缺同一技能最多計一次。下表每格是 **職責／基本條件則數 + 僅加分則數**，破折號代表樣本未見，並非市場無需求。「Java／Python 至少一門」兩者都記為可滿足條件的選項，不能倒讀成兩者必會。具名技術只當作工作棧時也不等於入職前必須精通。只說建模不自動推成維度建模，只說數據庫不補 SQL；網站導覽、培訓後才教的工具與相關職缺不計。職責與資格衝突時，以欄位外的逐則備註補足語境。

來源限制：[BOSS 直聘](https://www.zhipin.com/)首頁可見，但點「數據開發」後進入安全驗證，沒有使用該頁的列表片段。中國大陸改用牛客招聘正文、智聯及僱主公開刊登頁。海外面經以公開候選人自述和僱主指南互證，不用一畝三分地的付費或積分解鎖內容；面經不加入職缺分母。

### 依工作地：分母是職缺，不是技能總數

| 技能 | 中國大陸（49） | 香港（12） | 台灣（9） | 新加坡（4） | 美國（7） | 跨國遠端（1） |
|---|---:|---:|---:|---:|---:|---:|
| sql | 36 + 1 | 11 + 0 | 9 + 0 | 4 + 0 | 7 + 0 | 1 + 0 |
| python | 31 + 1 | 9 + 1 | 6 + 1 | 3 + 0 | 3 + 2 | — |
| java | 28 + 3 | 1 + 0 | 1 + 0 | 3 + 0 | — | — |
| scala | 6 + 1 | 1 + 0 | — | 2 + 0 | 3 + 0 | — |
| warehouse | 34 + 0 | 6 + 1 | 1 + 0 | 1 + 0 | 5 + 0 | 1 + 0 |
| data-modeling | 28 + 0 | 7 + 0 | 4 + 0 | 1 + 0 | 7 + 0 | 1 + 0 |
| data-quality | 30 + 0 | 8 + 0 | 7 + 0 | 2 + 0 | 6 + 0 | 1 + 0 |
| etl | 30 + 0 | 11 + 0 | 5 + 0 | 1 + 0 | 3 + 2 | — |
| hive | 23 + 7 | 1 + 0 | — | — | 1 + 0 | — |
| spark | 30 + 5 | 4 + 0 | 1 + 2 | 3 + 1 | 2 + 1 | — |
| flink | 25 + 6 | 1 + 0 | 0 + 1 | 4 + 0 | — | — |
| kafka | 8 + 2 | 2 + 1 | 0 + 2 | 2 + 1 | — | — |
| airflow | 2 + 2 | 1 + 0 | 1 + 2 | 0 + 2 | 1 + 0 | — |
| dolphinscheduler | 1 + 2 | — | — | — | — | — |
| dbt | 0 + 1 | — | — | 1 + 0 | 4 + 0 | 1 + 0 |
| azure | 1 + 0 | 5 + 2 | 0 + 1 | — | — | — |
| aws | 1 + 0 | 0 + 2 | 2 + 1 | 1 + 0 | 1 + 1 | — |
| gcp | — | 0 + 2 | 1 + 0 | 1 + 0 | 1 + 1 | — |
| aliyun | 2 + 0 | 1 + 0 | — | — | — | — |
| databricks | 1 + 0 | 4 + 0 | 1 + 1 | — | 0 + 1 | — |
| snowflake | — | 2 + 0 | — | — | 2 + 1 | — |
| iceberg | 6 + 2 | — | — | — | — | — |
| paimon | 4 + 2 | — | — | — | — | — |
| ai | 16 + 4 | 2 + 0 | 3 + 0 | 1 + 0 | 2 + 0 | 1 + 0 |
| rag | 5 + 1 | — | 2 + 0 | 1 + 0 | — | — |

### 依主要交付物：職稱相同也可能是不同工作

每則只歸一類：每日可信模型與集市歸離線數倉；時效、事件與流處理是核心交付歸實時；為多條鏈路提供系統或底座歸平台；以雲端倉庫與整合運維為主歸雲端；以指標模型及下游分析產品為主歸分析工程。只因職缺列出 Flink 不把整份工作歸實時。跨職能的歸類是作者判讀，不是僱主正式部門。

| 技能 | 離線數倉（31） | 實時數據（6） | 數據平台（23） | 雲端與現代數據棧（14） | 分析工程（8） |
|---|---:|---:|---:|---:|---:|
| sql | 27 + 1 | 6 + 0 | 14 + 0 | 13 + 0 | 8 + 0 |
| python | 18 + 2 | 6 + 0 | 14 + 1 | 11 + 0 | 3 + 2 |
| java | 16 + 2 | 3 + 0 | 11 + 1 | 2 + 0 | 1 + 0 |
| scala | 4 + 0 | 1 + 0 | 3 + 1 | 3 + 0 | 1 + 0 |
| dimensional-modeling | 11 + 0 | — | — | 1 + 1 | 3 + 0 |
| data-modeling | 24 + 0 | — | 6 + 0 | 10 + 0 | 8 + 0 |
| etl | 24 + 0 | 2 + 0 | 9 + 0 | 12 + 1 | 3 + 1 |
| data-quality | 19 + 0 | 3 + 0 | 15 + 0 | 9 + 0 | 8 + 0 |
| hive | 19 + 3 | 1 + 1 | 4 + 3 | 1 + 0 | — |
| spark | 18 + 3 | 3 + 2 | 11 + 3 | 7 + 1 | 1 + 0 |
| flink | 16 + 3 | 3 + 1 | 10 + 3 | 1 + 0 | — |
| kafka | 3 + 1 | 3 + 1 | 6 + 2 | 0 + 2 | — |
| streaming | 16 + 0 | 6 + 0 | 7 + 1 | 5 + 0 | — |
| orchestration | 6 + 1 | 1 + 0 | 6 + 3 | 6 + 0 | 2 + 0 |
| dbt | 0 + 1 | — | — | 1 + 0 | 5 + 0 |
| snowflake | — | — | — | 2 + 0 | 2 + 1 |
| databricks | 0 + 1 | — | — | 6 + 0 | 0 + 1 |
| iceberg | 2 + 1 | — | 4 + 1 | — | — |
| paimon | 2 + 1 | — | 2 + 1 | — | — |
| hudi | 1 + 1 | — | 3 + 1 | — | — |
| delta | — | — | 1 + 0 | 1 + 0 | — |
| doris | 2 + 2 | 0 + 1 | 2 + 1 | — | — |
| starrocks | 1 + 2 | 0 + 1 | 0 + 1 | — | — |
| clickhouse | 0 + 1 | 1 + 2 | 1 + 2 | — | — |
| ai | 8 + 2 | 1 + 0 | 9 + 2 | 3 + 0 | 4 + 0 |
| rag | 2 + 1 | 1 + 0 | 4 + 0 | 1 + 0 | — |

**面向職缺的優先級。** 離線先練 SQL、粒度、分層與驗算，再補 Spark/Hive 的數據搬移和效能；湖倉格式只有在職責真的涉及時才深入。實時樣本 6 則全提 SQL 和 Python；先交付可重播、可核對的時間窗口，再談狀態引擎。平台偏向程式、分散式執行與維運，底層引擎職與做 ETL 報表不是同一個入場門檻。[引擎校招](https://www.nowcoder.com/jobs/detail/410905)和[初階 ETL](https://www.zhaopin.com/jobdetail/CC466908380J40866797212.htm)正好展示差別。雲端先掌握整合、成本及批次恢復，其次學目標市場指定的雲。8 則分析工程均提建模及質量；5 則提 dbt，但[實際要用 Dataform 的一則](https://job-boards.greenhouse.io/supplyhouse/jobs/6199457004?gh_jid=6199457004)接受同類經驗。精通品牌清單不是共同底線。

產品按交付內容區分職務。產品將雲端與分析工程收在同一上手目標，仍在研究分開看；其餘三種工作各一張目標卡。[role-weights.csv](role-weights.csv)把每項技能的來源族群、標籤聯集、分母與權重公開。權重 3 表示超過半數職位的職責／條件提及該技能群，2 表示至少五分之一，1 是較少見的補強。小樣本的「3」不是市場保證；同類多個標籤命中仍在該職缺只計一次。

## 第一份工作與面試：各市場有什麼可交付？

- **中國大陸。** 在校者優先看職缺指明的畢業窗口、每週到班、實習月數；已畢業轉職者優先看初級 ETL、數倉開發、數據集成與有帶教的外包交付。[經驗不限的數據開發](https://www.zhaopin.com/jobdetail/CCL1520625040J40858908201.htm)要求能獨立寫簡單腳本，[1–3 年的另一份](https://cn.linkedin.com/jobs/view/%E6%95%B0%E6%8D%AE%E5%BC%80%E5%8F%91%E5%B7%A5%E7%A8%8B%E5%B8%88-j10160-at-shunda-group-4478964724)卻要牽頭從零建倉。判斷第一份工作，讀誰負責出事與誰審查，比只看「初級」準。面試可按「SQL 手寫 → 建模／專案 → 引擎原理與演算法」練習，但不假設所有公司同輪次。[數開候選人的一面與二面](https://www.nowcoder.com/feed/main/detail/a26b8971c9f943918860c405ce355714)包含留存、連續登入、Spark 連接、Kafka 消費與 checkpoint，並追問實習中如何建模與對接；[2022 年的實習回顧](https://www.nowcoder.com/discuss/388707339937873920)把首次登入、列式儲存及維度建模連到真實項目。準備用 5 列解釋粒度，再拿長尾任務分布解釋 Shuffle、數據傾斜和小檔；區間合併、雜湊、排序也要能白板完成。不是背一篇不丟不重的定義。
- **香港。** 金融、零售整合與顧問交付中，SQL／Python、來源核對和能向業務解釋差異，比湊齊所有中介軟體更有用。[歡迎畢業生的投資系統職](https://hk.linkedin.com/jobs/view/junior-data-engineer-fresh-grad-will-be-considered-at-vms-group-4389868568)要求第三方來源、測試及對帳；[資產管理數據平台主管職](https://hk.linkedin.com/jobs/view/lead-data-engineer-%E2%80%93-data-products-gwam-asia-at-manulife-4489566493)是主管級，把它當發展方向而不是第一份工作。橋接入口包括 ETL 支援、BI 開發、顧問培育；[培育計畫](https://hk.linkedin.com/jobs/view/data-engineering-graduate-programme-jan-2027-start-date-at-fdm-group-4463232697)仍要求入職前懂 Python／SQL，不是從開機開始教。兩則本地自述分別有[線上測驗後多輪 SQL／Python](https://www.jointaro.com/interviews/companies/qube-research-and-technologies/experiences/data-engineer-hong-kong-april-30-2026-no-offer-neutral-eaefd18c/)與[HR 後線上技術題](https://www.jointaro.com/interviews/companies/cryptocom/experiences/data-engineer-hong-kong-china-march-12-2026-no-offer-positive-e371bb58/)。預備用英文說明來源、異常、處理與客戶影響；金融領域知識是部分職位的篩選條件，不是一律必須金融學位。
- **台灣。** 同時查「資料工程師」「數據工程師」「Data Engineer」。金融和製造可從資料整合、BI／ETL 或企業數倉進入。[製造業 EDW](https://tw.linkedin.com/jobs/view/%E7%AB%B9%E5%8C%97-data-engineer-at-winbond-4472532306)需要訪談業務、規劃事實與維度、建立對帳及血緣；[金融資料工程](https://tw.linkedin.com/jobs/view/%E8%B3%87%E6%96%99%E5%B7%A5%E7%A8%8B%E5%B8%AB-at-president-securities-corp-4473085115)的 AI-ready 底座仍需可靠管道。面試不只考題庫：一則[台灣物流電商面試自述](https://www.goodjob.life/experiences/67b2f9bf4605c54fdf81769a)記錄了溝通經驗、SQL、小包裹遺失率情境及 pandas 等實作。自述發文時間不等於實際面試年；它用來挑練習題型，不當 2026 錄用率。準備講清「遺失率」的分子、分母、事件切點。
- **新加坡。** 本次 4 則不能代表全國。大數據或交易流職要能解釋事件時間、積壓和重播；[標初階的平台職](https://sg.linkedin.com/jobs/view/junior-data-engineer-20261042355-at-beyondsoft-singapore-4489458919)仍列技術經驗，[銀行職](https://sg.linkedin.com/jobs/view/data-engineer-at-ocbc-4490308410)是較有經驗的對照。先投具備適用工作資格的 graduate／associate 或整合工程位，別把資深引擎崗當第一關。[新加坡串流團隊候選人自述](https://www.jointaro.com/interviews/companies/tiktok/experiences/data-engineer-singapore-june-11-2024-declined-offer-positive-9790f8db/)記錄現場窗口 SQL、Spark 與多輪中英問答；這是較早的個案，不是現行統一流程。
- **美國與遠端。** 在學者看[Data Engineer 實習](https://amazon.jobs/en/jobs/10553907/data-engineer-internship-2027-us)的在學地、畢業窗口及工時；其他人找[Data Engineer I](https://www.amazon.jobs/en/jobs/10513820/data-engineer-i-fire-tv)、BI Engineer、具名的初中階分析工程。[Amazon 校園官方指引](https://atoz.amazon/en-us/jobs/hiring-process/interview-prep/university/data)區分實習的一輪兩場與正職兩輪，技術與行為都考；[2025 美國候選人自述](https://www.jointaro.com/interviews/companies/amazon/experiences/data-engineer-united-states-july-30-2025-no-offer-positive-b7d8aa95/)有 SQL、Python、數據模型與 schema。練習題應走「澄清業務 → 建模 → 寫轉換 → 設計增量、監控與恢復 → 解釋個人決策」。單一跨國遠端樣本是資深職，不足以宣稱遠端是新人捷徑；另查時區、雇用地與工作授權。

## 轉入這行靠什麼，不靠什麼？

**分析轉開發：** 先把一個每週手改的報表拆成原始、明細、可測試指標，再證明補一天不會把整月加兩次。分析者已懂分母與使用者，短板是工程化與交接。[轉職實務路線](https://www.startdataengineering.com/post/data-analyst-to-data-engineer/)同樣從一張有人使用的表談價值。**後端轉開發：** 保留測試、日誌、API 與復原的優勢，補 SQL 粒度、歷史版本與批流時間。已有軟體經驗並修完課的[公開轉職討論](https://www.reddit.com/r/developersIndia/comments/160ov4g/has_anyone_transitioned_from_software_engineer_to/)仍在問如何證明能做這份工作；不是成功率證據。**校招與訓練營：** 前者有身分與時點門檻，後者是有截止日的作品練習。[Zoomcamp 課綱](https://github.com/DataTalksClub/data-engineering-zoomcamp)約 9 週，但[官方先備說明](https://datatalksclub.github.io/docs/courses/data-engineering-zoomcamp/prerequisites/)假設基礎 Python、SQL 和命令列；不能照抄成零基礎到錄用的時間。

作品不必大。最有力的最小交付是：虛構固定輸入、粒度與口徑、可重跑指令、能推翻錯解的反例、一次故障前後的對帳，最後才是畫面。數倉職交付退款跨日及慢變維度；實時職交付遲到和重送；分析工程職交付模型依賴、測試與文件；平台職交付延遲診斷與復原。能在 5 分鐘內從一筆原始事件追到輸出，比只有雲證照、照抄 DAG、沒有原始數據的效能百分比或用單機偽稱大規模生產更有辨識度。正式數據不能公開時，用虛構同構反例展示決策，不要交公司截圖。

## 2026 的變化與不變

[上海銀行的招募](https://www.nowcoder.com/jobs/detail/469641?urlSource=sitemap)已寫到以大模型探索產碼、質檢與問數；[滴滴](https://www.nowcoder.com/jobs/detail/469861?urlSource=sitemap)把 AI 輔助 SQL 和檢查寫進工作；[製造業校招](https://jobs.smartrecruiters.com/BoschGroup/744000159324718-ai-bci?trid=7d1dcdfa-96a8-4e55-bb9c-0db211f5a9b3)則直接需要能評估檢索品質與成本。另一端，[分析工程職](https://job-boards.greenhouse.io/sidecarhealth/jobs/6221930004?gh_src=Drive+Capital+job+board)要求審查 AI 生成的 SQL，說明責任並沒有交給工具。這裡是 82 則中的 29 則提及 AI、9 則提及 RAG，不是「AI 取代了某比例的崗位」，也沒有去年同口徑基準可證明增速。教學先教獨立算例、驗算、權限與刪除傳播，再談自動產碼。

湖倉和串流也要從業務需求來看：[近實時數倉職缺](https://www.nowcoder.com/jobs/detail/463572)明提 Flink／Paimon；[Uber 的系統演進](https://www.uber.com/us/en/blog/from-batch-to-streaming-accelerating-data-freshness-in-ubers-data-lake/)是為了讓湖內數據更快可用，而不是因為批次已經過時。[美團指標平台實例](https://tech.meituan.com/2026/03/20/Busniness-Intelligence-practice-in-meituan.html)說明規模變大時，明細和統一口徑仍是服務分析的底座。面試仍可從「一單幾列、失敗後重跑會怎樣、同價要不要算兩次」問到引擎原理。本課不把工程博客中的公司規模複製成學員設備要求。

## 從零到可以開始投遞

以下是課程設計估算，不是受訪者平均或錄用承諾。按每週 6 個學習日估算，1 小時／日為每週 6 小時，2 小時／日為每週 12 小時。時數包含未提示重做、專案與模擬；投遞後等回覆的日曆時間另計。

| 驗收門檻 | 從零累計投入 | 1 小時／日 | 2 小時／日 |
|---|---:|---:|---:|
| 能辨認粒度、寫 JOIN／窗口、交付第一條小管道，無提示核對重送；可開始試投符合資格的實習、初級 ETL、BI 整合 | 95–140 小時 | 約 16–24 週 | 約 8–12 週 |
| 獨立交付一個目標崗作品，有測試、日誌與失敗復原；盲寫同類變式並說清分母。可集中投遞初階正職 | 180–270 小時 | 約 30–45 週 | 約 15–23 週 |
| 若目標是實時或平台，再交付狀態恢復／效能診斷並答辯兩種方案，非所有第一份工作都需要 | 260–380 小時 | 約 44–64 週 | 約 22–32 週 |

推導：實習門檻取 fd-lab、sq-pattern、cr-search 與全部先修，共 16 個模組、約 59 小時課內，第一個作品 10 小時，另留約 26–71 小時獨立重做、修錯與口述。離線正職取 bd-quality、bd-spark、sq-audit、cr-search、fd-lab 與全部先修，共 28 個模組、約 106 小時，數倉作品 24 小時，剩餘用來練第二種輸入、限時 SQL 與投遞材料。v2 全部 363 堂是 181 小時 55 分課內；7 個作品另計 124 小時，**不必全部做完才投**。v2 的 Java 支線服務明列 JVM 作業的職缺，不納入上述共同或離線試投先修。若每週只學 4 天、英文文件需逐句讀、或設備不能跑容器，預期週數要增加。已有基礎的人先用空白編輯器及小反例通關再略過，不扣掉沒有真正掌握的時數。
