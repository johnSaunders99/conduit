---
id: cr-design-04
module: cr-design
order: 4
title: 一致性與故障
subtitle: 寫成功但沒記位移怎麼辦
status: ready
minutes: 25
level: 4
prereqs:
  - cr-design-03
objectives:
  - 畫出兩種提交順序各自故障時會漏數或重播的位置
  - 區分可重讀的舊看板與尚未核對的發布
  - 用淨消化率算出積壓追平時間
tags:
  - 位移
  - 冪等
  - 故障範圍
  - 積壓
resources:
  - title: Apache Kafka：交付語義
    url: https://kafka.apache.org/44/design/design/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Message Delivery Semantics 的外部系統限制。
  - title: Google SRE：過載處理
    url: https://sre.google/sre-book/handling-overload/
    kind: book
    lang: en
    minutes: 7
    required: false
    checked: 2026-11-20
    note: 對照恢復時不能無限重試的理由。
concepts:
  - id: cr-design-04-writefirst
    prompt: 先寫退款，再提交下一個位移，兩者間故障會怎樣？
    answer: 重啟可能重讀同筆；寫端若以穩定的事件鍵冪等套用，就不會多扣。
    mcq:
      options:
        - 必定漏掉該筆
        - 可能重讀，需要寫端防重
        - Kafka 會替外部表自動回退
        - 所有分區位移都歸零
      answer: 1
      explain: 外部寫入成功並不自動改變消費者組的提交進度。
    interview:
      question: 寫成功但沒有記位移，你如何解釋看板此時的狀態？
      points:
        - 先劃出仍可用與不可承諾
        - 插入寫入與位移間故障
        - 恢復後核對及限速
      answer: 我會讓讀者看到最後對帳版並標出切點，不會宣布已追平。重啟會重讀，目的端用同事件鍵防止多扣；限速追積壓，看到與來源鍵和金額都一致才重新發布。
  - id: cr-design-04-offsetfirst
    prompt: 若先提交下一個位移而後寫入，兩者間故障會怎樣？
    answer: 重啟從已提交進度續讀，可能跳過尚未寫入的退款。
    mcq:
      options:
        - 會因下一次查詢而自動補回
        - 只會增加一次重複
        - 會跳過尚未寫入的事件
        - 表一定完全不變且不漏
      answer: 2
      explain: 已提交的位置指向下次從哪裡讀，不是外部寫入成功的證據。
  - id: cr-design-04-drain
    prompt: 積壓 1200 筆，每分鐘新增 200 筆，下游最多接 500 筆，要多久追平？
    answer: 4 分鐘，前提是速率持續且處理成本相當。
    mcq:
      options:
        - 2.4 分鐘
        - 4 分鐘
        - 6 分鐘
        - 無法追平
      answer: 1
      explain: 每分鐘只有 300 筆的淨消化能力。
practice:
  - id: cr-design-04-p1
    kind: code
    title: 寫一張看板降級交班單
    minutes: 10
    steps:
      - 執行 drain.py，將每分鐘積壓與可服務範圍寫進 C:\dev\conduit-lab\interview\outage.md。
      - 把處理速率降到 200，再補如何停止公布最新數字。
    checks:
      - 恢復後第 4 分鐘追平；處理 200 時 4 分鐘後仍欠 1200 筆。
      - 交班單明訂穩定事件鍵、沒有提前確認位移，以及恢復發布前需要對帳。
---

## 外部表已更新，進度還沒記：哪個承諾仍能成立？

退款事件已寫進數據庫，消費者在提交位移（offset）前退出。按照[〈位移與提交〉](#/lesson/bd-kafka-05)，重啟由消費者組已提交的下一個位置續讀，因此可能再讀同一筆。若表做的是「金額再扣 50」，第二次會多扣；若把退款事件鍵唯一寫進同一交易，已存在時不再加計，才是冪等（idempotent）。反向先記位移再寫，故障會跳過未完成的寫入。兩種次序的差別，要畫在故障時點，而不是用一句「有重試」帶過。

較簡單的設計是先完成具冪等性的寫入，再提交每個分區的已連續處理進度。若目的端能將處理位置和業務變更同時放進自己的原子交易，重啟也可由該進度恢復；但不能聲稱 Kafka 自動替外部數據庫提交。若單純回報寫端逾時，結果也可能已生效，先以同一鍵核對或重試，不編造新鍵。

## 降級提示與追平是兩個驗收點

故障範圍（blast radius）以使用者看到的能力來表示：已對帳版本仍能查，標出數據時間及未追平；今日未核對部分不拿去對外關帳。恢復後看來源與目的端差異、最老待處理事件的年齡及失敗類型。不要為了清空隊列一下把所有事件打到剛恢復的寫端。

在 `C:\dev\conduit-lab\interview` 存 `drain.py`；PowerShell 執行 `py drain.py`，WSL 2 用 `python3 drain.py`（可用 RAM 0.25 GB）。示例有 1200 筆積壓，每分鐘新入 200、可處理 500。

```python
backlog, incoming, capacity = 1200, 200, 500
for minute in range(1, 5):
    backlog = max(0, backlog + incoming - capacity)
    print(minute, backlog)
```

依序得到 900、600、300、0。若處理量降至 200，不會追平。即使數字歸零，也要確認不是未成功事件被搬到隔離區；最後用退款鍵和金額對帳，再發布正常狀態。香港交易來源整合的初階樣本 4389868568（`research/job-evidence.csv`）明列測試與查核；可練一段英文交班，把來源、顧客看到的版本及恢復判準各用一句話說清。

## 在一個分區上親手指出下一個位置

假設最後已提交的位置是 81，表示下一個要讀 81；外部表剛寫了位移 81 的退款，程式還沒把 82 提交。先在紙上找重啟點：仍從 81 開始，外部交易看見同業務鍵不應再扣。如果讀了 82 卻還沒完成 81，不可以先確認 83，否則恢復會跨過未完成的空缺。這也解釋了為什麼不同分區的進度不能混用單一數字。若面試官要你保證所有接收者都不重，而你只控制其中一張表，就先說明保證終點，再提出測試，不擅自把它延伸到所有下游輸出。

重試異常可另留失敗鍵和原因，交班時不把它們從等待清單默默移除。

## 常見錯誤
- 看板正常開啟就說數據沒漏 → 查詢可用不等於已追平 → 標最後驗證切點。
- 先記位移再寫 → 故障有缺口 → 先提交具冪等性的成果，再確認進度。
- 用最大吞吐估恢復 → 忽略新流量 → 以淨消化量計算。
