---
id: sq-window-04
module: sq-window
order: 4
title: RANK 與 DENSE_RANK
subtitle: 並列第二後面接第幾
status: ready
minutes: 30
level: 1
prereqs:
- sq-window-03
objectives:
- 手算同薪的三種序號與名次
- 保留同一薪級的並列員工
- 把名次排序與結果穩定排序分開
tags:
- rank
- dense_rank
- 並列名次
- Top-N
resources:
- title: DuckDB：窗口函式
  url: https://duckdb.org/docs/stable/sql/functions/window_functions
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 對讀 rank 與 dense_rank，驗證是否跳號。
- title: MySQL：窗口函式
  url: https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀 MySQL 的並列值比較範例。
concepts:
- id: sq-window-04-rank
  prompt: 49000、49000、42000 由高排低，RANK 回什麼？
  answer: 1、1、3；同分同名，下一級反映有兩列在前。
  mcq:
    options:
    - 1、1、3
    - 1、1、2
    - 1、2、3
    - 1、2、2
    answer: 0
    explain: 不跳號的 1、1、2 是 DENSE_RANK；逐列不同是 ROW_NUMBER。
- id: sq-window-04-dense
  prompt: 想選薪水最高的兩種不同金額，並保留並列，該用哪種？
  answer: 按薪額做 DENSE_RANK，取密集排名 ≤ 2。
  mcq:
    options:
    - 全表 LIMIT 2
    - DENSE_RANK <= 2
    - ROW_NUMBER <= 2
    - RANK <= 2
    answer: 1
    explain: 若第一名兩人並列，RANK 會直接跳到 3；需求仍要第二種金額。
  interview:
    question: 分組 Top 3 你怎麼問清楚口徑？
    points:
    - 區別三列、三個名次、三種分數
    - 選擇排名函數
    - 交代並列會不會多於三人
    answer: 我會先問要三個人，還是要前三種分數的所有人。嚴格三人用 ROW_NUMBER 和平手規則；前三種分數用 DENSE_RANK，人數可能超過三個。
- id: sq-window-04-ties
  prompt: 要讓同薪者同名次、又讓畫面按員工號穩定排列，員工號寫在哪？
  answer: 寫在外層 ORDER BY。窗口內只按薪額決定同薪平手。
  mcq:
    options:
    - 改成 PARTITION BY employee_id
    - 先把薪額轉成字串
    - 外層 ORDER BY
    - 加到窗口內作第二個鍵
    answer: 2
    explain: 在窗口內添加唯一員工號會拆開並列；只改外層不影響排名。
practice:
- kind: sql
  category: [top-n, window]
  title: 對照同薪者的兩種排名
  minutes: 6
  level: 1
  dataset: hr
  prompt: |
    只取部門 1 現行薪級。由月薪高到低，計算 `RANK()` 所得 `rank_gap`，與 `DENSE_RANK()` 所得 `rank_dense`；同薪同名次。

    只輸出以下欄位，欄序固定：`employee_id`、`monthly_pay`、`rank_gap`、`rank_dense`。

    排序：`monthly_pay` 降序，同額按 `employee_id` 升序。
  solution: |
    SELECT e.employee_id, s.monthly_pay,
           RANK() OVER (ORDER BY s.monthly_pay DESC) AS rank_gap,
           DENSE_RANK() OVER (ORDER BY s.monthly_pay DESC) AS rank_dense
    FROM employees AS e JOIN salary_history AS s ON e.employee_id = s.employee_id
    WHERE e.dept_id = 1 AND s.valid_to IS NULL
    ORDER BY s.monthly_pay DESC, e.employee_id;
  explain: |
    3 號與 15 號並列第一，接著的 6 號是 RANK 3、DENSE_RANK 2。別在窗口內加員工號，否則就不會並列。
  hints:
  - 兩個窗口都只按薪額排名。
  - 固定顯示序才把員工號加在外層。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-04-rank
  - sq-window-04-ties
  - sq-window-02-sort
  tags:
  - rank
  - dense_rank
  - 同薪
  id: sq-window-04-p1
- kind: sql
  category: [top-n, window]
  title: 每部門最高兩種月薪的人員
  minutes: 9
  level: 2
  dataset: hr
  prompt: |
    每位員工只取現行薪級，以目前部門為分區。每部門選月薪最高的兩種不同金額；同額員工全部保留，輸出不跳號薪級名次 `pay_rank`。空部門不造員工列。

    只輸出以下欄位，欄序固定：`dept_id`、`employee_id`、`monthly_pay`、`pay_rank`。

    排序：`dept_id` 升序，再按 `pay_rank` 升序、`employee_id` 升序。
  solution: |
    WITH ranked AS (
      SELECT e.dept_id, e.employee_id, s.monthly_pay,
             DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY s.monthly_pay DESC) AS pay_rank
      FROM employees AS e JOIN salary_history AS s ON e.employee_id = s.employee_id
      WHERE s.valid_to IS NULL
    )
    SELECT dept_id, employee_id, monthly_pay, pay_rank
    FROM ranked WHERE pay_rank <= 2
    ORDER BY dept_id, pay_rank, employee_id;
  explain: |
    部門 1 不只兩個人：42000 元有 3、15，40000 元的 6 也要留。ROW_NUMBER 會砍成兩人，RANK 在並列後跳號也會漏 6。
  hints:
  - 先確定題目數的是兩種月薪，不是兩個人。
  - 依部門分區，在外層篩名次。
  check:
    ordered: true
    columnNames: true
  concepts:
  - sq-window-04-dense
  - sq-window-04-ties
  - sq-window-03-filter
  tags:
  - dense_rank
  - 分組TopN
  id: sq-window-04-p2
---

主管要看每個部門最高的兩種薪級，並強調同薪的人都要列。若沿用上一堂的序號只取前兩位，並列的人可能被切掉。這堂用同一份薪級比較兩種名次，在報表旁就能看出為什麼某個名次跳號。

## 排列同分者的三條規則

- `RANK() OVER (PARTITION BY dept_id ORDER BY monthly_pay DESC)`：名次（rank）遇到平手時同名次，後面跳過佔用的位置。
- `DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY monthly_pay DESC)`：密集排名（dense rank）每種排序值只占一個名次，不跳號。
- `ROW_NUMBER()`：需要「位置」而不是同分名次時使用。每列一定不同號，應用唯一鍵明定同分者的先後。

在 SQL 練習場的「自由練習」選 `hr` 數據集，執行：

```sql
SELECT e.employee_id, s.monthly_pay,
       RANK() OVER (ORDER BY s.monthly_pay DESC) AS rank_gap,
       DENSE_RANK() OVER (ORDER BY s.monthly_pay DESC) AS rank_dense
FROM employees AS e JOIN salary_history AS s ON e.employee_id = s.employee_id
WHERE e.dept_id = 1 AND s.valid_to IS NULL
ORDER BY s.monthly_pay DESC, e.employee_id;
```

部門 1 的 3 號和 15 號月薪同為 42000，兩種名次都給 1。6 號的 40000 排在這兩人後面，`RANK` 是 3、`DENSE_RANK` 是 2。想看最高兩種薪額時，篩密集名次 1、2 會顯示 3 人。若規格是剛好 2 人，需改用序號並公布誰在同薪時優先；不能宣稱是同薪全部保留。

窗口排序鍵的整組值決定哪些列平手。若把員工號附到窗口排序，薪水相同的兩人因號碼不同就不再同名。顯示時仍可用員工號排出固定順序，只要把它放在外層 `ORDER BY`。這是面試常追問的取捨：一個規則描述分數相等，一個規則只描述展示順序。

DuckDB、Hive SQL、Spark SQL、MySQL 8.4 的這兩種排名都有相同基本口徑；搬到 Hive 時不在排名函數上硬加計算範圍，本課只指定分區和排序。下一個應用是[〈分組 Top N〉](#/lesson/sq-pattern-01)，會用需求反例選合適的排名方式。

## 三種題意，用同一組數據驗

先寫下 42000、42000、40000、38000 四筆。從高到低把位置寫成 1、2、3、4；普通名次為 1、1、3、4；密集名次為 1、1、2、3。這比記一句「並列會不會跳」更快找到題目的合適用法。若要競賽排名，6 號前面有兩人，因此得第 3；若要找第二種薪額，6 號的確是第二種。兩個答案都對，條件不同。

回報分組 Top N 時也要說明空部門怎麼處理。部門 4 沒員工，篩出的排名結果本來就沒有這個部門；若成品要求列表顯示空部門，再用一份完整的部門名單接排名，不要為了補格而在排名的輸入造員工。歷史版本同樣要在窗口前篩掉，不然有多筆歷史的員工可能在同部門競爭多次。

練習時先不篩名次，看看部門 1 的同薪者是否都拿到 1，再把上限設成 2。錯用 `RANK` 會讓 6 號整個消失；錯用 `ROW_NUMBER` 時仍會保留兩人，看似符合「取二」，卻違背取兩種金額的需求。用成品中的人和薪額一起驗，不只看筆數。

還要注意名次從 1 起算，並不是以員工號開始。抽查不同部門都應有第 1 名，若全表只出現一群第一名，先檢查是否忘了分區。

## 常見錯誤

- 並列後顯示 1、1、3 卻想要 1、1、2 → 用 DENSE_RANK。
- 報表筆數超過 N 就以為錯 → 名次前 N 可能有多人並列，先讀清口徑。
- 同薪的人得到不同名次 → 把僅供顯示的員工號移到最外層排序。
