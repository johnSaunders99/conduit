---
id: fd-desk-03
module: fd-desk
order: 3
title: 編輯器與儲存
subtitle: 改一行再從磁碟開回來
status: ready
minutes: 25
level: 1
prereqs:
- fd-desk-02
objectives:
- 在 VS Code 或記事本開啟指定的練習檔案
- 儲存第三筆訂單並從磁碟重開確認結果
tags:
- VS Code
- 編輯器
- 儲存
- UTF-8
resources:
- title: Basic editing
  url: https://code.visualstudio.com/docs/editing/codebasics
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 看 Save / Auto Save，對照未儲存分頁的提示。
- title: Installing Visual Studio Code on Windows
  url: https://code.visualstudio.com/docs/setup/windows
  kind: doc
  lang: en
  minutes: 3
  required: false
  checked: '2026-11-20'
  note: 尚未安裝時，看 Windows User Setup 的使用方式。
concepts:
- id: fd-desk-03-disk-buffer
  prompt: 畫面多一列，還沒儲存時其他程式會讀到它嗎？
  answer: 如果尚未寫入磁碟，其他程式重新開啟檔案仍讀到舊內容。
  mcq:
    options:
    - 會，分頁內容就是磁碟檔
    - 會，但僅限中文字
    - 不會，除非變更已儲存
    - 不會，存完也要另存新檔才行
    answer: 2
    explain: 儲存才讓檔案接收這一版內容；自動儲存也一樣是寫入磁碟。
- id: fd-desk-03-open-folder
  prompt: 在 VS Code 按「開啟資料夾」會建立檔案副本嗎？
  answer: 不會；它只是把指定資料夾的檔案列在編輯器側欄。
  mcq:
    options:
    - 不會，只切換編輯器正在看哪一組檔案
    - 會，另作一份唯讀副本
    - 會，把全資料夾複製到桌面
    - 不會，但每個檔案都會改名
    answer: 0
    explain: 開啟是選既有位置，不是複製、轉換或上傳。
- id: fd-desk-03-reload-check
  prompt: 如何確認別的工具讀到你最新儲存的一列？
  answer: 關閉分頁，從檔案總管按原路徑用文字工具重開，檢查完整檔名與末列。
  mcq:
    options:
    - 先切到同一個分頁再切回
    - 截圖尚未儲存的畫面
    - 只看檔案的圖示
    - 從磁碟上指定位置重開檔案
    answer: 3
    explain: 畫面與圖示不證明磁碟內容；用明確位置重開才能對照。
practice:
- id: fd-desk-03-p1
  kind: hands-on
  title: 交付可重開的第三筆訂單
  minutes: 8
  steps:
  - 開啟既有的 inputs\orders.csv，依正文新增 0011 那筆並按 Ctrl＋S。
  - 關閉分頁，從檔案總管定位到 inputs，用文字工具重開。
  checks:
  - orders.csv 只有一份，開頭仍是原欄名。
  - 末列是 0011,北倉,60，連欄名共 4 行。
---

同事說「我剛補上最後一筆」，排程重跑卻沒讀到。原因之一很普通：那一列還在編輯器畫面裡，沒有寫進磁碟。今天用上一堂的原檔操作一次，以重開驗收取代「我好像按了儲存」。

## 開啟和儲存是不同動作

文字編輯器（text editor）讀出檔案後，可以先在它自己的編輯區改文字。編輯器分頁（tab）是你的視窗，不是另外一份檔案。在 VS Code，未儲存的分頁通常有一個圓點。按 **Ctrl＋S**，編輯區內容才會寫回那個位置；如果開啟了自動儲存（Auto Save），工具也可能在一段時間後或切換焦點時替你寫入。無論哪種方式，關閉後從磁碟重開，才是在看別的程式下一次會讀到什麼。

今天只需要一個可編輯純文字的工具。已有 Visual Studio Code（簡稱 VS Code）就沿用；想安裝且電腦允許，可以參考官方 Windows User Setup。若不能安裝，使用記事本做同樣的開啟、修改、存檔與重開，不用安裝擴充套件。

## 讓第三筆訂單真正落到檔案裡

1. 在 VS Code 選「檔案 → 開啟資料夾」，指定 `C:\dev\conduit-lab\desk`。這讓左側檔案清單以 `desk` 為起點，不會複製檔案。展開 `inputs` 並選 `orders.csv`。若用記事本，則直接用「檔案 → 開啟」選同一位置的檔案。
2. 先看第一行是否為 `order_id,warehouse,total`、末行是否為 `0010,南倉,80`。不對就核對資料夾，別在同名副本繼續改。如果已經有下面那一行，不要再加一次。需要新增時，在最後一筆之後換行，在 `orders.csv` 補上：
   
   ```csv
   0011,北倉,60
   ```
   
   對照分頁的狀態之後按 **Ctrl＋S**。保持 UTF-8；使用 VS Code 時，狀態列可以看見目前的編碼。
3. 關掉該分頁。用檔案總管到 `desk\inputs`，確認只有本課那份 `orders.csv`，再用文字編輯器重新開啟。現在應有一行欄名、3 筆訂單，最後一筆的金額是 60。不要以空白的尾端換行多算一筆，也不要把欄名算進訂單數。

如果同事問「我也能看到嗎」，請說出完整位置、末列和預期筆數。這比傳一張只有編輯器文字、沒有位置的畫面，更能幫對方確認是否在讀同一份檔案。下一堂[〈終端與目前位置〉](#/lesson/fd-desk-04)要換一個工具找這份檔。

## 驗收要使用同一個檔名

如果有兩份同名樣本，一份在下載區，一份在練習區，編輯器分頁可能都只顯示 `orders.csv`。不要以開啟順序辨認：用檔案總管進到目標位置，對照末列，再把這個完整位置寫入學習筆記。把來源與驗收方式一起記下來，改天重跑才不會又找錯副本。

## 常見錯誤

- 按 **Ctrl＋S** 卻跳出檔名詢問 → 編輯的是新分頁 → 先開啟原本的 `inputs\orders.csv`，再補一列。
- 關掉再開程式似乎還有新列，從磁碟打開卻沒有 → 編輯器可能恢復了工作階段中的草稿 → 儲存後，用原路徑明確重開同一檔案。
- 檔案多出兩個版本 → 誤用「另存新檔」存到其他位置 → 查位址與完整檔名，保留原件，指定要交付的那一份。
