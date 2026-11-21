---
id: fd-java-12
module: fd-java
order: 12
title: JAR 打包與執行
subtitle: 把通過測試的解析器交出去
status: ready
minutes: 25
level: 3
prereqs:
  - fd-java-11
objectives:
  - 用 Maven 打包帶入口的 JAR 並列出內部檔案
  - 從不同目錄啟動，分辨未設定入口、缺依賴和缺輸入
tags:
  - jar
  - manifest
  - main-class
  - classpath
resources:
  - title: Oracle：jar 指令
    url: https://docs.oracle.com/en/java/javase/25/docs/specs/man/jar.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看如何列出封裝內含的類別。
  - title: Maven JAR 外掛：入口設定
    url: https://maven.apache.org/plugins-archives/maven-jar-plugin-3.4.2/examples/manifest-customization.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看如何將主類別寫入資訊清單。
  - title: Apache Maven：建置階段
    url: https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 對照 test、package 和 verify。
concepts:
  - id: fd-java-12-entry
    prompt: java -jar 要從哪裡知道啟動類別？
    answer: 讀 JAR 內的 META-INF/MANIFEST.MF 的 Main-Class。
    mcq:
      options:
        - 由目前目錄名猜測
        - 從 POM 即時下載
        - 讀 Manifest 的 Main-Class
        - 必定挑第一個 .class
      answer: 2
      explain: POM 設定由打包外掛寫入成品；JVM 啟動時並不讀專案 POM。
  - id: fd-java-12-thin
    prompt: 有 Main-Class，啟動後卻遇到 NoClassDefFoundError，先查什麼？
    answer: 讀缺的類別名稱與成因，確認執行時的依賴是否可找到。
    mcq:
      options:
        - 先判定沒有 Main-Class
        - 先核對缺少的類別與執行時相依
        - 先把 JAR 改名 .exe
        - 一般 Maven JAR 必含所有依賴
      answer: 1
      explain: 入口與依賴是不同問題；有些同類錯誤也可能來自類別初始化，仍要看成因。
    interview:
      question: 你交一個 JAR 給別人，怎麼證明不是只在 IDE 能跑？
      points:
        - 記最低 Java 目標與依賴策略
        - 從不同工作目錄用產物啟動
        - 核對測試與出口結果
      answer: 我先讓測試跑完才打包，核對 JAR 內入口與類別，再把產物複製到不含原始檔的目錄執行。如果是薄 JAR 且有第三方執行依賴，我會一起交付可重現的載入方式，不期待 IDE 的 class path 跟著走。
  - id: fd-java-12-phase
    prompt: mvn package 和 mvn verify 的關係是什麼？
    answer: package 產出檔案且正常會先跑 unit test；verify 還走到後續驗證階段。
    mcq:
      options:
        - verify 先於 compile
        - package 不含測試階段
        - verify 會走過 package
        - verify 只是解壓 JAR
      answer: 2
      explain: 生命週期累進；是否有額外驗證取決於專案綁定工作。
practice:
  - id: fd-java-12-p1
    title: 把 JAR 交到沒有原始檔的目錄
    kind: build
    minutes: 10
    steps:
      - 套用完整 POM，先確認前課兩項測試通過再打包。
      - 列出 JAR 內容，複製到 jar-handoff 並執行。
      - 存下 README.txt，記入口、目標 Java 與啟動方式。
    checks:
      - JAR 含 lab/ReceiptBatch.class 與 META-INF/MANIFEST.MF。
      - 不同目錄 java -jar 仍回報 batch=morning；未使用 IDE。
---

## 把「我這裡能跑」變成一個可交付的檔案
建置目錄裡有類別檔、來源和測試；接手者不應整包搬走才有辦法啟動。Java 封裝檔（Java archive, JAR）是一種 ZIP 格式封裝，裡面可有位元組碼與資源。普通 JAR 不必可執行；若用 `java -jar`，需資訊清單（manifest）裡的 `Main-Class` 指向含入口的類別。本例保留先前的正式類別，讓測試、封裝和啟動是同一份來源。

## 指令與檔案小抄
- `mvn clean package` 先清本專案的舊產物，再依序編譯、測試、打包；沒設略過測試才有該次測試證據。`verify` 走得更後面，可跑本專案配置的額外查核，並不是 JAR 必要格式。
- `jar tf 檔案.jar` 列封裝內容。入口 `lab.ReceiptBatch` 對應 `lab/ReceiptBatch.class`；不在 JAR 裡找 `src/main/java`。
- `java -jar 檔案.jar` 用 manifest 入口啟動。若沒有這個入口，可在已知類別名時用 `java -cp 檔案.jar lab.ReceiptBatch`，不寫 `.class`。

## 在一個乾淨交接目錄執行
沿用 `C:\dev\conduit-lab\java\receipt-batch`。先完成[〈JUnit 5 單元測試〉](#/lesson/fd-java-08)的修正，讓兩個測試都通過。以新版完整 POM 保留編譯與測試設定，再加打包外掛及入口。

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
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-jar-plugin</artifactId>
      <version>3.4.2</version>
      <configuration>
        <archive><manifest><mainClass>lab.ReceiptBatch</mainClass></manifest></archive>
      </configuration>
    </plugin>
  </plugins></build>
</project>
```

在專案根的 PowerShell 打包。確認成功後才列內容、複製檔案和執行；使用專為這堂練習的 `jar-handoff` 目錄。

```powershell
mvn clean package
if ($LASTEXITCODE -ne 0) { throw 'Maven package failed' }
jar tf .\target\receipt-batch-1.0.0.jar
New-Item -ItemType Directory -Force ..\jar-handoff | Out-Null
Copy-Item .\target\receipt-batch-1.0.0.jar ..\jar-handoff\
Push-Location ..\jar-handoff
try { java -jar .\receipt-batch-1.0.0.jar } finally { Pop-Location }
```

看到 `batch=morning` 才表示本例在新的目錄有實際啟動。這個小程式沒有第三方執行時依賴；JUnit 屬測試範圍，沒有被塞進 JAR。一般薄 JAR（thin JAR）有外部函式庫時，不能假設它已包含每個依賴；需請執行環境提供、明列類別路徑，或選合適的封裝方式。用 `java -jar` 時不要指望命令列 `-cp` 擴充使用者類別路徑；這種啟動方式由 JAR 和其資訊清單決定。稍後[〈Hive UDF 打包與註冊〉](#/lesson/bd-jvm-02)就是另一種交付：由 Hive 而非 `main` 啟動類別。

### 讓別人知道成品的使用條件
交付筆記先寫「用 Java 17 或此實驗已驗的更新版執行、沒有第三方執行依賴、預期會印 `batch=morning`」。另一個人不必知道你用哪個編輯器，也不用將 Maven 安裝到只負責執行成品的機器。相反地，若要重新製作成品，就需要來源、POM、編譯環境和可取得的建置相依。把「執行」與「重新建置」分開，避免將不必要工具列成接手門檻。

若要驗資訊清單文字，在臨時練習目錄使用 `jar xf ... META-INF/MANIFEST.MF` 解出檔案再讀，別在別人的工作目錄覆蓋既有檔。本堂從另一個位置啟動就是更直接的驗收，足以證明入口與簡單執行條件在那次成立。

交付要記下測的是哪份成品，而不是把另一個舊 JAR 的畫面當成本次結果。

## 常見錯誤
- `no main manifest attribute` → 缺了 JAR 入口 → 查外掛設定及這次是不是拿對成品。
- 啟動後缺某個類別 → 執行環境找不到依賴，或有初始化成因 → 從錯誤中辨認類別和第一個原因，再查包與執行路徑。
- 換目錄後找不到輸入檔 → 相對檔案路徑指向工作目錄 → 交接時說明輸入路徑或允許指定絕對路徑。

## 小結
把 JAR 當交接介面：明寫入口、Java 目標與執行依賴，用沒有 IDE 和原始檔的目錄實際跑一次。
