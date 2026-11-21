---
id: bd-jvm-05
module: bd-jvm
order: 5
title: Spark Scala 程式閱讀
subtitle: 同一條轉換換個語言也認得
status: ready
minutes: 25
level: 3
prereqs:
  - bd-jvm-04
objectives:
  - 從短 Scala 檔辨認 val、def 和 DataFrame 操作
  - 用相同測資在 Scala 與 PySpark 核對欄名、金額與排序
tags:
  - spark
  - scala
  - pyspark
  - dataframe
  - aggregation
resources:
  - title: Scala Tour：基礎
    url: https://docs.scala-lang.org/tour/basics.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 讀 val、def 和匿名函式。
  - title: Apache Spark：DataFrame 起步
    url: https://spark.apache.org/docs/latest/sql-getting-started.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 切換 Scala、Python，對照建立與轉換。
  - title: Apache Spark：執行版本
    url: https://spark.apache.org/docs/latest/
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 找 Scala、Java 與 Python 相容性。
  - title: Apache Spark：下載
    url: https://spark.apache.org/downloads.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 找官方 Spark 發行包，不另裝 Scala。
concepts:
  - id: bd-jvm-05-val
    prompt: val cleaned = ... 表示 Spark 已算完該篩選嗎？
    answer: 不表示；val 固定變數繫結，Spark 還要有動作觸發計畫。
    mcq:
      options:
        - 表示所有節點已完成
        - 不表示，等 show 等動作
        - 只有加 var 才能執行
        - 只要 groupBy 便已算完
      answer: 1
      explain: Scala 繫結的規則與 Spark 執行的時間不同。
  - id: bd-jvm-05-compare
    prompt: Scala 改成 PySpark 後有差額，先比較什麼？
    answer: 先比較同一來源下的粒度、篩選、分組鍵與缺值規則。
    mcq:
      options:
        - 先改 Scala var
        - 以第一行當真
        - 先比輸入和口徑
        - 調大平行度再說
      answer: 2
      explain: 差額是數值問題，不等於兩邊顯示順序或平行度不同。
    interview:
      question: 怎樣證明重寫 Scala 作業沒有改口徑？
      points:
        - 固定同一輸入、類型和粒度
        - 加入取消、同門市和缺值
        - 依相同鍵排序對帳
      answer: 我先拿同一小批付款，在兩邊固定欄位與類型。先對已付款列，再對每門市總額和欄名，兩端用相同排序。能對這幾列後，再拿含 NULL 的測資驗規格，不能拿一次一致替代上線驗收。
  - id: bd-jvm-05-status
    prompt: 以門市分組後才想排除取消單，哪個原始欄位已不在結果？
    answer: status 沒有出現在分組鍵或輸出彙總裡，已計入的取消額不能直接用篩選減掉。
    mcq:
      options:
        - total_cents
        - store
        - status
        - 三欄都原樣保留
      answer: 2
      explain: 正規做法是先篩選，或讓狀態成為明確的條件加總。
practice:
  - id: bd-jvm-05-p1
    title: 留兩份同口徑的付款輸出
    kind: hands-on
    minutes: 9
    steps:
      - 在本機 Spark 分別執行 Scala 與 PySpark 範例，把兩組結果存進 spark-parity.txt。
      - 把 S1 的 5000 分取消單改為已付後兩端重算。
      - 在筆記指出動作是哪一行。
    checks:
      - 原版 N1=1750、S1=900；變體 N1=1750、S1=5900。
      - 兩端欄名和順序相同；不以日誌時間比較效能。
---

## 先讀數據怎麼走，不用先學完整 Scala
面試或維護時拿到一段 Scala 作業，可以先用你熟悉的 PySpark 畫四格：來源、篩選、分組、輸出。Java 和 Scala 都能在 JVM 上跑；PySpark 則從 Python 使用 Spark。它們這次的數據規則沒有差：只算已付款，依門市合計。回想[〈轉換與動作〉](#/lesson/bd-spark-03)，轉換（transformation）描述新計畫，終端顯示等動作（action）才觸發計算。先核對是哪個操作改了列，別對著語言文法猜出差額。

## 語法小抄
- `val rows = ...` 是不可重新指派的繫結（immutable binding），不保證物件深度不可變。`var` 才可重設；本例不需要。
- `def paid(frame: DataFrame): DataFrame = ...` 宣告函式；參數名後的冒號是參數類型，括號後的是回傳類型。匿名函式像 `x => x + 1`，對應於 Python 的 `lambda x: x + 1`。
- `Seq(("N1", "paid", 1200L), ...)` 是一串三元組，`toDF` 指定欄名。`col("status") === "paid"` 建立一個 Spark 欄位條件，並不是請 Scala 比較兩個普通物件。

## 同一份固定付款，從兩個入口算
沿用[〈本機 Spark 與工作階段〉](#/lesson/bd-spark-01)的本機環境。本例對照 Spark 4.3.0 發行包內的 Scala 2.13 和 PySpark；不另裝 Scala。Windows 若沒有現成 `spark-shell`，用 WSL 2 Ubuntu 內的 Apache Spark 發行包、和本機 Spark 課相同的 JDK 21 與 Python 3.11 以上；一次只跑一端，模式 `local[2]`，建議保留 2–3 GB 可用記憶體。沒有 Docker 或雲端帳戶。

在 `C:\dev\conduit-lab\jvm\spark-read` 存 `paid.scala`。從 WSL 內解壓後的 Spark 根執行 `./bin/spark-shell --master 'local[2]'`，在 Spark shell 輸入 `:load /mnt/c/dev/conduit-lab/jvm/spark-read/paid.scala`。若用 D 槽，路徑改為 `/mnt/d`；看完用 `:quit`。

```scala
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.functions.{col, sum}
import spark.implicits._

val rows = Seq(
  ("N1","paid",1200L), ("N1","paid",550L),
  ("S1","paid",900L), ("S1","cancelled",5000L)
).toDF("store","status","cents")
def paid(frame: DataFrame): DataFrame = frame.filter(col("status") === "paid")
paid(rows).groupBy("store").agg(sum("cents").as("total_cents")).orderBy("store").show()
```

在同一練習資料夾存 `paid.py`，從同一 Spark 發行包根執行 `./bin/spark-submit --master 'local[2]' /mnt/c/dev/conduit-lab/jvm/spark-read/paid.py`。

```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("PaidTotals").getOrCreate()
try:
    rows = spark.createDataFrame(
        [("N1","paid",1200), ("N1","paid",550),
         ("S1","paid",900), ("S1","cancelled",5000)],
        ["store","status","cents"],
    )
    (rows.filter(F.col("status") == "paid")
         .groupBy("store").agg(F.sum("cents").alias("total_cents"))
         .orderBy("store").show())
finally:
    spark.stop()
```

先相加 1200 與 550，再對照 N1 的 1750；S1 只留下 900。兩邊欄名都是 `store`、`total_cents`。`orderBy` 為顯示指定順序，`show` 才觸發計算。看 2 列足以驗此測資，但不能用 `show` 的預設前幾列代替大表的筆數與總額驗算。

### 多放一筆缺值，看看兩種寫法是否還能互相說明
如果來源的狀態是 `NULL`，等於已付的條件不為真，篩選不應把它當已付款。想自己加這筆，要確保其他列仍有字串讓 PySpark 推斷類型；Scala 可以在 `Seq` 另加一個狀態為 `null` 的字串欄位。先假設該筆是大額，避免因為加了 0 而看不出是否錯算。若兩側不一致，先對齊 NULL 行為和分組前的欄位，別先調引擎參數或直接改排序。

另一種追問是「怎知取消單沒有在後面被減回來」。可以先看 `filter` 之後有哪些輸入，再看同一門市如何分組，證據不要只停在總額。語言差異不妨逐一翻譯：欄位相等、群組合計、輸出別名與指定排序；翻譯完仍要用同一份測資核對。真實專案再比較欄位型別和來源版本；這個小練習只需跑幾筆。

核對時讓相同門市一直用同一個代碼，避免文字大小寫的差異讓分組額外出現一列。

## 常見錯誤
- Scala 條件寫成普通 `==` → 沒建出需要的欄位運算 → Scala 用 `===`，PySpark 本例用 `==`。
- 結果差了 5000 → 取消額可能被合入 → 比較兩端分組前保留的列。
- 順序不同就判結果不同 → 未指定順序的分組不承諾行序 → 用同一組鍵排序後對帳。

## 小結
用相同的輸入、分組粒度、規則和輸出讀兩種語言。說得出哪一行讓 5000 消失，比把 Scala 程式逐字翻譯更有用。
