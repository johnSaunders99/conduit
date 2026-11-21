---
id: fd-tools-08
module: fd-tools
order: 8
title: 整合測試
subtitle: 從空目錄還原同一份輸出
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-07
objectives:
  - 用暫存資料夾準備一份測試輸入
  - 啟動真正的子程序並核對結束碼
  - 驗證成功產物與缺檔不發布
tags:
  - 整合測試
  - 子程序
  - 結束碼
  - 輸出驗證
resources:
  - title: Python：unittest 測試框架
    url: https://docs.python.org/3/library/unittest.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 查測試準備、斷言和測試選擇。
  - title: Python：subprocess.run
    url: https://docs.python.org/3/library/subprocess.html#subprocess.run
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 cwd、returncode 與擷取錯誤輸出。
concepts:
  - id: fd-tools-08-integration
    prompt: 整合測試比直接呼叫函式多驗什麼？
    answer: 確認檔案、程序入口、輸出與結束碼能一起工作。
    mcq:
      question: 若入口沒有呼叫 main，但函式本身是對的，哪個能抓到？
      options:
        - 從終端啟動程式並核對產物
        - 只針對 main 裡的算式做單元測試
        - 看檔案存在
        - 只比 Python 版本
      answer: 0
      explain: 錯在接線，需跨越入口與產物邊界。
  - id: fd-tools-08-cwd
    prompt: '`subprocess.run(..., cwd=folder)` 的目的是什麼？'
    answer: 讓子程序的相對路徑以隔離的資料夾為基準。
    mcq:
      question: 如何驗證不依賴作者工作區的舊檔？
      options:
        - 在原目錄多跑一次
        - 以新暫存工作目錄及明確的輸入檔執行
        - 先把舊成品複製到新目錄
        - 只驗程式執行時沒有印字
      answer: 1
      explain: 乾淨起點才能看到缺少的依賴，不能帶舊成品。
  - id: fd-tools-08-failure
    prompt: 為什麼要測缺檔時不建立輸出？
    answer: 不讓空白或舊檔被下游誤認為成功發布。
    mcq:
      question: 缺檔案例應同時查哪些訊號？
      options:
        - 只查有無輸出字樣
        - 只查耗時
        - 非零結束碼、可懂的訊息和未產生新檔
        - 只查腳本叫什麼名字
      answer: 2
      explain: 三個訊號分別驗呼叫端、操作者和產物。
practice:
  - id: fd-tools-08-p1
    kind: hands-on
    title: 從空目錄驗收真正的命令
    minutes: 9
    steps:
      - 依正文建立腳本與測試並跑兩個案例。
      - 暫時把成功分支的計數加 1 再跑，觀察哪個測試失敗後還原。
    checks:
      - 成功案例會抓到錯數；缺檔案例仍不產生輸出。
      - 還原後兩個測試都通過。
---

## 不只測會算，還要測接得上

函式測出兩筆沒錯，但用命令啟動時卻從錯的資料夾找檔。在整合測試（integration test，大陸常稱集成測試）裡，測試以使用者的方式啟動程式，檢查輸入、結束碼、日誌或輸出能否一起工作。先用一支短的登入日計數工具練習；此程式只計數非空白行，不論是哪種事件。之後[〈回歸測試〉](#/lesson/fd-lab-05)會把同一方法用在訂單日報。

## 程序呼叫速查

`subprocess.run([執行檔, 引數...], cwd=folder, capture_output=True, text=True, timeout=10)` 啟動子程序（subprocess，大陸稱子進程，台灣也稱子行程），等它結束再收結果。`sys.executable` 用目前這支 Python，`cwd` 指定子程序工作資料夾；參數列表中的一個元素就是一個引數，不自行拼 shell 指令。`returncode` 看結束碼，`stderr` 讀錯誤訊息；不加 `check=True` 是因為要驗「預期失敗」而不是直接讓子程序的非零結束碼中斷測試。

## 從空目錄跑研習工具

在 `C:\dev\conduit-lab\tools` 存 `count_daily.py`：

```python
from pathlib import Path
import sys

def main():
    try:
        raw = Path("daily.log").read_text(encoding="utf-8")
    except FileNotFoundError:
        print("missing daily.log", file=sys.stderr)
        return 1
    count = sum(1 for line in raw.splitlines() if line.strip())
    Path("daily_count.txt").write_text(f"{count}\n", encoding="utf-8")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

同層存 `test_daily_integration.py`，在 `tools` 執行 `py -m unittest -v test_daily_integration`。測試使用兩個分開的空目錄，不會讀走你這層的 `daily.log`。

```python
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name("count_daily.py")

class TestDaily(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.out = self.folder / "daily_count.txt"

    def run_command(self):
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT)], cwd=self.folder,
            capture_output=True, text=True, encoding="utf-8", timeout=10
        )

    def test_success(self):
        (self.folder / "daily.log").write_text("LOGIN U01\n\nLOGIN U03\n", encoding="utf-8")
        result = self.run_command()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.out.read_text(encoding="utf-8"), "2\n")

    def test_missing(self):
        result = self.run_command()
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing daily.log", result.stderr)
        self.assertFalse(self.out.exists())
```

成功需同時有結束碼 0 和可讀的 `2`，缺檔則有 1 和清楚訊息，目錄內仍沒有結果。若只驗檔案存在，寫出 0 或殘缺檔也會過；若只驗結束碼，也抓不到輸出錯字。單元測試讓你快找到算式，整合測試驗證整支工具能交付，兩者不是互相取代。

### 每個案例驗兩道邊界

成功案例寫入一個刻意帶空白行的樣本，因此不能只拿總行數當答案；子程序惟有讀到正確資料夾中的檔案、正確忽略空白行，才會寫出兩筆。失敗案例沒有準備輸入，這不是忘記做測試準備，而是測缺檔時不發布。若把兩者放到同一目錄，成功後留下的結果可能使錯誤案例變得難以解讀。

`capture_output=True` 讓 Python 把兩個輸出串流收回，不需要你在螢幕找一行。小練習用 UTF-8 讀回文字；錯誤訊息用英文，仍可在測試裡精準查找。`timeout=10` 為這個小測試設定等待界線，子程序若卡住，不該讓整套檢查無限等下去。成功例另把 `stderr` 加入結束碼斷言的訊息，若啟動路徑有誤，測試即可給你原本被擷取的原因。

手動在終端跑一次仍然有用，尤其在第一次寫 README 時，但整合測試把這些前提一併保存。下一次改計數方式，失敗只會留下待測案例的訊息，不會踩到日常工作路徑。真正的大型管道可再加測上游連線或下游寫入，先保留這裡可在本機快速驗的檔案及結束碼契約。

想再核對一次，先跑缺檔而不跑成功例。它仍應正確失敗，顯示測試不靠前一項準備過的數據。

## 常見錯誤

- 從舊工作區撿到同名輸出：用空暫存目錄並斷言精確文字。
- 缺檔測試被非零碼提前中斷：收回結果自行斷言，不在這裡用 `check=True`。
- 上傳真實日誌做測試：改以手寫 2 筆合成樣本，避免個人資訊和不可控變動。
