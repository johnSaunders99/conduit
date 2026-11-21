---
module: "bd-spark"
id: "bd-spark-04"
order: 4
title: "Spark SQL 與視圖"
subtitle: "用兩種介面驗算同一個合計"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-03"
objectives:
  - "建立 Session 範圍的暫存視圖並以 SQL 查詢"
  - "用 DataFrame 與 SQL 比出相同的彙總結果"
tags:
  - "Spark SQL"
  - "temporary view"
  - "SparkSession"
  - "Group By"
resources:
  - title: "Spark CREATE VIEW"
    url: "https://spark.apache.org/docs/latest/sql-ref-syntax-ddl-create-view.html"
    kind: "doc"
    lang: "en"
    minutes: 5
    required: false
    checked: "2026-11-20"
    note: "讀 TEMPORARY 與 GLOBAL TEMPORARY 的範圍。"
  - title: "PySpark DataFrame Quickstart"
    url: "https://spark.apache.org/docs/latest/api/python/getting_started/quickstart_df.html"
    kind: "doc"
    lang: "en"
    minutes: 6
    required: false
    checked: "2026-11-20"
    note: "看 DataFrame 與 SQL 入口如何銜接。"
concepts:
  - id: "bd-spark-04-view"
    prompt: "暫存視圖在這堂代表什麼？"
    answer: "把 DataFrame 的查詢定義註冊在目前 Session 裡，用表名查它，不因此寫出實體表。"
    mcq:
      question: "重開一個 Spark 應用後，原本註冊的本機暫存視圖怎麼辦？"
      options:
        - "需重新註冊"
        - "永久留在數倉"
        - "自動出現在 DuckDB"
        - "以相同名字覆蓋來源檔"
      answer: 0
      explain: "本機暫存視圖跟 Session；不能跨應用當永久表。"
  - id: "bd-spark-04-equivalent"
    prompt: "什麼證據能驗證 SQL 與 DataFrame 結果一致？"
    answer: "核對相同欄、型別、列值及重複次數；若交付要求列序，再明確排序。"
    mcq:
      question: "兩邊總額相同就足以證明什麼？"
      options:
        - "所有會員小計一樣"
        - "每列出現次數相同"
        - "執行計畫一定相同"
        - "只能證明這個總額對上"
      answer: 3
      explain: "總額可能掩蓋兩筆相反的差異，不能保證逐列一致。"
    interview:
      question: "同一個計算用 Spark SQL 與 DataFrame，會不會必定一快一慢？"
      points:
        - "兩者都進查詢規劃"
        - "語意與實體計畫分開"
        - "同輸入看計畫與結果"
      answer: "簡單的內建運算可以變成相同實體計畫。我先確保篩選、分組與缺值處理一致，再看 explain，而不是因語法不同就預設快慢。"
  - id: "bd-spark-04-scope"
    prompt: "為何 createOrReplaceTempView 的 Replace 要留意？"
    answer: "同名暫存視圖會更新定義，後面的查詢可能改讀另一份計畫。"
practice:
  - id: "bd-spark-04-lab"
    kind: "hands-on"
    title: "兩種寫法輸出一份對照"
    minutes: 10
    steps:
      - "依正文存成 sql_lab.py 並執行"
      - "存下兩種介面的結果與斷言"
      - "將其中一種寫法改成包含取消單，觀察斷言，再恢復"
    checks:
      - "會員 7 合計 125，會員 9 合計 90"
      - "改掉其中一邊的付款篩選後核對不通過"
  - id: "bd-spark-04-p1"
    kind: "sql"
    category: [ddl, time]
    title: "用暫存視圖交付單日訂單"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "在 SQL 練習場使用 `orders`。建立名為 `lab_daily_paid` 的暫存視圖，內容為 2026-01-18 的已付款訂單，欄位依序為 `order_id`、`user_id`。檢查會從該視圖按 `order_id` 升序讀出。"
    solution: |
      CREATE TEMP VIEW lab_daily_paid AS
      SELECT order_id, user_id FROM orders WHERE status = 'paid' AND order_date = DATE '2026-01-18';
    explain: "`CREATE TEMP VIEW … AS` 保存查詢定義；只寫 SELECT 沒有提供指定名字。此題也從 DuckDB 目錄核對它是暫存視圖。Spark 也提供 SQL 建暫存視圖或 Python 註冊 API。"
    hints:
      - "先獨立寫正確的來源查詢，再接在 AS 後"
    check:
      ordered: true
      columnNames: true
      mode: "state"
      query: |
        SELECT order_id, user_id FROM lab_daily_paid
        WHERE EXISTS (SELECT 1 FROM duckdb_views()
                      WHERE view_name = 'lab_daily_paid' AND temporary)
        ORDER BY order_id;
      allowEmpty: false
    concepts:
      - "bd-spark-04-view"
      - "sq-read-02-filter"
    tags:
      - "視圖"
      - "日期"
  - id: "bd-spark-04-p2"
    kind: "sql"
    category: [aggregate, time]
    title: "用 SQL 驗營業日分組"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "每個有已付款訂單的營業日一列，從 `orders` 輸出 `order_date`、`paid_orders`，按 `order_date` 升序。`paid_orders` 是該日付款訂單筆數。"
    solution: |
      SELECT order_date, COUNT(*) AS paid_orders FROM orders
      WHERE status = 'paid' GROUP BY order_date ORDER BY order_date;
    explain: "先篩出已付款，再逐日計數；若將 COUNT 換成 COUNT(DISTINCT user_id)，就變成會員數。Spark DataFrame 對應 filter、groupBy、count、orderBy。"
    hints:
      - "先篩狀態，再按日期分組"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-spark-04-equivalent"
      - "sq-group-03-key"
      - "sq-read-02-filter"
    tags:
      - "分組"
      - "驗算"
---

## 給正在計算中的表一個名字

有人偏好寫 Python 的 `groupBy`，有人習慣寫 `GROUP BY`。Spark SQL 可以在同一引擎內用這兩個入口；同一份 DataFrame 先註冊成暫存視圖（temporary view），SQL 就可以像讀表一樣引用。這是工作階段範圍的名稱，不會因註冊而寫出新檔。它也不是[〈快取與持久化〉](#/lesson/bd-spark-07)的快取：使用同一視圖兩次仍可能重算。

速查：`df.createOrReplaceTempView("name")` 註冊或替換名稱；`spark.sql(query)` 回傳查詢的 DataFrame；`show()` 顯示結果；需要固定結果順序時用 `ORDER BY`。如果要永久交接給下一個應用，需有持久表或檔案，不要靠本次 Session 的名稱。Spark 的全域暫存視圖可跨同應用的 Session，不跨應用生命週期，本堂只用普通暫存視圖。

## 一種口徑，兩種寫法

在 WSL 的 `bd-spark` 目錄存為 `sql_lab.py`，執行 `.venv/bin/python sql_lab.py`，預留 3 GB RAM。以下 SQL 嵌在 **Spark** 程式，來源為程式建立的 4 列；課內 SQL 題則用 **DuckDB** 的 `shop` 共享數據集。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit SQL and Frames")
try:
    orders = spark.createDataFrame(
        [(7, 80, "paid"), (7, 45, "paid"), (9, 90, "paid"), (9, 20, "cancelled")],
        "user_id INT, amount INT, status STRING",
    )
    orders.createOrReplaceTempView("lab_orders")
    by_sql = spark.sql("""
        SELECT user_id, SUM(amount) AS total FROM lab_orders
        WHERE status = 'paid' GROUP BY user_id ORDER BY user_id
    """)
    by_frame = (orders.filter(F.col("status") == "paid").groupBy("user_id")
                .agg(F.sum("amount").alias("total")).orderBy("user_id"))
    first, second = by_sql.collect(), by_frame.collect()
    print(first)
    print(second)
    assert first == second
    assert [(x.user_id, x.total) for x in first] == [(7, 125), (9, 90)]
finally:
    spark.stop()
```

預期會員 7 為 125、會員 9 為 90。柱狀圖的總額相同仍可能把兩個會員的小計算反；小樣本比較排序後的逐列內容，未排序時則要保留每種列的重複次數，不能用集合把它吃掉。此處兩份結果都只有 2 列，才適合 `collect()`。

### 驗算不只比「看起來一樣」

先用紙筆分兩組：會員 7 有兩列已付款，會員 9 有一列已付款、一列取消；沒有通過過濾的 20 元不應出現在任一小計。SQL 的 `FROM` 指向登記的視圖；`WHERE` 先保留已付款列；`GROUP BY` 再依會員合流。Python 一側依同樣順序表達；若寫成先取 `orders` 的筆數再過濾，就已經是另一個計算。最後按同一個鍵排序，為對照固定列序，而不是假設競爭的工作會用相同順序回來。

在大批次中，別把整表拿回驅動程式做斷言。先在分散式引擎比較雙向差集、每種列的出現次數或按業務鍵對帳，最後只收回差異摘要。只用不保留重複的差集，可能看不見某個會員多了一整筆明細。這堂的兩列很小，才以排序後逐列對照作為完整驗收。

維護時先選一種介面為主要版本，另一種作為獨立核對，不要長期維護兩份功能重複的巨型查詢。若臨時視圖同名被替換，先印出它的計畫與小樣本，驗證現在指向哪一份，再談兩邊是否等價。

在 DuckDB 的暫存視圖題裡，執行環境每次檢查都有自己的副本。即使在當前練習看得到視圖，也不要期待切換數據集後還能依名稱讀取，也不應在答案中修改原始訂單表。

第二天重開工作階段時，重新註冊視圖，再用相同輸入和條件重做這份比對。

## 常見錯誤

- 找不到視圖 → 可能在另一個 Session → 確認註冊與查詢用同一工作階段。
- 只記得到同樣總額 → 分組口徑可能不同 → 按會員比較並補缺值測例。
- SQL 有排序，另一邊沒有 → 相等內容可能列序不同 → 統一排序或比較多重集合。
