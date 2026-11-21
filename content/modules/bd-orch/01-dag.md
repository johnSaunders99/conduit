---
id: bd-orch-01
module: bd-orch
order: 1
title: DAG 與依賴
subtitle: 先有訂單才能算日報
status: ready
minutes: 30
level: 2
prereqs: []
objectives:
- 按產物畫出日報任務依賴
- 驗證未知上游與循環
- 區分任務定義與單次工作流執行
tags:
- DAG
- 依賴
- 拓撲排序
- 排程
resources:
- title: Airflow：DAG
  url: https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看任務依賴與同一張圖的多次執行。
- title: Python：graphlib
  url: https://docs.python.org/3/library/graphlib.html
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀 TopologicalSorter 與 CycleError。
concepts:
- prompt: 有向邊指向什麼？
  answer: 從上游任務指向它要先完成才可放行的下游任務；一條業務依賴通常有相應產物或驗收條件。
  mcq:
    question: 日報必須等訂單和退款都到齊，應該怎麼畫？
    answer: 1
    options:
    - 日報指向訂單和退款
    - 訂單和退款各指向日報
    - 訂單指向退款再指向日報
    - 三個節點都不相連
    explain: 兩路可獨立完成，日報本身等待兩個結果；把它們串成一線會製造不必要的等待。
  id: bd-orch-01-edge
- prompt: 為什麼有向圖有循環就不能按依賴開始這一圈？
  answer: 圈中每個任務都在等另一個尚未完成的任務，沒有可先放行的起點。
  mcq:
    question: 哪種規則在同一輪會卡住？
    answer: 2
    options:
    - 兩張表等同一份日曆
    - 同一任務等兩張表
    - 檢查等發布、發布又等檢查
    - 兩張表各自執行
    explain: 兩個任務互等才成圈；共享上游、共同等待與獨立並行都可以。
  id: bd-orch-01-cycle
- prompt: DAG 定義和 DAG run 有何不同？
  answer: 定義說明任務與依賴；每個 run 帶自己的數據區間、狀態與日誌。
  interview:
    question: 三個上游任務有一個失敗，要不要讓日報先跑？
    answer: 先看交付契約。如果三個都是必需輸入，我會阻止日報發布，告警要指明缺哪份產物，而不是用空表補過。若某個是可選，明定缺失時的狀態與下游行為，不能只調觸發規則讓圖變綠。
    points:
    - 依產物定義必需與可選
    - 阻擋錯誤發布
    - 告警能指回缺的輸入
  id: bd-orch-01-instance
practice:
- kind: hands-on
  title: 捕捉兩種畫圖錯誤
  minutes: 8
  steps:
  - 在工作區執行 check_dag.py，將正常拓撲次序存成筆記。
  - 先把 orders 改成不存在的 orderz，記下程式如何報錯；還原。
  - 再令 orders 等待 publish，記下循環並畫出閉環。
  checks:
  - 正常時 orders 與 refunds 都排在 reconcile 之前，publish 在最後。
  - 拼錯和形成閉環分別得到 missing upstream 和 cycle。
  id: bd-orch-01-p1
---

## 早到的訂單，不必等退款才開始處理

日報要同時拿到訂單與退款才可對帳，但兩份輸入可以並行。**有向無環圖（directed acyclic graph，DAG）**把工作表示為一組節點和有方向的連線：每個節點是一項任務，箭頭從上游指向下游，「上游完成並符合條件，才放行下游」。無環是指沿箭頭走不能回到原點。不要把有先後畫成所有任務都要排隊，也不要把一定要先拿到的結果交給碰運氣。

![訂單與退款各指向對帳，對帳通過後指向發布](assets/bd-orch-dependencies.svg)

圖上的順序只描述一輪中的依賴。每天可以用同一份圖建立新的工作流執行（DAG run），各有自己的輸入範圍、任務實例（task instance）和狀態。昨天的 `orders` 成功不代表今天的 `orders` 到齊。若真的要讀昨天的產物，應把跨日條件明寫成「哪一天、哪個產物」；不要把昨天和今天畫成同一輪互相等待。

## 像排程器一樣先驗圖

拓撲排序（topological sort）列出一個讓前置排在後續之前的合法次序；合法答案可能不只一個。這裡用 Python 驗證定義，不是啟動排程器。於 `C:\dev\conduit-lab\orch-lab` 存成 `check_dag.py`，執行 `py check_dag.py`。預留 1 GB，無容器。

```python
from graphlib import CycleError, TopologicalSorter

needs = {"orders": (), "refunds": (),
         "reconcile": ("orders", "refunds"), "publish": ("reconcile",)}
missing = sorted({parent for parents in needs.values() for parent in parents} - needs.keys())
if missing:
    raise SystemExit(f"missing upstream: {missing}")
try:
    print(" -> ".join(TopologicalSorter(needs).static_order()))
except CycleError as error:
    raise SystemExit(f"cycle: {error.args[1]}")
```

這裡的字典方向是「任務列出前置」，與畫箭頭時的表示方法相反，因此建立圖時要核對工具介面。程式額外檢查未知節點；否則容許隱式新增節點的函式會把拼字錯誤當成新任務。真正執行時不必按這個列印順序串行，只要各自的依賴滿足就可並行，仍然要受資源上限約束。

## 把一個可選輸入畫正確

假設營運要加一欄備註，但備註來源不一定每天送。若你把它和金額明細一起當成必要前置，只是少備註也會擋住全部報表；若完全不畫依賴，備註可能永遠讀到昨天。比較清楚的畫法是先定義必要產物，再為可選數據寫清截止後的規則。例如日報可在未收到備註時按規格留空並加狀態，但缺退款不能發布。上游任務有個狀態是排程證據；數據是否是本期、是否通過驗收，要在任務或交付控制另外確認。

還可以用圖做估時。訂單需 3 分鐘、退款需 7 分鐘，兩路同時開始，對帳就最早在第 7 分鐘後才能做。對帳還要 2 分鐘、發布要 1 分鐘，整趟至少 10 分鐘；單把訂單從 3 分鐘縮到 1 分鐘不會縮短這趟。這就是先找制約鏈、再談加資源的理由。

## 常見錯誤

- **第一步永遠不會啟動 →** 兩項任務互等；選出真正先可用的產物，重新畫邊。
- **一支工作沒跑卻合法 →** 前置名稱拼錯或隱式加入；儲存前檢查所有上游必須存在。
- **訂單完成卻同步發布錯帳 →** 日報少等了退款或驗收；按產物而不按習慣排依賴。

**重點回顧：**圖用來決定何時可以開始，不用來替代數據是否可交付的判斷。
