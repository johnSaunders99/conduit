---
id: bd-jvm-03
module: bd-jvm
order: 3
title: Flink DataStream
subtitle: 先把固定事件送到本機輸出
status: ready
minutes: 30
level: 3
prereqs:
  - bd-jvm-02
objectives:
  - 跑一個有明確終點的 Java DataStream 作業
  - 在程式中找出來源、轉換、輸出與提交
tags:
  - flink
  - datastream
  - source
  - sink
  - bounded
resources:
  - title: Apache Flink 2.3：DataStream API
    url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/dev/datastream/overview/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 看 fromData、print 與 execute。
  - title: Apache Flink 2.3：Java 相容性
    url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/deployment/java_compatibility/
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 找推薦的 JDK 和 Java 模組限制。
  - title: Apache Flink 2.3：Maven 設定
    url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/dev/configuration/maven/
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀本機開發和部署時的相依差異。
concepts:
  - id: bd-jvm-03-parts
    prompt: 哪一段是輸出端？
    answer: print 把結果寫到執行端標準輸出。
    mcq:
      options:
        - fromData
        - map
        - print
        - Types.TUPLE
      answer: 2
      explain: 來源給事件、轉換決定欄位，輸出端才消費結果。
  - id: bd-jvm-03-execute
    prompt: 呼叫 map 後，為何還未看到事件輸出？
    answer: 目前只組好工作圖，execute 才提交並跑本機作業。
    mcq:
      options:
        - 已執行但都被丟掉
        - 要 execute 提交工作圖
        - 要先接 Kafka
        - DataStream 只可輸出檔案
      answer: 1
      explain: 固定來源不需要 Kafka；先確認工作開始執行。
    interview:
      question: 怎樣介紹這條 DataStream？
      points:
        - 有終點的固定來源
        - 逐筆轉換和輸出
        - 不等於已驗線上恢復
      answer: 我先用三筆字串，去掉缺鍵再轉成付款鍵和分值，最後印出。execute 提交工作圖，來源讀完便結束。接真實 Kafka 後，我會另驗位移、重播與輸出。
  - id: bd-jvm-03-bounded
    prompt: 印兩列後程式結束，這個現象表示什麼？
    answer: 這次本機有界作業讀完；沒證明長時間來源的延遲、恢復或排序。
    mcq:
      options:
        - Kafka 不會積壓
        - 固定來源已讀完
        - 線上一定不重複
        - 任意平行度都有同一行序
      answer: 1
      explain: 兩行只能驗這組輸入和本機工作圖。
practice:
  - id: bd-jvm-03-p1
    title: 交付事件從來源到輸出的對照
    kind: build
    minutes: 11
    steps:
      - 執行範例，把兩行數據存到 flink-run.txt。
      - 加入合法 P03,450，重跑追出新增一列，再還原原始測資。
      - 在筆記對出 source、filter/map、sink、execute。
    checks:
      - 原版有 (P01,1200)、(P02,550)，不含空鍵；變體多第三筆。
      - 不承諾不同執行器的日誌行序。
---

## 三筆看得到終點的事件，先不用 Kafka
回到[〈無界流與有界流〉](#/lesson/bd-flink-01)：有界來源（bounded source）有已知結尾。這次固定 3 筆付款，讓你能先手算哪些列會走到輸出。DataStream 是 Flink 對事件序列的轉換 API，不是 Java 集合上的 Stream。先用 Java 描述工作圖（job graph），才由執行器啟動，把事件依圖從來源送過轉換，到輸出端。這次只看那條路是否接通，不購買雲端資源也不用連真實系統。

## 語法小抄
- `env.fromData(...)` 建來源（source）。`filter(...)` 保留條件成立的事件；`map(...)` 一筆轉成一筆。兩者只描述轉換。
- `Tuple2<String, Long>` 是一對值：鍵和分值。`.returns(Types.TUPLE(...))` 指定輸出類型，讓引擎以對應方式序列化（serialization，即把值變成可傳送的表示）。
- `.print()` 接輸出端（sink）。`env.execute("...")` 提交作業；`setParallelism(1)` 在本機限制平行實例數，讓輸出好讀，不是生產建議。

## 本機 Windows 終端選 JDK 17
本實驗固定 Flink 2.3.0，依官方相容表選 **JDK 17**，可以和基礎課的 25 並存。另開 PowerShell，輸入真正的 JDK 17 安裝目錄而不是 `bin`。只在這個終端換版本，不必重寫系統設定。建議留 2–3 GB 可用記憶體給小作業和建置；沒有容器。

```powershell
$jdk17 = Read-Host 'JDK 17 installation path (not bin)'
if (!(Test-Path (Join-Path $jdk17 'bin\javac.exe'))) { throw 'JDK path not found' }
$env:JAVA_HOME = $jdk17
$env:Path = "$jdk17\bin;$env:Path"
java -version
mvn -v
```

兩者都應顯示 17，再建立 `C:\dev\conduit-lab\jvm\flink-payments`。根目錄存 `pom.xml`。本機執行不同於交給已裝 Flink 的伺服器，客戶端與運作函式庫要在本機類別路徑。

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>lab.conduit</groupId>
  <artifactId>flink-payments</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.apache.flink</groupId>
      <artifactId>flink-streaming-java</artifactId>
      <version>2.3.0</version>
    </dependency>
    <dependency>
      <groupId>org.apache.flink</groupId>
      <artifactId>flink-clients</artifactId>
      <version>2.3.0</version>
    </dependency>
  </dependencies>
  <build><plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.14.1</version>
    </plugin>
    <plugin>
      <groupId>org.codehaus.mojo</groupId>
      <artifactId>exec-maven-plugin</artifactId>
      <version>3.5.0</version>
    </plugin>
  </plugins></build>
</project>
```

建立 `src/main/java/lab/flink/PaymentJob.java`。只驗小樣本的缺鍵與合法整數，不把 `split` 當通用 CSV 解析器：

```java
package lab.flink;

import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.api.java.tuple.Tuple2;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;

public class PaymentJob {
    public static void main(String[] args) throws Exception {
        var env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setParallelism(1);
        env.fromData("P01,1200", ",900", "P02,550")
            .filter(line -> !line.startsWith(","))
            .map(line -> {
                String[] cols = line.split(",");
                return Tuple2.of(cols[0], Long.parseLong(cols[1]));
            })
            .returns(Types.TUPLE(Types.STRING, Types.LONG))
            .print();
        env.execute("bounded payments");
    }
}
```

從專案根執行；首次取得依賴需網路。

```powershell
mvn compile exec:java '-Dexec.mainClass=lab.flink.PaymentJob'
```

找 `(P01,1200)` 和 `(P02,550)`；被排除的是空鍵，不是金額 900 無效。讀完就結束，和長時間接收事件不同。檢查點（checkpoint）是供失敗恢復的狀態快照；本例不啟用也沒測。[〈檢查點與屏障〉](#/lesson/bd-flink-06)再談怎麼讓引擎與來源從同一個進度接回。

### 從一筆穿過工作圖
`P01,1200` 先從來源流到篩選：它沒有以逗號開頭，因此保留。下一步把逗號前的字串和後方分值組成一對值，輸出端只接到這一對。`,900` 在篩選出局，轉換根本不必解析它的分值。若反過來先轉再驗鍵，雖也可能印出兩筆，這次對錯誤的診斷位置會變。把這兩條路畫在筆記能幫你解釋「是哪個操作少一列」。

若缺鍵列也應被稽核，這堂的 `filter` 會讓它消失在主輸出，不能從兩列成品知道總共拒收幾筆。正式作業還要記拒收數或另有拒收輸出，並驗主輸出加拒收能對上來源。在此先把問題縮到逐筆追蹤。

先在筆記列好三筆的去向，再看引擎印出的數據，才知道漏掉的是規則指定的空鍵，而不是另一筆合法付款。

## 常見錯誤
- 沒輸出 → 可能只建工作圖 → 確認最後有 `execute`。
- 找不到可用的 executor → 可能缺客戶端依賴 → 對照 `flink-clients` 與 API 版本。
- JVM 一啟動就報不支援 → 目標版本並不切換活動 JVM → 同查 `java -version` 和 `mvn -v`。

## 小結
能指出來源、排除條件、輸出及提交位置，就不只是在模仿一條命令。下一堂[〈Flink 作業測試〉](#/lesson/bd-jvm-04)再把最容易多算的重送留成可重跑測資。
