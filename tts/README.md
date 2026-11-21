# 渠成朗讀語音（GPT-SoVITS 本機生成）

這個資料夾是 `F:\ConduitTTS\` 裡腳本與文件的版本控制副本。實際執行的位置仍是 `F:\ConduitTTS\`（裡面另有 Python 環境、模型權重、ffmpeg 與生成的音檔，太大，不放進 Git）。

- `開始語音生成.cmd` / `停止語音生成.cmd` / `語音生成狀態.cmd`：在 `F:\ConduitTTS\` 按兩下使用；邏輯在 `tools\tts-control.ps1`。
- `tools\generate.py`：讀 `npm.cmd run speech:export` 產生的 `segments.jsonl`，逐句呼叫本機 GPT-SoVITS API，輸出 Ogg Opus 與 `manifest.json`，可中斷續跑。`engine_text()` 處理引擎讀不了的字（〇→零、／、純符號選項），太短而無聲的句子記在 `skipped.jsonl`，App 改用系統聲線。
- `tools\start-api.cmd`：啟動 GPT-SoVITS v2Pro API（127.0.0.1:9880，GPU FP16）；`--cpu` 改用 CPU。
- `LEDGER.md`：所有下載檔案的來源、大小與 SHA-256，可據此在新電腦重建環境（`tools\install-python.cmd` 只從本機 wheelhouse 安裝）。
- `ref\taimecs\`：暫用聲線（TaiMECS，CC BY 4.0）的授權註記與參考稿；參考音檔本身不放進 Git。
- `ref\learner\`：學習者自錄聲線的位置說明（在 App 的「設定 → 朗讀 → 錄製我的聲線」錄製）。

**沒有放進 Git 的東西**：`F:\ConduitTTS\audio\`（約 750 MB、近 2.5 萬個音檔，可用上述腳本重新生成）、`.venv`、模型、`wheelhouse`、`downloads`、ffmpeg、參考錄音。

修改腳本時，改 `F:\ConduitTTS\` 裡的版本並執行後，再複製到這裡提交。
