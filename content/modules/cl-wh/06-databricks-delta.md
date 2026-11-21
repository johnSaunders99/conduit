---
id: cl-wh-06
module: cl-wh
order: 6
title: Databricks 與 Delta
subtitle: 分開平台能力與表格式
status: ready
minutes: 35
level: 3
prereqs:
- cl-wh-05
objectives: ["區分 Databricks 平台服務與 Delta Lake 表格式","從連續提交列出指定版本可見的檔案","說明歷史版本何時不再可讀及跨引擎驗證重點"]
tags: ["Databricks","Delta Lake","交易日誌","時間旅行"]
resources:
  - title: "Databricks：平台概覽"
    url: https://docs.databricks.com/aws/en/introduction/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "區分平台運算、工作與治理能力。"
  - title: "Delta Lake：官方文件"
    url: https://docs.delta.io/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "從介紹與表維護章節找日誌、版本及清理。"
concepts:
  - id: cl-wh-06-boundary
    prompt: "Databricks 與 Delta Lake 要如何分工描述？"
    answer: "Databricks 是提供運算、工作等能力的平台；Delta Lake 定義表格式及交易語義。"
    mcq:
      options:
        - "Delta Lake 本身是雲端排程服務。"
        - "Databricks 是提供運算、工作等能力的平台；Delta Lake 定義表格式及交易語義。"
        - "Databricks 就是一個目錄的 Parquet 副檔名。"
        - "能讀 Delta 檔就有 Databricks 的全部治理能力。"
      answer: 1
      explain: "表協定不會附送平台的執行、治理或工作監控。"
  - id: cl-wh-06-log
    prompt: "Parquet 目錄同時有舊檔和新檔，怎麼判斷目前表內容？"
    answer: "依 Delta 已提交的交易日誌，重建版本可見檔案集合。"
    mcq:
      options:
        - "按目錄全讀就對。"
        - "只選修改時間最新的一個檔。"
        - "依 Delta 已提交的交易日誌，重建版本可見檔案集合。"
        - "凡名稱含 old 就跳過。"
      answer: 2
      explain: "日誌而不是掃目錄決定讀取集合；舊檔可能暫留。"
    interview:
      question: "用另一個引擎搬同一張 Delta 表，怎麼驗收？"
      points:
        - "先檢查引擎與協定功能相容"
        - "核對相同版本與列數"
        - "測試歷史讀取和保留窗口"
      answer: "我會先確認引擎可讀現有協定和啟用功能，再用固定版本比對欄位、鍵與列數。不會直接讀整個 Parquet 目錄；若有恢復承諾，還要驗舊版本的檔案確實仍在。"
  - id: cl-wh-06-vacuum
    prompt: "已知道舊表版本編號，就一定能時間旅行嗎？"
    answer: "不一定；還需要相應元數據和數據檔都仍可用。"
    mcq:
      options:
        - "不一定；還需要相應元數據和數據檔都仍可用。"
        - "一定，只要日期未過月底。"
        - "一定，版本號本身包含完整內容。"
        - "不能；Delta 從來不支援歷史讀取。"
      answer: 0
      explain: "保留及清理會影響歷史可讀範圍。"
  - id: cl-wh-06-commit
    prompt: "乾跑模型何時把新檔視為可讀？"
    answer: "只有包含它的提交成功發布後；檔案出現在儲存不等於已進表。"
practice:
  - id: cl-wh-06-p1
    title: "重建兩個表版本的讀取清單"
    kind: hands-on
    minutes: 12
    steps:
      - "儲存並執行 delta_files.py。"
      - "再加第 2 版，新增一個檔而不移除其他檔。"
      - "在清單旁標出哪個檔若被物理清除會讓第 0 版讀不回。"
    checks:
      - "原版列印 a，下一版只列印 b；第 2 版印 b 和新增檔。"
      - "能指出 a 檔被清除會影響第 0 版，未執行任何實際清除。"
---

## 成本安全：先模擬版本，不啟用平台

不開 Databricks、不啟動 Spark 叢集。本機只用 Python 模擬檔案可見性；真要上雲前再查工作運算、儲存、免費方案與額度，限定測試表和保留期，並停用工作及運算。不要為省錢把唯一可恢復的舊檔提前清掉。場景是同一天的訂單修正，舊檔與新檔都看得到，為何查詢不會重複計入？

Databricks 是提供運算、工作與治理等能力的分析平台。Delta Lake 是可支援交易的表格式（table format），定義如何由交易日誌（transaction log）與數據檔還原一張表。底層的 Parquet 是列式檔案格式，讓讀取只挑需要的欄；單靠 Parquet 不知道哪些檔屬於同一個一致版本。即使另一個引擎也能讀 Parquet，仍需要相容的 Delta 讀取能力；跨引擎還需比對協定及啟用的表功能。

## 先決定快照，再讀檔

寫入產生新檔後，成功提交（commit）會記下新增及移除等動作。讀者按已提交的版本組合出快照（snapshot），也就是這次讀取認定的表狀態。移除動作是「後續版本不再讀此檔」，不是立即刪除檔案。只有另做物理清理才會從儲存移除；時間旅行（time travel）需要當時版本的元數據及必要的檔案都還在。之後在[〈Delta 交易日誌〉](#/lesson/bd-lake-06)會細講重建與清理限制；若先學過，可用本例對照平台邊界。

## 在紙上演算提交，再用本機重建

在 `C:\dev\conduit-lab\warehouse` 存 `delta_files.py`，執行 `py delta_files.py`。把 `added` 和 `removed` 當作簡化好的提交動作：本例不支援併發、真實 Delta 日誌或恢復。`set` 保存不重複的檔名。

```python
commits = [(0, ["a.parquet"], []), (1, ["b.parquet"], ["a.parquet"])]
visible = set()
for version, added, removed in commits:
    visible.difference_update(removed)
    visible.update(added)
    print(version, ", ".join(sorted(visible)))
```

修正後，第 1 版用 b 取代 a，目錄裡兩者仍可能同時存在。若目標是重現第 0 版的月結，還要能取得 a；明確的保留窗口應先由業務確認。把「目前查詢只看到 b」和「舊版仍讀得到 a」分別寫成驗收，才不會讓同一條成功測試代表兩個承諾。

### 把可攜性寫成一個限縮的承諾

假設下游只需讀指定快照，不用執行寫入。移交卡先記支援的表功能、要固定的版本，以及獨立引擎能否寫入，不能把「能讀」直接延伸為「也能改」。讀相同快照時，比對欄位型別、逐鍵列數與一筆已修正訂單；如果某引擎無法解讀這個協定功能，先停在原平台或設計明確的匯出，不讓它直接以裸檔讀取來假裝相容。

留在交接紀錄的不應只有版本號：還要記表的位置、檢查的引擎和檔案保留窗口。過了窗口就不要承諾歷史重現，先找經批准保留的獨立副本。

## 常見錯誤

- 改讀整個目錄導致重複 → 跳過表日誌 → 用支援 Delta 的讀取方式。
- 排程成功卻看不到結果 → 檔案存在不等於已提交版本 → 先核對提交狀態。
- 回看版號但舊數據不存在 → 相應檔已清理 → 發布前把恢復窗口與保留策略對齊。
