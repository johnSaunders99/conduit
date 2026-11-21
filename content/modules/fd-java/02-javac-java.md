---
id: fd-java-02
module: fd-java
order: 2
title: javac、java 與編輯器
subtitle: 先從終端印出一張小票
status: ready
minutes: 30
level: 1
prereqs:
  - fd-java-01
objectives:
  - 把 Receipt.java 編譯成類別檔，從終端執行
  - 在 VS Code 重跑同一份原始檔並核對輸出
tags:
  - javac
  - class
  - main
  - vscode
resources:
  - title: Oracle：javac 指令
    url: https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看原始檔和編譯產物的關係。
  - title: Oracle：java 啟動器
    url: https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀類別模式和原始檔模式的指令差異。
  - title: VS Code：Java 入門
    url: https://code.visualstudio.com/docs/java/java-tutorial
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀如何執行第一個 Java 程式。
concepts:
  - id: fd-java-02-artifact
    prompt: 成功編譯 Receipt.java 後，哪個檔案才是 JVM 的執行輸入？
    answer: 這次兩步流程用的是 Receipt.class 內的位元組碼。
    mcq:
      options:
        - Receipt.java
        - Receipt.class
        - jdk-check.txt
        - Receipt.exe
      answer: 1
      explain: 這次先編譯再啟動類別；不是直接執行原始檔，也不會建立 Windows 執行檔。
  - id: fd-java-02-entry
    prompt: java Receipt 的 Receipt 是什麼？
    answer: 要啟動的類別名稱，不是有副檔名的檔案。
    mcq:
      options:
        - 要啟動的類別名
        - 檔案完整路徑
        - 終端用的參數檔
        - JDK 安裝代號
      answer: 0
      explain: 傳入 Receipt.class 會被當作類別名稱，不是檔案名。
  - id: fd-java-02-stale
    prompt: 不改輸出，只修改並儲存原始碼後，為何終端可能仍印舊金額？
    answer: java Receipt 不會重編來源；要先成功執行 javac。
    mcq:
      options:
        - java 自動回復舊程式
        - class 檔照原樣執行
        - println 只允許印一次
        - PowerShell 不讀取新內容
      answer: 1
      explain: 在本課的兩步流程中，舊 class 檔可以存在；編譯沒過時先修錯。
practice:
  - id: fd-java-02-p1
    title: 在終端與編輯器各印一張小票
    kind: code
    minutes: 10
    steps:
      - 執行範例，記錄原始輸出以及 Receipt.class 的存在。
      - 把金額 1250 改為 1600，重新編譯、執行；再用 VS Code 執行相同檔案。
      - 保留 Receipt.java 和 receipts.txt，後者記兩次金額及使用的指令。
    checks:
      - 第一次是 order=T01 cents=1250，第二次是 order=T01 cents=1600。
      - 編輯器與終端在最後一版顯示相同金額。
---

## 把一張訂單印到終端
在 Python 把 `print(...)` 放在檔案頂端，`py receipt.py` 就能跑。這裡刻意拆成編譯（compile）和執行（run）兩步，這樣後面看到交付物才知道它來自哪裡。編譯先檢查語法與類型，再把程式轉成位元組碼（bytecode）；虛擬機讀的是這個格式，不是 Windows 專用機器指令。今天只讀一行輸出，還不需要解析真的訂單檔。

## 最小形式
- `public class Receipt { ... }` 宣告公開類別（class）。有這個公開類別的原始檔叫 `Receipt.java`，大小寫一致。大括號劃出類別和方法各自的範圍。
- `public static void main(String[] args)` 是這個範例的入口（entry point）。`static` 讓啟動器不用先建立物件就能呼叫，`void` 表示不傳回值，`String[] args` 是指令列參數陣列；今天先不讀它。類別和物件會在[〈類別、介面與 Record〉](#/lesson/fd-java-04)細講。
- `System.out.println(...)` 印出一整列，敘述用分號收尾；和 Python 的 `print` 一樣適合先確認程式有走到這裡。`"..."` 是字串，不能用單引號包多個字元。

## 在終端寫下第一張收據
在 `C:\dev\conduit-lab\java` 新增 `Receipt.java`。檔名不要讓文字編輯器補上 `.txt`；存檔之後才切回 PowerShell。

```java
public class Receipt {
    public static void main(String[] args) {
        System.out.println("order=T01 cents=1250");
    }
}
```

在同一資料夾依序執行，編譯有錯就停在第一步，不要拿舊產物試：

```powershell
javac .\Receipt.java
Get-Item .\Receipt.class | Select-Object Name, Length
java -cp . Receipt
```

`-cp .` 把目前目錄當類別搜尋路徑（class path），所以即使電腦另有預設設定，你也明確告訴啟動器去哪找。`Get-Item` 是刻意多看一眼：它確認中間產物存在，但不能證明它來自最新的修改。最後一行應顯示 `order=T01 cents=1250`。近代 Java 也能用 `java Receipt.java` 以原始檔模式啟動，兩種形式都合理；這堂指定兩步是為了看到並核對 `.class`。

接著從 VS Code 開啟這個資料夾，安裝官方文件指向的 Extension Pack for Java。若它要求選 JDK，就選上一課核對過的那套；在 `main` 上使用 Run。編輯器提供語法提示與啟動捷徑，終端的指令仍是你查輸出不一致時的基準。只有當兩邊結果相同才算完成，按過 Run 不等於比較過。IDE 若在不同目錄放編譯產物，也不改變我們明寫的終端驗收。

### 用一次改動看清兩步
把小票上的 `1250` 改成 `1600` 並存檔。先想一想：若你現在只敲 `java -cp . Receipt`，讀的是哪個檔？它仍會印舊數字。這不是編輯器沒有寫入，而是 `Receipt.class` 沒重建。再編譯一次才看到新值。遇到編譯錯誤則不要繼續跑舊檔掩蓋失敗；錯誤附的檔名和行號比畫面的舊數字更有用。把兩次的輸出抄到同一張收據，即可回頭追出差異。

把最後一次執行時寫下的類別名與編譯指令放在一起，就能讓別人在沒有編輯器畫面的情況下重現。

## 常見錯誤
- 出現「公開類別應在另一個檔名」→ 類別名與檔名沒有對齊 → 確認 `Receipt.java` 不是 `receipt.java.txt`。
- `Could not find or load main class` → 可能把副檔名當成類別名，或不在正確目錄 → 從含 `Receipt.class` 的資料夾執行 `java -cp . Receipt`。
- 修改文字後數字仍舊 → 原始檔沒存或沒有重新編譯 → 核對存檔與編譯成功再執行。

## 小結
先讓一行輸出對得上檔名、編譯產物和啟動指令。後面即使 IDE 或 Maven 代辦這兩步，你也知道失敗在哪一段。
