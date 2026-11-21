---
id: bd-lake-07
module: bd-lake
order: 7
title: Paimon 主鍵更新
subtitle: 把持續變動的流寫入湖
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-06
objectives:
  - 用來源序號與操作類型選出每個鍵的目前狀態
  - 解釋為什麼查詢快照與消費變更流不是同一件事
tags:
  - Paimon
  - 主鍵表
  - 更新插入
  - sequence.field
  - 刪除標記
resources:
  - title: Apache Paimon：合併引擎
    url: https://paimon.apache.org/docs/2.1/primary-key-table/merge-engine/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀 Deduplicate 的整列覆寫條件。
  - title: Apache Paimon：序號與列類型
    url: https://paimon.apache.org/docs/2.1/primary-key-table/sequence-rowkind/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 查 sequence.field、rowkind.field 與限制。
  - title: Apache Paimon：引擎套件
    url: https://paimon.apache.org/docs/2.1/project/download/
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: 2026-11-20
    note: 核對 Flink 與 JAR 的相容組合。
concepts:
  - id: bd-lake-07-key
    prompt: 同一訂單送兩次更新，主鍵表如何辨認應合併的列？
    answer: 用同一主鍵聚合版本，再按配置的合併引擎與順序選出邏輯結果。
    mcq:
      options:
        - 依各列的抵達日期分組
        - 依顯示的商品名分組
        - 依來源主鍵辨認同一列
        - 依數據檔大小比較
      answer: 2
      explain: 主鍵代表數據實體，時間只是決定版本的另一步。
  - id: bd-lake-07-sequence
    prompt: 較舊版本在新版之後才抵達，應採哪個？
    answer: 若已按可信來源序號排序，保留序號較新的版本，不以接收時間覆蓋。
    mcq:
      options:
        - 收得較晚的
        - 來源序號較新者
        - 較大的金額
        - 最後壓實的那筆
      answer: 1
      explain: 延遲到達不改變來源的先後。
    interview:
      question: 主鍵表做實時訂單同步，怎麼測刪單不復活？
      points:
        - 測同鍵舊更新遲到
        - 定義順序與平手
        - 區分選出的狀態與下游變更交付
      answer: 我會準備新增、更新、刪除再重送舊更新，先驗同一鍵最後仍不存在。順序用可靠的來源位置，平手要有規則；若下游要收到刪除，還要另驗變更流，不只查表末態。
  - id: bd-lake-07-rowkind
    prompt: 目前表沒有某鍵，能證明下游收過刪除嗎？
    answer: 不能；表的末態不代表某個寫端已得到並套用變更訊息。
    mcq:
      options:
        - 能，只要查出 0 列
        - 能，只要有主鍵
        - 不能，要另驗變更流與寫端
        - 能，只要用了 Flink
      answer: 2
      explain: 快照讀取與下游交付的觀察點不同。
  - id: bd-lake-07-ties
    prompt: 同一鍵的兩筆不同更新有完全相同的來源序號，先解決什麼？
    answer: 補上可追溯的平手欄位或辨認是否同事件重送，避免由抵達先後決定業務結果。
practice:
  - id: bd-lake-07-p1
    kind: code
    title: 把晚到的舊更新擋在表外
    minutes: 10
    steps:
      - 執行 primary.py，把快照與最後各鍵序號貼到 primary-note.md。
      - 在事件最後補鍵 7、序號 104 的合法重建，預測並驗證。
    checks:
      - 原本只有鍵 8；鍵 7 保留刪除版本 103。
      - 加合法重建後鍵 7 再出現，不能錯把永久禁用當成防舊數據。
---

## 主鍵相同，不代表後收到的就比較新

門市訂單 7 先開立、再付款、最後作廢。上游重送了較早的付款更新；若湖倉只看抵達順序，作廢單可能復活。Paimon 的主鍵表（primary-key table）把同一鍵的多筆變更合成一個邏輯結果。預設去重合併引擎（deduplicate merge engine）選排序後的最後版本；若來源允許亂序，可設定 `sequence.field` 用可信版本欄排序，並把刪除透過輸入的列類型（row kind）表示。序號若打平，最後順序仍可能受抵達影響，因此不要只使用精度太粗、來源時鐘可能倒退的牆鐘時間。不同合併引擎對部分更新、刪除和變更輸出另有規則。

寫入以檔案保存變更，查詢逐鍵看邏輯結果；背景壓實可整理物理檔案，不能拿壓實的執行時間當業務版本。來源欄只傳部分更新時，不可直接假定整列覆寫會保留未傳欄位；先決定「缺欄表示保持」或「缺欄表示清空」，再選合併規則。

## 四筆事件驗證同鍵排序

在 `C:\dev\conduit-lab\lake` 存 `primary.py`。用 `py primary.py`，或在 WSL 2 用 `python3 primary.py`（可用 RAM 0.25 GB）。這是教學模型，`None` 表示保留刪除版本，不代表 Paimon 的實際持久化或清理行為。

```python
events = [(7, 101, "open"), (7, 103, None),
          (7, 102, "paid"), (8, 201, "paid")]
versions = {}
for key, seq, value in events:
    if key not in versions or seq > versions[key][0]:
        versions[key] = (seq, value)
print("versions", sorted(versions.items()))
print("visible", sorted((k, v) for k, (_, v) in versions.items() if v is not None))
```

本例鍵 7 最後版本是 103 且不可見。若在鍵 7 刪除時直接丟掉序號，接著來的 102 就會被誤收；所以驗收不只看「能不能刪」，還要有「刪後重送舊版本」的反例。接到真實作業時，要用引擎相容 JAR；官方下載列有 Paimon 2.1.0 對 Flink 2.2 的套件，不要直接與不同次版本混搭。下一堂[〈CDC 湖倉重播〉](#/lesson/bd-lake-08)再處理消費游標及重播期限。

## 用兩件作品證明你不只查過一張表

把目前快照和變更輸出分開驗。第一份是按鍵讀目前狀態，留一組舊值晚到與同鍵合法重建；第二份是看下游是否收到真正的刪除及恢復後的位置。兩份可能不等時完成，尤其在配置的變更產生方式不同時。若使用來源牆鐘時間，先做兩筆更新同毫秒的反例；找能在同一鍵內可靠排序的來源欄位或交易內序號，再議合併方式。若在極簡本機模型中兩個事件故意有相同序號，目前程式會保留先看到的值，這只是模型規則，不能當成 Paimon 預設契約；正式管道應先辨認它們是同一事件的重送，還是缺少用來排序的資訊。

讀回順序時同時核對表的主鍵是否覆蓋來源業務鍵；若換了來源主鍵或分區欄，先把它當成遷移問題，不用調一個序號就宣稱解決。

## 常見錯誤
- 舊付款覆蓋作廢 → 以抵達順序判定來源版本 → 保留可排序的來源序號。
- 用固定空值當刪除但下一跳看不懂 → 未約定列類型 → 端到端測刪除表示法。
- 表查對就認定串流寫端同步 → 忽略變更輸出的設定 → 另測下游收到並套用的操作。
