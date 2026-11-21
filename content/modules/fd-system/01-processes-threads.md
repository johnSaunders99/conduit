---
id: fd-system-01
module: fd-system
order: 1
title: 行程與執行緒
subtitle: 哪個工作吃掉一個核心
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - "區分程式、行程與執行緒"
  - "測量相同經過時間下的行程 CPU 用量"
  - "從多核心的總量判讀單核心瓶頸"
tags:
  - "行程"
  - "執行緒"
  - "CPU 核心"
  - "經過時間"
resources:
  - title: "Processes and Threads"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/processes-and-threads"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看哪一層擁有資源，哪一層被排程。"
  - title: "time — Time access and conversions"
    url: "https://docs.python.org/3/library/time.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "比較 perf_counter 與 process_time。"
concepts:
  - id: fd-system-01-resource
    prompt: "行程與執行緒各負責什麼？"
    answer: "行程提供資源與位址空間；執行緒是其中被系統排程的執行單位，同一行程內共用不少資源。"
    mcq:
      question: "誰有自己的執行進度，又能和同一行程裡其他同伴共用記憶體？"
      options:
        - "另一個行程"
        - "執行緒"
        - "檔案描述元"
        - "程式檔"
      answer: 1
      explain: "執行緒有自己的執行上下文；另起行程預設各有位址空間。"
  - id: fd-system-01-cpu-wall
    prompt: "經過 5 秒而 CPU 時間 0.02 秒，先猜哪類原因？"
    answer: "這段大多不在 CPU 執行，可先查等待，不憑數字斷定是磁碟、網路或鎖。"
    mcq:
      question: "兩個工作都經過 5 秒，哪個有較多行程 CPU 用量？"
      options:
        - "CPU 4.8 秒的工作"
        - "CPU 0.02 秒的工作"
        - "兩者相同"
        - "僅看 PID 較大者"
      answer: 0
      explain: "經過時間相同不代表都在算；PID 不能當作效能指標。"
  - id: fd-system-01-core-total
    prompt: "8 個等速邏輯處理器中，一個工作吃滿 1 個時，總圖一定顯示 100% 嗎？"
    answer: "不會；其他核心若閒置，按總容量平均的用量約為 12.5%。"
    mcq:
      question: "總 CPU 約 12.5% 為何仍可能有單一執行緒受限？"
      options:
        - "執行緒不能使用 CPU"
        - "總圖可能將單核心忙碌平均掉"
        - "工作一定是網路故障"
        - "增加檔案大小會平均到各核心"
      answer: 1
      explain: "要看每個邏輯處理器或測行程的 CPU 時間，而非只看總量。"
practice:
  - id: fd-system-01-p1
    kind: hands-on
    title: "把一個忙碌工作與一個等待工作分開"
    minutes: 10
    steps:
      - "在新 system\\cpu 資料夾執行兩次正文程式，保存 cpu-busy.txt 和 cpu-wait.txt。"
      - "把秒數改成 2，先預測 wall_s 與 cpu_s，再重測。"
    checks:
      - "兩次 wall_s 接近設定值，busy 的 cpu_s 明顯高於 wait。"
      - "筆記寫出 PID、兩種時間差異和不能確認的等待原因。"
---

同一份訂單匯入有兩個步驟，都耗時約 5 秒。一個忙著轉換字串，另一個在等上游。把它們都標成「CPU 慢」，會讓下一班調錯地方。這堂先找出在**跑**的工作與只在**等**的工作。

## 一個檔案，不等於一條執行路線

程式（program）是尚未執行的指令，例如硬碟上的 `cpu_probe.py`。啟動後，行程（process；大陸常稱進程）有自己的識別碼和虛擬位址空間，管理開啟的檔案等資源。系統把 CPU 時間分配給執行緒（thread；大陸常稱線程）。每個執行緒有自己的執行進度與呼叫堆疊（call stack），可在同一行程內共用其他記憶體和資源。如果開兩個 Python 行程，即使讀同一個程式檔，仍各有 PID，不能把其中一個變數的更新當成兩邊都改了。

- 經過時間（elapsed time）：從開始到結束的鐘面時間，包含等待。用 `time.perf_counter()` 前後相減。
- 行程 CPU 時間（process CPU time）：行程得到的 CPU 執行時間，不把睡眠算進來。用 `time.process_time()` 前後相減。
- 邏輯處理器（logical processor）是系統可排程的 CPU 單位。若 8 個容量相近的邏輯處理器只有 1 個忙滿，總用量約 12.5%，並不代表沒有單線瓶頸。

CPU 時間不等於完成多少轉換，也會受同機其他工作影響。先用兩種差異大的模式建立直覺，再把這種判斷用在自己的作業上。

## 同樣等五秒，只有一個在算

在 `C:\dev\conduit-lab` 下另建 `system\cpu`，存下 `cpu_probe.py`。這支程式用 `sys.argv` 讀模式；少給或寫錯就停止。忙碌版重複做簡單的整數運算，等待版用 `sleep` 代表沒有可用輸入時的等待，不冒充真正的網路測速。

```python
import os
import sys
from time import perf_counter, process_time, sleep

if len(sys.argv) != 2 or sys.argv[1] not in {"busy", "wait"}:
    raise SystemExit("Use busy or wait")
mode = sys.argv[1]
wall, cpu = perf_counter(), process_time()
if mode == "busy":
    value = 0
    while perf_counter() - wall < 5:
        value = (value + 1) % 1009
else:
    sleep(5)
print(f"pid={os.getpid()} mode={mode} wall_s={perf_counter() - wall:.2f} cpu_s={process_time() - cpu:.2f}")
```

在該資料夾用 PowerShell 跑，兩個程式各有自己的 PID；`Tee-Object` 一邊顯示，一邊保存。

```powershell
py cpu_probe.py busy | Tee-Object cpu-busy.txt
py cpu_probe.py wait | Tee-Object cpu-wait.txt
```

兩個經過時間都接近 5 秒，但忙碌版的 CPU 秒數應明顯較高，不必剛好等於 5。若等待版接近零，只能確定它少在 CPU 上跑；實務上還應記錄磁碟、網路或等待其他執行緒的時間。可在忙碌執行期間看工作管理員的「效能」CPU 圖，切到邏輯處理器再觀察。短作業不一定剛好被畫面取樣，當次的時間紀錄比一張瞬間截圖更直接。

## 把假設寫成下一個檢查
某個作業顯示經過 5 秒、行程 CPU 時間接近 5 秒，可能代表有一條路線持續運算，卻不能單靠這兩個數字確定用了哪顆核心。反過來，許多執行緒真的同時在不同核心上算，合計 CPU 時間還可能大於經過時間。交接時先保留量到的兩欄，再說你想用哪一種證據驗證「單線很忙」或「大多在等」。

## 常見錯誤

- 行程在清單裡就判定正在運算 → 也可能在睡眠或等待 → 並看經過時間與 CPU 時間。
- 只看總 CPU 就加更多分工 → 一個邏輯處理器可能已滿 → 先定位到行程，再查哪條執行路線。
- 把共用記憶體當成彼此會自動排好順序 → 更新可能互相干擾 → 先理解資源邊界，之後在[〈執行緒、執行緒池與可見性〉](#/lesson/fd-java-10)才做協調。
