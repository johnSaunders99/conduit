---
id: sq-model-09
module: sq-model
order: 9
title: 拉鏈表
subtitle: 午夜生效用開區間還是閉區間
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-08
objectives:
- 以半開區間查出切換日唯一有效的薪級
- 用下一筆生效日重建拉鏈迄日
- 描述同日修正、晚到與重跑的載入策略
tags:
- 拉鏈表
- 半開區間
- 生效時間
- LEAD
resources:
- title: Kimball Group：SCD 二型
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀起日、迄日與現行旗標的角色。
concepts:
- id: sq-model-09-half-open
  prompt: 舊版迄日和新版起日同為 2 月 1 日，當日用哪一版？
  answer: 只用新版；起日包含、迄日排除，避免同一天撞兩版。
  mcq:
    options:
    - 兩版都算
    - 只算新版
    - 只算舊版
    - 兩版均不算
    answer: 1
    explain: 使用兩端都含會雙重配對；兩端都不含則漏掉切換日。
- id: sq-model-09-open-end
  prompt: 拉鏈表的 valid_to 是 NULL，查詢怎麼解讀？
  answer: 依本表約定代表沒有已知迄日；有效仍要檢查 valid_from 不晚於查詢日。
  mcq:
    options:
    - 等於今天
    - 等於起日
    - 所有日期都有效
    - 無迄日，仍要檢查起日
    answer: 3
    explain: 無迄日不是任何日期都成立，SQL 也不會自動把 NULL 當無限大。
- id: sq-model-09-next-start
  prompt: 若每次更動都取代前一版，如何由生效數據重建迄日？
  answer: 按業務鍵分組、按起日排列，下一版起日是這版迄日；最後一版迄日為 NULL。
  mcq:
    options:
    - 全表最大起日
    - 上一版起日
    - 同一業務鍵的下一版起日
    - 任意查詢當日
    answer: 2
    explain: 要在同一員工內向後取下一列，不能取另一人的日期，也不能用全表最大值。
- id: sq-model-09-late
  prompt: 晚到版本插進既有兩版之間，哪兩個迄日需要重算？
  answer: 前一版改結束於晚到版起日；晚到版結束於原後一版起日。再按影響範圍對帳。
  interview:
    question: 面試要你實作每日拉鏈表，如何保證重跑不多出版本？
    answer: 我會先對同一業務鍵和生效時間選出唯一的來源列。屬性真變才新增；用半開區間關閉舊版，重跑用穩定的版本識別更新同一列。晚到就重建受影響的鍵的區間，再驗證互不重疊和切換點只命中一次。
    points:
    - 區分生效日和接收日
    - 版本鍵穩定且能重跑
    - 驗證區間及晚到影響範圍
practice:
- id: sq-model-09-p1
  kind: sql
  category: [scd, time]
  title: 查午夜切換當天的四個人
  minutes: 4
  level: 1
  dataset: hr
  prompt: |
    查員工 1–4 在 2026-02-01 的有效薪級，依序輸出 `employee_id`、`valid_from`、`valid_to`、`monthly_pay`，依 `employee_id` 升序。起日含、迄日不含；NULL 表示沒迄日。
  solution: |
    SELECT employee_id, valid_from, valid_to, monthly_pay
    FROM salary_history
    WHERE employee_id BETWEEN 1 AND 4 AND valid_from <= DATE '2026-02-01'
      AND (valid_to > DATE '2026-02-01' OR valid_to IS NULL)
    ORDER BY employee_id;
  explain: |
    用起日含、迄日不含的兩條條件。`BETWEEN` 含兩端，舊版也會被選到。
  hints:
  - 先以員工鍵取範圍
  - 分開寫起日與迄日條件
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-09-half-open
  - sq-model-09-open-end
  - sq-model-08-type-two
  tags:
  - 拉鏈表
  - 半開區間
- id: sq-model-09-p2
  kind: sql
  category: [scd, window]
  title: 忽略原本迄日，重建拉鏈
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    假設各員工的每一版由下一版連續接替。不要讀 `valid_to`，只從 `employee_id`、`valid_from`、`monthly_pay` 推導新版鏈。依序輸出 `employee_id`、`valid_from`、`valid_to`、`monthly_pay`，依 `employee_id`、`valid_from` 升序。最後一版迄日為 NULL。
  solution: |
    SELECT employee_id, valid_from,
           LEAD(valid_from) OVER (PARTITION BY employee_id ORDER BY valid_from) AS valid_to,
           monthly_pay
    FROM salary_history ORDER BY employee_id, valid_from;
  explain: |
    `LEAD` 在員工的分組內取下一個起日。缺少 `PARTITION BY` 會讓一人的最後版本錯接別人的起日；這個做法不適用於有停薪空窗卻沒記錄空窗事件的來源。
  hints:
  - LEAD 是取排序後的下一列
  - 按員工分區
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-09-next-start
  - sq-model-09-late
  - sq-model-04-surrogate
  tags:
  - 拉鏈表
  - 半開區間
---

## 午夜應該只命中一版

拉鏈表（zipper table）是以起迄有效期表示版本歷史的做法。每列保留業務鍵與當時屬性；用 `[valid_from, valid_to)` 記法，左端包含、右端排除。員工 1 在 1 月 31 日仍領 38000 元，2 月 1 日起是 40500 元。舊版迄日和新版起日同寫 2 月 1 日：前者不含、後者包含。若日期改成時間戳，切換點要明寫在同一時區與精度，不用「前一日 23:59:59」代表所有時刻。

在 `hr` 判斷指定日，條件是 `valid_from <= 查詢日`，並且 `valid_to > 查詢日 OR valid_to IS NULL`。後半句必須成一組，否則可能讓未開始的現行版也漏進來。結果每位員工最多一列；零列可能是沒入職，也可能是區間斷裂，必須依來源規則判斷。

## 從變更重建有效期

若來源只送「從哪一天改成多少」，且每版一路有效到被下一版取代，可用下一版的日子當迄日。窗口函式（window function）可在不把多列壓成一列的情況下看相鄰列。`LEAD(欄位) OVER (PARTITION BY 業務鍵 ORDER BY 生效日)` 就是按對象分組，再取下一列；沒有下一列回傳 NULL。這項推導假設同一人、同一起日只有一個確定版本；如果停薪或離職有空窗，先讓來源記出該事件，不要直接把空窗補成有薪。

正式載入可以先收一份變更集合：同鍵同生效點依來源修訂號選唯一列，內容無變就不新增版本。對受影響員工重建區間，再驗證區間不重疊、起日早於非空迄日、最多一個未結束版，才以交易替換或以候選表發布。晚到若插在中間，前一版和新插入版的迄日都要重算；若事實已存版本鍵，再依影響區間決定是否重解鍵，不重排所有人。重跑同批變更應得到同一份版本集合。

可以另外寫一份載入驗收小抄：先按同一員工、同一起日分組找重複，再檢查有下一版的列有終點且不晚於下一版起日，最後一版得無終點。這兩類檢查分別抓到同日起兩版與區間相交。若業務定義要求連續有效，再檢查每段迄日恰好等於下一段起日；若允許無薪期，不以缺口判錯。

想像事後收到 1 月 15 日生效的中間版本。本來 1 月 1 日至 2 月 1 日的一段，要在 1 月 15 日切開。準備切換日前後各一個查詢，以及切換點本身，可立即辨認少一段、錯一天或出現兩筆。只檢查「最後一筆是新的」捕捉不到中間變動。

用測試來守住這三個邊界。

## 方言與常見錯誤

DuckDB、Hive SQL、Spark SQL 及 MySQL 8 都可在本課使用 `LEAD`。若要比較日期相隔幾天，DuckDB `date_diff('day', a, b)` 和 Hive SQL、Spark SQL、MySQL 的 `DATEDIFF(b, a)` 次序相反。用半開區間直接做不等式，不必先對迄日減一天。

- 切換日兩列 → `BETWEEN` 兩端都含 → 改成左閉右開。
- 新版本接到別人的起日 → 漏了分區 → `PARTITION BY employee_id`。
- 重跑同批新增兩次 → 沒有穩定的版本識別 → 去重、重建受影響鏈並驗證。
