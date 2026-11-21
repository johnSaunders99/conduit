---
id: fd-tools-06
module: fd-tools
order: 6
title: 單元測試與斷言
subtitle: 對一筆退款寫出預期
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-05
objectives:
  - 將退款計算與檔案讀寫分開
  - 用 unittest 驗證一般回傳值與不合法的輸入
  - 觀察自動測試在規則改壞時失敗
tags:
  - 單元測試
  - 斷言
  - unittest
  - 退款
resources:
  - title: Python：unittest 測試框架
    url: https://docs.python.org/3/library/unittest.html
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: 讀 TestCase、assertEqual 與 assertRaises。
concepts:
  - id: fd-tools-06-unit
    prompt: 為什麼把轉換函式與讀檔分開？
    answer: 可用小輸入直接驗回傳值，不需檔案與網路。
    mcq:
      question: 要單獨驗退款符號，何者最有用？
      options:
        - 檢查程式中存在 print
        - 先準備整月 CSV
        - 傳 150，斷言回傳 -150
        - 單獨驗日誌存在
      answer: 2
      explain: 測試應直接抓到金額規則的變化。
  - id: fd-tools-06-assert-equal
    prompt: '`self.assertEqual(actual, expected)` 比較什麼？'
    answer: 比較實際結果與預期值，不同便讓測試失敗。
    mcq:
      question: 只驗退款回傳是 int，漏掉什麼？
      options:
        - 類型相同就保證金額相同
        - 所有例外一定消失
        - 這就是完整業務驗收
        - 正負號及具體金額可能錯
      answer: 3
      explain: 150 和 -150 都是整數，類型斷言分不出來。
  - id: fd-tools-06-raises
    prompt: '`assertRaises(ValueError)` 區塊放什麼？'
    answer: 放應當擲出例外的那一次操作。
    mcq:
      question: 驗無效金額時哪種寫法較可靠？
      options:
        - 只在 assertRaises 區塊呼叫待測函式
        - 對一大段不相關準備流程驗任意例外
        - 遇錯就 pass 不看結果
        - 只印出錯誤但不檢查
      answer: 0
      explain: 縮小範圍可避免別處拋錯使測試意外通過。
practice:
  - id: fd-tools-06-p1
    kind: hands-on
    title: 寫出第一個會失敗的退款測試
    minutes: 8
    steps:
      - 跑完正文，故意把退款分支改成回傳正數。
      - 跑測試確認失敗，再還原函式。
    checks:
      - 退款測試顯示實際值 150、預期 -150。
      - 還原後 3 個測試通過，無需開任何訂單檔。
---

## 把退款符號交給測試守住

退款明細寫的是正的 150 分，計入淨額時必須是 -150。若寫入報表後才驗，還得準備檔案、找哪一列出錯。單元測試（unit test）先直接問一小段程式：「給這個值，回傳什麼？」留出單獨的函式，讓測試不用發送請求或讀整份檔案。

## 語法速查

用標準函式庫 `unittest`，不必額外安裝套件。`class TestMoney(unittest.TestCase):` 表示測試類別沿用框架提供的斷言（assertion）；這種沿用行為叫繼承（inheritance）。方法名稱以 `test_` 開頭，執行器才會找它。`self.assertEqual(actual, expected)` 驗值；`with self.assertRaises(ValueError):` 驗縮排內的操作是否擲出指定例外。沒有發生或是別類例外都不能通過。

## 建立一個函式，驗三種結果

在 `C:\dev\conduit-lab\tools` 存 `money_rule.py`：

```python
def signed_amount(kind, cents):
    if cents <= 0:
        raise ValueError("cents must be positive")
    if kind == "sale":
        return cents
    if kind == "refund":
        return -cents
    raise ValueError("unknown kind")
```

同一層存 `test_money_rule.py`。本例函式的呼叫者須先把檔案文字轉為整數；測試的是收到整數後的規則，不是整個 CSV 驗證。

```python
import unittest
from money_rule import signed_amount

class TestMoney(unittest.TestCase):
    def test_sale(self):
        self.assertEqual(signed_amount("sale", 800), 800)

    def test_refund(self):
        self.assertEqual(signed_amount("refund", 150), -150)

    def test_zero(self):
        with self.assertRaises(ValueError):
            signed_amount("sale", 0)
```

在同一層執行 `py -m unittest -v test_money_rule`，應看到 3 項與 `OK`。把退款的 `return -cents` 暫改成 `return cents`，再跑一次，退款測試應失敗，其他兩項仍通過。測試消息若指出 `150 != -150`，你就知道是符號，不需在多份輸出找差額。還原修正後再驗通過。這種刻意把關鍵規則改壞一次的做法，可以檢查測試是不是真的會抓錯。

### 測試要比「沒報錯」再多一步

給一筆退款，先自己在紙上寫出負號，再把答案放進測試。不能用同一個待測函式回推預期值，那等於問兩次同一個人，出錯也會一致。金額大小和正負是兩個可獨立出錯的面向；先用 `assertEqual` 驗精確值，等要測缺欄與讀檔才另外加案例。這堂不把所有輸入都混在同一個長測試，失敗時可看案例名稱判斷哪條規則沒守住。

這個測試專門驗「轉成整數後」的業務規則，所以輸入 0 用整數，不用金額字串。若寫 `"0"`，比較運算可能因類型不同失敗，測到的是呼叫慣例沒遵守，而不是金額規則。一個好反例應該只改所要測的條件；這是只改退款分支、其他條件不變的理由。

暫改符號只是本地可還原的試驗。它讓你看到「測試跑起來」與「真的有辨識力」不是同一回事。如果測試在改錯後還是全綠，先核對正在執行的檔名、函式和斷言。遇到需要固定檔案或跨月數據的範例，下一堂[〈固定測資〉](#/lesson/fd-tools-07)會把這些起點交給每次測試各自準備。

還可加一個未知類別的斷言，確定它不會默默走成付款。這與退款的負號是不同規則，分開命名便能直接從失敗項目看出問題。

## 常見錯誤

- 執行後沒有測試：核對名稱以 `test_` 開頭，從兩個檔案所在目錄用 `-m unittest`。
- 只檢查回傳不是 `None`：即使金額符號錯也通過，應用可手算的預期值。
- 把讀檔放進預期例外區塊：可能錯在準備而不是運算，範圍縮到一次待測呼叫。
