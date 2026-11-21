---
id: fd-linux-06
module: fd-linux
order: 6
title: 行程與日誌
subtitle: 找出誰仍在寫入輸出檔
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-05
objectives:
  - "保存背景工作 PID 並核對親代"
  - "用開啟的描述元與新增日誌確認寫入來源"
  - "區分已送訊號與工作確實退出"
tags:
  - "PID"
  - "ps"
  - "tail"
  - "/proc"
  - "訊號"
resources:
  - title: "The /proc Filesystem"
    url: "https://www.kernel.org/doc/html/latest/filesystems/proc.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看 PID 目錄中的 fd 和行程資訊。"
  - title: "bash(1)"
    url: "https://man7.org/linux/man-pages/man1/bash.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看背景工作、工作控制和 wait。"
concepts:
  - id: fd-linux-06-pid
    prompt: "兩個相同腳本同時跑，要用什麼區分？"
    answer: "各自有這一次執行的 PID；還要核對命令、親代和時間，因 PID 可重用。"
    mcq:
      question: "哪個值是剛啟動的背景工作編號？"
      options:
        - "$$"
        - "$?"
        - "$!"
        - "$#"
      answer: 2
      explain: "$$ 指目前殼層，$? 指狀態，$# 是參數數量。"
  - id: fd-linux-06-descriptor
    prompt: "fd/1 指向這份日誌，已證明什麼？"
    answer: "該行程的標準輸出接到它；要支持正在寫，要看內容是否新增。"
    mcq:
      question: "已經確認 fd/1，補哪項才能支持它在這段時間寫入？"
      options:
        - "比較兩時點的日誌末尾"
        - "只抄下檔名"
        - "查磁碟總容量"
        - "看是否有 stdout 這個名字"
      answer: 0
      explain: "描述元只說明通道接好了；兩次觀察才能看出有沒有進展。"
  - id: fd-linux-06-termination
    prompt: "kill -TERM 沒報錯就代表已停止嗎？"
    answer: "只表示成功送出訊號。若是本分頁啟動的工作，可用 wait 確認退出。"
    mcq:
      question: "哪句正確分清停止的兩階段？"
      options:
        - "TERM 回 0 就是已退出"
        - "tail 停就代表來源停"
        - "KILL 保證完成最後一筆"
        - "送出訊號後還需確認工作退出"
      answer: 3
      explain: "停止觀察不同於停止工作；強制停止也不保證處理完最後一筆。"
practice:
  - id: fd-linux-06-p1
    kind: hands-on
    title: "留下正在寫入的三份證據"
    minutes: 10
    steps:
      - "跑正文的有限背景工作，記下 PID、PPID、fd/1 和兩次 tail。"
      - "等自己的工作結束，把狀態和末行留在 writer-notes.txt。"
    checks:
      - "確認親代是目前 Bash，日誌有新增，末行是 writer=done。"
      - "wait 為 0，沒有停止或修改其他行程。"
---

下游拿到匯出的檔案，卻發現列數仍在變。究竟是來源晚到，還是清洗還沒有結束？先辨認這一次的工作，再核對它的輸出位置和日誌是否有進展。這次只啟動一個會自行結束的寫入器。

## 編號、通道、時間是三種證據

行程（process；大陸常稱進程）是執行中的程式實例，行程識別碼（process ID，PID）由系統分配。啟動兩次同一腳本會有不同的 PID；舊 PID 日後可能重用。親代識別碼（parent PID，PPID）說明是誰發起這一份，不能只看名稱就假設它屬於自己。[〈行程與執行緒〉](#/lesson/fd-system-01)會再拆開「一份工作內部誰在跑」。

- `command &` 在背景啟動，`$!` 是剛啟動的背景工作編號，`$$` 是目前 Bash 編號。
- `ps -p PID -o pid,ppid,comm` 查指定行程的快照，`jobs -l` 看同一個殼層啟動的工作。
- `readlink /proc/PID/fd/1` 看 Linux 中該行程的 stdout 指向哪裡；`tail -n 3 檔案` 讀末 3 行，`tail -f 檔案` 持續觀察。按 Ctrl+C 結束 `tail` 不會停止原來的寫入器。
- `wait PID` 在發起工作的同一個 Bash 等待工作退出，取回其結束碼。終止訊號（signal）`TERM` 是請求終止，成功送出也不能當成已退出；強制停止 `KILL` 則不允許程式自行清理。

## 查自己的寫入器

在 Ubuntu Bash 進入 `/mnt/c/dev/conduit-lab` 的對應位置，在裡面另建一個未使用的目錄並進入，例如 `linux/writer`。整塊執行，才能在工作還活著時看到開啟的通道。迴圈約每秒寫一行，連續 12 行後印出完成標記。

```bash
bash -c 'for n in {1..12}; do printf "batch=%s\n" "$n"; sleep 1; done; printf "writer=done\n"' > ingest.log &
writer=$!
printf 'shell=%s writer=%s\n' "$$" "$writer"
ps -p "$writer" -o pid,ppid,comm
readlink "/proc/$writer/fd/1"
tail -n 3 ingest.log
sleep 3
tail -n 3 ingest.log
wait "$writer"
printf 'status=%s\n' "$?"
tail -n 3 ingest.log
```

`ps` 的親代應對到 `shell` 的數字，`readlink` 應指向本堂的 `ingest.log`。第一次 `tail` 的行數取決於當時進度，不必剛好看到某行。兩次的末行有差異才支持「它在這期間前進」；如果現場有不只一個寫入端，還要分開蒐集各端證據，不能憑檔案修改時間指認特定工作。等 `wait` 回 `0`、末行是 `writer=done`，才算完成這個練習。真實管道仍要按腳本的契約核對成品，不以一句日誌取代驗收。

## 把正在寫、已完成分成兩欄
如果第一眼只看到 `batch=3`，不能確定剩下會不會成功。這份樣本交接可以有兩欄：在場時，記「誰持有輸出、從哪一批前進到哪一批」；退場後，記「行程已結束、狀態為零、最後一行符合約定」。批次日報若供下游立即使用，還要約定何時可讀正式檔：例如寫完暫存檔再更名，讀取端就不必邊讀邊猜寫入完成沒有。若真得提前停止，只操作自己核對過的工作；停止結果要另驗證，不把不完整內容當成功。

交接筆記也應註明觀察時刻，讓下一位知道你看到的是哪一段，而不是現在仍如此。

## 常見錯誤

- 找不到 `/proc` 那一列 → 工作可能已正常退出 → 查末行和自己的 `wait`，不用舊 PID 送訊號。
- 停止追蹤就以為停止了匯入 → 結束的是觀察器 → 另查寫入行程。
- 日誌有開啟卻沒有新行 → 可能正等數據，或尚未寫出緩衝區（buffer）中的內容 → 隔一段時間再比對，到[〈緩衝與批次〉](#/lesson/fd-system-04)會區分這兩種等待。
