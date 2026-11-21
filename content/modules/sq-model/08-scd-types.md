---
id: sq-model-08
module: sq-model
order: 8
title: SCD 一型與二型
subtitle: 搬家前的業績算在哪座城
status: ready
minutes: 30
level: 2
prereqs:
- sq-model-07
objectives:
- 依報表是否應重述歷史選擇 SCD 一型或二型
- 用兩次觀測驗證舊版與現行版的差別
- 辨認覆寫政策與歷史版本混用所造成的錯誤
tags:
- SCD
- 一型覆寫
- 二型增版
- 歷史屬性
resources:
- title: Kimball Group：SCD 一型
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-1/
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 讀覆寫對歷史分析的影響。
- title: Kimball Group：SCD 二型
  url: https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀新增版本、代理鍵與生效日期。
concepts:
- id: sq-model-08-type-one
  prompt: 分類有拼字誤植，且商家希望舊報表一併改正，可選哪型？
  answer: SCD 一型覆寫描述；應確認所有相關版本是否都應更正。
  mcq:
    options:
    - 二型加新版本
    - 一型覆寫
    - 保留錯字且新增事實
    - 每週重算代理鍵
    answer: 1
    explain: 需求是重述歷史而非保留錯字。二型適用有意義的業務變動。
- id: sq-model-08-type-two
  prompt: 會員搬家而報表要保留舊城業績時，應怎麼改維度？
  answer: 關閉舊版本，新開一列與新代理鍵；保留同一業務鍵，讓各事實指向當時版本。
  mcq:
    options:
    - 只覆寫城市
    - 刪除舊版
    - 替會員分配新業務身分
    - 同業務鍵，新版本與代理鍵
    answer: 3
    explain: 覆寫或用最新版本會搬走歷史業績；改業務鍵會切斷同一會員。
- id: sq-model-08-mixed
  prompt: 同一張維度表能不同欄位採不同 SCD 政策嗎？
  answer: 可以；明訂哪個屬性需要保存歷史、哪個要更正，並讓載入與對帳遵守同一規則。
  mcq:
    options:
    - 可以，用欄位級規則
    - 不行，因為每張表必須全二型
    - 可以，無需保存規則
    - 只能依 SQL 引擎決定
    answer: 0
    explain: 政策由業務需要決定，不是所有欄位用同一型，也不能每次隨機決定。
  interview:
    question: 會員名更正與搬家同時到，你怎麼載入？
    answer: 先問名字是不是要重述歷史。如果只是錯字，我按政策更正需要更正的版本；城市如果要保留業績歸屬，就追加新版本。之後驗證舊單的城市不變，新單用新城。
    points:
    - 依報表需求分型
    - 說明舊事實是否需要更新
    - 有可手算的驗證
- id: sq-model-08-current-vs-asof
  prompt: 現行版能回答過去某天的薪級嗎？
  answer: 只有當時恰好與現行相同；要可靠回答必須以查詢日選版本。
practice:
- id: sq-model-08-p1
  kind: sql
  category: [scd, model]
  title: 只看目前薪級版本
  minutes: 4
  level: 1
  dataset: hr
  prompt: |
    輸出 `salary_history` 所有目前版本的 `employee_id`、`valid_from`、`monthly_pay`，按 `employee_id` 升序。「目前」在本數據集定義為無迄日。
  solution: |
    SELECT employee_id, valid_from, monthly_pay
    FROM salary_history WHERE valid_to IS NULL ORDER BY employee_id;
  explain: |
    空迄日代表未結束。不要用最大薪級猜測，薪級也可能下降。
  hints:
  - 用 IS NULL，不是 = NULL
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-08-current-vs-asof
  - sq-model-08-type-two
  tags:
  - SCD
  - 一型覆寫
- id: sq-model-08-p2
  kind: sql
  category: [scd, model]
  title: 對照所有員工的前後薪級
  minutes: 8
  level: 3
  dataset: hr
  prompt: |
    比較 2026-01-31、2026-02-01 兩日有效薪級；列出兩日均有版本的員工，包含未調薪的人。依序輸出 `employee_id`、`old_pay`、`new_pay`、`pay_delta`（新金額減舊金額），按員工鍵升序。
  solution: |
    WITH old_version AS (
      SELECT employee_id, monthly_pay FROM salary_history
      WHERE valid_from <= DATE '2026-01-31'
        AND (valid_to > DATE '2026-01-31' OR valid_to IS NULL)
    ), new_version AS (
      SELECT employee_id, monthly_pay FROM salary_history
      WHERE valid_from <= DATE '2026-02-01'
        AND (valid_to > DATE '2026-02-01' OR valid_to IS NULL)
    )
    SELECT o.employee_id, o.monthly_pay AS old_pay, n.monthly_pay AS new_pay,
           n.monthly_pay - o.monthly_pay AS pay_delta
    FROM old_version o JOIN new_version n ON o.employee_id = n.employee_id
    ORDER BY o.employee_id;
  explain: |
    先用半開有效期選兩日版本再比較。只讀現行列無從找到舊金額；未調薪保留差額 0。用含迄日的 BETWEEN 在切換日可能同時找到新舊版。
  hints:
  - 兩份有效期查詢分別取前後日
  - 用員工鍵連接後算差額
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-model-08-type-two
  - sq-model-08-current-vs-asof
  - sq-model-07-periodic
  tags:
  - SCD
  - 一型覆寫
---

## 先問歷史要不要改

會員搬家後，營運回看上月業績，應看到舊城市還是新城市？這是報表合約，而不是 SQL 函式問題。維度屬性會變，但不一定每個變動都要留歷史。處理這些變化的方法叫緩慢變化維度（slowly changing dimension，SCD，亦稱緩變維）。

**一型（Type 1）** 用新值覆寫舊值。假設原先誤寫「山成」，正確是「山城」，兩者不是實際遷移。若業務希望舊報表也正名，就覆寫。若該維度還因其他屬性保有多個版本，這個更正是否要套用到歷史各版，要按欄位的規則處理。一型最大的代價是不能單靠維度還原先前看見的值。

**二型（Type 2）** 把真正的業務變動另存一列。假設會員 42 在 2 月 1 日從山城搬到河岸；將山城版本的迄日設成 2 月 1 日，再新增河岸版本，起日同為 2 月 1 日。舊列和新列共用業務鍵 42，但各有代理鍵。舊事實照常連舊版，新事實依事件有效日選新版。指向哪個版本如果改了，必須是明訂的更正，不能每天用最新描述覆蓋。

## 比較覆寫和保留各交付什麼

在 `hr` 觀察薪級。員工 1 的現行值是 40500 元。若只有一型覆寫後的表，當你回頭問 1 月底，就答不出原來的 38000 元。二型的前後兩列都在，所以可作兩個日期查詢，再算兩欄的金額差。拿員工 3 的不變版本當負例：應看到 0，而不是把它當成調薪。把這一正一反記在驗收筆記，有助於發現把「有兩次觀測」誤當「一定有變動」的查詢。

一型與二型也能同時存在。可讓名字錯字做一型修正，讓等級或城市的真正變動走二型。但如果把同一欄的政策臨時改掉，兩年度會變成不同含義。規則應記錄屬性、範圍、判斷變更的方式，以及誰核可更正。下一堂[〈拉鏈表〉](#/lesson/sq-model-09)會實際說明如何關閉區間且不留下兩個現行版。

判斷是否有變也要用正確的比較基準。原始城市的首尾空格不一定是搬家；先依約定清理格式，使用者真正改成另一座城才新增一版。追溯要求高時也要保存收到更正的時間，用以區別「從何日生效」和「何時才知道」，不能將兩者都塞進同一日期欄。

把這類清理規則固定下來，才能分辨輸入格式噪音與真正的業務變動。

## 方言與常見錯誤

比較新舊版本的可空欄位時，`<>` 遇到 NULL 不能判定為變更。DuckDB 可用 `IS DISTINCT FROM`；Hive SQL、Spark SQL 及 MySQL 可用 `NOT (old_value <=> new_value)` 表達空值安全的不相等。本課月薪無 NULL，練習可以用一般比較。

- 舊月業績換了城市 → 不該重述的屬性被覆寫 → 用二型保留。
- 錯字修正後仍在舊月出現 → 更正只套到現行版 → 核對一型適用範圍。
- 同一會員的單跑出兩倍 → 事實只連業務鍵 → 改用版本鍵或有效日選版。
