# AI Engine Design — Vibe Remote

## 總覽

AI Engine 是 Vibe Remote 的核心，負責：
1. 透過 Claude Agent SDK 驅動 AI 完成 coding 任務
2. 組裝 project context（讓 AI 理解你的 codebase）
3. 管理對話歷史與 token 優化
4. Streaming 回覆（透過 WebSocket 即時推送）
5. 追蹤 modified files 並產生 diff 供 review
6. 自動產生 commit message / PR description

## Claude Agent SDK

### 為什麼用 Agent SDK 而非直接 Anthropic SDK

Vibe Remote 使用 `@anthropic-ai/claude-agent-sdk` 而非直接的 `@anthropic-ai/sdk`。Agent SDK 封裝了 Claude Code 的完整能力，包含：

- **內建 tools**：Read, Write, Edit, Bash, Grep, Glob 等，不需要自行定義
- **Tool use loop**：SDK 自動處理多輪 tool call，直到任務完成
- **CLAUDE.md 自動讀取**：設定 `cwd` 後，SDK 會自動讀取 workspace 中的 CLAUDE.md
- **Permission modes**：支援 `default`、`acceptEdits`、`bypassPermissions` 三種權限模式

### Authentication

支援三種認證方式（擇一）：

```
1. CLAUDE_CODE_OAUTH_TOKEN — OAuth token（透過 `claude setup-token` 取得，使用 Max subscription）
2. ANTHROPIC_API_KEY — API key（從 console.anthropic.com 取得，pay-per-use）
3. Claude Code CLI login — 透過 `claude login` 登入
```

Module load 時會自動檢查認證狀態，缺少認證時輸出 warning。

### Model 設定

```
預設: claude-sonnet-4-20250514
可透過 CLAUDE_MODEL 環境變數覆蓋（config.ts 中定義）
```

### SDK 呼叫方式

使用 `query()` 函式建立 async iterable，搭配 `AbortController` 支援取消：

```typescript
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

const sdkOptions: Options = {
  model: config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  cwd: workspacePath,         // SDK 自動讀取此目錄下的 CLAUDE.md
  maxTurns: 20,               // Tool use loop 最大輪數
  abortController,            // 支援中途取消
  includePartialMessages: true, // 啟用 streaming delta
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
};

for await (const message of query({ prompt, options: sdkOptions })) {
  // message types: 'assistant' | 'stream_event' | 'result' | 'system'
}
```

## ClaudeSdkRunner

`ClaudeSdkRunner` 繼承 `EventEmitter`，封裝了 SDK 呼叫邏輯。

### 介面

```typescript
interface ClaudeSdkOptions {
  workspacePath: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxTurns?: number;
  systemPrompt?: string;
  resumeSessionId?: string;  // Session resume（目前 disabled）
}

interface ChatResponse {
  fullText: string;
  modifiedFiles: string[];   // 去重後的被修改檔案列表
  tokenUsage?: TokenUsage;
  sessionId?: string;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}
```

### 方法

| 方法 | 說明 |
|------|------|
| `run(prompt, options)` | 執行 AI 查詢，回傳 `Promise<ChatResponse>` |
| `abort()` | 中止當前查詢（呼叫 `AbortController.abort()` + `queryInstance.close()`） |

### Events

Runner 透過 `event` 事件發射 `StreamEvent`：

| Event Type | 說明 | 附帶資料 |
|------------|------|----------|
| `text` | AI 文字回覆（streaming chunks） | `content: string` |
| `tool_use` | AI 呼叫了某個 tool | `toolName: string, toolInput: unknown` |
| `tool_result` | Tool 執行結果 | `toolResult: unknown` |
| `token_usage` | Token 使用統計 | `tokenUsage: TokenUsage` |
| `error` | 錯誤 | `content: string` |
| `done` | 查詢完成 | — |

### Message 處理邏輯

SDK 回傳的 message types 與處理方式：

```
assistant     → 遍歷 content blocks:
                - text block → 發射 text event，累積 fullText
                - tool_use block → 發射 tool_use event
                  - 如果是 Write 或 Edit tool → 追蹤 file_path 到 modifiedFiles
stream_event  → 處理 content_block_delta:
                - text_delta → 發射 text event（streaming chunk）
result        → 解析 token usage（input/output/cache tokens + cost USD）
                - subtype !== 'success' → 發射 error event
system        → 包含 session info、tools list（目前僅 log）
```

### System Prompt 傳遞

透過 SDK 的 `extraArgs` 傳遞 system prompt：

```typescript
if (options.systemPrompt) {
  sdkOptions.extraArgs = {
    'system-prompt': options.systemPrompt,
  };
}
```

## Parallel Runners（並行執行管理）

chat-handler.ts 管理多個同時運行的 AI 查詢：

```typescript
interface RunnerState {
  runner: ClaudeSdkRunner;
  workspaceId: string;
  conversationId: string;
}

const activeRunners = new Map<string, RunnerState>();
const MAX_CONCURRENT_RUNNERS = 3;
```

### Key 結構

Runner 以 `workspaceId:conversationId` 為 key，確保：
- 同一個 conversation 不會有兩個並行的 AI 查詢
- 全域最多 3 個並行 runner（超過時拒絕新請求）

### 生命週期

```
1. chat_send 進來 → 檢查 per-conversation lock
2. 檢查全域並行數（< MAX_CONCURRENT_RUNNERS）
3. 建立 ClaudeSdkRunner → 註冊到 activeRunners
4. runner.run() → 處理 streaming events → 透過 WebSocket 推送
5. 完成或錯誤 → 從 activeRunners 移除（在 finally block）
6. WebSocket 斷線 → abort 所有 runners → clear map
```

## Context Builder

### 函式呼叫鏈

```
buildFullSystemPrompt(workspacePath, workspaceSystemPrompt?, selectedFiles?)
  └── buildProjectContext(workspacePath, workspaceSystemPrompt?)
       ├── getFileTree(workspacePath, { maxDepth: 2 })
       ├── 讀取 KEY_FILE_PATTERNS
       ├── getGitStatus(workspacePath)
       └── getRecentCommits(workspacePath, 3)
  └── buildSystemPrompt(context: ProjectContext)
       └── 組裝各 section 為 string
  └── 附加 selectedFiles 內容
```

### Context 限制（Token 效率優化）

```typescript
const KEY_FILE_PATTERNS = [
  'package.json',     // 只保留 name, version, scripts, dependencies 的 key list
  'tsconfig.json',
  '.env.example',
];

const CONTEXT_LIMITS = {
  maxFileChars: 10000,    // 每個 key file 最大 ~2500 tokens
  fileTreeDepth: 2,       // 目錄結構只展到第 2 層
  recentCommits: 3,       // 最近 3 個 commit
};
```

### System Prompt 結構

```
[Base System Prompt]
  你是一個 coding assistant，在 Vibe Remote 環境中工作...
  - 環境說明（有 file system tools、user 在手機上）
  - 工作流程（理解需求 → 讀檔 → 改檔 → 摘要）
  - 指引（遵循 code style、error handling、簡潔回覆）

[Workspace Instructions] (if configured)
  Workspace-level system prompt（per-workspace 設定）

[Project Structure]
  File tree（depth 2，respect .gitignore）

[Key Files]
  package.json（summarized: name, version, scripts, dep names only）
  tsconfig.json
  .env.example

[Git Status]
  Current branch
  Staged/unstaged/untracked counts
  Recent 3 commits（hash:message）

[User-Selected Files] (optional)
  各檔案內容（truncated to 10000 chars）
```

### package.json 摘要

為減少 token 使用，`summarizePackageJson()` 只保留：
- `name`, `version`, `description`, `scripts`
- `dependencies` → 只留 key names（去掉版本號）
- `devDependencies` → 只留 key names

### File Tree 格式

使用 tree-style 格式，每個目錄最多顯示 50 個子項目，超過顯示 `... and N more`。

## Token 優化策略

### History Truncation

當 session resume 不可用時（目前預設），對話歷史以 inline 方式附加到 prompt：

```typescript
// truncate.ts 定義的限制
const LIMITS = {
  messageContent: 2000,   // 每則訊息最大 2000 字元
  historyCount: 5,        // 最多保留最近 5 則訊息
  textFileSize: 1 * 1024 * 1024,  // 文字檔最大 1MB
  attachmentSize: 20 * 1024 * 1024,
  codeBlockSize: 1900,
};
```

歷史訊息格式：
```
Recent conversation:
user: [truncated message]
assistant: [truncated message]
...
```

Tool interaction 的 content（ContentBlock[]）顯示為 `[tool interaction]`。

### File Size 檢查

`checkFileSize()` 在讀取 user-selected files 前檢查：
- Text files: ≤ 1MB
- Non-text files: ≤ 20MB
- 超過限制的檔案會被跳過，並透過 `files_skipped` WebSocket event 通知 client

### Context Builder 限制

- Key files: 每個最大 10000 字元（truncateText 截斷加 `...`）
- File tree depth: 2
- Recent commits: 3
- package.json: summarized（只保留 names）

### Session Resume（目前 Disabled）

SDK 支援 `persistSession` / `resumeSessionId` 來跨請求復用 conversation context，但目前在 Docker 環境中因 session files 跨 process 不穩定而停用。Database 中的 `conversations.sdk_session_id` 欄位仍在寫入，但不用於 resume：

```typescript
// NOTE: Session resume disabled — SDK's persistSession/resume doesn't work
// reliably in Docker (session files not found across spawned processes).
// History is sent inline instead. Re-enable when SDK supports stable resume.
```

## Tools（由 SDK 內建提供）

Claude Agent SDK 自帶完整的 tool set，**不需要自行定義 tool schema**。內建 tools 包含：

| Tool | 說明 |
|------|------|
| `Read` | 讀取檔案內容 |
| `Write` | 建立或覆寫檔案 |
| `Edit` | 精確的 search & replace 編輯 |
| `Bash` | 執行終端指令 |
| `Grep` | 搜尋檔案內容（ripgrep） |
| `Glob` | 檔案名稱 pattern matching |

這些 tools 由 SDK 自動管理 tool use loop（最多 `maxTurns` 輪），包含：
- 自動讀取 CLAUDE.md 獲取 workspace 指引
- Permission handling（根據 `permissionMode` 設定）
- 錯誤自動修正（tool 失敗時 AI 會自動重試其他方式）

### Modified Files 追蹤

chat-handler 透過監聽 `tool_use` event 來追蹤被修改的檔案：

```typescript
if (block.name === 'Write' || block.name === 'Edit') {
  const input = block.input as { file_path?: string };
  if (input.file_path) {
    modifiedFiles.push(input.file_path);
  }
}
```

最終結果會去重（`new Set(modifiedFiles)`）。

## Diff 產生機制

Diff 的產生由 chat-handler.ts 在 AI 查詢完成後觸發：

```
1. AI 透過 Write/Edit tools 修改了檔案
2. ClaudeSdkRunner 追蹤所有 modified file paths（去重）
3. runner.run() 完成 → 回傳 ChatResponse.modifiedFiles
4. chat-handler 發送 chat_complete event（含 modifiedFiles 列表）
5. 如果 modifiedFiles.length > 0 → 發送 diff_ready event
6. Client 收到 diff_ready → 跳轉到 Diff Review page
```

Diff 內容本身由 client 端呼叫 REST API 取得（git diff）。

## Commit Message 自動產生

使用 `runSimplePrompt()` 執行非 streaming 的簡單查詢：

```typescript
async function runSimplePrompt(prompt: string, workspacePath: string): Promise<string> {
  const sdkOptions: Options = {
    model: config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    cwd: workspacePath,
    maxTurns: 1,         // 單輪，不使用 tools
    tools: [],           // 明確禁用 tools
    persistSession: false,
  };
  // ...iterate messages, collect text
}
```

### generateCommitMessage(diff, workspacePath)

Prompt 規則：
- Conventional Commits format（feat/fix/chore/docs/refactor/test）
- First line max 72 chars
- Imperative mood
- 只輸出 commit message，不附加其他說明

### generatePRDescription(branchName, baseBranch, commits, diff, workspacePath)

輸出格式：
```markdown
## Summary
(1-2 sentences)

## Changes
(bullet list of key changes)

## Testing
(what was tested)
```

## Rate Limiting

WebSocket 層級的 rate limiting，以 deviceId 為單位：

```
速率限制: 10 messages / minute / device
視窗: 60 秒 sliding window
實作: in-memory Map<deviceId, timestamp[]>
```

超過限制時回傳 `{ type: 'error', error: 'Rate limit exceeded.' }`。

並行限制：
- 每個 conversation 最多 1 個進行中的 AI 查詢
- 全域最多 3 個並行 runner

## Error Handling

### SDK Error 處理

```
AbortError:
  → 靜默處理（使用者主動取消）

Authentication errors (exit code 1):
  → 檢查環境變數設定
  → 提供具體指引：
    "Please set CLAUDE_CODE_OAUTH_TOKEN (run `claude setup-token`)
     or ANTHROPIC_API_KEY environment variable."

SDK result.subtype !== 'success':
  → 解析 errors 陣列
  → 發射 error event 到 client

一般錯誤:
  → 發射 chat_error event 到 client
  → throw Error 讓上層處理
```

### WebSocket 斷線處理

```
ws.on('close'):
  → 中止所有 active runners (runner.abort())
  → 清空 activeRunners map
  → 取消所有 pending tool approvals

ws.on('error'):
  → 同上
```

### Tool Approval

支援 tool approval flow（用於非 `bypassPermissions` 模式）：
- `tool_approval_response` message type
- `toolApprovalStore` 管理 pending approvals
- WebSocket 斷線時自動 reject 所有 pending approvals

## Chat Retry

支援重試失敗的對話：

```
1. Client 發送 chat_retry { conversationId }
2. 從 DB 取最後一則 user message
3. 建立新的 conversation（title: "Retry: ..."）
4. 發送 conversation_created event（含 isRetry flag）
5. 以新 conversation 重新執行 handleChatMessage
```

## WebSocket Message Flow

### Client → Server

| Message Type | 說明 | 需要 Auth |
|---|---|---|
| `auth` | JWT 認證 | No |
| `chat_send` | 發送聊天訊息 | Yes |
| `chat_retry` | 重試上一則訊息 | Yes |
| `tool_approval_response` | Tool 使用批准/拒絕 | Yes |

### Server → Client

| Message Type | 說明 |
|---|---|
| `auth_success` / `auth_error` | 認證結果 |
| `conversation_created` | 新對話建立（含 conversationId） |
| `chat_start` | AI 開始處理 |
| `chat_chunk` | AI 文字回覆（streaming） |
| `tool_use` | AI 使用了某個 tool |
| `tool_result` | Tool 執行結果 |
| `chat_complete` | AI 完成回覆（含 modifiedFiles, tokenUsage） |
| `chat_error` | 錯誤 |
| `diff_ready` | 有檔案被修改，可以 review diff |
| `files_skipped` | 檔案因大小限制被跳過 |
| `error` | 一般性錯誤（rate limit、未認證等） |
