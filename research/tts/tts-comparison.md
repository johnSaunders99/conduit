# 渠成朗讀：先選一把適合久聽的聲音

查核日期：2026-11-20｜對象：Windows 10 x64、RTX 2060 Max-Q 6 GB、驅動 560.76、15 GB RAM。以公開模型卡、授權、原始碼及效能報告為證據；未下載模型／音檔、未安裝、未在目標機推論，也沒有把展示頁當成本機聽測。

## 建議

**首選：用 Kokoro v1.1-zh INT8＋sherpa-onnx 2.0.2，在 CPU 上做 120 句盲聽與計時。** 先試內建女聲 `zf_001`（sid 3）及男聲 `zm_009`（sid 58）。它不需要參考錄音，不受這台顯卡或 CUDA 限制，有原生 Windows wheel，也有中英混讀樣本。前端可以調速度、斷句與詞典，**不能指定溫柔、鼓勵等情緒**；如果它只是清楚、不夠耐聽，就不要一次生成 31 小時。公開樣本可用來選聲，但替代不了渠成教材的試聽。[模型卡][kokoro]・[聲線與 API][sherpa]・[Windows 支援][sherpawindows]

**表情備援：IndexTTS 2.5＋本人或明確授權的臺灣華語參考音。** 它可把聲線與情緒分開，也能按詞修正拼音，最有機會解決「語氣平、術語讀錯」兩件事。但官方所稱約 6 GB 沒留下 Windows 桌面餘裕；先用單句、單工、FP16 驗證，關閉額外的情緒文字模型與 DeepSpeed，固定低幅度情緒向量。若顯存或驅動不過關，再試 **MOSS-TTS-Nano ONNX CPU**＋同一段授權參考音；它以參考錄音帶入語氣，不是直接指定情緒的等價替代。[Index 模型卡][indexweights]・[Index 程式庫][index]・[MOSS 官方程式庫][moss]

**播放備援：** 未生成或檔案失效才用瀏覽器 Web Speech 的本機中文聲線；沒有可用的本機聲線時維持文字閱讀，不改用 Azure 或 Edge 線上聲線。全量生成前先通過下述聽測、效能及離線門檻。

## 候選快覽

「大小」是官網所列的下載或模型檔案大小（十進位）；不是峰值顯存，也不含 Python、CUDA、前端依賴及解壓空間，除非明說是整合包。沒有可比數據時列缺口，不把模型參數量當顯存。

| 候選／版本 | 程式碼／權重授權 | 不需自備錄音？ | Windows 10／6 GB 的判斷 |
|---|---|---|---|
| **Kokoro v1.1-zh** | Apache-2.0／Apache-2.0 | 有，100 把中文聲線 | 首選 CPU；INT8 140 MB，無情緒指令 |
| **IndexTTS 2.5** | bilibili 自訂／bilibili 自訂 | 無正式預設，要有權參考音 | 約 6 GB，邊界；5.49 GB 權重庫 |
| **MOSS-TTS-Nano 100M ONNX** | Apache-2.0／Apache-2.0 | 有預設，也可用本人錄音 | CPU 路線；TTS 673 MB，另需 codec |
| GPT-SoVITS v2Pro / Plus；v4 另支 | MIT／官方權重庫標示 MIT | 無權利清楚的正式預設 | Win10 整合包 8.19 GB 被標示 Unsafe；不直接採用 |
| Fun-CosyVoice3 0.5B-2512／RL | Apache-2.0／2512 Apache-2.0 | 2512 常規使用需參考音；舊 SFT 才有預設 | 官方環境偏 Linux；2512 整庫 9.75 GB |
| Fish Speech Drama 3／S2-Pro／S1-mini | 當前程式 Community／各版本不同 | 本機旗艦未見供本案使用的正式預設 | 48／24 GB 超限；只考慮舊 S1-mini，非首選 |
| F5-TTS v1 Base | MIT／CC BY-NC 4.0 | 需參考音；範例音不等於已授權 | 1.35 GB＋聲碼器；6 GB 待測 |
| Spark-TTS 0.5B | Apache-2.0／CC BY-NC-SA 4.0 | 可合成虛擬男女音色，不是固定預設庫 | 3.95 GB 整庫；Windows 指南，無已驗證官方整合包 |
| MaskGCT | MIT／CC BY-NC 4.0 | 需參考音 | 6.58 GB 整庫；沒有可信的 Win10／6 GB 路線證據 |
| MegaTTS 3 | Apache-2.0／Apache-2.0 | 只剩已抽取的參考音＋latent；非可任選預設 | 4.27 GB；有 Windows 指引，公開權重缺聲音編碼器 |
| MeloTTS ZH | MIT／中文模型卡 MIT | 有，`ZH` | CPU 可用；208 MB＋前端，語氣變化有限 |
| Bert-VITS2 中文 Extra-v2／2.3 | AGPL-3.0／未確認 | 聲線依訓練權重，未找到已授權預設 | 2.3 權重庫 1.32 GB；權利不足即不採用 |
| Azure／Edge Neural | 商用服務條款／不提供本機權重 | 有，臺灣華語和中國普通話 | 雲端比較基線；不可冒充離線批次方案 |
| Qwen3-TTS 12Hz | Apache-2.0／Apache-2.0 | 0.6B／1.7B CustomVoice 有 | 0.6B 2.50 GB、不支援情緒指令；2060 有 FP16 問題回報 |
| M5-TTS 50M | 程式庫未見全庫明示授權／公開 ONNX、VoiceClone 為 Apache-2.0 | 專用 CustomVoice 有預設；官方 ONNX 路線需參考音 | Windows 未確認；ONNX CPU 1.86 GB |
| Hojo-TTS-Light v2 40M／80M | Apache-2.0／Apache-2.0 | 40M 有兩把中文預設；80M 支援參考音 | ONNX CPU；252／458 MB，原生 Windows 交付證據弱於 sherpa |
| VoxCPM2／1.5 | Apache-2.0／Apache-2.0 | 2 可直接設計新聲線；也可參考音 | 2 約 8 GB；1.5 約 6 GB、非 2 的功能對等版 |

## 聲音、相容性和批次風險

- **Kokoro v1.1-zh。** `zf_*` 為中文女聲、`zm_*` 為中文男聲；無逐把地域標示，不把普通話音色當成臺灣華語。Kokoro 模型原檔 327 MB、整庫 394 MB；部署用 sherpa 維護者的 INT8 匯出（140 MB），另有 FP32（348 MB）作量化對照。不同前端的繁體支援不可互推；先測 sherpa 字典、繁簡兩種輸入與混讀，必要時只轉換口播文本。sherpa 支援中文詞典，適合在本機副本維護詞級音素，不宣稱任意行內拼音指令都有效。上游樣本明提長音素序列會趕拍；短句、固定語速、段落留白比每句變聲自然。[源碼][kokorocode]・[原始模型][kokorofiles]・[INT8 資產][sherpaassets]・[前端檔案][sherpaint]・[上游長句註記][kokorotok]
- **IndexTTS 2.5。** 官方新於 2.0，華語、英語等五語，有拼音／CMU 音素、語速、語句情緒描述、參考音或八維情緒向量；情緒文字會額外載入 QwenEmotion，用固定向量或同一人的情緒參考更節省資源。避免 `use_random` 降低聲線一致性；短句固定採樣設定，針對情緒過重、漏詞、尾部拖長設重試。臺灣腔僅可用已授權參考音試驗，不保證保留；繁體及中英同句要用渠成詞表實測。官方文件有 Windows 注意事項，無確認的一鍵包；建議的 CUDA 12.8 環境不等於 560.76 已驗證，不能假定更換驅動。舊論文的時長精控不能視作已開放的執行功能。預存權重約 5.49 GB，另留依賴與快取。[程式及 Windows 說明][index]・[程式授權][indexcode]・[權重授權][indexlicense]・[權重清單][indexfiles]・[NVIDIA 相容表][nvidia]
- **MOSS-TTS-Nano。** 100M 是小版，不繼承旗艦的拼音／情緒指令。官方 ONNX 有預設 `Junhao`（中文男聲，未標明地域）、中文女聲 `Xiaoyu`／`Yuewen`／`Lingyu`（地域未標）及本地參考音；預設只用發行包內選項，不抽出示範 WAV 跨引擎克隆。可拿本人錄的「平靜講解／提醒重點」兩種語氣以同聲線做對照。中英支援有樣本，繁體、臺灣腔、跨句一致與長句遭截斷都要測；短句並限制 token，固定參考音／採樣。TTS 673 MB 外需獨立 codec（官方模型卡有檔名，未取得可可靠列出的整庫大小）；ONNX 圖本身可無 Torch，但所查 Python wrapper 仍匯入 torch／torchaudio，Windows 沒看到官方一鍵包。使用本機模型路徑避免首次自動下載，先以 CPU 避開 CUDA。[模型檔案][mossfiles]・[codec][mosscodec]・[官方預設清單][mossmanifest]・[Python wrapper][mossruntime]
- **GPT-SoVITS。** 發行頁的 Latest 是 2025-06-06 的 `20250606v2pro`，包含 v2Pro／v2ProPlus；v4 是較早的獨立支線（48 kHz 輸出），不能只按數字排序。官方 Win10 有整合包，但普通非 50 系套件 `GPT-SoVITS-v2pro-20250604.7z` 8.19 GB，檔案頁明標 **Unsafe**，未知確切原因，不當作惡意判定也不推薦執行；v4 fix 7.52 GB。若另開工作，應審查固定原始碼與逐件權重取得路徑，再決定能否執行。沒有可直接視為授權的預設，情緒跟同聲線參考錄音走，固定錄音與全文對齊，逐句單工；使用 G2PW／pypinyin、繁轉簡前端與中英模式，人工詞級修正，沒核定通用行內拼音 API。臺灣腔靠有權參考音且不保證；長文顯存上升有個別實例。官方 4060 Ti 的快速結果不是 6 GB 保證。[發行][gptrel]・[包檔標示][gptunsafe]・[其他包檔][gptpacks]・[權重庫][gptweights]・[API][gptapi]・[中文前端][gptg2p]・[長文回報][gptoom]
- **CosyVoice 3。** 目前核到 0.5B-2512（官方另列 RL 變體；以 2512 可查模型庫為比較基準）。走零樣本參考音＋instruct，表情、速度、方言可控，支援中文拼音／英語 CMU 音素補寫，適合 `ORDER BY` 等詞。方言展示不等於已承諾臺灣華語，繁體／混讀要單獨驗證；同一參考音與 2–3 種保守指令可降低漂移。舊版 300M-SFT（2.62 GB）有中文男女預設，聲線按舊 SFT 模型與選單使用，不移植到 v3。官方 Docker／Triton 偏 Linux；Windows 原生非首選，沒有把 9.75 GB 整庫當必需顯存（含不同格式與重複匯出）。[上游][cosy]・[2512 檔案][cosyweights]・[舊 SFT][cosyold]・[API][cosyapi]・[官方聲音樣本][cosydemo]
- **Fish Speech／OpenAudio。** 官方新發行有 35B MoE **Drama 3**（48 GB 起，41.5 GB 權重庫）；**S2-Pro**（24 GB 起，11 GB 權重庫）支援內聯自然語言標記及情緒作用範圍，中文流利的展示不能代表 6 GB。S2-Pro 權重正文是 Research License（允許非商用）；Drama 3 模型卡標籤與隨附 `LICENSE` 不一致，後者寫 Community License，兩份均不妨礙本案非商用性質，但不推定商用或託管權。較小的 **S1-mini**（舊 OpenAudio）是另一套管線，CC BY-NC-SA 4.0，1.74 GB 模型＋1.87 GB codec；有括號情緒標籤而非 S2 的語法。以有權參考音鎖住聲線，分句、限制 token、抓重複與跳詞；中文繁體、臺灣腔及確切拼音覆寫未核定，不能當首選。Windows 6 GB 未查到相容性與速度證明，不建議部署重型版本。[發行][fishreleases]・[程式授權][fishcode]・[安裝限制][fishinstall]・[S2 授權][fishs2license]・[S2 檔案][fishs2files]・[Drama 檔案][fishdrama]・[Drama 授權正文][fishdramalicense]・[S1-mini][fishmini]・[S1-mini 檔案][fishminifiles]
- **F5-TTS v1 Base。** 中英混讀及速度控制有官方樣本，情緒主要隨參考音；不用範例錄音當正式聲線。中文前端把文字轉拼音再進模型；把詞級覆寫放在前端、測模型詞表，不能把任意 Markdown 或 SSML 丟給 CLI。臺灣腔與繁體沒有對本教材的驗證。長句、參考逐字稿不符與不當速度可能造成漏字／停頓，短句、保留自然句尾並固定 16／32 NFE 中已通過聽測的一檔。官方提供 CLI／Python，Windows 看 PyTorch 相容，沒核到一鍵包；權重 1.35 GB 另加 vocoder（預設 Vocos）。[程式][f5]・[權重][f5files]・[論文][f5paper]・[樣本][f5demo]
- **Spark-TTS 0.5B。** 真正不靠外部真人參考的方案：用性別、音高、語速生成虛擬聲線，或另以自錄聲音克隆；不是有名的固定臺灣聲線，也不等於自由的情緒指令。在授權允許的非商用範圍採用，避免借用官方展示的第三人音色。中英混讀有原生支援，繁體／臺灣腔及拼音覆寫未核定；固定控制參數與採樣，複聽新句聲線是否飄動。官方 README 連到 Windows 指南，主要指引為 Linux，無已驗證一鍵整合包；3.95 GB 整庫，6 GB 峰值待測。[程式][spark]・[權重][sparkfiles]・[設計音色展示][sparkdemo]
- **MaskGCT。** 語音提示驅動的多語零樣本 TTS，沒有本案可用的正式聲線。作者示範中文及多種情緒；情緒仰賴參考，不是文本指令。論文有音素前端；校正常見詞，不把拼音覆寫當已發布穩定介面。臺灣腔、繁體及實際混語仍待測；兩階段迭代與時長估計可能帶來截斷、停頓偏差，固定短句與參考。可取得官方 6.58 GB 權重，未核實 Windows 一鍵包或 6 GB 可跑。個人非商用可用模型，但仍要有參考音權利。[程式授權][maskcode]・[權重][maskweights]・[論文][maskpaper]・[官方樣本][maskdemo]
- **MegaTTS 3。** 4.27 GB 權重、CLI、PyTorch／Docker 及 Windows 指引；中英切換、聲線相似度／跨語強度參數及 G2P 不等於逐句情緒標籤。未核定臺灣腔、繁體或行內音素接口；若做驗證，以同一合法 latent、短句及兩個權重值限制跨語音色漂移。關鍵不是速度：**官方沒發 WaveVAE encoder**，一般自錄 WAV 不能在本地變成所需 latent；官方 demo 人聲／預抽檔也沒核實個別同意。不上傳 學習者 錄音，也不以第三方 encoder 當作已授權解法。[官方程式／限制][mega]・[權重][megafiles]
- **MeloTTS 中文。** 內建 `ZH`（只有一個中文 id，官方沒有標明性別、地區），MIT 模型卡允許使用內建聲線，無需匯入參考；明載中英混讀、有速度設定，無情緒控制。中文有 pypinyin、切詞與變調；繁體、臺灣華語未正式承諾，可外置詞級正規化。VITS 類低成本固定聲線可作中性對照；重點是避免術語誤讀與長句單調。Windows 官方建議 Docker；208 MB 外還要 BERT 等語言前端，不能只拿權重檔就離線。[上游][melo]・[權重][melofiles]・[Windows 指引][meloinstall]・[中文前端][melog2p]
- **Bert-VITS2。** Latest 標籤是日語專版，中文看 Extra-v2、或 2.3 多語基線。有版本用 CLAP 提示與語者 id；無可靠臺灣預設證據。可從中文 G2P／BERT 前端調整，舊支線中英覆蓋與錯讀不能一概而論；短句有助於控制韻律，不能補救權重的授權缺口。官方發行鏈到的 2.3 模型庫約 1.32 GB，沒有清楚權重授權，不把 AGPL 自動套用到模型；也沒查到合適、可維護的官方 Windows 一鍵包或 6 GB 速度數據。[發行][bert]・[程式授權][bertlicense]・[權重檔案][bertfiles]
- **Azure／Edge。** Azure `zh-TW-HsiaoChenNeural`、`zh-TW-HsiaoYuNeural` 是臺灣華語女聲，`zh-TW-YunJheNeural` 為男聲；三把標準音色未列風格。對照 `zh-CN-XiaoxiaoNeural` 女聲（如 gentle、cheerful）、`zh-CN-YunxiNeural` 男聲（如 narration-relaxing、cheerful）。Azure 可依語系用 SSML 語速、停頓、發音及部分語者的風格；不假定所有語者支援臺灣腔／中英切換或所有樣式。F0 Neural 每月 50 萬**計費字元**，每個漢字按兩個計費，若 50 萬皆為漢字即約 100 萬計費字元，且標點與部分 SSML 額外計入；F0 不提供 Batch synthesis。官方測試 voicelist／功能即可，不需要下載權重；線上傳文字，不能作渠成預設。Edge Read aloud 是產品功能，不是 Azure API 也不是免費批次授權；不採逆向端點、不錄製其語音當克隆參考。只有 `localService` 且經斷網驗證的 Web Speech 音色能進正式備援。[Azure 聲線表][azvoice]・[風格][azssml]・[發音][azpron]・[定價][azprice]・[計費][azbill]・[限額][azlimit]・[官方雲端試聽][azlisten]・[Edge 隱私][edge]

**較新的交叉檢查。** [Qwen3-TTS][qwen] 有 Serena（溫和華語女聲）、Vivian（明亮華語女聲）、Ryan（母語英語男聲），另有北京／四川等預設；官方沒列原生臺灣華語。0.6B CustomVoice 權重 2.50 GB，可用這些內建聲線，但有風格指令的是 1.7B，不是 0.6B；2060 在官方 FP16 路徑有具體 CUDA assert 回報，維護者建議 FP32（須重新驗證顯存），FA2 也不能當作 Turing 的預設。以中文混讀試音、短句贏過 31 小時盲跑；不將官方榜單 CER 當臺灣口音或 Windows 效能。[官方檔案][qwenfiles]・[Turing 回報][qwenbug]・[FA2][flash]・[Qwen 試聽][qwendemo]

[M5-TTS][m5] 有 2026 年 11 月新報告與[中文韻律對照樣本][m5demo]，但明確情緒指令還在路線圖；ONNX CPU 支援參考音、不支援其專用 CustomVoice id。官方建議 Linux，GPU 基線用 BF16／FA2，不為 2060 選它；臺灣華語、繁體、技術中英詞與語句穩定性仍未核定。[ONNX 1.86 GB][m5onnx]・[VoiceClone 權重][m5vc]。[Hojo v2][hojo] 確認了 40M 的 2 個未詳述性別／地域的中文預設、80M 可克隆；是接近的輕量華語對照，但未核到情緒／行內拼音控制或 Windows 發行包，先不換首選。[40M 權重][hojo40]・[80M 權重][hojo80]。[Audio8][audio8] 有 0.1B 本機 ONNX 與新模型，但 0.1B 採自訂權重條款，先不混用各大小或版本的聲音／授權。[VoxCPM2][vox] 可不靠真人錄音設計新聲線、支援普通話及多種方言；閩南語不等於臺灣華語，官方約 8 GB 超過預算。1.5 約 6 GB 可考慮但不視為 2 的聲音設計等價品。[VoxCPM 權重][voxfiles]・[VRAM／RTF][voxfaq]。[LeanTTS][lean]（2026-10）有 18.9M 及多音字前端的研究結果，未核到可部署的正式權重與授權，不列入下載。

## 性能：31 小時不是下載後立刻可交付

RTF = 生成耗時 ÷ 輸出音訊時長；0.5 意味 31 小時音訊需 15.5 小時純推論。下面的本機範圍是**排程假設，不是實測或保證**：模型常駐、每句短輸入、單工，另加 15% 作 I/O、轉碼、少量重試；不含人工複聽與設定時間。沒有近似證據的型號不給單點預測。只要實際輸出更長，工時即按比例增加。

| 引擎 | 可查的效能來源 | 目標機排程假設（31 h 音訊） |
|---|---|---|
| Kokoro／MeloTTS | [RLX 自測][rlx] 不同後端及英文樣例，Mac CPU Kokoro 1.62×、Melo 3.30× 即時，換成此文 RTF 約 0.62／0.30；非 sherpa 中文數字 | Kokoro CPU RTF 0.35–0.80 → **約 13–29 h**；Melo CPU 0.30–0.90 → 約 11–32 h，待測 CPU 型號 |
| IndexTTS 2.5 | [作者表 4][indexpaper] A10＋Xeon 8350C：T2S 0.119、S2M 0.017；相加 0.136 不是完整批次 RTF | 若單工可容納，暫以 0.35–0.85 → 約 13–30 h；若 OOM，沒有 GPU 完工時間 |
| MOSS Nano／M5 | [MOSS 上游][moss] 稱 ONNX 比原版近 2×、M4 單核可用，未列 Windows RTF；[M5 報告配置][m5] Xeon Gold 6530 四核 RTF 0.653（暖機後） | Nano CPU 0.60–1.50 → 21–54 h；M5 CPU 假設 0.65–1.50 → 23–54 h；審核錄音與相依後才試跑 |
| GPT-SoVITS v2ProPlus | [上游][gpt] 4060 Ti RTF 0.028；4090 0.014，長樣本；M4 CPU 0.526 | 僅供未來通過來源審查及 6 GB 驗證後規劃：0.08–0.30 → 約 3–11 h；小句、低批次及 Max-Q 會折損吞吐 |
| CosyVoice3／F5 | [CosyVoice 官方][cosytime] L20 TensorRT batch 1 RTF 0.1091；[F5 論文][f5paper] RTX 3090、10 秒片段、16 NFE RTF 約 0.15（不是 v1 Base 在 2060 的數字） | 各暫用 0.35–0.90 → 約 13–32 h，限模型能放進顯存；CUDA／CPU 路線需另量 |
| Spark／Fish S1-mini／Hojo | 沒找到同模型且近似本機條件的可引用 RTF；不可用 S2-Pro 的 H200 0.195 當 S1-mini 速度。[Fish 發行][fishreleases] | 選入試跑才估；以 RTF 0.5／1.0／1.5 作容量情境：18／36／53 h，不當成模型效能 |
| MaskGCT、MegaTTS 3、Bert-VITS2、Fish 重型版、Qwen／VoxCPM、Azure | 先受硬體、權利或服務條件限制；[VoxCPM FAQ][voxfaq] 4090 RTF 0.30（2）、0.15（1.5），不能外推到 2060 | 不排 31 h 本機工期。Azure 以配額、區域和網路衡量，不提供本機 RTF |

目標機沒有指定 CPU 型號。後續用本機計時校正：`實測工作耗時（含 I/O）÷ 實際輸出時數 × 31 h`，另附 1.5× 的重試／熱降頻壓力情境。31 小時 31 × 3,600 秒，且 50 萬字只是粗估：以 20–45 字／句約 **1.1–2.5 萬句**，以清洗後的實際文本／時長替換，不能把 455 個略過的程式碼區塊另計成整段口播。

## 聲線來源及權利界線

1. **不錄音也能開始：** Kokoro 兩把潛在預設為 Apache-2.0 模型的一部分，模型卡說專業中文語料有授權給作者。只按發行方式合成，不模仿特定個人、不匯出原始人聲，亦不把模型授權延伸到擷取試聽檔。MOSS `Junhao` 只作發行包內的 preset 用；如果導演要求逐語者的可公開同意文件，公開資料不足以證明該項，改用本人的聲音。[Kokoro 模型卡][kokoro]・[MOSS 預設][mossmanifest]・[Apache 原文][apache]
2. **臺灣華語最有把握的取得方式：** 本人錄製，或找已同意的人錄製（事先確認同意把錄音用於本機聲音合成、不公開或轉授，保留同意及可撤回安排）。安靜空間離麥克風約 15–25 cm，避免去噪過重、殘響、背景聲和爆音；保存單聲道 PCM WAV，原錄 24／48 kHz、16／24 bit，再按引擎要求轉換。錄 2–3 段各 8–12 秒，挑乾淨連續的 5–10 秒；略帶鼓勵與平靜講解各一段，口音和音量保持一致，附逐字稿，無身分資訊。GPT/F5 若需要逐字稿則精確對齊；短樣本不夠時另錄 20–30 秒，不急著微調。以隨機 id 記錄同意用途、來源與撤回方式；原音和聲紋只存 F: 私有資料夾，不能進 app 匯出或分享。如撤回，停生成並移除對應參考／已生成音訊。
3. **Common Voice 27.0 zh-TW（2.96 GB）：** 官方標 **CC0-1.0** 且禁止辨認語者身分、轉載或重新分享數據。可作臺灣用字／發音研究的候選，但 CC0 僅放棄授權方可處理的權利；官方頁沒有該單一語者明確同意被複製聲線的證據。**不取 5–10 秒匿名片段當克隆參考。**[資料集][cv]・[Mozilla 條款][cvterms]・[CC0 原文][cc0]
4. **AISHELL-3（OpenSLR 93）：** **Apache-2.0**，明載可做多說話人 TTS，218 名普通話語者，錄音偏中性，出生地不同也不代表有臺灣華語。授權允許對著作作衍生用途；未核實個別語者對個人聲線複製的同意，因此不取當渠成預設。[原始資料集][aishell]・[Apache 原文][apache]
5. **真正開放且明示捐聲的比對：** Kyutai Unmute 捐聲條款明載 TTS、voice replica 與公開再利用，並有已發布捐聲庫；這次未核到適合、可確認授權且為臺灣華語的個別片段。沒有推薦任何可直接抓取的開放真人 Mandarin 片段。若需開放來源，請讓要使用的成年語者自行發出錄音、附明確本機（或公開）合成許可；即使附 CC0，也另寫聲線合成的同意。不要用遊戲、動畫、網紅、Azure／Edge 或上述 demo 的音檔冒充參考。[捐聲計畫][unmute]・[同意條款][unmuteterms]・[捐聲目錄][unmutefiles]

## 文本到播放：改一句，只重做一句

1. **從結構取文字。** 解析 Markdown／編譯後結構，而非對 HTML 一把正規表示式。以課程、閃卡問題／答案、面試提示／解答、SQL 題幹各自做群組；答案在 學習者 主動揭示之前不要預先播出。455 個程式碼區塊不逐字念。有可理解的口述摘要就念一句（例：「這段查詢先依城市分組，再計算每組的用戶數。」）；沒有就「請看下面的 SQL 範例。」不創作會提前透露答案的提示。
2. **顯示與口播分開。** 原文保持繁體及原術語；僅在 `spokenText` 層做 Unicode NFC、空白與項目符號調整，按需採用經對照的繁簡轉寫。先鎖行內程式、連結文字、引號、日期、小數、版本、代碼與路徑；規則順序為「句級人工覆寫 > 詞組／術語詞典 > 引擎前端」。`SQL` 選「S Q L」的穩定字母讀法；`Spark`、`DuckDB` 保留英文／提供音素，無英文路徑時用可辨認的局部代稱；首次「分區（partition）」可念「分區，英文是 partition」，後續括號的補充視學習意義省略。`ORDER BY` 按題意念「ORDER BY，依指定欄位排序」；題目若考寫法，僅念字面提示，不洩漏操作。例：`1.5 GB` 讀「一點五 GB」，`10 ms`「十毫秒」，`0.90` 若要求精度讀「零點九零」，`2026-11-20` 讀年月日，`>=`「大於或等於」，`NULL` 讀「NULL，空值」，`C:\\dev\\conduit-lab` 可念「C 槽的 dev 資料夾裡，conduit-lab」，顯示原路徑。設定值、查詢結果、編號依語義分開處理。
3. **按詞處理多音字。** 「每一行」`háng`、「行為」`xíng`、「重送」`chóng`、「重要」`zhòng`、「長度」`cháng`、「成長」`zhǎng`、「數據」`shù`、「數一數」`shǔ`、「調度」`diào`、「調整」`tiáo`、「量測」`liáng`、「容量」`liàng`、「方便」`biàn`、「便宜」`pián`。同形異音不要全域替換；臺灣常用讀法以 學習者 試聽偏好定稿。Index 用詞級拼音；Kokoro 用詞典／前端修正，必要時用只改口播的同義詞（例如「再送一次」）。字母、數字、停頓與音素字典都要有回歸樣本。
4. **句級快取和時序。** 在句號、問號、驚嘆號等分句；過長依語意在分號或逗號切，目標 20–45 中文字，優先短於約 8–12 秒，不拆 SQL 關鍵詞、英文詞組或數字。穩定段落 id／inline 範圍對應原文，不靠句子全文或暫時 DOM index。每句 SHA-256 鍵包含正規化後文字、實際發音參數、模型／前端版本、聲線／參考音摘要、風格、速度、採樣選項及編碼版本；字典只影響用到該詞的句子。語速調整若只在播放器做則不重算音訊。失敗可重試兩次（拆短、語氣回中性），仍失敗就標記再人工檢查，不存壞檔當命中。寫入暫存檔後原子換名，再更新 manifest；重啟按 manifest 補做缺項。
5. **媒體輸出。** 首版單聲道 Ogg Opus（目標 40 kbps VBR；比較 32／48），用 `audio/ogg; codecs=opus`／`.ogg`，WebM Opus `audio/webm` 可作單檔較長段落的方案。[Chromium][browsercodec] 和 [MDN 容器相容表][webcodec] 支援 Chrome／Chromium Edge，仍需在目標機用 `canPlayType` 加離線實播、有聲、暫停續播及跳句驗證；本地 HTTP 靜態路由設定正確 MIME，若做長檔應支援 Range。統一各聲線的段落音量（試行 −19 LUFS 單聲道、真峰不超過 −1.5 dBTP），以同一聲線或課節匯總測量、固定增益／必要時限制真峰；避免以極短句獨立硬拉音量。保留少量自然句尾，逗停與換段由同一套規則控制。FFmpeg `loudnorm` 是 EBU R128 濾鏡；雙階段量測／轉碼，不把 −19 當標準強制值。[FFmpeg][fffilter]
6. **句跟句亮。** manifest 建議記錄 `sentenceId, textRange, assetKey, durationMs, chapterStartMs, chapterEndMs, gapMs`；以**編碼後**音訊時長（含裁切／Opus 延遲處理）計時間。每句一個快取檔，優先預載接下來兩句，當實際開始播放才亮，播放結束／手動切句就同步；不要依預估字數用計時器硬跑。若要更順，再把課節做成單個媒體檔，據最終檔案重建時間軸，用媒體時鐘對照句級範圍。Web Speech 先監聽 `voiceschanged`，優先 `zh-TW` 本機聲線，再接受明確可用的本機 `zh-CN`；逐句 utterance 的 start/end/error 更新高亮，boundary 只作漸進加強。取消／跳題時清舊 utterance，不能讓上一題繼續播。[本機聲線屬性][localvoice]・[boundary 事件][boundary]
7. **容量與放置。** 31 h × 40,000 ÷ 8 = **0.558 GB 純位元流**（32／48 kbps 約 0.446／0.670 GB）；計入小 Ogg 容器及 manifest，40 kbps 規劃 **0.60–0.75 GB**，VBR 保留浮動。24 kHz、PCM 16 bit、單聲道未壓縮約 **5.36 GB**。第一路線下載約 282 MB（Windows FFmpeg ZIP，不另裝解壓工具）；建議在 F: 預留 **3 GB**，含壓縮包、解壓權重、環境、成品與滾動 WAV 暫存；如要保留全量 WAV 改留 **至少 9 GB**。在後續實作才把音訊映射到 127.0.0.1 靜態路由；不要將 F: 機器路徑、聲線原音或私有檔夾寫入瀏覽器連結與備份契約。

## 試聽與放行

先開官方樣本頁，聽不同聲線的普通敘述及同題不同情緒；只觀看或試聽成品，不向線上展示上傳渠成內容／參考音。

1. [Kokoro v1.1-zh 中文與中英混讀：sherpa-onnx 官方聲音頁][sherpa]。先比 sid 3、58；它沒有情緒示範承諾。
2. [IndexTTS 2.5 作者展示][indexdemo]。先聽 Emotionally Expressive、Speaker and Emotion Disentangle；頁中真人／影劇片段**只試聽**。
3. [MOSS-TTS-Nano 作者展示][mossdemo]。先聽 Chinese 和中英切換；聽其速度、停頓與中性語氣。
4. 延伸對照：[GPT-SoVITS ProPlus 官方展示][gptdemo]、[CosyVoice 3.0 作者樣本][cosydemo]、[M5-TTS 中文情緒與節奏][m5demo]。看到線上 iframe 不等於已驗證本機打包品質。

**下一階段驗收（未執行）。** 固定 120 句：30 課文、30 閃卡／題答、30 面試、30 SQL；重疊涵蓋全部多音詞、縮寫、路徑、符號、長句及繁體差異。先固定文本、聲線、音量與順序打亂，聽至少 10 分鐘相鄰段落後再選。建議門檻：關鍵術語／數字／否定詞 **零錯**、全樣本內容完整率 ≥98%、無重複漏句，學習者 10 分鐘「願意再聽」才算過；試跑用冷啟動＋常駐時間、峰值 RAM／獨立 VRAM、RTF P50/P95／總 RTF、失敗率、斷網及夜間長跑回復記錄。再做一課及 1 小時小批，不直接產出全量。若首選不耐聽才啟用情緒備援；若兩條都未過門檻，不把 31 小時品質問題推給 學習者。

## Decisions／Spec questions

- **Decisions：** 暫選可核定授權與原生部署的聲線當預設，不把「有情緒指令」當成「適合讀技術課」。所有預估以 31 h 作容量上限，不把它當實測音長。不採未授權的樣本、未掃清的整合包或雲端捷徑。
- **Spec questions：** 臺灣華語是硬門檻，還是可接受聲線溫暖且讀字準的普通話？是否願意提供同意錄音？是否同意新增只綁本機的 F: 音訊讀取路徑、哪些成品進備份？未生成的內容是否只本機即時朗讀，或無本機聲線即保持文字？建議嚴格離線、不自動傳文字。

來源欄位與查核日期見 [sources.csv](./sources.csv)。

[kokoro]: https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh
[kokorofiles]: https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/tree/main
[kokorocode]: https://github.com/hexgrad/kokoro
[kokorotok]: https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/blob/main/samples/make_zh.py
[sherpa]: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html
[sherpaassets]: https://github.com/k2-fsa/sherpa-onnx/releases/expanded_assets/tts-models
[sherpaint]: https://huggingface.co/csukuangfj/kokoro-int8-multi-lang-v1_1/tree/main
[sherpawindows]: https://k2-fsa.github.io/sherpa/onnx/install/windows/generated/download/windows_x64.html
[gpt]: https://github.com/RVC-Boss/GPT-SoVITS
[gptrel]: https://github.com/RVC-Boss/GPT-SoVITS/releases
[gptweights]: https://huggingface.co/lj1995/GPT-SoVITS/tree/main
[gptunsafe]: https://huggingface.co/lj1995/GPT-SoVITS-windows-package/blob/main/GPT-SoVITS-v2pro-20250604.7z
[gptpacks]: https://huggingface.co/lj1995/GPT-SoVITS-windows-package/tree/main
[gptapi]: https://github.com/RVC-Boss/GPT-SoVITS/blob/20250606v2pro/api_v2.py
[gptg2p]: https://github.com/RVC-Boss/GPT-SoVITS/blob/main/GPT_SoVITS/text/chinese2.py
[gptoom]: https://github.com/RVC-Boss/GPT-SoVITS/issues/2458
[gptdemo]: https://huggingface.co/spaces/lj1995/GPT-SoVITS-ProPlus
[cosy]: https://github.com/QwenAudio/CosyVoice
[cosyweights]: https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512/tree/main
[cosyold]: https://huggingface.co/FunAudioLLM/CosyVoice-300M-SFT/tree/main
[cosyapi]: https://github.com/QwenAudio/CosyVoice/blob/main/example.py
[cosytime]: https://github.com/QwenAudio/CosyVoice/blob/main/runtime/triton_trtllm/README.Cosyvoice3.md
[cosydemo]: https://qwenaudio.github.io/cosyvoice3/
[index]: https://github.com/index-tts/index-tts
[indexcode]: https://github.com/index-tts/index-tts/blob/main/LICENSE
[indexweights]: https://huggingface.co/IndexTeam/IndexTTS-2.5
[indexfiles]: https://huggingface.co/IndexTeam/IndexTTS-2.5/tree/main
[indexlicense]: https://huggingface.co/IndexTeam/IndexTTS-2.5/blob/main/LICENSE
[indexpaper]: https://arxiv.org/html/2601.03888v1
[indexdemo]: https://index-tts.github.io/index-tts2-5.github.io/
[fishreleases]: https://github.com/FishAudio/fish-speech/releases
[fishcode]: https://github.com/fishaudio/fish-speech/blob/main/LICENSE
[fishinstall]: https://github.com/fishaudio/fish-speech/blob/main/docs/en/install.md
[fishs2files]: https://huggingface.co/fishaudio/s2-pro/tree/main
[fishs2license]: https://huggingface.co/fishaudio/s2-pro/blob/main/LICENSE.md
[fishdrama]: https://huggingface.co/fishaudio/drama-3/tree/main
[fishdramalicense]: https://huggingface.co/fishaudio/drama-3/blob/main/LICENSE
[fishmini]: https://huggingface.co/fishaudio/s1-mini
[fishminifiles]: https://huggingface.co/fishaudio/s1-mini/tree/main
[f5]: https://github.com/SWivid/F5-TTS
[f5files]: https://huggingface.co/SWivid/F5-TTS/tree/main/F5TTS_v1_Base
[f5paper]: https://aclanthology.org/2025.acl-long.313.pdf
[f5demo]: https://swivid.github.io/F5-TTS/
[spark]: https://github.com/SparkAudio/Spark-TTS
[sparkfiles]: https://huggingface.co/SparkAudio/Spark-TTS-0.5B/tree/main
[sparkdemo]: https://sparkaudio.github.io/spark-tts/
[maskcode]: https://github.com/open-mmlab/Amphion/blob/main/LICENSE
[maskweights]: https://huggingface.co/amphion/MaskGCT/tree/main
[maskpaper]: https://arxiv.org/html/2409.00750v3
[maskdemo]: https://maskgct.github.io/
[mega]: https://github.com/bytedance/MegaTTS3
[megafiles]: https://huggingface.co/ByteDance/MegaTTS3/tree/main
[melo]: https://github.com/myshell-ai/MeloTTS
[melofiles]: https://huggingface.co/myshell-ai/MeloTTS-Chinese/tree/main
[meloinstall]: https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md
[melog2p]: https://github.com/myshell-ai/MeloTTS/blob/main/melo/text/chinese.py
[bert]: https://github.com/fishaudio/Bert-VITS2/releases
[bertlicense]: https://github.com/fishaudio/Bert-VITS2/blob/master/LICENSE
[bertfiles]: https://huggingface.co/OedoSoldier/Bert-VITS2-2.3/tree/main
[qwen]: https://github.com/QwenLM/Qwen3-TTS/blob/main/README.md
[qwenfiles]: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice/tree/main
[qwenbug]: https://github.com/QwenLM/Qwen3-TTS/issues/43
[qwendemo]: https://huggingface.co/spaces/Qwen/Qwen3-TTS
[moss]: https://github.com/OpenMOSS/MOSS-TTS-Nano
[mossfiles]: https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX/tree/main
[mosscodec]: https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX
[mossruntime]: https://raw.githubusercontent.com/OpenMOSS/MOSS-TTS-Nano/main/onnx_tts_runtime.py
[mossdemo]: https://openmoss.ai/MOSS-TTS-Nano-Demo/
[m5]: https://github.com/ASLP-lab/M5-TTS
[m5onnx]: https://huggingface.co/ASLP-lab/M5-TTS-50M-ONNX/tree/main
[m5vc]: https://huggingface.co/ASLP-lab/M5-TTS-50M-VoiceClone
[m5demo]: https://aslp-lab.github.io/M5-TTS-Demo-Page/
[hojo]: https://github.com/HojoAI/Hojo-TTS-Light
[hojo40]: https://huggingface.co/HojoAI/Hojo-TTS-Light-40M/tree/main
[hojo80]: https://huggingface.co/HojoAI/Hojo-TTS-Light/tree/main
[audio8]: https://github.com/Edge0-AI/Audio8_TTS
[vox]: https://github.com/OpenBMB/VoxCPM
[voxfaq]: https://voxcpm.readthedocs.io/en/latest/faq.html
[voxfiles]: https://huggingface.co/openbmb/VoxCPM2/tree/main
[lean]: https://arxiv.org/abs/2610.34408
[azvoice]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=text-to-speech
[azssml]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice
[azpron]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-pronunciation
[azprice]: https://azure.microsoft.com/en-us/pricing/details/speech/
[azbill]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech
[azlimit]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits
[azlisten]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-audio-content-creation
[edge]: https://learn.microsoft.com/en-us/legal/microsoft-edge/privacy
[cv]: https://mozilladatacollective.com/datasets/cmu5wkw5i00c6o107jnm3t51u
[cvterms]: https://commonvoice.mozilla.org/terms/en.html
[cc0]: https://creativecommons.org/publicdomain/zero/1.0/legalcode.en
[aishell]: https://www.openslr.org/93/
[apache]: https://www.apache.org/licenses/LICENSE-2.0
[unmute]: https://unmute.sh/voice-donation
[unmuteterms]: https://kyutai.org/next/legal/Terms%20of%20Use%20-%20Unmute%20Voice%20Donation%20Project%20v1.pdf
[unmutefiles]: https://huggingface.co/kyutai/tts-voices/tree/main/voice-donations
[nvidia]: https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/index.html
[flash]: https://github.com/Dao-AILab/flash-attention
[rlx]: https://github.com/MIT-RLX/rlx-models/blob/main/TTS.md
[browsercodec]: https://www.chromium.org/audio-video/
[webcodec]: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers
[localvoice]: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService
[boundary]: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event
[fffilter]: https://ffmpeg.org/ffmpeg-filters.html
[mossmanifest]: https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX/raw/main/browser_poc_manifest.json
