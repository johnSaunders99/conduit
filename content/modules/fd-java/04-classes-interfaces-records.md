---
id: fd-java-04
module: fd-java
order: 4
title: 類別、介面與 Record
subtitle: 給每張事件小票一種形狀
status: ready
minutes: 35
level: 1
prereqs:
  - fd-java-03
objectives:
  - 把訂單欄位封裝成 record
  - 用一個介面宣告同一規則下的兩個檢查實作
tags:
  - class
  - interface
  - record
  - equality
resources:
  - title: Oracle：類別與建構式
    url: https://docs.oracle.com/javase/tutorial/java/javaOO/classes.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看類別如何綁定欄位、建構式與方法。
  - title: Oracle：宣告介面
    url: https://docs.oracle.com/javase/tutorial/java/IandI/createinterface.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看方法契約怎麼交給不同類別實作。
  - title: Oracle：Record 類別
    url: https://docs.oracle.com/en/java/javase/25/language/records.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: 讀元件、存取方法與相等性。
concepts:
  - id: fd-java-04-contract
    prompt: 呼叫方只持有 Rule 型別，要如何改用另一種篩選規則？
    answer: 交給它另一個實作 Rule 的物件；呼叫方式維持 allows(order)。
    mcq:
      options:
        - 改寫 Order record
        - 換掉 Rule 實作
        - 把方法名稱寫進訂單字串
        - 只能修改呼叫端 if
      answer: 1
      explain: 介面允許多個實作共享同一個方法契約，欄位不用改。
  - id: fd-java-04-value
    prompt: 兩個分開 new、元件內容相同的 Order record，用 equals 相比會怎樣？
    answer: 本例 3 個元件都相等，equals 為 true。
    mcq:
      options:
        - 永遠 false
        - true，因為元件相等
        - 只要 id 相同就 true
        - 得先轉成字串才能比較
      answer: 1
      explain: record 預設用相同 record 類型及全部元件比較；== 才直接比較參照。
  - id: fd-java-04-shallow
    prompt: record 放一個可變 List，為何不是深度不可變？
    answer: record 元件參照不能重新指派，但所指的 List 還可變動。
    mcq:
      options:
        - record 自動複製所有 List
        - List 變更會被編譯器一律拒絕
        - 參照固定，容器內容仍可變
        - 一定能重新指派 record 元件
      answer: 2
      explain: 要保住內容，得自己設計複製與可變元素的邊界。
practice:
  - id: fd-java-04-p1
    title: 換規則但不更動訂單值
    kind: code
    minutes: 12
    steps:
      - 建立 OrderRules.java 並跑一遍，記下不設門檻與 1300 分門檻 各自結果。
      - 新增一筆金額相同但狀態取消的訂單，交給兩個實作。
      - 把相等性觀察寫在 order-rules.txt。
    checks:
      - 原單兩種規則依序為 true、false；取消單都為 false。
      - 同值的不同物件是 equals=true、== 為 false；只改狀態就不相等。
---

## 從三排對齊的陣列換成一張訂單
前一堂的數據用第 0 格到第 0 格對齊；多插一個金額就可能錯配。現在把訂單代碼、金額、狀態放進同一個物件（object）。再把「能不能列入」當成另一件事：訂單保存觀察到的值，規則解釋這些值是否合於需求。這樣改營運門檻時不必把相同訂單再建一個新版本。

## 三個宣告各做一件事
- `record Order(String id, long cents, String status) {}` 宣告紀錄類別（record class）。Java 會為元件產生建構式（constructor）及 `id()`、`cents()`、`status()` 等存取方法，也提供以元件為基礎的相等性。呼叫 `new Order(...)` 才建立實際的值。
- `interface Rule { boolean allows(Order order); }` 是介面（interface）。它說呼叫者要給一筆訂單，會得到真假；它不替每種規則選門檻。你可以把兩個類別都指定為 `Rule` 來用。
- `class PaidAbove implements Rule { ... }` 提供實作。用 `private final long minimum;` 保存規則的設定，建構時透過 `this.minimum = minimum;` 將參數寫入目前物件。`public boolean allows(...)` 是可被呼叫的實作，`@Override` 請編譯器幫忙確認確實覆寫了相同簽名的方法。

## 一筆單，跑兩個規則
在 `C:\dev\conduit-lab\java` 存成 `OrderRules.java`，執行 `javac .\OrderRules.java` 後再執行 `java -cp . OrderRules`。此處要用已安裝的 LTS；JDK 11 不支援 record。

```java
public class OrderRules {
    record Order(String id, long cents, String status) {}

    interface Rule {
        boolean allows(Order order);
    }

    static class PaidAbove implements Rule {
        private final long minimum;
        PaidAbove(long minimum) { this.minimum = minimum; }

        @Override public boolean allows(Order order) {
            return "paid".equals(order.status()) && order.cents() >= minimum;
        }
    }

    static class PaidOnly implements Rule {
        @Override public boolean allows(Order order) {
            return "paid".equals(order.status());
        }
    }

    public static void main(String[] args) {
        Order a = new Order("T01", 1200, "paid");
        Order b = new Order("T01", 1200, "paid");
        Rule loose = new PaidOnly();
        Rule strict = new PaidAbove(1300);
        System.out.println(loose.allows(a) + " " + strict.allows(a));
        System.out.println(a.equals(b) + " " + (a == b));
    }
}
```

兩行都是 `true false`，但問的事情不同。第一行問「這筆數據各自符合規則嗎」；第二行先比元件值，再問是不是同一個物件。也別把整筆訂單的相等性當成業務去重規則：相同訂單代碼但狀態更新時，record 值已不同；是否合併得先定鍵。之後在[〈Java 集合與泛型〉](#/lesson/fd-java-05)用明確的事件代碼去重。

本例的元件都是整數或不可變字串；不是每個 record 都能這樣放心。如果塞進一個可變清單，修改清單內容不必重新指派 record 元件。需要固定內容時，應另做防禦性複製並確認元素本身的可變性。像 Python 的 tuple 裡放 list，外層固定並不會凍住內層。

### 加一筆恰好到門檻的單，先手算兩個答案
把 `T02` 的金額設為 1300 分、狀態設成已付：不設門檻與嚴格方案都通過；改成 1299，只有前者通過。這個對照證明差異在規則，不在訂單類別。若接手者想額外要求「只接受指定門市」，先確認訂單是否真的有可用門市碼；沒有就別讓實作回頭猜輸入。從呼叫端看，`allows` 的方法形狀不變，但規則的期望仍需寫清楚。

同樣的分工也適用數據來源：兩個來源各有解析器時，輸出都可以對到同一個 record，而呼叫端不需要看兩種 CSV 欄順。一個類別可以帶設定也可以實作行為；別把「用了介面」當成一定同口徑，這是用三筆對照才能驗出來的約定。

## 常見錯誤
- 呼叫 `order.status` 出現存取錯誤（在 record 外部的呼叫端）→ 把元件當公開欄位 → 寫成 `order.status()`。
- 編譯說沒有實作介面方法 → 方法名稱、參數或可見性不符 → 用 `@Override` 並對照 `allows(Order order)`。
- 用 `a == b` 後認為訂單內容不同 → 比到物件身分 → 用 `equals`，若只問業務鍵就比較鍵。

## 小結
先用 record 固定交換數據的形狀，再用介面分開規則與呼叫處。當同一張單要回答兩個問題時，這個分工就開始有價值。
