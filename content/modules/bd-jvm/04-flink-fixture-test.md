---
id: bd-jvm-04
module: bd-jvm
order: 4
title: Flink 作業測試
subtitle: 同一批事件再跑一次
status: ready
minutes: 30
level: 3
prereqs:
  - bd-jvm-03
objectives:
  - 用固定事件的 JUnit 案例守住批次去重與缺值規則
  - 重跑 Flink 本機輸出並說明外部恢復的未驗範圍
tags:
  - flink
  - junit
  - fixture
  - idempotency
  - replay
resources:
  - title: Apache Flink 2.3：DataStream 測試
    url: https://nightlies.apache.org/flink/flink-docs-release-2.3/docs/dev/datastream/testing/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 分辨測函式和測整段作業。
  - title: JUnit 5：撰寫測試
    url: https://docs.junit.org/5.14.1/writing-tests/intro.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀如何寫出固定輸入與斷言。
concepts:
  - id: bd-jvm-04-fixture
    prompt: 哪組付款可同時露出漏重送和按金額錯去重？
    answer: 同鍵原樣重送、空鍵、同價異鍵。
    mcq:
      options:
        - 只用空清單
        - 只用一筆付款
        - 同鍵原樣重送、空鍵、同價異鍵
        - 全部是異鍵異價
      answer: 2
      explain: 同價異鍵抓不該合併的數據，重送抓多算，空鍵驗拒絕。
  - id: bd-jvm-04-bound
    prompt: 相同固定批次跑 2 次，都印 2 筆，能說外部表一定不重複？
    answer: 不能；本機輸出和外部提交是兩層不同驗收。
    mcq:
      options:
        - 能，JUnit 會替外部服務回復
        - 能，print 自動有事務
        - 不能，還缺外部提交及恢復
        - 能，只要先排序
      answer: 2
      explain: 同樣的計算結果仍可能被寫入兩次。
    interview:
      question: 你會如何補一個恢復驗收？
      points:
        - 選擇中斷時點
        - 比較來源進度及最終表
        - 查輸出提交假設
      answer: 先守住轉換。再在隔離環境選一個輸出已寫、來源進度還沒確認的時點中斷，復原後對唯一鍵、筆數和總額。我會確認輸出端確實支援這個恢復策略。
  - id: bd-jvm-04-order
    prompt: 為什麼不比對兩份含引擎日誌的完整文字？
    answer: 日誌的時間等與數據無關；核對數據鍵、金額與筆數。
    mcq:
      options:
        - 所有日誌一定相同
        - 只需要比檔案大小
        - 挑數據列並核對筆數
        - 忽略所有重複數據列
      answer: 2
      explain: 忽略非數據日誌，不等於忽略多出來的數據。
practice:
  - id: bd-jvm-04-p1
    title: 留下一份雙層重跑驗收
    kind: build
    minutes: 11
    steps:
      - 跑 JUnit 原版，再暫時改成保留每筆合法數據，確認重送案失敗後恢復。
      - 更新 PaymentJob，對固定輸入執行兩次，將兩組輸出寫入 fixture-notes.txt。
      - 另寫一個未驗的外部中斷情境。
    checks:
      - JUnit 有 2 項通過；兩次本機作業各輸出 P01、P02，各為 1200 分。
      - 未驗情境包含寫入成功但確認前中斷。
---

## 讓錯法先有機會失敗
上一堂逐筆過濾空鍵；一筆合法事件重送時仍會多算。現在用固定測資（fixture）把小批次規則寫清楚：批次內同鍵保留第一次，空鍵拒收，同價但鍵不同仍是兩筆。這比準備 100 筆都不同的數據更容易查出錯法。程式分成「規則正不正確」和「引擎有沒有把結果送到輸出端」兩層，不讓測試輸出替代業務斷言。

一個細節：這堂在提交前整理事先已知、可放進記憶體的測試批次。它不是 Flink 多分區的即時去重方案。分散式作業不能各自建臨時 Set，就宣稱所有工作者與重新啟動之間都共用同一份見過清單。正式的鍵控狀態和進度恢復需要引擎及輸出端配合。

## 在原專案加上固定反例
沿用 `C:\dev\conduit-lab\jvm\flink-payments` 與 JDK 17 終端。根目錄的 POM 換成下面版本；保留 Flink 與啟動外掛，增加測試範圍的 Jupiter 相依與 Surefire。

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
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.14.1</version>
      <scope>test</scope>
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
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-surefire-plugin</artifactId>
      <version>3.5.4</version>
    </plugin>
  </plugins></build>
</project>
```

將純函式存於 `src/main/java/lab/flink/BatchFixture.java`。`LinkedHashMap` 保留鍵的插入順序，`putIfAbsent` 只放尚未存在的鍵。測資每列都含固定分隔符，測空鍵，不測任意來源檔。

```java
package lab.flink;

import java.util.LinkedHashMap;
import java.util.List;

public class BatchFixture {
    public static List<String> uniqueRows(List<String> input) {
        var byId = new LinkedHashMap<String, String>();
        for (String row : input) {
            String id = row.substring(0, row.indexOf(','));
            if (!id.isEmpty()) byId.putIfAbsent(id, row);
        }
        return List.copyOf(byId.values());
    }

    public static List<String> sample() {
        return List.of("P01,1200", "P01,1200", ",900", "P02,1200");
    }
}
```

在 `src/test/java/lab/flink/BatchFixtureTest.java` 明寫兩個期望，讓空鍵錯和重送錯各有線索。

```java
package lab.flink;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class BatchFixtureTest {
    @Test void ignoresMissingKey() {
        assertEquals(List.of(), BatchFixture.uniqueRows(List.of(",900")));
    }

    @Test void removesReplayButNotSameAmount() {
        var expected = List.of("P01,1200", "P02,1200");
        assertEquals(expected, BatchFixture.uniqueRows(BatchFixture.sample()));
        assertEquals(expected, BatchFixture.uniqueRows(BatchFixture.sample()));
    }
}
```

跑 `mvn test`，確認兩項實際執行。暫時改為把每筆合法字串加入清單，重送案會多一筆；恢復原版後重跑。接著把 `PaymentJob.java` 的 `env.fromData("P01,1200", ",900", "P02,550")` 改成 `env.fromData(BatchFixture.uniqueRows(BatchFixture.sample()))`；從根目錄重跑前課的 `mvn compile exec:java '-Dexec.mainClass=lab.flink.PaymentJob'` 兩次。驗每次都有且只有 `(P01,1200)`、`(P02,1200)`；兩次引擎日誌不必相同，重複數據列卻不能忽略。

固定測資可以驗單次批次重算結果一致，不能證明外部系統具冪等性（idempotency，即同樣操作再次執行仍有相同效果）。若要宣稱重跑不重複寫入，至少還要用隔離輸出端驗一次「寫成功、確認進度之前中斷」以及恢復後的持久化結果。

### 值相同不代表外部效果相同
假設兩輪都算出二筆，第一輪已寫成功，第二輪又對外部表追加同樣二筆。你的本機日誌看來完全合理，最終表卻是四筆。這是為何驗收要問「觀察哪個系統的狀態」，而不只問是否重跑成功。如果輸出用事件鍵更新，同鍵衝突、失敗時點與跨批窗口仍有各自契約；保留第一次不會處理所有更正事件。先用固定一案圈出一層風險，下一層另立驗收，不用一個綠燈代表全部。

保留每次的測試與作業輸出，是為了讓不同層的查核即使失敗也能被分開追蹤。

## 常見錯誤
- 重送案總是綠 → 測資沒同鍵事件 → 補原樣重送與同價異鍵。
- 只比較鍵集合 → 重複的輸出可被集合吞掉 → 同時比筆數與數值。
- 宣稱不會重灌外部表 → 尚未觀察提交 → 另做實際寫入與故障恢復的對帳。

## 小結
先讓純函式的反例可以反覆跑，再辨認 Flink 輸出是哪一層證據。一次「看起來成功」不替代另一層的失敗驗收。
