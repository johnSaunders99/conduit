---
id: bd-lake-06
module: bd-lake
order: 6
title: Delta 交易日誌
subtitle: 從提交記錄解讀表狀態
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-05
objectives:
  - 重建 Delta 指定版本的有效數據檔集合
  - 區分交易日誌的檢查點、移除標記與實體檔清理
tags:
  - Delta Lake
  - 交易日誌
  - add
  - remove
  - 檢查點
resources:
  - title: Delta Lake：交易日誌協定
    url: https://github.com/delta-io/delta/blob/master/PROTOCOL.md
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看 add、remove 及日誌檢查點。
concepts:
  - id: bd-lake-06-actions
    prompt: Delta 版本 1 移除 A、加入 B，讀者要同時讀 A、B 嗎？
    answer: 不。針對同一邏輯檔識別，重建到版本 1 後只讀仍有效的 B。
    mcq:
      options:
        - 兩個都要讀，因為都存在
        - 只讀仍有效的 B
        - 只讀 A，因為 A 較早
        - 兩個都刪掉再讀
      answer: 1
      explain: 日誌決定邏輯可見性，物理存在不是唯一依據。
  - id: bd-lake-06-checkpoint
    prompt: Delta 日誌檢查點解決的是什麼？
    answer: 縮短表狀態重建；從可用檢查點開始，再套用後續版本。
    mcq:
      options:
        - 縮短表狀態重建
        - 保存 Flink 算子狀態
        - 讓歷史永不過期
        - 保證忽略後續交易
      answer: 0
      explain: 檢查點輔助讀日誌，不會取代後續交易或保留策略。
    interview:
      question: 有人直接用 Parquet 掃 Delta 目錄，比表多了列，你怎麼查？
      points:
        - 固定表版本
        - 核對 add/remove 和刪除向量
        - 使用支援協定的讀取器
      answer: 我會先固定表版本，查哪些檔在那版有效，再確認有沒有需要套用的刪除向量。直接讀目錄容易把舊檔或未提交檔算進去，不可把結果當 Delta 表。
  - id: bd-lake-06-vacuum
    prompt: remove 已生效，何時可能無法時間旅行？
    answer: 當保留窗之外的歷史實體檔或必要日誌被清理後，舊版本可能不再可讀。
    mcq:
      options:
        - 僅因有人讀過新版本
        - 立即因 remove 發生
        - 歷史必要檔案或日誌不再保留時
        - 從來不會
      answer: 2
      explain: 邏輯移除不必立刻刪物件，但時間旅行需要回讀所需的日誌和檔案。
practice:
  - id: bd-lake-06-p1
    kind: code
    title: 保存三個版本的有效檔名
    minutes: 10
    steps:
      - 執行 delta_log.py，把完整輸出存到 delta-note.txt。
      - 新增版本 3：移除 C、加入 D，預測並比較版本 2 與 3。
    checks:
      - 原結果依序是 A、B、B 加 C。
      - 加版本 3 時版本 2 仍是 B 加 C，版本 3 是 B 加 D。
---

## 原始目錄有 3 個檔，為何表只讀 2 個？

團隊把錯價的檔案 A 替換為 B，隔天再加 C。物件儲存上 A 可能仍在，方便保留窗內的舊讀者回去查；直接掃目錄卻會把舊價再算一次。Delta Lake 的交易日誌（transaction log）放在 `_delta_log`，已發布的版本記錄操作，例如 `add` 加入有效的檔案引用，`remove` 標記某引用不再用於新版本。讀者固定某個版本並重建其狀態，不是按照檔案最後修改時間猜哪些較新。協定還追蹤表元數據與功能相容性；需要刪除向量（deletion vector）時，即使數據檔有效，也得排除被標記的列。

版本 0：加入 A。版本 1：在**同一次**提交移除 A 並加入 B；沒人應看到只移除、還未加入的中間態。版本 2：加入 C。若檔 B 已寫好但版本 1 尚未發布，表仍以版本 0 的狀態對外。交易成功標誌是協定中的已發布版本，而不是某次上傳順利完成。

## 用最小日誌重建有效集合

在 `C:\dev\conduit-lab\lake` 存 `delta_log.py`，PowerShell 執行 `py delta_log.py`（WSL 2 用 `python3 delta_log.py`）。可用 RAM 0.25 GB。它只示範以不同檔名識別的增刪，不是能讀 Delta 的引擎，也不模擬刪除向量或物件儲存的並發提交。

```python
log = [
    [("add", "A")],
    [("remove", "A"), ("add", "B")],
    [("add", "C")],
]
active = set()
for version, actions in enumerate(log):
    next_active = active.copy()
    for op, name in actions:
        if op == "add":
            next_active.add(name)
        else:
            next_active.remove(name)
    active = next_active
    print(version, sorted(active))
```

日誌越長，從版本 0 開始套用越貴。Delta 的日誌檢查點（checkpoint）把可重用的表狀態整理成一個起點；讀版本 2 時，若可用檢查點在版本 1，先載入它再套用版本 2。這裡的檢查點不是 Flink 的來源位置與算子狀態。時間旅行能否工作，還要看舊版本需要的日誌與實體檔有沒有保留；`VACUUM` 等清理不應只是為了讓目錄數看起來好看。跨工具讀取前，尤其要核對讀取器是否支援該表啟用的協定功能。

## 同時留下日誌版本及讀取工具

交班時先記下讀取器版本、表版本及有沒有啟用需要特定讀取支援的功能。另一組同事若直接讀檔，就算兩份丟出的列數恰好一樣，也可能一份漏了有效列又把舊列算回來。可以先挑被替換的檔 A 做反例：對照版本 0 和 1 中一個確定更正的鍵，核對出現次數及金額。不要拿目錄清單當哪個版本的證據。若檔還在、但對應的歷史日誌已經不夠，不能自行重建它應屬哪個快照；改查先前留存的報表或明說無法驗證。這一點和 Iceberg 都是「元數據決定可見性」，只是 Delta 用依版本套用的日誌動作表示，不是同一套檔案協定。

再把模型的檢查點設在版本 1，直接由集合 B 開始套版本 2；兩條路都應得到 B、C。這是重建路徑的核對，不是改動表版本。

## 常見錯誤
- 報表比同行查到更多列 → 直接掃 Parquet → 以支援該協定的 Delta 讀取器重查同一版本。
- 日誌只從最新 JSON 開始讀 → 漏了之前生效的檔 → 從有效檢查點或必要起始版本重建。
- 以為 remove 會即時註銷實體檔 → 混淆邏輯與物理 → 另看保留策略與維護紀錄。
