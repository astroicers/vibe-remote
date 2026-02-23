# [ADR-017]: 訊息去重策略（Message Deduplication Strategy）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-22 |
| **決策者** | AI（追溯建立） |

---

## 背景（Context）

> ChatPage 中使用者訊息和 AI 回覆頻繁出現重複。根因分析發現 React StrictMode 的雙重 mount/unmount 導致 `setupWSHandlers()` 被呼叫兩次，每次建立的 closure 是不同 reference，`Set` 無法去重。結果同一筆 WS 事件被兩個 handler 各處理一次。

需要決定：在哪一層、用什麼策略做去重？

---

## 評估選項（Options Considered）

### 選項 A：WS Handler 清理（unmount 時移除 handler）

- **優點**：從源頭解決，StrictMode unmount 時清除舊 handler
- **缺點**：需要改 WebSocket wrapper 的 subscribe/unsubscribe 機制；handler 是匿名 closure，難以精確移除
- **風險**：可能影響 WS reconnect 邏輯

### 選項 B：Module-level 初始化守衛 + ID 去重 helper

- **優點**：最小改動（新增 1 個 flag + 1 個 helper）；不影響 WS 架構；純 client 端修復
- **缺點**：module-level flag 在 HMR 時不會重置（但 HMR 本身會觸發 full remount，影響有限）
- **風險**：低——flag 語意清晰，去重 helper 是 O(n) 但訊息列表通常不大

### 選項 C：使用 Map/Set 替代 Array 儲存訊息

- **優點**：天然去重，O(1) 查找
- **缺點**：需要大幅重構 chat store 和所有 consumer；zustand persist 序列化需特殊處理
- **風險**：影響面過大，所有讀取 `messages` 的元件都需更新

---

## 決策（Decision）

> 我們選擇 **選項 B：Module-level 初始化守衛 + ID 去重 helper**，因為：
>
> 1. 修復範圍最小——只改 `chat.ts` 一個檔案
> 2. 不影響既有 WS handler 和 store 結構
> 3. 雙重保險：flag 防重複註冊 + helper 防重複訊息
> 4. 可靠性高，無論 React 生命週期如何觸發，最終結果保證正確

---

## 後果（Consequences）

**正面影響：**
- 徹底解決訊息重複問題，UX 恢復正常
- 修復範圍小，regression 風險低

**負面影響 / 技術債：**
- `addMessageIfNotExists` 是 O(n) 線性掃描，但 n（單次對話訊息數）通常 < 200，可接受
- Module-level flag 不是最乾淨的 pattern，但在此情境下實用且可靠

**後續追蹤：**
- [x] 修復已驗證（commit `4f050a3`）

---

## 關聯（Relations）

- 取代：無
- 被取代：無
- 參考：SPEC-008
