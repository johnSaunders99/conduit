---
id: bd-ingest-07
module: bd-ingest
order: 7
title: Debezium 與 Canal
subtitle: 對照變更前後的紀錄
status: ready
minutes: 30
level: 2
prereqs:
- bd-ingest-06
objectives:
- 對照 Debezium 與 Canal 的變更形狀
- 辨認刪除事件的業務鍵、前值與來源位置
- 替下游設計足以稽核的共用事件欄位
tags:
- Debezium
- Canal
- MySQL
- 事件封套
resources:
- title: Debezium：MySQL 連接器
  url: https://debezium.io/documentation/reference/stable/connectors/mysql.html
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀變更事件的 op、before、after 和 source。
- title: Canal 專案說明
  url: https://github.com/alibaba/canal
  kind: repo
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 看 MySQL binlog 訂閱及推送模式。
concepts:
- prompt: Debezium 的 op、before、after 各有何用？
  answer: op 是變更類型，before、after 是可用的前後影像；刪除時 after 為 NULL，不表示應忽略。
  mcq:
    question: 收到 Debezium op=d 且 after=null，應怎麼辦？
    answer: 2
    options:
    - 略過，因為沒有新值
    - 把金額改成 0
    - 依鍵套用刪除
    - 重讀目前整張表來猜
    explain: 刪除應由操作判斷，使用事件鍵及位置處理。不能把沒有新值當成沒有變更。
  id: bd-ingest-07-envelope
- prompt: Canal flat JSON 的 old 是完整前值嗎？
  answer: 更新常見只列變更前的欄位；前值內容還要看版本、協定和來源設定，不能用欄位缺席推斷原本是 NULL。
  mcq:
    question: UPDATE 有 data 和 old，old 缺 amount 代表什麼？
    answer: 0
    options:
    - 不能直接當成原值 NULL
    - 金額已硬刪
    - 已確認完整前值等於新值
    - 一定應補為 0
    explain: 缺席和 NULL 不同；查訊息契約與原始 binlog 設定才知道能否還原。
  id: bd-ingest-07-canal
- prompt: 為什麼不能把兩套工具的進度都取名 offset 就混用？
  answer: binlog 座標、Canal 批次確認和 Kafka 消費偏移量是不同介面的恢復位置，作用範圍不同。
  interview:
    question: 兩種 MySQL CDC 同步要換工具，你會先做哪幾個反例？
    answer: 我會先確認使用的是 Debezium 封套還是下游已攤平訊息，以及 Canal 的輸出協定。用插入、更新、刪除、重送和無前值情況做並行對照；記來源鍵、座標與投遞位置。若新工具拿不到原座標，就不可直接沿用別人的 offset，要重新建立可靠切點。
    points:
    - 區分協定與欄位形狀
    - 分離來源座標與投遞位置
    - 含刪除及重送的反例
  id: bd-ingest-07-identity
practice:
- kind: hands-on
  title: 把兩個刪除映射成同一份契約
  minutes: 8
  steps:
  - 執行正文中的 compare_cdc.py，保留輸出到事件對照筆記。
  - 替兩條事件各加一個來源識別欄，並寫下下游投遞位置應放在哪個獨立欄位。
  - 針對 Canal 攤平輸出只見 data、未見來源座標的狀況，寫下不能承諾的事。
  checks:
  - 兩條刪除都得到 D、1002、mysql-bin.000004、920。
  - 筆記不將攤平訊息的批次 id 認作 binlog 座標。
  id: bd-ingest-07-p1
---

## 不是換訊息欄名就算換完

Debezium 是把數據庫變更轉成事件的連接器專案，常見部署是透過 Kafka Connect（連接來源與 Kafka 的執行框架）。Canal 常用於訂閱 MySQL binlog，讓下游消費訂單變更。兩者能看同樣的來源，但發出的封套（event envelope，也就是包住操作、前後值及來源資訊的結構）不同。導入前先問用的是哪個連接器、哪個版本、哪一種輸出序列化。

## 對照原始訊息，保留來源證據

Debezium MySQL 未攤平的事件通常提供 `op`（`c` 新增、`u` 更新、`d` 刪除、`r` 快照讀取）、`before`、`after` 與 `source`；位置可參考 `file`、`pos`、`row` 等。刪除事件之後可能另有同鍵、值為空的墓碑訊息（tombstone）；它供 Kafka 壓縮清理使用，不要把它再當一筆帶前值的刪除。

Canal 原始 Entry 的標頭可帶日誌檔名及位置，RowChange 描述操作與列的前後欄位；常見的平面 JSON（flat JSON）則有 `type`、`data`、`old` 等欄，更新的 `old` 常只描述變更欄位，不能一律當完整前影像。從平面輸出沒看見來源位置時，要向上查協定或補記來源證據，不能拿訊息序號擔保來源重播。目的端最好統一到「來源、業務鍵、操作、來源位置、投遞位置」，缺失欄位也要明記。

## 同一筆刪除，轉成同一個結果

把以下用來教學的欄位節錄存成 `C:\dev\conduit-lab\cdc-lab\compare_cdc.py`，執行 `py compare_cdc.py`。預留 1 GB，不啟動連接器。Canal 變數是把 Entry 標頭與列欄位抽出的示意，不是原生平面 JSON。

```python
deb = {"op": "d", "before": {"order_id": 1002}, "after": None,
       "source": {"file": "mysql-bin.000004", "pos": 920}}
canal = {"eventType": "DELETE", "before": {"order_id": 1002},
         "logfileName": "mysql-bin.000004", "logfileOffset": 920}
a = ("D", deb["before"]["order_id"], deb["source"]["file"], deb["source"]["pos"])
b = ("D", canal["before"]["order_id"], canal["logfileName"], canal["logfileOffset"])
assert a == b
print(a)
```

這個四欄版本只夠看懂單列例子；正式追蹤還要保存來源識別、事件內序等能區別同事件多列的欄位。像更新主鍵這種操作，工具還可能拆成刪舊鍵與建新鍵，需另外以該版本文件及反例驗證。先選定比較邊界再談「相同事件」，否則兩個檔案碰巧有相同位移也會被誤認。

## 測一次刪除以外的差異

比較兩套工具時，另選「改金額但不改訂單鍵」的事件。比對新的金額和操作即可重建現況，但若下游做的是差額累加，舊金額是否存在就會改變可行性。收到新值 120 又沒有舊值時，不能憑空算出增減量。你可以把設計改為寫入鍵的最新版本，再由該狀態重算；若業務一定要完整前值，應先確認來源的逐列日誌設定與連接器配置。

上線換工具前保留一個能追到來源的刪除樣本和一個缺前值樣本。不要只看訊息筆數；一個日誌事件可能攜帶多筆列，一個工具也可能把操作分拆成多次投遞。應以明定的業務效果和來源座標驗收，而非要求兩個匯出的訊息行數完全相同。

## 常見錯誤

- **消費端誤以為刪除缺新值等於無事 →** 先依操作分流，再讀該操作需要的欄位。
- **比對時把缺欄當 NULL →** 更新前值未必完整；保留「缺席」與「明確空值」的差別。
- **更換工具後從錯位開始 →** 來源與投遞位置混用；依各自協定交接。

**重點回顧：**規範化的是業務意義與可追查證據，不是把原始欄位硬改成同一個名字。
