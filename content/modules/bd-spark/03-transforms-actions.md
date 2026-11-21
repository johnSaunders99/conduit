---
module: "bd-spark"
id: "bd-spark-03"
order: 3
title: "轉換與動作"
subtitle: "寫了三行還沒真正開始算"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-02"
objectives:
  - "把 filter、select 與 show、count 分成轉換和動作"
  - "用計畫及 UI 驗證動作前後的差別"
tags:
  - "lazy evaluation"
  - "transformations"
  - "actions"
  - "collect"
resources:
  - title: "PySpark DataFrame Quickstart"
    url: "https://spark.apache.org/docs/latest/api/python/getting_started/quickstart_df.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "看選欄、過濾、show 及 collect 的差異。"
  - title: "Spark Web UI"
    url: "https://spark.apache.org/docs/latest/web-ui.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "用 Jobs 頁看動作前後的差別。"
concepts:
  - id: "bd-spark-03-lazy"
    prompt: "為什麼 filter 後沒有立即印出結果？"
    answer: "filter 產生新的計畫，不要求立即算出可供使用的結果。"
    mcq:
      question: "哪一行通常要求 Spark 真的讀取並計算輸出？"
      options:
        - "df.select('id')"
        - "df.filter('amount >= 100')"
        - "df.count()"
        - "df.alias('orders')"
      answer: 2
      explain: "選欄、過濾及別名都組合計畫；count 要取得計算結果。"
  - id: "bd-spark-03-collect"
    prompt: "何時不應該使用 collect？"
    answer: "結果可能太大時，不把所有列都帶回 Driver；使用有限預覽、聚合或分散式寫出。"
    mcq:
      question: "未知大小的報表，只想看 5 筆，哪個更合適？"
      options:
        - "先 collect 再切前 5 筆"
        - "先限定 5 筆再 show"
        - "先 collect 再 count"
        - "先將整表轉本機字典"
      answer: 1
      explain: "限制結果是避免先將整張表帶回單機；需要固定哪些是前 5 筆時，先定排序。"
    interview:
      question: "寫了幾個轉換沒跑，一加 count 就有工作；這有什麼好處？"
      points:
        - "區分計畫構建與動作"
        - "轉換可整合或下推"
        - "多個動作可能重算"
      answer: "Spark 可以先看完整的轉換鏈，再安排讀取和計算。count 要答案才執行；如果下一行又 show，可能開新工作、重算其中一部分。"
  - id: "bd-spark-03-immutable"
    prompt: "對 df 呼叫 filter 而不保存回傳值，原 df 會改嗎？"
    answer: "不會。filter 回傳代表新計畫的 DataFrame，原來的參照不變。"
practice:
  - id: "bd-spark-03-lab"
    kind: "hands-on"
    title: "留下動作前後的觀察"
    minutes: 9
    steps:
      - "在 bd-spark 目錄執行 lazy_lab.py"
      - "第一個提示先看計畫與 Jobs，第二個提示記錄動作後的工作"
      - "寫下哪行新增計算，保留 3 筆結果"
    checks:
      - "動作前只有計畫，正文用的 range 不需先掃檔"
      - "動作後可見計算紀錄，輸出 5、6、7"
---

## 說要什麼，和取到答案不是一回事

報表需要大額訂單的編號。用 `filter` 選列、`select` 選欄，寫完先不取結果：這兩行是轉換（transformation），每次只傳回代表新計畫的 DataFrame。你仍可用原本的 DataFrame 做另一份報表，它沒有被原地修改。`show()`、`count()` 或寫檔才是動作（action），因為呼叫端需要一個可見結果或正式輸出。先描述計算、等需要時再執行叫延遲求值（lazy evaluation；大陸多稱惰性求值）。

引擎能一次看見整段轉換，才有機會把不需要的欄早點拿掉或將過濾移到讀取附近。有些建立輸入的操作仍可能先做工作：例如推斷 CSV 結構本身要讀樣本。不要把「運算轉換延後」誤解為「任何動作之前絕無 I/O」。今天用 `range` 生成行號，刻意排除讀檔與型別推斷的干擾。

## 先畫計畫，再看第一筆工作

速查：`filter(condition)` 篩列，`select("欄名")` 選欄，`explain("formatted")` 描述物理計畫，`show(n)` 預覽，`count()` 要求總列數。`collect()` 把所有結果列送回 Driver，只可在明確有界的小結果使用。若待看列要有固定順序，先指定排序；沒有排序的預覽不保證相同列順序。

在 WSL 的 `bd-spark` 目錄存 `lazy_lab.py`，以 `.venv/bin/python lazy_lab.py` 執行，預留 3 GB RAM。兩次提示讓你在同一個應用的 UI 看前後。
```python
from lab_session import start

spark = start("Conduit Lazy Plan")
try:
    source = spark.range(8)
    report = source.filter("id >= 5").select("id")
    report.explain("formatted")
    print(spark.sparkContext.uiWebUrl)
    input("Before the action: ")
    report.orderBy("id").show()
    input("After the action: ")
finally:
    spark.stop()
```

看計畫時找 `Range`、`Filter`；第一個提示後才要求排序並顯示。看到 5、6、7 後，切到 UI 看出現的工作；不要求所有版本都出現同樣的作業數。再加入 `report.count()`，觀察它可能開新工作。引擎不承諾因為同一個變數名就記住之前算出的內容；有意保留才是[〈快取與持久化〉](#/lesson/bd-spark-07)的主題。

### 親手拆開三個不同時點

先看終端是否已列出查詢計畫，再看 UI 是否有本次動作的工作，最後比對實際回傳數據。三者回答不同問題：計畫說準備怎麼做，工作紀錄說哪些步驟真的跑了，輸出才是讀者拿到的答案。即使它們可能很接近，也應分開記錄。若計畫和預期不同，先判斷是刪掉了用不到的欄，還是你漏寫了一個條件。

再試同一個來源建立另一個篩選：例如底下的報表代表三張單，另外一份報表要保留較低編號。兩條鏈互不改動原本的 `source`；可以在不重讀檔案程式碼的情況下重用同一個輸入描述，但不是同一份已填滿的結果。把 `report` 當配方，而不是已存好的數據檔，你就不容易在後面把重用變數名誤認為重用輸出。

顯示與寫檔的目標也不同：前者用少量預覽查格式，後者要讓所有符合規則的數據完成計算。用 `show(5)` 只驗幾列，不能拿來證明整批處理了多少。

## 常見錯誤

- 呼叫 filter 後繼續用舊變數 → 原表不變 → 接住轉換回傳值。
- 用 collect 只為摸一下格式 → 把全量拉回協調端 → 先限制或聚合。
- 看計畫就說已算完 → 計畫只是執行描述 → 用動作及 UI 記錄確認。
