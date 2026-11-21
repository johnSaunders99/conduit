---
id: fd-java-03
module: fd-java
order: 3
title: Java 類型與控制流程
subtitle: 把 Python 訂單規則搬過來
status: ready
minutes: 35
level: 1
prereqs:
  - fd-java-02
objectives:
  - 選用 int、long、boolean 和 String 表示訂單欄
  - 用 if 與 for 驗算含等號的金額門檻
tags:
  - primitive
  - long
  - if
  - for
  - equals
resources:
  - title: Oracle：Java 語言基礎
    url: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/index.html
    kind: doc
    lang: en
    minutes: 8
    required: false
    checked: '2026-11-20'
    note: 讀原始類型、比較運算與控制流程。
concepts:
  - id: fd-java-03-bounds
    prompt: 恰好 1000 分也該保留，哪個條件正確？
    answer: 以 cents >= 1000 寫出包含界線的規則。
    mcq:
      options:
        - cents > 1000
        - cents >= 1000
        - cents == 1001
        - cents < 1000
      answer: 1
      explain: 只有 >= 同時包含界線與界線以上；測 999、1000、1001 可辨認這組差異。
  - id: fd-java-03-long
    prompt: 兩個 int 訂單欄相乘後才存進 long，為何仍可能溢位？
    answer: 兩個運算元都是 int，乘法先以 int 計算。
    mcq:
      options:
        - 因為 long 比 int 小
        - 因為賦值會先轉成字串
        - 因為乘法在賦值前以 int 計算
        - 因為 int 不能乘法
      answer: 2
      explain: 先轉其中一個運算元，例如 (long) qty * unitCents，才會以 long 做乘法。
  - id: fd-java-03-equals
    prompt: 檢查給定狀態的字串內容是否為 paid，哪種寫法也能接受狀態是 null？
    answer: 用 "paid".equals(status)，由非 null 的固定字串比較內容。
    mcq:
      options:
        - status == "paid"
        - status.equals("paid")
        - '"paid".equals(status)'
        - status = "paid"
      answer: 2
      explain: == 比較參照，status 為 null 時不能呼叫方法，單一等號是賦值。
  - id: fd-java-03-division
    prompt: 在 Java 中 7 / 2 的結果為何不是 3.5？
    answer: 兩個運算元都是整數，整數除法向零截斷；可用 7.0 / 2 或先轉類型。
practice:
  - id: fd-java-03-p1
    title: 保存訂單門檻的邊界驗算
    kind: code
    minutes: 11
    steps:
      - 先跑範例，逐列記下 999、1000、1001 分是否保留。
      - 把狀態已付款的 1000 分改成 999，重編並記下新的總數。
      - 在 OrderFilter.java 旁存下 bounds.txt，保留條件和兩次輸出。
    checks:
      - 原版保留 T02 與 T03，總額 2001 分。
      - 改動後只保留 T03，總額 1001 分；取消單仍不計。
---

## Python 的規則還在，先把欄位說清楚
營運需要一份小清單：已付款且金額至少 1000 分的訂單。你在 Python 會先寫條件再逐列走訪。Java 多一步：在變數宣告時交代數據類型（type），讓編譯器知道你想放什麼，以及能做哪些操作。金額先用整數分，避免把二進位小數當十進位精確金額；輸出保留單位，不把 `2001` 說成 2001 元。

## 語法小抄
- `int count = 0;` 是 32 位元整數範例；`long total = 0L;` 用 64 位元整數留累加空間。`double` 可表二進位浮點數，適合非精確測量；`boolean` 只取 `true` 或 `false`。前三種數值類型以及布林都是原始類型（primitive type）；`String` 是參照類型。
- `String status = "paid";` 用字串表狀態；內容比較用 `equals`。`"paid".equals(status)` 即使收到 `null`（無物件參照）也會得 `false`。`==` 對參照不是內容比較。`< <= == != >= >` 用於整數比較；`&&` 意為且，`||` 意為或，`!` 反轉條件。
- `if (condition) { ... } else if (other) { ... } else { ... }` 依順序選中第一個成立分支；`for (int i = 0; i < n; i++) { ... }` 依序初始化、檢查條件、跑本文、遞增。`while (condition) { ... }` 每輪先檢查條件。逐一取元素可用 `for (long cents : amounts) { ... }`；本例用索引同時讀取三個陣列。
- `long[] amounts = {999, 1000};` 是 2 格陣列（array），索引（index）從 0 起算，`amounts.length` 是長度。這次先假設三欄永遠等長，下堂[〈類別、介面與 Record〉](#/lesson/fd-java-04)會把同一訂單的欄位收成一個值。

## 用界線旁的數字驗算
在 `C:\dev\conduit-lab\java` 存成 `OrderFilter.java`。在同一資料夾執行 `javac .\OrderFilter.java`，成功後執行 `java -cp . OrderFilter`。

```java
public class OrderFilter {
    public static void main(String[] args) {
        String[] ids = {"T01", "T02", "T03", "T04"};
        String[] statuses = {"paid", "paid", "paid", "cancelled"};
        long[] amounts = {999, 1000, 1001, 3000};
        long total = 0L;
        for (int i = 0; i < ids.length; i++) {
            boolean paid = "paid".equals(statuses[i]);
            if (paid && amounts[i] >= 1000) {
                System.out.println(ids[i] + " " + amounts[i]);
                total += amounts[i];
            }
        }
        System.out.println("total_cents=" + total);
    }
}
```

只讀輸出很容易漏看剛好等於界線的訂單。先手算：T01 差 1 分而排除；T02 恰好合格；T03 超過門檻；T04 雖然金額最大但已取消。符合只有兩筆，總額 2001 分。把門檻的比較故意換成 `>`，其它列都沒變，只有 T02 消失；這就是最小邊界反例。測完記得改回來。

還有個容易從 Python 帶過來的假設：Java 的 `7 / 2` 是 3，`7.0 / 2` 才是 3.5；兩個 `int` 相乘可能先溢位，即使後面存入 `long`。需要寬一點的運算，應在乘法前轉一邊，例如 `(long) qty * unitCents`，而不是乘完才轉。

### 負值、空值及 0 該不該通過？
別讓「符合今天清單」和「原始數據有效」互相代替。本堂的 999 分不符合報表門檻，並不表示數據列壞掉；0 元小票也可能有業務意義。狀態為 `null` 時，本例的比較只會得到 `false`，一般批次卻可能需要把那列交給例外流程，而不是假裝它是取消單。先照題意判定清單資格，再另定缺失、負值等品質規格。後面[〈Java 例外與資源關閉〉](#/lesson/fd-java-06)才會把格式不合法的列隔離出來。

三個陣列的寫法還有另一個驗算：如果 `ids` 有 4 格、`statuses` 只有 3 格，即使迴圈條件對也會在最後一輪失敗。若只有順序錯，甚至可能不報錯但金額對到另一張訂單。用以下方式查規則最直觀：先在紙上把三欄排成 4 列，每列寫保留或排除，再跟輸出逐列對照。

## 常見錯誤
- 1000 分被排除 → 比較用成 `>` → 改 `>=` 並保留等於門檻的測資。
- 相同狀態文字偶爾判錯 → 用 `==` 比參照 → 用 `"paid".equals(status)`。
- 最後一輪索引越界 → `i <= ids.length` 走到不存在的一格 → 用 `i < ids.length`。

## 小結
別只測明顯合格的訂單。用界線兩側與等號各一筆，再放一筆高額取消單，才看得出兩道條件是否都生效。
