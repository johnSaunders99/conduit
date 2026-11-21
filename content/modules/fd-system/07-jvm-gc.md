---
id: fd-system-07
module: fd-system
order: 7
title: JVM 與垃圾回收
subtitle: 找出停頓是否來自記憶體
status: ready
minutes: 30
level: 1
prereqs:
- fd-system-06
objectives:
  - "分清 JVM 堆積、行程用量與垃圾回收"
  - "在固定堆上跑小作業並保存 GC 暫停日誌"
  - "用時刻重疊作為線索，不以重疊斷定根因"
tags:
  - "JVM"
  - "垃圾回收"
  - "堆積"
  - "GC 日誌"
  - "G1"
resources:
  - title: "Introduction to Garbage Collection Tuning"
    url: "https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看吞吐與暫停時間如何取捨。"
  - title: "The java Command"
    url: "https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "找 Xmx、UseG1GC 和統一日誌選項。"
concepts:
  - id: fd-system-07-heap
    prompt: "把 -Xmx 設為 64 MiB，是否限制 JVM 行程最多 64 MiB？"
    answer: "不是；只限制堆積。執行緒堆疊、直接緩衝區及 JVM 原生空間不都在堆中。"
    mcq:
      question: "JVM 行程超過 Xmx 數值，代表什麼？"
      options:
        - "一定出現記憶體洩漏"
        - "可能包含堆以外的項目"
        - "Xmx 是磁碟容量"
        - "所有數字都必須相同"
      answer: 1
      explain: "堆上限和行程總使用量的觀察範圍不同。"
  - id: fd-system-07-reachable
    prompt: "為何持續保留舊批次，就算常跑 GC 也不一定能收回？"
    answer: "只要程式仍持有可達的參考，回收器不能把它當成垃圾。"
    mcq:
      question: "一個仍可從程式存取的陣列，回收器通常怎麼處理？"
      options:
        - "不因為很舊就回收它"
        - "每次年輕代回收都會刪它"
        - "超過一秒就算垃圾"
        - "磁碟有空間就自動消失"
      answer: 0
      explain: "是否可達比年齡更關鍵；年齡可影響代際策略但不決定是否可丟。"
  - id: fd-system-07-pause
    prompt: "慢批次與 GC 暫停重疊，可以直接說整段延遲都是 GC 嗎？"
    answer: "不能；要比較暫停的時長、工作時間窗和發生頻率，再看 I/O 或其他原因。"
    mcq:
      question: "慢了 2 秒，但同一區間只找到 6 毫秒的暫停，該怎麼說？"
      options:
        - "全部是 GC"
        - "從此可排除任何記憶體影響"
        - "暫停只能解釋其中一小段，需補其他證據"
        - "必須立即加大堆"
      answer: 2
      explain: "時間重疊是線索，但不能補上差了好幾個量級的時間。"
  - id: fd-system-07-throughput
    prompt: "為何調大堆不保證延遲更好？"
    answer: "GC 頻率與單次回收工作可能一起改變，還要考慮主機或容器的記憶體限制。"
practice:
  - id: fd-system-07-p1
    kind: hands-on
    title: "對照一個批次與一筆 GC 暫停"
    minutes: 10
    steps:
      - "尚未學 Java 就用讀例；若已有 JDK，可執行選做範例，從日誌取實測值。"
      - "記下最有關的一段重疊或無重疊，並保留兩個時間單位。"
    checks:
      - "讀例的暫停為 6 毫秒，批次為 35 毫秒；若實跑則另核對 checksum=3072。"
      - "若未找到完整的暫停樣本，如實記錄，不能補造或因此斷言沒有 GC。"
---

實時數據工作偶爾停一拍。看到 JVM 日誌有一次垃圾回收，就能說它是主因嗎？這堂讓一個小作業主動配置數據，保存兩種時刻，再判斷暫停能解釋多少延遲。

## JVM 管理物件，作業系統管理整個行程

Java 虛擬機（Java Virtual Machine，JVM）負責執行 Java 程式。物件與陣列通常配置在堆積（heap；大陸稱堆）。程式放下參考後，垃圾回收（garbage collection，GC）在合適的時機回收無法再由活躍程式存取的物件；「讀完」不代表一定放下了參考。若仍把所有批次掛在長期存在的集合，回收器不能把它們刪掉。

GC 的部分工作可與應用同時執行，某些階段則需要暫停應用執行緒（stop-the-world pause）。對數據工作，要兼看整批能處理多少和最慢的一段停多久。堆積只是一部分；執行緒堆疊、原生空間、直接緩衝區等也會消耗行程記憶體。下一個 Docker 模組會把容器整體上限和程式自己的堆上限分開。

- `-Xms32m` 是初始堆大小，`-Xmx64m` 是最大堆大小，不是行程的記憶體上限。
- `-XX:+UseG1GC` 選 G1 收集器；這是為了讓練習使用同一種策略，不是部署建議。
- `-Xlog:gc*:file=gc.log:uptime,level,tags` 將 GC 日誌寫到檔案，含相對於 JVM 啟動的時間。程式用 `getUptime()` 讀毫秒；日誌的 `0.123s` 是 123 毫秒。

## 尚未學 Java：先讀一次可交接的日誌

下方是教學樣本，不是實機輸出。上行是批次，下兩行是同一事件的開始與完成。把秒換成毫秒後，將暫停窗與批次窗畫在同一條時間線，再把兩個窗的長度抄到 `gc-notes.txt`。本課不要求提前安裝 Java。

```text
batch=3 start_ms=115 end_ms=150
[0.120s][info][gc,start] GC(2) Pause Young
[0.126s][info][gc] GC(2) Pause Young 6.000ms
```

## 已有 JDK：選做自己的日誌

JDK（Java Development Kit）提供編譯與執行工具，之後在[〈JDK 與 Windows 安裝〉](#/lesson/fd-java-01)會細講。已有練習用的 JDK 時，在 `C:\dev\conduit-lab` 另建未使用的 `system\gc`。存成 `GcProbe.java`。每批最多保留約 12 MiB 的陣列內容，重複配置 16 批；這能製造回收機會，但不保證每次停在同位置。

```java
import java.lang.management.ManagementFactory;

public class GcProbe {
    public static void main(String[] args) {
        var runtime = ManagementFactory.getRuntimeMXBean();
        int sum = 0;
        for (int batch = 1; batch <= 16; batch++) {
            long start = runtime.getUptime();
            byte[][] pages = new byte[192][];
            for (int i = 0; i < pages.length; i++) {
                pages[i] = new byte[64 * 1024];
                pages[i][0] = 1;
            }
            for (byte[] page : pages) sum += page[0];
            System.out.printf("batch=%d start_ms=%d end_ms=%d%n", batch, start, runtime.getUptime());
        }
        System.out.println("checksum=" + sum);
    }
}
```

在該目錄用 PowerShell 編譯；只有成功才繼續第二行。使用新目錄以免把舊日誌混入。

```powershell
javac GcProbe.java
java -Xms32m -Xmx64m '-XX:+UseG1GC' '-Xlog:gc*:file=gc.log:uptime,level,tags' GcProbe | Tee-Object batches.txt
Select-String -Path gc.log -SimpleMatch 'Pause'
```

驗收 `checksum=3072`。用同一個 GC 編號及相同的暫停階段找開始與結束（或只看有耗時的完成行），將它與一個批次的起訖疊起來。兩次結果不必一模一樣：剛啟動時類別載入和編譯、共享主機的負載也會影響時間。若服務慢了 2 秒，只看到重疊的 6 毫秒暫停，這個暫停就不足以解釋全部差距。

## 從一筆暫停到一個有效假設
在一些日誌裡，同一個收集事件會先印開始，再印一行含耗時的摘要。例如暫停於 120 毫秒開始、126 毫秒完成；若那批從 115 跑到 150 毫秒，你只能說這 6 毫秒位於該批的時間窗。若另一個高峰完全沒有對得上的暫停，還應追 I/O 或排隊。先收集代表性的慢批與正常批，才值得比較改設定前後。更多 JVM 物件生命週期與超出上限的案例見[〈JVM 記憶體、GC 與 OOM〉](#/lesson/fd-java-11)。

這個案例重點是用時間窗淘汰證據不足的推論，而不是調參競賽。保留原設定重跑一次，再看相同型態是否常出現。

## 常見錯誤

- 把同一場暫停的開始與完成各算一次 → 日誌拆成兩列 → 按編號與階段配對，或只數有耗時的完成行。
- 把秒當成毫秒比 → 時窗對不上 → 換成同一單位。
- 看到記憶體壓力就把 `Xmx` 調到容器全額 → 其餘空間仍需要記憶體 → 先量完整行程，不拿練習值照搬。
