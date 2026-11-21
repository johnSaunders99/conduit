---
id: fd-system-03
module: fd-system
order: 3
title: 磁碟與順序讀取
subtitle: 許多小檔拖慢讀取
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-02
objectives:
  - "說明順序掃描和跨許多小檔的成本差異"
  - "量測同位元組數的兩種存放方式"
  - "用檔案數與列數辨認實驗是否公平"
tags:
  - "順序讀取"
  - "磁碟 I/O"
  - "小檔案"
  - "頁面快取"
resources:
  - title: "io — Core tools for working with streams"
    url: "https://docs.python.org/3/library/io.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看二進位串流與預設緩衝。"
  - title: "The /proc Filesystem"
    url: "https://www.kernel.org/doc/html/latest/filesystems/proc.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 meminfo 中與快取有關的欄位。"
concepts:
  - id: fd-system-03-open-cost
    prompt: "為何位元組數相同，小檔多仍可能較慢？"
    answer: "每個檔會多次經過路徑查找、元數據讀取、開啟與關閉；未開始掃描內容已先花時間。"
    mcq:
      question: "96 個小檔和一個大檔內容相同，以下哪項仍不同？"
      options:
        - "總位元組必定不同"
        - "讀取的換行數必定不同"
        - "開啟和關閉次數"
        - "排序結果一定不同"
      answer: 2
      explain: "內容與列數相同也無法省掉每個檔案的開啟成本。"
  - id: fd-system-03-warm-cache
    prompt: "為何同一次讀取跑第二遍可能比較快？"
    answer: "內容或元數據可能留在記憶體快取，第二次不一定真的從同一個儲存裝置重新讀。"
    mcq:
      question: "熱快取下量到 1 ms，可以對外稱為什麼？"
      options:
        - "這次條件下的掃描時間"
        - "實體磁碟的精確吞吐"
        - "任何目錄的掃描上限"
        - "關閉所有快取後的時間"
      answer: 0
      explain: "一次測量只描述當時條件，不能把快取命中當成磁碟效能。"
  - id: fd-system-03-selectivity
    prompt: "為何不能看到小檔較慢就把所有數據永遠合成一個檔？"
    answer: "只查某日或某批時，合理分組可以少讀內容；要兼顧每檔成本和跳過不相關數據的能力。"
    mcq:
      question: "只查 1 天，而檔名目錄已按天組織，優先怎麼做？"
      options:
        - "先掃所有日期才過濾"
        - "先縮小到那一天再讀"
        - "把每列拆一檔"
        - "每次清空作業系統快取"
      answer: 1
      explain: "先縮小範圍可減少工作量；檔案粒度要貼合查詢，不是一味合併。"
practice:
  - id: fd-system-03-p1
    kind: hands-on
    title: "保存一次同量、不同檔數的讀取對照"
    minutes: 10
    steps:
      - "在新 system\\io 資料夾跑 io_probe.py，存成 scan.txt。"
      - "比較同量、檔案數與時間；再把 parts 改成 48，在另一個新資料夾重跑。"
    checks:
      - "原版兩邊都讀到 3072 筆與 36864 位元組，檔案數為 1 與 96。"
      - "報告保留測量環境，沒有聲稱此比值等於實體磁碟速度。"
---

每日匯入讀的數據量沒增加，卻從一份檔變成很多小檔。即使硬碟送出同樣多的位元組，打開每個小檔的成本也不會消失。這堂只改變存放格式，用相同內容比較兩次讀取。

## 一份掃到底，和反覆找入口

順序讀取（sequential read）是大致按接續位置向前讀。磁碟 I/O（disk input/output）是 CPU 與儲存設備交換數據的過程。一次讀較連續的區段，系統有機會提前讀後續內容，在傳統硬碟也少掉不少定位成本。SSD 沒有磁頭移動，但小檔仍各自要查路徑、開啟、讀取和關閉；其大小、時間戳等元數據（metadata）也是作業的一部分。這不是說一個巨大檔永遠最好：一份單日查詢若能定位某個日期目錄，就不必讀整年。

- `open(path, "rb")` 用二進位讀模式，不做文字換行轉換；`with` 結束時關檔。
- `read()` 一次取剩下的數據，本例樣本很小。大檔可用 `read(size)` 一塊一塊處理，避免全部留在記憶體；下一堂會談緩衝。
- 頁面快取（page cache）可以將檔案內容留在記憶體；剛寫完再讀往往打到快取。這個實驗會看到整條讀取路徑的成本，不宣稱量到純粹的硬碟吞吐。

## 固定內容，再換檔案數

在 `C:\dev\conduit-lab` 新建 `system\io`，存成 `io_probe.py`。腳本用 `mkdtemp` 建新的樣本目錄，不覆寫原有檔案。兩種擺法都是將同一列按相同次數寫出；建立檔案不計入計時。

```python
from pathlib import Path
from tempfile import mkdtemp
from time import perf_counter

parts, rows_per_part = 96, 32
root = Path(mkdtemp(prefix="scan-", dir="."))
row = b"o777,12,USD\n"
block = row * rows_per_part
full = root / "all.csv"
full.write_bytes(block * parts)
files = [root / f"part-{i:03d}.csv" for i in range(parts)]
for path in files:
    path.write_bytes(block)

def scan(paths):
    start = perf_counter()
    size = count = 0
    for path in paths:
        with path.open("rb") as file:
            data = file.read()
        size += len(data)
        count += data.count(b"\n")
    print(f"files={len(paths)} rows={count} bytes={size} ms={(perf_counter() - start) * 1000:.2f}")

scan([full])
scan(files)
```

在該資料夾用 PowerShell 跑：

```powershell
py io_probe.py | Tee-Object scan.txt
```

兩列應同為 3072 行、36864 位元組，一列開 1 個檔，另一列開 96 個。先驗收這些數字，才讀毫秒；若耗時接近，先重做幾次，或用同一批已生成的檔交換掃描順序，看看差異是否穩定。不要為了追一個漂亮結果而清全機快取。這裡預先列出路徑，未計入走訪目錄；上線時如從遠端物件儲存列舉，還要量那一段的成本。[〈小檔案合併〉](#/lesson/bd-hive-07) 會把這個現象帶進分散式數據表。

## 同一實驗回答不了所有讀取問題
如果真正的需求是讀某張訂單，而不是全掃，這個比較就不再等價。你可以猜想一份按日分組的數據，在查單日時未必慢；但要確認是不是只打開了那一天的檔案。交接報告應同時列出本次讀了多少列、多少位元組、開了多少檔。漏掉其中一欄，就可能把讀得少誤認成存得快。

也要記錄測試路徑所在的磁碟。若把小檔留在 Windows 目錄、大檔放在 WSL 家目錄，等於同時改了檔案數與檔案系統。單次比較的優勢是找出可能的成本，不是給兩台機器排名。

## 常見錯誤

- 一邊統計到不同位元組 → 比較條件不同 → 先核對列數、位元組與掃描範圍。
- 把第二次快讀當成磁碟升級 → 可能是記憶體快取 → 記錄測量順序。
- 看到小檔慢就刪除原始檔 → 比較不等於遷移授權 → 先用副本驗證產物。
