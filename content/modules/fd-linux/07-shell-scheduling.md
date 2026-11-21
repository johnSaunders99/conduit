---
id: fd-linux-07
module: fd-linux
order: 7
title: 排程與環境
subtitle: 為何手動可跑排程卻失敗
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-06
objectives:
  - "讀出使用者 crontab 的五個時間欄"
  - "在精簡環境重現相對路徑錯誤"
  - "保存不安裝的排程草稿與成功、失敗日誌"
tags:
  - "cron"
  - "crontab"
  - "PATH"
  - "排程日誌"
resources:
  - title: "crontab(5)"
    url: "https://manpages.debian.org/bookworm/cron/crontab.5.en.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看五個時間欄、預設殼層和百分號。"
  - title: "bash(1)"
    url: "https://man7.org/linux/man-pages/man1/bash.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 ENVIRONMENT，理解子程式接到的設定。"
concepts:
  - id: fd-linux-07-cron-fields
    prompt: "15 2 * * * 在排程時區是什麼時刻？"
    answer: "每天 02:15；第 1 欄分鐘，第 2 欄小時。"
    mcq:
      question: "使用者排程要每天 02:15，怎麼寫？"
      options:
        - "2 15 * * *"
        - "15 2 * * *"
        - "0 2 15 * *"
        - "15 * 2 * *"
      answer: 1
      explain: "第一項是 15:02；後兩項限制了月中日期。"
  - id: fd-linux-07-minimal-env
    prompt: "手動能跑，排程卻找不到來源檔，先查什麼？"
    answer: "查排程當下的工作目錄和來源位置；兩者不一定和互動分頁相同。"
    mcq:
      question: "排程說找不到相對路徑，最能縮小問題的第一步是？"
      options:
        - "把排程提早"
        - "讓所有人都可寫"
        - "對照工作目錄和完整來源路徑"
        - "丟掉錯誤輸出"
      answer: 2
      explain: "時刻和放寬權限不能直接說明路徑如何解析；先不要丟證據。"
  - id: fd-linux-07-cron-runtime
    prompt: "為何 env -i 測通不能保證明早自動成功？"
    answer: "模擬只驗證命令本身；真正執行還需要正確的時區、服務運作且機器在線。"
    mcq:
      question: "哪個是精簡環境重播不能證明的？"
      options:
        - "完整路徑能否找到腳本"
        - "報表在哪個目錄"
        - "明早排程服務會運作"
        - "缺檔會不會回非零"
      answer: 2
      explain: "模擬不註冊排程，也不決定指定時刻 Windows 或 WSL 是否在線。"
practice:
  - id: fd-linux-07-p1
    kind: hands-on
    title: "交接一份不安裝的凌晨排程"
    minutes: 10
    steps:
      - "完成兩次重現，保存 cron-probe.log。"
      - "將草稿時刻改為每天 04:05，保存 cron-draft.txt 並註明排程時區及未安裝。"
    checks:
      - "日誌有 failure=2、fixed=0，報表為 rows=2。"
      - "草稿時間欄為 5 4 * * *，保留絕對工作目錄和錯誤去向；沒有改 crontab。"
---

昨天手動跑出兩筆訂單，凌晨工作卻說找不到檔。排程不是重播目前的終端：它可能從不同目錄起步，帶著較短的搜尋路徑，到點時機器也得真的在線。這堂不安裝排程，先寫一份能交接的草稿，另存一份可以重現的日誌。

## 把時間和命令分開驗收

cron 是按時間啟動工作的排程服務（scheduler）。使用者排程表（crontab）前 5 欄是 `分鐘 小時 月中日期 月份 星期`，後面是命令。`*` 是不限制，`15 2 * * *` 是依排程的時區每天 02:15。`15 2 * * 1-5` 則是星期一至五。初學先避免同時限制星期和月中日期；常見 cron 在兩者都受限時用任一符合，不是兩者都要符合。

- 使用者排程表不加使用者欄；系統排程檔的格式才可能有。
- 命令一般交給 `/bin/sh`，不會把互動 Bash 的設定都帶過來。要用 Bash 語法就明確啟動它。相對路徑從當時目錄算起，不會跟著腳本的位置變動。
- 命令欄未跳脫的百分號有特殊語意；把含日期格式的命令放進腳本中。保留日誌時用 `>> logfile 2>&1`，讓錯誤也有地方可以查。
- 排程不會自行喚醒 Windows 或啟動 WSL 補跑。若上游清單晚到，即使啟動時間正確也不等於可以產報；數據區間在[〈邏輯日期與數據區間〉](#/lesson/bd-orch-02)再細講。

## 在白天重播凌晨的情況

在 Windows 新建 `C:\dev\conduit-lab\linux\cron`，以 UTF-8、LF 存成 `report.sh`。若工作區在 D 槽，要把下面的 `/mnt/c` 一併換成 `/mnt/d`。腳本約定讀一列一訂單、沒有表頭的樣本，缺檔時回 `2`。

```bash
#!/bin/bash
if [[ ! -r orders.txt ]]; then
  printf 'orders.txt missing in %s\n' "$PWD" >&2
  exit 2
fi
rows=$(wc -l < orders.txt) || exit 1
printf 'rows=%s\n' "$rows" > scheduled-report.txt
```

在 Ubuntu Bash 執行下段。`env -i` 以空環境起步，再加入明確的 `PATH`。同一份腳本跑兩次：第一次站在臨時建立的空目錄，第二次由命令自己定位。這次控制的變數是目錄，不是權限或時刻。

```bash
lab=/mnt/c/dev/conduit-lab/linux/cron
printf '%s\n' o401 o402 > "$lab/orders.txt"
(
  cd "$(mktemp -d "$HOME/cron-empty.XXXXXX")" || exit 1
  env -i PATH=/usr/bin:/bin /bin/bash "$lab/report.sh"
  printf 'failure=%s\n' "$?"
  env -i PATH=/usr/bin:/bin /bin/sh -c 'cd "$1" && /bin/bash ./report.sh' -- "$lab"
  printf 'fixed=%s\n' "$?"
) > "$lab/cron-probe.log" 2>&1
cat "$lab/cron-probe.log" "$lab/scheduled-report.txt"
```

預期 `failure=2`、`fixed=0` 與 `rows=2`。把以下文字保存為 `cron-draft.txt`，不要貼進殼層或安裝。做真正交接時，在旁邊寫下時區、預期筆數、日誌位置與尚未測試的觸發條件。

```text
PATH=/usr/bin:/bin
15 2 * * * (cd /mnt/c/dev/conduit-lab/linux/cron && /bin/bash ./report.sh) >> /mnt/c/dev/conduit-lab/linux/cron/cron-run.log 2>&1
```

## 再分辨三種「沒跑」
連新日誌都沒有，先查服務是否在該時刻運作；日誌有缺檔診斷，先看印出的工作目錄；有狀態零但報表不在預定位置，查寫出路徑與來源批次。三種症狀的下一個動作不一樣。若要改時間，不必重寫命令；反過來修正路徑，也不用為了再測一次等到隔天。把時鐘測試和命令重播分開，才不會同時改了兩個條件，最後不知道哪一項真正修好問題。

若懷疑不是路徑而是找不到工具，另用當時的搜尋路徑查命令位置；兩項分開測。

## 常見錯誤

- 手動成功，排程缺檔 → 當時目錄不同 → 先 `cd 絕對路徑 && …` 再開工。
- 時刻對卻沒有日誌 → 機器或服務可能沒運作 → 檢查當天的時區和服務，不拿模擬當作觸發證據。
- 交接只寫「凌晨跑」 → 缺分鐘與失敗去向 → 補上時刻、時區、報表和日誌的路徑。
