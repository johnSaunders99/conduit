---
id: bd-kafka-02
module: bd-kafka
order: 2
title: 生產者與訊息鍵
subtitle: 擴分區前先想順序
status: ready
minutes: 35
level: 3
prereqs:
- bd-kafka-01
objectives:
- 對照相同鍵在同一分區的追加順序
- 說明加分區為何可能改變鍵的去向
- 判斷業務時間與位移順序是否一致
tags:
- record-key
- partitioner
- 同鍵順序
- 擴分區
resources:
- title: Kafka：生產者設定
  url: https://kafka.apache.org/44/configuration/producer-configs/
  kind: doc
  lang: en
  minutes: 6
  required: false
  checked: '2026-11-20'
  note: 讀分區器、重送與冪等設定。
- title: Kafka：主題操作
  url: https://kafka.apache.org/44/operations/basic-kafka-operations/
  kind: doc
  lang: en
  minutes: 5
  required: false
  checked: '2026-11-20'
  note: 讀新增分區時既有數據不重分配的限制。
concepts:
- id: bd-kafka-02-key-order
  prompt: 何時同一訂單的事件會在同一分區？
  answer: 使用一致的鍵序列化與分區策略、未指定不同分區，並保持分區配置不變時。
  mcq:
    question: 要讓同訂單異動維持分區內順序，應怎麼送？
    options:
    - 用每筆不同的事件編號當鍵
    - 不帶鍵，只靠時間欄
    - 沿用同一訂單鍵與同一分區策略
    - 每筆明確指定不同分區
    answer: 2
    explain: 分區依據要對準順序邊界；事件編號適合去重，不適合把整張訂單綁到一區。
  interview:
    question: 將有鍵主題從 3 區擴到 6 區，舊訂單順序會怎樣？
    points:
    - 鍵映射可能改變
    - 舊紀錄不會自動搬家
    - 有序遷移或版本檢核
    answer: 舊紀錄留在原區，新事件可能去另一區。同一訂單的先後就不能靠單區位移保證。我會先量熱鍵，再決定是否分流到新主題；切換前排空舊路徑，並用業務版本查倒退。
- id: bd-kafka-02-hot-key
  prompt: 為了讓一家大門市的事件有序，全部以門市當鍵有何代價？
  answer: 熱門門市傾倒在單一分區；增加其他分區無法把該鍵的負載拆開。
  mcq:
    question: 1 個門市鍵佔 70% 流量，其他區很空，先查什麼？
    options:
    - 熱門門市是否每筆都用不同業務時間
    - 這個鍵是否集中在同一分區
    - 複本節點是否平均接收各區的複製
    - 全組提交次數是否變多
    answer: 1
    explain: 先以每區寫入量檢查傾斜，再判斷業務能否把順序邊界縮到訂單。
- id: bd-kafka-02-business-clock
  prompt: 較大的位移能證明事件在業務端較晚發生嗎？
  answer: 不能；網路延遲或來源重送會改變到達和追加順序。
  mcq:
    question: 付款先送達，較早發生的建立後送達，位移描述哪件事？
    options:
    - 業務事件發生次序
    - Windows 時鐘精度
    - Kafka 分區追加次序
    - 付款是否有效
    answer: 2
    explain: 要以事件時間和業務版本檢查來源次序，不能用位移取代。
practice:
- id: bd-kafka-02-p1
  kind: hands-on
  title: 記下兩個訂單的分區與位移
  minutes: 12
  steps:
  - 從上一堂資料夾送出三筆並讀回。
  - 在 kafka-keys.md 抄下 order-17 的兩筆位移；另畫一個擴分區後改走另一區的例子。
  checks:
  - 同次送出的 order-17 兩筆在同一區，created 的位移較小。
  - 即使 order-24 剛好同區，仍不以這一次結果推斷所有鍵都同區。
---

剛才的主題有 3 條日誌。生產者（producer）送訊息時可以指定分區，也可以交給分區器（partitioner）選。對一般有鍵紀錄，Java 客戶端的預設分區策略會依序列化後的鍵來選分區；訊息鍵（record key）是訊息的一部分，不是數據庫唯一鍵。一個訂單可以帶著同一鍵寫很多次。如果消費結果要求「最終狀態不倒退」，還要在值裡保留業務版本，不只靠鍵。

## 鍵的粒度就是順序的粒度

例如付款只需要相同訂單內按序解讀，不要求所有門市全域依序。用訂單號當鍵比用門市號好：各訂單能分散，不必把大門市整批事件擠到一區。用每筆事件唯一碼當鍵雖然更容易分散，卻可能把同一訂單的建立與付款送往不同分區。實務上訂單鍵和事件唯一碼可以同時存在，分別負責路由與去重。無鍵訊息可能因批次策略連續寫往同一區，不應假設每一筆輪流切區。

兩次送出相同鍵，還要確認兩個生產者使用一致的鍵編碼與策略。例如數字 `17` 的字串位元組和整數編碼不同。擴分區也會改變雜湊映射：假設教學用的雜湊值是 8，`8 % 3` 是 2、`8 % 6` 是 2，但值 5 原本在 2、擴容後去 5。也就是「可能改變」，不是每鍵一定改變。舊訊息還在原區，所以切換前後的同鍵紀錄可能再也不能靠分區內位移合併。

## 走一次真實路由

沿用[〈主題與分區〉](#/lesson/bd-kafka-01)的 `C:\dev\conduit-lab\kafka`，單容器仍約需 2 GB。下方命令在 PowerShell 將 `鍵:值` 逐行送給 console producer。`parse.key=true` 啟用鍵解析，`key.separator=:` 指定分隔。讀取端使用 `--from-beginning`，開啟鍵、分區和位移的顯示；`--timeout-ms` 讓無新訊息時回到終端，等待到期訊息不是紀錄遺失。

```powershell
@('order-17:created','order-24:created','order-17:paid') |
  docker compose exec -T kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic order_events --reader-property parse.key=true --reader-property key.separator=:
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic order_events --from-beginning --timeout-ms 5000 --formatter-property print.key=true --formatter-property print.partition=true --formatter-property print.offset=true
```

先不要猜是哪一區，也不要用畫面行序比較不同區的先後。只圈出同一次送的兩筆 `order-17`：同一區、`created` 位移小於 `paid`。若再次執行會附加新紀錄，不覆寫第一次的值；這正是[〈交付語義與交易〉](#/lesson/bd-kafka-07)要處理的重送問題。交付驗收時再比業務事件版本，而不是把兩個 Kafka 位移當成訂單狀態的版本。

重試也會影響追加次序。如果關閉冪等且允許多批同時送，前一批失敗等待重試，後一批可能先寫成功。若順序是合約，不能只說已選了鍵；還要確認生產端重試設定，以及來源是否本來就有多個寫者。我會用同一訂單連寫兩個業務版本，故意讓較舊版本延後，驗收的是帳務是否倒退，不只看本機三筆的順序。

## 常見錯誤

- 讀到的鍵是空值 → 寫入沒啟用鍵解析 → 檢查 producer 的兩個 `--reader-property`。
- 同分區看到多個訂單 → 鍵不是分區專屬的名稱 → 多個不同鍵可映射到同一區。
- 擴區後同訂單在兩區 → 舊紀錄沒有搬家 → 另設切換邊界，或由下游按業務版本防倒退。
