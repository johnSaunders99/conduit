---
id: fd-data-07
module: fd-data
order: 7
title: 模組與匯入
subtitle: 兩份腳本共用同一個清洗函式
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-06
objectives:
  - 從同資料夾匯入共用清洗函式
  - 用入口判斷隔開直接執行與匯入行為
  - 驗證兩支腳本採用同一條清洗規則
tags:
  - 模組
  - import
  - 入口函式
  - 重用
resources:
  - title: Python 教學：模組
    url: https://docs.python.org/3/tutorial/modules.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 看匯入、模組名稱與直接執行的差異。
concepts:
  - id: fd-data-07-import
    prompt: 模組在這堂課指什麼？
    answer: 一個裝著可被匯入定義的 Python 檔。
    mcq:
      question: '`from normalize import store_code` 會在目前檔案取得何者？'
      options:
        - 只有檔名字串 normalize
        - 所有模組內的名稱
        - 一份獨立複製的 Python 檔
        - 名稱 `store_code` 對應的物件
      answer: 3
      explain: 指定匯入名稱不會把整個模組的名稱放進目前檔案。
  - id: fd-data-07-guard
    prompt: 什麼時候 `__name__ == "__main__"` 成立？
    answer: 檔案是直接執行的主程式時。
    mcq:
      question: 想阻止範例列印在匯入時出現，怎麼做？
      options:
        - 把列印放進主程式判斷內
        - 把 print 搬到檔案更上面
        - 改用 `from ... import ...`
        - 把函式名稱改成 main
      answer: 0
      explain: 使用哪種 import 都可執行模組頂層程式，仍要隔開入口。
  - id: fd-data-07-side-effect
    prompt: 為什麼不要在模組頂層寫出日報？
    answer: 匯入可能就執行頂層語句；呼叫者也許只想拿函式。
    mcq:
      question: 只想驗證可匯入且安靜，用哪個方法？
      options:
        - 只看檔名是否存在
        - 在同資料夾執行 `py -c "import normalize"`
        - 直接執行會印畫面的主程式
        - 改成兩邊各自複製函式
      answer: 1
      explain: 在新程序匯入才能看出頂層是否有輸出。
practice:
  - id: fd-data-07-p1
    kind: hands-on
    title: 讓日報與對帳共用清洗規則
    minutes: 9
    steps:
      - 先用原版命令跑兩支腳本及純匯入。
      - 把模組的 upper 改成 lower，再執行兩支腳本。
    checks:
      - 兩支輸出各依新規則變成小寫。
      - 純匯入時仍沒有輸出。
---

## 兩支程式，不要兩套門市代碼

日報先去掉空白再轉大寫，月底對帳的舊腳本卻只去空白，`s01` 和 `S01` 就被算成兩間門市。規則只有一句，卻不應該在每個入口各維護一份。把清洗放在同一個模組（module）中，兩份程式匯入（import，大陸也稱導入）同一個函式。

## 語法速查

- 檔名 `normalize.py` 對應模組名稱 `normalize`，匯入時不加 `.py`。
- `import normalize` 之後用 `normalize.store_code(...)`；`from normalize import store_code` 之後直接呼叫 `store_code(...)`。
- 模組被匯入時，頂層語句也會執行，例如定義函式與建立常數。若頂層直接讀檔、列印或寫數據，匯入時可能意外發生這些事。
- `if __name__ == "__main__":` 是入口判斷：直接執行時才走這一段，供別人匯入時只提供定義。入口也可只呼叫自己寫的 `main()`。

這堂課只處理同一資料夾的模組，不是下載第三方套件，也不用修改搜尋路徑。[〈虛擬環境〉](#/lesson/fd-tools-04)會處理不同專案需要不同套件的情況。

## 用同一條規則跑兩個入口

在 `C:\dev\conduit-lab\python-data` 存 `normalize.py`：

```python
def store_code(raw):
    return raw.strip().upper()

if __name__ == "__main__":
    print(store_code("  s01  "))
```

同一層存 `daily.py`：

```python
from normalize import store_code

print("daily:", store_code(" s01 "))
```

再存 `reconcile.py`：

```python
import normalize

print("reconcile:", normalize.store_code("s01 "))
```

在這一層執行 `py daily.py` 和 `py reconcile.py`，兩支各只印一行，最後都是 `S01`。`py normalize.py` 才會顯示清洗模組內的試跑行；`py -c "import normalize"` 成功時應不顯示任何內容。這 4 個指令區分「模組單獨驗收」「共用函式」「匯入沒有額外動作」，每個都測不同的事。

不是所有來源都該被轉大寫。這裡的門市代碼規格明確說大小寫不區分；如果供應商把 `s01` 和 `S01` 當兩個身分，就不能套同一條清洗規則。下次調整共用規則時，別只跑目前打開的腳本，把兩個入口一起驗，才能知道修改是否破壞另一份報表。

### 把規則和執行位置分開

模組裡的函式在開發階段可以直接試跑，並不表示每個檔案的頂層都安全可匯入。上面的 `daily.py` 和 `reconcile.py` 是薄薄的執行入口，直接印一行，就是它們的用途。假如另一支腳本以後也想匯入日報入口，才要把列印再整理到入口判斷；不要現在拆出一堆還沒使用的層次。這一課只要求「匯入共用規則不寫檔、不列印」。

試著將共用模組改回小寫，再猜哪個入口受影響：因為兩邊讀的都是同一份定義，理當都收到變更。若只有一個跟上，請先核對兩個入口實際呼叫的函式，再找是否保留了另一份手寫規則。清洗規則跟數據一樣需要單一可信來源，兩份看似相同的複製品日後仍可能各自變動。

這種分工也方便測試：載入模組後可以直接把原始代碼交給函式，不需先替它準備一份完整日報，也不會意外改到已保存的報表。

## 常見錯誤

- 匯入找不到模組：先核對檔名和同層位置，不要把 `.py` 寫進匯入語句。
- 日報不知為何多印一行：模組頂層試跑沒有隔開，搬進入口判斷。
- 匯入標準模組時載到自己的檔案：避免把練習檔取名為 `csv.py` 或 `json.py`。
