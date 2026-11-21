---
id: fd-lab-02
module: fd-lab
order: 2
title: 命令列參數
subtitle: 昨天與今天用同一個程式
status: ready
minutes: 30
level: 1
prereqs:
  - fd-lab-01
objectives:
  - 以 argparse 宣告三個必要選項
  - 驗證批次編號與檔名形成規則
  - 用 PowerShell 驗不同參數的結束碼
tags:
  - argparse
  - 命令列介面
  - 批次編號
  - 路徑
resources:
  - title: Python：argparse
    url: https://docs.python.org/3/library/argparse.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀必填選項、參數解析與用法錯誤。
concepts:
  - id: fd-lab-02-parser
    prompt: '`parse_args()` 的角色是什麼？'
    answer: 按已宣告的參數規則讀命令列，回傳指定值或給出使用錯誤。
    mcq:
      question: 想確定輸入檔必須由呼叫者給，怎麼宣告？
      options:
        - 只在 help 文案提到 input
        - 只將型別設為 Path
        - '`add_argument("--input", required=True)`'
        - 不宣告，直接讀工作目錄所有檔
      answer: 2
      explain: required 檢查是否提供；Path 不替你檢查存在或必填。
  - id: fd-lab-02-path
    prompt: 路徑中有空格時 PowerShell 要怎麼傳？
    answer: 把整條路徑放在一對引號內，讓它成為單一引數。
    mcq:
      question: '`--output-dir "daily files"` 應被接收為什麼？'
      options:
        - 兩個不同的資料夾參數
        - 把空格自動刪掉的檔名
        - 一定從程式碼所在目錄起算
        - 一條帶空格的相對路徑
      answer: 3
      explain: 引號保住同一引數；相對路徑仍以工作目錄為準。
  - id: fd-lab-02-cli-exit
    prompt: 漏傳必要參數時為什麼不是結束碼 1？
    answer: 本課保留 argparse 的 2 給命令用法錯誤，1 給受理後的批次失敗。
    mcq:
      question: '`--help` 正常顯示說明時，是否已產生摘要？'
      options:
        - 沒有，顯示說明後就正常結束
        - 有，因為結束碼是 0
        - 只在缺檔時產生
        - 會把已有報表覆寫為說明
      answer: 0
      explain: 幫助是命令本身的成功，不表示執行了一批業務工作。
practice:
  - id: fd-lab-02-p1
    kind: hands-on
    title: 保留可重複選擇輸入的命令
    minutes: 8
    steps:
      - 執行正文的正常命令；改成 trial-02 再跑。
      - 漏傳一個必要參數，再把編號改成文字中含空格的值，各查看 $LASTEXITCODE。
    checks:
      - 兩次正常輸出含不同的預定摘要檔名。
      - 不合法的兩次都印 usage 及原因，結束碼 2。
---

## 昨天、今天只換輸入

不要為了讀另一個日期的 CSV 複製一支程式。命令列介面（command-line interface，CLI；大陸稱命令行接口）讓呼叫者選輸入檔、輸出資料夾及批次編號。這一堂先讓命令講清楚「收到什麼、預定寫到哪」，不讀訂單也不建立輸出。發布會在[〈原子替換輸出〉](#/lesson/fd-lab-04)接上。

## 語法速查

`argparse.ArgumentParser(description=...)` 建立參數解析器；`add_argument("--input", required=True, type=Path)` 宣告必填選項並將字串包成路徑，不會替你開檔。`parse_args()` 取得解析結果；帶連字號的選項 `--output-dir` 以 `args.output_dir` 取值。`parser.error(...)` 顯示用法和錯誤，結束碼 2。內建的 `--help` 顯示說明後正常離開，不發布任何數據。

批次編號（batch ID）進入輸出檔名，只收 1 至 40 個 ASCII 英數、底線或連字號。這也避免把空格、斜線或一整條路徑當成編號。編號的唯一性是呼叫者負責；同編號重跑會更新該批次的產物，編號本身不會自動增加。

## 先驗命令，不寫檔

在 `C:\dev\conduit-lab\batch` 存 `batch_args.py`：

```python
import argparse
from pathlib import Path
import re

def parse_args():
    parser = argparse.ArgumentParser(description="Summarize one TWD order-event CSV")
    parser.add_argument("--input", type=Path, required=True, help="source CSV")
    parser.add_argument("--output-dir", type=Path, required=True, help="results folder")
    parser.add_argument("--batch-id", required=True, help="letters, digits, _ or -")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", args.batch_id):
        parser.error("--batch-id must use 1-40 ASCII letters, digits, _ or -")
    return args

if __name__ == "__main__":
    options = parse_args()
    print("input:", options.input)
    print("planned summary:", options.output_dir / f"{options.batch_id}.summary.json")
```

`re.fullmatch` 用模式比對整個字串；方括號表示允許的字元，`{1,40}` 限制其數量。在同層的 PowerShell 執行：

```powershell
py batch_args.py --help
py batch_args.py --input orders.csv --output-dir "daily files" --batch-id trial-01
$LASTEXITCODE
```

預定摘要應出現在 `daily files` 下、檔名 `trial-01.summary.json`；這只是列印路徑，沒有建立檔案。`$LASTEXITCODE` 應為 0。請在每次 Python 命令後立刻讀取結束碼，以免被後面執行的命令蓋掉。若在不同工作目錄啟動，要同樣給對應的相對路徑，或使用絕對路徑與引號。

### 把參數當交付的一部分

選項名稱應反映誰決定什麼。輸入及輸出路徑由每次執行的操作人選擇；退款規則由輸入契約決定，不做成一個任意開關，否則同一張報表無法對帳。批次編號可用日期當一部分，但它不是日期驗證器，也不會替你篩選交易。即使編號含了某天，也只能說這次執行採用這個識別字串。

小規模驗收時，用紙記下「命令用法」和「業務輸入」兩個欄位。漏掉 `--input` 是用法還沒成立，應回報 2；指定 `absent.csv` 則是有提供值，這支試跑仍會列出預定檔名，等正式批次打開才會發現檔案不存在。不能因為 `Path` 建立成功就報告讀到了檔案。把錯誤交給最有資訊的那一層回報，操作者才能知道應修正欄位還是路徑。

在腳本外替換入參也是一種可驗證的交付。改用另一個輸出資料夾，結果就應反映新位置，不應悄悄跟著作者桌面的某個檔名。先保留帶引號及不帶空格的各一條正常命令，等整支腳本接上時便可用同樣的方法驗收。

提供幫助時可示範一條完整的正常命令，有助於初次接手的人辨認哪個值該換，哪個選項名應保留。

## 常見錯誤

- 帶空格的資料夾被拆成兩段：把整條路徑加上一對引號。
- 想用編號傳入資料夾：用 `--output-dir` 選位置，編號只用來識別這一批。
- 因為 `--help` 結束碼 0 便找報表：那只是說明成功；請執行帶完整選項的批次。
