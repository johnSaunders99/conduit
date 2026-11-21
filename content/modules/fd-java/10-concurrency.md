---
id: fd-java-10
module: fd-java
order: 10
title: 執行緒、執行緒池與可見性
subtitle: 兩個任務不要漏算同一個計數
status: ready
minutes: 40
level: 3
prereqs:
  - fd-java-09
objectives:
  - 用有界執行緒池提交工作並合計個別結果
  - 區分 volatile 可見性、synchronized 互斥與過載處理
tags:
  - executor
  - threadpool
  - volatile
  - synchronized
  - backpressure
resources:
  - title: Oracle：ExecutorService
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 看提交、等待結果和關閉的範例。
  - title: Oracle：ThreadPoolExecutor
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀核心數、佇列與拒絕策略。
  - title: Java 語言規格：執行緒與鎖
    url: https://docs.oracle.com/javase/specs/jls/se25/html/jls-17.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 找 happens-before 和 monitor 的規則。
concepts:
  - id: fd-java-10-queue
    prompt: 核心數 2、上限 4、有界佇列尚有空位，已有 2 個核心執行緒時新提交任務通常先去哪？
    answer: 先嘗試排隊，佇列滿了才嘗試增加到上限。
    mcq:
      options:
        - 直接開第 3 個執行緒
        - 先交給佇列
        - 一定拒絕
        - 由主執行緒立刻執行
      answer: 1
      explain: 一般 execute 的順序是啟動至核心數、嘗試排隊、增至最大數，最後才走拒絕策略。
    interview:
      question: 解釋執行緒池的參數和過載時的決策。
      points:
        - 核心與最大數、閒置時間
        - 有界佇列及拒絕策略
        - 別讓過載靜默丟數據
      answer: 我會先依資源量選核心數、最大數和有界佇列，非核心執行緒可在閒置期限後回收。滿載時拒絕要能看見，呼叫端可降速或重試，但不能把收不到的事件算成功。
  - id: fd-java-10-atom
    prompt: 把 count 宣告成 volatile，兩個執行緒共同做 count++ 是否安全？
    answer: 不安全；讀、加、寫仍可能交錯並覆蓋一次更新。
    mcq:
      options:
        - 安全，因為可見性等於原子性
        - 安全，因為 ++ 只能用一條指令
        - 不安全，讀改寫仍可交錯
        - 不安全，volatile 只用於整數除法
      answer: 2
      explain: volatile 的寫與後續讀建立可見性關係，但不是跨步驟的互斥鎖。
    interview:
      question: synchronized 和 volatile 怎麼選？
      points:
        - volatile 適用獨立的狀態旗標
        - 同一把鎖包住複合更新
        - 優先避開共享累加
      answer: 只做一寫一讀的停止旗標可用 volatile；計數的讀改寫要共用同一把鎖或原子類別。我若能讓工人回傳各自小計，再由呼叫端相加，就不需要共享這個計數。
  - id: fd-java-10-future
    prompt: submit 回傳的 Future 能直接當小計相加嗎？
    answer: 不行；Future 是待取結果，get 等候完成並回傳或轉報失敗。
    mcq:
      options:
        - 可以，submit 同步回傳 long
        - 不行，需 get
        - 改呼叫 shutdown 就拿到數值
        - Future 只提供計時值
      answer: 1
      explain: 關閉池並不等於取得或檢查每個工作的結果。
  - id: fd-java-10-shutdown
    prompt: 為什麼這個短命程式把 shutdown 放在 finally？
    answer: 即使取得結果時拋出例外，也要停止接受工作並安排已提交的工作退出。
practice:
  - id: fd-java-10-p1
    title: 比較分工小計和遺失更新
    kind: code
    minutes: 12
    steps:
      - 執行 BatchWorkers.java，把剛才兩種可能交錯寫進 workers.txt。
      - 把第二個工作小計改為 3，重跑並檢查總數。
      - 以核心 2、最大 3、佇列 1 推演 5 個尚未結束的工作，記第幾次會被拒絕。
    checks:
      - 原版 total=7，變體 total=5；沒有共用可變 count。
      - 推演前兩個分派、第三個等候、第四個開工作者、第五個拒絕。
---

## 工作可以並行，結果不要互相踩
清晨有兩包獨立付款檔。執行緒（thread）是可獨立前進的一條執行路徑；執行緒池（thread pool）重用工作者，讓你不必為每個檔案新建執行緒。把小計交回呼叫者，一處相加，先用結構避免共享寫入，而不是先替所有程式加鎖。

## 池的基本參數
`ThreadPoolExecutor(core, max, keepAlive, unit, queue, handler)` 先補到核心執行緒數；若都有核心數了，先嘗試放入工作佇列，再於佇列滿時擴到最大數。閒置期限用於回收非核心執行緒（預設）；佇列的容量是另一項獨立限制。池飽和或關閉仍提交時，拒絕策略（rejection policy）接手。本例 `AbortPolicy` 讓提交者收到例外，不能把失敗的提交寫成已收件。這個順序說的是沒有工作剛好完成的推演；真實負載先看處理時間、佇列等待和外部系統容量。

`submit(() -> 值)` 送工作並傳回待取結果（Future）；`get()` 等結果，工作失敗時也要處理。`shutdown()` 拒收新工作，允許已提交的工作結束。示範工作有限且不阻塞；正式處理外部服務還需要超時與能回應取消的工作。

## 在呼叫端合計，不共享可變數
在 `C:\dev\conduit-lab\java` 存 `BatchWorkers.java`，執行 `javac .\BatchWorkers.java` 後用 `java -cp . BatchWorkers`。

```java
import java.util.concurrent.*;

public class BatchWorkers {
    public static void main(String[] args) throws Exception {
        ExecutorService pool = new ThreadPoolExecutor(
            2, 3, 10, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.AbortPolicy()
        );
        try {
            Future<Integer> north = pool.submit(() -> 2);
            Future<Integer> south = pool.submit(() -> 5);
            System.out.println("total=" + (north.get() + south.get()));
        } finally {
            pool.shutdown();
        }
    }
}
```

總數是 7，沒有要求兩個工作依固定先後完成。反過來，如果兩人都改共享的 `count++`，可以發生：甲讀 0，乙讀 0，甲寫 1，乙也寫 1。最後只剩 1 次更新。把 `count` 標成 `volatile` 讓寫入對後續讀取可見，仍阻止不了這種交錯。要保護讀改寫，使用同一監視器鎖的 `synchronized (lock) { ... }` 包住完整操作，讀數也要符合相同的同步約定。可見性（visibility）回答讀到的狀態；原子性（atomicity）回答這組操作可否被插隊。只讀／寫獨立的停止旗標可以用 `volatile`，不是每個地方都要鎖。

### 用紙筆算一次滿載，不用故意卡住電腦
假設所有已接任務都還沒做完，提交第 1、2 個工作時先開兩個核心工作者；第 3 個暫進唯一的佇列格，第 4 個因佇列滿而增加工作者，第 5 個走拒絕策略。若第 1 個在提交前已結束，分派就可能不同。調整大小之前，先問排隊多久會令日報來不及、外部來源可否再多兩條連線。只把佇列開很大能延後拒絕，卻可能讓過載藏在等待時間。

發生遺失更新也不需要以一次執行剛好少算才能舉證；列出「兩邊先讀 0」就是可行交錯。實驗若偶然全部正確，不代表所有交錯都已排除。

## 常見錯誤
- 擴到最大前卻一直排隊 → 池優先用佇列 → 查佇列容量，別只調最大數。
- 偶爾少算 → 以為 `volatile` 保護 `++` → 改成工作者只回傳小計，或用同一把鎖保護。
- 程式完成後不退出 → 忘了關池 → 用 `finally` 安排關閉；正式程式也要處理等待與逾時。

## 小結
用有限的工作者和佇列讓超載可見。能把共享寫入改成回傳結果，就不必再用鎖補一個原本不需要的共享計數。
