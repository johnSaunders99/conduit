# 教材補充格式

## SQL 分類

SQL 題的 `category` 須含 `sql-categories.yaml` 中 1–2 個不同的識別碼。內容驗證與建置預設拒絕缺少分類。草稿可用 `npm run check:content -- --lenient` 或 `npm run build -- --lenient` 將「缺少分類」降為警告；未知識別碼與錯誤格式仍是錯誤。

## 本機實驗驗證範圍

選填的 `lab-notes.yaml` 為清單，每堂課最多一筆，例如：

```yaml
- lesson: fd-docker-05
  tools: [docker]
  note: 未實跑 Compose 設定展開、啟動與停止。
```

`lesson` 必須指向課程；`tools` 是非空、無重複的識別碼清單（以小寫英數及連字號組成）；`note` 是至多 60 字的具體驗證限制。編譯後保存在對應課程 JSON 的 `labNote`，只在該課的「動手做」顯示，不會把文件核對當成實機結果。

## 獨立面試題的課程連結

`interview/*.yaml` 的 `questions` 各題可加 `lesson: sq-pattern-01`，指向實際教這題要點的就緒課程。不填仍可照常練題。不需要改動原有的題號、題目或答案。
