---
id: fd-data-06
module: fd-data
order: 6
title: 參數與預設值
subtitle: 下一批不要沿用上一批的名單
status: ready
minutes: 30
level: 1
prereqs:
  - fd-data-05
objectives:
  - 使用位置、關鍵字及預設引數呼叫同一函式
  - 用兩次呼叫重現共享列表
  - 用 None 區分未傳值與傳入空列表
tags:
  - 引數
  - 預設值
  - 可變物件
  - 作用域
resources:
  - title: Python 教學：預設引數值
    url: https://docs.python.org/3/tutorial/controlflow.html#default-argument-values
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看預設值求值時機與 None 寫法。
concepts:
  - id: fd-data-06-arguments
    prompt: 位置與關鍵字引數如何配到參數？
    answer: 位置按位置，關鍵字按參數名稱。
    mcq:
      question: '`record("O21", bad= [])` 的 `bad=` 是什麼？'
      options:
        - 建立任何函式外的 bad 變數
        - 把參數改有預設值
        - 指定要配對的參數名稱
        - 自動清空函式的所有列表
      answer: 2
      explain: 這只是此次呼叫傳值，沒有重新定義函式。
  - id: fd-data-06-default
    prompt: 省略引數時，列表預設值何時建立？
    answer: 函式定義執行時建立，不是每次呼叫。
    mcq:
      question: 第二批省略 bad 卻出現第一批，最可能的原因？
      options:
        - 函式沒有自己的區域名稱
        - 列表每次呼叫自動複製
        - print 會把舊數據追加到列表
        - 預設列表被多次呼叫共用
      answer: 3
      explain: 每次有區域名稱，但可以都指向同一個物件。
  - id: fd-data-06-none
    prompt: 為什麼改用 `if bad is None:`？
    answer: 缺省才建新列表，保留明確傳入的空列表。
    mcq:
      question: 把條件改成 `if not bad:` 會破壞哪個情境？
      options:
        - 呼叫者傳入空列表要求沿用
        - 省略 bad
        - 傳入已有項目的列表
        - 把訂單用關鍵字傳入
      answer: 0
      explain: 空列表也是假值，會被錯認為沒有傳入。
  - id: fd-data-06-scope
    prompt: 呼叫者給一個列表，函式 append 後誰看得到？
    answer: 呼叫端也看得到；兩個名稱可指向同一個列表。
practice:
  - id: fd-data-06-p1
    kind: hands-on
    title: 防止拒收清單串批
    minutes: 8
    steps:
      - 用不同訂單連續呼叫正確版 2 次並比較回傳值。
      - 傳入自備的空列表，把判斷暫改成 not，再還原。
    checks:
      - 每次省略引數只記該次訂單。
      - 還原 is None 後，自備空列表收到新增項目。
---

## 第二批為什麼帶著第一批？

寫一個記錄拒收訂單號的函式。第一次沒有給拒收清單，記了 O21；第二次也沒有給清單，卻看見 O21 和 O22。先別懷疑 CSV 多讀了一行。這次的問題是函式預設參數裡的一個列表被重用了，兩批工作碰到同一個可變物件（mutable object）。

## 語法速查

定義裡的 `order_id`、`bad` 叫參數（parameter），呼叫時傳入的值叫引數（argument）。`record("O21")` 用位置引數；`record(order_id="O21")` 用關鍵字引數（keyword argument）；`def record(order_id, bad=None):` 提供第 2 個參數的預設值（default argument value）。在本例，不能同時為同一參數用位置和名稱各給一個值。

作用域（scope）說的是名稱在哪裡可見，不代表該名稱指向的物件只屬於那一次呼叫。預設值在執行 `def` 定義時求值。若預設是一個列表，省略引數的呼叫可以反覆指向那同一個列表。`None` 是 Python 明確表示沒有值的物件；這裡用它代表沒傳清單。

## 刻意跑錯版和修正版各兩次

在 `C:\dev\conduit-lab\python-data` 存 `reject_defaults.py`，執行 `py reject_defaults.py`。

```python
def leaky(order_id, bad=[]):
    bad.append(order_id)
    return bad

def record(order_id, bad=None):
    if bad is None:
        bad = []
    bad.append(order_id)
    return bad

print(leaky("O21"))
print(leaky("O22"))
print(record("O21"))
print(record(order_id="O22"))
review_queue = []
record("O23", bad=review_queue)
print(review_queue)
```

故意有錯的版本第二次會得到 `['O21', 'O22']`；修正後的第二次只剩 `['O22']`。最後呼叫時我們明確要求沿用一個列表，所以外面的 `review_queue` 應變成 `['O23']`。這不是偶然：函式內外有不同名稱，但都能看到同一個列表被追加。如果不想修改呼叫端提供的清單，那是另一個契約，應在函式內先複製再追加，而不是藏在預設值裡。

試著只把 `is None` 改成 `not bad`，修正版前兩次可能看不出差異，但外部的空清單不再被追加。要驗收一個函式，不只測「沒有給」，也要測「有給但剛好是空的」。判斷名稱在哪裡可見和物件何時被建立，是兩個不同的問題。

### 哪些預設值可以直接寫？

像固定的門市字首、最多顯示 5 筆這類不可就地修改的值，可以直接當預設值。上面的問題不是「有預設值就危險」，而是把需要獨立的一份工作狀態當成能安全共用的值。先問業務需要的是「每批從空白開始」還是「在同一份清單上累加」。即使兩個呼叫在同一個終端連續跑，前者仍要彼此隔開；如果每次都重開 Python，錯誤版也可能看起來正常，因為整份定義重建了。

把 `record("O21", bad=review_queue)` 當作「這次用我手上的清單」。既然是呼叫端刻意提供，就要明訂函式會不會修改它。練習時用空列表能驗到這個邊界，另用已有 "O20" 的列表則能確認舊項目仍在。這兩次驗收比只看第二次印了多少筆更能保護真正的使用方式。

還可以核對函式回傳值：呼叫者主動傳的列表和回傳的列表內容一致。這讓接手的人知道應當期待哪一份清單被更新。

## 常見錯誤

- 以為區域名稱一定隔離：名稱是每次的，指向的列表卻可以共用；改成每次需要時建立。
- 把空列表當缺省：改用 `is None` 才能沿用傳入的空列表。
- 希望呼叫者不受影響卻直接追加：先決定要共享還是複製，再把該規則寫進函式說明。
