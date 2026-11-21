---
id: fd-java-06
module: fd-java
order: 6
title: Java 例外與資源關閉
subtitle: 讀到壞列也要關好檔案
status: ready
minutes: 30
level: 2
prereqs:
  - fd-java-05
objectives:
  - 用 try-with-resources 讀完付款檔並可靠關閉
  - 把列格式錯誤與整批檔案錯誤分開回報
tags:
  - exceptions
  - try-with-resources
  - io
  - utf-8
resources:
  - title: Oracle：自動關閉資源
    url: https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀正常結束和拋出例外時的關閉。
concepts:
  - id: fd-java-06-close
    prompt: 讀到一半丟出例外時，try-with-resources 何時關閉讀取器？
    answer: 流程離開資源區塊時自動呼叫 close，即使因例外離開也會嘗試關閉。
    mcq:
      options:
        - 只有讀到最後一列
        - 離開資源區塊時
        - 下一次開檔時
        - 只有 JAR 打包時
      answer: 1
      explain: 關閉資源不是等到整個 JVM 結束，也不要求正常讀完。
  - id: fd-java-06-scope
    prompt: 讀取器對應的檔案根本不存在，要印出 total=0 當成功嗎？
    answer: 不要；檔案錯誤應回報並使批次失敗。
    mcq:
      options:
        - 應該，0 表示沒有付款
        - 應略過第一列
        - 應失敗，不發布成功總數
        - 當作一筆數字格式錯誤
      answer: 2
      explain: 來源不存在不等於來源有 0 筆。列解析的恢復策略不適用於打不開檔案。
    interview:
      question: 同時有壞列和讀檔失敗，你的管道如何分級？
      points:
        - 能定位的格式錯隔離
        - 來源 I/O 錯誤使批次失敗
        - 不把失敗混成零，留下列數與原因
      answer: 如果這份摘要允許部分列，我會記列號與拒絕原因，再把拒收筆數交給使用者；來源讀取中斷就不發布總數。我會讓排程看到非零結束碼，查完來源再重跑。
  - id: fd-java-06-range
    prompt: Long.parseLong 成功後，還要驗證哪件事？
    answer: 數字可轉換不代表符合業務規則；這批只收非負分值。
    mcq:
      options:
        - 一定是正的
        - 一定符合本批規則
        - 還要檢查是否低於零
        - 一定要先換成 double
      answer: 2
      explain: 負整數文字可以解析成功，這不是格式錯。
  - id: fd-java-06-checked
    prompt: 為什麼 Files.newBufferedReader 的 IOException 不能假裝不存在？
    answer: 它是受檢例外；呼叫者要捕捉或在方法上宣告 throws。
practice:
  - id: fd-java-06-p1
    title: 交付收款檔的接受與拒收清單
    kind: code
    minutes: 10
    steps:
      - 跑四列原始輸入，記下標準輸出與拒收列號。
      - 改第三列為 125 後重跑；另外刻意用不存在的檔名跑一次。
      - 保留 ParsePayments.java、輸入檔與結果記錄。
    checks:
      - 原版 accepted=2 rejected=2 total_cents=800；改後 accepted=3 rejected=1 total_cents=925。
      - 檔案不存在時印 FILE_ERROR、結束碼 1，沒有成功摘要。
---

## 一列有錯，可以繼續；一整份檔沒讀完，不能報成功
付款來源約定每列一個非負整數分值。第 2 列寫成小數，第 3 列是負數，最後一列卻是合法的 0。你要回報拒收數，也要保住正常列。今天的批次允許部分列；如果業務要求整批一致，即使只有一列拒收也應先停發。在 Python 你會用 `with open(...)` 配合特定的 `except`；Java 一樣能把關閉資源和決定怎麼處理失敗分開。

## 語法與兩層責任
- `try (資源宣告) { ... } catch (例外型別 name) { ... }` 是自動關閉資源的 try（try-with-resources）。能在這裡宣告的資源遵守 `AutoCloseable`；不管正常走完或拋出例外，離開時會嘗試 `close()`。
- `catch (NumberFormatException e)` 只接預期的轉換失敗。格式能轉不代表符合範圍，所以負數另檢查，不和小數文字混為一談。
- `catch (IOException e)` 接開檔、讀取或關閉的受檢例外（checked exception）；若這層不處理，可在方法宣告 `throws IOException` 交給呼叫端。`throw new ...` 則是真的拋出一個例外。
- `readLine()` 每次給一列，回傳 `null` 表示已到檔案結尾；空字串是讀到空列，不是結束。以固定 UTF-8（本例全為 ASCII）避免把環境的預設值當檔案規格。

## 四列足以分出三種結果
在 `C:\dev\conduit-lab\java` 存下 `ParsePayments.java`：

```java
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

public class ParsePayments {
    public static void main(String[] args) {
        int accepted = 0, rejected = 0, row = 0;
        long total = 0L;
        try (BufferedReader in = Files.newBufferedReader(
                Path.of(args[0]), StandardCharsets.UTF_8)) {
            String text;
            while ((text = in.readLine()) != null) {
                row++;
                long cents;
                try {
                    cents = Long.parseLong(text);
                } catch (NumberFormatException e) {
                    rejected++;
                    System.err.println("row " + row + " invalid integer");
                    continue;
                }
                if (cents < 0) {
                    rejected++;
                    System.err.println("row " + row + " negative cents");
                    continue;
                }
                accepted++;
                total += cents;
            }
        } catch (IOException e) {
            System.err.println("FILE_ERROR " + e.getClass().getSimpleName());
            System.exit(1);
            return;
        }
        System.out.printf("accepted=%d rejected=%d total_cents=%d%n", accepted, rejected, total);
    }
}
```

在同一資料夾的 PowerShell 建立虛構數據並執行：

```powershell
@('800','3.5','-2','0') | Set-Content .\payment-cents.txt -Encoding ASCII
javac .\ParsePayments.java
java -cp . ParsePayments .\payment-cents.txt
```

第 2、3 列到錯誤輸出；標準輸出是 `accepted=2 rejected=2 total_cents=800`。把檔名改成不存在的 `missing-cents.txt` 再執行，接著看 `$LASTEXITCODE`，應為 1。因為摘要在關閉成功後才印，中途失敗或關閉失敗都不會假裝完成。這支小程式只約定一個檔名參數，沒有處理所有命令列用法；若改成批次工具，還要驗證參數數量與金額總和的上限。

### 記錄得夠查，又不把整份付款檔印出去
第 2 列的小數格式錯、第 3 列的負值不合業務，不需要公開整列才能診斷。例外輸出的列號與短原因已能讓有權限的人定位；正式流程也可加來源批次代號，避免跨檔案把第 2 列當同一筆。若有警戒門檻，如 1000 筆裡壞 2 筆可接受而 10 筆不可接受，要先由業務和維護角色約定，不能從本堂的 4 筆練習推算出真實百分比。

若讀到一半中斷，標準輸出沒有成功摘要，但錯誤輸出可能已出現前面那幾筆列問題，這不矛盾。前者是交付結果，後者是排查線索；排程不能只因看到任何訊息就當成功。如果同時發生讀錯和關閉失敗，Java 會保留主要例外並可提供被抑制的次要例外，示例只印短類型，真實診斷可另外收受控日誌。

## 常見錯誤
- 空列後面的數據全消失 → 把空字串當作檔尾 → 僅在讀到 `null` 時停止。
- 檔案找不到還是回報 0 → 把整批錯誤吞成普通值 → 回報 I/O 失敗並停止發布。
- 0 被標為缺值 → 用了 `<= 0` 或從 Python 帶入真假判斷 → 規則只拒絕 `< 0`。

## 小結
把能隔離的壞列留在列層，把沒有可信結果的問題留在批次層。用可辨認的結束狀態和拒收數讓接手的人看見差別。
