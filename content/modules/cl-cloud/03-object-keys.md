---
id: cl-cloud-03
module: cl-cloud
order: 3
title: 物件鍵與前綴
subtitle: 別把路徑看成真正的目錄
status: ready
minutes: 30
level: 2
prereqs:
- cl-cloud-02
objectives: ["以桶名和完整物件鍵定位一份日報","用含尾斜線的前綴排除相近名稱","說明搬移一批鍵為何不是原子改名"]
tags: ["S3","物件鍵","前綴","物件儲存"]
resources:
  - title: "Amazon S3：物件鍵命名"
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "讀鍵唯一性與斜線形成的目錄外觀。"
  - title: "阿里雲 OSS：物件儲存"
    url: https://www.alibabacloud.com/help/en/oss/user-guide/what-is-oss/
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "看 Bucket 與 ObjectKey 的定位方式。"
  - title: "Azure Blob Storage：儲存模型"
    url: https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "對照容器及 Blob 名稱。"
concepts:
  - id: cl-cloud-03-address
    prompt: "同一天的原始檔和日報都叫 orders.csv，如何指定日報？"
    answer: "用桶名加上日報的完整物件鍵。"
    mcq:
      options:
        - "用桶名加上日報的完整物件鍵。"
        - "只用檔名 orders.csv。"
        - "只用日期和桶名。"
        - "只記最後一次執行的電腦位置。"
      answer: 0
      explain: "桶內的識別單位是完整的鍵，不是末段的檔名。"
  - id: cl-cloud-03-prefix
    prompt: "只選中 reports/daily/ 這批鍵，應如何篩選？"
    answer: "對完整鍵使用包含尾斜線的前綴 reports/daily/。"
    mcq:
      options:
        - "前綴用 reports/daily，不在乎尾斜線。"
        - "在全字串找任意位置的 daily。"
        - "對完整鍵使用包含尾斜線的前綴 reports/daily/。"
        - "僅檢查末段副檔名。"
      answer: 2
      explain: "尾斜線防止同時選到 reports/daily-backup/；其他方法無法限定分組。"
  - id: cl-cloud-03-rename
    prompt: "一批日期前綴要改名，為何不能在一般用途 S3 桶把它當單次資料夾改名？"
    answer: "前綴只是字串分組；要複製個別物件到新鍵，再驗證及切換讀取方。"
    mcq:
      options:
        - "前綴搬移會替所有消費者自動更新來源。"
        - "前綴只是字串分組；要複製個別物件到新鍵，再驗證及切換讀取方。"
        - "只要先建立空資料夾就會搬完。"
        - "桶有版本控制時就可把全部鍵一併改名。"
      answer: 1
      explain: "多物件操作可能部分成功，版本控制也不會把多鍵操作變成一筆交易。"
    interview:
      question: "換出貨報表的月份前綴時，怎麼避免下游讀到半套檔？"
      points:
        - "建立完整鍵對照清單"
        - "驗證目標內容再切換"
        - "保留舊鍵到恢復期結束"
      answer: "我會先複製到新前綴，按清冊逐項驗證大小或校驗值，確定齊全才改下游清單。若有漏檔就維持原讀取位置，等消費者都切過去且保留允許後再清理。"
  - id: cl-cloud-03-version
    prompt: "同一桶及鍵有不同內容的版本，怎麼指出要的舊內容？"
    answer: "除了桶與鍵，再記錄版本識別碼；是否有舊版可讀取決於版本控制及保留。"
practice:
  - id: cl-cloud-03-p1
    title: "產生乾跑物件搬移清單"
    kind: hands-on
    minutes: 11
    steps:
      - "儲存並執行 keys.py，把輸出存成文字清單。"
      - "把篩選前綴的尾斜線去掉，比對新增的一列。"
      - "重改回原值，為清單寫一條完成複製才切換的驗收。"
    checks:
      - "原結果 2 列，只包含 reports/daily/；反例多 1 列備份。"
      - "清單不執行複製、刪除或任何網路請求。"
---

## 成本安全：先列出會碰到的鍵

這堂用本機字串模擬 S3；不用開桶，也不用部署 MinIO。若日後需要實測 S3 相容介面，可先用既有的本機 MinIO；真正上雲先查免費範圍、請求與複製費，限制樣本和預算，先寫清理清單。搬移一批檔要先知道有幾個鍵，因為每個物件都可能需要請求，遺留兩份還可能增加容量。

物件儲存（object storage；中國大陸稱對象存儲）把內容與元數據（metadata）保存在物件（object）裡。以一般用途的 Amazon S3 桶來說，取現行物件要知道桶名和完整物件鍵（object key；中國大陸亦稱對象鍵）。`reports/daily/2026-02-03/orders.csv` 和 `raw/2026-02-03/orders.csv` 末段相同，卻是不同物件。阿里雲 OSS 也用桶與鍵；Azure Blob Storage 則用容器與 Blob 名稱定位。這堂只以一般用途 S3 的扁平鍵空間說明，不把這個行為套到所有有階層命名空間的方案。

## 同前綴是同一串開頭，不是真正的資料夾

前綴（prefix）是完整鍵的開頭。列出 `reports/daily/` 可發現多天輸出，斜線讓畫面看起來像一層目錄；它沒有替多個物件加上一把共同的鎖。不加尾斜線就會匹配 `reports/daily-backup/`。完整鍵應保存在清冊，不能只靠畫面折疊後的名稱猜測。若開了版本控制（versioning）且需要固定某版，還要記錄版本識別碼；只記桶與鍵會指向目前可讀版本。舊版本的清理接著在[〈儲存層級與生命週期〉](#/lesson/cl-cloud-04)說明。

## 乾跑一次改鍵

在 `C:\dev\conduit-lab\cloud` 存 `keys.py`，從該資料夾執行 `py keys.py`。乾跑（dry run）在這裡只列來源和目標，不改任何物件。

```python
keys = [
    "reports/daily/2026-02-03/orders.csv",
    "reports/daily/2026-02-04/orders.csv",
    "reports/daily-backup/2026-02-03/orders.csv",
    "raw/2026-02-03/orders.csv",
]
prefix = "reports/daily/"
for key in sorted(keys):
    if key.startswith(prefix):
        target = "curated/daily/" + key.removeprefix(prefix).lstrip("/")
        print(f"{key} -> {target}")
```

原始清單只對應 2 個目標。實際要搬時，先比對預期鍵集合與內容，再切換消費者讀取位置；若只複製了第一天，就不應讓下游上線讀新的前綴。原位置保留到驗收及恢復期結束，再由授權角色處置；新寫入也需凍結或另行追補，不然遷移清單在複製過程就會過時。

### 用清單表示「這批檔案已齊」

下游需要 2 個營業日才可計算跨日指標。若逐個複製，第一個鍵已可讀時，第二個仍可能失敗。與其讓下游列前綴猜是否做完，不如等比對成功再發布一份 manifest（清單檔），列出預期業務日與已驗證的鍵。清單要能分辨「這天沒有訂單」和「這天的檔漏了」；對前者可明記為空批。此做法讓消費者依明確的一批數據讀取，不需要整個前綴有原子搬移的能力。

複查時不要只數物件：兩批都各有 2 個鍵，也可能是一個日期拿錯。按完整鍵逐一核對是比對清單的最低要求。

## 常見錯誤

- 清單混入備份 → 前綴沒包含邊界斜線 → 以 `reports/daily/` 比對。
- 複製一半時下游找不到第二天 → 把多物件搬移當成單次改名 → 清冊對完再切換。
- 輸出末段相同就覆寫別的日報 → 把檔名當成鍵 → 複查完整來源與目標鍵。
