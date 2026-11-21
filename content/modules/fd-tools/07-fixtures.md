---
id: fd-tools-07
module: fd-tools
order: 7
title: 固定測資
subtitle: 用三筆重現月末錯帳
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-06
objectives:
  - 建立每次都相同的三筆跨月測試樣本
  - 用 setUp 和暫存資料夾隔開各測試
  - 證明測試只改工作檔而不碰基準檔
tags:
  - 固定測資
  - fixture
  - setUp
  - 暫存資料夾
resources:
  - title: Python：unittest 測試框架
    url: https://docs.python.org/3/library/unittest.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 setUp 與 addCleanup 的執行時機。
  - title: Python：tempfile 模組
    url: https://docs.python.org/3/library/tempfile.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀 TemporaryDirectory 的隔離與清理。
concepts:
  - id: fd-tools-07-fixture
    prompt: 固定測資有何用途？
    answer: 把可重建的小輸入當測試起點，失敗時不必下載或找原檔。
    mcq:
      question: 測六月邊界應準備哪組日期？
      options:
        - 任意選三個今日時間
        - 只用七月中旬
        - 每次亂數生成且不記內容
        - 六月最後一天與七月第一天
      answer: 3
      explain: 跨日邊界才有機會揭露包含範圍寫錯。
  - id: fd-tools-07-setup
    prompt: TestCase 的 `setUp` 何時執行？
    answer: 每項測試前各跑一次。
    mcq:
      question: 第二個測試讀到上一個測試的改檔，怎麼修？
      options:
        - 為每項重建暫存位置與樣本
        - 指定所有測試固定順序
        - 共用輸出到目前資料夾
        - 清空正式樣本
      answer: 0
      explain: 隔離才能各自重跑；不依賴順序或刪真檔。
  - id: fd-tools-07-copy
    prompt: '`work = source` 能複製檔案嗎？'
    answer: 不能，只是讓另一個名稱指向同一路徑。
    mcq:
      question: 要確保改動工作檔不碰基準，哪個合適？
      options:
        - 給同一路徑另一個變數名
        - 將內容寫到另一條路徑，再比對原檔未變
        - 每次結束再把正式檔案改回
        - 只看輸出有沒有出現
      answer: 1
      explain: 用獨立路徑及原檔斷言雙重驗證。
practice:
  - id: fd-tools-07-p1
    kind: hands-on
    title: 保存可重現的月底樣本
    minutes: 8
    steps:
      - 執行兩個測試後，只用 `py -m unittest -v test_month_fixture.TestMonth.test_fresh` 重跑第二個案例。
      - 以已知日期核對邊界行，再把第 2 列日期暫改為 6 月查出失敗。
    checks:
      - 單獨執行仍通過，不依賴第一項測試。
      - 日期改動會使六月計數不符；還原才通過。
---

## 用三筆重現月底錯帳

月報把 7 月 1 日的訂單算進 6 月。若拿現場報表來重演，每次內容可能更新，還可能帶入不該分享的數據。固定測資（fixture，大陸也稱測試夾具）是一個可重建的測試起點：兩筆在 6 月、一筆剛進 7 月；不需外部檔，也讓日期錯誤一眼可見。這裡只用格式固定的 ISO 日期字串，測「是否以 2026-06- 開頭」，不拿字串檢查當成一般日期驗證。

## 準備與核對分開

`setUp(self)` 在每一項測試前跑一次，建立自己的檔案和初始內容。`TemporaryDirectory()` 創造專屬的暫存資料夾；`self.addCleanup(temp.cleanup)` 登記結束後清理。`Path(temp.name) / "name"` 表示把檔名接在該資料夾，不是做除法。要建立工作副本，請用不同路徑實際複製內容，不要只換一個變數名稱。

## 讓日期與檔案彼此隔離

在 `C:\dev\conduit-lab\tools` 存 `test_month_fixture.py`，於同層執行 `py -m unittest -v test_month_fixture`。

```python
from pathlib import Path
import tempfile
import unittest

def count_june(path):
    days = path.read_text(encoding="utf-8").splitlines()
    return sum(1 for day in days if day.startswith("2026-06-"))

class TestMonth(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        folder = Path(temp.name)
        self.baseline = folder / "days.txt"
        self.work = folder / "working_days.txt"
        self.sample = "2026-06-29\n2026-07-01\n2026-06-30\n"
        self.baseline.write_text(self.sample, encoding="utf-8")
        self.work.write_bytes(self.baseline.read_bytes())

    def test_boundary(self):
        self.assertEqual(count_june(self.work), 2)
        with self.work.open("a", encoding="utf-8") as out:
            out.write("2026-06-28\n")
        self.assertEqual(count_june(self.work), 3)
        self.assertEqual(self.baseline.read_text(encoding="utf-8"), self.sample)

    def test_fresh(self):
        self.assertEqual(self.work.read_bytes(), self.baseline.read_bytes())
        self.assertEqual(count_june(self.work), 2)
```

預期兩項通過。第一項驗數量增加又驗基準不變；第二項驗另一次起點不帶上一項的新增值。把第二項單獨重跑，結果應相同。這不是依靠「先跑第一項再清掉檔案」；每次只改自己暫存資料夾。下一堂[〈整合測試〉](#/lesson/fd-tools-08)會讓同樣的準備方式跑真正的命令。

### 先挑對三筆，不要先追求筆數

六月有兩筆，但這兩筆的位置不是為了湊數。29 日證明普通日期會被算入，30 日驗月末，7 月 1 日驗跨月隔離。若三筆都在六月中間，錯把七月一日也算進來的程式仍可能通過。把測試數據的選擇理由寫在案例名或說明裡，接手者就不會把月底那筆誤當重複而刪掉。

這裡的基準檔和工作檔都由 `setUp` 在本次暫存位置建立。所謂固定不是指保存一個永遠不能改的磁碟檔，而是每次照相同規則重建。若開啟的是日常工作檔，就算測試結束把它改回來，中途停電仍可能留下修改；讓測試寫入自己的位置才真正將風險縮小。

若斷言失敗時想保留證據，先把消息記下：預期兩筆、實際三筆、所測日期有哪三個。不要依賴前一項測試把輸出存到全域資料夾，好讓自己在事後看。專屬暫存位置可以安全用完清理；需要重現時，用樣本與同一條測試命令即可。

如果測試失敗，不要先把預期結果跟著程式輸出改成相同數字。回到樣本手數符合條件的日期，再決定是樣本準備、判斷規則還是預期寫錯。這樣也能區分「測到了跨月」與「測試碰巧綠燈」；若樣本從沒碰到月底，再多成功的輸出也不代表守住了月界線。

## 常見錯誤

- 測試只能照某個先後跑：某項測試用了別項留下的檔，改為由自己的 `setUp` 建立。
- 修改工作檔卻把原始一併改了：檢查是否用了相同路徑，不是內容副本。
- 只測月中，錯到月底才出現：用 6 月最後一天與 7 月第一天作邊界。
