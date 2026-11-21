# Learner voice｜本機錄音交接

以本人或明確同意在本機合成渠成教材的錄音取代 TaiMECS。把 5–8 秒的平靜講解存為 `calm.wav`（PCM16 mono 32 kHz），逐字稿存為 `calm.txt`（UTF-8，實際說出的繁體中文和英文）。選填同一人錄的 `warm.wav`、`warm.txt`。在本檔記錄授權範圍和撤回方式，不必記本名。不要把錄音放到應用程式或教材備份。

`voice.json` 範例（沒有 warm 就不加該欄）：

    {"label":"本人聲線","calm":{"audio":"calm.wav","transcript":"calm.txt"}}

生成時改用 `--voice learner`，聲線成品與 TaiMECS 分開。
