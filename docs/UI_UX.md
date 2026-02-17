# UI/UX Design — Vibe Remote

## 設計原則

1. **大拇指操作** — 所有主要操作在單手可及範圍內（螢幕下半部）
2. **Voice-first** — 打字是備選，語音輸入是主要輸入方式
3. **Glanceable** — 一眼就能看到狀態（幾個 task 完成？有沒有 pending review？）
4. **少步驟** — 每個 action 最多 2 次點擊
5. **OLED Dark 主題優先** — 使用真黑 (#000000) 背景最大化 OLED 省電，搭配降低對比度的文字減少眼睛疲勞

## 導航結構

```
底部導航列（固定）:

┌───────────┬───────────┬───────────┬───────────┐
│  💬 Chat  │  📝 Diff  │  📋 Tasks │  📁 Repos │
│           │  (2)      │  (1)      │           │
└───────────┴───────────┴───────────┴───────────┘
                                        
括號數字 = badge，表示需要注意的項目數
  - Diff badge: pending review 的檔案數
  - Tasks badge: awaiting_review 的 task 數
```

## Page 設計

### 1. Chat Page（預設首頁）

```
┌──────────────────────────────┐
│ ≡  merak-platform  ⚡ 🔔     │  ← header: 選單 | workspace 名 | actions | notifications
│    main ● 2 uncommitted      │  ← sub-header: branch + status
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 🤖 I'll add rate       │  │  ← AI message bubble (左對齊)
│  │ limiting using          │  │     code block 可語法高亮
│  │ express-rate-limit...   │  │     底部可展開 tool call details
│  │                         │  │
│  │ ```typescript           │  │
│  │ import rateLimit from   │  │
│  │ 'express-rate-limit';   │  │
│  │ ```                     │  │
│  │                         │  │
│  │ 📄 Modified 3 files     │  │  ← 點擊跳轉到 Diff Review
│  │ [Review Changes →]      │  │
│  └────────────────────────┘  │
│                              │
│       ┌──────────────────┐   │
│       │ Add rate limiting │   │  ← User message (右對齊)
│       │ to the API        │   │
│       │ gateway           │   │
│       └──────────────────┘   │
│                              │
├──────────────────────────────┤
│ 📎  ┌──────────────────┐ 🎤 │  ← 輸入區域
│     │ Ask anything...   │    │     📎 = 附加檔案/context
│     │                   │    │     🎤 = 語音輸入（長按錄音）
│     └──────────────────┘ ▶   │     ▶ = 送出
│                              │
│ [Fix lint] [Write tests] ... │  ← Prompt template 快速按鈕（水平捲動）
├──────────────────────────────┤
│ 💬 Chat │📝Diff(2)│📋Tasks│📁│  ← 底部導航
└──────────────────────────────┘
```

**Chat Page 互動細節**:

- **Message bubbles**: 
  - Long press → 複製文字 / 引用回覆
  - Code blocks 有語法高亮，右上角有 copy 按鈕
  - AI message 底部如果有 file modifications → 顯示 "Review Changes" 連結
  - Tool call 區域預設收合，點擊展開看 AI 做了什麼

- **語音輸入**:
  - 點擊 🎤 → 開始錄音，畫面顯示波形動畫
  - 再次點擊或停止說話 → 結束錄音 → 文字顯示在輸入框（可編輯後送出）
  - 支援中英文混合
  - 語音辨識使用 Web Speech API，不需要額外 API

- **Context file 選擇** (📎):
  - 點擊 📎 → 彈出半頁 bottom sheet
  - 顯示 file tree（可展開/收合）
  - 勾選要加入 context 的檔案
  - 已選檔案顯示為 chips 在輸入框上方

- **Prompt templates**:
  - 水平捲動的 pill buttons
  - 點擊 → template 文字填入輸入框
  - 如果 template 有 `{placeholder}` → 高亮標記，使用者替換後送出
  - 長按 → 編輯 / 刪除 template

### 2. Diff Review Page

```
┌──────────────────────────────┐
│ ←  Diff Review               │
│    3 files changed  +45 -12  │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ ●○○  rate-limiter.ts     │ │  ← File indicator dots + 當前檔名
│ │      (new file, +35)     │ │     左右滑動切換檔案
│ └──────────────────────────┘ │
├──────────────────────────────┤
│                              │
│  + import rateLimit from     │  ← Unified diff view
│  + 'express-rate-limit';     │     綠色背景 = added
│  +                           │     紅色背景 = deleted
│  + export function create    │     白色背景 = context
│  + RateLimiter() {           │
│  +   const config = {        │     行號顯示在左側
│  +     windowMs: 15 * 60     │     字體使用 monospace
│  +     * 1000,               │     支援雙指縮放
│  +     max: 100,             │
│  +   };                      │
│  +   return rateLimit(       │
│  +     config                │
│  +   );                      │
│  + }                         │
│                              │
├──────────────────────────────┤
│                              │
│  ┌─────┐  ┌─────┐  ┌─────┐  │  ← Action buttons（大按鈕，好按）
│  │  ❌  │  │  💬  │  │  ✅  │  │
│  │Reject│  │Comment│ │Approve│ │
│  └─────┘  └─────┘  └─────┘  │
│                              │
│  [Approve All 3 Files]       │  ← 全部 approve 按鈕
│                              │
├──────────────────────────────┤
│ 💬 Chat │📝Diff   │📋Tasks│📁│
└──────────────────────────────┘
```

**Diff Page 互動細節**:

- **File 切換**: 左右滑動或點擊 indicator dots
- **Approve**: 點擊 ✅ → 該檔案標記為 approved → 自動滑到下一個 pending 檔案
- **Reject**: 點擊 ❌ → 彈出確認對話框 → revert 該檔案 → 記錄在 review history
- **Comment**: 點擊 💬 → 彈出文字輸入框（也支援語音）→ 回饋送回 AI → AI 重改 → 新 diff 推送
- **Approve All**: 全部 pending 檔案一鍵 approve → 啟用 commit 按鈕
- **All approved 後**:
  ```
  ┌─────────────────────────────┐
  │ ✅ All 3 files approved!     │
  │                             │
  │  Commit message:            │
  │  ┌───────────────────────┐  │
  │  │ feat: add rate        │  │  ← AI 自動產生，可編輯
  │  │ limiting middleware   │  │
  │  └───────────────────────┘  │
  │                             │
  │  [Commit]  [Commit & Push]  │  ← 主要操作按鈕
  └─────────────────────────────┘
  ```

### 3. Tasks Page (Phase 2)

```
┌──────────────────────────────┐
│ Tasks  merak-platform    [+] │  ← [+] = 新增 task
├──────────────────────────────┤
│                              │
│ ┌ Queued ─────────────────┐  │  ← 垂直 Kanban 列
│ │ ┌──────────────────────┐│  │     每個 column 可收合
│ │ │ 📋 Create DB         ││  │
│ │ │ migrations           ││  │
│ │ │ ⏳ Waiting: Task #1  ││  │  ← 顯示依賴狀態
│ │ │ Priority: Normal     ││  │
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
│ ┌ Running ────────────────┐  │
│ │ ┌──────────────────────┐│  │
│ │ │ 🔄 Design RBAC model ││  │
│ │ │ Started 3 min ago    ││  │  ← 進行中動畫
│ │ │ ██████████░░░ 70%    ││  │
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
│ ┌ Review (1) ─────────────┐  │
│ │ ┌──────────────────────┐│  │
│ │ │ 👀 Add rate limiting ││  │
│ │ │ 3 files, +45 -12     ││  │
│ │ │ [Review →]           ││  │  ← 點擊跳轉到 Diff
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
├──────────────────────────────┤
│ 💬 Chat │📝Diff│📋 Tasks │📁│
└──────────────────────────────┘
```

**Task 建立表單**:
```
┌──────────────────────────────┐
│ ← New Task                   │
├──────────────────────────────┤
│                              │
│ Title                        │
│ ┌──────────────────────────┐ │
│ │ Add rate limiting        │ │
│ └──────────────────────────┘ │
│                              │
│ Description                  │
│ ┌──────────────────────────┐ │
│ │ Add rate limiting        │ │  ← 大文字框 + 🎤 語音輸入
│ │ middleware to the API    │ │
│ │ gateway, configure 100   │ │
│ │ req per 15 min per IP.   │ │
│ └──────────────────────────┘ │
│                              │
│ Priority: [Normal ▼]         │
│ Depends on: [None ▼]         │
│ Context files: [+ Add]       │
│                              │
│ [Create Task]                │
│ [Create & Add Another]       │  ← 批次模式：建完不關頁面
│                              │
├──────────────────────────────┤
│ 💬 Chat │📝Diff│📋 Tasks │📁│
└──────────────────────────────┘
```

### 4. Repos Page

```
┌──────────────────────────────┐
│ Workspaces               [+] │  ← [+] = 註冊新 workspace
├──────────────────────────────┤
│                              │
│ ┌──────────────────────────┐ │
│ │ 📂 merak-platform  ★     │ │  ← ★ = active workspace
│ │ main ● 2 uncommitted     │ │
│ │ Last commit: 2h ago      │ │
│ │                           │ │
│ │ [⚡Quick Actions        ▼]│ │  ← 展開顯示按鈕列
│ │  🔨Test  📦Commit  🚀Push │ │
│ │  🔄Pull  🌿Branch  📋Lint │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📂 security-mcp-server   │ │
│ │ main ✓ clean             │ │
│ │ Last commit: 1d ago      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📂 vibe-remote            │ │
│ │ feat/chat-ui ● 5 files   │ │
│ │ Last commit: 30m ago     │ │
│ └──────────────────────────┘ │
│                              │
├──────────────────────────────┤
│ 💬 Chat │📝Diff│📋 Tasks │📁│
└──────────────────────────────┘
```

**Quick Actions 互動**:
- 每個 action 點擊後顯示 loading spinner
- 完成後顯示 toast 通知（成功/失敗）
- Commit → 彈出 commit message 編輯（AI 預填）
- Push → 如果有 conflict 顯示警告
- Branch → 彈出 branch 列表 / 建立新 branch
- Discard → 二次確認對話框

### 5. Settings Page（從 header ≡ 選單進入）

```
┌──────────────────────────────┐
│ ← Settings                   │
├──────────────────────────────┤
│                              │
│ 🔗 Connection                │
│   Server: 100.x.y.z:3000    │
│   Status: ● Connected       │
│                              │
│ 🤖 AI                        │
│   Model: Claude Sonnet 4     │
│   Max tokens: 4096           │
│                              │
│ 🎤 Voice                     │
│   Language: Auto (中/EN)     │
│   Auto-send: [On]            │
│                              │
│ 🔔 Notifications             │
│   Push: [Enabled]            │
│   Task complete: [On]        │
│   Test results: [On]         │
│                              │
│ 🎨 Appearance                │
│   Theme: [Dark]              │
│   Font size: [Medium]        │
│                              │
│ 📱 Devices                   │
│   iPhone 15 Pro (this)       │
│   [Revoke] [Add New Device]  │
│                              │
│ 🔧 Advanced                  │
│   Export data                 │
│   Reset all settings         │
│                              │
└──────────────────────────────┘
```

## 元件階層

```
App
├── BottomNav                          # 底部導航列
├── StatusBar                          # 頂部連線狀態（斷線時顯示紅色條）
├── Pages/
│   ├── ChatPage
│   │   ├── ChatHeader                 # Workspace 名 + branch
│   │   ├── MessageList                # 可捲動的訊息列表
│   │   │   ├── MessageBubble (×N)     # 單一訊息
│   │   │   │   ├── CodeBlock          # 程式碼區塊（語法高亮）
│   │   │   │   ├── ToolCallDetails    # AI tool use 詳情（可展開）
│   │   │   │   └── DiffLink           # "Review Changes" 連結
│   │   │   └── TypingIndicator        # AI 正在打字動畫
│   │   ├── ChatInput                  # 輸入區域
│   │   │   ├── TextInput              # 文字輸入框
│   │   │   ├── VoiceButton            # 語音輸入按鈕
│   │   │   ├── AttachButton           # 附加檔案按鈕
│   │   │   └── SendButton             # 送出按鈕
│   │   ├── ContextFileSheet           # Bottom sheet: 檔案選擇器
│   │   │   └── FileTree               # 可勾選的檔案樹
│   │   └── TemplateBar                # 水平捲動的 prompt template 按鈕列
│   │
│   ├── DiffPage
│   │   ├── DiffHeader                 # 統計摘要
│   │   ├── FileIndicator              # ●○○ 檔案切換 dots
│   │   ├── DiffViewer                 # Unified diff 顯示（可滑動切換）
│   │   │   └── DiffHunk (×N)          # 單一 diff hunk
│   │   ├── ReviewActions              # Approve / Reject / Comment 按鈕
│   │   ├── ApproveAllButton           # 全部 approve
│   │   └── CommitSheet                # 全部 approved 後的 commit 操作
│   │
│   ├── TasksPage
│   │   ├── TaskHeader                 # Workspace 選擇 + 新增按鈕
│   │   ├── KanbanBoard                # 垂直 Kanban
│   │   │   ├── KanbanColumn (×N)      # 單一狀態 column
│   │   │   │   └── TaskCard (×N)      # 單一 task 卡片
│   │   └── NewTaskSheet               # Bottom sheet: 新增 task 表單
│   │
│   ├── ReposPage
│   │   ├── WorkspaceList              # Workspace 卡片列表
│   │   │   └── WorkspaceCard (×N)     # 單一 workspace
│   │   │       ├── GitStatusBadge     # Branch + dirty 狀態
│   │   │       └── QuickActions       # 展開的操作按鈕列
│   │   └── AddWorkspaceSheet          # Bottom sheet: 註冊新 workspace
│   │
│   └── SettingsPage
│       ├── ConnectionSection
│       ├── AISection
│       ├── VoiceSection
│       ├── NotificationSection
│       ├── AppearanceSection
│       └── DeviceSection
│
└── Common/
    ├── Toast                          # 操作結果提示
    ├── ConfirmDialog                  # 危險操作確認
    ├── LoadingSpinner                 # 載入中
    ├── PullToRefresh                  # 下拉刷新
    └── EmptyState                     # 空狀態提示
```

## 色彩系統（OLED Dark Theme）

採用 Open WebUI 風格的 OLED 優化深色主題，使用真黑背景最大化省電效果。

```
Background (OLED 優化，使用高度漸層):
  --bg-primary:    #000000    (真黑，主背景，0% elevation)
  --bg-secondary:  #0a0a0a    (卡片、訊息氣泡，2% elevation)
  --bg-tertiary:   #121212    (hover、active 狀態，4% elevation)
  --bg-elevated:   #1a1a1a    (modal、bottom sheet，8% elevation)
  --bg-surface:    #1e1e1e    (輸入框、互動表面，12% elevation)

Text (降低對比度減少眼睛疲勞):
  --text-primary:  #e4e4e7    (主要文字，~87% 白)
  --text-secondary:#a1a1aa    (次要文字、meta info)
  --text-muted:    #52525b    (placeholder)
  --text-inverse:  #000000    (用於淺色強調背景上)

Accent (在黑色背景上更鮮豔):
  --accent:        #3b82f6    (連結、active tab，Blue-500)
  --accent-hover:  #60a5fa    (hover 狀態，Blue-400)
  --accent-muted:  #1e3a5f    (使用者訊息背景，低飽和藍)

Status:
  --success:       #22c55e    (approve、passed，Green-500)
  --success-muted: #14532d    (success 背景)
  --danger:        #ef4444    (reject、failed、delete，Red-500)
  --danger-muted:  #450a0a    (danger 背景)
  --warning:       #f59e0b    (pending、running，Amber-500)
  --warning-muted: #451a03    (warning 背景)

Diff (OLED 優化，高對比可讀性):
  --diff-add-bg:   #052e16    (added 行背景，Green-950)
  --diff-add-text: #4ade80    (added 行文字，Green-400)
  --diff-add-line: #166534    (added 行號背景)
  --diff-del-bg:   #2a0a0a    (deleted 行背景)
  --diff-del-text: #f87171    (deleted 行文字，Red-400)
  --diff-del-line: #7f1d1d    (deleted 行號背景)

Border:
  --border:        #27272a    (分隔線，Zinc-800)
  --border-focus:  #3b82f6    (focus ring，Blue-500)
```

### 對比度驗證 (WCAG AA)

| 元素 | 前景 | 背景 | 對比度 | 通過 |
|------|------|------|--------|------|
| 主要文字 | #e4e4e7 | #000000 | 15.6:1 | AAA |
| 次要文字 | #a1a1aa | #000000 | 7.6:1 | AA |
| 強調色 | #3b82f6 | #000000 | 5.1:1 | AA |
| Diff add | #4ade80 | #052e16 | 7.2:1 | AA |
| Diff del | #f87171 | #2a0a0a | 8.4:1 | AA |

## 字型系統 (Typography)

```
Font Family:
  --font-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
  --font-mono:  'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace

Font Sizes (mobile-first):
  --text-xs:    11px / line-height 1.4    (badges, 輔助標籤)
  --text-sm:    13px / line-height 1.4    (次要文字, meta)
  --text-base:  15px / line-height 1.5    (主要內文)
  --text-lg:    17px / line-height 1.5    (section 標題)
  --text-xl:    20px / line-height 1.4    (page 標題)
  --text-2xl:   24px / line-height 1.3    (大標題)

Font Weights:
  --font-normal:   400    (一般文字)
  --font-medium:   500    (強調、標籤)
  --font-semibold: 600    (標題)
  --font-bold:     700    (重點強調)

Usage Guidelines:
  - Page 標題: --text-xl, --font-semibold
  - Section 標題: --text-lg, --font-medium
  - 內文: --text-base, --font-normal
  - 次要文字: --text-sm, --text-secondary
  - 程式碼: --font-mono, --text-sm
  - Badges: --text-xs, --font-medium
```

## 元件 Tokens

### Border Radius (更圓潤的現代風格)

```
  --radius-sm:   8px     (chips, badges, 小元素)
  --radius-md:   12px    (buttons, inputs, 小卡片)
  --radius-lg:   16px    (cards, message bubbles)
  --radius-xl:   20px    (modals, dialogs)
  --radius-2xl:  24px    (bottom sheets, 大型 overlay)
  --radius-full: 9999px  (pills, circular buttons, avatars)
```

### Shadows (深色背景優化)

在深色背景上，陰影需要更高不透明度才能可見。使用 elevation 概念區分層次。

```
  --shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.3)
  --shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.4),
                 0 2px 4px -2px rgba(0, 0, 0, 0.3)
  --shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.5),
                 0 4px 6px -4px rgba(0, 0, 0, 0.4)
  --shadow-xl:   0 20px 25px -5px rgba(0, 0, 0, 0.6),
                 0 8px 10px -6px rgba(0, 0, 0, 0.5)

  /* Focus ring glow effects */
  --shadow-glow:         0 0 0 3px rgba(59, 130, 246, 0.3)   (accent focus)
  --shadow-glow-success: 0 0 0 3px rgba(34, 197, 94, 0.3)    (success focus)
  --shadow-glow-danger:  0 0 0 3px rgba(239, 68, 68, 0.3)    (danger focus)
```

### Spacing Scale

```
  --space-1:   4px
  --space-2:   8px
  --space-3:   12px
  --space-4:   16px
  --space-5:   20px
  --space-6:   24px
  --space-8:   32px
  --space-10:  40px
  --space-12:  48px
  --space-16:  64px

Component Spacing Guidelines:
  - Page padding: 16px (mobile), 24px (tablet)
  - Card padding: 16px
  - Message bubble padding: 12px 16px
  - Section gap: 24px
  - List item gap: 12px
  - Button padding: 12px 20px
  - Input padding: 12px 16px
```

### Touch Targets

所有可點擊元素需符合 Apple HIG 最小觸控尺寸：

```
  最小觸控區域: 44px × 44px
  建議按鈕高度: 48px
  Icon button 尺寸: 44px × 44px
  底部導航項目高度: 64px (含 safe area)
```

## 元件樣式指南

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--accent);           /* #3b82f6 */
  color: #ffffff;
  border-radius: var(--radius-md);     /* 12px */
  padding: 12px 20px;
  font-weight: var(--font-medium);     /* 500 */
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: var(--accent-hover);     /* #60a5fa */
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Secondary Button */
.btn-secondary {
  background: var(--bg-tertiary);      /* #121212 */
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 20px;
}
.btn-secondary:hover {
  background: var(--bg-elevated);      /* #1a1a1a */
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  padding: 12px 20px;
}
.btn-ghost:hover {
  background: var(--bg-tertiary);
}

/* Danger Button */
.btn-danger {
  background: var(--danger);           /* #ef4444 */
  color: #ffffff;
  border-radius: var(--radius-md);
  padding: 12px 20px;
}

/* Icon Button (circular) */
.btn-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon:hover {
  background: var(--bg-elevated);
}
```

### Input Fields

```css
/* Text Input */
.input {
  background: var(--bg-surface);       /* #1e1e1e */
  border: 1px solid var(--border);     /* #27272a */
  border-radius: var(--radius-md);     /* 12px */
  padding: 12px 16px;
  color: var(--text-primary);
  min-height: 48px;
  transition: all 0.2s ease;
}
.input::placeholder {
  color: var(--text-muted);            /* #52525b */
}
.input:focus {
  border-color: var(--border-focus);   /* #3b82f6 */
  box-shadow: var(--shadow-glow);
  outline: none;
}

/* Large Text Area (Chat input) */
.textarea-chat {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);     /* 16px */
  padding: 16px;
  min-height: 56px;
  max-height: 200px;
  resize: none;
}
```

### Cards

```css
/* Standard Card */
.card {
  background: var(--bg-secondary);     /* #0a0a0a */
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);     /* 16px */
  padding: 16px;
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}
.card:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-focus);
}

/* Active Card (selected workspace) */
.card.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}
```

### Message Bubbles

```css
/* AI Message (左對齊) */
.message-ai {
  background: var(--bg-secondary);     /* #0a0a0a */
  border: 1px solid var(--border);
  border-radius: 4px 16px 16px 16px;   /* 左上角尖，模擬對話尾巴 */
  padding: 12px 16px;
  max-width: 85%;
  box-shadow: var(--shadow-sm);
}

/* User Message (右對齊) */
.message-user {
  background: var(--accent-muted);     /* #1e3a5f */
  border-radius: 16px 16px 4px 16px;   /* 右下角尖 */
  padding: 12px 16px;
  max-width: 85%;
}

/* Code Block (inside message) */
.code-block {
  background: #000000;                 /* 真黑 */
  border: 1px solid var(--border);
  border-radius: var(--radius-md);     /* 12px */
  padding: 12px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  overflow-x: auto;
}
```

### Bottom Sheet / Modal

```css
/* Bottom Sheet */
.bottom-sheet {
  background: var(--bg-elevated);      /* #1a1a1a */
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;  /* 24px top corners */
  padding: 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-xl);
}
.bottom-sheet-handle {
  width: 48px;
  height: 4px;
  background: var(--border);
  border-radius: var(--radius-full);
  margin: 0 auto 16px;
}
.bottom-sheet-backdrop {
  background: rgba(0, 0, 0, 0.8);
}

/* Modal */
.modal {
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);     /* 20px */
  padding: 24px;
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: calc(100% - 32px);
}
```

### Navigation

```css
/* Bottom Navigation Bar */
.bottom-nav {
  background: var(--bg-secondary);     /* #0a0a0a */
  border-top: 1px solid var(--border);
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 8px 0;
  padding-bottom: env(safe-area-inset-bottom);
}

/* Nav Item */
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.nav-item-icon {
  font-size: 24px;
  color: var(--text-secondary);
}
.nav-item-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.nav-item.active .nav-item-icon,
.nav-item.active .nav-item-label {
  color: var(--accent);
}

/* Badge */
.badge {
  background: var(--danger);
  color: #ffffff;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  min-width: 18px;
  text-align: center;
}

/* Header */
.header {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  height: 56px;
  padding: 0 16px;
}
```

## 手勢操作

| 手勢 | 位置 | 動作 |
|------|------|------|
| 長按 | Message bubble | 複製文字 / 引用回覆 選單 |
| 左滑 | Diff file | 下一個檔案 |
| 右滑 | Diff file | 上一個檔案 |
| 下拉 | 任何 page 頂部 | 刷新資料 |
| 長按 | 🎤 語音按鈕 | 持續錄音（放開送出） |
| 長按 | Template pill | 編輯 / 刪除 template |
| 點擊 | Workspace card | 切換為 active workspace |

## 響應式斷點

這是 mobile-first 的應用，但也要能在 tablet 上用：

```
Mobile:  < 640px   → 單欄 layout（預設）
Tablet:  640-1024px → Chat + Diff 並排（可選）
Desktop: > 1024px   → 建議使用 code-server，不需要 Vibe Remote
```

## PWA Manifest

```json
{
  "name": "Vibe Remote",
  "short_name": "Vibe",
  "description": "Mobile-first agentic coding gateway",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#000000",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
    {"src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
```

## 無障礙 (A11y)

- 所有按鈕有 `aria-label`
- Diff 顏色不只靠紅綠，行前加 `+` `-` 符號
- Voice input 有視覺回饋（波形動畫）
- Toast 通知用 `aria-live="polite"`
- Focus management：modal 打開時 trap focus
