---
module: "bd-spark"
id: "bd-spark-10"
order: 10
title: "重分區與合併輸出"
subtitle: "寫出夠大但不過多的檔案"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-09"
objectives:
  - "比較 repartition 和 coalesce 的輸出檔數及交換代價"
  - "寫回兩個新目錄後核對列數與金額"
tags:
  - "repartition"
  - "coalesce"
  - "Parquet 寫出"
  - "輸出檔數"
resources:
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 Coalesce Hints 與檔案分區相關設定。"
concepts:
  - id: "bd-spark-10-repartition"
    prompt: "repartition 和 coalesce 有什麼差別？"
    answer: "repartition 通常經 Shuffle 重分配，可增加或減少分區；coalesce 通常不做完整 Shuffle，用於合併較多的現有分區。"
    mcq:
      question: "原本 2 個分區，想重新把工作分配到 8 個，該選哪個？"
      options:
        - "coalesce(1)"
        - "coalesce(8)"
        - "repartition(8)"
        - "只把輸出檔名改成 8"
      answer: 2
      explain: "增加並重分配需要 repartition；coalesce(8) 不會把 2 個分區擴成 8 個。"
  - id: "bd-spark-10-file"
    prompt: "是不是 repartition(4) 就永遠有 4 個檔？"
    answer: "不是。空分區、按欄分目錄、檔案切分設定及寫入器策略都能改變檔數。"
    mcq:
      question: "想證明下一批會少開檔案，該量什麼？"
      options:
        - "只記設定的分區數"
        - "數實際數據檔及大小分布"
        - "只看 _SUCCESS"
        - "只看輸出路徑長度"
      answer: 1
      explain: "實際檔案才是下游需要開啟的對象。"
    interview:
      question: "很多小檔，是否應把所有輸出 coalesce(1)？"
      points:
        - "按下游讀取和日期分區需求定目標"
        - "指出單任務瓶頸"
        - "核實檔數與業務結果"
      answer: "不會一律壓成一份。我會先按日期看大小分布，留足下游平行度。若要減檔，先驗寫入耗時和檔案實際大小，再核對列數、金額和鍵。"
  - id: "bd-spark-10-balance"
    prompt: "合併分區後為何仍可能負載不均？"
    answer: "coalesce 通常合併既有分區而不平均重分佈；其中一個來源特大時可能把不均保留下來。"
practice:
  - id: "bd-spark-10-lab"
    kind: "hands-on"
    title: "交一份檔案佈局前後的核對"
    minutes: 10
    steps:
      - "在 bd-spark 執行 write_lab.py"
      - "記下兩份計畫與新目錄裡的 Parquet 數"
      - "核對重新讀回的列數與金額"
    checks:
      - "四份重分區寫出 4 個非空檔，一份合併輸出 1 個；以實際目錄為準"
      - "兩份皆為 240 列與 28680 元"
---

## 下游要的是可以讀的檔案佈局

前一批寫了大量小檔，下一批讀取要花很多時間開檔；但一律只寫一檔，也會讓寫入只剩一份工作，讀取能否平行還要看檔案格式及切分。重分區（repartition）以交換重新分配輸出，可增減分區。合併分區（coalesce）通常把已有分區併起來以降低數目，不做完整的均衡重分配。此處是 Spark DataFrame 的 `coalesce(n)`，不是 SQL 裡挑第一個非 NULL 的同名函式，也不等於表格式的檔案合併。

速查：`df.repartition(n)` 重分到近似均衡的多份；`df.repartition(n, "key")` 依鍵重分，熱鍵仍可能集中；`df.coalesce(n)` 適合縮減已有的分區；`df.write.parquet(path)` 寫出 Parquet。執行分區數不是檔案數的保證：寫入器可略過空區、在同一個工作中為多個分區目錄產檔，或因檔案筆數上限而拆檔。下游真的開幾個檔，要到目錄數。

## 用新目錄對帳，不蓋掉任何輸出

在 WSL 的 `bd-spark` 存 `write_lab.py`，執行 `.venv/bin/python write_lab.py`，預留 3 GB RAM。每次跑產生一個新的練習目錄；不用 `overwrite`。本例固定 8 個來源分區、關閉 AQE，以便看見兩個操作的差別。
```python
from pathlib import Path
import tempfile
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Write Layout")
try:
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    root = Path(tempfile.mkdtemp(prefix="layout-", dir=Path.cwd()))
    source = spark.range(0, 240, 1, 8).select(F.col("id").alias("amount"))
    for name, frame in (("spread", source.repartition(4)),
                        ("compact", source.coalesce(1))):
        frame.explain("formatted")
        path = root / name
        frame.write.parquet(path.as_uri())
        files = list(path.glob("part-*.parquet"))
        result = tuple(spark.read.parquet(path.as_uri())
                       .agg(F.count("*"), F.sum("amount")).first())
        print(path, len(files), result)
        assert result == (240, 28680)
finally:
    spark.stop()
```

看見一份有 Exchange、另一份為 Coalesce。此例沒有按日期分目錄，也沒有設定每檔上限；預期為 4 檔與 1 檔。報告只記實際檔數，再看檔案大小與任務時間。若分區本來就高度偏斜，直接 coalesce 可能讓最大的工作更集中，而不是均衡。在正式寫出前，用[〈小檔案合併〉](#/lesson/bd-hive-07)的對帳與發佈手法保留舊版本。

### 把輸出數量換成下游條件

假設每個日期現在有許多只有幾百 KiB 的檔案；下游每次都要讀一天。把全月合到同一層目錄可能讓日期條件失去裁剪，並非有效的減檔。先保留日期邊界，才決定每個日期裡應有多少檔案。可把典型檔案大小、最小與最大檔、寫入任務耗時和下游掃描時間都記下來。若檔數少了但最慢寫入變得太久，就說明這個佈局尚不適合。

`repartition(n)` 不指定鍵時可以把寫入工作重分配得較均衡；指定鍵的目的則偏向讓同鍵聚在一起。假如 90% 數據都是同一鍵，指定鍵仍可能造出非常大的單一分區。`coalesce(n)` 省去完整重分配，適合已足夠均衡且只需減量的輸入；若縮得太少，也可能讓同一個任務讀多份來源。先對照計畫再檢查實際大小，而不以操作名稱猜負載。

最後把這次輸出的兩個新路徑與核對值一起保存。若想交給同事比較，除了兩個數值，也可以按鍵核對缺失與重複，確保不是有兩個錯誤互相抵銷。只有工作結果可靠，才有理由挑一種佈局繼續測下游。

## 常見錯誤

- 期待 coalesce 增加平行度 → 它主要縮減分區 → 用 repartition 重新分配。
- 以分區數當檔案數 → 寫入器也決定輸出 → 清點實際 Parquet 檔。
- 為了對照覆寫原來的結果 → 失去基準及回復點 → 先寫新的隔離目錄。
