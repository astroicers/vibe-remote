# [ADR-018]: Runner 超時設計（Runner Timeout Design）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-22 |
| **決策者** | AI（追溯建立） |

---

## 背景（Context）

> AI runner（`ClaudeSdkRunner`）呼叫 `runner.run()` 後無 timeout 限制。若 Claude CLI 子進程卡住（等待 interactive input、網路超時、或 SDK 內部錯誤），runner 會永久鎖定對應的 conversation，使用者無法發送新訊息也無法中止。

需要決定：用什麼機制實作 timeout 和 abort？

---

## 評估選項（Options Considered）

### 選項 A：AbortSignal timeout

- **優點**：原生 Web API，語意明確
- **缺點**：Claude Agent SDK 的 `runner.run()` 不接受 `AbortSignal` 參數；需要 monkey-patch 或 fork SDK
- **風險**：依賴 SDK 內部實作，未來更新可能破壞

### 選項 B：WS-based abort 命令

- **優點**：利用現有 WS 連線
- **缺點**：abort 需要持有活躍的 WS reference；WS 斷線時無法 abort；增加 WS protocol 複雜度
- **風險**：WS 不穩定時 abort 可能失敗

### 選項 C：`withTimeout()` Promise.race + 定期 stale 清理 + REST abort endpoint

- **優點**：
  - `Promise.race` 是通用 pattern，不依賴 SDK 內部
  - REST endpoint 不依賴 WS 連線狀態，可獨立操作
  - 定期 stale 清理作為安全網，防止異常情況
- **缺點**：三層機制略顯複雜
- **風險**：低——每層獨立運作，互不干擾

---

## 決策（Decision）

> 我們選擇 **選項 C：`withTimeout()` Promise.race + 定期 stale 清理 + REST abort endpoint**，因為：
>
> 1. `withTimeout()` 是通用工具，不綁定任何特定 SDK
> 2. REST abort endpoint 讓使用者在任何連線狀態下都能中止
> 3. 定期 stale 清理（60s interval, 1.5x timeout threshold）是最後防線
> 4. 三層機制各自獨立：timeout 自動觸發、使用者手動 abort、系統自動清理

### 設計細節

| 機制 | 觸發條件 | 行為 |
|------|----------|------|
| `withTimeout()` | runner 執行超過 `RUNNER_TIMEOUT_MS` | abort + 移除 + 廣播 error |
| REST abort | 使用者點擊 UI abort 按鈕 | 呼叫 `abortRunner()` + toast |
| Stale cleanup | 定期掃描（60s），runner 存活超過 1.5x timeout | 強制 abort + 移除 |

---

## 後果（Consequences）

**正面影響：**
- Runner 不再能永久鎖定 conversation
- 使用者有明確的 abort 操作（UI 按鈕）
- Task runner 也受 timeout 保護
- `withTimeout()` 可被其他模組複用

**負面影響 / 技術債：**
- Timeout abort 是 hard stop，不會等待 Claude CLI graceful shutdown
- 三層機制增加了理解成本（但各自獨立，易於維護）

**後續追蹤：**
- [x] 修復已驗證（commit `4bf6dc2`）
- [ ] 考慮加入 abort 原因的 WS 通知（timeout vs manual）

---

## 關聯（Relations）

- 取代：無
- 被取代：無
- 參考：SPEC-009
