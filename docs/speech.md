# 渠成朗讀與預錄音檔介面

不需要安裝 TTS 引擎就能朗讀：設定 → 朗讀 → 系統聲線，可選用 Windows 已安裝的台灣華語聲線。未指定時，優先用瀏覽器列出的台灣華語離線聲線。只有主動選擇可能需網路的聲線時，才會明確指定該聲線；系統的語音服務由瀏覽器管理。

## 產生用文字

從渠成專案執行：

```powershell
npm.cmd run speech:export
npm.cmd run speech:export -- --out E:\ClaudeProjects\conduit\.cache\speech-export\segments.jsonl
npm.cmd run speech:status -- --manifest F:\ConduitTTS\audio\narrator\manifest.json
npm.cmd run speech:status -- --voice narrator
```

預設輸出為 `F:\ConduitTTS\work\segments.jsonl`。UTF-8、每行一個 JSON 物件，同一 `key` 只出現一次。依推薦模組順序、模組內的課程次序排列，未列入推薦的模組跟在後面；無對應課堂的題目和共用選項字母放在最後。每行欄位：

- `key`：20 位小寫十六進位。是 SHA-256 對 `conduit-tw-1 + NUL + speak` 的前 20 位。固定前綴是既有音檔的鍵空間；`speech/index.json` 的 `voiceVersion` 則標記台詞規則版本（M7 為 `conduit-tw-2`）。修訂規則時，台詞不變就保留原鍵，只須重錄沒有相符鍵的句子。以此為檔名或清單索引；不要改用逐課序號。不同聲線使用同一組鍵。
- `speak`：要合成的文字，不是課堂 Markdown。括號英文讀出與略過若有差異，就各輸出一個鍵。數字在台詞內按日期、時間、數量或識別碼讀出，中文和英文之間不加空格。欄名的底線和大小寫交界改成短停頓，按詞典讀出縮寫；畫面的教材文字和程式碼不變。
- `kind`：例如 `sentence`、`heading`、`code-lead`、`question`、`point`、`sql-prompt`。同一句出現在不同位置時，第一個位置決定此欄位。
- `lessonId`：首次出現的課堂 ID；共用項目可為 `null`。 `pathOrder`：從 1 開始的模組次序，同組內有多行。
- `emotion`：`narrate`（敘述）、`encourage`（小結）、`ask`（提問）、`explain`（回答與解說）。
- `polyphones`（可省略）：與句子相符的詞典項目，每項為 `{ "text": "重送", "pinyin": "chóng sòng" }`；引擎可自行選用。若多項重疊，優先採用較長的詞。不要把拼音當成台詞。

`npm run content` 會產生 `public/content/speech/<lessonId>.json`、`cards.json`、`index.json`。播放器按課堂載入句子；複習和 SQL 題目共用題目檔。設定頁才讀取全課程鍵清單。產生器只需讀 JSONL，不必解析這些網頁資料。

## 音檔清單

伺服器預設從 `F:\ConduitTTS\audio` 讀取；可先設定環境變數 `CONDUIT_AUDIO_DIR` 再執行 `啟動渠成.cmd`。每個聲線使用獨立的子資料夾及 `manifest.json`。例如：

```json
{
  "voiceId": "narrator",
  "voiceLabel": "曉晴",
  "engine": "local-tts",
  "version": "1",
  "items": {
    "0123456789abcdef0123": {"file": "01/0123456789abcdef0123.opus", "ms": 2460}
  }
}
```

`voiceId` 須與資料夾名稱相同，檔名與目錄只用 ASCII 英數、連字號、底線和點，且以英數開頭。檔案路徑相對於聲線資料夾，可用 `.ogg`、`.opus`（Ogg 容器）、`.webm`、`.mp3`、`.wav`；`ms` 是正的毫秒數。引擎完成音檔後再更新清單。為避免播放器讀到半份清單，先寫同資料夾的暫存檔再置換。可以只完成部分句子，不需要等全課程生成。

`GET /api/audio` 只提供可用聲線描述；`/audio/<voiceId>/manifest.json` 提供對應清單。音檔路由唯讀，不列出資料夾，可用 Range 讀取。命名為 `narrator` 的聲線優先當主聲線；`interviewer` 優先當第二聲線（否則使用另一個已找到的聲線）。找不到句子的錄音或播放前發生錯誤時，該句改用系統聲線；已經開始播的錄音若中途失敗，播放器停下而不拼接聲線。Vite 開發伺服器不提供預錄音檔路由；測預錄用正式本機伺服器。

`speech:status` 和設定頁計算清單與當前教材鍵的交集，不計入舊鍵與重複句。這是清單覆蓋率，不是編碼或每個音檔的健康檢查。要驗證真正的音檔，取其中幾個鍵用播放器試聽。此專案不包含呼叫 TTS 的腳本，也不把音檔放入教材或備份。

## 試錄參考音訊

開啟 `#/voice`，允許麥克風後試聽並儲存。預設參考檔放在 `F:\ConduitTTS\ref\learner\`。先設定 `CONDUIT_TTS_DIR` 再開啟伺服器，可更改此路徑的根目錄；預錄課文仍由獨立的 `CONDUIT_AUDIO_DIR` 設定。

伺服器把同一編號的檔案儲存為 `01.wav` 和 `01.txt`，透過 `10.wav` 和 `10.txt`。WAV 是單聲道、PCM16、32 kHz；文字是對應試錄稿的 UTF-8 原文。錄製新片段不會覆蓋舊檔，除非使用者按下儲存。參考檔未列入進度備份或課程音檔；試錄頁能播放和刪除單段。
