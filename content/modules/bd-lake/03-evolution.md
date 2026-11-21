---
id: bd-lake-03
module: bd-lake
order: 3
title: 結構與分區演進
subtitle: 換欄名不用改寫所有歷史
status: ready
minutes: 35
level: 3
prereqs:
  - bd-lake-02
objectives:
  - 用欄位 ID 解釋更名後如何讀取舊檔
  - 比較日分區與小時分區共存時的裁剪範圍
tags:
  - 欄位 ID
  - 結構演進
  - 分區演進
  - 隱藏分區
resources:
  - title: Apache Iceberg：結構與分區演進
    url: https://iceberg.apache.org/docs/latest/evolution/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 讀欄位 ID 及新舊分區規格共存。
  - title: Apache Iceberg：Spark DDL
    url: https://iceberg.apache.org/docs/latest/spark-ddl/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 對照 RENAME COLUMN 與分區欄位調整。
concepts:
  - id: bd-lake-03-field
    prompt: 舊版 price 改名 amount，舊檔靠什麼對應？
    answer: 靠穩定欄位 ID，不靠欄名或欄位位置。
    mcq:
      options:
        - 原始欄名
        - 穩定欄位 ID
        - 實體欄位置
        - 檔案順序
      answer: 1
      explain: 更名不改 ID；新建一個同名欄位不等於延續原欄。
  - id: bd-lake-03-spec
    prompt: 從按日改按小時之後，舊檔會立即重切嗎？
    answer: 不會；新舊檔各沿用其分區規格，讀者按各規格裁剪。
    mcq:
      options:
        - 會，所有檔案立即重寫
        - 會，只改路徑即可
        - 不會，只需讀最新規格
        - 不會，每個檔案按自己的規格解讀
      answer: 3
      explain: 以新規格解讀舊檔可能漏讀。
    interview:
      question: 要把日分區改為小時分區，你怎麼避免上線漏數？
      points:
        - 確認時區及半開窗口
        - 新舊規格各自裁剪
        - 核對邊界列及掃描量
      answer: 我會先用跨規格的半開時間窗算同一批訂單，核對小時邊界的鍵與金額。舊檔仍可能按日被選中，再逐列篩；要不要重寫舊分區，另用實測掃描量決定。
  - id: bd-lake-03-semantic
    prompt: amount 從元改為分，適合只改欄名嗎？
    answer: 不適合，意義變了；應另外建欄或明確轉換與遷移下游。
    mcq:
      options:
        - 適合，ID 不變即可
        - 不適合，先處理度量語義
        - 適合，只需改欄位置
        - 適合，只要以前的列數相同
      answer: 1
      explain: 結構相容不代表業務意義相容。
practice:
  - id: bd-lake-03-p1
    kind: explain
    title: 畫出跨分區規格的掃描清單
    minutes: 13
    steps:
      - 在 C:\dev\conduit-lab\lake 保存 evolution.md，照範例列出來源欄 ID、檔案規格與時間範圍。
      - 把窗口終點改為 11:01，列出候選檔及真正納入的列。
    checks:
      - 原窗口候選 A、B，輸出 2 筆；延後終點後候選 A、B、C，輸出 3 筆。
      - 如果重新新增同名欄，筆記不會把舊 ID 的值誤認成新欄。
---

## 更名不等於重寫，換單位也不等於更名

訂單欄 `price` 容易被誤讀成標價，團隊改名 `amount`，仍以元表示成交額。結構演進（schema evolution）允許這種改動不重寫舊檔。Iceberg 用欄位 ID（field ID）連起結構定義與檔案欄位；假設 ID 7 原名 `price`，改名後仍為 7，舊檔中的 60 元照樣出現在新欄。若先刪 `price` 再加同名欄，新欄會有不同 ID，不能把兩者拼接。改成「分」則是更改業務語義，應有明確轉換、下游遷移與回頭驗算，不是只改名字。

## 同一張表，可以住著兩代地圖

分區演進（partition evolution）會讓新的寫入使用新分區規格，既有檔仍依舊規格留在原處。把 `days(event_ts)` 換成 `hours(event_ts)` 時，讀者用查詢的原始時間條件分別推算新舊規格要查哪些檔，不必要求用戶再手寫物理分區欄。這就是隱藏分區（hidden partitioning）的效果之一。裁剪是先排除確定不符的檔，真正的半開窗口仍要判定每筆列是否落在 `[開始, 結束)`；其他可用的檔案統計也可能把候選再縮小。

## 手算兩張分區地圖

以下是練習用 UTC 帳本，假設不靠額外檔案統計。A 按日分區，含 11 月 20 日 09:59 和 10:10；B 按小時分區，含同日 10:25；C 按小時分區，含同日 11:00。查同日 `[10:00, 11:00)` 時，先按日選中 A，按小時選中 B 並排除 C。逐列結果只取 A 的 10:10 和 B 的 10:25。若將終點改成 11:01，先圈出哪個檔進入候選，再看哪一列真正加入。畫完圈，你便分得清候選檔與輸出列。紙上練習不需引擎（額外 RAM 低於 0.1 GB）。

引擎實作時，把更名、分區規格調整、實體重寫當 3 個不同操作，不能用移動物件目錄代替提交。若營運的「一天」以門市時區計，把查詢邊界先換成同一時間基準再比。當舊規格的候選檔太多，先量掃描再決定是否重寫；之後在[〈合併與小檔整理〉](#/lesson/bd-lake-04)會細講成本及驗算。

## 發布前，把改動拆成可獨立核對的順序

先固定目前的列鍵、金額與時間範圍；只改欄名，驗版本中的 60 元仍出現在新欄。除了直接讀表，也查匯出的欄名與下游契約：表能讀舊檔，不表示還用舊欄名的程式不會出錯。再調分區規格並寫入 1 筆新事件，保留同日至少一個舊檔作對照。最後才決定要不要重寫歷史檔。事故若出現，這樣可分辨是名稱契約、時間口徑，或是裁剪少讀。試著在筆記把 10:10 改成 09:50：A 仍是日分區候選，但輸出不該含改早的那一列；若你先前用候選檔的筆數當輸出，這個反例會抓住錯誤。

## 常見錯誤
- 同名新欄讀不到舊值 → 刪後重建造成 ID 改變 → 只改名字時走更名操作。
- 更改規格後只查小時目錄 → 漏掉舊的日分區檔 → 用表入口與來源時間條件。
- 11:00 被兩個窗口納入 → 把終點也算進去 → 使用半開窗口並核對時區。
