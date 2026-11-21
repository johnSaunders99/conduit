---
id: cl-cloud-02
module: cl-cloud
order: 2
title: 身分與最小權限
subtitle: 讀報表不等於能刪桶
status: ready
minutes: 30
level: 2
prereqs:
- cl-cloud-01
objectives: ["從報表讀取需求分開身分、角色信任與權限政策","為列出、讀取和刪除各寫出對應的 S3 動作及範圍","用正反案例驗收一份不套用的唯讀政策"]
tags: ["IAM","最小權限","S3 政策"]
resources:
  - title: "AWS IAM：安全最佳實務"
    url: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "看工作負載臨時憑證與縮小授權範圍。"
  - title: "Amazon S3：身分政策範例"
    url: https://docs.aws.amazon.com/en_en/AmazonS3/latest/userguide/example-policies-s3.html
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: '2026-11-20'
    note: "找以 s3:prefix 限制列出範圍的寫法。"
  - title: "阿里雲：RAM"
    url: https://www.alibabacloud.com/help/en/ram/product-overview/what-is-ram
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "對照雲端資源身分、角色與存取控制。"
  - title: "Azure RBAC：角色型存取控制"
    url: https://learn.microsoft.com/en-us/azure/role-based-access-control/overview
    kind: doc
    lang: en
    minutes: 4
    required: false
    checked: '2026-11-20'
    note: "看安全主體、角色定義和範圍如何組合。"
concepts:
  - id: cl-cloud-02-role
    prompt: "信任政策與權限政策分別管什麼？"
    answer: "信任政策約束誰可擔任角色；權限政策描述擔任後可做什麼。"
    mcq:
      options:
        - "信任政策管物件鍵；權限政策管費率。"
        - "兩者只差使用者介面顯示的位置。"
        - "信任政策約束誰可擔任角色；權限政策描述擔任後可做什麼。"
        - "權限政策決定誰擔任，信任政策決定能做什麼。"
      answer: 2
      explain: "能取得一個角色與具備某項資源能力是兩道不同檢查。"
  - id: cl-cloud-02-read
    prompt: "排程拿到完整報表物件鍵，只取現行內容，最小授權是什麼？"
    answer: "給指定報表前綴的 s3:GetObject。"
    mcq:
      options:
        - "只給該桶的 s3:ListBucket。"
        - "給指定報表前綴的 s3:GetObject。"
        - "給全桶所有物件的 s3:GetObject 和 s3:DeleteObject。"
        - "同時允許列桶及讀取所有前綴。"
      answer: 1
      explain: "已知鍵不用列舉；列出不含內容，刪除及其他前綴均非必要。"
    interview:
      question: "明天加需求，在同一個報表前綴內找最新檔案，你會怎麼改？"
      points:
        - "列出與讀取分開"
        - "限制 ListBucket 的前綴"
        - "保留跨前綴與刪除的反例"
      answer: "我會保留原來的窄範圍讀權，另外針對同一桶加上受前綴條件限制的列舉。驗收時試報表前綴、根前綴和另一組前綴，並確認刪除仍未獲授權。"
  - id: cl-cloud-02-boundary
    prompt: "同一前綴的 GetObject 已允許，DeleteObject 也可以嗎？"
    answer: "不能從那條允許推論；動作不同，必須另有有效授權。"
    mcq:
      options:
        - "可以，讀取會連帶授予刪除。"
        - "可以，所有物件動作共用一個權限。"
        - "只要同一個桶，角色一定能刪除。"
        - "不能從那條允許推論；動作不同，必須另有有效授權。"
      answer: 3
      explain: "動作與資源都要匹配；也要核對其他適用政策，避免以單份政策代替整體判斷。"
  - id: cl-cloud-02-parse
    prompt: "本機能成功解析政策 JSON，代表哪一件事？"
    answer: "只代表格式能讀；不代表雲端授權結果或角色設定已驗證。"
practice:
  - id: cl-cloud-02-p1
    title: "留下一份唯讀權限審閱"
    kind: hands-on
    minutes: 11
    steps:
      - "在練習資料夾保存 report-policy.json，以 PowerShell 解析。"
      - "寫下同前綴讀取、其他前綴讀取、同前綴刪除及列清單四個案例。"
      - "標出哪個 Action 或 Resource 決定每一個結果。"
    checks:
      - "只允許報表鍵讀取；其餘 3 個案例未由此政策授權。"
      - "沒有套用政策，沒有取用或儲存憑證。"
---

## 成本安全：先在紙上審，不替雲端開門

本堂只讀政策與做本機語法檢查，不開桶、不取憑證。真的要測時，先記下帳戶優惠條件、預算警示、試驗的請求上限與到期處置；測試角色不應能建立額外的計費資源。夜間報表只需讀已知的輸出檔，就不必能列出所有目錄，更不用能刪原始訂單。

身分與存取管理（Identity and Access Management，IAM）回答「誰能對哪個資源做哪件事」。工作角色（role）是可被擔任的職務；符合信任政策（trust policy）及其他必要授權時，工作負載可取得臨時憑證（temporary credentials）。權限政策（permissions policy）另外規定工作階段可執行的操作。這就是最小權限（least privilege）的起點：先寫用途，再列出實際請求，不用先把一捆管理權限加上去。阿里雲 RAM 與 Azure RBAC 可對照身分、授權及範圍，但角色取得和授權語法各不相同。

## 看懂一條 S3 政策

S3 的桶（bucket；台灣亦稱儲存貯體）容納以鍵命名的物件，下一堂[〈物件鍵與前綴〉](#/lesson/cl-cloud-03)會細講。審查時按下面順序讀：

- `Effect` 指明這條陳述是允許還是拒絕；`Action` 是具體動作，不寫「大概是讀」。
- `Resource` 放資源名稱（Amazon Resource Name，ARN）。`s3:ListBucket` 是桶層級；`s3:GetObject` 與 `s3:DeleteObject` 是物件層級。
- `Condition` 可再加條件；如果真要列清單，可在獨立的桶層級陳述，以 `s3:prefix` 約束請求所帶的前綴。它不是用來替物件的讀權指定路徑。

在 `C:\dev\conduit-lab\cloud` 存 `report-policy.json`。桶名僅為教材示意，不發送任何請求。`Version` 是政策語法版本，不是有效期限。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::example-order-reports/reports/daily/*"
    }
  ]
}
```

在同一資料夾的 PowerShell 解析：

```powershell
(Get-Content -LiteralPath .\report-policy.json -Raw | ConvertFrom-Json).Statement
```

讀 `reports/daily/jan.csv` 的動作和資源都符合。讀 `raw/jan.csv` 只變範圍；刪除日報只變動作；兩者都未由這條授權。實務上還要綜合資源政策、邊界與組織限制，確認沒有其他超出範圍的授權，適用的明確拒絕（explicit deny）優先。成功讀一個物件只是正向證據；能恰好擋下相鄰的請求，才知道界線放對了。

### 只在真的要找「最新一份」時擴充列舉

若排程一開始就有 manifest（清單檔，列出可用的報表鍵），不用為這份工作加列桶權限。若業務改成自動發現報表，先寫新的允許清單：桶可列的僅是 `reports/daily/` 開頭，且可讀的也只有同一範圍的物件。在紙上逐項測同前綴、根前綴、相鄰前綴與同前綴刪除；兩條新舊權限中任何一條超出需求，都要有獨立的反例。角色亦不要共用給不做日報的工作。

若將讀取交給另一條排程，先確認新排程真的以指定角色執行；不能因兩個程式都叫「日報」就視為同一個身分。

## 常見錯誤

- 已能列出但讀不到內容 → 把清單和內容混成一個動作 → 各自核對動作及 ARN。
- CLI 能取已知鍵，主控台卻看不到列表 → 使用介面要額外列舉 → 不因畫面空白擴大排程角色。
- JSON 格式通過卻仍被拒絕 → 本機只檢查語法 → 分開核對實際工作身分與有效政策。
