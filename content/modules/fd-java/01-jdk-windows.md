---
id: fd-java-01
module: fd-java
order: 1
title: JDK 與 Windows 安裝
subtitle: 先讓終端認得 Java
status: ready
minutes: 25
level: 1
prereqs: []
objectives:
  - 從支援表選出 Java 的長期支援版
  - 用 PowerShell 確認執行器與編譯器來自同一套 JDK
tags:
  - jdk
  - windows
  - path
  - java-home
resources:
  - title: Adoptium：Windows 安裝 Temurin
    url: https://adoptium.net/installation/windows/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 找 MSI、PATH 與 JAVA_HOME 選項。
  - title: Oracle：Java SE 支援路線
    url: https://www.oracle.com/java/technologies/java-se-support-roadmap.html
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: 看哪些發行版屬於長期支援版。
concepts:
  - id: fd-java-01-kit
    prompt: 只裝能執行 Java 的環境，哪個工具可能缺少？
    answer: 編譯器 javac；寫 Java 需要 JDK。
    mcq:
      options:
        - javac
        - PowerShell
        - 文字編輯器
        - 檔案總管
      answer: 0
      explain: 後三者都不屬於 Java 工具鏈；有 java 不代表也有 javac。
  - id: fd-java-01-path
    prompt: PATH 和 JAVA_HOME 各在做什麼？
    answer: PATH 是終端搜尋指令的路徑；JAVA_HOME 通常是建置工具讀取的 JDK 根目錄。
    mcq:
      options:
        - 兩者皆存 java.exe 的完整檔名
        - PATH 找指令，JAVA_HOME 指 JDK 根目錄
        - JAVA_HOME 會自動覆蓋所有 PATH
        - 兩者都應指練習資料夾
      answer: 1
      explain: 終端不因 JAVA_HOME 被設定就改用那個 java。JDK 根目錄的下一層才是 bin。
  - id: fd-java-01-ltk
    prompt: 為什麼練習選 LTS，部署又不一定選同一版？
    answer: LTS 較適合固定學習環境；部署還要依引擎、編譯目標和執行環境的相容性。
    mcq:
      options:
        - LTS 永遠可替換伺服器上的舊版
        - LTS 不需安裝安全更新
        - 先固定學習版，部署另看相容表
        - 有 javac 就不必核對執行版
      answer: 2
      explain: LTS 仍有更新；可編譯和能在目標環境執行是兩件事。
practice:
  - id: fd-java-01-p1
    title: 留一張 Java 環境收據
    kind: hands-on
    minutes: 8
    steps:
      - 完成安裝後，在新的 PowerShell 執行本堂檢查指令。
      - 在收據記下生效的大版本及 java 和 javac 是否同源；不分享含使用者名稱的路徑。
    checks:
      - java 和 javac 都出現版本，且主要版本相同。
      - 第一個命中的 java.exe、javac.exe 都在同一套 JDK 的 bin 下。
---

## 先回答：這個終端到底在用哪一套 Java？
你已經用過 `py` 跑 Python 訂單腳本。Java 多了兩個要分清的角色：`javac` 把原始檔編譯成位元組碼，`java` 啟動 Java 虛擬機（Java Virtual Machine, JVM）去執行它。Java 開發套件（Java Development Kit, JDK）把這兩個工具和標準函式庫一起提供。只看到 `java` 成功不代表環境就能開發；例如舊的執行環境可啟動別人寫好的程式，卻沒有 `javac`。今天先驗環境，下一堂[〈javac、java 與編輯器〉](#/lesson/fd-java-02)再存第一支程式。

## 選一套 JDK，不用先清掉舊版
純 Java 練習用目前的長期支援版（long-term support, LTS）JDK 25 的更新版；不是按下載頁版本最大的數字來挑。到資源的 Temurin 官方安裝頁，選 Windows 對應架構的 JDK（一般 Intel／AMD 選 x64；ARM 裝置才選相符的 ARM64）。使用有權限的安裝範圍。安裝選項若可用，讓 JDK 的 `bin` 加到路徑（PATH），讓 `JAVA_HOME` 指到 JDK 根目錄；它不應以 `\bin` 或 `java.exe` 結尾。受管電腦先走既有軟體安裝流程，不需要為了練習更改系統安全設定。

同一台電腦可能因為舊作業同時保留好幾個 Java。練習選 25 不代表叢集也用 25：像 Flink 要先看引擎文件支援哪些 Java；日後學[〈Flink DataStream〉](#/lesson/bd-jvm-03)會在單一終端選定實驗所需的 JDK。今天不要移除其他版本，也不要把 `PATH` 全部置換成一條 Java 路徑。

## 查版本、查位置，再寫環境收據
關掉舊的 PowerShell 視窗後重新開啟。下面在新視窗執行；若 C 槽不可寫，以 D 槽取代整套課程路徑。`Get-Command` 列出找到的應用程式，第一個通常是你直接輸入完整執行檔名稱時會命中的那個；`-All` 會讓舊版也看得見。

```powershell
New-Item -ItemType Directory -Force 'C:\dev\conduit-lab\java' | Out-Null
Set-Location 'C:\dev\conduit-lab\java'
java -version
javac -version
Get-Command java.exe -All | Select-Object -ExpandProperty Source
Get-Command javac.exe -All | Select-Object -ExpandProperty Source
$env:JAVA_HOME
@(
  'runtime:'
  (java -version 2>&1 | ForEach-Object { "$_" })
  'compiler:'
  (javac -version 2>&1 | ForEach-Object { "$_" })
) | Set-Content -Encoding UTF8 .\jdk-check.txt
```

收據裡應各有一個主要版本 25，且畫面上兩個首先命中的程式屬於同一個根目錄。這份收據是重現線索，不是把所有安裝路徑交給別人；若要公開作品，只轉抄版本與核對結果。再確認 `JAVA_HOME` 展開後和那個根目錄一致，因為之後 Maven 有自己的取用規則。系統的其他應用能否用原本的 Java，和這次終端的選擇並不衝突。

### 路徑衝突可以先做一次不留痕的核對
假設電腦仍需舊版給另一個工具，兩套同時出現在清單不必然是錯誤。先找到你剛選裝的根目錄，在檔案總管確認它底下真的有 `bin\javac.exe`。若需要分辨是安裝還是路徑問題，可在 PowerShell 用叫用運算子 `&` 加上該執行檔的完整路徑，再接 `-version`。完整路徑能跑而短指令不行，就不必重裝；要查的是短指令的搜尋順序。可以參考後面 Flink 的單視窗做法，不影響其他程式。

## 常見錯誤
- 終端找不到 `javac` → 可能只選了執行環境或終端仍看舊設定 → 先確認安裝的是 JDK，再用新視窗檢查。
- `java` 顯示 11、`javac` 顯示 25 → 不同安裝先後被找到 → 看兩份 `Get-Command -All` 的第一筆，再調整使用者環境的順序。
- 版本正確、Maven 日後卻說找不到 Java → `JAVA_HOME` 可能指到 `bin` 或空目錄 → 設為實際存在、底下含 `bin` 的 JDK 根目錄。

## 小結
記住兩張不同的證據：版本說明「是什麼」，路徑說明「從哪裡來」。兩者都核對了，再開始編譯。
