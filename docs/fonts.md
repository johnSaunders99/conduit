# 標題字型

渠成的標題可用自託管的 Conduit Display TC（Noto Serif TC 的子集）或系統字型。內文與程式碼維持原本的系統字型。完整授權與工具版本在 `public/fonts/LICENSE-OFL.txt`。

一般建置直接使用隨專案提供的 WOFF2，不需要網路、Python 或字型來源檔。字型只供標題使用，不預載；如果教材改用了現有子集未含的字元，瀏覽器會使用系統字型顯示那些字元。

## 教材標題更新後，重新產生字型

1. 從 [Google Fonts 的固定版本](https://github.com/google/fonts/tree/477b6577b3a9a9e3229eb8e0946da806d2cf822b/ofl/notoseriftc) 取得 `NotoSerifTC[wght].ttf` 和 `OFL.txt`，分別放到 `.cache/fonts/NotoSerifTC.ttf`、`.cache/fonts/OFL.txt`。
2. 以 Python 3.11 建立 `.cache/fonts/venv`，只在該環境安裝 `fonttools==4.61.1` 和 `brotli==1.2.0`。
3. 執行 `npm.cmd run build -- --refresh-font`。它編譯教材、從介面標題和教材標題取字（另含可列印 ASCII），產生 600–700 的可變字重 WOFF2，並拒絕超過 1.2 MB 的結果。兩個檔案分別服務介面字元與其餘教材標題字元；「今天」只需要介面檔。
