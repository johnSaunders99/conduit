---
id: fd-linux-03
module: fd-linux
order: 3
title: 管道與重新導向
subtitle: 把正常輸出和錯誤分開
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-02
objectives:
  - "指出管道兩端的標準輸出和輸入"
  - "用 awk、sort、uniq 統計日誌"
  - "將執行錯誤與統計表分開保存"
tags:
  - "Shell 管道"
  - "stderr"
  - "awk"
  - "sort"
  - "uniq"
resources:
  - title: "bash(1)"
    url: "https://man7.org/linux/man-pages/man1/bash.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "讀管道與重新導向，核對描述元及順序。"
  - title: "awk(1p)"
    url: "https://man7.org/linux/man-pages/man1/awk.1p.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看欄位分隔和 pattern/action。"
concepts:
  - id: fd-linux-03-streams
    prompt: "cmd > report.txt 2> errors.log 分別留下哪兩路？"
    answer: "標準輸出覆寫報表，標準錯誤覆寫錯誤日誌。"
    mcq:
      question: "想將 stdout 與 stderr 分開保存，哪個寫法合適？"
      options:
        - "cmd > report.txt 2>&1"
        - "cmd > report.txt 2> errors.log"
        - "cmd | cat > report.txt"
        - "cmd >> report.txt"
      answer: 1
      explain: "合併讓錯誤混入結果；普通管道和只寫 stdout 的寫法都沒有保存 stderr。"
  - id: fd-linux-03-pipe
    prompt: "普通 | 將什麼接到下一個命令？"
    answer: "左邊的標準輸出接右邊的標準輸入，不會自動接標準錯誤。"
    mcq:
      question: "左側只寫一行 stderr，普通管道右側收到那一行嗎？"
      options:
        - "會，管道接兩路"
        - "會，如果右側是 awk"
        - "不會，普通管道只接 stdout"
        - "不會，因管道只能接檔名"
      answer: 2
      explain: "管道接的是串流，不是檔名；右側工具不會改變接上哪一路。"
  - id: fd-linux-03-adjacent
    prompt: "為何 uniq -c 前要先 sort？"
    answer: "uniq 只將相鄰的相同列當一組；排序讓相同理由排在一起。"
    mcq:
      question: "輸入依序是 login、logout、login，如何得到 login 2 次？"
      options:
        - "只用 uniq -c"
        - "只用 sort"
        - "uniq -c 再 sort"
        - "sort 再 uniq -c"
      answer: 3
      explain: "計數前要先讓相同列相鄰；事後排列已算出的數字不會合併計數。"
  - id: fd-linux-03-empty-output
    prompt: "為何結果檔是空的不能證明今天沒有登入？"
    answer: "重新導向可能在讀來源前就建立檔案；輸入缺失也可能留下空結果。"
practice:
  - id: fd-linux-03-p1
    kind: hands-on
    title: "按失敗原因數登入次數"
    minutes: 10
    steps:
      - "在練習區新目錄完成正文，保留 counts.txt 與 errors.log。"
      - "在 login.log 末尾新增一行 eu|fail|locked，只重跑統計。"
      - "用一行筆記說明為何 probe.txt 不能當報表。"
    checks:
      - "新結果為 locked 2、timeout 2，沒有 ok。"
      - "errors.log 有缺檔診斷，但 counts.txt 沒有混入它。"
---

登入系統留下 4 筆事件，營運只要失敗原因和次數。如果把找不到檔案的診斷也寫進報表，下游可能把錯誤當成一筆數據。本堂做兩份分開的成果：一份可交接的次數表，一份留給排查的錯誤紀錄。

## 三路串流，四種接法

標準輸入（standard input，stdin）通常從鍵盤或上一步讀；標準輸出（standard output，stdout）交付正常結果；標準錯誤（standard error，stderr）用來說明診斷。管道（pipeline）連接程式之間的串流；重新導向（redirection）改掉單一路的來源或去向。三路的檔案描述元（file descriptor，即程式內的通道編號）依序是 `0`、`1`、`2`。畫面空白可能只是結果改寫進檔案，不能據此判斷執行成功。

- `a | b`：把左邊的 stdout 接到右邊的 stdin。左邊的 stderr 不會走這條線。
- `a < input.txt`：把檔案接成 stdin；也有工具能直接收檔名，兩種用法扮演的角色不同。
- `a > out.txt`、`a >> out.txt`：把 stdout 覆寫或附加；`2>`、`2>>` 對 stderr 做同樣的事。覆寫可能在命令開跑前截短檔案，不要把來源當目的。
- `a > all.log 2>&1`：先接 stdout 到檔案，再讓 stderr 指向當時的 stdout。反過來寫，stderr 仍可能留在畫面。

## 把四筆事件縮成兩行

在 Ubuntu Bash 進 `/mnt/c/dev/conduit-lab`，在裡面另建並進入未使用的目錄，例如 `linux/pipes`。這是固定以豎線分隔的日誌，不是能處理引號、換行和嵌套分隔符的通用 CSV；正式 CSV 要用[〈CSV 與引號〉](#/lesson/fd-io-01)的方法。

```bash
printf '%s\n' 'eu|fail|timeout' 'ap|fail|locked' \
  'eu|ok|none' 'ap|fail|timeout' > login.log
awk -F '[|]' '$2 == "fail" { print $3 }' login.log | LC_ALL=C sort | uniq -c > counts.txt
cat counts.txt
```

`-F` 指定欄位分隔，規則左邊只收第 2 欄是 `fail` 的列，右邊印第 3 欄。先讓每步只做一件事：把管道截在 `awk`，會看到 `timeout`、`locked`、`timeout`；加 `sort` 後，相同列排在一起，`uniq -c` 才能把相鄰的一組數完。`LC_ALL=C` 只給本次排序指定固定的語言環境。成品依序是 `locked` 1 次、`timeout` 2 次，計數前有對齊用的空白。若把數字加起來，應等於 3 筆失敗，而非原始的 4 筆。

再用未建立的來源名測錯誤流，不覆寫剛完成的結果：

```bash
cat missing.log > probe.txt 2> errors.log
wc -c probe.txt
cat errors.log
```

`probe.txt` 存在卻是 0 位元組，原因在 `errors.log`，不是登入數剛好為零。管道成敗在[〈腳本與結束碼〉](#/lesson/fd-linux-05)會加上檢查；這裡先確認每路實際去了哪裡。

## 用對照找錯，不只看最終數字
假設報表顯示 `timeout` 2 次，但你在原始檔肉眼找到 3 次。先檢查第 3 筆的狀態是否真的是 `fail`；再把管道末端剪掉，數一數中間清單共有幾項。若篩選後是 3 列、計數加總卻不是 3，問題才落在後半段。這樣每多查一步都能縮小範圍，不必一開始重寫整條命令。

覆寫和附加的選擇也取決於檔案內容代表什麼。`counts.txt` 是同一次樣本的快照，重跑應取代舊表；一份長期錯誤日誌則可能要保留歷次執行。若要附加，應先讓每次紀錄有可識別的批次時間，否則今天看見舊錯誤也可能誤以為又失敗了。明確記錄批次與本次狀態，就是稍後要練的兩件事。

## 常見錯誤

- 同一原因被數成兩組 → 計數時它們不相鄰 → 用 `sort | uniq -c`。
- 日報混入診斷 → 把兩路導向同處 → 為 stderr 使用獨立檔案。
- 重跑多出整份相同統計 → 對快照用了 `>>` → 重算快照用專用檔覆寫，執行日誌才依需求附加。
