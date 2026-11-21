---
id: fd-linux-04
module: fd-linux
order: 4
title: Shell 變數與引號
subtitle: 日期參數中有空格
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-03
objectives:
  - "比較三種引號對 Bash 參數的影響"
  - "把含空格的時刻傳成一個參數"
  - "驗證 export 是否將設定傳給子程式"
tags:
  - "Bash 引號"
  - "參數展開"
  - "export"
  - "PATH"
resources:
  - title: "bash(1)"
    url: "https://man7.org/linux/man-pages/man1/bash.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "讀 QUOTING、EXPANSION 和 ENVIRONMENT。"
concepts:
  - id: fd-linux-04-double-quotes
    prompt: "如何傳入含空格但不可拆開的變數值？"
    answer: "在展開處用雙引號包住，如 \"$run_at\"。"
    mcq:
      question: "run_at 的值是 2026-11-19 02:00，哪個傳出完整值，且只有一個參數？"
      options:
        - "$run_at"
        - "'$run_at'"
        - "\"$run_at\""
        - "'\"$run_at\"'"
      answer: 2
      explain: "沒引號會分成兩項；單引號保留字面符號，不展開。"
  - id: fd-linux-04-literal
    prompt: "怎樣原樣印出 $run_at？"
    answer: "用單引號包住它，如 printf '%s\\n' '$run_at'。"
    mcq:
      question: "單引號包住 $run_at 時，接收端拿到什麼？"
      options:
        - "變數目前的值"
        - "字面上的 $run_at"
        - "空字串"
        - "兩個參數"
      answer: 1
      explain: "單引號不做參數展開；美元符號和變數名都是內容。"
  - id: fd-linux-04-child-env
    prompt: "目前 Bash 看得到變數，為何新啟動的 Bash 看不到？"
    answer: "一般殼層變數不自動進入子程式環境；export 才會傳給之後啟動的子程式。"
    mcq:
      question: "匯出後，子程式更改自己的值會怎樣？"
      options:
        - "同步到父殼層"
        - "同步到其他分頁"
        - "下次登入永久保留"
        - "只改自己的環境"
      answer: 3
      explain: "環境在啟動時傳入，不是各程式共用的變數表。"
  - id: fd-linux-04-path
    prompt: "report.sh 和 ./report.sh 的查找方式有何不同？"
    answer: "沒有斜線的外部命令依 PATH 搜尋；./ 明確指目前目錄。"
practice:
  - id: fd-linux-04-p1
    kind: hands-on
    title: "做一張時刻參數對照卡"
    minutes: 10
    steps:
      - "執行正文三種引號的對照，再換一個含空格的時刻重做。"
      - "把參數數量、第一個值和 export 前後的結果存入 shell-arguments.txt。"
    checks:
      - "不加引號為 2 項、雙引號為 1 個完整時刻、單引號為字面 $run_at。"
      - "子 Bash 只有在 export 後才印出時刻。"
---

日報作業要吃一個批次時刻，例如 `2026-11-19 02:00`。螢幕上明明是一個時間，腳本卻說收到了兩項。問題不在日期格式，而是 Bash 送出命令之前會依語法組裝參數。本堂讓接收端直接印出收到幾項，不靠畫面猜。

## 值怎麼存，和怎麼傳，是兩回事

變數（variable）是替值取名字。Bash 指派寫成 `name=value`，等號旁不能有空白；如果值含空格，要用引號包住。參數展開（parameter expansion）把 `$name` 換成值。遇到緊接著的字母或底線，用大括號標明界線：`"${day}_orders.csv"` 指的是變數 `day`，不會去查 `day_orders`。

- `"$name"`：展開值，傳作一項；空字串也算一項。傳檔名、日期或標籤時通常選這個。
- `'$name'`：不展開，傳字面內容。上堂的 `awk` 用單引號，才把 `$2` 留給工具，而不是先被 Bash 處理。
- `$name`：在一般命令參數中可能分割字詞，還會拿星號等樣式比對檔名。空值也可能消失，不等同於傳一個沒有字元的值。
- `export name`：把值加入之後啟動的程式環境。父殼層傳給子程式的不是一個可供對方回寫的欄位。

儲存時的引號不會附在值上。日後每次使用都要重新依目的選引號。想像來源檔名是 `order export.csv`：若被拆成兩項，有的命令會報缺檔，有的則去讀兩份真的存在的檔案；第二種還可能產出看似合理的錯誤報表。

## 看接收端印出幾個參數

在 Ubuntu Bash 的練習區執行。`bash -c` 把第一個字串當命令，下一項用作子殼層的 `$0`；用 `--` 佔住那一格，實際參數從 `$1` 起算，`$#` 是數量。括號隔開本次實驗，不改外層變數。

```bash
(
  run_at='2026-11-19 02:00'
  bash -c 'printf "argc=%s first=<%s>\n" "$#" "$1"' -- $run_at
  bash -c 'printf "argc=%s first=<%s>\n" "$#" "$1"' -- "$run_at"
  bash -c 'printf "argc=%s first=<%s>\n" "$#" "$1"' -- '$run_at'
)
```

預期第一行只能看到 `2026-11-19`，第二行有完整時刻，第三行是 `$run_at`。接著看環境變數（environment variable）：`unset` 讓對照從沒設定開始，`${NAME:-unset}` 在值空白或未設定時印替代值。

```bash
(
  unset LAB_REPORT_RUN_AT
  LAB_REPORT_RUN_AT='2026-11-19 02:00'
  bash -c 'printf "before=<%s>\n" "${LAB_REPORT_RUN_AT:-unset}"'
  export LAB_REPORT_RUN_AT
  bash -c 'printf "after=<%s>\n" "$LAB_REPORT_RUN_AT"'
)
```

第一行是 `before=<unset>`，第二行才有時刻。環境也包括搜尋路徑 `PATH`：冒號分隔、從前往後搜尋外部命令。不確定會取到哪個工具時，可用 `command -v sort` 查目前的選擇；直接指定 `./` 或絕對路徑就不用這套搜尋。到[〈排程與環境〉](#/lesson/fd-linux-07)會用精簡的環境重做一次。

## 沒有值，和有一個空值
報表工具可能約定「沒有給區域」表示全部區域，「給了空字串」則是參數錯誤。把第一段的 `run_at` 複製到自己的筆記後，思考若指派 `run_at=''` 會怎麼樣。沒有引號的展開會讓這個參數不見；加雙引號則仍會送一項，只是內容是空的。這個差別即使畫面都沒有字，也能從接收端的 `argc` 分辨。你也可以確認單引號對照仍印出字面文字，表示它不受變數內容影響。

把這個測試放在真正讀檔之前，也可以先確認參數的形狀，再判斷內容是否合法。

## 常見錯誤

- `run_at: command not found` → 把指派寫成含空格的命令 → 改 `run_at='2026-11-19 02:00'`。
- 收到字面 `$run_at` → 展開處用的是單引號 → 需要值時改雙引號。
- 同分頁新程式還是說沒設定 → 匯出晚於啟動 → 要在啟動前匯出，不必改永久設定。
