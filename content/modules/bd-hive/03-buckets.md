---
module: "bd-hive"
id: "bd-hive-03"
order: 3
title: "分桶與排序"
subtitle: "把相同鍵收在可預測的桶"
minutes: 30
level: 2
status: "ready"
prereqs:
  - "bd-hive-02"
objectives:
  - "分辨日期分區、雜湊桶與桶內排序"
  - "測試分桶代理的列數分布並辨認熱鍵"
tags:
  - "bucket"
  - "CLUSTERED BY"
  - "SORTED BY"
  - "桶號"
resources:
  - title: "Hive DDL Manual"
    url: "https://hive.apache.org/docs/latest/language/languagemanual-ddl/"
    kind: "doc"
    lang: "en"
    minutes: 7
    required: false
    checked: "2026-11-20"
    note: "讀 CLUSTERED BY、SORTED BY 與分區建表語法。"
concepts:
  - id: "bd-hive-03-bucket"
    prompt: "分區與分桶分別按什麼方式組織數據？"
    answer: "分區常依日期等值分目錄；分桶通常依指定鍵雜湊到固定數量的桶。"
    mcq:
      question: "同一天同一會員的多張單，依會員鍵雜湊時往哪裡？"
      options:
        - "每張到一個不同桶"
        - "同一個桶"
        - "每張跨所有桶"
        - "只照日期決定桶"
      answer: 1
      explain: "桶鍵是會員而不是日內列順序；分區與桶是不同層。"
  - id: "bd-hive-03-sort"
    prompt: "桶內排序能保證所有查詢輸出全域有序嗎？"
    answer: "不能，各桶可能各自有序；交付全域順序仍需 ORDER BY。"
    mcq:
      question: "需要交付從小到大排序的完整訂單清單，該依靠什麼？"
      options:
        - "相同桶數"
        - "桶內排序的宣告"
        - "重跑一次讀取"
        - "最後查詢的 ORDER BY"
      answer: 3
      explain: "實體儲存的局部排序不是查詢列順序的保證。"
    interview:
      question: "兩張 Hive 表同為 16 桶，JOIN 就一定不用 Shuffle 嗎？"
      points:
        - "核對連接鍵與雜湊相容"
        - "核對數據是否真的照配置寫入"
        - "以實際計畫為準"
      answer: "不一定。我會核對連接鍵、桶配置、雜湊版本以及寫入是否真的遵守佈局，再看引擎是否選了可利用桶的策略。只比桶數無法回答。"
  - id: "bd-hive-03-imbalance"
    prompt: "若一位會員佔總量一半，分 16 桶能讓那位會員平均分布嗎？"
    answer: "不能；以會員為鍵時，這位會員仍只在一個桶。"
practice:
  - id: "bd-hive-03-p1"
    kind: "sql"
    category: [aggregate]
    title: "依會員鍵估算桶的負載"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "用 `orders` 模擬 4 桶：假設桶號是 `user_id % 4`（不是 Hive 的真實雜湊）。輸出 `bucket_id`、`order_count`，每個有訂單的桶一列，按 `bucket_id` 升序。所有訂單都計入。"
    solution: |
      SELECT user_id % 4 AS bucket_id, COUNT(*) AS order_count
      FROM orders GROUP BY user_id % 4 ORDER BY bucket_id;
    explain: "直接對會員鍵取餘數，所以同會員一定去同一桶。若對 `order_id` 取餘數就改了分派規則；Hive 的實際桶號還取決於雜湊規則與版本。"
    hints:
      - "先計算每列的桶號，再按桶號計數"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-03-bucket"
      - "bd-distrib-01-routing"
      - "sq-group-03-key"
    tags:
      - "桶負載"
  - id: "bd-hive-03-p2"
    kind: "sql"
    category: [distinct, aggregate]
    title: "找出每桶的會員數"
    minutes: 6
    level: 2
    dataset: "shop"
    prompt: "使用同一個 `user_id % 4` 定義，輸出 `bucket_id`、`member_count`（桶內不同會員數），按 `bucket_id` 升序。來源是 `orders`，沒有訂單的會員不計。"
    solution: |
      SELECT user_id % 4 AS bucket_id, COUNT(DISTINCT user_id) AS member_count
      FROM orders GROUP BY user_id % 4 ORDER BY bucket_id;
    explain: "訂單多不必然代表會員多；`COUNT(*)` 算的是列數，不是不同會員。此結果是口徑對照，不是某個系統的實際桶檔配置。"
    hints:
      - "同會員只算一次"
    check:
      ordered: true
      columnNames: true
      mode: "result"
      allowEmpty: false
    concepts:
      - "bd-hive-03-bucket"
      - "bd-hive-03-imbalance"
      - "sq-group-05-entity"
    tags:
      - "桶負載"
      - "去重"
---

## 一天之內還能怎麼放？

上一堂按營業日找目錄，但某天促銷活動把單日數據放大十倍。若每次連接都要先依會員重排，也可能想在寫入時把同一會員預先放在可預測的位置。分桶（bucketing）以指定鍵做雜湊，把每列映射到固定個數的桶；按日期分區負責讓你跳過別天，分桶則在每個日期內再分佈。桶通常對應到有桶識別資訊的檔案，但不應把「宣告 4 桶」當成一定恰好 4 個實體檔。

以鍵 5、9 做一個簡化模型：兩者除以 4 餘 1，因此可以進同一桶，卻不是同一會員。桶內依 `order_id` 排序，只保證各桶中可依布局讀到有序片段；把不同桶的輸出接在一起，不會自動全域有序。要交付有序結果，仍由查詢明寫 `ORDER BY`。

## 讀懂 Hive DDL 的三個片段

- `PARTITIONED BY (dt DATE)`：日期用作分區；通常呈現為不同日期的目錄。
- `CLUSTERED BY (user_id) INTO 4 BUCKETS`：由會員鍵決定桶。若要宣告桶內有序，`SORTED BY (order_id ASC)` 放在 `INTO` 前。
- `STORED AS ORC`：決定檔案格式，不是決定去哪個分區或桶。

可在規格紙上順讀一張表：先定「寫進哪個日期」，再定「日期內以什麼鍵分桶」，最後定「桶內有沒有排序」。Hive 的這組建表片段是**讀法示例**，本堂不執行；Spark 的分桶雜湊和輸出並不等價於 Hive。用排序好的兩份清單想像合併時，只需向前讀；但兩邊必須照相容規則分佈和排序，才有機會利用排序合併。詳見[〈廣播與合併連接〉](#/lesson/bd-spark-08)。

## 用共享訂單算一張分佈表

在 SQL 練習場選 `shop`，用本堂兩題分別算訂單數與不同會員數。這是以餘數當桶號的**邏輯代理**，不用啟動 WSL 服務，DuckDB 練習預留 0.5 GB RAM。把兩個結果並排記於 `C:\dev\conduit-lab\bd-hive\buckets.md`。若一桶訂單特多但會員不多，取出該桶並按會員計數，檢查有沒有熱鍵（hot key）。相反，幾桶訂單數相近，也不代表此刻任何桶都不會在下一期出現熱鍵。

決定要不要採用時，先說明哪個下游會重複用到這種佈局。若 JOIN 每天換鍵，或引擎不利用桶，維護大量桶只會增加寫入與小檔成本。對既有表，核對實體寫入及查詢計畫；只改表定義不會重排舊檔。

### 寫入者和讀取者要同意

假設歷史檔案由一個工具把訂單平均拆成四份，再用另一工具登記成四桶。四份檔案不代表同會員已合流。只相信宣告就跳過交換可能得出不完整的配對；因此驗收要同時查寫入規則、儲存產物及實際計畫，而不把四這個數字當證據。

## 常見錯誤

- 同一桶有兩個會員 → 把桶號當唯一鍵 → 桶內分組仍用原鍵。
- 用練習餘數猜 Hive 的桶檔名 → 代理不是引擎雜湊 → 查相同版本的寫入規則。
- 兩表桶數相同就期待無交換 → 還需鍵、雜湊與引擎策略相容 → 用計畫驗證。
