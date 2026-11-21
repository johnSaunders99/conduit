---
id: fd-algo-02
module: fd-algo
order: 2
title: 陣列與鏈結列表
subtitle: 插入與查找哪個較貴
status: ready
minutes: 30
level: 2
prereqs:
- fd-algo-01
objectives:
- 比較 Python list 直接索引與節點查找
- 用先接後段再改前驅的順序插入節點
tags:
- 陣列
- 鏈結列表
- 索引
- 插入
resources:
- title: Open Data Structures
  url: https://opendatastructures.org/ods-python/
  kind: book
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 對照 Array-Based Lists 與 Linked Lists。
concepts:
- id: fd-algo-02-index
  prompt: 為何鏈結列表不能用索引定位任意格？
  answer: 節點只知道下一站，沒有按索引直接定位的格子。
  mcq:
    question: 讀取第 800 格時，哪個可以直接索引？
    options:
    - Python list
    - 只有頭節點的單向鏈結列表
    - 只有尾節點的單向鏈結列表
    - 兩者都必須從頭掃
    answer: 0
    explain: 陣列能從位置找到格子；單向鏈結即使知道尾端也不提供任意定位。
- id: fd-algo-02-rewire
  prompt: 插入節點時為何先接住後段？
  answer: 先蓋掉前驅的 next 又沒有保留參照，原後段就無法從頭到達。
  mcq:
    question: 手上已有 A，現在 A → C，如何插入 B？
    options:
    - 只令 B 指向 A
    - 只令 A 指向 B
    - 先把 C 的下一站改成 B
    - 先令 B 指向 C，再令 A 指向 B
    answer: 3
    explain: 要保留前段入口與後段路徑；只改 A 會斷開 C。
- id: fd-algo-02-predecessor
  prompt: 已知前驅與只知目標 ID 時，刪除成本有何不同？
  answer: 已知前驅時只改參照是 O(1)；按 ID 找前驅最壞 O(n)。
  interview:
    question: 匯入後經常要讀某一列，你會改用鏈結列表嗎？
    answer: 我先用 Python list，因為按位置讀最常見。若中段改動才是主要成本，而且已有修改位置的參照，我才考慮鏈結結構；還要量找位置的代價。
    points:
    - 指出主要操作
    - 分清定位與修改
    - 不只背複雜度
practice:
- id: fd-algo-02-p1
  kind: code
  minutes: 8
  title: 把補送批次插在中間
  steps:
  - 執行 batch_chain.py，畫下三節點的順序。
  - 在腳本末尾練習略過 replay，把前驅的下一站改成 follow-up。
  checks:
  - 插入後顯示 initial、replay、follow-up。
  - 略過後仍走得到 follow-up。
---

## 報表要第幾列，還是下一批？

拿到已解析的訂單，你可能要直接看第 900 筆，也可能要把一個補送批次插進已知的節點之後。選數據結構（data structure）要先問哪種動作反覆發生。陣列（array，中國大陸多稱數組）是按位置安排的格子；Python 的 `list` 是可變長度的陣列式容器，格子放的是物件參照（reference），不代表每份訂單物件都連續存放。用 `rows[i]` 能直接定位；在中間插入時，後面許多參照要挪位置。

鏈結列表（linked list，中國大陸多稱鏈表，台灣也稱鏈結串列）用節點（node）保存內容與下一站。起點叫頭節點（head）；尾端的下一站是 `None`。只有頭節點時，要走過前面的每站才能看到後面。若已握有插入位置的前一站，稱為前驅（predecessor），插入只須改固定幾個參照。差別在於有沒有先付尋找位置的成本。

## 先接後段，再改前驅

在 `C:\dev\conduit-lab\algorithms` 存 `batch_chain.py`，於該資料夾執行 `py batch_chain.py`。用字典表示節點，不必先學類別。`first["next"]` 留住的是下一個字典本身，不是下一個批次的文字編號。

```python
def walk(head):
    ids = []
    while head is not None:
        ids.append(head["id"])
        head = head["next"]
    return ids

last = {"id": "follow-up", "next": None}
first = {"id": "initial", "next": last}
patch = {"id": "replay", "next": first["next"]}
first["next"] = patch

assert walk(first) == ["initial", "replay", "follow-up"]
print(walk(first))
```

原本 initial 指向 follow-up。新進 replay 先把 follow-up 當下一站，再把 initial 改連 replay；所以頭節點仍能到達原來的尾端。若要刪 replay，把 initial 的下一站改成 replay 原先的下一站即可。若題目只給 replay 的 ID，就得走訪才能找到前驅；不可把改線的常數成本當成整題答案。本例只處理一條不成環的鏈；若下一站指回已經過的節點，走訪不會碰到尾端。之後在〈[圖的循環檢查](#/lesson/cr-code-05)〉會細講如何辨認循環。

把操作放回實際讀寫：Python list 尾端加入通常很便宜，偶爾擴充時要搬參照，所以說均攤（amortized）常數，而非每次都同樣快。鏈結節點還得分別存內容與連線；用字典教節點，不代表它在實作中比 list 更省空間。如果工作是讀完一筆就交給下一步，還可以不把整份檔案收成任一容器；〈[串流 Top K](#/lesson/cr-code-04)〉會用到逐值交付。要找任意 ID 而非第幾格，則可從〈[雜湊與集合](#/lesson/fd-algo-03)〉選另一種工具。

### 把「插入」拆成兩步估

用紙畫三個方格與三個分開的節點。要求把批次加在中間時，先從左數到指定位置，再記下需要搬動或改線的格子。陣列版可以立即定位，但插到第一格時，後面所有元素都得挪；鏈結版若知道的是序號，就得先一路走到前區段。尾端追加也要問手上有沒有尾端參照，光有頭節點並不能立刻碰到尾端。

如果範例要反覆取第 0 格，取 list 的格子不會搬動數據；刪第 0 格才會。不要把「讀」「插」「刪」混為同一種開銷。當對方說要頻繁在兩端取值，這又是不同需求，〈[堆疊與佇列](#/lesson/fd-algo-05)〉會用專門支援兩端操作的容器。

## 常見錯誤

- 插入後只剩 initial、replay → 舊的下一站被蓋掉 → 先用原連線建立 replay 的下一站。
- 忘了空串列 → 把 `None` 當字典取鍵會報錯 → 走訪前先檢查是否還有節點。
- 說陣列永遠固定長度 → 把 Python list 與固定陣列混為一談 → 說明容器可擴充且中段要移動參照。
