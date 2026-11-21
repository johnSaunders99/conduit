---
id: fd-java-08
module: fd-java
order: 8
title: JUnit 5 單元測試
subtitle: 讓重送案例在修正前先失敗
status: ready
minutes: 30
level: 2
prereqs:
  - fd-java-07
objectives:
  - 用 Jupiter 寫正常單和重送反例
  - 讀取 mvn test 的測試數、預期值和實際值
tags:
  - junit
  - jupiter
  - assertions
  - surefire
resources:
  - title: JUnit 5：撰寫測試
    url: https://docs.junit.org/5.14.1/writing-tests/intro.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 Jupiter 的測試方法和斷言。
  - title: Apache Maven：建置階段
    url: https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 對照 test 與 package 的先後。
  - title: Maven Surefire：JUnit Platform
    url: https://maven.apache.org/surefire-archives/surefire-3.5.4/maven-surefire-plugin/examples/junit-platform.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看測試如何被 Maven 尋找與啟動。
concepts:
  - id: fd-java-08-assert
    prompt: 斷言要先寫期望還是實際？
    answer: 這個 JUnit assertEquals 多載先放期望值，再放實際回傳。
    mcq:
      options:
        - actual 在前
        - expected 在前
        - 一定要把兩者格式化成字串
        - 只能比較 true 與 false
      answer: 1
      explain: 順序顛倒仍可能判為失敗，但錯誤訊息的期望與實際會顛倒。
  - id: fd-java-08-fixture
    prompt: 哪個輸入能區分「逐筆累加」與「依事件鍵去重」？
    answer: 相同事件鍵出現兩次的數據，並用兩個同價異鍵的事件避免誤按金額去重。
    mcq:
      options:
        - 只放一筆訂單
        - 兩個都沒有金額
        - 同鍵重送再加同價異鍵
        - 只測 Maven 能啟動
      answer: 2
      explain: 含兩種對照能驗證規則，而不是證明這次恰好總額相同。
    interview:
      question: 別人說程式手動跑過，不必寫重送測試，你怎麼回？
      points:
        - 一個會讓錯解失敗的固定輸入
        - 斷言手算值與重送規則
        - 明講測試的邊界
      answer: 我會保留一個事件加原樣重送，再放一筆同價但不同鍵的事件。手算兩筆而不是一筆或三筆。測試直接叫加總函式，不表示讀檔或批次恢復也正確。
  - id: fd-java-08-zero
    prompt: '終端顯示 Tests run: 0，這代表什麼？'
    answer: 沒有執行案例；要重新確認測試位置、命名和測試執行器。
    mcq:
      options:
        - 所有斷言都已通過
        - 一個測試壞了
        - 沒有執行測試
        - 正式程式沒有任何類別
      answer: 2
      explain: 先確認案例真被找到，再看通過率。
practice:
  - id: fd-java-08-p1
    title: 留下一紅一綠的 JUnit 證據
    kind: code
    minutes: 12
    steps:
      - 放好 POM 和兩個來源檔，跑 mvn test 並記下由重送造成的失敗。
      - 只依規則修正加總方法，不改期望值，重跑相同命令。
      - 保存測試檔與 pre-post.txt，記錄兩次測試數與哪個案例改變。
    checks:
      - 初次 2 個測試中 1 個失敗，重送案 expected 1600、actual 2400。
      - 修正後執行 2 個、失敗 0 個；正常案仍通過。
---

## 不是看到綠燈就好，要先看一道真的會紅的題
這個收據批次收到 E01 的原樣重送，還有同價的 E02。正確規則是每個事件鍵取第一筆，而不是每個金額只算一次。故意保留一個逐筆加總的錯版，讓測試揭露它多算了哪一筆。固定測資（test fixture）就是測試前事先指定的輸入；不要和當天的來源檔綁在一起，否則你分不出是規則變了還是數據換了。

## 三個位置
- `@Test` 標示測試方法，JUnit Jupiter 是 JUnit 5 的測試寫法。Maven Surefire 外掛在 `test` 階段找測試類別、委託測試平台執行並回報。
- `assertEquals(expected, actual)` 是斷言（assertion），期望先寫。期望從題意和手算得出，不從目前的回傳值抄。
- 測試放在 `src/test/java`，相依的 `scope` 是 `test`。正式程式不應引用 Jupiter，測試才可以呼叫正式程式。

## 在原專案留下第一個重送反例
沿用 `C:\dev\conduit-lab\java\receipt-batch` 與上堂的 `ReceiptBatch.java`。以下是本階段的完整 `pom.xml`，在自己的練習專案更新它；保留編譯版本，新增一個測試相依及一個測試外掛。

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>lab.conduit</groupId>
  <artifactId>receipt-batch</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
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
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-surefire-plugin</artifactId>
      <version>3.5.4</version>
    </plugin>
  </plugins></build>
</project>
```

在 `src/main/java/lab` 建立 `ReceiptMath.java`。先讓程式編得過，但故意逐筆全部相加：

```java
package lab;

import java.util.List;

public class ReceiptMath {
    public record Payment(String id, long cents) {}

    public static long total(List<Payment> payments) {
        long result = 0;
        for (Payment payment : payments) {
            result += payment.cents();
        }
        return result;
    }
}
```

在 `src/test/java/lab` 建立 `ReceiptMathTest.java`：

```java
package lab;

import java.util.List;
import lab.ReceiptMath.Payment;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ReceiptMathTest {
    @Test void onePayment() {
        assertEquals(800L, ReceiptMath.total(List.of(new Payment("E01", 800))));
    }

    @Test void duplicateButNotEqualPrice() {
        var a = new Payment("E01", 800);
        var b = new Payment("E02", 800);
        assertEquals(1600L, ReceiptMath.total(List.of(a, a, b)));
    }
}
```

回到專案根執行 `mvn test`。找到名稱含 `duplicateButNotEqualPrice` 的失敗：期望 1600，實際 2400。另一項應通過。如果畫面只提下載，就尚未驗到規則；先處理下載或相依的錯誤。

只改 `ReceiptMath.total`：在迴圈之前建立 `var seen = new java.util.HashSet<String>();`，將累加改為 `if (seen.add(payment.id())) { result += payment.cents(); }`。重跑 `mvn test`，應看到 2 項執行、0 項失敗。原樣重送與同價異鍵同時存在，所以按金額去重也會被抓出來。這是單元測試（unit test），不開檔也不連系統；它檢查的是規則，不能藉此宣稱整條管道都會復原。

### 兩個通過條件不可互相取代
假如修正時寫成「相同金額只算一次」，重送案的實際值會掉到 800；正常單仍然通過。這正是同價異鍵都要留在測資的理由。若只有原樣重送兩筆、期望一筆，按事件鍵和按金額去重都會通過，你測不出真正的錯法。一個反例最好能指出偏離的是哪條規格，而不只是使畫面變紅。

把第一次紅的名稱與數值抄下來再修，既可在面試證明證據與行動的順序，也方便同事理解後面那一筆看似多餘的測資。真實工作還可以加一項「同鍵但內容不同」的衝突案例；它要先決定是否拒絕、告警或讀更正版本，不應用這堂的原樣重送規則默默蓋過。

## 常見錯誤
- `Tests run: 0` → 檔名或位置不合測試慣例，或沒配置測試 → 檢查路徑、`*Test.java` 與 POM。
- 重送案紅了就把期望改成 2400 → 用錯誤回傳替規格背書 → 先用兩個事件鍵手算，修程式不改答案。
- 突然只剩 1 項測試 → 可能把紅燈案例停用了 → 比對案例名稱與執行數，而不只讀最後一行。

## 小結
測試要在規則被破壞時為正確的原因失敗。兩筆同價異鍵加一筆重播，已足以分出三種結果。
