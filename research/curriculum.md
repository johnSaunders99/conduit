# 從第一張小票到第一份數據工程作品

一名新人不用先懂叢集，也能發現日報錯了：收到 3 張小票，其中一張是重送，當日應算 2 筆交易，還是 3 筆事件？這裡同時有來源、粒度、轉換和驗收。渠成把它放在第一天，把「在哪臺機器上跑」放到問題大到需要它的那天。學員最後應能從一筆輸入追到一個指標，說明出錯會看到什麼、該從哪一步重跑。

## 為什麼不是按工具名稱排課

[市場研究](market-report.md)的 82 則職缺中，SQL 69 則、Python 57 則、數據質量 54 則。這不是說其他職缺不需要它們，而是三件事都有跨市場的直接證據。[Data Engineer Roadmap](https://roadmap.sh/data-engineer)適合查漏，不是新人第一週的待辦清單。[Zoomcamp](https://github.com/DataTalksClub/data-engineering-zoomcamp)示範一條從攝取、轉換到專案的完整路；[其先備要求](https://datatalksclub.github.io/docs/courses/data-engineering-zoomcamp/prerequisites/)也說明為何不能用同一門課的日曆時間推算零基礎者。[《Fundamentals of Data Engineering》公開目錄](https://www.oreilly.com/library/view/fundamentals-of-data/9781098108298/)將生成、儲存、攝取、轉換與供應放進同一生命週期，安全、治理與運維則橫跨各步。這裡採用的是這個檢查問題的方式，不要求買書。

課程選擇是：**先 SQL，看得見的結果；再 Python，把相同步驟可靠地重做；最後才是需要多個服務的工具。** 在瀏覽器的 DuckDB-WASM 工作區，先預覽 `shop.products`（指 shop 數據集的 products 表），執行 SELECT，再加條件。這時不必先裝 Python、設定 PATH、登入雲端或下載伺服器。按推薦順序，首個 100 分鐘模組結束就可進 SQL；即使每天只有半小時也能在第一週開始。Python 是第一門通用語言，負責讀 CSV／JSON、受控重試、測試及之後的 PySpark；不拿它取代 SQL 的集合思維。

## 可走的圖：推薦順序不是一條鎖鏈

[推薦順序](../content/path.yaml)把 49 個模組排成面向新人的路線。[各模組](../content/modules/)的 `prereqs` 才是硬先備；列表相鄰不表示前一個一定是後一個的依賴。例：`sq-model` 只依賴 `sq-join`，懂連接的人可先學建模；`bd-flink` 則確實同時需要 `bd-kafka` 與 `sq-window`。下面的箭頭只畫關鍵路段，不假裝取代完整依賴圖。

- **共同基礎｜99 堂。** `fd-start` → `fd-desk` → `fd-python` → `fd-data` → `fd-io` → `fd-tools`。一開始用紙筆走完三格日報，第二堂用圖看[數據開發工程師的工作](../content/modules/fd-start/02-data-engineer.md)，之後才學終端、引號與檔案。用 Git 保存可回退的版本；腳本交付 `fd-lab` 要先會測試、JOIN 與 Git。Linux、行程／記憶體／網路、Docker 另成階梯，不能因容器裝不起來就阻止練習 SQL。做過開發的人拿新輸入測一次、解釋錯誤並能還原，再標記已會。推薦順序在第一個大數據模組前排入 Java；職缺不要求時，不需用它延後投遞。
- **SQL 與數據建模｜102 堂。** `sq-read → sq-expr → sq-group → sq-join → sq-compose → sq-window → sq-pattern`。先分辨列與欄，才有能力判斷 JOIN 是少了訂單還是放大金額；固定輸出粒度後，再用窗口保留明細。另一路從 JOIN 進 `sq-model`，與窗口路徑在 `sq-metrics` 會合，最後以 `sq-audit` 查到第一個不一致的鍵。關聯式數據庫與交易等到能啟動本機服務再教；不把 MySQL、Hive 與 DuckDB 的方言差異當成學員的錯。
- **大數據與管道｜94 堂。** `bd-distrib` 先用熱門鍵拖慢最後一個任務，才拆 HDFS、Shuffle、Hive 檔案與 Spark 執行計畫。採集 → 排程 → 質量是另一條主幹：拿同一天重跑兩次，驗收輸出不多不少。實時線由 Kafka 位移進到 Flink 事件時間／狀態／checkpoint，再比較查詢引擎與 Lambda／Kappa。湖倉線由 Spark、採集匯入快照與 CDC 重播；不把會背 4 個表格式當作做過遷移。
- **雲端與現代數據棧｜31 堂。** 成本、權限與物件鍵 → 雲端數倉及 ETL／ELT → dbt 模型與測試 → 來源契約及交付。用相同的增量訂單比較掃描量，不要求每家服務都開帳戶。AWS／阿里雲、BigQuery／Snowflake／Redshift 與 Databricks 課教對照和選擇，不是四套付費安裝教學。AI 支線只在懂質量後問：原文刪除，向量和快取要怎麼一起失效？
- **求職實戰｜37 堂，分次進入。** `cr-search` 在看到第一批聚合結果、會保存作品時就讀真職缺；`cr-sql` 在窗口題之後限時手寫；`cr-code` 在程式測試與演算法之後盲寫。作品要在 `cr-portfolio` 補上可重做的說明。最後按職缺選建模／管道設計、引擎機制、行為與技術英文，不是把整條求職線延到畢業才打開。

階段 0（29 堂）交第一張查詢與第一個小程式；階段 1（103 堂）把查詢、腳本和測試連起來；階段 2（144 堂）建立有粒度、歷史和對帳的批次作品；階段 3（71 堂）為目標市場加一條專精；階段 4（16 堂）以設計與事故答辯收束。這些是**全課的課數，不是所有人開始投遞的硬門檻**。363 堂合計 181 小時 55 分，只含標示的上課時間，沒有把做作品與重練偷偷算進去。

## 練習何時變成面試能力

1. **把查詢說清楚。** 初週先用 `shop`：投影、篩選、固定排序、NULL；同價商品故意保留，好讓「只按價格排」的錯解有反例。進到 `sq-pattern` 才要求空白編輯器寫 Top N、連續登入、留存、漏斗、行列轉換、同時在線、中位數、拉鏈去重、會話切分。以 `logins` 同日多登例區分「活躍日」與「登入次數」，用 `events` 的到達時間與事件時間測遲到，再用 `hr` 核對半開區間。口述時先交分母與反例，才交 SQL。
2. **從數據結構移到管道故障。** `fd-data` 的字典累計訂單是雜湊；`fd-algo` 改成記憶體有限時找 Top K、用圖找依賴循環；`cr-code` 拿陌生輸入限時完成、補測試並說明複雜度。SQL 窗口與滑動窗口的輸出看似相近，後者要自己管理狀態，不能只背術語。大陸校招若職缺寫明演算法筆試，優先完成這段；不把刷滿固定題數設成投遞門檻。
3. **讓面試官能追問。** 同一聲明交三樣東西：預期輸出、能推翻錯解的最小輸入、失敗後的恢復證據。問「Kafka 會不會重複」，先指出本案例的消費位移與下游寫入邊界；問「為什麼今天慢了」，先拿掃描量／任務耗時／積壓定位。面試題庫的 points 是評分依據，不要逐字朗誦參考答案。[大陸面經](https://www.nowcoder.com/discuss/388707339937873920)與[海外校招面試說明](https://atoz.amazon/en-us/jobs/hiring-process/interview-prep/university/data)支援把口述、程式、設計、個人貢獻分開練。

## 根據第一份工作選一個作品，而非集齊技術

四張[職務卡](../content/roles.yaml)對應研究中的五個交付族群。雲端整合與分析工程共用一張入口，但兩者在[逐項技能表](role-weights.csv)及[市場報告](market-report.md)仍可區分。先做 [第一條訂單管道](../content/projects/proj-receipts.yaml)：寫明輸入契約、批次標記、重跑及對帳。達到窗口題、首件作品與口述門檻即可試投符合資格的實習或橋接職，而非等到完成 Flink。

| 想拿什麼交付去面試 | 深入的模組與作品 | 學員要給出的證據 |
|---|---|---|
| 離線數倉：一套可對帳的日報 | sq-model、sq-metrics、bd-ingest、bd-orch、bd-quality；茶舖離線數倉 | 說清退款算哪一天；只補該日，總額不翻倍；展示差集，而不只展示總筆數 |
| 實時數據：能恢復的交易統計 | bd-kafka、bd-flink、bd-serve；實時茶舖交易看板 | 插入晚到與重送，記錄窗口修正、位移、輸出與恢復前後差異 |
| 數據平台：能替別人定位偏差 | bd-spark、bd-bench；若需 Java，另修 fd-java、bd-jvm；質量守門員或批流時效決策書 | 交付可重現故障，說明健康訊號、長尾任務與試過但沒用的方法 |
| 雲端／分析工程：能交接的模型 | cl-cloud、cl-wh、cl-dbt、cl-contract；dbt 指標集市 | 本機驗收增量與全量一致，展示依賴圖、欄位契約、模型文件與成本上限 |

實習試投的學習估算是 95–140 小時；按每週 6 天、每天 1／2 小時約為 16–24／8–12 週。集中投初階正職以獨立交付一個對口作品為準，估 180–270 小時；實時或平台專精再往上。這是有明確練習內容的規劃區間，不是薪資或 offer 保證；見[時數如何拆分](market-report.md)。海外遠端尤其要先確認居住限制與職級，校招則先確認畢業區間。

## 語言、設備與刻意不教的事

中國大陸樣本 49 則中，37 則提 SQL、32 則提 Python、31 則提 Java、7 則提 Scala；全部 82 則中有 36 則提 Java、13 則提 Scala。技術棧提及不等於指定必備，但對以中國大陸平台、串流或 JVM 作業為目標的人，只看懂集合、JVM 和多執行緒不夠。

- **共同課還是 Python。** 先用熟悉的訂單輸入練解析、去重及測試；SQL、PySpark 與 Flink SQL 不以 Java 為起跑條件。
- **需要 Java 時，做完 fd-java 的 12 堂。** 先在 Windows 用目前 LTS 的 JDK 從終端編譯、執行，再開 VS Code。用相同的訂單重寫類型、集合與錯誤處理，再用 Maven、JUnit 5 做出可測、可交付的 JAR。執行緒池用關閉與積壓案例驗收，GC 用日誌區分停頓、峰值和可能的記憶體洩漏。不教完整後端框架。已有基礎的學員可在交出測試和乾淨目錄啟動的證據後跳過。
- **bd-jvm 緊接 bd-flink，是實作支線。** 5 堂共 2 小時 20 分：寫、打包並在本機註冊 Java Hive UDF；用固定事件跑 Java Flink DataStream 和測試；最後把一段 Spark Scala 程式讀成已知的 PySpark 轉換。先對照各引擎支援的 JDK，不能把較新的基礎課 JDK 當成部署版本。Hive 與 Flink 分開實作，不要求學員跑 Flink 的 Hive 連接器，也不預設把 Java／Scala 都學到能開發引擎。
- **作品和面試依職缺加練。** [實時看板](../content/projects/proj-stream.yaml)可選 Java DataStream、PyFlink DataStream 或 Flink SQL，仍用同一套重播、遲到與批次對帳驗收。[Java 題庫](../content/interview/iv-java-basics.yaml)新增 10 題；先用實驗說明 HashMap、`volatile`／`synchronized`、執行緒池和 OOM，再背名詞。

不交一套完整 Kubernetes 管理、MapReduce 叢集維運、正式生產容量保證；Kubernetes 學讀圖與資源單位，Sqoop 學辨認舊鏈路與遷移風險。湖倉格式各有專課，但只要求在一種格式完成重播。完整深度學習、訓練模型、付費雲部署不是數據工程入行條件。Windows 一律從普通使用者和本機工作資料夾開始；初級作品預留 1 GB、數倉分時 4 GB、CDC 6 GB、串流服務合計預算 7 GB。這是作業配置上限／設計預算，不是本次測出的效能或整臺電腦的最低記憶體。容量不足先做不開容器的作品，不能把紙上設計說成已跑通。

寫安裝課時再查兼容性，不能拿教材機器的 Python 版本當標準。本批核對的官方入口：[Windows Python 與安裝管理器](https://www.python.org/downloads/windows/)、[Java LTS 支援表](https://www.oracle.com/java/technologies/java-se-support-roadmap.html)、[Spark](https://spark.apache.org/downloads.html)、[Flink](https://flink.apache.org/downloads/)、[Kafka](https://kafka.apache.org/community/downloads/)。各自最新不保證彼此兼容；實作批次才固定相容組合並在學員路徑驗收。

## 內容交接

目前完成開場模組 4 堂及 SQL 首 4 堂，共 10 道可執行 SQL 題。其餘 355 堂有目標與已核對的閱讀入口，但沒有正文、概念卡或練習；規劃器不應把它們派給學員。「第一份工作路線」是完成內容後的設計，不是說今天已有 363 堂可上。[102 筆對應](reuse-map.csv)保留原有 98 筆，另有 4 筆 Java 轉寫參照：只借分支、去重、錯誤隔離與測試的例子，Java 語法與驗收重新寫；不複製原課，也不挪用舊 SQL 線。下一批先沿 sq-read 的後 5 堂接 sq-expr，再補 fd-desk／fd-python；原有 Windows 步驟可借鑑，但每個例子都要在新情境驗收、換成渠成路徑與術語。之後每一堂 ready SQL 都要連到可執行的題目與知識點；不能用預告題湊數。

SQL 以 App 實際使用的 DuckDB-WASM 1.30.0（DuckDB 1.3.2）為準，驗收指令是 `npm.cmd run check:content`。`docs/stable` 是閱讀入口，可能指向較新的版本；不能只憑文件存在就用新語法。舊的原生 2.0.0 腳本結果保留作歷史紀錄，不作兼容性判定。

