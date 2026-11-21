---
id: fd-tools-03
module: fd-tools
order: 3
title: 迭代器與生成器
subtitle: 不要一次讀滿記憶體
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-02
objectives:
  - 用 iter 與 next 觀察逐筆取值
  - 用 yield 篩出登入紀錄
  - 驗證同一生成器走完不能再讀
tags:
  - 迭代器
  - 生成器
  - yield
  - 惰性求值
resources:
  - title: Python 教學：迭代器
    url: https://docs.python.org/3/tutorial/classes.html#iterators
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看 iter、next 與 StopIteration。
  - title: Python 教學：生成器
    url: https://docs.python.org/3/tutorial/classes.html#generators
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看 yield 如何暫停並保留狀態。
concepts:
  - id: fd-tools-03-next
    prompt: '`next()` 對迭代器做什麼？'
    answer: 取下一個值並推進位置；用完時通常擲出 StopIteration。
    mcq:
      question: 指定 `next(iterator, None)` 且無剩餘時得到何者？
      options:
        - 最後一筆
        - 空列表
        - 重新開始的第一筆
        - None
      answer: 3
      explain: 第 2 個參數是耗盡時使用的預設值。
  - id: fd-tools-03-yield
    prompt: 含 yield 的函式被呼叫後何時開始執行內容？
    answer: 先產生生成器；被取值時才執行到 yield 或結束。
    mcq:
      question: 呼叫後不走訪，有讀檔嗎？
      options:
        - 本例尚未打開檔案
        - 只有讀第一行
        - 讀完整檔但沒輸出
        - Python 會在背景逐行讀
      answer: 0
      explain: 函式主體延後到下一個值被要求時才執行。
  - id: fd-tools-03-memory
    prompt: 逐筆處理如何避免把結果也全留在記憶體？
    answer: 邊讀邊輸出或更新摘要，不把所有 yield 的結果收成列表。
    mcq:
      question: 開始使用生成器後呼叫 list(...)，結果如何？
      options:
        - 每次只產生一筆且列表不保存
        - 剩餘輸出全部被收成列表
        - 原檔因此縮小
        - 迭代器每取一次自動重建
      answer: 1
      explain: 生成器節省來源的暫存，不會阻止呼叫端主動收集全部結果。
practice:
  - id: fd-tools-03-p1
    kind: hands-on
    title: 觀察生成器何時讀下一行
    minutes: 8
    steps:
      - 在合成日誌最後加入一行 LOGIN U04。
      - 依正文跑，依序核對 next、剩餘值和第二次走訪。
    checks:
      - 第一次仍先給 U01；剩餘增加 U04，不重讀 U01。
      - 耗盡後仍為空，重新建立才會重頭。
---

## 下一筆，等需要時才取

登入日誌一整天很大，但報表只想數登入次數。若讀完才算，就要先預留空間存所有列；其實每次看到一列，更新一次筆數就夠。迭代器（iterator）記住讀到哪，生成器（generator，台灣也稱產生器）可用簡單的函式語法逐筆交出符合條件的值。這是惰性求值（lazy evaluation）：需要下一筆時才往前讀。

## 語法速查

`iter(value)` 取得可逐筆取值的迭代器；`next(iterator)` 取下一筆，耗盡時擲出 `StopIteration`。`next(iterator, None)` 則在耗盡時回傳給定的預設值。`for` 會自行重複取值並在耗盡時停止。列表可以重新呼叫 `iter` 讀一遍；同一個已耗盡的生成器則不會自己倒帶。

含有 `yield value` 的函式被呼叫時先傳回生成器。第一次取值才跑進函式、到 `yield` 暫停；再取一次便從暫停處繼續。一般 `return` 是結束，不是暫時交出值。若迴圈中提早停止且不再使用這個打開檔案的生成器，可呼叫 `close()` 關閉；完整走完本例會離開 `with` 並關檔。

## 驗證讀取位置

在 `C:\dev\conduit-lab\tools` 存 UTF-8 的 `login_events.txt`：

```text
LOGIN U01
PING U01
LOGIN U03
```

同一層存 `scan_logins.py`，執行 `py scan_logins.py`。

```python
def login_ids(path):
    with open(path, encoding="utf-8") as file:
        for line in file:
            if line.startswith("LOGIN "):
                yield line.strip()[6:]

reader = iter(login_ids("login_events.txt"))
print("first:", next(reader, None))
print("rest:", list(reader))
print("exhausted:", list(reader))
print("count again:", sum(1 for _ in login_ids("login_events.txt")))
```

應依序看到 `U01`、`['U03']`、`[]`、`2`。`sum(1 for _ in …)` 表示每走過一筆只加 1，不建立列表；底線名稱只是我們不用該值的慣例。在範例裡收成列表是為了看位置與內容，真實大檔只需要計數時用最後一行的方式。逐行讀取仍需要存放當前行；也不等於任何後續運算都省記憶體，例如排序可能先把所有結果收起來。

### 分清楚數據量在哪一步增加

練習檔有 PING，不會成為輸出，但生成器仍然要讀到那一行，才知道得略過。生成器不是索引，不能直接跳往最後一筆。這裡節省的是同時留下多少記錄，不是保證磁碟讀取更少。若只能順序掃描，最後的總計仍必須走完來源才能確定；執行到一半就停止，拿到的是部分結果。

拿一張紙列出三個位置：未開始、剛返回 U01、走完全檔。呼叫函式時放在第一位置，`next` 把它推到第二位置，收集剩餘值後才到第三位置。若把第一個 `next` 拿掉，直接收集，就應該同時得到 U01 和 U03，不是增加了一筆來源，而是先前沒有單獨取走 U01。這個順序日後在排查「預覽第一筆後，完整匯入竟少一筆」時尤其好用。

逐筆輸出還有下游成本：如果你為了按用戶去重而記一個越來越大的集合，記憶體仍會隨不同身分增長。先算每一步要留下什麼，再決定用生成器還是短列表。小檔能直接印出核對，不代表大檔也該按同樣方式累積或列印。

## 常見錯誤

- 印出生成器物件卻看不到登入 ID：要用 `next` 或 `for` 取值。
- 第二次走訪空白：原迭代器用完了；需要重算時重新開來源。
- 把 `yield` 全收進列表仍用很多記憶體：只計數就逐筆累計，不收集整份結果。
