---
id: bd-jvm-01
module: bd-jvm
order: 1
title: Java Hive UDF
subtitle: 給空白門市碼一條固定規則
status: ready
minutes: 25
level: 3
prereqs: []
objectives:
  - 為缺值、空格及有效碼定義契約
  - 用純 Java 驗算四筆，寫出 Hive 轉接層
tags:
  - hive
  - udf
  - evaluate
  - 'null'
  - normalization
resources:
  - title: Apache Hive：自訂函式
    url: https://hive.apache.org/docs/latest/language/hiveplugins/
    kind: doc
    lang: en
    minutes: 7
    required: false
    checked: '2026-11-20'
    note: 讀 UDF 子類別和 evaluate 的缺值處理。
  - title: Apache Hive：內建函式
    url: https://hive.apache.org/docs/latest/language/languagemanual-udf/
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: 先看既有字串函式，再決定是否自訂。
concepts:
  - id: bd-jvm-01-scalar
    prompt: 純量 UDF 每次呼叫會輸出什麼？
    answer: 每組輸入得到一個值，不跨列算總額。
    mcq:
      options:
        - 每個分區一個總數
        - 每組輸入一個值
        - 一定輸出整表
        - 一律不回傳
      answer: 1
      explain: 分組彙總與展開多列不是這堂的逐列轉換。
  - id: bd-jvm-01-missing
    prompt: 只含半形空格的門市碼得到什麼？
    answer: 去掉兩端半形空格後為空，本例回傳 UNKNOWN。
    mcq:
      options:
        - 空字串
        - 原值
        - UNKNOWN
        - 'NULL'
      answer: 2
      explain: 這是本例明訂的缺值代碼，不是 Hive 的預設。
    interview:
      question: 什麼邏輯值得放進 Hive UDF？
      points:
        - 先考慮內建函式
        - 逐列且可重現
        - 說清 NULL 與空白
      answer: 單一查詢能用內建函式寫清楚，我先用內建函式。若多處要一致，我才抽出逐列規則，先驗 NULL、半形空白和正常碼；evaluate 不查外部服務。
  - id: bd-jvm-01-boundary
    prompt: 純 Java 跑對四列，能證明 Hive 能呼叫嗎？
    answer: 不能；另驗引擎載入、工作階段註冊及字串轉接。
    mcq:
      options:
        - 能，四列涵蓋載入
        - 不能，還缺引擎查詢
        - 能，只要檔名正確
        - 只需比執行秒數
      answer: 1
      explain: 類別路徑、版本與引擎如何傳 NULL 都不是純規則所能證明。
practice:
  - id: bd-jvm-01-p1
    title: 保存四筆門市碼驗算
    kind: code
    minutes: 9
    steps:
      - 按照本文建立兩個 Java 檔，先只編譯純規則檔。
      - 另測 S 08 及前後加空格的 S 08。
      - 把輸入、期望與結果記到 udf-cases.txt。
    checks:
      - 原四筆依序 UNKNOWN、UNKNOWN、S07、S07；兩個新例都保留內部空格。
      - 筆記明寫這一步未驗 Hive。
---

## 先寫清缺值，再決定要不要自訂函式
兩個來源在半夜合併。來源甲的缺值是 `NULL`，來源乙給一串空格；同一家門市有時寫成 ` S07 `。儀表板如果直接分組，空格和缺值就會被拆開。純量自訂函式（scalar user-defined function, UDF；台灣亦稱使用者定義函式）是把一組輸入轉成一個值，不會讀到全表後才加總。先沿用[〈Hive UDF〉](#/lesson/bd-hive-06)的原則查現成函式；簡單規則能在查詢表達清楚時，不必為了寫 Java 而長期維護一個 JAR。

本堂以小樣本固定規格：只移除兩端的半形空格 U+0020；缺值與去除後為空的字串改為 `UNKNOWN`；內部空格和大小寫維持原樣。這個代碼是保留值，若來源也可能把它當真正的門市碼，就要和來源協商另一種標記，否則下游無法區分兩者。今天不把格式有效和門市真實存在混為一談，也不查外部名單。

## 純規則和引擎轉接各做一件事
`static String normalize(String raw)` 負責業務規則；它不連服務、不開檔，也不把先前列的結果保存在物件裡。Hive 簡單 API 的基本形狀是 `public class ... extends UDF`，配一個公開的 `evaluate(...)`；`Text` 是 Hadoop 的字串表示，轉接層先判斷 Java 空參照，再轉成正常字串。引擎可以在不同工作者處理不同列，所以不能靠「記住上一列」做全表去重。

## 先讓 Windows 終端跑出四列
在 `C:\dev\conduit-lab\jvm\hive-udf\src\main\java\lab\hive` 存下 `StoreCode.java`。左、右兩個邊界只跳過兩端的半形空格，右邊界不在結果內。

```java
package lab.hive;

public class StoreCode {
    public static String normalize(String raw) {
        if (raw == null) return "UNKNOWN";
        int left = 0, right = raw.length();
        while (left < right && raw.charAt(left) == ' ') left++;
        while (right > left && raw.charAt(right - 1) == ' ') right--;
        return left == right ? "UNKNOWN" : raw.substring(left, right);
    }

    public static void main(String[] args) {
        for (String raw : new String[]{null, "   ", " S07 ", "S07"}) {
            System.out.println(normalize(raw));
        }
    }
}
```

在 `hive-udf` 專案根的 PowerShell 執行；`-d .` 把類別放進目前目錄下相應的套件路徑。

```powershell
javac -d . .\src\main\java\lab\hive\StoreCode.java
java -cp . lab.hive.StoreCode
```

應印兩行 `UNKNOWN`，再印兩行 `S07`。同一來源目錄再存 `StoreCodeUdf.java`。此檔要等[〈Hive UDF 打包與註冊〉](#/lesson/bd-jvm-02)提供依賴才編譯，不能用上面只編純規則的命令執行。

```java
package lab.hive;

import org.apache.hadoop.hive.ql.exec.UDF;
import org.apache.hadoop.io.Text;

public class StoreCodeUdf extends UDF {
    public Text evaluate(Text raw) {
        return new Text(StoreCode.normalize(raw == null ? null : raw.toString()));
    }
}
```

### 不讓固定代碼等於「查過主檔」
如果進來的是 `S99`，規則照樣輸出它；它是否存在要由另一道核對處理。若改成碰到未知門市就向服務請求，查詢重跑和工作者數量可能改變請求數，遠端的偶發失敗也會讓相同輸入變成不同結果。先守住這堂的逐列契約：缺值可追，格式轉換可重現，主檔一致性用專門管道另驗；不因輸出是單一值就涵蓋所有數據品質。

可以用口述測試替代第一輪眼讀：先講缺值、全空格、兩端空格、已乾淨 4 種情形，逐一預測再執行。同一種輸出可能由不同分支得到，四列都要有。

當兩個來源將缺值寫成不同樣子時，下一個使用者能從契約知道為何它們被分到同一組。

## 常見錯誤
- 缺值拋空參照例外 → 檢查前先呼叫 `toString()` → 先認出 `raw == null`。
- `S 08` 變成 `S08` → 移除了全部空格 → 保留內部字元，只改兩端。
- 四行都對就說 Hive 已可用 → 測到的是 Java 規則 → 隔堂在同一條 Hive 連線另驗。

## 小結
能先在引擎之外說清楚順序、缺值和保留範圍，裝進 Hive 的才是一份可被重驗的規則，而不只是一段碰巧有輸出的程式。
