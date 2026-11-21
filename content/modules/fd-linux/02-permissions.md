---
id: fd-linux-02
module: fd-linux
order: 2
title: 目錄與權限
subtitle: 解決讀得到卻寫不了
status: ready
minutes: 30
level: 1
prereqs:
- fd-linux-01
objectives:
  - "從模式字串讀出三類權限"
  - "區分目錄可列出、可穿越和可建立檔案"
  - "只恢復目錄的擁有者寫入權限"
tags:
  - "chmod"
  - "rwx"
  - "檔案權限"
  - "最小權限"
resources:
  - title: "chmod(1)"
    url: "https://man7.org/linux/man-pages/man1/chmod.1.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看符號模式與目錄的搜尋權限。"
  - title: "path_resolution(7)"
    url: "https://man7.org/linux/man-pages/man7/path_resolution.7.html"
    kind: doc
    lang: en
    minutes: 5
    required: false
    checked: '2026-11-20'
    note: "看逐層搜尋路徑和權限不足。"
concepts:
  - id: fd-linux-02-mode-bits
    prompt: "-rw-r----- 的群組擁有哪些權限？"
    answer: "只有讀取；種類字元後每 3 格一組，第二組 r-- 是群組。"
    mcq:
      question: "上述模式哪一組沒有任何權限？"
      options:
        - "擁有者"
        - "群組"
        - "其他人"
        - "三組都沒有"
      answer: 2
      explain: "第一組可讀寫，第二組可讀，只有最後一組三格都缺。"
  - id: fd-linux-02-directory-write
    prompt: "目錄有 r-x，為何看得到卻不能建立新檔？"
    answer: "讀取可列名稱，執行可依名稱穿越；新增還需要目錄的寫入權限。"
    mcq:
      question: "一般使用者在自己目錄新增檔案，目錄至少需要哪兩個位元？"
      options:
        - "r 與 w"
        - "只要 w，不必另一個"
        - "r 與 x"
        - "w 與 x"
      answer: 3
      explain: "新增要變更目錄項目，也要能按名稱搜尋；讀取用於列出名稱。"
  - id: fd-linux-02-least-change
    prompt: "怎樣只增加擁有者的寫入權限？"
    answer: "用 chmod u+w out，u 是擁有者，+ 只增加指定動作。"
    mcq:
      question: "哪條只補上擁有者缺少的寫入位元？"
      options:
        - "chmod a+w out"
        - "chmod u+w out"
        - "chmod u+x out"
        - "chmod u=w out"
      answer: 1
      explain: "a 更動所有類別，x 不是寫入，等號則替換擁有者原有權限。"
practice:
  - id: fd-linux-02-p1
    kind: hands-on
    title: "保存修復前後的權限對照"
    minutes: 10
    steps:
      - "以非 root 的 Ubuntu Bash 完成正文，記錄兩次 ls -ld。"
      - "在 Windows 練習區保存 permissions-notes.txt，圈出改動的那一格並抄錄報表。"
    checks:
      - "目錄從 dr-x------ 變 drwx------，成功讀到 rows=1。"
      - "來源還是 2 行、群組和其他人權限沒變；未執行就標為讀例。"
---

清洗程式能讀昨天的訂單，卻無法把今天的結果放進同一個目錄。「讀得到」只證明讀取路徑可用，沒有證明程式能改目錄裡的項目。這堂會重現一次拒絕寫入，再用最小權限（least privilege）修復：只補真正缺少的那一格。

## 先看對象，再看動作

`ls -l` 會列出檔案模式（file mode）：第一格是種類，`-` 是一般檔案，`d` 是目錄；後面依序是擁有者（owner）、群組（group）、其他人（others），各有 `rwx` 三格，短橫是未允許。`ls -ld 目錄` 查目錄本身，不是把裡面的檔案列出來。看到 `-rw-r-----` 時，擁有者能讀寫、群組只能讀，其他人沒有權限；三組不是合起來給每個人。

- `r`：一般檔案可讀內容；目錄可列出裡面的名稱。
- `w`：一般檔案可改內容；目錄可更動項目，例如新增名稱，但通常還需目錄的 `x`。
- `x`：一般檔案可直接執行；目錄可按名稱查找、走到下一層。路徑的每一層都要能穿越。
- `chmod u+w out`：`u/g/o/a` 選擁有者／群組／其他人／所有類別；`+/-/=` 增加、移除、精確設定指定權限。`chmod u+x check.sh` 是授予直接執行，不是授予寫入。

改既有檔案的內容，主要看那個檔案能否寫入；新增一份檔案，則要在父目錄登記名字。相反地，有權新增項目也不代表你可以讀每一份檔案。看到拒絕寫入，先說清楚是哪一種，再查對應的權限。不要用管理員身分測試，免得把本來該出現的失敗遮掉。腳本另有一層差異：`bash check.sh` 是由 Bash 讀內容，不等於直接執行的位元已設好。

## 同一個目錄，兩次寫入

在 Ubuntu Bash 以一般使用者執行。實驗放在 Linux 家目錄，避免 Windows 掛載的權限由不同規則控制。`mktemp -d` 建立未用過的目錄；若第一段不能進入新目錄，就先停下。

```bash
lab=$(mktemp -d "$HOME/orders-perms.XXXXXX") && cd "$lab" && pwd
```

在剛印出的目錄繼續。`>` 把輸出存成檔案，下一堂[〈管道與重新導向〉](#/lesson/fd-linux-03)會細講：

```bash
mkdir out
printf '%s\n' 'order_id,status' 'o210,paid' > out/source.csv
chmod u=rx,go= out
ls -ld out
cat out/source.csv
printf '%s\n' 'rows=1' > out/report.txt
```

你仍看得到來源的 2 行，最後一行卻因目錄不可寫而被拒絕。不必把原始檔加上執行權限，也不必改到其他人的設定。仍在同一個目錄跑：

```bash
chmod u+w out
ls -ld out
printf '%s\n' 'rows=1' > out/report.txt
cat out/report.txt
```

從 `dr-x------` 變成 `drwx------`，第二次才讀到新報表 `rows=1`。想檢查變更是否擴散，把兩列模式對齊：頭三格只有中間那一格改變，後六格完全不動。交接時把這兩列和報表內容抄到 Windows 練習區，讓別人看到的不是一句「權限修好了」，而是具體改在哪裡。

## 換成「改原檔」，答案不同
如果原檔擁有者本來就有寫入權限，而目錄仍可穿越，通常可以直接寫入現有檔案。可是有些編輯器存檔會先在同一目錄建立暫存檔、再用它替換原檔，這同樣需要改目錄項目。遇到一個工具可存、另一個不可時，先釐清工具是在改原內容，還是在更換名稱所指的檔案。

## 常見錯誤

- `ls -l out` 只印出 CSV 的權限 → 查到內容，不是目錄 → 加 `-d`。
- 有 `r` 卻不能走到檔案 → 可能缺某一層的 `x` → 從外向內核對，不放寬整棵目錄。
- `/mnt/c` 的結果和實驗不一致 → Windows 掛載另有規則 → 回 Ubuntu 家目錄重做。
