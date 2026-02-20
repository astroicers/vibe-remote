# UI/UX Design — Vibe Remote

## 設計原則

1. **大拇指操作** — 所有主要操作在單手可及範圍內（螢幕下半部）
2. **Voice-first** — 打字是備選，語音輸入是主要輸入方式
3. **Glanceable** — 一眼就能看到狀態（幾個 task 完成？有沒有 pending review？）
4. **少步驟** — 每個 action 最多 2 次點擊
5. **OLED Dark 主題優先** — 使用真黑 (#000000) 背景最大化 OLED 省電，搭配降低對比度的文字減少眼睛疲勞

## 導航結構

```
多 Workspace 頁面結構:

┌──────────────────────────────────┐
│ [myproject ●] [api-server] [docs]│  ← workspace tabs（水平捲動，僅 >1 個 workspace 時顯示）
├──────────────────────────────────┤
│ (page content: Chat/Diff/Tasks)  │
├──────────────────────────────────┤
│  Chat  | Diff  | Tasks | Repos | Settings │  ← 底部導航（5 tabs）
└──────────────────────────────────┘

底部導航列（固定，5 tabs）:

┌─────────┬─────────┬─────────┬─────────┬──────────┐
│  Chat   │  Diff   │  Tasks  │  Repos  │ Settings │
│         │  (2)    │  (1)    │         │          │
└─────────┴─────────┴─────────┴─────────┴──────────┘

括號數字 = badge，表示需要注意的項目數
  - Diff badge: pending review 的檔案數
  - Tasks badge: awaiting_review 的 task 數
```

### Workspace Tabs（多 Workspace 切換）

- 位於頁面頂部，由 `AppLayout` 提供
- 僅當註冊超過 1 個 workspace 時顯示
- 水平捲動，自動捲動到選中的 tab
- 選中 tab 有 accent 色邊框和背景
- 每個 tab 顯示：
  - workspace 名稱（最大 100px 寬度，超出截斷）
  - AI 處理中動畫（黃色脈衝圓點）
  - 未讀訊息 badge（紅色圓圈數字）
- 切換 workspace tab 會改變 Chat/Diff/Tasks 頁面的內容
- 背景 workspace 可以有正在執行的 AI 處理

## Page 設計

### 1. Chat Page（預設首頁）

```
┌──────────────────────────────┐
│ [myproject ●] [api-server]   │  ← workspace tabs（由 AppLayout 提供）
├──────────────────────────────┤
│ myproject                 [+]│  ← header: workspace 名 | [+] 新增對話
│ New Conversation  ▼          │  ← sub: conversation title + 下拉箭頭
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ AI: I'll add rate      │  │  ← AI message bubble (左對齊)
│  │ limiting using          │  │
│  │ express-rate-limit...   │  │
│  │                         │  │
│  │ Modified 3 files        │  │  ← 點擊跳轉到 Diff Review
│  │ [Review Changes →]      │  │
│  └────────────────────────┘  │
│                              │
│       ┌──────────────────┐   │
│       │ Add rate limiting │   │  ← User message (右對齊)
│       │ to the API        │   │
│       │ gateway           │   │
│       └──────────────────┘   │
│                              │
│  ┌────────────────────────┐  │
│  │ Tool Approval          │  │  ← ToolApprovalCard
│  │ Write to config.ts     │  │
│  │ [Reject] [Approve]     │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ Token Usage             │  │  ← TokenUsageCard
│  │ In: 2.1K Out: 856      │  │
│  │ Cache: 1.2K Cost: $0.02│  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  ┌──────────────────────┐ QA │  ← 輸入區域
│  │ Type a message...     │   │     QA = Quick Actions（git 操作面板）
│  └──────────────────────┘ >>  │     >> = 送出
│                              │
├──────────────────────────────┤
│ Chat | Diff | Tasks | Repos | Settings │  ← 底部導航（5 tabs）
└──────────────────────────────┘
```

**Chat Page 互動細節**:

- **Header**:
  - 上方顯示 workspace 名稱，下方顯示當前 conversation title + 下拉箭頭
  - 點擊 header 左側區域 → 開啟 ConversationSelector BottomSheet
  - 右側 `[+]` 按鈕 → 新增對話（智慧判斷：若已存在未使用的 "New Conversation" 則直接選中，不重複建立）
  - **注意**：無漢堡選單、無 repos 導航按鈕（跨頁導航統一由 BottomNav 處理）

- **ConversationSelector BottomSheet**:
  - 頂部有 "New Conversation" 按鈕（同樣有智慧判斷）
  - 每個 conversation 條目顯示 title + 相對時間（如 "2h ago"）
  - 右側有刪除按鈕（trash icon）
  - **兩步驟刪除確認**：第一次點擊 → 行變紅 + 顯示 "Tap delete again to confirm" + Cancel/Delete 按鈕；第二次點擊 Delete → 實際刪除
  - 確認狀態下點擊行本身不會選中該對話（防誤觸）
  - 關閉 BottomSheet 會重置確認狀態
  - 選擇 conversation 後自動載入該對話的訊息

- **Message bubbles**:
  - AI message 底部如果有 file modifications → 顯示 "Review Changes" 連結
  - Tool call 區域預設收合，點擊展開看 AI 做了什麼

- **Tool Approval Cards**:
  - 當 AI 需要執行高風險操作時顯示
  - 顯示 tool 名稱、描述
  - Approve / Reject 按鈕

- **Token Usage Card**:
  - AI 回覆完成後顯示在訊息區域底部
  - 4 欄 grid 顯示：Input tokens、Output tokens、Cache tokens、Cost (USD)
  - 點擊 X 關閉

- **Quick Actions**:
  - 點擊 Quick Actions 按鈕 → 從底部滑出 Quick Actions 面板
  - 包含 Git 操作：Stage All、Commit、Push、Pull
  - 顯示 GitStatusCard（branch、staged/modified/new 統計）

- **No workspace 狀態**:
  - 如果沒有選擇 workspace，顯示空狀態 + "Add Workspace" 按鈕 → 跳轉到 Repos

### 2. Diff Review Page

```
┌──────────────────────────────┐
│ Diff Review                  │
│ 3 files changed  +45 -12  ▼ │  ← 點擊開啟檔案列表 BottomSheet
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
│  ┌──────┐ ┌───────┐ ┌───────┐ │  ← Action buttons（大按鈕，好按）
│  │Reject│ │Comment│ │Approve│ │
│  └──────┘ └───────┘ └───────┘ │
│                              │
│  [Approve All 3 Files]       │  ← 全部 approve 按鈕
│                              │
├──────────────────────────────┤
│ Chat | Diff | Tasks | Repos | Settings │
└──────────────────────────────┘
```

**Diff Page 互動細節**:

- **File 切換**: 左右滑動或點擊 indicator dots
- **Approve**: 點擊 Approve → 該檔案標記為 approved → 自動滑到下一個 pending 檔案
- **Reject**: 點擊 Reject → 彈出確認對話框 → revert 該檔案 → 記錄在 review history
- **Comment**: 點擊 Comment → 彈出文字輸入框（也支援語音）→ 回饋送回 AI → AI 重改 → 新 diff 推送
- **Approve All**: 全部 pending 檔案一鍵 approve → 啟用 commit 按鈕
- **All approved 後**:
  ```
  ┌─────────────────────────────┐
  │ All 3 files approved!        │
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

### 3. Tasks Page

```
┌──────────────────────────────┐
│ Tasks                    [+] │  ← [+] = 新增 Task（開啟 TaskCreateSheet）
├──────────────────────────────┤
│                              │
│ ┌ Queued ─────────────────┐  │  ← 垂直 Kanban 列（KanbanColumn 元件）
│ │ ┌──────────────────────┐│  │     每個 column 可收合
│ │ │ Create DB            ││  │     每張卡片為 TaskCard 元件
│ │ │ migrations           ││  │
│ │ │ Waiting: Task #1     ││  │  ← 顯示依賴狀態
│ │ │ Priority: Normal     ││  │
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
│ ┌ Running ────────────────┐  │
│ │ ┌──────────────────────┐│  │
│ │ │ Design RBAC model    ││  │
│ │ │ Started 3 min ago    ││  │  ← 進行中動畫
│ │ │ ██████████░░░ 70%    ││  │
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
│ ┌ Review (1) ─────────────┐  │
│ │ ┌──────────────────────┐│  │
│ │ │ Add rate limiting    ││  │
│ │ │ 3 files, +45 -12     ││  │
│ │ │ [Review ->]          ││  │  ← 點擊跳轉到 Diff
│ │ └──────────────────────┘│  │
│ └─────────────────────────┘  │
│                              │
├──────────────────────────────┤
│ Chat | Diff | Tasks | Repos | Settings │
└──────────────────────────────┘
```

**目前狀態**：Tasks 頁面已實作 Kanban UI，使用 KanbanColumn、TaskCard、TaskCreateSheet 元件。
Server 端 task manager、queue、runner 均已實作（server/src/tasks/）。
DB table `tasks` 已建立。

### 4. Repos Page

```
┌──────────────────────────────┐
│ Workspaces               [+] │  ← [+] = 註冊新 workspace
├──────────────────────────────┤
│                              │
│ ┌──────────────────────────┐ │
│ │ merak-platform  *        │ │  ← * = active workspace
│ │ main - 2 uncommitted     │ │
│ │ Last commit: 2h ago      │ │
│ │                           │ │
│ │ [Quick Actions          v]│ │  ← 展開顯示按鈕列
│ │  Test  Commit  Push       │ │
│ │  Pull  Branch  Lint       │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ security-mcp-server      │ │
│ │ main - clean              │ │
│ │ Last commit: 1d ago      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ vibe-remote               │ │
│ │ feat/chat-ui - 5 files   │ │
│ │ Last commit: 30m ago     │ │
│ └──────────────────────────┘ │
│                              │
├──────────────────────────────┤
│ Chat | Diff | Tasks | Repos | Settings │
└──────────────────────────────┘
```

**Quick Actions 互動**:
- 每個 action 點擊後顯示 loading spinner
- 完成後顯示 toast 通知（成功/失敗）
- Commit → 彈出 commit message 編輯（AI 預填）
- Push → 如果有 conflict 顯示警告
- Branch → 彈出 branch 列表 / 建立新 branch
- Discard → 二次確認對話框

### 5. Settings Page（從 BottomNav Settings 進入）

```
┌──────────────────────────────┐
│ Settings                     │  ← 純標題，無返回箭頭
├──────────────────────────────┤
│                              │
│ Connection                   │
│   Server: 100.x.y.z:3000    │
│   Status: Connected          │
│                              │
│ AI                            │
│   Model: Claude Sonnet 4     │
│   Max tokens: 4096           │
│                              │
│ Voice                        │
│   Language: Auto (中/EN)     │
│   Auto-send: [On]            │
│                              │
│ Notifications                │
│   Push: [Enabled]            │
│   Task complete: [On]        │
│   Test results: [On]         │
│                              │
│ Appearance                   │
│   Theme: [Dark]              │
│   Font size: [Medium]        │
│                              │
│ Devices                      │
│   iPhone 15 Pro (this)       │
│   [Revoke] [Add New Device]  │
│                              │
│ Advanced                     │
│   Export data                 │
│   Reset all settings         │
│                              │
└──────────────────────────────┘
```

## 元件階層

已實作的元件標記 [x]，未實作標記 [ ]。

```
App [x]
├── ToastContainer [x]                 # 全域 Toast 通知
└── Routes
    ├── AppLayout [x]                  # 統一 wrapper（WorkspaceTabs + BottomNav）
    │   ├── WorkspaceTabs [x]          # 橫向滾動 tab bar（>1 workspace 時顯示）
    │   ├── {children}                 # 頁面內容
    │   └── BottomNav [x]              # 底部 5-tab 導覽（Chat/Diff/Tasks/Repos/Settings）
    │
    ├── ChatPage [x]
    │   ├── Header [x]                 # workspace 名 + conversation title + [+] 新對話
    │   ├── ConversationSelector [x]   # BottomSheet 切換/刪除對話（兩步驟刪除確認）
    │   ├── MessageList [x]            # 可捲動的訊息列表
    │   │   └── MessageBubble [x]      # 單一訊息（含 markdown + code block）
    │   ├── ToolApprovalCard [x]       # AI tool use 審批
    │   ├── TokenUsageCard [x]         # Token 使用量顯示
    │   ├── ChatInput [x]              # 文字輸入 + 送出
    │   └── QuickActions [x]           # Git 操作 BottomSheet（Stage/Commit/Push/Pull）
    │
    ├── DiffPage [x]
    │   ├── Header [x]                 # 統計摘要（點擊開啟檔案列表 BottomSheet）
    │   ├── FileList BottomSheet [x]   # 檔案選擇
    │   ├── DiffViewer [x]             # Unified diff + Prism 語法高亮
    │   └── ReviewActions [x]          # Approve / Reject / Approve All
    │
    ├── TasksPage [x]
    │   ├── KanbanColumn [x]           # 垂直 Kanban 列（Queued/Running/Review/Done）
    │   ├── TaskCard [x]               # 單一 task 卡片
    │   └── TaskCreateSheet [x]        # 新增 task BottomSheet
    │
    ├── ReposPage [x]
    │   ├── Workspace 列表 [x]         # 卡片式 workspace 列表
    │   ├── 註冊 Modal [x]             # 路徑掃描 + 手動輸入
    │   └── QuickActions [x]           # Git 操作面板
    │
    └── SettingsPage [x]
        ├── AI Model 選擇 [x]          # Sonnet/Opus（localStorage）
        └── Push Notification toggle [x] # Web Push 訂閱/取消

通用元件:
    [x] StatusBar                      # 斷線狀態指示條
    [x] ConfirmDialog                  # 通用確認對話框
    [x] PullToRefresh                  # 下拉刷新手勢
    [x] EmptyState                     # 通用空狀態元件
    [x] BottomSheet                    # 滑出式面板
    [x] AttachButton (chat/AttachButton.tsx)          # 附加檔案按鈕
    [x] ContextFileSheet (chat/ContextFileSheet.tsx)  # 檔案選擇 BottomSheet
    [x] FileTree (chat/FileTree.tsx)                  # 檔案樹元件
    [x] PromptTemplateSheet (chat/PromptTemplateSheet.tsx)  # Prompt template 選擇
    [x] DiffCommentInput (diff/DiffCommentInput.tsx)  # Diff comment 輸入
    [x] DiffCommentList (diff/DiffCommentList.tsx)    # Diff comment 列表
    [x] BranchSelector (actions/BranchSelector.tsx)   # Branch 選擇器
    [x] TaskCard (tasks/TaskCard.tsx)                  # Task 卡片
    [x] KanbanColumn (tasks/KanbanColumn.tsx)          # Kanban 列
    [x] TaskCreateSheet (tasks/TaskCreateSheet.tsx)    # Task 建立表單
    [ ] VoiceButton                    # 語音輸入按鈕（hook 已建，UI 未完成）
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
| 長按 | Voice 按鈕 | 持續錄音（放開送出） |
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
