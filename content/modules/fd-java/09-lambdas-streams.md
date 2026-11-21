---
id: fd-java-09
module: fd-java
order: 9
title: Lambda 與 Stream
subtitle: 同一份訂單結果用兩種寫法
status: ready
minutes: 35
level: 2
prereqs:
  - fd-java-08
objectives:
  - 用 Lambda 與 Stream 產出與原迴圈相同的付款總額
  - 分辨中間操作、終端操作及共享狀態
tags:
  - lambda
  - stream
  - filter
  - map
  - sum
resources:
  - title: Oracle：Lambda 表達式
    url: https://docs.oracle.com/javase/tutorial/java/javaOO/lambdaexpressions.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 讀如何把篩選行為當成參數。
  - title: Oracle：Stream 套件
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/stream/package-summary.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 分辨中間操作、終端操作與副作用。
concepts:
  - id: fd-java-09-lazy
    prompt: 只建立 filter，還沒呼叫終端操作，代表已逐筆比較嗎？
    answer: 不代表；Stream 的中間操作是延遲求值。
    mcq:
      options:
        - 代表已完成所有列
        - 代表執行緒池已自動啟動
        - 不代表，終端操作才消費管道
        - 只有加入排序才延遲
      answer: 2
      explain: filter 是中間操作；也別拿副作用當成每列必然被執行的證據。
  - id: fd-java-09-stages
    prompt: 只想用已付款的分值加總，哪段順序符合這個需求？
    answer: 先 filter 狀態，再 mapToLong 得分值，最後 sum。
    mcq:
      options:
        - 先 sum，再讀 status
        - 先 filter，再 mapToLong，最後 sum
        - 先 mapToLong，再讀訂單狀態
        - 對每列 sort，再轉字串
      answer: 1
      explain: 太早只留下分值會丟失狀態，sum 後也無法剔除取消單。
  - id: fd-java-09-shared
    prompt: 為什麼不用 forEach 更新外面的 total 容器？
    answer: 用 sum 更直接；共享可變總數在平行時會有競爭。
    mcq:
      options:
        - 共享容器自動加鎖
        - forEach 讓重送自動去除
        - 以 sum 取代外部加總
        - 先換 parallel 就安全
      answer: 2
      explain: Stream 不會替外部數據的複合更新保證原子性。
    interview:
      question: 你會怎樣從迴圈安全改成 Stream？
      points:
        - 固定輸入做等價對照
        - 說清延遲執行與終端操作
        - 不把副作用塞進轉換
      answer: 我先用已付、取消和空清單固定原結果，再用 filter、mapToLong 和 sum 重寫。若是去重或順序變得不清楚，我會保留迴圈。這是本機集合，不會因為改寫就有分散式或實時處理。
practice:
  - id: fd-java-09-p1
    title: 保存兩種付款彙總的對照
    kind: code
    minutes: 11
    steps:
      - 用同一份測資執行 PaymentTotals.java；比較標準輸出。
      - 把一筆取消改成已付，另以空 List 測一次。
      - 存下三組條件與兩種寫法的結果。
    checks:
      - 原版兩行都是 1750；取消單改為已付後同為 6750。
      - 空輸入兩邊都是 0，不能只檢查其中一種。
---

## 先讓兩種寫法答同一個問題
前面用迴圈合計分值。這次不去重：輸入約定每筆已是不同付款，唯一規則是只算已付。先把規則和預期答案固定，才有辦法檢查重寫。Python 常用生成式勾選後交給 `sum`；Java 的串流（Stream）也是逐步描述如何取值。這裡只是本機集合，不是 Kafka 的無界事件流，也不自動分散到其他電腦。

## 語法小抄
- `p -> "paid".equals(p.status)` 是 Lambda 表達式（lambda expression），可以把行為當參數；左邊是輸入名稱，右邊是回傳值。若有多個參數用 `(a, b) -> ...`；多個敘述用大括號並明寫 `return`（需要回傳時）。
- `rows.stream().filter(p -> ...).mapToLong(p -> ...)` 是管道：`filter` 保留成立的數據，`mapToLong` 轉換每筆為原始型別 `long`。一般物件轉換用 `map`；只篩選不會變更來源集合。
- `sum()` 是終端操作（terminal operation），真正消費這條串流。中間操作（intermediate operation）是延遲的；被消費過的 Stream 不重用，要從來源再建立一條。

## 跑出可比的兩行
在 `C:\dev\conduit-lab\java` 存 `PaymentTotals.java`，執行 `javac .\PaymentTotals.java` 和 `java -cp . PaymentTotals`。

```java
import java.util.List;

public class PaymentTotals {
    static class Payment {
        final String status;
        final long cents;
        Payment(String status, long cents) { this.status = status; this.cents = cents; }
    }

    public static void main(String[] args) {
        List<Payment> rows = List.of(
            new Payment("paid", 1200), new Payment("cancelled", 5000),
            new Payment("paid", 550)
        );
        long loop = 0;
        for (Payment p : rows) {
            if ("paid".equals(p.status)) loop += p.cents;
        }
        long stream = rows.stream()
            .filter(p -> "paid".equals(p.status))
            .mapToLong(p -> p.cents)
            .sum();
        System.out.println("loop=" + loop);
        System.out.println("stream=" + stream);
    }
}
```

先手算 1200 加 550，取消單不算，輸出兩行都該是 1750。若交換 filter 和 map 的順序，到了分值那一步就再也讀不到狀態，這跟 SQL 先拿掉欄位再嘗試用它篩選一樣。改成空清單後確認都是 0；若規格把「沒有來源」和「來源空」分開，那仍要在外層驗輸入是否存在。

為了計數而從 `forEach` 更新外部的陣列或清單，是把累積行為藏在副作用（side effect）裡。一旦切成平行處理，幾個工作可能寫同一份總額。此例用 `sum` 把累積交給操作本身，需要外部狀態或逐列診斷時可以保留迴圈；別因為 Stream 字數少就改平行。共享狀態的具體反例在[〈執行緒、執行緒池與可見性〉](#/lesson/fd-java-10)。

### 用相同數據測兩種表達，而不是挑比較好看的數字
若要輸出每個符合條件的訂單代碼，現在的 `mapToLong` 會太早把代碼丟掉；你應看需求改為 `map`，或在另一步輸出。若希望畫面維持來源順序，不應因為總額相同就假設明細也相同：加總與逐列紀錄的契約不同。遇到報表從迴圈換成 Stream，先在評審說清楚這次要保留哪些輸出，避免精簡外觀反而移除了重要線索。

可以先把兩段程式分開各跑一次，特別加「全取消」和「剛好 0 分但已付款」兩種輸入，辨認總額雖都可能是 0，但接受的筆數不是同一回事。需要同時交筆數和總額時，明寫彙總規格；不能從一個 `sum` 倒推有多少合法事件。

這項對照先檢查業務正確性，不以跑一次的毫秒數判斷寫法優劣。

## 常見錯誤
- 寫了 `filter` 卻沒輸出 → 沒有終端操作 → 接 `sum()` 或明確取結果。
- 先把訂單映射為分值，再找狀態 → 欄位已丟失 → 先篩選訂單。
- 第二次使用同一個 Stream 失敗 → 它已被消費 → 從原始 `rows` 另建串流。

## 小結
先確認判斷與結果，再決定用迴圈或 Stream。這個例子的關鍵是篩選先於投影，最後以無共享的加總取結果。
