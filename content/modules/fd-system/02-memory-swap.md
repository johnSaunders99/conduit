---
id: fd-system-02
module: fd-system
order: 2
title: 記憶體與換頁
subtitle: 排序突然慢下來
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-01
objectives:
  - "區分虛擬位址、工作集與換頁"
  - "用同一批輸入比較整批及分批配置峰值"
  - "從觀察判斷是否有理由調查交換空間"
tags:
  - "工作集"
  - "換頁"
  - "swap"
  - "記憶體峰值"
resources:
  - title: "Working Set"
    url: "https://learn.microsoft.com/en-us/windows/win32/memory/working-set"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看常駐頁和軟、硬缺頁的區別。"
  - title: "vmstat(8)"
    url: "https://man7.org/linux/man-pages/man8/vmstat.8.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 si、so 與以間隔讀取的方式。"
  - title: "tracemalloc — Trace memory allocations"
    url: "https://docs.python.org/3/library/tracemalloc.html"
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "看追蹤的範圍與如何讀取峰值。"
concepts:
  - id: fd-system-02-working-set
    prompt: "工作集和程式能用的虛擬位址範圍是同一件事嗎？"
    answer: "不是；工作集指目前在實體記憶體中的相關頁面，虛擬位址範圍可包含尚未常駐的頁面。"
    mcq:
      question: "Windows 的行程工作集較接近哪個概念？"
      options:
        - "可使用的所有虛擬位址"
        - "目前常駐的頁面"
        - "設定在磁碟上的交換檔總容量"
        - "每秒讀入多少訂單"
      answer: 1
      explain: "工作集描述目前常駐的數據，不是位址上限、交換容量或吞吐。"
  - id: fd-system-02-faults
    prompt: "有缺頁就表示在從 swap 讀入嗎？"
    answer: "不一定；頁面可能在記憶體的其他清單、屬於新配置或需從原始映射檔案讀入。"
    mcq:
      question: "哪個觀察最支持 Linux 正在持續做交換 I/O？"
      options:
        - "swap 已使用 100 MiB，但速率都為零"
        - "每秒都看到明顯 si 或 so，且時間對得上變慢"
        - "Python 峰值是 2 MiB"
        - "只看到某次硬缺頁"
      answer: 1
      explain: "目前使用量和活動速率不同；單一缺頁不能保證來自交換空間。"
  - id: fd-system-02-batches
    prompt: "分批各自排完，是否等同於全域排序？"
    answer: "不會；後一批可能含比前一批更小的值，全域排序還要合併已排序批次。"
    mcq:
      question: "哪項是分批排序後才能確定的？"
      options:
        - "拼接後一定全域有序"
        - "程式一定沒有缺頁"
        - "各批內部有序"
        - "總讀取量一定下降"
      answer: 2
      explain: "能保證的是各批內的相對順序；批與批之間仍需合併。"
  - id: fd-system-02-allocated-peak
    prompt: "這堂的 tracemalloc 峰值為何不等於系統記憶體用量？"
    answer: "它追蹤 Python 配置，不包含完整行程與系統的成本，也看不出哪頁曾被換出。"
practice:
  - id: fd-system-02-p1
    kind: hands-on
    title: "用小樣本對照整批與分批工作集線索"
    minutes: 10
    steps:
      - "在新 system\\memory 資料夾跑兩個模式，保存輸出。"
      - "先比較 rows，再比較 peak_kib；把 chunk 由 256 改成 512 重試。"
    checks:
      - "兩種都處理 4096 筆，且整批配置峰值較高。"
      - "筆記不把 Python 峰值當成 swap 量，寫出分批排序還少哪一步。"
---

凌晨排序原本十幾秒，輸入變大後突然要幾分鐘。除了比較次數增加，還可能是熱數據無法同時留在記憶體。這堂先用小樣本比較兩種做法的配置峰值，不故意把電腦的記憶體吃滿。

## 頁面去哪裡了？

系統把記憶體按頁面（page）管理。虛擬記憶體（virtual memory）讓行程看到自己的位址，系統再把使用中的頁面對到實體記憶體等位置。工作集（working set）這裡指行程目前常駐在實體記憶體的相關頁面。在日報排序中，同時要保留的原始列、排序中的結構與輸出緩衝，都可能影響同一時間的需求。

程式存取尚未可直接使用的頁面時可發生缺頁（page fault），由系統處理。不是所有缺頁都要讀磁碟；例如可由已在記憶體中的頁面解決。交換空間（swap）用來保存部分被移出實體記憶體的頁面；Windows 常見名稱是分頁檔（page file）。換頁（paging）若反覆造成慢速讀寫，作業速度可能大幅下滑。另一方面，少量已使用的 swap 可以只是先前留下的固定用量，不能只看一個總數就定案。

- Windows 可先看工作管理員的記憶體與行程用量；若另看資源監視器的硬缺頁，記住也可能讀映射檔，不等於都在讀分頁檔。
- 在 Ubuntu Bash 可用 `vmstat 1 5` 觀察 5 筆，忽略第一筆累積統計，查看後面區間的 `si`、`so` 是否持續出現交換進出。這是整個 Linux 環境的統計，不會自動指認某項作業。

## 看配置峰值，不製造系統壓力

在 `C:\dev\conduit-lab\system\memory` 新目錄內存 `sort_probe.py`。兩個模式都處理 4096 筆；整批保留所有字串，另一種交付完一批就放下，這裡只數行、不冒充全域排序。`tracemalloc` 追蹤 Python 配置，第二個回傳值是追蹤期間的峰值。

```python
import sys
import tracemalloc

if len(sys.argv) != 2 or sys.argv[1] not in {"all", "chunk"}:
    raise SystemExit("Use all or chunk")
total = 4096
size = total if sys.argv[1] == "all" else 256
rows = 0
tracemalloc.start()
for start in range(0, total, size):
    batch = [f"{total - i:04d}," + "p" * 128 for i in range(start, min(start + size, total))]
    batch.sort()
    rows += len(batch)
    del batch
_, peak = tracemalloc.get_traced_memory()
print(f"rows={rows} peak_kib={peak / 1024:.1f}")
```

在該資料夾用 PowerShell 執行：

```powershell
py sort_probe.py all | Tee-Object peak-all.txt
py sort_probe.py chunk | Tee-Object peak-chunk.txt
```

兩份應都是 `rows=4096`，整批峰值較高，實際數字依 Python 而變。這只證明配置模式不同，不代表系統換過頁。要全域有序，還必須按鍵合併各個已排序的批次，而不是直接串接；實務上可選擇允許溢寫（spill，工具主動把中間數據存到磁碟）的引擎，再把它的臨時空間用量和作業系統 swap 分開看。

## 排序變慢時如何留下證據
先固定相同的數據量，記錄排序開始和結束；同一時間看行程記憶體與整機交換活動。若只有峰值上升，並沒有觀察到交換，不要斷定正在換頁；也可能只是本來就要排序更多列。若系統交換活躍但同機還有其他工作，也不能直接怪排序。比較相同輸入、較少批次同時保留時，變慢和活動是否一起下降，才容易縮小範圍。

## 常見錯誤

- 有 swap 用量就說排序在換頁 → 可能只有歷史占用 → 對照慢的時段與交換速率。
- 報峰值等於整個行程的記憶體 → 只量 Python 配置 → 記清工具的範圍。
- 分批後行數一致，就說排序等價 → 未查批次交界 → 全域排序須合併並核對順序。
