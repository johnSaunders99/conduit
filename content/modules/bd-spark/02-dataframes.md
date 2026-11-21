---
module: "bd-spark"
id: "bd-spark-02"
order: 2
title: "DataFrame 與型別"
subtitle: "讀入時別猜錯訂單編號"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-01"
objectives:
  - "為訂單 CSV 明寫欄位與數據類型"
  - "用前置零與金額加總驗證讀入型別"
tags:
  - "DataFrame"
  - "schema"
  - "CSV 型別"
  - "識別碼"
resources:
  - title: "PySpark DataFrame Quickstart"
    url: "https://spark.apache.org/docs/latest/api/python/getting_started/quickstart_df.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "讀建立 DataFrame 以及型別查詢。"
  - title: "Spark CSV Files"
    url: "https://spark.apache.org/docs/latest/sql-data-sources-csv.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "看 header、inferSchema 與 CSV 讀取模式。"
concepts:
  - id: "bd-spark-02-schema"
    prompt: "DataFrame 的 schema 記錄什麼？"
    answer: "記錄欄名、數據類型與可否缺值等結構資訊。"
    mcq:
      question: "訂單編號 0007 不是拿來運算的金額，要用哪個型別？"
      options:
        - "INT"
        - "STRING"
        - "DOUBLE"
        - "DATE"
      answer: 1
      explain: "識別碼要保留前置零及字面身分；用整數會丟格式。"
  - id: "bd-spark-02-parse"
    prompt: "指定 schema 就等於已驗證所有業務欄嗎？"
    answer: "不等於。解析模式及型別約束不涵蓋業務唯一性、允許值、日期範圍等規則。"
    mcq:
      question: "欄位讀為 INT 後，何項仍需獨立驗收？"
      options:
        - "金額不得為負的業務規則"
        - "CSV 用逗號分隔"
        - "程式是否執行 show"
        - "顯示欄名如何對齊"
      answer: 0
      explain: "能解析為整數不代表業務值正確；負整數仍是整數。"
    interview:
      question: "為何生產管道不想每批都推斷 CSV 型別？"
      points:
        - "說明跨批可能漂移"
        - "舉識別碼或金額例"
        - "加上壞值檢查"
      answer: "我會明定欄名與型別，避免這批把 0007 當整數、下一批因為有字母又變字串。再驗缺值、壞列和業務約束；schema 本身不會替我做完。"
  - id: "bd-spark-02-order"
    prompt: "明寫 CSV schema 時，欄位次序為何重要？"
    answer: "讀取位置和標頭必須對齊；同型別的欄互換也可能悄悄改變意義。"
  - id: "bd-spark-02-null"
    prompt: "FAILFAST 能保證每一個欄位都有值嗎？"
    answer: "不能；缺值可能仍符合讀取設定，必要欄需另驗。"
    mcq:
      question: "哪一項可證明沒有缺訂單鍵？"
      options:
        - "看到 STRING 型別"
        - "檢查必填欄沒有 NULL 或空字串"
        - "日報能顯示表格"
        - "讀取設定中的 header=True"
      answer: 1
      explain: "字串型別和有標頭都不是完整性檢查。"
practice:
  - id: "bd-spark-02-lab"
    kind: "hands-on"
    title: "保留 CSV 結構與加總證據"
    minutes: 10
    steps:
      - "依正文建立 orders_sample.csv 和 schema_lab.py"
      - "保存 printSchema 與結果，再把一個金額改成英文字測壞值"
      - "恢復原本金額，確認命令重新成功"
    checks:
      - "order_id 維持 0007、0012，金額為整數且合計 200"
      - "修改為非整數後，在真正讀取時看到錯誤"
---

## 同樣四個字，可能不是數字

來源檔出現訂單編號 `0007`。它看似整數，卻是識別用的字串，與 `7` 的字面有別。把它讀成數字，後面的明細表若仍有前置零，連接就可能對不上。DataFrame 是有名稱和數據類型的表格；結構（schema；台灣常稱綱要）規定欄位名稱、型別及有沒有可能缺值。欄看起來像什麼，不能取代你對該欄用途的理解。

最小 CSV 讀法：`spark.read.option("header", True).schema("欄名 型別, …").csv("檔案")`。`header` 讓首列當欄名；`schema` 以欄位出現的次序指定型別；`mode=FAILFAST` 讓符合嚴格讀取條件的壞列在解析時讓工作失敗，而不是悄悄往下游走。`enforceSchema=False` 讓 Spark 也檢查有標頭的 CSV 欄位名稱與位置是否對得上。`printSchema()` 是看結構，`show()` 是要求顯示數據，兩者證據不同。

## 實際保留前置零

在 WSL 的 `bd-spark` 目錄，存成 `orders_sample.csv`（UTF-8）。練習預留 3 GB RAM，共用上一堂的 `lab_session.py` 及虛擬環境。
```csv
order_id,amount
0007,80
0012,120
```
另存 `schema_lab.py`，執行 `.venv/bin/python schema_lab.py`：
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Read CSV")
try:
    orders = (spark.read.option("header", True)
              .option("enforceSchema", False)
              .option("mode", "FAILFAST")
              .schema("order_id STRING, amount INT").csv("orders_sample.csv"))
    orders.printSchema()
    orders.orderBy("order_id").show()
    orders.agg(F.sum("amount").alias("total")).show()
finally:
    spark.stop()
```

輸出應保留 `0007` 和 `0012`，而 `amount` 能加成 200。再把 120 改成 `bad` 並重新執行；真正在掃描第二列時，整數轉換應無法完成。修回檔案後再次執行，留下一對成功和失敗的紀錄。正式管道可將壞值分流，但不能在未訂清洗規則前就把壞值一律當零。

注意：空欄可能按讀取規則變成 NULL，`FAILFAST` 也不是唯一性檢查。若來源要求 `order_id` 永不缺失、`amount` 不得為負，還要另寫條件核對。錢若含分數，明定精度的十進位數據類型（decimal）比以二進位浮點湊合更適合；見[〈精度與除法〉](#/lesson/sq-expr-08)。

### 同一個檔，驗收要分三關

第一關是標頭：`order_id,amount` 與指定結構的次序一致。第二關是解析：例如 `0012` 可讀為字串，`120` 可讀為整數；如果把欄位對調，兩者都可能恰好被解讀成某種合法值，卻已不是原本業務意思。第三關才是業務：兩筆應該各有一個訂單識別碼、不得漏鍵，也不能因格式清洗變成同一筆。

想像另一個批次的訂單號改成 `B007`，直接推斷可能使前後批結果使用不同數據類型。明寫結構能讓這批仍依原意保留字面，但若上游其實變更了欄序，應先停下並核對契約。不要在讀取時私自把順序猜回來，否則一旦來源真的加了欄位，下游難以發現口徑變了。

保留最小核對範例，不只看 Schema 樹：逐列核一個前置零、一次金額加總和一個異常輸入。若欄位字面是金額符號加數字，先以字串讀入並依規格解析，再決定怎麼處理壞值。由輸入格式與下游需求決定型別，比從欄值長相決定更可靠。

把通過的 CSV 範例與結構放在同一份交接筆記。

## 常見錯誤

- 訂單 0007 印成 7 → 推斷或指定了整數 → 識別碼用 STRING。
- 欄位看起來正確但金額不能算 → 尚未核型別 → 用 printSchema 和加總雙重驗證。
- 指定型別就當欄都合法 → 未限制缺值和負數 → 增加業務檢查。
