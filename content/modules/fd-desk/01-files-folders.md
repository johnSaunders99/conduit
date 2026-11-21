---
id: fd-desk-01
module: fd-desk
order: 1
title: 檔案與資料夾
subtitle: 建立自己的練習區
status: ready
minutes: 25
level: 1
prereqs: []
objectives:
- 在檔案總管建立並重新找到練習區與 inputs 子資料夾
- 從完整路徑指出磁碟機、目前資料夾與上一層
tags:
- 檔案總管
- 位址列
- 工作區
resources:
- title: File Explorer in Windows
  url: https://support.microsoft.com/en-us/windows/experience/fileexplorer/file-explorer-in-windows
  kind: doc
  lang: en
  minutes: 4
  required: false
  checked: '2026-11-20'
  note: 看如何開啟檔案總管，以及如何從導覽列選位置。
concepts:
- id: fd-desk-01-file-folder
  prompt: 檔案和資料夾各負責什麼？
  answer: 檔案保存內容；資料夾安排檔案及其他資料夾的位置。
  mcq:
    options:
    - 兩者都只記位置
    - 檔案保存內容，資料夾收納檔案與子資料夾
    - 資料夾用來改數據格式
    - 檔案必須各有不同名稱，不論位置
    answer: 1
    explain: 在不同資料夾可以用相同檔名；移動位置不改內容格式。
- id: fd-desk-01-parent
  prompt: C:\dev\conduit-lab\desk\inputs 的直接上一層是哪裡？
  answer: C:\dev\conduit-lab\desk。
  mcq:
    options:
    - C:\dev
    - C:\dev\conduit-lab
    - C:\dev\conduit-lab\desk
    - C:\dev\conduit-lab\desk\inputs
    answer: 2
    explain: 只拿掉最後一層 inputs，不要一口氣跳回練習區根目錄。
- id: fd-desk-01-address
  prompt: 要確認視窗所在位置，應看位址列還是搜尋框？
  answer: 看位址列；搜尋框用來找符合條件的項目。
  mcq:
    options:
    - 位址列
    - 搜尋框
    - 最近使用清單
    - 依檔名排序的第一項
    answer: 0
    explain: 只有位址列直接告訴你視窗正在看哪一層。
practice:
- id: fd-desk-01-p1
  kind: hands-on
  title: 建立可重返的數據練習區
  minutes: 8
  steps:
  - 在可寫入的磁碟機依正文建立練習區與 desk 下的 inputs、checks。
  - 關掉視窗，再用位址列開啟 inputs。
  - 回到 desk，對照兩個子資料夾。
  checks:
  - inputs 的位址以 \desk\inputs 結尾。
  - checks 與 inputs 同層，不在 inputs 裡。
---

交班訊息只有一句：「把今天的訂單放在 inputs。」明天要補跑時，你打開桌面、下載區，又找到另一個同名資料夾。先不急著學指令；今天把練習區建在固定位置，並驗收關掉視窗後還能找到它。

## 檔名回答「哪個」，路徑回答「在哪裡」

檔案（file）有內容，例如一份訂單清單；資料夾（folder，也叫目錄 directory）收納檔案，也能包含其他資料夾。`desk` 下的 `inputs` 和 `checks` 是同層，前者預留給輸入，後者給驗收證據。不要只憑檔名判斷用途：如果兩處各有一個 `orders.csv`，磁碟上就是兩份不同的檔案。一份修改不會替另一份更新。

路徑（path）把位置從左到右寫出來。`C:\dev\conduit-lab\desk\inputs` 從 `C:\` 這個磁碟機根目錄出發，每個 `\` 分開一層。最右邊是目的地；拿掉 `\inputs` 得到直接上一層（parent directory）`desk` 的完整位置。把位置展開讀一遍，日後交接才能說清楚「哪份檔案」而不只說「訂單」。

## 把路徑建出來，再走一次

1. 按 **Windows 鍵＋E** 開啟檔案總管（File Explorer），到「本機」找到 C:。如已經有 `dev`，打開它；沒有且可寫入時，在空白處按右鍵選「新增 → 資料夾」，命名 `dev`。在它裡面同法建立 `conduit-lab`，再在 `conduit-lab` 裡建 `desk`。只新增，不取代現有檔案。C: 不可寫入才改用 `D:\dev\conduit-lab`；接下來教材中的練習路徑都一致換成 D:。
2. 進入 `desk`，建立 `inputs` 和 `checks`。進 `inputs` 後點上方位址列（address bar）的空白處，看文字路徑。按上方的向上箭頭回一層，應同時看到這兩個資料夾。向上不是「回到上次看過的位置」；例如由搜尋結果進來時，上一層仍取決於資料夾結構。
3. 關閉檔案總管，再用 **Windows 鍵＋E** 開新視窗。按 **Ctrl＋L** 到位址列，輸入 `C:\dev\conduit-lab\desk\inputs` 並按 Enter。即使起點在別處，也應直達空的 `inputs`。空不代表開錯：今天只建立位置，下一堂才放入第一份數據。

把這個位置寫在自己的學習筆記。日後收到一份真正的匯出檔時，先讓原件待在輸入區；練習改內容時，另做副本並以不同檔名區分用途。本課只用自造的小檔，不把工作用訂單拿來練習。

## 加一道位置驗收

向上回到 `conduit-lab` 時，你應該看見 `desk`，而不是 `inputs` 和 `checks` 直接出現在這裡。從這裡再進兩層，就能重建走過的路線。如果同事只問「輸入在哪」，試著不靠截圖說完整路徑；另告訴對方驗收記錄在同層另一個資料夾，不要把兩種檔混放。

這個分法不要求你今天就有報表；先留一個不會混放的起點。

## 常見錯誤

- Enter 後出現一堆搜尋結果 → 把路徑輸入右側搜尋框了 → 用 **Ctrl＋L** 切到位址列再輸入。
- 找不到 `checks` → 建在 `inputs` 的內層 → 點向上回 `desk`，確認這一層再新增。
- 位址列顯示桌面或同步資料夾 → 在不同位置建了一份同名目錄 → 回到可寫入的磁碟機，用完整路徑重新定位，不急著刪掉原本那份。

接著在[〈副檔名與編碼〉](#/lesson/fd-desk-02)建立第一份可重開驗收的訂單小樣。
