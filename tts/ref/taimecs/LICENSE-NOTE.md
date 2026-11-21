# TaiMECS｜暫用參考聲線的來源與限制

**Attribution:** *Taiwan Mandarin–English Code-Switching Sentences (TaiMECS)*, published by JacobLinCool on Hugging Face, [dataset and README](https://huggingface.co/datasets/JacobLinCool/TaiMECS/tree/83f397e41840ba187cc6833e1320bd2e5fa858f1), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- 僅下載並保留資料集 metadata 與標成 `source=human` 的 20 段原 MP3。80 段 `source=synthetic` 未下載，不用作聲線參考。來源資料集全量約 25.7 MB，不等於此處的實下載量。
- 平靜候選是 `010.mp3`：自然的技術提醒；從發行版逐字稿取 `text`，保留繁體與原有英文，不混入合成用的 `tts_text`。使用全句、重取樣成 32 kHz／單聲道／PCM16，不切掉字詞。音色與語氣的人工試聽仍待導演確認。
- 沒有可證實的溫暖語氣標籤；`encourage` 先使用平靜段，不把文字偏正面當成錄音真的較活潑。`ask` 使用平靜段、語速 ×0.92。
- 資料集的著作權授權不等於下游克隆聲線的同意；資料卡未記載該語者授權本案複製聲線。依 Brief 27 僅在這台電腦暫用作試聽，不應公開或轉發克隆聲線的成品。**Provisional — to be replaced by the learner's own recording.**
