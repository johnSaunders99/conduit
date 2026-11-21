---
id: fd-io-07
module: fd-io
order: 7
title: 例外與隔離
subtitle: 把壞列留給下一輪修正
status: ready
minutes: 30
level: 1
prereqs:
  - fd-io-06
objectives:
  - 區分列級錯誤與整批不能繼續的錯誤
  - 將壞列及原因寫入隔離檔
  - 從 CSV 產出訂單淨額、日誌與結束碼
tags:
  - 例外處理
  - 隔離區
  - CSV 驗證
  - 批次摘要
resources:
  - title: Python 教學：例外處理
    url: https://docs.python.org/3/tutorial/errors.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 try、except、else 與 raise 的範例。
  - title: Python：csv 模組
    url: https://docs.python.org/3/library/csv.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 查 DictReader 的缺欄與行號行為。
concepts:
  - id: fd-io-07-row-exception
    prompt: 什麼錯誤可以把一列隔離後繼續？
    answer: 能可靠定位在一列的無效欄位，例如金額字串不合規。
    mcq:
      question: 哪個情境應停止本批而不是只拒收一列？
      options:
        - 第 4 行金額不能解析
        - 一列幣別不是 TWD
        - 一列少填訂單號
        - 整份 CSV 表頭與約定不符
      answer: 3
      explain: 沒有可靠表頭就不能判讀整批欄位，其餘皆可定位到個別列。
  - id: fd-io-07-count-balance
    prompt: 如何驗證沒有默默漏列？
    answer: 已讀數應等於接受數加拒收數，並對照隔離原因。
    mcq:
      question: 讀 3 筆、接受 2 筆，剩下一筆能只當作 0 元嗎？
      options:
        - 不能，應拒收並記下原因
        - 能，只要淨額剛好正確
        - 能，空金額和 0 相同
        - 不能，因此錯誤永遠要吞掉
      answer: 0
      explain: 缺值不是零；隔離並計數才可追查。
  - id: fd-io-07-exit
    prompt: 為什麼失敗要回傳非零結束碼？
    answer: 呼叫端可依結束碼判斷不能使用這次結果。
    mcq:
      question: 本課允許隔離後發布部分摘要，結束碼 0 代表什麼？
      options:
        - 每筆來源都有效
        - 有可發布的摘要，仍要核對拒收數
        - 沒有寫隔離檔
        - 摘要一定沒有改變
      answer: 1
      explain: 0 是批次契約所定的完成，不保證拒收數是 0。
practice:
  - id: fd-io-07-p1
    kind: hands-on
    title: 交付第一份訂單淨額摘要
    minutes: 12
    steps:
      - 依正文跑樣本，記錄 $LASTEXITCODE，核對三個產物。
      - 備份樣本後，改表頭再跑，觀察結束碼與舊摘要；最後還原。
    checks:
      - 原樣本有 2 筆接受、1 筆拒收，淨額 650 分，隔離紀錄標示第 4 行。
      - 表頭錯誤結束碼 1 並記 abort；舊摘要不代表此次成功。
---

## 讓壞列有去處，讓整批有結果

訂單以一列一筆金額事件送入：`sale` 增加淨額，`refund` 減少淨額。金額欄用正整數分（`amount_cents`），只收新台幣（TWD）。壞金額可以定位到一列，留下原欄位與原因後繼續；表頭不符、CSV 無法解析或讀寫失敗則停整批。本堂會留下摘要、隔離區（quarantine）和操作日誌（log，台灣也稱紀錄檔），第一次把擷取、驗證、轉換與輸出串成數據管道（data pipeline）。

## 例外處理速查

`try` 放可能出錯的操作；`except ValueError as error` 只處理指定例外，`raise ValueError("…")` 主動指出值不合規。`continue` 略過本輪，讓迴圈處理下一列。外層可處理檔案或 CSV 錯誤，內層只接住一列的規則失敗。`raise SystemExit(code)` 把函式結果交給作業系統作為結束碼（exit code，大陸常稱退出碼）。PowerShell 用 `$LASTEXITCODE` 讀取，0 表示這份練習的批次成功發布，1 表示沒有完成。

## 從輸入跑到三份產物

在 `C:\dev\conduit-lab\python-io` 存 UTF-8 的 `orders.csv`：

```csv
order_id,kind,amount_cents,currency
O01,sale,800,TWD
O02,refund,150,TWD
O03,sale,oops,TWD
```

同層存 `first_batch.py`，以 `py first_batch.py` 執行，再立即在 PowerShell 查 `$LASTEXITCODE`。檔名都是此練習專用；請勿拿正式報表當輸出檔。

```python
import csv
import json
from pathlib import Path

HEADER = ["order_id", "kind", "amount_cents", "currency"]

def signed_cents(row):
    if "_extra" in row or None in row.values():
        raise ValueError("wrong field count")
    if not row["order_id"].strip() or row["currency"] != "TWD":
        raise ValueError("missing order_id or unsupported currency")
    if row["kind"] not in ("sale", "refund"):
        raise ValueError("unknown kind")
    raw = row["amount_cents"]
    if not (raw.isascii() and raw.isdigit() and len(raw) <= 9 and int(raw) > 0):
        raise ValueError("amount_cents must be positive integer cents")
    return int(raw) if row["kind"] == "sale" else -int(raw)

def main():
    with open("first_batch.log", "w", encoding="utf-8") as log:
        log.write("start source=orders.csv\n")
        try:
            bad = []
            accepted = net = 0
            with open("orders.csv", encoding="utf-8-sig", newline="") as source:
                reader = csv.DictReader(source, restkey="_extra", strict=True)
                if reader.fieldnames != HEADER:
                    raise ValueError("unexpected CSV header")
                for row in reader:
                    try:
                        net += signed_cents(row)
                    except ValueError as error:
                        bad.append({"line": reader.line_num, "reason": str(error), "raw": row})
                        continue
                    accepted += 1
            with open("first_rejects.jsonl", "w", encoding="utf-8") as out:
                for item in bad:
                    out.write(json.dumps(item, ensure_ascii=False) + "\n")
            if not accepted:
                raise ValueError("no accepted rows")
            summary = {"accepted": accepted, "rejected": len(bad), "net_cents": net}
            Path("first_summary.json").write_text(json.dumps(summary) + "\n", encoding="utf-8")
            log.write(f"done accepted={accepted} rejected={len(bad)} net_cents={net}\n")
            return 0
        except (OSError, ValueError, csv.Error) as error:
            log.write(f"abort {error}\n")
            print(f"batch failed: {error}")
            return 1

if __name__ == "__main__":
    raise SystemExit(main())
```

`strict=True` 會在部分無法辨認的 CSV 語法上報錯，但不替你驗欄位數；這要在 `signed_cents` 檢查。`reader.line_num` 是讀到的實體末行，遇到引號裡換行時不是第幾筆訂單。隔離檔每行一個 JSON 物件，稱 JSON Lines，原欄位與失敗原因可逐一檢查。這裡使用合成樣本；正式作業的原始列應有適當權限和保留期限。

跑完確認 `first_summary.json` 有接受 2、拒收 1、淨額 650，隔離行號 4，日誌有 `start` 與 `done`。若沒有任何有效列，會寫出可解讀的隔離檔但不發布新摘要。若連日誌都無法開啟，則 Python 以錯誤結束，無法寫日誌。本例不保證中斷時摘要安全；[〈輸入契約〉](#/lesson/fd-lab-01)會定下規則，[〈原子替換輸出〉](#/lesson/fd-lab-04)再保護上一份摘要。

### 第一個批次，要分得清失敗的範圍

拿原本的 O03 再造一筆錯欄數：把最後的幣別和逗號拿掉。它應被拒收，但另外兩筆仍能輸出 650。將整份表頭改成不存在的欄名，就再也不能確定哪欄是金額，這次應在讀事件前停止。這兩種測試都故意製造錯誤，卻不應有相同結果：一個失敗可以定位到某一筆，另一個不可靠到不能計算。

日誌應讓你分辨是否執行了這批，隔離檔記的是有哪些列要處理，摘要是下游要用的數字。三者不能互相替代。若有效筆數是 0，數值 0 雖可算出來，卻不能讓下游以為今日真是零銷售；這個範例用非零結束碼回報。若 150 分的退款成功扣掉，但隔離檔沒有第 4 行，也還沒完成驗收，因為有人需要知道有一筆未進淨額。

交付前先收好合成輸入和這三份產物；把「允許有拒收仍交出摘要」寫在你的備註。若真實業務只接受完整數據，就要改發布門檻，而不是把隔離數隱藏。下一個模組先練可測的程式組織，再把這支草稿變成有正式入口與回歸測試的版本。

## 常見錯誤

- 把整段讀寫都當成壞列繼續：只在窄區塊接欄位錯誤；表頭和存檔錯誤走整批失敗。
- 上次的摘要還在就當本次成功：先查本次結束碼及日誌，再讀新摘要。
- 遇到退款前便把字串接在一起：在有效性檢查後轉整數，退款只在計算時取負值。
