# Claude Agent SDK 評估報告

## 概述

本文件評估從目前的 Claude Code CLI (`claude -p`) 整合方式遷移到 Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) 的可行性。

## 現有架構

### 目前實作 (Claude Code CLI)

```
Mobile App → WebSocket → Server → spawn('claude', ['-p', ...]) → NDJSON stream
```

**優點：**
- 簡單直接的實作
- 利用 Claude Code CLI 已有的 MCP server 整合
- 不需要額外的 API key 管理
- 繼承 CLI 的所有 tool 和權限設定

**缺點：**
- 每次呼叫約 3 秒冷啟動時間
- 需要 parse NDJSON stdout
- 錯誤處理較複雜（需要處理 process exit code、stderr）
- 無法精細控制 tool approval（目前用 `--dangerously-skip-permissions`）

## Claude Agent SDK 分析

### 套件資訊

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**需求：**
- Claude Code CLI 已安裝並登入 (`claude login`)
- Claude Max 訂閱 (用於 agent 功能)

### SDK 核心 API

```typescript
import { query, type ClaudeCodeOptions } from '@anthropic-ai/claude-agent-sdk';

const result = await query({
  prompt: 'Create a hello world function',
  options: {
    cwd: '/project/path',
    model: 'claude-sonnet-4-20250514',
    permissionMode: 'default',  // or 'acceptEdits' | 'bypassPermissions' | 'plan'
  },
  callbacks: {
    onMessage: (message) => { /* streaming */ },
    onError: (error) => { /* error handling */ },
    onComplete: () => { /* completion */ },
  },
});
```

### 主要差異

| 功能 | CLI (spawn) | Agent SDK |
|------|------------|-----------|
| **啟動時間** | ~3s 冷啟動 | 更快（SDK 快取）|
| **Streaming** | Parse NDJSON stdout | 原生 callback API |
| **Tool Approval** | 全有或全無 | Promise-based 精細控制 |
| **Session Resume** | 不支援 | 原生支援 |
| **錯誤處理** | Exit code + stderr | 結構化 Error 物件 |
| **Memory 管理** | 每次新 process | SDK 內部管理 |

### Tool Approval 機制（從 Claude-by-Discord 學習）

```typescript
interface PendingApproval {
  toolId: string;
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

// SDK 呼叫 canUseTool callback
const result = await query({
  prompt: '...',
  options: { permissionMode: 'default' },
  callbacks: {
    canUseTool: async (toolUse) => {
      // 建立 Promise，存入 StateStore
      const approval = new Promise<PermissionResult>((resolve, reject) => {
        pendingApprovals.set(toolUse.id, { resolve, reject });
      });

      // 發送到 mobile app 等待用戶操作
      ws.send(JSON.stringify({ type: 'tool_approval_required', tool: toolUse }));

      // 等待 mobile app 回應
      return approval;
    },
  },
});
```

## 遷移建議

### 階段 1: 準備工作（低風險）

1. **保留現有 CLI 實作作為 fallback**
2. **新增 SDK wrapper 模組** `src/ai/claude-sdk.ts`
3. **Feature flag** 控制使用哪個實作

### 階段 2: 漸進式遷移

```typescript
// src/ai/index.ts
import { ClaudeCliRunner } from './claude-cli.js';
import { ClaudeSdkRunner } from './claude-sdk.js';

export function createRunner(options: { useSdk?: boolean } = {}) {
  if (options.useSdk && process.env.CLAUDE_USE_SDK === 'true') {
    return new ClaudeSdkRunner();
  }
  return new ClaudeCliRunner();
}
```

### 階段 3: Tool Approval UI

1. **新增 WebSocket event types:**
   - `tool_approval_required` - 需要用戶批准
   - `tool_approval_response` - 用戶回應

2. **Mobile UI 更新:**
   - 顯示 tool 操作詳情（檔案路徑、操作類型）
   - 批准/拒絕按鈕
   - 批准後繼續執行

3. **Backend StateStore:**
   - 儲存 pending approvals
   - Timeout 處理
   - 清理機制

## 風險評估

### 低風險
- SDK API 穩定（Anthropic 官方維護）
- 現有測試可驗證功能

### 中風險
- Claude Max 訂閱需求（成本考量）
- SDK 更新可能需要調整程式碼

### 高風險
- SDK 目前仍在積極開發中，API 可能變更

## 結論

### 建議採取行動

1. **短期 (Phase 1):** 維持現有 CLI 實作，專注於完善現有功能
2. **中期 (Phase 2):** 當 Tool Approval UI 需求明確時，評估 SDK 遷移
3. **長期 (Phase 3):** 如果 Claude Max 成本可接受，全面遷移到 SDK

### 暫不遷移的理由

1. **現有實作運作良好** - 已有完整的 streaming、token tracking
2. **CLI 足夠需求** - 對於 mobile review workflow，不需要精細的 tool approval
3. **降低複雜度** - 一個實作方式更容易維護
4. **成本考量** - CLI 使用現有 Claude 帳號，不需額外 Claude Max

### 何時應該遷移

- 當需要精細的 tool-by-tool approval UI 時
- 當冷啟動時間成為效能瓶頸時
- 當 SDK API 穩定且文件完善時
