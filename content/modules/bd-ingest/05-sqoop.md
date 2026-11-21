---
id: bd-ingest-05
module: bd-ingest
order: 5
title: Sqoop 舊鏈路
subtitle: 讀懂舊任務而非新裝叢集
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-04
objectives:
- 從舊 Sqoop 作業辨識來源、目的與增量方式
- 區分 append 與 lastmodified，指出各自不能證明的事
- 寫出遷移時要比對的具體驗收條件
tags:
- Sqoop
- 遷移
- MapReduce
- 增量匯入
resources:
- title: Apache Attic：Sqoop
  url: https://attic.apache.org/projects/sqoop.html
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 確認已退休的專案狀態。
- title: Sqoop 1.4.7 使用指南
  url: https://sqoop.apache.org/docs/1.4.7/SqoopUserGuide.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 查 incremental、check-column 與 last-value。
concepts:
- prompt: append 和 lastmodified 分別假設什麼？
  answer: append 依遞增欄位讀新列；lastmodified 以最後修改時間讀變動過的列，仍不代表目的端自然合併。
  mcq:
    question: 一張既有單取消，但訂單編號不變，哪個判斷正確？
    answer: 1
    options:
    - append 會按編號查回所有舊單
    - 要查修改時間或讀變更日誌
    - 有 target-dir 就會更新舊單
    - 加大 mapper 就能返回舊單
    explain: 依遞增編號的 append 抓不到改舊單；修改時間有更新才可能捕捉取消，硬刪仍不可見。
  id: bd-ingest-05-mode
- prompt: 舊工作上的 num-mappers 與 split-by 在描述什麼？
  answer: 前者是並行映射任務數，後者是匯入時用於劃分讀取範圍的欄位（多任務時）；都不是數據版本。
  mcq:
    question: split-by 指定 order_id，是否等於記住讀到哪張單？
    answer: 3
    options:
    - 是，分片值就是已提交位置
    - 是，只要 mapper 大於 1
    - 是，只要欄位存在
    - 否，它只是拆分讀取範圍
    explain: 拆工作與保存進度是兩件事；前者不會決定已驗收的增量邊界。
  id: bd-ingest-05-parallel
- prompt: 切換舊鏈路之前要先確認什麼？
  answer: 先保存任務範圍、現有水位、欄位及輸出契約，用同切點平行跑做對帳。
  interview:
    question: 把 Sqoop 搬去 DataX 或 SeaTunnel 時，怎麼證明沒換掉業務語義？
    answer: 先把舊設定還原成讀取條件、水位、鍵、分隔格式及空值規則；用相同切點雙跑，對到日與業務鍵，另外覆蓋同秒更新、重跑及取消的反例。新結果通過後再切讀取路徑，保留上一版及其水位以便恢復。
    points:
    - 把旗標解讀成數據語義
    - 同切點雙跑與反例
    - 保留恢復位置
  id: bd-ingest-05-migration
practice:
- kind: hands-on
  title: 交付一張舊鏈路遷移卡
  minutes: 8
  steps:
  - 在工作區建立 sqoop-migration.md，抄下正文的設定片段並標註來源、目的、游標和併發。
  - 寫出以修改時間捕捉取消與以 CDC 捕捉硬刪的兩條做法，選一條符合題意的方案。
  - 列出同一切點雙跑的 3 條對帳規則與回切條件。
  checks:
  - 能說清 order_id 不變會漏掉更新，且增加 mapper 無效。
  - 驗收含日別筆數、按鍵差集，以及至少一個取消單或刪除反例。
  id: bd-ingest-05-p1
---

## 維護舊鏈路，先把旗標讀成業務規則

某份日報每天凌晨從訂單數據庫匯入 Hadoop。你接到的不是採購新技術，而是回答「舊工作把哪一批數據送去哪裡？」Apache Sqoop 是在關聯數據庫和 Hadoop 生態之間搬批次數據的舊工具，專案已退休，不建議當新鏈路的起點。MapReduce 是把工作拆成並行處理再彙整的運算模型；Sqoop 匯入時可用多個映射任務（mapper）各讀一段範圍。源端負擔也會隨並行增加，舊機器能扛住的併發不一定是新環境的合理值。

## 讀懂一張舊任務單

以下是原創的維護單摘要，不是要貼到終端的指令，也不需要連線。假設來源是 `orders`，目的端是 HDFS（Hadoop 的分散式檔案系統）下的 `/warehouse/raw/orders`：

- `--table orders` 選來源表；`--target-dir` 指向輸出目錄，不等於數據表或提交保證。
- `--num-mappers 4 --split-by order_id` 表示規劃 4 個讀取任務，以訂單鍵拆讀取範圍。分得是否均勻仍要量。
- `--incremental append --check-column order_id --last-value 1003` 讀水位以上的新編號；從 1004 往後補，不會因 1002 後來取消而重新取回 1002。
- `--incremental lastmodified` 改用會隨更新變動的欄位，例如 `updated_at`；請另外查目的端怎麼覆蓋、合併，以及相同時間值如何重跑，不能只看來源選法。

## 遷移不是翻譯指令

如果舊鏈路只要不可變的新增記錄，新的批次同步讀端可以沿用同一高水位。若營運需要取消狀態改回舊單，先確定來源一定更新修改時間、能接受回看窗口，再讓目的端按鍵和版本更新。若還要求硬刪及完整順序，應用 CDC，把刪除也當事件處理；之後在[〈CDC 與日誌位置〉](#/lesson/bd-ingest-06)會示範。

你的產物是一張遷移卡，不啟動叢集，本機文字編輯預留 1 GB。雙跑要比較的是**同切點、同範圍**：日別筆數、業務鍵差集、欄位型別與 NULL 表示，還要拿一張改過狀態的舊單抽驗。通過後才改下游讀取位置，保留前一個好版本及停止舊作業時的切點；回切後從哪邊接增量也要寫在卡上。

## 先用兩張單測你的遷移選擇

假設水位 1003，今天看到 1004 新增與 1002 取消。若你寫下「依舊編號讀大於 1003」，只有新增能到達；如果遷移要求兩筆都到，那就不是原樣搬運，而是改了同步契約。讓舊流程與新流程同時產出候選版時，先約定判準究竟是「符合舊流程」還是「符合新的業務規則」，不同才不會被誤當成故障。對新增和取消應分別列預期鍵、狀態和處理時點。

在交接筆記補上：如果取消晚一天才抵達，要對帳昨天的產物還是今天的變更批次？答案取決於用途。狀態更新可按變更批讀，報表卻應回到該營業日改寫；共用一個今天的日期往往會跨錯層。

## 常見錯誤

- **表看起來搬完卻少已取消舊單 →** 來自 append 的天然限制；改讀修改時間或來源日誌。
- **筆數相同但欄位錯位 →** 新舊分隔與 NULL 編碼不同；固定格式並對照含特殊字元的樣本。
- **切回舊路徑後多跑一批 →** 未記住各自最後驗收位置；先記切點，再做切換或回切。

**重點回顧：**從遺留旗標取回的是範圍、格式與恢復點，不是必須照搬的系統。
