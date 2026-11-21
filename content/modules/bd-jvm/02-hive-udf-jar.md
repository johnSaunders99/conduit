---
id: bd-jvm-02
module: bd-jvm
order: 2
title: Hive UDF 打包與註冊
subtitle: 讓本機查詢叫得到新函式
status: ready
minutes: 30
level: 3
prereqs:
  - bd-jvm-01
objectives:
  - 為指定 Hive 版本打包薄 JAR
  - 在本機連線註冊、查詢、解除
  - 用 DuckDB 核對同型缺值規則
tags:
  - hive
  - add-jar
  - temporary-function
  - provided
  - 'null'
resources:
  - title: Apache Hive：函式 DDL
    url: https://hive.apache.org/docs/latest/language/languagemanual-ddl/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 找暫時函式的 CREATE 與 DROP。
  - title: Apache Hive：部署自訂函式
    url: https://hive.apache.org/docs/latest/language/hiveplugins/
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看 ADD JAR 如何加入類別路徑。
  - title: Apache Hive：Docker 快速開始
    url: https://hive.apache.org/development/quickstart/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看單服務 HiveServer2 與 Beeline。
concepts:
  - id: bd-jvm-02-provided
    prompt: 薄 JAR 應把 hive-exec 一起放進去嗎？
    answer: 不要；provided 供編譯，由相符的 Hive 提供執行類別。
    mcq:
      options:
        - 要，封裝整個引擎
        - 只放引擎不放類別
        - 不要，讓伺服器提供
        - 把 Hive 放 test 範圍即可
      answer: 2
      explain: 避免載入重複版本，且 test 不提供正式來源的編譯依賴。
    interview:
      question: 註冊時出現類別載入錯怎麼查？
      points:
        - 先確認 JAR 由伺服器看見
        - 核對完整類別名、版本和 Java 目標
        - 同一連線驗實際輸出
      answer: 我先用 jar tf 對包名和類別，再確認 HiveServer2 能讀到那份檔案。核對引擎與 Java 相容性，註冊後仍要測 NULL 與普通輸入，不拿一條成功的 DDL 代替實際呼叫。
  - id: bd-jvm-02-session
    prompt: 暫時函式會自動出現在另一個 Beeline 連線嗎？
    answer: 不會；只在目前工作階段有效。
    mcq:
      options:
        - 會，全伺服器共用
        - 會連 DuckDB 一起改
        - 不會，需要在相同工作階段驗
        - 只有重新啟動才能停止使用
      answer: 2
      explain: ADD、CREATE、呼叫及 DROP 應在同一條練習連線內。
  - id: bd-jvm-02-fallback
    prompt: 僅用 COALESCE 為城市補值，漏了哪類輸入？
    answer: 空字串和只含空格的字串不是 NULL，需要先清理再統一。
    mcq:
      options:
        - 原始 NULL
        - 空字串或只有空格
        - 所有正常城市
        - 數字型別才會漏
      answer: 1
      explain: trim 處理兩端空格，NULLIF 把空字串轉成 NULL，最後才有共同的預設分支。
practice:
  - id: bd-jvm-02-p1
    title: 交付並解除一個暫時函式
    kind: hands-on
    minutes: 11
    steps:
      - 在本機練習容器照步驟建立函式、查四列並解除。
      - 保存輸出與 JAR 內容清單。
      - 再試一次函式呼叫確認已找不到；退出並停止只由本次建立的容器。
    checks:
      - 結果依序為 UNKNOWN、UNKNOWN、S07、S07。
      - JAR 內沒有 Hive 與 Hadoop 的引擎類別，不把 DuckDB 判題寫為 Hive 執行。
  - id: bd-jvm-02-p2
    title: 逐列核對缺失城市
    kind: sql
    category: [missing-values, expression]
    minutes: 4
    dataset: shop
    prompt: |-
      用茶舖的 `users`，輸出恰好兩欄 `user_id`、`normalized_city`（欄名和欄順皆如上）。去掉 `city` 兩端的半形空格；若是 NULL 或去空格後為空字串，輸出 `UNKNOWN`；否則保留清理後原值。保留每位會員，依 `user_id` 升冪。
    solution: |
      SELECT user_id, COALESCE(NULLIF(trim(city, ' '), ''), 'UNKNOWN') AS normalized_city
      FROM users
      ORDER BY user_id;
    explain: |-
      `NULLIF` 把空字串變為 NULL，`COALESCE` 再補類別。只用 COALESCE 會漏空字串；本表的缺值為 NULL，Hive 的四列小樣本另驗全空格。這是 DuckDB 內建函式解法，不載入 Java JAR。
    hints:
      - 先去兩端空格
      - 把空字串與 NULL 合流
    check:
      ordered: true
      columnNames: true
    concepts:
      - bd-jvm-01-missing
      - bd-jvm-02-fallback
      - sq-expr-04-blanks
    tags:
      - 缺值
      - 字串清理
  - id: bd-jvm-02-p3
    title: 依標準化城市核對會員數
    kind: sql
    category: [missing-values, aggregate]
    minutes: 4
    dataset: shop
    prompt: |-
      從茶舖的 `users` 依同一規則標準化 `city`：去掉兩端半形空格，NULL 和空字串都歸 `UNKNOWN`。依序輸出 `normalized_city`、`member_count` 兩欄（欄名須相同），後者數該組所有會員列，不排除缺值組。依 `member_count` 降冪，再依 `normalized_city` 升冪。
    solution: |
      WITH normalized AS (
        SELECT COALESCE(NULLIF(trim(city, ' '), ''), 'UNKNOWN') AS normalized_city
        FROM users
      )
      SELECT normalized_city, count(*) AS member_count
      FROM normalized
      GROUP BY normalized_city
      ORDER BY member_count DESC, normalized_city ASC;
    explain: |-
      先標準化再分組。`count(city)` 會漏原始 NULL；這裡要數會員列。DuckDB 不需要註冊 Hive UDF。
    hints:
      - 先做每列轉換
      - 分組後用 count(*)
    check:
      ordered: true
      columnNames: true
    concepts:
      - bd-jvm-01-scalar
      - bd-jvm-01-missing
      - bd-jvm-02-fallback
      - sq-group-01-rows
      - sq-group-03-key
    tags:
      - 分組
      - 缺值
      - 對帳
---

## JAR 存在，不代表伺服器讀得到
上堂驗的是純 Java 規則，這堂把它交給 HiveServer2。伺服器要讀到成品，也要能載入相容的類別。薄 JAR（thin JAR）只封裝自己的程式；Maven 的 `provided` 供編譯，執行時由 Hive 提供。這個單節點實驗固定 Hive 4.2.1、Hadoop 3.4.1 編譯依賴，以基礎課的 JDK 25 建置、輸出目標 17。官方 Hive 4.2.1 容器的執行環境是 Java 21，可載入此目標產物。實際工作若用其他版本，先核對伺服器 JDK、Hive 及 Hadoop，再調整建立成品的設定，不拿練習包直接上線。

## 同一個工作階段的基本語法
- `ADD JAR /path/file.jar;` 將資源加入工作階段；用 JDBC 連遠端時，眼前 Windows 的 `C:\...` 不等於伺服器看得到的路徑。
- `CREATE TEMPORARY FUNCTION name AS '完整類別名';` 把 SQL 名稱和 Java 類別綁在一起。暫時函式（temporary function）只對此工作階段有效。
- `SELECT name(...)` 才是實際呼叫；`DROP TEMPORARY FUNCTION name;` 解除名稱綁定，不是從整個伺服器刪除實體 JAR。

## 送一份來回都看得見的四列測資
沿用 `C:\dev\conduit-lab\jvm\hive-udf` 與上堂兩個原始檔。把下面存成專案根的 `pom.xml`：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>lab.conduit</groupId>
  <artifactId>store-code-udf</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.apache.hive</groupId>
      <artifactId>hive-exec</artifactId>
      <version>4.2.1</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.apache.hadoop</groupId>
      <artifactId>hadoop-common</artifactId>
      <version>3.4.1</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>
  <build><plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.14.1</version>
    </plugin>
  </plugins></build>
</project>
```

從專案根的 PowerShell 執行。Docker Desktop 需用 Linux 容器模式，本容器上限 4 GB；首次 Maven 依賴與 Docker 映像需網路。這個短命容器不映射主機連接埠，不掛載既有數據。若名字衝突就先確認，別取代別人的環境。

```powershell
mvn -v
mvn clean package
if ($LASTEXITCODE -ne 0) { throw 'UDF package failed' }
jar tf .\target\store-code-udf-1.0.0.jar
docker run --rm -d --name hive-udf-lab --memory 4g -e SERVICE_NAME=hiveserver2 apache/hive:4.2.1
docker logs --tail 40 hive-udf-lab
```

清單應含 `lab/hive/StoreCodeUdf.class`。等 HiveServer2 啟動後，送檔並在同容器連線：

```powershell
docker cp .\target\store-code-udf-1.0.0.jar hive-udf-lab:/tmp/store-code-udf.jar
docker exec -it hive-udf-lab beeline -u 'jdbc:hive2://localhost:10000/'
```

以下貼到 **Hive Beeline**，不是 DuckDB。輸入來自查詢內的固定 4 列，不動正式表。排序後兩列 `UNKNOWN`、兩列 `S07`；解除後再試同一函式呼叫，應找不到。用 `!quit` 退出後，回 PowerShell 用 `docker stop hive-udf-lab` 停止本次練習容器；`--rm` 只清掉這個容器。

```sql
ADD JAR /tmp/store-code-udf.jar;
CREATE TEMPORARY FUNCTION normalize_store AS 'lab.hive.StoreCodeUdf';
SELECT ord, normalize_store(raw_code) AS store_code
FROM (
    SELECT 1 AS ord, CAST(NULL AS STRING) AS raw_code
    UNION ALL SELECT 2, '   '
    UNION ALL SELECT 3, ' S07 '
    UNION ALL SELECT 4, 'S07'
) AS fixture_rows
ORDER BY ord;
DROP TEMPORARY FUNCTION normalize_store;
```

接著兩道 DuckDB 題改用茶舖 `users.city` 重演規則，不呼叫 Hive 函式。先依[〈COALESCE〉](#/lesson/sq-expr-04)核對每列，再用[〈COUNT 與缺值〉](#/lesson/sq-group-01)設計各組的總數。那份數據的缺值以 `NULL` 表示；Hive 四列還要另外驗全空格與兩端空格。這兩種驗收各守一個不同的失敗點。

### 容器路徑、函式名稱、規則是三個不同關卡
例如函式名稱已註冊，卻只在收到缺值時失敗，這時反覆重打 `ADD JAR` 未必有用。先在同一條連線對照合法值是否正常，看看錯誤是否只在 `NULL`；若是，再檢查引擎交給 `evaluate` 的輸入。反過來，連任一正常輸入都報找不到函式，應先看工作階段與完整 Java 類別名。這個順序讓你不必同時改 SQL 與 Java，才知道修正的效果。

實務若需要多個使用者共享函式，才評估永久註冊、訪問權限、共用儲存位置和版本回復。這堂刻意只用本機臨時容器，退出之後不必維持一個對其他人可見的新名稱；不拿短命工作階段的結果替正式部署做承諾。

還要確認排序鍵仍存在，才能逐列將 Hive 輸出與手算期望比對。

## 常見錯誤
- 找不到 Java 類別 → 伺服端路徑或包名不符 → 用 `jar tf` 和容器內路徑查起。
- `UnsupportedClassVersionError` → 產物 Java 版本太新 → 對照容器內 Java 和 `release`。
- 剛成功卻查不到函式 → 切換了連線或已解除 → 對照同一工作階段。

## 小結
驗收關鍵不是「DDL 不報錯」，而是工作階段內能用反例對帳，解除後也能觀察它不再可用。
