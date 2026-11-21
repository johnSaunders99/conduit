---
id: cl-ai-05
module: cl-ai
order: 5
title: 刪除傳播與評估集
subtitle: 撤下文件後驗收找不到它
status: ready
minutes: 35
level: 3
prereqs:
- cl-ai-04
objectives: ["列出來源撤回時需要失效的衍生物","用撤回標記阻止舊批次重新索引","保存一組有正例、反例及暖快取的驗收"]
tags: ["撤回","刪除傳播","tombstone","評估集","暖快取"]
resources:
  - title: "Microsoft Learn：偵測變更及刪除"
    url: https://learn.microsoft.com/en-us/azure/search/search-how-to-index-azure-blob-changed-deleted
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "看索引器何時能辨認來源刪除。"
  - title: "Microsoft Learn：RAG 評估"
    url: https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/rag-evaluators
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "比較檢索與回答的評估，不混用兩者。"
concepts:
  - id: cl-ai-05-propagation
    prompt: "來源檔已刪除，為何查詢仍可能引用它？"
    answer: "切片、索引或快取各保有副本，來源刪除不會自動使所有副本失效。"
    mcq:
      options:
        - "切片、索引或快取各保有副本，來源刪除不會自動使所有副本失效。"
        - "搜尋服務每次都一定重讀來源。"
        - "已刪除的檔只會影響磁碟統計。"
        - "答案只由排名產生，不可能引用檔案。"
      answer: 0
      explain: "要逐層追副本與血緣，且應驗冷、暖快取。"
  - id: cl-ai-05-tombstone
    prompt: "刪除後舊匯入事件又到達，要怎麼防復活？"
    answer: "以來源鍵和單調遞增的事件序號保留撤回標記，拒絕已撤回之前的舊事件。"
    mcq:
      options:
        - "用接收時間最新者無條件覆蓋。"
        - "只要來源檔不見了，舊事件不必查。"
        - "以來源鍵和單調遞增的事件序號保留撤回標記，拒絕已撤回之前的舊事件。"
        - "用同來源名稱另建一份索引。"
      answer: 2
      explain: "晚到不代表新版本；先判斷源端事件順序與來源狀態。"
  - id: cl-ai-05-eval
    prompt: "評估撤回有沒有生效，哪種驗收比較完整？"
    answer: "同時驗舊內容與引用不可取得、仍有效的對照文件能查得。"
    mcq:
      options:
        - "只看來源清單變少。"
        - "同時驗舊內容與引用不可取得、仍有效的對照文件能查得。"
        - "只驗一題變成空答案就通過。"
        - "只比較模型回答的長度。"
      answer: 1
      explain: "反例驗隱藏，正例確認沒有用關掉整個檢索來假裝問題修好。"
    interview:
      question: "你怎麼證明被撤回的手冊沒出現在問答裡？"
      points:
        - "驗索引、候選、引用及暖快取"
        - "重送舊匯入事件驗不復活"
        - "保留正例與不洩漏明細的證據"
      answer: "我先阻擋撤回來源的查詢曝光，再清索引和快取。用固定問題及角色查正例和撤回反例，另外重送較舊的匯入事件。記錄查詢時間、版本和是否命中，不把撤回的文字存回測試報表。"
  - id: cl-ai-05-restore
    prompt: "恢復備份之後，要先驗什麼才恢復對外服務？"
    answer: "套回最新撤回狀態及授權，重跑查詢評估，避免備份把已撤回內容帶回。"
practice:
  - id: cl-ai-05-p1
    title: "保存一份撤回驗收證據"
    kind: hands-on
    minutes: 13
    steps:
      - "在 C:\\dev\\conduit-lab\\ai 存 recall.py 並執行，保存輸出。"
      - "把撤回後的舊事件重送再加一次，仍用原序號。"
      - "在證據旁寫出正式環境要查的候選、引用、暖快取及正例。"
    checks:
      - "撤回前能找 guide-17，撤回後及重送後不見；guide-23 仍可查。"
      - "沒有真正刪除原檔；驗收只記來源鍵及結果，不抄撤回內容。"
---

## 成本安全：先演練撤回，不刪真文件

本堂純本機，要撤回的是虛構手冊識別碼。不開索引或模型服務。正式演練前先查用量、預算、保留和清除責任；對原文、法定留存或備份的處置須先獲核准，不用真正的刪除來學流程。日報規定撤下後，讀者仍可能從舊快取看到一段文字；來源消失不代表所有衍生物同時消失。

刪除傳播（deletion propagation）是把來源撤回的決定傳到抽取文字、切片、向量索引、引用和快取。以來源鍵找衍生物，在刪除還未同步時先停止對外曝光；保留策略允許的內部備份與對外可查是兩個狀態，還原前仍須套用撤回清單。一般的索引更新不必然會偵測來源被刪；像 Azure 搜尋索引器必須在適用條件下安排刪除偵測，而不是看到來源空了就當索引已乾淨。

## 順序：先擋曝光，再驗每一層

撤回標記（tombstone）記來源與源端事件順序，不留原文。來源若可能晚到或重送，接收時間不適合判斷新舊。本例每個來源的事件序號遞增，較舊事件不能覆蓋目前狀態；正式設計還要定義是否允許合法再發布、怎麼判斷，以及標記保留多久。若備份、重送或重新匯入仍可能帶回舊數據，不能先丟失撤回證據。

在 `C:\dev\conduit-lab\ai` 存 `recall.py`，執行 `py recall.py`。用布林值表示可否檢索，來源狀態和快取只用字典與串列簡化表示；沒有替刪除流程模擬重試中斷與外部服務。

```python
state = {}
cached = ["guide-17", "guide-23"]

def apply(source_id, seq, visible):
    if source_id in state and seq <= state[source_id][0]:
        return
    state[source_id] = (seq, visible)

def visible_from_cache():
    return [key for key in cached if state.get(key, (0, False))[1]]

apply("guide-17", 1, True)
apply("guide-23", 1, True)
print("before", visible_from_cache())
apply("guide-17", 2, False)
print("after", visible_from_cache())
apply("guide-17", 1, True)
print("replayed", visible_from_cache())
assert visible_from_cache() == ["guide-23"]
```

## 評估集要有對照

評估集（evaluation set）是固定問題、測試角色、允許來源及預期結果。撤回前驗問題能指向舊文件；撤回後用同問題、換句話、暖快取、重新索引及重送事件再試。撤回內容應在候選、引用與回答都消失，沒有證據時可回答找不到依據。另一份正常指南仍應查到，才能排除整套搜尋關閉。上線另記各層失效時間，超過承諾時限告警，且不要把原本撤回的文字寫入驗收紀錄。

### 明確定義什麼時候才算完成

第一個時間點是「使用者已看不到」；第二個才是外部索引已清除、快取已失效，且沒有逾期的衍生物。兩者可有不同時限。遇到清除作業重試時，追同一來源識別碼與序號，不為了重跑而產生新身分。受保留規則約束的備份不等於公開查詢副本，應另記何時可清理。

把兩個完成時點都寫進交接單。

## 常見錯誤

- 原檔刪後還能搜尋 → 衍生物未失效 → 沿血緣驗索引與引用。
- 重整後又找到舊指南 → 重播較舊事件 → 用源端序號或正式狀態守住撤回。
- 所有問題都查不到卻通過 → 只有反例 → 保留仍可用的正例查詢。
