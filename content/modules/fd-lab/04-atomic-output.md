---
id: fd-lab-04
module: fd-lab
order: 4
title: 原子替換輸出
subtitle: 不要發布只寫了一半的摘要
status: ready
minutes: 30
level: 1
prereqs:
  - fd-lab-03
objectives:
  - 用同目錄暫存檔與 replace 保護上一份摘要
  - 發布訂單摘要與隔離結果並記批次日誌
  - 以結束碼和檔案證明是否完成
tags:
  - 原子替換
  - 暫存檔
  - 批次發布
  - 結束碼
resources:
  - title: Python：os.replace
    url: https://docs.python.org/3/library/os.html#os.replace
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 查替換既有檔案與跨檔案系統限制。
  - title: Python：tempfile 模組
    url: https://docs.python.org/3/library/tempfile.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看 NamedTemporaryFile 和 Windows 關檔限制。
concepts:
  - id: fd-lab-04-atomic
    prompt: 為何先在目的檔旁寫暫存檔？
    answer: 寫完整後才替換，減少讀者打開半成品，且確保同一檔案系統。
    mcq:
      question: 暫存檔還沒寫完程序就失敗，正式檔如何？
      options:
        - 仍是替換前的內容
        - 已被開成空檔
        - 會顯示暫存檔的前半
        - 必定在另一個目錄
      answer: 0
      explain: 直到替換前都沒有以寫入模式打開正式檔。
  - id: fd-lab-04-windows
    prompt: Windows 上在 replace 前為何先離開 with？
    answer: 確保暫存檔已關閉，避免開啟檔案的共用限制影響替換。
    mcq:
      question: 替換因目的檔被占用而失敗時，該怎麼處理？
      options:
        - 先刪舊報表再硬寫
        - 回報批次失敗，不先刪舊報表
        - 把碼改成 0
        - 直接將暫存檔當已發布
      answer: 1
      explain: 失敗應保留舊版；另查占用程式，再重新安全執行。
  - id: fd-lab-04-scope
    prompt: 逐檔原子替換能讓摘要和隔離檔同時更新嗎？
    answer: 不能；每一次只保護一個檔，仍要以此次成功訊號驗收整批。
    mcq:
      question: 隔離檔剛更新、摘要尚未替換時中斷，哪個正確？
      options:
        - 兩份一定一起回到上一版
        - 能由新隔離檔斷言摘要一定已更新
        - 可能看到不同次執行的兩份文件
        - 會自動重跑整批
      answer: 2
      explain: 逐檔保護不等同多檔交易。
practice:
  - id: fd-lab-04-p1
    kind: hands-on
    title: 發布可重跑的訂單摘要
    minutes: 12
    steps:
      - 用正常 orders.csv 跑同一批次，保留摘要、隔離檔和日誌。
      - 另存一份表頭壞掉的輸入，以同一批次重跑；比對既有摘要。
    checks:
      - 成功碼 0，summary 有 2、1、650，rejects 記第 4 行。
      - 壞表頭碼 1，summary 內容不變，日誌有 abort。
---

## 不讓半份摘要成為正式結果

如果直接以 `w` 打開舊摘要，還沒寫完就停電，讀者可能只拿到空檔或半個 JSON。原子替換（atomic replacement）改成先在目的檔同一資料夾寫暫存檔，寫完且關閉後，再用 `os.replace(temp, target)` 換成正式名稱。支援該操作的檔案系統上，讀者打開目的名稱時得到舊檔或新檔，不是正在寫的暫存內容。這裡不承諾斷電耐久、併發排程或多檔交易；兩個輸出各自替換，而不是同時發布。

## 語法速查

`tempfile.NamedTemporaryFile(dir=target.parent, delete=False, ...)` 產生不撞名的暫存檔並保留路徑。離開 `with` 後再換檔，避免 Windows 已開檔案的共用限制。`finally` 在正常或例外離開時都做清理；`unlink(missing_ok=True)` 刪除本函式建立的暫存檔，已被換走就不處理。注意：外部強制中止時，`finally` 不一定有機會執行，殘留暫存檔不等於正式檔已更新。

## 接上正式入口

沿用 `C:\dev\conduit-lab\batch` 的 `orders.csv`、`batch_args.py` 和 `order_input.py`，同層存 `order_batch.py`：

```python
import csv
import json
import logging
import os
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile

from batch_args import parse_args
from order_input import read_batch

def atomic_write(target, write):
    temp = None
    try:
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", dir=target.parent,
            prefix=".pending-", suffix=".tmp", delete=False
        ) as file:
            temp = Path(file.name)
            write(file)
        os.replace(temp, target)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)

def write_rejects(file, rejects):
    for row in rejects:
        file.write(json.dumps(row, ensure_ascii=False) + "\n")

def main():
    args = parse_args()
    batch = args.batch_id
    folder = args.output_dir
    log_path = folder / "batch.log"
    summary_path = folder / f"{batch}.summary.json"
    rejects_path = folder / f"{batch}.rejects.jsonl"
    log = logging.getLogger("orders")
    started = False

    try:
        for target in (log_path, summary_path, rejects_path):
            if target.resolve() == args.input.resolve() or (
                target.exists() and args.input.exists() and target.samefile(args.input)
            ):
                raise ValueError("input path must differ from outputs")
        folder.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            filename=log_path, encoding="utf-8", level=logging.INFO,
            format="%(asctime)s %(levelname)s %(message)s",
        )
        log.info("batch=%s start source=%r", batch, args.input.name)
        started = True

        summary, rejects = read_batch(args.input)
        atomic_write(rejects_path, lambda file: write_rejects(file, rejects))
        if not summary["accepted"]:
            raise ValueError("no accepted rows")
        summary["batch_id"] = batch
        atomic_write(summary_path, lambda file: file.write(json.dumps(summary) + "\n"))
        log.info("batch=%s done accepted=%d rejected=%d net_cents=%d",
                 batch, summary["accepted"], summary["rejected"], summary["net_cents"])
        return 0
    except (OSError, ValueError, csv.Error) as error:
        if started:
            log.error("batch=%s abort error=%r", batch, str(error))
        print(f"batch failed: {error}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
```

`write` 是傳進來的一個函式，`write(file)` 把內容寫進暫存檔。用 `lambda` 可以把要寫的內容交給它而不必另命名。`resolve()` 將路徑換成解析後的絕對路徑，`samefile()` 另外比對兩個現有名稱是否指向同一檔，避免把輸入當輸出。這是一般單批本機腳本，不在多人同時改檔的資料夾執行。

在同層的 PowerShell 執行：

```powershell
py order_batch.py --input orders.csv --output-dir out --batch-id trial-01
$LASTEXITCODE
Get-Content -LiteralPath .\out\trial-01.summary.json
Get-Content -LiteralPath .\out\trial-01.rejects.jsonl -Encoding utf8
Get-Content -LiteralPath .\out\batch.log -Encoding utf8
```

本次碼 0，摘要有 `batch_id`、2 筆接受、1 筆拒收、650 分；隔離檔與日誌可解釋差額。結束碼 2 為用法錯誤，1 是執行失敗；若沒有有效列，會發布可解讀的隔離檔但不發布新摘要。下游必須用本次結束碼判斷新結果可不可用，不能從現存舊檔倒推。若 Windows 的試算表正占用目的檔，先關閉讀取者再重跑，不要刪報表繞過錯誤。

### 哪一步之後才算發布？

把流程寫成讀取、驗證、寫隔離檔、寫摘要、記完成。前兩步只讀來源，如果表頭不符，不應動兩份正式結果；若批次合法但全部拒收，仍把拒收細節留給上游，摘要保留舊版。這使得「隔離檔有變動」和「新摘要可用」不是同一條件。要日後把多份檔一起交給自動下游，應另設版本資料夾或一次提交機制，不是把兩次 `os.replace()` 當成一個不可分的操作。

不用真的斷電也能查這條保證。先成功產出摘要，再準備壞表頭重跑；能驗到程式在發布以前停止。[〈回歸測試〉](#/lesson/fd-lab-05)接著會模擬「暫存檔寫到一半時失敗」。兩個反例驗不同區段，前者沒進入輸出，後者已開始寫暫存但未替換正式檔。這也說明為何必須保留一份已知舊內容，不能只觀察目的路徑有沒有檔案。

## 常見錯誤

- 在系統預設暫存區寫完再搬：可能跨檔案系統；暫存檔建在目的檔所在處。
- 寫完不關檔就替換：先離開 `with`，再呼叫 `os.replace`。
- 見到新隔離檔就宣告成功：逐檔替換，仍須查本次結束碼和摘要。
