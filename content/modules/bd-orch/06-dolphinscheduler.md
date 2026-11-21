---
id: bd-orch-06
module: bd-orch
order: 6
title: DolphinScheduler
subtitle: 把同一依賴改畫成工作流
status: ready
minutes: 30
level: 2
prereqs:
- bd-orch-05
objectives:
- 啟動單機 DolphinScheduler 並畫出兩個 Shell 節點
- 透過失敗與恢復觀察工作流實例的狀態
- 比較圖形化工作流與程式化 DAG 的交付證據
tags:
- DolphinScheduler
- standalone
- Shell 任務
- 工作流實例
resources:
- title: DolphinScheduler：Standalone
  url: https://github.com/apache/dolphinscheduler/blob/3.4.3/docs/docs/en/guide/installation/standalone.md
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 查單機模式、Java 及本機登入。
- title: DolphinScheduler：Shell 任務
  url: https://github.com/apache/dolphinscheduler/blob/3.4.3/docs/docs/en/guide/task/shell.md
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 Shell 任務的建立、參數及執行身份。
- title: DolphinScheduler：官方 standalone 映像
  url: https://hub.docker.com/r/apache/dolphinscheduler-standalone-server/tags
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 核對 3.4.3 標籤與支援架構。
concepts:
- prompt: 畫在畫布上的工作流，與工作流實例的差別？
  answer: 定義有節點、邊及參數；手動或排程啟動會生成獨立實例與任務日誌。
  mcq:
    question: 改了圖的定義，是否代表昨天已完成的結果會自動更新？
    answer: 2
    options:
    - 會，儲存自動改歷史
    - 只要工作流上線就會
    - 不會，歷史結果要明確重跑
    - 只有改名稱才會
    explain: 既有結果仍屬原執行，需按原業務日與新版本安排受控回填。
  id: bd-orch-06-visual
- prompt: 為何 Shell 任務在本機終端能跑，不保證在 worker 能跑？
  answer: 命令在 worker 的容器及執行身份下運作，路徑、工具和權限不一定與主機相同。
  mcq:
    question: 腳本讀 C:\\dev 路徑失敗，先檢查什麼？
    answer: 0
    options:
    - 執行者看到的掛載與權限
    - 增加重試次數
    - 移除節點依賴
    - 提高調度頻率
    explain: 容器內使用 Linux 路徑及掛載。重試和加併發不會讓主機路徑變可用。
  id: bd-orch-06-worker
- prompt: 圖形操作和程式化編排怎麼比較？
  answer: 圖便於查看依賴與處理補數，程式便於審查及測試；兩者仍需版本、參數、日誌和驗收證據。
  interview:
    question: 團隊既有 DolphinScheduler，什麼時候有理由改用 Airflow？
    answer: 我會先看現有運維、任務插件和審查流程，不因個人偏好遷移。若工作流需要大量共用 Python 邏輯與自動測試，Airflow 可能比較合適。先用一條有重試與回填的工作流比移轉成本、值班可觀察性和可恢復性。
    points:
    - 先從既有團隊與插件出發
    - 比較可審查性與可維護性
    - 小規模驗證遷移，不靠偏好
  id: bd-orch-06-compare
practice:
- kind: hands-on
  title: 用圖和日誌證明失敗會擋住下游
  minutes: 15
  steps:
  - 依正文章節建立 order_check → publish_note，手動執行一次並保存圖。
  - 把第一個 Shell 任務暫改為 exit 1，重試次數設 0，再跑並保留結束狀態。
  - 還原原腳本，再跑一次確認 publish_note 只在前置成功後產生日誌。停止前把證據與腳本留在工作區。
  checks:
  - 成功實例按順序記錄 checked order=1001 rows=1 和 ready for publication。
  - 失敗實例沒有成功執行 publish_note，修復後的新實例兩步均成功。
  id: bd-orch-06-p1
---

## 把同樣的邊畫到另一個排程器

DolphinScheduler 是圖形化的工作流排程器，能在畫布建立任務、設定依賴和追蹤實例。本機的 standalone 把協調、執行、API 等角色放到同一個程序；正式部署才考量把角色分開、外部數據庫與高可用。畫面上線的是工作流定義，不是運行成功的證據。都要保留營業日、輸入版本與執行日誌，這點與 Airflow 相同。

## 只啟動官方 standalone

關掉上一堂的 Airflow。給 Docker Engine 預留 5 GB，本課只啟動 1 個容器，記憶體上限 4 GiB。第一次下載需要數 GB 磁碟空間。本課固定官方 3.4.3 單機映像，內附 Java，Windows 不另裝；若改從發行二進位直接啟動，該版 standalone 文件列 JDK 8 或 11。只綁本機端口，不把教學環境或預設登入公開。

在 `C:\dev\conduit-lab\dolphin-lab` 建立 `compose.yaml`：

```yaml
services:
  dolphin:
    image: apache/dolphinscheduler-standalone-server:3.4.3
    mem_limit: 4g
    ports:
      - "127.0.0.1:12345:12345"
```

在該資料夾的 PowerShell 視窗執行：

```powershell
docker compose -p conduit-dolphin up -d
docker compose -p conduit-dolphin ps
docker compose -p conduit-dolphin logs --tail 40 dolphin
```

啟動後在瀏覽器開啟 `127.0.0.1:12345/dolphinscheduler/ui`。登入方法見資源的「Login DolphinScheduler」。預設教學模式會用內嵌的 H2；不要把它當持久的正式排程庫，停止前先把圖與日誌留下。

## 用兩個 Shell 節點驗證依賴

在專案管理新建練習專案，進入工作流定義、建立工作流。以 `order_check` 和 `publish_note` 為兩個 Shell 節點，把箭頭從前者拉到後者，使用預設的成功依賴。若介面要求指定租戶（tenant），先到安全中心的租戶管理建立練習用租戶，代碼填 standalone 容器中實際執行的 Linux 身份，再於工作流選取。不要輸入 Windows 帳號，也不要修改主機權限。需要查目前容器的執行身份時，在同一資料夾執行 `docker compose -p conduit-dolphin exec dolphin id -un`。本例只在日誌列印，不讀寫容器外的檔案。

把下面第一段放入 `order_check` 的腳本欄位：

```bash
printf '%s\n' 'checked order=1001 rows=1'
```

把第二段放入 `publish_note` 的腳本欄位：

```bash
printf '%s\n' 'ready for publication'
```

儲存、上線工作流，再手動執行。查看實例與節點日誌，然後按練習讓前置失敗一次；後續應不成功執行。實務腳本還需要可明確傳入營業日，且不可把成功訊息當成內容已核對。停止前留下練習腳本與可辨識的圖；在同一資料夾執行：

```powershell
docker compose -p conduit-dolphin stop
```

## 兩個工具拿同一組問題比較

在 Airflow，依賴寫在 Python 並隨程式審查；在這次 DolphinScheduler 練習，讀者能直接比對畫布上的邊和實例的時序。兩者都不能省掉流程版本、營業日、輸入位置、成功條件。如果下一位值班者只拿到一張圖，還是不知道失敗發生在哪一次執行，紀錄便缺少任務實例與日誌。

可再想一個退款晚到的案例：退款不是失敗，而是尚無輸入。若把它當作前置成功，發布節點照樣執行；真正該做的是明訂完成條件、最大等待時間與超時後的通知。審查流程也要包含這類行為，不只要求兩個方框畫得一樣。

## 常見錯誤

- **儲存圖後找不到可執行按鈕 →** 工作流仍離線；上線該練習定義後再手動執行。
- **Shell 突然找不到檔案 →** 把 Windows 路徑交給容器；先核對 worker 的掛載與身份。
- **綠色工作流被當成正式日報已交付 →** 節點只列印訊息；還需檢查數據及讀端。

**重點回顧：**排法可以畫也可以寫，必須用實例證明依賴、失敗與恢復符合預期。
