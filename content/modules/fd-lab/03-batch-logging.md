---
id: fd-lab-03
module: fd-lab
order: 3
title: 日誌與批次編號
subtitle: 找出哪批輸入出了錯
status: ready
minutes: 30
level: 1
prereqs:
  - fd-lab-02
objectives:
  - 設定可依批次編號搜尋的日誌
  - 用 INFO 與 ERROR 區分進度和停止
  - 串起開始及結果紀錄
tags:
  - logging
  - 日誌層級
  - 批次編號
  - 可觀察性
resources:
  - title: Python 日誌入門
    url: https://docs.python.org/3/howto/logging.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀日誌層級、格式以及檔案追加設定。
concepts:
  - id: fd-lab-03-level
    prompt: 什麼情況適合記 ERROR 而非 INFO？
    answer: 整批不能完成、呼叫端需要知道失敗原因。
    mcq:
      question: 在契約允許拒收後發布時，最有用的完成日誌是？
      options:
        - 只有「一切正常」
        - 每列都寫 ERROR
        - 只列印程式名稱
        - 附接受數、拒收數、淨額的 done
      answer: 3
      explain: 完成仍可有拒收；要記具體計數才能核對。
  - id: fd-lab-03-batch-id
    prompt: 每個事件為何都標明批次號？
    answer: 同一檔可能含多批，編號可以把開始、結果與產物對回同一批。
    mcq:
      question: 兩批都有 done，怎麼知道哪行屬於 trial-02？
      options:
        - 查該行的 batch=trial-02
        - 取第一個 done 就好
        - 只看 ERROR 級別
        - 只看檔案最後修改時間
      answer: 0
      explain: 每行記批次號才可可靠歸屬。
  - id: fd-lab-03-logging-vs-output
    prompt: 日誌與摘要有何不同？
    answer: 摘要供下游讀確定欄位，日誌供人診斷過程。
    mcq:
      question: 只有 start 沒有 done 及成功結束碼，可否宣告本批發完？
      options:
        - 可以，因為讀檔一定已完成
        - 不可，還要看本次結果與產物
        - 可以，把舊摘要當本批
        - 可以，只要沒有寫 ERROR
      answer: 1
      explain: 程序可能中斷；操作訊號不能靠缺少錯誤反推成功。
practice:
  - id: fd-lab-03-p1
    kind: hands-on
    title: 從混合日誌追出同一批
    minutes: 8
    steps:
      - 依正文跑 trial-01，再用不存在的 absent.csv 跑 trial-02。
      - 記下各自的 $LASTEXITCODE，以 Select-String -Path logging_probe.log -Pattern 'trial-02' 篩日誌。
    checks:
      - trial-01 有 start 和 done，並有三個摘要數字。
      - trial-02 有 start 和 abort，沒有 done，結束碼 1。
---

## 先回答「哪一批出事」

日報沒有更新，螢幕已關。你不只想知道程式說過什麼，還要知道哪次執行、讀了哪個檔、在哪個階段停住。日誌（log）是為追查過程留下的紀錄，不是給報表直接當數據。每行帶同一個批次編號；正常開始和完成記為 `INFO`，整批無法完成記為 `ERROR`。正式日誌只放識別碼、必要檔名及計數，不把整列原始內容放進去。

## 語法速查

`logging.basicConfig(filename=..., encoding="utf-8", level=logging.INFO, format=...)` 把日誌寫進 UTF-8 檔案；預設採追加，不清掉上一批。格式的 `%(asctime)s` 放入時間、`%(levelname)s` 放層級、`%(message)s` 放訊息。`logging.info("batch=%s start", batch_id)` 將參數套入訊息；`logging.error(...)` 記停止原因。結束碼仍要由程式主動決定，記一行 ERROR 不會自動讓程序失敗。

## 做一支能追查的試跑工具

沿用 `C:\dev\conduit-lab\batch` 的 `batch_args.py`、`order_input.py` 和 `orders.csv`。同層存 `logging_probe.py`。這支試跑只驗讀檔及日誌，不發布摘要，`--output-dir` 保留給下一堂的正式入口。

```python
import csv
import logging
from batch_args import parse_args
from order_input import read_batch

def main():
    options = parse_args()
    batch = options.batch_id
    logging.basicConfig(
        filename="logging_probe.log", encoding="utf-8", level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    logging.info("batch=%s start source=%r", batch, options.input.name)
    try:
        result, _ = read_batch(options.input)
        if not result["accepted"]:
            raise ValueError("no accepted rows")
    except (OSError, ValueError, csv.Error) as error:
        logging.error("batch=%s abort error=%r", batch, str(error))
        return 1
    logging.info("batch=%s done accepted=%d rejected=%d net_cents=%d",
                 batch, result["accepted"], result["rejected"], result["net_cents"])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

在同層的 PowerShell 執行並查看 `logging_probe.log`：

```powershell
py logging_probe.py --input orders.csv --output-dir out --batch-id trial-01
$LASTEXITCODE
py logging_probe.py --input absent.csv --output-dir out --batch-id trial-02
$LASTEXITCODE
```

第一批為 0，日誌 `done` 應有 2、1、650；第二批為 1，有 `start` 和缺檔的 `abort`。讀共同日誌時先找編號，再看結果。若用同一編號重跑，還要以時間與該次的開始／結果成對核對，不能拿上一次的 `done` 作證。

### 日誌只留下能決定下一步的內容

讀一行日誌，至少能回答「這是何時、哪一批、做了什麼」。開始時留來源檔名，完成時留接受、拒收及淨額；結束時用足夠的內容讓接手人分辨缺檔、表頭不符還是沒有有效列。不要只有 `done`，也不要按每列輸出相同訊息，否則上千條程式內部細節會把真正的失敗淹沒。本課示範用同一檔追加兩次；正式環境則還需要日誌大小、保留期間和權限的安排。

拿成功例來看，`accepted=2 rejected=1` 和日報 650 能形成一條證據鏈，不表示三列都有效。若只留下淨額，就很難辨認 650 是三列都被計入，還是其中有一列被拒收。失敗例則不該有該次的 `done`；只找到前一批的成功也不能代替本次。若連日誌檔都不能建立，應用終端錯誤和結束碼先查路徑與權限；此時當然找不到該次日誌。

可觀察性（observability）在這裡不需要額外服務，先有幾個能對回輸入與結果的訊號。試用批次號從追加檔搜尋，仍應能手算結果吻合。下一堂接入輸出時，把 `done` 放在摘要真正替換之後，不在讀完數據時提前記錄。

日誌時間只是協助對回同一次執行，不拿它決定訂單屬於哪天。來源應先按業務日期選好，本批次不負責從檔名或執行時間猜測交易日。

## 常見錯誤

- 有錯卻只有一行「失敗」：補上批次號及可追查的原因。
- 在日誌中倒出整筆數據：必要時把拒收資訊放到另行管理的隔離檔，不用日誌代替。
- 沒有 ERROR 就算成功：可能連程式都沒啟動；看該次的結束碼、完成日誌及產物。
