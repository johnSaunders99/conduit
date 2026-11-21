---
id: fd-java-07
module: fd-java
order: 7
title: Maven 專案與相依套件
subtitle: 換一臺電腦仍能編譯
status: ready
minutes: 35
level: 2
prereqs:
  - fd-java-06
objectives:
  - 建立標準 Maven 目錄並宣告專案座標、編譯目標
  - 依失敗訊息分辨下載環節與編譯環節
tags:
  - maven
  - pom
  - dependency
  - release
resources:
  - title: Apache Maven：安裝指南
    url: https://maven.apache.org/install.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 查 Windows 的 bin 路徑與版本檢查。
  - title: Apache Maven：第一個專案
    url: https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀標準目錄與 POM 座標。
  - title: Apache Maven：Java 目標版本
    url: https://maven.apache.org/guides/mini/guide-java-target.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 理解 release 如何限制 JDK API。
concepts:
  - id: fd-java-07-pom
    prompt: 在哪個檔案能讓另一台電腦按同樣的規格建置？
    answer: pom.xml 記錄專案座標、編譯條件、依賴與外掛。
    mcq:
      options:
        - pom.xml
        - ReceiptBatch.class
        - IDE 歷史紀錄
        - jdk-check.txt
      answer: 0
      explain: 編譯產物與 IDE 記錄不能取代 Maven 的可重建設定。
  - id: fd-java-07-release
    prompt: 用 JDK 25 執行 Maven，release=17 限制的是什麼？
    answer: 限制本專案使用的 Java 語言、輸出類別版本與標準 API 目標。
    mcq:
      options:
        - 替系統自動安裝 17
        - 替所有外部依賴降級
        - 限制本次 Java 原始碼、位元組碼與標準 API
        - 只改目錄名
      answer: 2
      explain: 搭配目標執行環境需另驗依賴；release 不是 JDK 安裝器。
  - id: fd-java-07-diagnose
    prompt: 第一個關鍵訊息是 Could not resolve dependencies，先查哪裡？
    answer: 先核對座標、儲存庫可達性與下載錯誤，不先改業務程式。
    mcq:
      options:
        - 先把所有套件版本拿掉
        - 先修類別的分號
        - 先清整個本機套件快取
        - 先看相依座標與下載訊息
      answer: 3
      explain: 相依尚未取得就不能據此判定 Java 語法錯。
    interview:
      question: 別人的 Maven 建置失敗，你如何縮小範圍？
      points:
        - 比對 mvn -v 與 pom.xml
        - 先看第一個解析或編譯錯
        - 不用清掉整個快取當第一步
      answer: 我先確認在有同一份 POM 的根目錄，記下 mvn -v 和 Java 版本。若先卡下載就找是哪個座標或儲存庫；若找到類別與行號，我會重現那個編譯錯。改一個原因再跑同一個指令。
practice:
  - id: fd-java-07-p1
    title: 讓一份新目錄也能編譯
    kind: build
    minutes: 11
    steps:
      - 建立範例目錄與檔案，執行 mvn -v、mvn clean compile 與 java。
      - 只在自己的練習來源暫時移除一個分號，重新執行 mvn clean compile；記下首個錯誤再還原。
      - 在 build-notes.txt 留 Maven 使用的 JDK、目標版本與恢復後的輸出。
    checks:
      - 編譯成功可找到 target/classes/lab/ReceiptBatch.class，執行顯示 batch=morning。
      - 錯版有來源檔與行號，不會當成下載失敗；還原可重跑。
---

## 不把上次敲過的指令交給下一個人
手動編譯一支程式沒問題；當專案有多檔、測試與外部套件，口頭描述容易漏掉版本。Maven 是建置工具（build tool）：以專案物件模型（Project Object Model, POM）的 `pom.xml` 說明怎麼建。類似 Python 專案把依賴版本寫進檔，但這裡還明定編譯目標和測試階段。先做一個不依賴外部業務套件的小專案，隔堂再加 JUnit。

## 目錄與指令小抄
- `pom.xml` 與 `src` 同層；`src/main/java` 放正式原始碼，`src/test/java` 放測試，`target` 是產物，不是編輯來源。
- `groupId / artifactId / version` 合起來是座標（coordinates）。`dependencies` 宣告正式程式或測試使用的函式庫；`build/plugins` 宣告建置時執行工作的外掛，不要互換。
- `mvn -v` 看 Maven 與實際 JDK；`mvn clean compile` 先清此專案的建置產物再編譯。`test` 和 `package` 是往後的生命週期（lifecycle）階段，下一堂與[〈JAR 打包與執行〉](#/lesson/fd-java-12)會用。
- `release` 指定可以使用的語言與標準 API，以及產物的 Java 目標版本。本專案以 JDK 25 建置、目標 Java 17 來示範差別；這不會替外部依賴變更版本。

## 從一個空練習專案開始
依 Apache 官方安裝指引採穩定的 Maven 3.9 系列，讓它的 `bin` 在自己的 PATH；重新開啟 PowerShell，先確認 `mvn -v` 用的是前幾課選的 JDK。建置第一次可能下載外掛到 Maven 的本機儲存庫，通常在個人的 `.m2/repository`；它不是專案來源。不要把能連網的初次下載和離線重現混在一起。

建立 `C:\dev\conduit-lab\java\receipt-batch`。把下面的檔案存成專案根的 `pom.xml`。

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
  <build><plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.14.1</version>
    </plugin>
  </plugins></build>
</project>
```

再存 `src/main/java/lab/ReceiptBatch.java`；`package lab;` 是套件名稱，對到 Java 來源根下的 `lab`。在專案根的 PowerShell 跑下列指令，不在原始檔的子目錄跑 Maven。

```java
package lab;

public class ReceiptBatch {
    public static void main(String[] args) {
        System.out.println("batch=morning");
    }
}
```

```powershell
mvn -v
mvn clean compile
java -cp .\target\classes lab.ReceiptBatch
```

只有編譯成功後才跑最後一行，應看到 `batch=morning`。下堂要新增的是測試相依：它只能在測試需要的階段取用，不是讓所有程式都依賴測試框架。

### 先知你在重建什麼
第一次能編譯只說明手上有一份可用產物。用 `clean compile` 再跑一次，可以排除「其實執行到舊 class」；但本機儲存庫可能已有外掛，所以不能拿第二次成功宣稱在隔離網路或另一個版本的 JDK 也會過。把實際 Maven／Java 版本、POM 和指令寫在筆記裡，遇到不同環境才有一個公平對照。

之後加入依賴時，`groupId` 區分提供者的命名空間，`artifactId` 是成品名，`version` 是選定版本。不是在 `pom.xml` 隨便填本機 JAR 的路徑：管理座標讓其他人能解析同一物件。也別在遇到版本不相容就一律升到最新，先問自己是建置 JDK 不符、專案用到比目標新的 API，還是某個外部套件本身不支援目標。

如果是下載或權限問題，先保留錯誤訊息與失敗座標，稍後可用同一份設定重現。

## 常見錯誤
- Maven 說沒找到 POM → 終端在子目錄或別的專案 → 回到含 `pom.xml` 的資料夾。
- 顯示下載或解析失敗 → 先檢查哪個座標與儲存庫 → 不改語法或整批清快取。
- 顯示檔案與行號 → 已進入編譯階段 → 對照第一個來源錯誤，不把後續錯誤逐條亂改。

## 小結
交付 `pom.xml`、來源目錄和一條可重跑的命令。知道錯發生在下載還是編譯，下一個人就不用從頭猜。
