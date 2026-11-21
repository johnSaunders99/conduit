---
id: cr-internals-04
module: cr-internals
order: 4
title: Flink 恢復與背壓
subtitle: 從位置與狀態還原一批輸出
status: ready
minutes: 25
level: 4
prereqs:
  - cr-internals-03
objectives:
  - 畫出 Flink 檢查點如何綁定來源位置與算子狀態
  - 用背壓方向及寫端指標區分堵塞和恢復
tags:
  - Flink
  - 檢查點
  - 屏障
  - 背壓
  - 精確一次
resources:
  - title: Apache Flink：有狀態流處理
    url: https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Barriers、State 與 Recovery 的關係。
  - title: Apache Flink：觀察背壓
    url: https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/monitoring/back_pressure/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看反向找堵塞與 busy 指標的讀法。
concepts:
  - id: cr-internals-04-restore
    prompt: 恢復時為何來源進度與算子狀態要取同一檢查點？
    answer: 若混用不同時刻，重播會重複計入已含事件，或跳過尚未算入的事件。
    mcq:
      options:
        - 任選各自最新即可
        - 同一切點把已算與待重播對齊
        - 狀態只用來加速，無關正確性
        - 恢復後不用再讀來源
      answer: 1
      explain: 檢查點綁住恢復邊界，不能各取一半。
  - id: cr-internals-04-sink
    prompt: Flink 狀態精確一次是否等於外部輸出只生效一次？
    answer: 不等於；還要可重播來源及支援對應提交協定或冪等的目的端。
    mcq:
      options:
        - 一定等於，只需開啟檢查點
        - 只要輸出沒有日誌就等於
        - 還要可恢復來源及配合的目的端
        - 只要延長超時就等於
      answer: 2
      explain: 重播可能再做外部動作；狀態恢復不會自動撤銷已生效的外部寫入。
    interview:
      question: Flink 的 checkpoint 卡住且來源背壓，你先查哪裡？
      points:
        - 說明背壓往上游傳
        - 看寫端吞吐及屏障對齊
        - 分清恢復和外部寫入驗證
      answer: 我會從下游高忙碌或慢寫入往前查，看請求耗時、緩衝和屏障對齊。若對齊拖慢，不只拉長超時；先處理堵塞，再用可重播輸入和配合的寫端驗失敗前後只生效一次。
  - id: cr-internals-04-pressure
    prompt: 上游嚴重背壓，最先加上游工作者對嗎？
    answer: 通常先定位下游限制；盲目加上游可能讓等待更嚴重。
    mcq:
      options:
        - 對，背壓只由最上游造成
        - 對，因為會提高數據正確性
        - 不一定；先找下游瓶頸
        - 不一定；應一律去掉檢查點
      answer: 2
      explain: 容量限制會沿著流向的反方向傳遞。
  - id: cr-internals-04-checkpoint-cost
    prompt: 對齊時間沒變，寫檢查點時間變長，先查什麼？
    answer: 先查狀態大小、寫出位元組與儲存等待；只拉長超時無法定位延遲。
practice:
  - id: cr-internals-04-p1
    kind: explain
    title: 畫出同一個可恢復邊界
    minutes: 9
    steps:
      - 在 C:\dev\conduit-lab\interview\checkpoint.md 畫檢查點和故障先後，寫出應重讀的位置。
      - 再把寫端延遲增至 1 秒，沿下游往回列 2 個要查的指標。
    checks:
      - 從位置 51 重播，狀態從 300 恢復，套用 20 後是 320 而不是 340。
      - 答案中區分算子狀態與已對外寫入的數據。
---

## 恢復必須回到同一個切點

Flink 的算子可保存狀態；例如某門市目前合計可放在鍵控狀態（keyed state）。檢查點（checkpoint）把來源進度和算子狀態的一致版本持久化；屏障（barrier）是沿數據流推進的邊界標記。對齊的檢查點中，收到屏障較快的輸入可能等待其他輸入的屏障，才確認哪些事件在同一個切點之前。非對齊檢查點可以一併保存飛行中的部分數據，另有存取代價，不會憑空移除下游瓶頸。

![Flink 同一檢查點保存算子狀態與來源位置；背壓反向傳回](assets/cr-internals-checkpoint.svg)

例：完成的檢查點 C 保存已處理到位置 50、門市合計 300，因而下次讀位置 51。稍後位置 51 的金額 20 已暫時加進狀態，卻還沒完成下一檢查點就崩潰。恢復使用 C 時，合計回到 300，讀 51 一次後為 320；若拿故障時的 320 搭配 C 的進度，就會變成 340。若 20 已寫給外部系統，算子回到 300 不會替它撤銷：目的端需要與檢查點配合的提交，或同鍵冪等寫入。

## 用背壓的方向找堵點

背壓（backpressure）是下游處理速度趕不上，上游輸出緩衝滿後必須等。假設外部寫端由 20 毫秒升到 1 秒，下游先忙，算子逐步無法送出，再傳到來源。先看寫端請求分布、吞吐、各算子的 busy／backpressured 時間，以及檢查點開始延遲、對齊時長。把耗時拆開：對齊長可能是網路或背壓；把狀態寫到儲存慢則要查狀態大小與 I/O。增加上游工作者，可能只是讓堵點堆更快。確認哪種證據成立後，再試相應的變更。

這是切點手算和口述，不需啟動叢集（額外 RAM 低於 0.1 GB）。真實演練另需驗來源可回放、目前檢查點有效、寫端語義可證；本例只驗位置與算子狀態算式。

## 還要分清：日誌跟不上，還是狀態存太慢

如果檢查點開始延遲和對齊變長，但狀態大小穩定，先追數據流哪個邊開始等待；若對齊時間接近以前，只有寫入檢查點變慢，就比較儲存等待和每次寫出的狀態大小。若沒人再消費某個分區，來源積壓也可能和慢寫端呈現相似表象，同時對照各分區進度。恢復時幫團隊留下三個可重驗的資訊：用哪一個已完成的檢查點、來源尚能讀到哪段、目的端對重播的承諾。三件事缺其一，就不要先說端到端已恢復。

模擬故障以前，先寫下預期來源位移、狀態與目的端列，再分別核對結果。

三條驗收線可一一追到證據。

## 常見錯誤
- 復原取各自最新狀態 → 邊界不一致 → 用同一完成檢查點。
- 說數據只有處理一次 → 可能多次執行或重播 → 精確一次談有效結果及寫端條件。
- 檢查點超時就調大時間 → 未確認耗時成因 → 分查對齊、狀態寫入及背壓。
