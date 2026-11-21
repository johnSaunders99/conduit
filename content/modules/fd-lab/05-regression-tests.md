---
id: fd-lab-05
module: fd-lab
order: 5
title: 回歸測試
subtitle: 多一筆退款應改變哪個數字
status: ready
minutes: 30
level: 1
prereqs:
  - fd-lab-04
objectives:
  - 用可手算案例守住退款與拒收口徑
  - 驗證同一批執行失敗不覆寫摘要
  - 注入暫存寫入中斷並確認保留舊檔
tags:
  - 回歸測試
  - 退款
  - 故障注入
  - 原子替換
resources:
  - title: Python：unittest 測試框架
    url: https://docs.python.org/3/library/unittest.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 查 assertEqual、assertRaises 與執行測試的方法。
  - title: Python：subprocess.run
    url: https://docs.python.org/3/library/subprocess.html#subprocess.run
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 查子程序參數、結束碼及輸出擷取。
concepts:
  - id: fd-lab-05-boundary
    prompt: 回歸測試和一般跑一次有何差異？
    answer: 把已知的規則與預期值留在可重跑的檢查裡，新改動破壞它就報錯。
    mcq:
      question: 新增 1 筆有效退款 50 分，原淨額 650 怎麼變？
      options:
        - 700，接受多 1、拒收不變
        - 600，接受多 1、拒收不變
        - 650，拒收多 1
        - 650，原筆數不變
      answer: 1
      explain: 退款扣淨額，仍是有效事件。
  - id: fd-lab-05-old-output
    prompt: 如何證明表頭錯誤沒有發布新摘要？
    answer: 先保存成功輸出的位元組，失敗後查結束碼並逐位元組比對同一路徑。
    mcq:
      question: 只斷言摘要存在，能證明啥？
      options:
        - 一定證明原檔完整
        - 一定代表本次成功
        - 只能證明有檔案，不知是否受破壞
        - 能辨認是否為本次新結果
      answer: 2
      explain: 舊檔本就存在，須比完整內容。
  - id: fd-lab-05-injection
    prompt: 怎麼低風險地模擬暫存寫到一半失敗？
    answer: 在測試給寫入函式一個會先寫片段、再擲出例外的替身。
    mcq:
      question: 注入時應該驗什麼？
      options:
        - 只查函式曾出錯
        - 故意中止電腦
        - 把正式報表手動刪除
        - 舊目的檔沒改，且一般例外路徑的暫存檔被清理
      answer: 3
      explain: 這驗的是指定故障下的保存行為，不需要真實斷電或正式資源。
practice:
  - id: fd-lab-05-p1
    kind: hands-on
    title: 讓錯的退款一定被測試抓到
    minutes: 11
    steps:
      - 跑正文測試後，在 order_input.py 暫把退款改成正數。
      - 確認退款案例失敗，還原後重跑全組。
    checks:
      - 新增 50 分退款須使 650 變成 600；故意改壞時正常摘要測試失敗。
      - 還原後 3 項都通過，正式 out 未被測試改動。
---

## 把這次的規則留給下次改動

今天修了退款符號，下個月加入優惠時仍可能改壞。回歸測試（regression test）把具體的舊規則留下來，讓日後的變更自動遇到同一個驗收。這次守兩條線：退款確實扣錢，壞輸入和暫存寫入失敗不會破壞上一份摘要。

## 安排三個可區分的案例

第一項以 800、150、50 和一列壞金額當合成樣本，期待淨額 600、接受 3、拒收 1；除了報表，也看隔離的實體行號。第二項先得到一個成功產物，再以壞表頭、相同批次編號重跑，比對既有摘要的位元組。第三項做故障注入（fault injection）：用一個寫了片段就拋例外的函式，確認未完整寫完的暫存不會換成正式檔。不是每個失敗都要透過真實斷電來驗；把問題縮在要保護的邊界，便能安全而穩定地重跑。

## 從新目錄測真正的入口

沿用[〈原子替換輸出〉](#/lesson/fd-lab-04)的程式，在 `C:\dev\conduit-lab\batch` 存 `test_order_batch.py`，於同層執行 `py -m unittest -v test_order_batch`。

```python
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from order_batch import atomic_write

SCRIPT = Path(__file__).resolve().with_name("order_batch.py")
SAMPLE = (
    "order_id,kind,amount_cents,currency\n"
    "O01,sale,800,TWD\nO02,refund,150,TWD\nO03,sale,oops,TWD\n"
    "O04,refund,50,TWD\n"
)

class TestOrderBatch(unittest.TestCase):
    def setUp(self):
        work = tempfile.TemporaryDirectory()
        self.addCleanup(work.cleanup)
        self.folder = Path(work.name)
        self.source = self.folder / "orders.csv"
        self.source.write_text(SAMPLE, encoding="utf-8")
        self.output = self.folder / "results"
        self.summary = self.output / "trial.summary.json"

    def run_batch(self):
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT), "--input", "orders.csv",
             "--output-dir", "results", "--batch-id", "trial"],
            cwd=self.folder, capture_output=True, text=True, encoding="utf-8", timeout=10,
        )

    def test_refunds_and_rejects(self):
        result = self.run_batch()
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = json.loads(self.summary.read_text(encoding="utf-8"))
        self.assertEqual(actual, {
            "batch_id": "trial", "accepted": 3, "rejected": 1, "net_cents": 600
        })
        rejects = (self.output / "trial.rejects.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(rejects), 1)
        self.assertEqual(json.loads(rejects[0])["line"], 4)

    def test_bad_header_keeps_summary(self):
        result = self.run_batch()
        self.assertEqual(result.returncode, 0, result.stderr)
        previous = self.summary.read_bytes()
        self.source.write_text("wrong_header\nbad\n", encoding="utf-8")
        failure = self.run_batch()
        self.assertEqual(failure.returncode, 1)
        self.assertIn("unexpected CSV header", failure.stderr)
        self.assertEqual(self.summary.read_bytes(), previous)

    def test_partial_write_keeps_previous_file(self):
        target = self.folder / "summary.json"
        target.write_bytes(b"old")

        def interrupted(file):
            file.write("partial")
            raise OSError("simulated write failure")

        with self.assertRaises(OSError):
            atomic_write(target, interrupted)
        self.assertEqual(target.read_bytes(), b"old")
        self.assertEqual(list(self.folder.glob(".pending-*")), [])
```

預期看到 3 項 `OK`。現在只改退款符號試一次：有效筆數不變，但 800 加 150 再加 50 等於 1000，第一項會失敗，另兩項仍可驗對各自的邊界。再還原符號並重跑，三項應恢復。這個對照證明測試抓到的是計算規則，不是依賴終端文字恰巧出現。測試的暫存資料夾、合成輸入和輸出都有自己的位置，原先練習留下的 `out` 不會被改動。

### 選一個能把問題分開的預期

假設下游看到金額不對。第一項測試的精確摘要能說明是金額、筆數還是批次號不符；再查看隔離檔行號，可知道壞列是不是維持原規則。第二項刻意保留成功的舊摘要，確認錯誤不是「沒有任何檔案可被改壞」；第三項則不啟動整支命令，因為要控制失敗正好發生在寫完片段、換檔以前。用不同尺寸的測試守不同邊界，讓失敗更有提示。

測試不只給自己看。寫名字時要說出規則及結果，例如「壞表頭保留摘要」，不要叫「測試二」。後來新增優惠事件時，先看這份測試究竟在守舊規格，還是設錯了新規格；不要看到失敗就改期望數字。若業務確實改了退款計算方式，預期與 README 要一起更新，舊樣本也應保留足夠證據說明哪項規則改了。

注入例外證明的是此處一般寫入失敗的清理路徑，不證明系統斷電後仍一定保存。跨平台或多人同時寫入要用額外測試，這次只守課堂程式宣告的範圍，不把一句全綠當作所有環境都安全。

## 常見錯誤

- 用程式本身算預期值：兩邊可能一起算錯；用可手算的 600 當比較基準。
- 失敗案例只驗報表「還在」：先保存舊位元組，避免不完整的檔案也通過。
- 在真實報表目錄測中斷：改用暫存資料夾及小型故障替身。
