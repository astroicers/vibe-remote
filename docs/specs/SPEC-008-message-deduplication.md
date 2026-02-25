# SPEC-008：訊息去重（Message Deduplication）

> 追溯規格書——修復已於 commit `4f050a3` 完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-008 |
| **關聯 ADR** | ADR-017 |
| **估算複雜度** | 低 |
| **建議模型** | Sonnet |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 修復 ChatPage 中訊息（user message 和 assistant response）出現兩次的問題，確保同一筆訊息在 store 中只會存在一份。

**現況問題：**
- React StrictMode 雙重掛載導致 `setupWSHandlers()` 被呼叫兩次，註冊重複的 WS event handler
- 每個 `chat_chunk` / `chat_complete` handler 各有一個 closure reference，`Set` 無法去重
- 結果：同一筆 AI 回應被兩個 handler 各處理一次，UI 顯示兩份完全相同的訊息

---

## 輸入規格（Inputs）

此修復為 client-only，無 API 變更。

觸發條件：
- WebSocket 收到 `chat_chunk` / `chat_complete` / `chat_error` 事件
- 使用者送出訊息（optimistic add）

---

## 輸出規格（Expected Output）

**修復後行為：**
- 無論 React mount 幾次，WS handler 只會註冊一組
- 同一 `message.id` 的訊息只會在 store 中出現一次
- 既有功能（streaming、多 workspace 分區）不受影響

---

## 實作範圍

### 修改檔案：`client/src/stores/chat.ts`

#### 1. Module-level 初始化守衛

```typescript
// 防止 React StrictMode 雙重掛載時重複註冊 WS handlers
let wsHandlersInitialized = false;
```

`setupWSHandlers()` 開頭加入：
```typescript
if (wsHandlersInitialized) return;
wsHandlersInitialized = true;
```

#### 2. 訊息去重 helper

```typescript
function addMessageIfNotExists(messages: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === msg.id)) return messages;
  return [...messages, msg];
}
```

將所有 `[...messages, newMsg]` 替換為 `addMessageIfNotExists(messages, newMsg)`：
- `chat_complete` handler 中的 assistant message 加入
- `sendMessage()` 中的 optimistic user message 加入

---

## 邊界條件（Edge Cases）

- **React StrictMode（dev only）**：雙重 mount/unmount 不會導致重複 handler
- **WS 重連**：`wsHandlersInitialized` 為 module-level，重連時不會重複註冊
- **多 workspace**：去重以 `message.id` 為 key，不同 workspace 的訊息 ID 不同，互不影響
- **瀏覽器 tab 重新載入**：module-level flag 隨 JS context 重置，正常重新註冊

---

## 驗收標準（Done When）

- [x] `npm --prefix client run test:run` 全數通過
- [x] React StrictMode 下訊息不再重複
- [x] WS handler 只註冊一次（透過 module-level flag 保證）
- [x] `addMessageIfNotExists()` 對相同 ID 的訊息進行去重
- [x] 多 workspace 訊息隔離正常

---

## 禁止事項（Out of Scope）

- 不要修改：WS handler 的 subscribe/unsubscribe 機制（保持 Set-based）
- 不要修改：server 端訊息發送邏輯
- 不要引入新依賴

---

## 參考資料（References）

- 修復 commit：`4f050a3`
- 修改檔案：`client/src/stores/chat.ts`
- 關聯 ADR：ADR-017（訊息去重策略）
