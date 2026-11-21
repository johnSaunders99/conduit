---
id: fd-data-01
module: fd-data
order: 1
title: 切片與元組
subtitle: 保留不該被改動的欄位對
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - 取出列表的指定區間與尾端預覽
  - 用元組保留欄位順序並拆給具名變數
tags:
  - 切片
  - 元組
  - 拆包
  - 複合鍵
resources:
  - title: Python 教學：列表
    url: https://docs.python.org/3/tutorial/introduction.html#lists
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀負索引與切片上界的圖解。
  - title: Python 教學：元組與序列
    url: https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看單項元組的逗號與拆包的項數。
concepts:
  - id: fd-data-01-slice
    prompt: '`rows[1:3]` 會取哪些位置？'
    answer: 取索引 1 和 2，不包含 3。
    mcq:
      question: 想取索引 0、2、4，寫哪個？
      options:
        - '`rows[::5]`'
        - '`rows[:5:2]`'
        - '`rows[1:5:2]`'
        - '`rows[:4:2]`'
      answer: 1
      explain: 步長是 2，從預設的 0 開始；上界 5 才包含 4。
  - id: fd-data-01-tuple
    prompt: 如何寫只有一個訂單號的元組？
    answer: '`("O21",)`；逗號不可省。'
    mcq:
      question: 哪個才是單項元組？
      options:
        - '`("O21")`'
        - '`["O21"]`'
        - '`("O21",)`'
        - '`"O21", "O22"`'
      answer: 2
      explain: 只用括號仍是字串；方括號得到列表；兩個值不是單項。
  - id: fd-data-01-unpack
    prompt: '`store, order = pair` 按什麼規則指定？'
    answer: 依右邊的項目順序，不會看欄位名稱。
    mcq:
      question: 把三項元組拆到兩個變數（沒有星號）會怎樣？
      options:
        - 忽略第 3 項
        - 把後 2 項合併到第二個變數
        - 左邊變數的名稱決定丟哪個欄位
        - 出現 `ValueError`
      answer: 3
      explain: 普通拆包要求項數相同。
  - id: fd-data-01-shallow
    prompt: 切片取得新列表，是否表示巢狀項目也複製了？
    answer: 不會；只複製外層列表，內層項目仍可能共用。
practice:
  - id: fd-data-01-p1
    kind: hands-on
    title: 保留訂單欄位對
    minutes: 9
    steps:
      - 執行範例，另外印出前 2 組鍵與最後 1 組鍵。
      - 加上來自 S02 的 O21，再比較最後 2 組。
    checks:
      - 前 2 組順序與來源相同；原始列表仍存在。
      - S01 的 O21 和 S02 的 O21 是兩組不同的鍵。
---

## 一個訂單號不一定夠

門市各自編號，S01 和 S02 都會出現 O21。如果用訂單號當身分，兩筆就可能被誤認成同一筆。這裡把「門市、訂單號」當一組複合鍵（composite key）：兩個欄位都相同才是同一組。先從最新一批取幾組供營運核對，不必更動原本的列表。

## 語法速查

延續[〈列表與索引〉](#/lesson/fd-python-08)：列表（list，台灣也稱串列）用索引取一項，切片（slice）取一段。`rows[start:stop:step]` 從 `start` 開始，在 `stop` 之前停下；本堂的預設正向步長是 1。`rows[:3]` 取開頭最多 3 項，`rows[-2:]` 取最後最多 2 項，`rows[::2]` 從索引 0 每隔一項取值。超出範圍的切片通常只取現有部分；單點索引超界才會報錯。

元組（tuple）用逗號組成，例如 `("S01", "O21")`；單項寫 `("O21",)`，空元組寫 `()`。元組的項目不能直接替換，但變數可以改指向新的元組。拆包（unpacking，台灣也稱解包）如 `store, order = rows[0]`，照位置配對；兩邊項數不同就會出現 `ValueError`，也就是值不符合操作要求。[〈例外與隔離〉](#/lesson/fd-io-07)會示範如何接住特定錯誤。

## 跑一次，對照兩端

在 `C:\dev\conduit-lab\python-data` 建立 `preview_orders.py`，於該資料夾執行 `py preview_orders.py`。本堂以 Windows PowerShell 示範；在 macOS／Linux，於自己的練習資料夾以 `python3 preview_orders.py` 執行 Python 腳本。

```python
orders = [("S01", "O21"), ("S02", "O21"), ("S01", "O22"), ("S03", "O01")]
sample = orders[1:3]
for store, order in sample:
    print(f"{store}: {order}")
print("last:", orders[-2:])
print("total:", len(orders))
```

中間區間應印出 S02 的 O21 和 S01 的 O22；尾端應有 O22 和 O01，總筆數仍是 4。故意把上界改成 2，只剩 S02 的 O21；這比記公式更容易感受到終點不包含在內。若來源少到只有一筆，`orders[-2:]` 仍會得到一個只含一筆的列表，不會補空值也不會報錯。寫預覽時可以接受，但日後若業務規格硬性要求 2 筆，仍要另檢查長度。

注意拆包只會按位置拿值。若某分店交換兩欄，程式可能仍印出兩個代碼；能跑不等於順序正確。拿一個你知道門市與訂單號的例子對照，而不是只看有沒有兩欄。下一堂[〈集合與去重〉](#/lesson/fd-data-02)會用這組鍵判斷重複。

### 預覽規則也需要反例

取最後 2 筆，不等於「最近 2 筆」。這裡假定來源已按到達順序排列；將第一筆移到末尾，結果就會變。如果需求為「按下單時間的最後 2 筆」，就不能背著業務假定列表的最後面一定最新，要先確認時間欄及排序規則。反過來，如果是在查匯入順序造成的錯帳，則保留收到的次序才對，不應先排序把現象蓋掉。

取樣時先寫出範圍，不要只寫「看幾筆」：`orders[:2]` 是開頭，`orders[2:]` 是跳過開頭 2 筆，`orders[-2:]` 是尾端。對只有一筆的列表，開頭和尾端預覽都指同一筆，不代表來源有兩筆。核對欄位身分與核對列表位置是兩件事；先定位一段，再逐筆讀出欄位，比同時猜索引和欄意安全。

元組鎖住欄位的排列，不會替你判斷輸入是對的。先用已知欄值抓順序錯誤，再選容器保存結果。

## 常見錯誤

- 想取前 3 筆卻只得到 2 筆：`[1:3]` 跳過了索引 0；改用 `[:3]`。
- 寫 `("O21")` 後看到字串：括號只分組；補上逗號才是元組。
- 修改預覽內的巢狀列表，來源也變了：切片只複製外層；這裡用字串元組，並讓有改動的鍵成為新元組。
