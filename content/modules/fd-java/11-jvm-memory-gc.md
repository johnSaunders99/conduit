---
id: fd-java-11
module: fd-java
order: 11
title: JVM 記憶體、GC 與 OOM
subtitle: 用一段日誌分清停頓與耗盡
status: ready
minutes: 35
level: 3
prereqs:
  - fd-java-10
objectives:
  - 指出 JVM 的堆積、每執行緒堆疊與 HotSpot Metaspace
  - 解讀 GC 前後用量及停頓，區分耗盡和根因
tags:
  - heap
  - gc
  - out-of-memory
  - metaspace
  - stack
resources:
  - title: Java 虛擬機規格：執行期區域
    url: https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-2.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 讀第 2.5 節共享與執行緒私有的區域。
  - title: Oracle：垃圾回收調校入門
    url: https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 讀回收、吞吐與停頓的取捨。
  - title: Oracle：java 參數
    url: https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 找 -Xmx 和 -Xlog 的設定範例。
concepts:
  - id: fd-java-11-areas
    prompt: 哪個區域保存 JVM 中由不同執行緒共享的物件與陣列？
    answer: 規格中的堆積，執行緒自己的方法框架則在堆疊。
    mcq:
      options:
        - 每個執行緒的堆疊
        - 堆積
        - 指令計數器
        - 主類別資訊清單
      answer: 1
      explain: 方法框架存區域變數與運算狀態，可以含指向物件的參照。
    interview:
      question: 請用一條付款作業說明 JVM 記憶體區域。
      points:
        - 執行緒私有堆疊與共享堆積
        - 規格的方法區不等於所有虛擬機的實作細節
        - HotSpot 類別中繼數據常在 Metaspace
      answer: 呼叫方法的框架跟著各執行緒，付款物件和陣列在共享堆積模型。HotSpot 用原生記憶體的 Metaspace 存類別中繼數據；這與 JVM 規格的方法區概念相關，但不是每個 JVM 都這樣實作。
  - id: fd-java-11-pause
    prompt: 虛構 GC 行的 52M->18M(64M) 6.2ms 代表什麼？
    answer: 這次使用量從 52 降到 18 MiB、當時堆積容量 64 MiB，所示停頓是 6.2 ms。
    mcq:
      options:
        - 18 MiB 是這次停頓
        - 64 MiB 是這次回收量
        - 使用量減少 34 MiB，停頓 6.2 ms
        - 6.2 ms 是程序總耗時
      answer: 2
      explain: 這行描述一個 GC 事件，不是整個作業的計時，也不是所有原生記憶體。
  - id: fd-java-11-cause
    prompt: 看到 Java heap space，哪個結論最穩健？
    answer: 一次堆積配置沒能滿足；需追加證據才能判定漏留或正常大批次。
    mcq:
      options:
        - 可直接證明洩漏
        - 一定是執行緒堆疊太深
        - 只表示一次配置失敗，原因仍需證據
        - 把 -Xmx 開大必定修好
      answer: 2
      explain: 檢查相同負載下的回收後用量、輸入大小、留存參照及上限。
    interview:
      question: 回收後用量持續上升，怎麼回答是不是記憶體洩漏？
      points:
        - 先比較同樣輸入與回收後趨勢
        - 檢查仍可達的物件
        - 區分堆積和容器限制
      answer: 我會先用相同輸入與上限重現，看可比較的回收後用量。如果一直漲再找是哪類物件被參照，例如全域 Map 留著舊鍵；還要對一下容器上限。單行 OOM 或一次停頓不能定根因。
practice:
  - id: fd-java-11-p1
    title: 用兩行日誌寫一張 GC 判讀卡
    kind: hands-on
    minutes: 10
    steps:
      - 把虛構日誌存到 gc-reading.txt，各標出回收前、回收後、單次停頓。
      - 執行小型 Java 範例，從 gc.log 找一行可對應的回收紀錄。
      - 比較兩行範例日誌與實際輸出，寫一個要再收的訊號。
    checks:
      - 虛構兩次使用量分別減少 34 與 17 MiB；不把它們說成等同整個批次的延遲。
      - 不宣稱已觸發 OOM 或證明洩漏。
---

## 報表變慢時，先分清變慢還是分配失敗
某天一批訂單跑得慢，日誌有很多 GC，隔天又出現 `OutOfMemoryError`（OOM）。兩個現象相關但不相同。垃圾回收（garbage collection, GC）回收已無法從執行中的根參照（GC root）到達的物件所占空間，以供未來使用；還被某個長命 Map 參照的舊付款，即使業務不再需要，也不是可回收垃圾。

## 常見區域，看用途不背記憶體地圖
- 堆積（heap；亦稱堆）在 JVM 規格中供物件、陣列配置，為執行緒共享；`-Xmx` 控制 HotSpot 可用的最大 Java 堆積，不是程序總上限。
- Java 虛擬機堆疊（JVM stack；亦稱棧）屬於各執行緒。每次方法呼叫有自己的框架（frame），放區域變數與運算狀態。呼叫太深可能有 `StackOverflowError`；不能因為變數中有個參照，就說整個物件存於該框架。
- 方法區（method area）是規格中共享的每類別結構。HotSpot 的類別中繼數據（class metadata）主要存於原生記憶體的 Metaspace（元空間）；它不是 `-Xmx` 裡的另一塊。還有每執行緒的程式計數器和原生方法堆疊等，排障先按錯誤型態縮小範圍。

## 從示意日誌到自己的日誌
下列數字是虛構判讀素材，不是效能承諾。格式參照 HotSpot 統一日誌；本例的 M 依 1024² 位元組讀為 MiB。兩行停頓後用量不同，不足以宣告有洩漏：負載或回收種類也可能不同。

```text
[0.412s][info][gc] GC(0) Pause Young (Normal) (G1 Evacuation Pause) 52M->18M(64M) 6.200ms
[0.870s][info][gc] GC(1) Pause Young (Normal) (G1 Evacuation Pause) 55M->38M(64M) 8.100ms
```

在 `C:\dev\conduit-lab\java` 存 `GcBatches.java`。每輪建立新的暫存陣列，只保留最新一份；使用可見的欄位保存參照以便觀察分配。這不是壓力測試，不製造 OOM。

```java
public class GcBatches {
    private static volatile byte[] latest;

    public static void main(String[] args) {
        for (int i = 0; i < 160; i++) {
            latest = new byte[256 * 1024];
            latest[0] = (byte) i;
        }
        System.out.println("batches=160 last=" + Byte.toUnsignedInt(latest[0]));
    }
}
```

在同一資料夾執行：

```powershell
javac .\GcBatches.java
java -Xms16m -Xmx32m -Xlog:gc:file=gc.log -cp . GcBatches
Get-Content .\gc.log | Select-Object -First 8
```

終端預期是 `batches=160 last=159`；回收次數、容量與毫秒不可硬比虛構數字。若看見 `Java heap space`，先查上限、單批輸入和回收後用量趨勢；若是 `Metaspace` 或被作業系統終止，則查對應類別載入或程序／容器的記憶體。診斷報告要分開記錄觀察與假設。

### 把下一步寫成能區分兩個假設的觀察
假設隔天輸入加倍：同樣的峰值無法區分是物件暫時變多，還是對象長期被保留。先固定輸入量，連著看幾次同類回收後用量，並記下容器實際上限和錯誤字樣。用量隨同一負載反覆上升才值得追活物件的參照；若只在更大批次發生，就先檢查是否能分批或及早釋放用完的緩衝。這是一個待驗的排查方向，不應在拿到日誌前先承諾加記憶體便能解決。

## 常見錯誤
- 看到 `Pause` 就認為整個作業停了同樣久 → 這是單次事件 → 別把停頓當作批次總時間。
- 堆積用量上升就說洩漏 → 可能只是原始輸入變大 → 用相同負載比較回收後的值。
- 所有 OOM 都增加 `-Xmx` → 可能不是 Java 堆積，而且容器仍有上限 → 先對照錯誤及環境證據。

## 小結
先辨別哪種記憶體和哪個事件，再找保留或分配證據。GC 回收的是不可達物件，不是你心裡覺得已經用完的數據。
