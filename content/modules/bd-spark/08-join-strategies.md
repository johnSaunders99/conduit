---
module: "bd-spark"
id: "bd-spark-08"
order: 8
title: "廣播與合併連接"
subtitle: "小維表可否送到每個節點"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-spark-07"
objectives:
  - "從計畫辨識 BroadcastHashJoin 與 SortMergeJoin"
  - "用同一批訂單核對兩種連接的輸出"
tags:
  - "broadcast join"
  - "sort-merge join"
  - "build side"
  - "JOIN 策略"
resources:
  - title: "Spark SQL Performance Tuning"
    url: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "看自動廣播門檻、策略提示與計畫。"
concepts:
  - id: "bd-spark-08-broadcast"
    prompt: "廣播雜湊連接在哪裡花資源、省下什麼？"
    answer: "小側傳給各執行端建查找表，常可免去大側為連接而重分佈，但增加小側傳輸和每端記憶體。"
    mcq:
      question: "事實表很大、維表過濾後很小，哪個是合理候選？"
      options:
        - "廣播大側"
        - "驗證記憶體條件後廣播小側"
        - "收回所有數據到 Driver 逐列配"
        - "把大側拆成更多檔案就不用連接"
      answer: 1
      explain: "小側可複製才是省大側搬運的前提。"
  - id: "bd-spark-08-merge"
    prompt: "排序合併連接先做什麼，再怎麼配？"
    answer: "兩側需按相容鍵分佈並在分區內有序，再循鍵同時前進配對。"
    mcq:
      question: "有大量可排序的等值鍵、兩側都大，不適合複製任一側。哪種值得檢查？"
      options:
        - "盲目廣播其中一側"
        - "改成笛卡兒積"
        - "排序合併連接"
        - "先刪掉一半來源"
      answer: 2
      explain: "排序合併可分散處理兩側；仍需確認交換和排序成本。"
    interview:
      question: "怎麼挑 Spark 連接策略，會直接加 BROADCAST 嗎？"
      points:
        - "先查過濾後大小與統計"
        - "核對可用記憶體和熱門鍵"
        - "比計畫、任務與輸出基數"
      answer: "先確認實際小側、是否適合每個執行端持有，再看引擎本來選什麼。若試廣播提示，核對計畫與重複配對，不把維表名當體積證據。"
  - id: "bd-spark-08-grain"
    prompt: "維表鍵若重複，換連接策略可否修復倍增？"
    answer: "不能；連接策略通常不改合法配對語意，應先修正鍵粒度或查詢。"
  - id: "bd-spark-08-stats"
    prompt: "為什麼維表一開始很大，仍可能適合廣播？"
    answer: "投影和過濾後或許夠小；要驗證實際體積及執行端能否持有。"
    mcq:
      question: "哪個大小與廣播決策較相關？"
      options:
        - "參與這次配對的小側，完成過濾與選欄後的體積"
        - "表名長度"
        - "其他報表的全表列數"
        - "兩側欄數相加"
      answer: 0
      explain: "應衡量真正要複製及建索引的內容，不用表名或其他工作替代。"
  - id: "bd-spark-08-ordering"
    prompt: "排序合併連接的桶或分區內有序，能拿來保證報表順序嗎？"
    answer: "不能；需要整份輸出按鍵排序時，交付查詢仍要明確指定順序。"
practice:
  - id: "bd-spark-08-lab"
    kind: "hands-on"
    title: "留下兩種實體 JOIN 計畫"
    minutes: 10
    steps:
      - "在 bd-spark 執行 join_lab.py"
      - "記下兩份實體計畫中的 JOIN 與 Exchange 名稱"
      - "核對兩份的列數與金額，再試解釋哪側被複製"
    checks:
      - "兩份皆為 60 列、總額 1770"
      - "預期一份有 BroadcastHashJoin、另一份有 SortMergeJoin"
  - id: "bd-spark-08-p1"
    kind: "sql"
    category: [join, aggregate]
    title: "用連接鍵核對小維表配對"
    minutes: 5
    level: 2
    dataset: "shop"
    prompt: "從 `order_items` 依 `product_id` 連接 `products`，交付每個有明細的商品 `product_id`、`product_name`、`line_count`（明細列數，包含取消單），按 `product_id` 升序。"
    solution: |
      SELECT p.product_id, p.product_name, COUNT(*) AS line_count
      FROM order_items i JOIN products p ON i.product_id = p.product_id
      GROUP BY p.product_id, p.product_name ORDER BY p.product_id;
    explain: "先固定等值匹配與明細粒度，再談實體策略。用訂單數代替明細數會改口徑；Spark 的 JOIN 提示不應直接貼進 DuckDB。"
    hints:
      - "先說清楚用哪個商品鍵連接"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-spark-08-grain"
      - "sq-join-01-match"
      - "sq-group-07-lines"
    tags:
      - "等值連接"
      - "對帳"
---

## 先決定誰搬家

每張訂單都要找商品名稱，訂單表很大，商品表過濾後只剩幾百筆。廣播雜湊連接（broadcast hash join）可以把小側送給參與執行的程式，建立按鍵查找的雜湊表；大側留在原分區比對，不必為這次連接把大表按鍵重新分派。複製不是免費：小側太大，每個執行端都要持有一份，可能增加傳輸或耗盡記憶體。估大小要看過濾、投影後的實際數據和載入後的大小，不看表名。

![左：複製小側；右：兩側按鍵交換與排序](assets/bd-spark-joins.svg)

排序合併連接（sort-merge join）適合可以排序的等值鍵。兩側需要相容分佈，且各分區內按鍵排序；若還沒準備好，計畫可能先安排交換及排序，再像兩個有序清單一樣向前合併。已有相容分佈時不必機械地做兩次交換。相同鍵若左有 3 列、右有 2 列，仍可得到 6 次配對；物理運算換了，業務粒度沒變。

## 放在同一張對照紙上

在 WSL 的 `bd-spark` 存 `join_lab.py`，執行 `.venv/bin/python join_lab.py`，預留 3 GB RAM。`F.broadcast(dim)` 是廣播提示，`hint("merge")` 是排序合併提示；不保證所有連接類型都採用提示，本例固定為普通等值內連接。關閉自動廣播及 AQE 是為了隔離差異，不是生產建議。
```python
from lab_session import start
from pyspark.sql import functions as F

spark = start("Conduit Join Strategies")
try:
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    orders = spark.range(0, 60, 1, 4).select(
        F.col("id").alias("amount"), (F.col("id") % 3).alias("product_id"))
    dim = spark.range(3).select(F.col("id").alias("product_id"))
    plans = (orders.join(F.broadcast(dim), "product_id"),
             orders.hint("merge").join(dim.hint("merge"), "product_id"))
    for frame in plans:
        frame.explain("formatted")
        audit = tuple(frame.agg(F.count("*"), F.sum("amount")).first())
        print(audit)
        assert audit == (60, 1770)
finally:
    spark.stop()
```

對照兩份計畫和輸出。若維表本來就不唯一，兩種策略可能都算出同樣多的重複列；先可信地驗數據，再優化。正式環境不需先照抄提示，可讓[〈AQE〉](#/lesson/bd-spark-09)利用執行時資訊，再用慢階段的數據量驗證。

### 把小側的大小說清楚

假設原商品表有一千萬列，但這次只要某個地區的少數商品，先過濾再決定能否廣播；反過來，有「維表」之名也可能含一整套歷史版本。先查表統計，確認真的只需鍵和少量欄，還要估計建成雜湊表後的記憶體。只有單一功能報表時，別因別組曾經成功廣播同名表，就把提示長期留在所有查詢。

在計畫中，廣播的一側可以找 `BroadcastExchange`；排序合併則查兩側是否各有交換及排序。前者避免為這個連接重排大側，卻仍要傳小側；後者在兩邊都大時可讓配對共享較多工作資源，其代價是「各自先準備好」。即使都準備好，某個鍵仍可能因輸出配對太多而慢，這是另一個要查的數據問題。

手算一個最小配對：商品 2 在左側出現兩筆成交，在右側只有一筆名稱，應產出兩筆；若右側多一個歷史版本，普通等值條件會出四筆。修法是定義用哪個版本，不是換算子。對照本堂共有 60 筆結果、總額不變，就是先排除配對改變後再比較兩份計畫。

## 常見錯誤

- 廣播沒有過濾的大表 → 每端記憶體壓力增加 → 先量可複製的一側。
- 有提示就當引擎已採用 → 連接類型或計畫可能不允許 → 確認實體算子。
- JOIN 倍增怪罪 Shuffle → 匹配粒度已錯 → 先查兩側鍵唯一性。
