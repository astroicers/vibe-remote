# AI Engine Design — Vibe Remote

## 總覽

AI Engine 是 Vibe Remote 的核心，負責：
1. 組裝 project context（讓 AI 理解你的 codebase）
2. 管理對話歷史
3. Streaming 回覆
4. Tool use（讓 AI 讀寫檔案、執行指令）
5. 產生 diff 供 review

## Claude API 使用方式

### Model 選擇

```
預設: claude-sonnet-4-20250514
可選: claude-opus-4-20250514 (for complex tasks)

建議讓使用者在 settings 或 per-workspace 設定中切換。
```

### API 呼叫模式

使用 Anthropic SDK 的 streaming mode：

```typescript
// 概念範例，非實際 code
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8192,
  system: systemPrompt,       // context builder 組裝
  messages: conversationHistory,
  tools: toolDefinitions,     // file_read, file_write, etc.
});

for await (const event of stream) {
  // 每個 chunk 透過 WebSocket 即時送到 client
  ws.send(JSON.stringify({
    event: 'ai_chunk',
    data: { type: event.type, content: event.content }
  }));
}
```

### Tool Use Loop

Claude 可能在一次回覆中使用多個 tools。流程：

```
1. 送出 messages + tools → Claude API
2. Claude 回覆可能包含:
   a. text → streaming 送到 client
   b. tool_use → 執行 tool → 將 result 加入 messages
3. 如果有 tool_use，重複步驟 1（帶上 tool results）
4. 直到 Claude 只回覆 text（stop_reason: end_turn）
5. 儲存完整對話到 SQLite
```

## Context Builder

### System Prompt 結構

```
[Base System Prompt]
  你是一個 coding assistant，在 Vibe Remote 環境中工作...

[Workspace System Prompt] (if configured)
  This is a zero-trust platform project using OpenZiti...

[Project Context]
  ## Project Structure
  (file tree, filtered by .gitignore, max depth 3)
  
  ## Key Files
  package.json content
  tsconfig.json content
  
  ## Git Status
  Current branch: feat/rate-limiting
  Uncommitted changes: 3 files
  Recent commits (last 5):
    - abc1234: feat: add rate limiting config
    - def5678: fix: database connection leak
    ...

[User-Selected File Contents]
  ## src/index.ts
  (file content)
  
  ## src/middleware/auth.ts  
  (file content)
```

### Base System Prompt

```markdown
You are a coding assistant working within the Vibe Remote environment. You help engineers write, modify, and debug code through natural language conversation.

## Environment
- You have access to the project's file system through tools
- The user is on a mobile device and communicates via text or voice
- Keep responses concise and focused — the user is reading on a small screen
- When making changes, explain WHAT you changed and WHY, briefly

## Workflow
1. Understand the user's request
2. Read relevant files using file_read tool if needed
3. Make changes using file_write or file_edit tools
4. Summarize what you did
5. The user will review your changes as a diff

## Guidelines
- Always read existing code before modifying it
- Follow the project's existing code style and patterns
- Add error handling for edge cases
- Write clear commit messages when asked
- If the task is ambiguous, ask for clarification rather than guessing
- Keep your explanations brief and mobile-friendly
- Use code blocks with language tags for any code you show
```

### Project Context 組裝邏輯

```
getProjectContext(workspaceId):
  1. 讀取 workspace path
  2. 用 file-tree 模組產生目錄結構
     - respect .gitignore
     - max depth: 3
     - exclude: node_modules, .git, dist, build, coverage, __pycache__
     - 如果超過 200 個項目，truncate + 顯示 "(... and N more)"
  3. 讀取 key config files:
     - package.json (name, scripts, dependencies 部分)
     - tsconfig.json
     - .env.example (如果有)
     - Dockerfile (如果有)
  4. git status:
     - current branch
     - uncommitted files list
     - ahead/behind remote
  5. git log --oneline -5 (最近 5 個 commit)
  6. 如果有 system_prompt → 附加
  
  回傳組裝好的 string
```

### Token 預算管理

```
Claude Sonnet context window: ~200K tokens
目標 system prompt + context 控制在 30K tokens 以內

分配:
  - Base system prompt:     ~500 tokens
  - Workspace system prompt: ~1,000 tokens (user configured)
  - File tree:              ~2,000 tokens (depth 3, ignore patterns)
  - Key config files:       ~3,000 tokens
  - Git info:               ~500 tokens
  - User-selected files:    ~15,000 tokens (cap per file: 5,000 tokens)
  - Conversation history:   ~8,000 tokens (最近 20 輪，超過 truncate 早期)
  
  Total: ~30,000 tokens → 留 170K 給 AI 工作
```

如果 user-selected files 太大：
1. 先嘗試只取前 200 行
2. 如果還是太大，只取 file summary（imports + exports + function signatures）
3. 通知 user file 被 truncated

## Tool Definitions

### file_read
讀取檔案內容。

```json
{
  "name": "file_read",
  "description": "Read the contents of a file in the workspace",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from workspace root, e.g. 'src/index.ts'"
      }
    },
    "required": ["path"]
  }
}
```

**執行邏輯**:
- 路徑必須在 workspace 目錄內（防止路徑穿越）
- 如果檔案不存在 → return error
- 如果是二進位檔 → return "(binary file, not shown)"
- 如果超過 10,000 行 → truncate + 說明

### file_write
建立或覆寫整個檔案。

```json
{
  "name": "file_write",
  "description": "Create a new file or overwrite an existing file",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from workspace root"
      },
      "content": {
        "type": "string",
        "description": "Complete file content to write"
      }
    },
    "required": ["path", "content"]
  }
}
```

**執行邏輯**:
- 路徑必須在 workspace 目錄內
- 自動建立中間目錄（mkdir -p）
- 寫入後記錄在 modified files list

### file_edit
精確編輯檔案（search & replace）。比 file_write 更精準，適合小改動。

```json
{
  "name": "file_edit",
  "description": "Make targeted edits to a file using search and replace",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from workspace root"
      },
      "edits": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "search": {
              "type": "string",
              "description": "Exact text to find (must match uniquely)"
            },
            "replace": {
              "type": "string",
              "description": "Text to replace with"
            }
          },
          "required": ["search", "replace"]
        },
        "description": "List of search-and-replace operations"
      }
    },
    "required": ["path", "edits"]
  }
}
```

**執行邏輯**:
- 每個 search string 必須在檔案中 exactly match 一次
- 如果 match 0 次 → error "search text not found"
- 如果 match > 1 次 → error "search text matches multiple locations, be more specific"
- 按順序執行所有 edits

### terminal_run
執行終端指令（白名單制）。

```json
{
  "name": "terminal_run",
  "description": "Run a terminal command in the workspace directory",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "Shell command to execute"
      }
    },
    "required": ["command"]
  }
}
```

**執行邏輯**:
- Working directory 設為 workspace path
- 超時限制：60 秒
- 允許的指令前綴白名單：
  ```
  npm, npx, node, yarn, pnpm,
  cat, head, tail, grep, find, ls, wc,
  git status, git diff, git log, git branch,
  tsc, eslint, prettier,
  echo, pwd
  ```
- 禁止的指令：
  ```
  rm -rf, rm -r (outside workspace)
  sudo, su, chmod 777,
  curl, wget (防止 exfiltration)
  docker, kubectl (防止影響到其他服務)
  ```
- Output 超過 5000 字元 → truncate 顯示頭尾

### search_codebase
搜尋 codebase（使用 ripgrep 或 grep）。

```json
{
  "name": "search_codebase",
  "description": "Search for text patterns across the codebase",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search pattern (literal string or regex)"
      },
      "file_pattern": {
        "type": "string",
        "description": "Optional file glob pattern, e.g. '*.ts'"
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of results (default: 20)"
      }
    },
    "required": ["query"]
  }
}
```

### git_diff
查看當前 uncommitted changes。

```json
{
  "name": "git_diff",
  "description": "View the current uncommitted changes in the workspace",
  "input_schema": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "Optional: specific file to diff. If omitted, shows all changes."
      }
    }
  }
}
```

## Diff 產生機制

當 AI 透過 tool 修改檔案後：

```
1. AI tool call 修改了 file(s)
2. tool-executor 記錄所有被修改的 file paths
3. AI 回覆結束後（tool loop 結束）
4. Server 執行 `git diff` 取得所有 unstaged changes
5. 解析 diff → per-file breakdown:
   - file path
   - status (added / modified / deleted)
   - hunks (change blocks)
   - insertion/deletion counts
6. 建立 diff_reviews records (status: pending)
7. WebSocket push "diff_ready" event 到 client
8. Client 跳轉到 Diff Review page（或顯示 badge）
```

## 自動 Commit Message 產生

當使用者選擇 auto commit message：

```
System: "Based on the following git diff, generate a concise commit message 
following Conventional Commits format (feat/fix/chore/docs/refactor/test).
Include a brief body if the change is non-trivial.

Diff:
{full git diff output}

Rules:
- First line: type(scope): description (max 72 chars)
- Body: explain WHY, not WHAT (the diff shows WHAT)
- Use imperative mood
- Be specific about what changed"
```

## 自動 PR Description 產生

```
System: "Generate a pull request description for the following changes.

Branch: {branch_name}
Base: {base_branch}
Commits:
{commit list}

Full diff:
{diff}

Format:
## Summary
(1-2 sentences)

## Changes
(bullet list of key changes)

## Testing
(what was tested)"
```

## Rate Limiting

- Claude API 有自己的 rate limit
- Vibe Remote 額外限制：
  - 每分鐘最多 10 次 chat send（防止使用者太快按送出）
  - 每個 tool call 最多 60 秒超時
  - 並行 AI 請求：最多 1 個（sequential processing）
    - 如果已有請求在進行中，新請求排隊
    - Phase 2 Task Queue 可以有多個 concurrent（每個在不同 branch）

## Error Handling

```
Claude API errors:
  - 429 Too Many Requests → 等待 retry-after header → 自動重試
  - 500/502/503 → 最多重試 3 次，backoff 1s/2s/4s
  - 400 Context Too Long → 減少 context → 重試
  - Network error → 通知 client 連線中斷

Tool execution errors:
  - 回傳 error message 給 Claude → Claude 會自行修正
  - 例：file_write 失敗 → Claude 看到 error → 嘗試不同方式

Stream interruption:
  - Client 斷線 → Server 繼續處理（結果存 DB）
  - Client 重連 → 從 DB 讀取完整回覆
```
