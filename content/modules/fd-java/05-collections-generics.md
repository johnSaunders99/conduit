---
id: fd-java-05
module: fd-java
order: 5
title: Java 集合與泛型
subtitle: 記得順序，也認得重送
status: ready
minutes: 40
level: 2
prereqs:
  - fd-java-04
objectives:
  - 用 List 保留順序、Set 判斷重送、Map 依門市累加
  - 解釋泛型、HashMap 碰撞及兩種 List 的取捨
tags:
  - list
  - set
  - map
  - hashmap
  - generics
resources:
  - title: Oracle：泛型型別
    url: https://docs.oracle.com/javase/tutorial/java/generics/types.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看型別參數與編譯期檢查。
  - title: Oracle：HashMap
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀雜湊分布、容量與負載因子。
  - title: Oracle：ArrayList
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看索引讀取與尾端新增的成本。
  - title: Oracle：LinkedList
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedList.html
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 看索引存取為何要走訪。
concepts:
  - id: fd-java-05-shape
    prompt: 哪種容器同時保有事件查核順序與重送次數？
    answer: 原始 List 保留到達順序與重複；另用 Set 去重。
    mcq:
      options:
        - 原始 List
        - 只留 HashSet
        - 只留門市總額 Map
        - 只留事件總數
      answer: 0
      explain: Set 不保留重複，Map 總額與計數都不能還原原始事件。
  - id: fd-java-05-generic
    prompt: Map<String, Long> 為何不能放入字串作為值？
    answer: 泛型把值限制成 Long；編譯時即可發現類型不符。
    mcq:
      options:
        - 字串鍵一律不能重複
        - 泛型限制值類型
        - Map 只能放原始型別
        - 鍵和值必須是同一類型
      answer: 1
      explain: 鍵和值各有類型參數；Long 是 long 的包裝型別。
  - id: fd-java-05-hash
    prompt: 兩個鍵的雜湊值相同，HashMap 如何避免把它們當同一鍵？
    answer: 桶是候選範圍；仍用相等性辨認鍵。
    mcq:
      options:
        - 雜湊相同就覆寫
        - 只看插入次序
        - 在候選桶內判斷 equals
        - 每次都先排全表
      answer: 2
      explain: 不同鍵可能碰撞；必須再比較鍵。相等的鍵則必須有相同雜湊。
    interview:
      question: 門市數突然翻倍，你怎麼解釋 HashMap 的查找與成本？
      points:
        - hashCode 定位桶、equals 辨別候選
        - 雜湊分布好時查取通常為常數時間
        - 負載門檻與擴容的暫時成本
      answer: 先依 hashCode 選桶，再用 equals 分辨候選鍵。分布好時查找通常近似常數；鍵多了超過門檻會重建桶配置，當下有額外成本。我會用穩定的鍵並觀察容量，不假設迭代有序。
  - id: fd-java-05-list-cost
    prompt: 大量按位置讀取，ArrayList 與 LinkedList 先試哪個？
    answer: ArrayList 可依索引直接定位；LinkedList 通常要走訪。
    mcq:
      options:
        - ArrayList
        - LinkedList
        - 兩者的索引成本永遠一樣
        - HashSet 可保有以位置索引
      answer: 0
      explain: 鏈結串列已知節點附近的改動才可能更省事，先由索引找節點仍有成本。
    interview:
      question: ArrayList 和 LinkedList 在事件清單怎麼選？
      points:
        - 索引讀取與尾端新增
        - 插入前是否已定位
        - 先按操作分布驗證
      answer: 我先用 ArrayList 保存到達順序並按位置核對，索引讀取快，尾端追加是攤銷常數時間。中間插入要搬元素；LinkedList 若已定位節點改接較便宜，但先找第 k 筆仍要走訪。若只是兩端排隊，我也會先評估 ArrayDeque。
practice:
  - id: fd-java-05-p1
    title: 交一張含重送的門市對帳
    kind: code
    minutes: 13
    steps:
      - 執行 StoreTotals.java，先手算 raw、unique、N1 與 S1。
      - 新增事件 E04，門市 N1，金額 400；另追加 E03 的原樣重送。
      - 保存修改後的程式與 totals.txt。
    checks:
      - 初版 raw=4 unique=3 N1=1750 S1=900；變體 raw=6 unique=4 N1=2150 S1=900。
      - 能指出哪兩筆只改原始計數，不改加總。
---

## 一筆重送，有兩種數字都得對
收款來源送來 4 筆事件，其中 E01 原樣出現 2 次。稽核問收到幾筆，營運問實收多少。別把原始序列覆寫成一份去重結果：同一組數據需要原始次數、不同事件鍵以及各門市總額。Python 用 list、set、dict 分工；Java 也能照這個想法做，另外寫下容器裡的數據類型。

## 容器與型別小抄
- `List<T>` 是有位置的清單（list），允許重複。`ArrayList` 用可擴充陣列：`get(i)` 直接定位，尾端新增的平均成本按多次操作攤開是常數；中間插入可能搬一段數據。`LinkedList` 用雙向連結，從索引找位置要走訪；已定位的迭代器附近改動不用搬整段。
- `Set<T>` 是集合（set）；`add(value)` 回傳是否真的新增成員。`HashSet` 不保證走訪順序，不能代替收件清單。
- `Map<K,V>` 是鍵值對映（map）；`put(k,v)` 設值，`get(k)` 查值，`getOrDefault(k, 0L)` 給不存在的鍵預設值。`HashMap` 不承諾鍵的順序，輸出要有固定順序就另外指定。
- `<String, Long>` 是泛型（generics）參數，告訴編譯器鍵和值的類型；Java 泛型不能直接填 `long`，用包裝類型 `Long`。`new HashMap<>()` 讓右側沿用推斷出的類型。

## 保留 4 筆，累加時只取 3 筆
在 `C:\dev\conduit-lab\java` 存 `StoreTotals.java`，以 `javac .\StoreTotals.java` 編譯，再用 `java -cp . StoreTotals` 執行。此處字串都是固定格式，不是通用的 CSV 解析。

```java
import java.util.*;

public class StoreTotals {
    public static void main(String[] args) {
        List<String> rows = new ArrayList<>(List.of(
            "E01,N1,1200", "E01,N1,1200", "E02,N1,550", "E03,S1,900"
        ));
        Set<String> seen = new HashSet<>();
        Map<String, Long> total = new HashMap<>();
        for (String row : rows) {
            String[] cols = row.split(",");
            if (seen.add(cols[0])) {
                long cents = Long.parseLong(cols[2]);
                total.put(cols[1], total.getOrDefault(cols[1], 0L) + cents);
            }
        }
        System.out.println("raw=" + rows.size() + " unique=" + seen.size());
        System.out.println("N1=" + total.get("N1"));
        System.out.println("S1=" + total.get("S1"));
    }
}
```

先用 E01 當事件鍵，再用 N1 當分組鍵；若把門市拿來去重，E02 會消失。範例約定重送原樣且保留第一筆。如果相同鍵卻有不同金額，不要悄悄採最後一筆；要先決定更正事件的規格，或隔離並核對衝突。壞欄位造成的解析失敗在[〈Java 例外與資源關閉〉](#/lesson/fd-java-06)處理。

### HashMap 裡怎麼找門市
鍵的 `hashCode` 幫忙定位桶（bucket）。不同鍵進同一桶叫雜湊碰撞（hash collision），再以 `equals` 分辨；相等的鍵必須具備相同雜湊值。分布適當時查取通常近似常數時間；超過容量與負載因子（load factor）設定的門檻會擴容，重新分配桶的當下有成本。實作可能改善高碰撞桶的查找，仍不保證所有輸入都一樣快。放進 Map 後不要改動影響相等性或雜湊的鍵欄位。

### 反推報表還欠哪個欄位
假若值班同事只能看到 `N1=1750`，無法判斷 N1 是兩筆獨立收款，還是兩筆重送被剔除後的結果。留 `raw`、`unique` 及小計是三個獨立證據。要進一步還原拒絕原因，可從原始順序重播並另記遇過的事件鍵；不要讓 Map 承擔「這列從哪裡來」的工作，對帳才不必反向猜測。

初版和變體要保留舊輸出，否則接手的人只能猜是哪一次重送讓原始數增加。

## 常見錯誤
- 一個門市永遠只剩最後一筆 → 只用 `put(k, cents)` → 先讀舊值再累計。
- 去重後沒法回答來源重送幾次 → 把原始清單覆寫了 → 將原始 List 與 Set 分開。
- 迭代 HashMap 時行序和昨天不同 → 把未承諾的順序當規格 → 固定排序或指定門市順序。

## 小結
先選定「一筆」與「一組」的鍵，再選容器。能同時對上原始數、唯一數與分組總額，比背容器名稱有用。
