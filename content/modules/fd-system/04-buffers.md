---
id: fd-system-04
module: fd-system
order: 4
title: 緩衝與批次
subtitle: 一次送十筆有何代價
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-03
objectives:
  - "分開計算批次的固定成本與逐筆成本"
  - "比較批次大小 1 和 10 對呼叫數、延遲的影響"
  - "解釋 flush 為何不保證斷電後能讀回"
tags:
  - "緩衝區"
  - "批次"
  - "吞吐"
  - "端到端延遲"
resources:
  - title: "io — Core tools for working with streams"
    url: "https://docs.python.org/3/library/io.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 BufferedWriter、flush 與 close。"
  - title: "os.fsync"
    url: "https://docs.python.org/3/library/os.html#os.fsync"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看先 flush 再請系統同步檔案。"
concepts:
  - id: fd-system-04-fixed-cost
    prompt: "為何一次送 10 筆可能比逐筆送更省事？"
    answer: "整理請求、往返或確認的部分成本按次而非按筆，多筆可以共享一次固定成本。"
    mcq:
      question: "固定 3 毫秒、每筆 1 毫秒，20 筆分兩次送的服務成本？"
      options:
        - "20 毫秒"
        - "26 毫秒"
        - "60 毫秒"
        - "80 毫秒"
      answer: 1
      explain: "兩次固定成本是 6 毫秒，加上 20 筆逐筆成本；80 是每筆獨立呼叫的成本。"
  - id: fd-system-04-latency
    prompt: "什麼情況下加大批次反而讓某筆等待更久？"
    answer: "只在湊滿才送且事件來得慢時，先到的記錄會一直等到後面幾筆。"
    mcq:
      question: "如何限制低流量時湊批的等待？"
      options:
        - "只增加批次大小"
        - "改用更長的逾時"
        - "湊滿或達等待上限其一就送"
        - "只按總行數驗證"
      answer: 2
      explain: "筆數上限只控制批量，時間上限才讓未滿的批次也能送。"
  - id: fd-system-04-flush
    prompt: "Python 的 flush 和 fsync 是否為同一件事？"
    answer: "flush 把應用緩衝交給系統；fsync 是另外向系統請求同步該檔案，不能用 flush 的成功代替。"
    mcq:
      question: "只呼叫 flush，可以確定什麼？"
      options:
        - "已要求把應用層緩衝交給下層"
        - "遠端同事已讀過"
        - "任意斷電都不會影響任何檔"
        - "接收方會自動重試"
      answer: 0
      explain: "flush 的責任不包括遠端確認或完整的斷電復原。"
practice:
  - id: fd-system-04-p1
    kind: hands-on
    title: "留一份吞吐與延遲的取捨便條"
    minutes: 10
    steps:
      - "跑正文模擬，保存 batch-timing.txt。"
      - "把批次加上 50 毫秒的等待上限做紙上推算：第 0、20、40 毫秒到達，第一批收幾筆？"
    checks:
      - "逐筆與十筆一批服務成本是 80、26 毫秒；最大延遲是 4、193 毫秒。"
      - "有 50 毫秒等待上限時，第一批在第 50 毫秒送出 3 筆，不等到第 10 筆。"
---

實時登入流原本每來一筆就交給下游。把 10 筆一起送可以減少呼叫，但較早到的事件得等後面的。工程上不是只挑「跑得快」的大小，而是問：要節省哪種成本，允許哪一筆多等多久？

## 一次呼叫的成本，和一筆數據的成本

緩衝區（buffer）暫存還未交給下一層的數據；批次（batch）是一次處理的一組。寫檔的緩衝區常按位元組管理，工作消息可按筆數、位元組或等候時間組批。吞吐（throughput）是每單位時間完成的數量；端到端延遲（end-to-end latency）是單筆從進來到可交付的時間。總成本降低，不代表第一筆會更早到。

- 每次呼叫有固定成本，例如建立一次請求；每筆也有獨立成本，例如編碼。
- 只用筆數上限，流量很低時可能遲遲湊不滿。常見策略是**滿量或到了時間上限就送**，並明定結束時如何處理最後一個未滿批次。
- 待送數據占用記憶體。批次大時，單次重試也可能涉及更多筆。若接收方變慢，長期限制不能只靠累積；之後在[〈背壓與端到端一致性〉](#/lesson/bd-flink-10)會再看如何讓上游放慢。

另有兩層容易混淆：Python 檔案物件的 `flush()` 將應用緩衝交給系統，正常關檔通常也會做這一步。要請系統同步該檔案，需要在 `flush()` 後呼叫 `os.fsync(file.fileno())`；這有額外成本，且不是遠端服務已經收件的證明。不要把任何一層的成功當成整條管道所有環節皆已安全保存。

## 把速度換成兩欄數字

在 `C:\dev\conduit-lab\system\buffers` 新目錄存成 `batch_timing.py`。用算式模擬 20 筆、每隔 20 毫秒抵達一筆；服務固定花 3 毫秒、每筆再花 1 毫秒。這兩組負載下，前一批在下一批送出前完成，所以不另外模擬服務排隊。延遲從第一筆到達，數到同批完成。

```python
for size in (1, 10):
    calls = service_total = worst = 0
    for first in range(0, 20, size):
        count = min(size, 20 - first)
        queue_ms = (count - 1) * 20
        service_ms = 3 + count
        calls += 1
        service_total += service_ms
        worst = max(worst, queue_ms + service_ms)
    print(f"size={size} calls={calls} service_ms={service_total} worst_ms={worst}")
```

在該目錄用 PowerShell 執行：

```powershell
py batch_timing.py | Tee-Object batch-timing.txt
```

一筆一批做 20 次、共花 80 毫秒在服務；十筆一批做 2 次、共花 26 毫秒。但最早到的那筆最多等 `9 × 20 + 13 = 193` 毫秒才完成，比逐筆的 4 毫秒久。這不是實測網路；若要決定真實批次大小，先定延遲上限，再量忙碌與冷清時段的到達量和實際服務耗時。

## 用可接受的延遲倒推上限
若第一筆一定要在 100 毫秒內完成，樣本的十筆方案即使減少呼叫，也不符合。但把筆數上限降很低，不是唯一選項；你可以同時設計等待上限與批次上限。實際服務耗時若也會抖動，要為它保留可用時間，而不是把整段延遲都分給湊批。驗收時看最慢的那批，不只看平均。

## 常見錯誤

- 只報服務總時間 → 看不到湊批等待 → 同存最早一筆的延遲。
- 尾端少了幾筆 → 等滿才送，結束時沒處理剩餘 → 明訂送最後一批的條件。
- 把 `flush()` 當成斷電保證 → 混了應用與系統兩層 → 查同步、確認與可恢復的契約。
