---
id: bd-serve-01
module: bd-serve
order: 1
title: ClickHouse 排序鍵
subtitle: 只讀熱區間的少數區塊
status: ready
minutes: 35
level: 3
prereqs: []
objectives:
- 區分 ClickHouse 的分區、排序鍵與唯一性
- 以 EXPLAIN 比較同一結果的索引區塊讀取
- 依查詢常用條件挑一個排序鍵前綴
tags:
- MergeTree
- 稀疏索引
- granule
- 排序鍵
resources:
- title: ClickHouse：MergeTree
  url: https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree
  kind: doc
  lang: en
  minutes: 8
  required: false
  checked: '2026-11-20'
  note: 讀排序、主索引與數據區塊的關係。
- title: ClickHouse：官方 Docker 映像
  url: https://clickhouse.com/docs/get-started/setup/self-managed/docker
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀同容器客戶端的連線方式。
concepts:
- id: bd-serve-01-sort
  prompt: MergeTree 的 ORDER BY (shop_id, event_id) 會強制這兩欄唯一嗎？
  answer: 不會；它決定存放順序，不是交易數據庫的唯一約束。
  mcq:
    question: 刻意插入兩筆同鍵列，基本 MergeTree 會怎樣？
    options:
    - 一定拒絕第二筆
    - 一定以新列取代舊列
    - 正常允許兩列存在
    - 只留第一列且不報錯
    answer: 2
    explain: 普通 MergeTree 主要按鍵排序，若需要更新或去重，要另選模型與版本規則。
  interview:
    question: ClickHouse 明細查得慢，你如何評估 ORDER BY？
    points:
    - 按常用篩選挑前綴
    - 用 EXPLAIN 比 granules，並對照讀取量
    - 不同工作負載有取捨
    answer: 先看最常用的 WHERE；若每次都按門市和時間查，我會測以門市、時間開頭的鍵，對照相同結果時讀了多少區塊。另試全店跨時段查詢，避免只加速一種報表。
- id: bd-serve-01-granule
  prompt: 稀疏索引跳過某個 granule，是跳過一列還是一段列？
  answer: 跳過一段相鄰列。
  mcq:
    question: 索引顯示只選中 2/64 個 granules，合理解讀？
    options:
    - 索引只排除了 62 個欄名
    - 可能只需讀其中兩個候選數據區塊
    - 保證全表正好有 64 列
    - 確定查詢只需兩次網路封包
    answer: 1
    explain: 區塊是讀取粒度，不是結果列數；仍需對選中區塊套條件。
- id: bd-serve-01-prefix
  prompt: ORDER BY (shop_id, event_id) 常對何種查詢有利？
  answer: 常對同店及事件範圍的查詢有利；跨店只按事件位置需要實測。
  mcq:
    question: 最直接使用這個前綴的條件是？
    options:
    - 只篩結果列數
    - 只篩 event_id 的末位數
    - shop_id 等值並限制 event_id 範圍
    - 只按未入鍵的 status 排序
    answer: 2
    explain: 先用前綴縮到一店，再利用該店內的後續排序。
practice:
- id: bd-serve-01-p1
  kind: hands-on
  title: 交兩份 EXPLAIN 的對照
  minutes: 13
  steps:
  - 依正文開起 ClickHouse，保存並執行 clickhouse-order.sql。
  - 抄下兩個查詢各自選中的 granule 數，記下哪個條件用到了主索引。
  - 保存結果後在實驗資料夾執行 docker compose down。
  checks:
  - 兩個查詢皆是同一筆；範例帶前綴不應選更多候選區塊。
  - 寫明 DuckDB 練習不驗證 MergeTree 的實際掃描。
- id: bd-serve-01-p2
  kind: sql
  category: [time, aggregate]
  title: 先對齊同樣的查詢口徑
  minutes: 5
  level: 2
  dataset: shop
  prompt: |
    在 `orders` 只取 2026-02-01（含）到 2026-02-08（不含）的已付款訂單。按 `user_id` 計算 `paid_n`，只輸出 `user_id`、`paid_n`，依 `user_id` 升序。
  solution: |
    SELECT user_id, COUNT(*) AS paid_n
    FROM orders
    WHERE status = 'paid' AND order_date >= DATE '2026-02-01'
      AND order_date < DATE '2026-02-08'
    GROUP BY user_id ORDER BY user_id;
  explain: |
    日期左閉右開，使用半開範圍而非含右端的 BETWEEN。這是 DuckDB 核對結果用的查詢，不以結果排序推斷 ClickHouse 的存放排序。
  hints:
  - 先固定同一個日期範圍。
  - 訂單表每列一張單。
  check:
    ordered: true
    columnNames: true
  concepts:
  - bd-serve-01-prefix
  - bd-serve-01-sort
  - sq-compose-02-population
  tags:
  - 半開區間
  - 排序鍵
---

看板只查一家門市 5 分鐘數據，卻讀了大部分歷史。ClickHouse 屬於線上分析處理（online analytical processing，OLAP）引擎，用欄式儲存（columnar storage）按欄讀分析需要的值。MergeTree 是常用的表引擎：寫入形成數據片段（data part），各片段內按 `ORDER BY` 的排序鍵（sort key）順序放。查詢時可以跳過不可能符合的數據區塊，不是每列都有一條索引。

![按門市及事件順序排列後，帶門市前綴的條件可以跳過其他區塊。](assets/bd-serve-sort-key.svg)

## 三個邊界不要混在一起

- `PARTITION BY` 可把數據拆成較粗的分區，常用於保留與管理；小樣本不必為每家店另開分區。
- `ORDER BY (shop_id, event_id)` 表示先按門市、同門市再按事件號。基本 MergeTree 不以排序鍵保證唯一，也不保證每次查詢輸出排序。
- 主索引若未另指定，使用排序鍵。稀疏索引（sparse index）保存一段段區塊（granule）的標記，而非每列一索引；條件先排除不可能的段，再逐列篩。鍵前綴通常更有利於裁剪。

## 用同一筆結果比較兩個計畫

在 `C:\dev\conduit-lab\clickhouse`（C 槽不可用就換 D 槽）建立 `compose.yaml`。關閉其他容器實驗，Docker 預留約 3 GB、此容器上限 2 GiB；本機不用 Java，也不開對外端口。採官方 26.8 長期支援線的固定修補標籤。

```yaml
services:
  clickhouse:
    image: clickhouse/clickhouse-server:26.8.41.14
    mem_limit: 2g
```

同資料夾存下面的 ClickHouse SQL 為 `clickhouse-order.sql`，只在新的練習容器執行一次。`numbers(65536)` 產連續事件，門市號由事件號除以 4 的餘數決定。`ORDER BY` 在建表時定排序鍵；`EXPLAIN indexes = 1` 顯示篩選是否挑少了候選區塊。這段為 ClickHouse 方言，不可在 DuckDB 跑。

```sql
CREATE TABLE payments (shop_id UInt16, event_id UInt64)
ENGINE = MergeTree ORDER BY (shop_id, event_id)
SETTINGS index_granularity = 1024;

INSERT INTO payments
SELECT toUInt16(number % 4), number FROM numbers(65536);

SELECT count() AS n FROM payments WHERE event_id = 20102;
SELECT count() AS n FROM payments WHERE shop_id = 2 AND event_id = 20102;
EXPLAIN indexes = 1
SELECT count() FROM payments WHERE event_id = 20102
SETTINGS use_query_condition_cache = 0, use_skip_indexes_on_data_read = 0;
EXPLAIN indexes = 1
SELECT count() FROM payments WHERE shop_id = 2 AND event_id = 20102
SETTINGS use_query_condition_cache = 0, use_skip_indexes_on_data_read = 0;
```

在 PowerShell 啟動後等服務就緒，再用 `--multiquery` 讀整個檔案。第一次未就緒時先查服務日誌，等可連線再執行；如果建表已成功，不要重送整份含 INSERT 的檔案。

```powershell
docker compose up -d
Get-Content -Raw -Encoding ascii .\clickhouse-order.sql |
  docker compose exec -T clickhouse clickhouse-client --multiquery
```

兩個計數均為 1，因為 `20102 % 4 = 2`。比較計畫列出的 `Granules`，同等結果下帶前綴應能限制候選區塊。實際探測仍以計畫為準。不要用單次不到一秒的耗時做容量結論；本課比較的是能否少讀。若正式查詢多為全店同時段，就以它的篩選分布另測排序鍵；跨系統更新的選擇再看[〈Doris 鍵模型〉](#/lesson/bd-serve-02)。保存計畫後，從同一資料夾執行 `docker compose down`；這是可拋棄的實驗，不用它保存重要數據。

每個片段都各自排序，並不是整張表只維護一條按店排好的連續陣列。即使數據總量不變，小批寫入產生很多片段，也會增加查詢要檢查的範圍。正式比較索引方案時，同時記下片段數與各片段的邊界；若兩次寫入批次不同，不能把所有變化都歸功於新排序鍵。若想輸出也有固定順序，查詢端仍要寫自己的排序。

## 常見錯誤

- 有主索引就期待同鍵寫入報錯 → 排序索引不等於唯一約束 → 改用合適模型。
- 把兩條不同口徑的查詢拿來比速度 → 結果不同難以解釋 → 先固定結果，再比掃描。
- 讀取列數少就假設全部查詢快 → 匯總或傳輸仍可慢 → 用相同工作負載驗收。
