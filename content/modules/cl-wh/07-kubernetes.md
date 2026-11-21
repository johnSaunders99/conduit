---
id: cl-wh-07
module: cl-wh
order: 7
title: Kubernetes 讀圖
subtitle: 只辨認作業與資源限制
status: ready
minutes: 35
level: 3
prereqs:
- cl-wh-06
objectives: ["從 Job 規格找出 Pod 範本與容器","分開解釋記憶體 request、limit 和 OOMKilled","交付一張含重試與輸出驗收的故障判讀卡"]
tags: ["Kubernetes","Job","記憶體限制","OOMKilled"]
resources:
  - title: "Kubernetes：Job"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/job/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "讀 Pod 範本、失敗重試及完成條件。"
  - title: "Kubernetes：容器資源管理"
    url: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: "看記憶體請求、限制與超額處理。"
concepts:
  - id: cl-wh-07-job
    prompt: "一個 Job、Pod、容器的關係在本例是什麼？"
    answer: "Job 依範本建立並追蹤 Pod；Pod 裡的容器執行程式。"
    mcq:
      options:
        - "每個容器都會建立一個獨立叢集。"
        - "Job 依範本建立並追蹤 Pod；Pod 裡的容器執行程式。"
        - "Pod 是持久數據表，Job 是表內的一列。"
        - "Job 的 manifest 只決定雲端費率。"
      answer: 1
      explain: "先找到控制作業的 Job，再找到真正執行的 Pod 和容器。"
  - id: cl-wh-07-memory
    prompt: "記憶體 request 256Mi、limit 384Mi，分別代表什麼？"
    answer: "排入節點時依請求量分配；限制是容器可用量的上限。"
    mcq:
      options:
        - "兩值都是記憶體用量的即時觀測值。"
        - "request 是硬上限，limit 只是介面的提示。"
        - "排入節點時依請求量分配；限制是容器可用量的上限。"
        - "每個 Job 總共可執行 384 秒。"
      answer: 2
      explain: "排程看請求，執行時限制由系統施行；任一值都不是目前用量。"
  - id: cl-wh-07-retry
    prompt: "Job 因記憶體不足而失敗，先做什麼？"
    answer: "查容器終止原因、峰值與輸入範圍，再決定縮小切片或調整資源。"
    mcq:
      options:
        - "查容器終止原因、峰值與輸入範圍，再決定縮小切片或調整資源。"
        - "先無限重試，不看輸出。"
        - "立即把限制刪掉。"
        - "只要加 request，容器的 limit 就會自動提高。"
      answer: 0
      explain: "重複同一超額工作可能繼續失敗，並留下不完整或重複輸出。"
    interview:
      question: "Job 顯示完成，你如何確認訂單日報可用？"
      points:
        - "分開作業完成與數據驗收"
        - "核對鍵、列數與日期"
        - "避免重試留下部分或重複輸出"
      answer: "我會看 Job 與對應 Pod 狀態，但還要核對日報的日期、列數和唯一鍵。重試時先寫暫存，驗好再發布；成功狀態不能當作業務內容已驗收。"
practice:
  - id: cl-wh-07-p1
    title: "製作一張批次作業讀圖卡"
    kind: hands-on
    minutes: 13
    steps:
      - "存成 orders-job.yaml，在紙上標出 Job、Pod 範本、容器與記憶體設定。"
      - "假設容器記錄峰值 450 MiB 並出現 OOMKilled，寫出兩個調查方向。"
      - "為重試寫下輸出隔離和最終列數檢查。"
    checks:
      - "能指出 450 MiB 高於 384 MiB，而不是只和 256 MiB 比。"
      - "分開寫執行成功與報表驗收；沒有連叢集或嘗試部署。"
---

## 成本安全：只讀規格，不建立叢集

本堂不執行 `kubectl`、不連叢集、不拉映像。只看本機檔，沒有容器記憶體需求。日後若做真實試驗，先查節點、磁碟與公有服務是否計費，限定資源和重試，再按清冊確認無殘留；試用計畫不一定免除所有相依服務的費用。這次要讀一張訂單批次的工作規格，找半夜為何一直失敗。

Kubernetes 是協調容器部署與工作的系統。Job（一次性作業）追蹤工作是否完成，按 Pod 範本（Pod template）建立 Pod；Pod 是一起被排到同一個節點的一組容器，本例只有一個容器（container）。有些失敗會由 Job 重建 Pod，實際達到重試上限還要看 Job 與 Pod 的狀態。若不熟映像檔與容器的差別，可先讀[〈映像與容器〉](#/lesson/fd-docker-01)：映像檔描述程式如何封裝，容器才是執行中的個體。

## 從外往內讀規格

在 `C:\dev\conduit-lab\warehouse` 把下方規格存成 `orders-job.yaml`，本堂不提交。這份規格使用一般 Python 映像及只印字的命令，沒有真正讀訂單。

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: orders-day-check
spec:
  backoffLimit: 1
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: orders
          image: python:3-slim
          command: ["python", "-c", "print('order example')"]
          resources:
            requests:
              memory: "256Mi"
            limits:
              memory: "384Mi"
```

外層 `spec` 規定 Job 行為，`template.spec` 決定 Pod 怎麼跑。`restartPolicy: Never` 不在原 Pod 重啟該容器；失敗時由 Job 按 `backoffLimit` 和狀態處理。`requests.memory` 是排程用的請求量，`limits.memory` 是執行時由系統施行的記憶體限制；`Mi` 約定以 2 的冪表示 MiB，不是 MB。若業務容器企圖用 450 MiB，可能因記憶體超限被終止（OOMKilled）。這個範例沒有實際吃掉那麼多；遇到 OOMKilled 仍應查終止狀態及是否為節點的整體記憶體壓力，不只看一張宣告。

## 把成功的意思寫在規格之外

畫出 Job → Pod → 容器，並註明「容器成功離開」與「已發布並驗收正確業務日的日報」是兩件事。重試前先查輸入是否意外擴成整月，或程式是否把全量讀進記憶體。縮小切片後，輸出應能在重跑時覆蓋或替換同一日期，不能多寫一份。這樣即使容器被重建，發布也不必靠人手猜哪份是真的。

### 重試先確認輸出留在哪裡

第 1 次已寫完一半，才因記憶體不足離開。若新 Pod 從頭再追加，報表一半被算兩次。理想安排是寫到每次嘗試的暫存位置，只有完整且已對帳的那次能更新正式日報。Pod 內未掛外部持久儲存的暫存也不能當成永久結果；若要留查錯輸出，另選核准位置，讓證據和日報各有保留期。上線時用固定並驗過的映像版本；本堂的映像標籤只是供讀圖。

判讀時也記是哪一次嘗試，以及容器真的用了多少。調大限制與改成分批讀會改不同事情；一次只調一個，才知道哪個措施能防止再發。

## 常見錯誤

- Pod 有空位卻排不進 → 看的是申請資源而不是瞬間用量 → 核對 request 與可分配容量。
- 把 request 當作超額終止線 → 混淆請求與限制 → 檢查 limit 和終止原因。
- Job 顯示完成便發布 → 沒驗品質 → 另驗列數、日期和唯一鍵。
