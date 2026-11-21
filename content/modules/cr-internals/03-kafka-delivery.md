---
id: cr-internals-03
module: cr-internals
order: 3
title: Kafka 不丟不重
subtitle: 列出端到端保證的邊界
status: ready
minutes: 25
level: 4
prereqs:
  - cr-internals-02
objectives:
  - 區分 Kafka 生產端確認、分區複本與消費端交付
  - 逐段界定 Kafka 交易及外部數據庫的精確一次邊界
tags:
  - Kafka
  - ISR
  - acks
  - 交易
  - 精確一次
resources:
  - title: Apache Kafka：設計文件
    url: https://kafka.apache.org/44/design/design/
    kind: doc
    lang: en
    minutes: 6
    required: false
    checked: 2026-11-20
    note: 看複本確認與讀、處理、寫的交易邊界。
concepts:
  - id: cr-internals-03-replica
    prompt: acks=all 一定等所有設定的複本嗎？
    answer: 等當時同步複本的要求；還需用 min.insync.replicas 限制可成功寫入的最低同步複本數。
    mcq:
      options:
        - 必須等任何落後的設定複本
        - 只等任意一個未同步複本
        - 等待同步複本，並受最低同步數約束
        - 它代表外部表已提交
      answer: 2
      explain: 複本同步、接受寫入與外部業務交付是不同邊界。
  - id: cr-internals-03-txn
    prompt: Kafka 輸入轉 Kafka 輸出，怎樣讓位移與輸出一起生效？
    answer: 用相容的交易生產者將輸出與消費進度納入同一 Kafka 交易；讀端用 read_committed。
    mcq:
      options:
        - 開啟自動提交就夠了
        - 輸出及位移同交易，讀端讀已提交
        - 只切更多分區
        - 每次重送換新業務 ID
      answer: 1
      explain: 冪等生產者抑制重試造成的某類重複，跨讀寫原子性則需要交易。
    interview:
      question: 面試問 Kafka 怎麼做到不丟不重，怎麼不過度承諾？
      points:
        - 生產確認與同步複本條件
        - 交易輸出與位移、讀已提交
        - 外部寫端要另外防重或協調交易
      answer: 我先問是寫進 Kafka、Kafka 到 Kafka，還是寫外部表。前者看確認與同步複本，Kafka 內我用交易一併提交位移與輸出。若寫數據庫，另靠穩定鍵與交易，還會驗剛寫完但位移未提的故障。
  - id: cr-internals-03-outer
    prompt: 外部數據庫不參與 Kafka 交易，是否仍可有精確一次效果？
    answer: 可在明確條件下用業務事件鍵去重、具冪等性的交易寫入等方法達成，須端到端驗證。
    mcq:
      options:
        - 一定不能，即使可去重
        - 打開 read_committed 自動達成
        - 可，用外部端的鍵與交易另驗
        - 只需要拉高分區數
      answer: 2
      explain: 讀到已提交只約束 Kafka，不能替外部系統提交。
  - id: cr-internals-03-business-key
    prompt: 相同退款鍵出現在兩個已提交的 Kafka 位移時，冪等生產者應替你消掉一筆嗎？
    answer: 不一定；這可能是兩次獨立提交，須由懂得退款鍵意義的寫端防止重複生效。
practice:
  - id: cr-internals-03-p1
    kind: explain
    title: 逐段標出保證與失敗點
    minutes: 9
    steps:
      - 在 C:\dev\conduit-lab\interview\delivery.md 畫生產到 Kafka、Kafka 到 Kafka、Kafka 到外部表的三段保證。
      - 加入已確認寫入但外部位移未提的情形，再比只啟用冪等生產者。
    checks:
      - 指出第一段安全性依 acks／ISR／故障假設而異。
      - 讀端 read_committed 與外部表的防重分開寫，重播後驗同鍵只生效一次。
---

## 先問「哪一段不丟，哪一段不重」

Kafka 的一個主題由分區（partition）組成，分區內的訊息按位移排序；每個分區有領導者（leader）和複本（replica）。生產者送給領導者。`acks=all` 等待同步複本集合（in-sync replicas，ISR）的確認條件，搭配 `min.insync.replicas` 可在同步複本不足時拒絕成功寫入。假設三複本、最低同步數為 2，一個複本落後而仍有 2 個同步時可以寫；只剩 1 個時拒絕，而不是以較弱保護悄悄成功。這是耐久度與可用性的取捨，還須考慮選主、保留窗及故障假設，不承諾所有災難下都不丟。

![Kafka 分區由領導者對同步複本協調；外部寫端仍要處理重播](assets/cr-internals-kafka.svg)

冪等生產者（idempotent producer）用生產者識別及序號處理生產重試的重複；應用若把同一業務事件當成兩個獨立輸入送出，仍須有業務鍵。消費端位移是另一條線：先完成寫端再確認進度，崩潰可能重讀；先確認進度，崩潰則可能漏寫。這些差別要切開說。

## 把精確一次放回正確邊界

Kafka 到 Kafka 的讀、處理、寫，可用交易（transaction）將輸出與消費進度一起提交，並由下游使用 `read_committed` 避免取得未提交或已中止的輸出。若目的地是外部數據庫，Kafka 交易不會替它原子提交。以退款鍵做唯一性及同一寫入交易，再故意於寫成功／確認進度間停機，驗恢復仍只扣一次，才是外部的精確一次效果（exactly-once effect）。下游若是會重複寄送或扣款的非冪等介面，要另設協調或人工核對，不能照搬換個名稱。

白板演練不啟動 Kafka。單節點即使成功跑通也沒有多複本的證據：最多證明讀、寫或重播流程符合案例。若要驗複本容錯，另約合適的多節點環境；現在只把「條件、故障點、預期」畫清楚。

## 多加一筆反例：訊息還在，業務卻算重了

假設同一退款鍵的訊息分別出現在兩個不同位移：一筆是原業務事件，另一筆是上游在不確定回應後重建的事件。就算兩筆都完整提交，Kafka 自身也不知業務上只能扣一次。白板上先標實際記錄和業務鍵，再看外部表是否用同一鍵保護金額；若書寫的是更新事件，還要有來源順序，不能把不同版本全當重播丟棄。這是為何「生產者沒有因傳輸重試而重複寫入」與「財務只扣一次」是不同的承諾。

終點若只驗已讀的訊息，無法代替驗退款表是否生效。

驗收一律留在指定的系統邊界。

## 常見錯誤
- acks=all 當成所有配置複本永遠在線 → 看的是同步集合 → 加上最低同步數及故障假設。
- 生產端冪等就說下游無重複 → 邊界跨過外部寫端 → 加業務鍵及端到端重播驗收。
- 只看消費積壓歸零 → 不能證明表沒漏 → 按來源鍵及輸出版本對帳。
