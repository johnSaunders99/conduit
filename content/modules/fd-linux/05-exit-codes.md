---
id: fd-linux-05
module: fd-linux
order: 5
title: 腳本與結束碼
subtitle: 失敗後別繼續發送成功通知
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-04
objectives:
  - "即時讀取上一條命令的結束碼"
  - "用條件阻止失敗後發出成功通知"
  - "說明 pipefail 為何能暴露前段錯誤"
tags:
  - "結束碼"
  - "pipefail"
  - "Bash 腳本"
  - "重跑"
resources:
  - title: "bash(1)"
    url: "https://man7.org/linux/man-pages/man1/bash.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "讀 EXIT STATUS、Pipelines 與 if 條件。"
concepts:
  - id: fd-linux-05-status
    prompt: "$? 回答哪一次的狀態？"
    answer: "上一個命令或管道；再執行別的命令就會改變。"
    mcq:
      question: "false; echo ready; printf '%s\\n' \"$?\" 最後通常印什麼？"
      options:
        - "1，因為前面失敗"
        - "0，因為上一個 echo 成功"
        - "ready，因為狀態就是文字"
        - "2，因為有兩步"
      answer: 1
      explain: "echo 的狀態已取代 false；狀態與文字輸出不是同一回事。"
  - id: fd-linux-05-gated-publish
    prompt: "如何阻止清洗失敗後印出成功通知？"
    answer: "用 if 判斷狀態，或用 && 接只在前一步成功才執行的命令。"
    mcq:
      question: "bash report.sh missing.txt && printf 'published\\n' 為何不印成功？"
      options:
        - "printf 不能接狀態"
        - "缺檔更動 PATH"
        - "&& 只在左側回傳 0 時走右側"
        - "所有分隔符都自動跳過"
      answer: 2
      explain: "這是 && 的條件，普通分號不檢查上一個結果。"
  - id: fd-linux-05-pipeline-status
    prompt: "為什麼 false | true 預設可能回成功？"
    answer: "Bash 預設採最後一段的狀態；pipefail 才讓任一段失敗時回非零。"
    mcq:
      question: "哪一項會讓最後一段的成功不再遮住前段失敗？"
      options:
        - "set -o pipefail"
        - "把 > 改成 >>"
        - "命令放雙引號"
        - "尾端再加 true"
      answer: 0
      explain: "pipefail 改變整條管道的判定；其餘不會保留前段失敗。"
    interview:
      question: "凌晨的匯入說找不到來源，但報表檔仍在。你會怎麼避免誤發？"
      answer: "我先查這次的結束碼和批次，不把上次留下的檔案當今天的。產出先寫在暫存檔，寫完再換成正式檔；如果讀不到來源，就以非零退出並保留診斷，不發成功通知。"
      points:
        - "核對這一次的執行狀態與批次"
        - "暫存寫完才發布"
        - "失敗保留診斷，不發成功通知"
  - id: fd-linux-05-stale-result
    prompt: "失敗時為什麼不能只看報表檔是否存在？"
    answer: "檔案可能來自前次成功；先驗證本次結束碼和發布條件。"
practice:
  - id: fd-linux-05-p1
    kind: hands-on
    title: "讓缺檔不再發出成功通知"
    minutes: 10
    steps:
      - "建立 report.sh 與 paid.txt，先跑成功，再給一個不存在的來源。"
      - "用 cmp 核對失敗未改前次成果；正常重跑一次。"
    checks:
      - "成功版只有 o301 與 o302 各一行。"
      - "缺檔是 2，沒有第二次 published，同一份輸入重跑也不增加列。"
---

清洗腳本說找不到輸入，下一行卻說日報已發布。只看最後一句，接班的人就會把昨天的數據當今天的結果。本堂把發布設成有條件的動作：只有新結果寫好並換到正式檔名，呼叫端才印成功通知。

## 狀態回答成敗，輸出交付內容

腳本（script）是保存下來、交給殼層執行的命令。結束碼（exit status）是數字；慣例是 `0` 成功，非零由命令定義。`$?` 要緊接著讀；先查 `ls` 再讀，看到的已不是原來那次。`exit 2` 回傳自訂狀態；沒有明寫 `exit` 時，通常由最後一個執行的命令決定結果。

- `if command; then …; else …; fi`：用命令的狀態分支。`[[ -f "$1" ]]` 查是否一般檔案，`-r` 查可讀，`!` 反轉條件。
- `a && b`：左側成功才執行右側；`a || b`：左側非零才執行右側。分號不會攔截失敗。
- `a | b` 預設用最後一段的狀態。`set -o pipefail` 改成取最右側的非零狀態，全部成功才回零；不會替你回滾已經寫下的內容。
- 有些非零是可預期的分支。例如 `cmp` 回 `1` 表示內容不同。先查工具的約定，再決定要重試、停止或走另一個分支。

在 Ubuntu Bash 任意練習目錄驗證管道，括號隔開設定：

```bash
(false | true; printf 'default=%s\n' "$?")
(set -o pipefail; false | true; printf 'pipefail=%s\n' "$?")
```

第一行是 `default=0`，第二行是 `pipefail=1`。這個改變影響的是誰收到失敗，不是把 `false` 修成成功。

## 先寫好，再亮綠燈

在 `C:\dev\conduit-lab` 新建 `linux\exit-codes`，以 UTF-8、LF 存為 `report.sh`。這個資料夾只放本堂樣本。`-ef` 檢查兩個名稱是否指同一檔；`trap … EXIT` 登記離開時清掉這回建立的暫存檔；`mv -T` 將成品換到正式檔名，不把目標誤認成要放入的目錄。

```bash
#!/usr/bin/env bash
if [[ $# -ne 1 || ! -f "$1" || ! -r "$1" || "$1" -ef report.txt ]]; then
  printf 'Expected one readable input other than report.txt\n' >&2
  exit 2
fi
tmp=$(mktemp ./report.XXXXXX) || exit 1
trap 'rm -f -- "$tmp"' EXIT
LC_ALL=C sort -u -- "$1" > "$tmp" || exit 1
mv -T -- "$tmp" report.txt || exit 1
```

從 Ubuntu Bash 進入該目錄的 `/mnt/c` 位置，執行：

```bash
printf '%s\n' o302 o301 o302 > paid.txt
bash report.sh paid.txt && printf 'published\n'
cat report.txt
cp report.txt prior.txt
bash report.sh missing.txt && printf 'published\n'
printf 'missing=%s\n' "$?"
cmp prior.txt report.txt && printf 'unchanged\n'
```

成功時只列 `o301`、`o302` 各一次。失敗診斷後有 `missing=2` 和 `unchanged`，不會第二次發布。保留上次成品不是說它今天可用，必須同時看本次狀態。同批輸入重跑不增加列，是本例的冪等性（idempotency）；多步發布的重試策略在[〈重試與冪等〉](#/lesson/bd-orch-03)細講。這堂把暫存放在同一目錄，不把完整性誤認成斷電保證。

## 把成功條件寫進交接
收到日報的同事需要知道上次成功時間、這次執行的結束碼，以及輸出代表哪一批。只看檔案日期也不夠：複製一份舊報表就能改到某些時間屬性。可以把輸入檔名和批次日期留在執行紀錄；報表仍只放供下游讀取的內容，診斷則走標準錯誤。這樣「今天沒有訂單」會是一次成功的空結果，「今天來源檔不見」會是非零的失敗，兩者不會都被誤寫成零筆。若日後再加推送動作，只在新的發布也成功後才回報整批完成。

練習的下一次重跑可預測檔案仍只有兩行；如果多出第三行，就回查是否誤用了附加。

## 常見錯誤

- 失敗還印「已發布」 → 通知無條件接在下一行 → 用 `&&` 或成功分支。
- 檔案存在就說今天成功 → 可能讀到上次成品 → 同時檢查本次狀態。
- `sort input > input` 讀到空檔 → 重導向先截短來源 → 用不同的輸出名稱。
