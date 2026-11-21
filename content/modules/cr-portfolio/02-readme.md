---
id: cr-portfolio-02
module: cr-portfolio
order: 2
title: 可重現的 README
subtitle: 從空目錄重跑一個營業日
status: ready
minutes: 25
level: 2
prereqs:
- cr-portfolio-01
objectives:
- 在空資料夾以範例重現單日日報
- 記下命令、輸入、輸出及成功值
- 區分乾淨目錄與另一台機器
tags:
- README
- 重現
- CSV
- 執行入口
resources:
- title: GitHub：README 的用途
  url: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 GitHub README 的開始方式與相對連結。
- title: Python：CSV 讀寫
  url: https://docs.python.org/3/library/csv.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 DictReader 及讀寫 CSV 的 newline。
- title: Python：argparse
  url: https://docs.python.org/3/library/argparse.html
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀必要參數與 help 的用法。
concepts:
- id: cr-portfolio-02-entry
  prompt: README 的命令旁最重要要寫什麼？
  answer: 從哪個資料夾跑、需要什麼工具、哪些輸入，和成功後會看到什麼。
  mcq:
    question: 從空目錄重跑前，最必要的是？
    options:
    - 提供輸入、腳本、執行指令及預期輸出
    - 先複製既有輸出
    - 先登入雲端
    - 只貼一張終端畫面
    answer: 0
    explain: 缺任何一項都無法獨立核對；既有輸出還會掩蓋問題。
- id: cr-portfolio-02-clean
  prompt: 空資料夾成功證明了什麼？
  answer: 在已說明的本機直譯器環境，不依賴舊輸出或原資料夾內的額外檔。
  mcq:
    question: 只在同台電腦不同資料夾成功，哪個結論適當？
    options:
    - 全部 Windows 版本都支援
    - 已驗另一台電腦
    - 這台機器可從乾淨目錄重現
    - 已驗正式排程
    answer: 2
    explain: 沒有改作業系統或直譯器，也沒有測遠端及排程。
- id: cr-portfolio-02-same-day
  prompt: 重跑同一日如何證明沒有再加一份？
  answer: 比較同一輸入下的輸出列數、金額與內容，並確認是替換而非追加。
  interview:
    question: 接手的人跑出金額不同，你第一步會問什麼？
    answer: 我先核對執行的命令、當前資料夾與輸入版本，並請對方貼虛構例的實際輸出。如果輸入相同，才看重送和付款口徑。
    points:
    - 先做最小可重現
    - 明確輸入和口徑
    - 不要索取私人數據
- id: cr-portfolio-02-empty-file
  prompt: 缺檔和標頭齊全但沒有數據列，為何不應一律填 0？
  answer: 缺檔代表沒有拿到輸入；有效空檔才代表本例的 0 筆營業日。
  mcq:
    question: 正確標頭後沒有任何數據列，本例應得到什麼？
    options:
    - 找不到檔錯誤
    - 沿用舊結果
    - 指定日期加上四個 0
    - 略過所有驗證
    answer: 2
    explain: 檔案存在且結構有效，按契約輸出可驗的空日。
practice:
- id: cr-portfolio-02-p1
  kind: build
  minutes: 11
  title: 寫出可從空資料夾核對的 README
  steps:
  - 在新資料夾只存 daily_orders.py 與示例 orders.csv，執行一次並寫 README.md。
  - 同一命令重跑一次，核對未追加；保留實際工具版本。
  checks:
  - 結果檔一列日報，值為 5、4、3、250。
  - README 寫下執行位置、輸入、預期、未實測範圍。
---

## 命令找得到檔案，才算是入口

說明檔（README）先寫用途與環境，再寫如何準備輸入、執行命令、找到結果，最後說明什麼算通過。不要把一台熟悉的電腦誤當成空環境。這個版本只用 Python 標準庫，不必裝第三方套件。命令列介面（command-line interface，CLI）用參數明示輸入檔、輸出檔及營業日。路徑相對於目前所在資料夾，不是你曾經編輯檔案的位置；換目錄就是很便宜的驗證。

## 跑一遍同日，再跑第二遍

在 `C:\dev\conduit-lab\orders-portfolio\clean-run` 建立下方兩檔。第一段存 `orders.csv`；用 UTF-8，金額用整數元，交易日由命令傳入，輸入單日且日期已由上游切好。

```csv
order_id,status,amount_yuan
O1,paid,120
O2,paid,80
O2,paid,80
O3,cancelled,70
O4,paid,50
```

第二段存成 `daily_orders.py`。它先完成檔案讀取與欄位、重送檢查才開輸出；同一 ID 不同內容時直接失敗。不要把正式檔當輸出，本練習用新資料夾裡的 `daily.csv`。

```python
import argparse
import csv
from datetime import date
from pathlib import Path

def summarize(source):
    orders, raw_rows = {}, 0
    with source.open(encoding="utf-8-sig", newline="") as stream:
        rows = csv.DictReader(stream)
        if rows.fieldnames != ["order_id", "status", "amount_yuan"]:
            raise ValueError("expected order_id,status,amount_yuan")
        for line, row in enumerate(rows, start=2):
            order_id, status = row["order_id"], row["status"]
            if None in row or not order_id or status not in ("paid", "cancelled"):
                raise ValueError(f"bad order row {line}")
            amount = int(row["amount_yuan"] or "")
            if amount < 0:
                raise ValueError(f"negative amount at row {line}")
            item = (status, amount)
            if order_id in orders and orders[order_id] != item:
                raise ValueError(f"conflicting order at row {line}")
            orders[order_id] = item
            raw_rows += 1
    paid = [amount for status, amount in orders.values() if status == "paid"]
    return raw_rows, len(orders), len(paid), sum(paid)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--date", type=date.fromisoformat, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input and output must differ")
    metrics = summarize(args.input)
    with args.output.open("w", encoding="utf-8", newline="") as stream:
        out = csv.writer(stream)
        out.writerow(["business_date", "raw_rows", "unique_orders", "paid_orders", "paid_yuan"])
        out.writerow([args.date, *metrics])
    print("Wrote", args.output)

if __name__ == "__main__":
    main()
```

從上述資料夾執行：

```powershell
py daily_orders.py --input orders.csv --date 2026-11-18 --output daily.csv
Get-Content -LiteralPath .\daily.csv
```

第一列是欄名，第二列為 `2026-11-18,5,4,3,250`。重跑相同命令，應仍只有一列日報，因為以寫入模式替換而非追加。這是同一輸入的可重現性（reproducibility），不是對任意數據變種、突發停機或正式環境的保證。寫入若途中斷電，輸出仍可能截斷；要做安全發布可回到〈[原子替換輸出](#/lesson/fd-lab-04)〉。把你實際用的 Python 版本記在 README，不需要宣稱所有版本都經驗證。

### 接手者要能在第一次失敗時停下

README 寫給還沒記住你命令的人。把作業系統和需有的 Python 寫在命令之前，接著列出兩個必要檔名與從哪裡取得，不要讓「執行範例」出現在檔案還沒建立前。輸出旁寫清欄名和唯一一列怎麼驗：原始五筆減一筆重送等於四張，另排除取消單後三張，付款金額是 120 加 80 加 50。如果終端顯示找不到腳本，不是數字算錯，先檢查是否在剛才建立的資料夾。若 Python 入口都無法啟動，記下實際錯誤，不要聲稱已重現。這些說明只需跟在相關步驟後，不必集中成一長頁。

程式以解析後的 ID、狀態與整數金額辨認相同記錄，不是比較原始字元；金額的字串寫法若不只一種，會先正規成整數。不用讀者猜哪些錯誤會被拒絕：標頭不符、非法狀態、不能轉成整數或同 ID 的內容衝突時都不發布本次日報。沒有數據列但有正確標頭時，本例仍輸出一列全零彙總，代表這是有效的空日；如果缺整份 CSV，則是輸入錯誤，不能回 0 掩蓋。這個小契約寫進 README 才算交給下一位。

若你改了日期參數，只是改了輸出上標的營業日，不會替輸入切分日期，因為原始 CSV 沒有日期欄。可留一條「同一批輸入請使用同一個日期」在指令旁，把上游責任留在同一個地方。

## 常見錯誤

- 輸出找不到 → 從不同資料夾執行 → 列出起始資料夾以及清楚的輸出路徑。
- 看見舊日報就判通過 → 可能根本沒有執行新版 → 從無輸出的資料夾開始。
- 重跑出現兩列結果 → 用了追加或沿用過期檔 → 明寫重跑策略並核對內容。
