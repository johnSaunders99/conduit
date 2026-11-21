---
id: fd-tools-02
module: fd-tools
order: 2
title: 組合與責任
subtitle: 替換來源不用改寫整條管道
status: ready
minutes: 30
level: 1
prereqs:
  - fd-tools-01
objectives:
  - 把讀取來源與清洗規則分開
  - 替換來源而不改批次處理函式
  - 以一致輸入驗證替換結果
tags:
  - 組合
  - 責任分工
  - 介面
  - 數據管道
resources:
  - title: Python FAQ：委派
    url: https://docs.python.org/3/faq/programming.html#what-is-delegation
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看物件如何把工作交給另一個物件。
concepts:
  - id: fd-tools-02-boundary
    prompt: 誰負責知道檔名與編碼？
    answer: 來源物件；批次處理只需要取得一串記錄。
    mcq:
      question: 替換成檔案來源，最不應改哪個地方？
      options:
        - 來源如何讀取內容
        - 來源的初始化參數
        - 清洗同一格式代碼的規則
        - 實際準備的檔案
      answer: 2
      explain: 替換的是讀取方式，不是碼值規則。
  - id: fd-tools-02-contract
    prompt: 這兩種來源遵守同一個什麼約定？
    answer: 都提供 `read_rows()` 並回傳可依序走訪的字串。
    mcq:
      question: 新來源直接回傳未切行的整份字串，有何問題？
      options:
        - Python 會自動辨認成多筆門市碼
        - 不影響任何結果
        - 只會自動移除換行
        - 迴圈會按字元走訪，不符合逐列約定
      answer: 3
      explain: 兩個來源不只需方法同名，還要保持回傳內容的意義。
  - id: fd-tools-02-composition
    prompt: 這裡的組合為何不需要繼承？
    answer: 流程使用來源與解析器；替換來源不需要宣告來源是解析器的子類別。
    mcq:
      question: 哪句描述最符合本例？
      options:
        - 批次處理使用來源，也使用解析器
        - 檔案來源是一種解析器
        - 兩個來源都必須改成同一個類別
        - 解析器必須硬編碼某個來源
      answer: 0
      explain: 角色不同，各負責一段，再透過約定組起來。
practice:
  - id: fd-tools-02-p1
    kind: hands-on
    title: 換掉來源但留住清洗
    minutes: 8
    steps:
      - 照正文執行，再在 store_codes.txt 加上一行 p03。
      - 先只改文字檔，再讓 SampleSource 也交出 p03，分別看 same 欄。
    checks:
      - 一邊多一行時為 False；兩邊一致後回到 True。
      - 不修改 Parser 或 run 函式。
---

## 換來源，不用重寫管道

測試時想拿 2 筆小樣本，實際跑時要從檔案讀。若把讀檔、清洗和輸出塞進同一個類別，一換來源就得改運算那部分。組合（composition）是在流程裡使用各做一件事的元件：讀取者供應記錄，解析器依設定清洗，流程只負責把兩者接起來。

## 約定比類別名稱重要

介面（interface，大陸常稱接口）是呼叫雙方同意的用法。沒有新語法：這裡只約定來源有 `read_rows()`，傳回一串可依序走訪的字串；解析器有 `parse(raw)`，回傳清洗後的代碼。流程不知道來源是列表或文字檔，也不問解析器的前綴。不需要為了讓方法同名而寫「來源繼承解析器」；那會誤把兩種不同責任當成同一種東西。

明確約定每一項是一整筆門市碼，不是單個字元，也不是整份檔案。若換來源時輸入格式也變了，那是另一項變更；要先在來源端做必要轉換，或把改動寫成新契約，不讓下游偷偷接收另一種值。

## 讓兩個來源輸出一樣

沿用[〈物件與方法〉](#/lesson/fd-tools-01)的 `C:\dev\conduit-lab\tools\tag_parser.py`。在同層存 UTF-8 的 `store_codes.txt`：

```text
 p02
p01
```

在同層存 `compose_batch.py`，執行 `py compose_batch.py`。

```python
from tag_parser import Parser

class SampleSource:
    def read_rows(self):
        return [" p02", "p01"]

class TextSource:
    def __init__(self, filename):
        self.filename = filename

    def read_rows(self):
        with open(self.filename, encoding="utf-8") as file:
            return file.read().splitlines()

def run(source, parser):
    return [parser.parse(raw) for raw in source.read_rows()]

parser = Parser("POS")
sample_rows = run(SampleSource(), parser)
file_rows = run(TextSource("store_codes.txt"), parser)
print(file_rows)
print("same:", sample_rows == file_rows)
```

結果為 `['POS:P02', 'POS:P01']` 和 `same: True`。只在檔案多加一筆時會變成 `False`，說明不是用同一份結果和自己比。這份短程式仍一次讀完文字；若改成大型日誌，[〈迭代器與生成器〉](#/lesson/fd-tools-03)會示範不先把整份來源載入記憶體。

設計分工不意味每一步都得造類別。這裡 `run` 只是連接兩個角色，用普通函式已夠。先守住輸入與輸出的責任邊界，再考慮哪種形式更好讀。

### 逐一替換，才知道責任切對了沒有

先只換來源而保留同一個 `parser`，兩個輸出應一致。反過來，用同一份 `SampleSource`，讓解析器前綴從 POS 換成 WEB，輸出應只改前綴。這兩次試驗刻意只變一件事；若換來源時結果也變了，先看來源交來的字串，若換解析器時竟影響讀檔位置，便表示責任還混在一起。

要不要讓兩個來源共同繼承另一個類別，不是這堂的起點。只要它們都遵守相同的方法和數據約定，`run` 便能使用。測試時可在記憶體輕易建立來源，實際工作才需要處理檔案路徑或編碼。未來新增從 CSV 取出單欄的來源，先把新來源自己驗一遍，再用相同兩筆記錄經過 `run` 檢查結果。這比把每種來源分別抄一套處理流程方便，也保留「哪一段先壞」的診斷線索。

當兩種來源的值要一致時，也要同意先後是否重要。本例保留原始順序，正好可以直接比較兩個結果列表。

## 常見錯誤

- 換來源時改動清洗邏輯：檢查新來源有沒有維持逐列字串的約定。
- 把整個文字檔傳回，輸出變成一字一筆：用 `splitlines()` 或逐行走訪。
- 在 `run` 裡重新建立寫死路徑的來源：應使用呼叫者傳入的來源，才真的可換。
