# [ADR-019]: Tool Approval 與 SDK 整合方式（Tool Approval SDK Integration Approach）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-22 |
| **決策者** | AI（追溯建立） |

---

## 背景（Context）

> Tool Approval 基礎設施（`ToolApprovalStore`、WS 廣播、`ToolApprovalCard` UI）已在 Phase 1 建立，但從未與 Claude Agent SDK runner 實際連接。需要決定如何將審批流程接入 SDK 的工具執行管道。

核心挑戰：SDK 在 `bypassPermissions` 模式下不會觸發任何權限 callback。

---

## 評估選項（Options Considered）

### 選項 A：SDK 原生 `canUseTool` callback

- **優點**：
  - SDK 官方支援的擴展點，有型別定義（`CanUseTool` type）
  - 在工具執行前攔截，語意正確
  - 不需修改 SDK 內部
- **缺點**：需要在 `canUseTool` 啟用時移除 `bypassPermissions`（兩者互斥）
- **風險**：低——SDK 的 `canUseTool` 是穩定 API

### 選項 B：攔截 tool_use 事件（Event-based interception）

- **優點**：不需要動 SDK 的 permission model
- **缺點**：
  - SDK 的 event stream 是 read-only，無法阻擋工具執行
  - 需要 race condition 處理（事件到達時工具可能已執行）
  - 語意不正確（事後攔截 vs 事前審批）
- **風險**：高——無法保證在工具執行前完成審批

### 選項 C：自建 permission proxy

- **優點**：完全控制權限邏輯
- **缺點**：
  - 需要 monkey-patch SDK 或建立 wrapper layer
  - 維護成本高，SDK 更新可能破壞
  - 重複造輪子（SDK 已提供 `canUseTool`）
- **風險**：高——與 SDK 內部實作耦合

---

## 決策（Decision）

> 我們選擇 **選項 A：SDK 原生 `canUseTool` callback**，因為：
>
> 1. 這是 SDK 設計的官方擴展點，有完整的型別支援
> 2. 在工具執行前攔截，語意正確（事前審批而非事後攔截）
> 3. 不依賴 SDK 內部實作，升級 SDK 時不會破壞
> 4. 實作簡單——只需一個 factory function 將 `ToolApprovalStore` 包裝為 `CanUseTool` callback

### 設計細節

**`canUseTool` 與 `bypassPermissions` 互斥**：
- `bypassPermissions: true` 時，SDK 完全跳過所有 permission check（包含 `canUseTool`）
- 因此當 `TOOL_APPROVAL_ENABLED=true` 時，必須移除 `bypassPermissions` 和 `allowDangerouslySkipPermissions`

**Feature flag 控制**：
- `TOOL_APPROVAL_ENABLED=false`（預設）：不注入 `canUseTool`，保持 `bypassPermissions` 行為
- `TOOL_APPROVAL_ENABLED=true`：注入 `canUseTool`，移除 bypass，啟用審批流程

**流程**：
```
runner.run() → SDK 呼叫 canUseTool(toolName, input, toolUseId)
  → createToolApprovalHandler() 包裝
    → WS 廣播 tool_approval_request
    → toolApprovalStore.requestApproval() (Promise, 2min timeout)
    → 使用者 approve/reject 或 timeout
  → 回傳 { behavior: 'allow' } 或 { behavior: 'deny', message }
→ SDK 根據結果執行或跳過工具
```

---

## 後果（Consequences）

**正面影響：**
- Tool Approval 基礎設施終於與 runner 接通，完成 Phase 1 設計意圖
- 使用 SDK 官方 API，穩定可靠
- Feature flag 控制，預設關閉，不影響現有使用者

**負面影響 / 技術債：**
- `bypassPermissions` 和 `canUseTool` 互斥——啟用審批時 SDK 的所有內建 permission check 也會生效
- 目前 `TOOL_APPROVAL_ENABLED` 預設 `false`，需要使用者手動開啟

**後續追蹤：**
- [x] 修復已驗證（commit `a8107c7`）
- [ ] 考慮在 Settings UI 加入 Tool Approval 開關
- [ ] 考慮 per-workspace 的 approval 規則配置

---

## 關聯（Relations）

- 取代：無
- 被取代：無
- 參考：SPEC-010, ADR-008（Tool Approval 原始設計，若存在）
