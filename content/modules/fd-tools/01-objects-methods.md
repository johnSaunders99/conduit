---
id: fd-tools-01
module: fd-tools
order: 1
title: 物件與方法
subtitle: 讓解析器帶著自己的設定
status: ready
minutes: 30
level: 1
prereqs: []
objectives:
  - 寫出帶設定的類別與實例方法
  - 驗證兩個解析器各使用自己的設定
tags:
  - 類別
  - 實例
  - 方法
  - self
resources:
  - title: Python 教學：類別物件
    url: https://docs.python.org/3/tutorial/classes.html#class-objects
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 看實例建立、初始化與方法如何接收 self。
concepts:
  - id: fd-tools-01-instance
    prompt: 類別與實例有何不同？
    answer: 類別是定義，實例是依這份定義建出的個別物件。
    mcq:
      question: 想讓兩個解析器有不同前綴，應存在哪？
      options:
        - 同一個共用的全域變數
        - 各實例的 `self.prefix`
        - 寫死在 parse 裡
        - 終端的工作目錄
      answer: 1
      explain: 各實例能有各自的屬性，不需要共用設定。
  - id: fd-tools-01-init
    prompt: '`__init__` 何時執行？'
    answer: 通常在呼叫類別建立實例後，初始化該實例的設定。
    mcq:
      question: 呼叫 `Parser("POS")` 時，`"POS"` 對到什麼？
      options:
        - self 參數
        - 方法名稱
        - 自己定義的 prefix 參數
        - 回傳值
      answer: 2
      explain: Python 自動傳實例給 self，POS 傳給下一個參數。
  - id: fd-tools-01-method
    prompt: 為何 `parse` 宣告有 self，呼叫時不手動傳？
    answer: 用實例呼叫方法時，Python 會把該實例放進第一個參數。
    mcq:
      question: '`pos.parse(" p01 ")` 的 self 指誰？'
      options:
        - 類別的名字
        - 字串 `" p01 "`
        - 最後建立的任何解析器
        - '`pos` 指向的實例'
      answer: 3
      explain: 呼叫點的實例決定這次要讀哪份狀態。
practice:
  - id: fd-tools-01-p1
    kind: hands-on
    title: 留下兩種門市標記的解析結果
    minutes: 8
    steps:
      - 執行範例，再新增前綴為 LAB 的實例。
      - 在建立 LAB 前後各呼叫一次 POS 解析器。
    checks:
      - LAB 輸出以 LAB 開頭；POS 兩次都相同。
      - 不需改寫已有的 parse 方法。
---

## 同一個規則，兩份設定

門市機和網路表單各傳來 `p01`，下游要分辨來源。規則相同：去空白、大寫、加來源前綴；不同的是每個解析器拿到的前綴。當設定只有一個且只用一次，傳參數給函式就夠；當一個解析器會重複處理多列、希望始終帶著同份設定，就可以讓設定和操作住在同一個物件（object，大陸稱對象）裡。

## 語法速查

- `class Parser:` 定義類別（class，大陸稱類），也就是一種物件的規格；`Parser("POS")` 建立一個實例（instance）。
- `def __init__(self, prefix):` 是初始化方法。`self.prefix = prefix` 把傳入值存成該實例的屬性（attribute），不是函式呼叫結束便消失的區域名稱。
- `def parse(self, raw):` 定義實例方法（instance method）；`pos.parse(" p01 ")` 呼叫時 Python 自動把 `pos` 放入 `self`，只需再傳 `raw`。
- `self.prefix` 從目前物件讀設定；若只寫 `prefix`，那不是同一個名稱，方法內不會自動找到初始化時的參數。

如果教科書常用「類別是一種藍圖」來比喻，這裡更具體：同一份解析方法供兩個實例使用，但 POS 和 WEB 各有自己的前綴。下一堂[〈組合與責任〉](#/lesson/fd-tools-02)會把解析器交給別的物件使用，讓它不必知道設定如何保存。

## 觀察同一代碼從兩條入口流入

在 `C:\dev\conduit-lab\tools` 存 `tag_parser.py`，執行 `py tag_parser.py`。

```python
class Parser:
    def __init__(self, prefix):
        self.prefix = prefix

    def parse(self, raw):
        return f"{self.prefix}:{raw.strip().upper()}"

if __name__ == "__main__":
    pos = Parser("POS")
    web = Parser("WEB")
    print(pos.parse(" p01 "))
    print(web.parse(" p01 "))
```

先印 `POS:P01`，再印 `WEB:P01`。兩行字首不同、代碼相同，才能證明規則相同且設定彼此獨立。只印兩個不同代碼，則無法排除輸出差異只是輸入內容造成的。這個方法只回傳新字串，並不修改傳入值，也沒有建立檔案；因此別的程式可匯入它來組裝報表。

實例屬性不代表天生不可改。如果執行後手動指定 `pos.prefix`，之後這個實例會沿用新值。對重要的批次規則，最好從起點給定清楚設定並在整批維持不變，不依賴某一列處理時順便改寫。

### 何時只用函式就好？

如果來源的前綴每次都會變，或者每個來源只處理一筆，普通函式收兩個引數可能更明白。類別不是更高級的寫法；它適合把同一份設定用在一連串操作。用終端想像跑三次 POS，只在建立時提供一次字首，後面逐筆提供原代碼；如果程式每筆都重建一個設定完全相同的物件，就毋須期待能因此少寫什麼。

做一個負向核對：先短暫把初始化的賦值改成 `prefix = prefix`，你仍可建立實例，但呼叫方法時會找不到屬性。此時 Python 會以 `AttributeError` 表示取不到指定的物件屬性，還原 `self.prefix` 即可。這證明「傳入引數」與「替這個物件保存設定」是不同步驟；不是空白清洗規則出了錯。

透過實例取得方法和讀取字串屬性是兩個動作。前者要加括號才能執行，後者可以直接讀值。

## 常見錯誤

- 方法報引數數量不符：定義漏了 `self`，或呼叫時又手動多傳了一個實例。
- 找不到 `prefix`：初始化只寫區域名稱，改成 `self.prefix = prefix`，方法內也從 `self` 讀。
- 為每個來源重抄一個類別：先確認差別是否只有設定，用不同實例，不必複製整個方法。
