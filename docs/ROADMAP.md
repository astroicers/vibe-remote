# Roadmap — Vibe Remote

## Phase 1 — MVP：通勤時可以 Vibe Code

**目標**：能在手機上與 AI 對話、review diff、commit + push。

**總預估時間**：4-6 週

---

### Sprint 1.1 — 基礎骨架（Week 1）

**目標**：Project scaffold，server + client 可以啟動。

| Task | 驗收標準 |
|------|---------|
| 初始化 monorepo 結構 | `npm run dev` 可同時啟動 server + client |
| Server: Express + WebSocket server | `GET /api/health` return `{ status: "ok" }` |
| Client: React + Vite + Tailwind | 首頁顯示 "Vibe Remote" |
| Shared types 設定 | Server/Client 可 import `@shared/types` |
| SQLite 初始化 + migration runner | Server 啟動時自動建表 |
| .env + config 管理 | `config.ts` export 所有設定 |
| Docker + docker-compose | `docker compose up` 可啟動 |

**產出**：可啟動的空殼 app，所有基礎設施就位。

---

### Sprint 1.2 — Auth + Workspace（Week 2）

**目標**：手機可以安全連上 server，看到 workspace 列表。

| Task | 驗收標準 |
|------|---------|
| JWT 簽發/驗證/refresh | Token lifecycle 完整 |
| QR code pairing flow | 電腦顯示 QR → 手機掃碼 → 取得 token |
| Auth middleware | 未認證的 request 回 401 |
| Workspace CRUD API | 可註冊/列出/查詢 workspace |
| File tree API | 可取得 workspace 的目錄結構（filtered） |
| Git status API | 可看到 branch、uncommitted files |
| Client: Repos page | 手機上看到 workspace 卡片列表 |
| Client: Bottom navigation | 4 個 tab 可切換 |

**驗收場景**：
1. 在電腦上打開 /setup → 看到 QR code
2. 手機掃碼 → 進入 app
3. 看到已註冊的 workspace 列表
4. 每個 workspace 顯示 git status

---

### Sprint 1.3 — Chat 核心（Week 3）

**目標**：可以在手機上與 AI 對話，AI 可以讀寫 workspace 的檔案。

| Task | 驗收標準 |
|------|---------|
| Claude API 串接 (streaming) | AI 回覆逐字串流到 client |
| Context builder | System prompt 包含 project 結構 + git info |
| Tool definitions + executor | AI 可 file_read、file_write、file_edit、terminal_run、search_codebase |
| Tool 安全驗證 | 路徑穿越被阻擋、指令白名單生效 |
| Chat REST API (send, list, get, delete) | 對話 CRUD 完整 |
| WebSocket: ai_chunk event | Client 即時收到 AI streaming |
| 對話持久化 (SQLite) | 關閉重開可看到歷史對話 |
| Client: Chat page | 全螢幕對話、message bubbles、code highlight |
| Client: ChatInput | 文字輸入 + 送出 |
| Context file 選擇 | 可從 file tree 選擇要給 AI 的檔案 |

**驗收場景**：
1. 在手機上輸入「Add rate limiting to API gateway」
2. AI 回覆逐字顯示，包含 code blocks
3. AI 使用 tool 建立/修改檔案
4. 看到 AI 做了什麼（tool call details）
5. 回到電腦 → 檔案確實被修改了

---

### Sprint 1.4 — Diff Review（Week 4）

**目標**：可以在手機上 review AI 的改動、approve/reject。

| Task | 驗收標準 |
|------|---------|
| Diff API (get/approve/reject/approve-all) | Diff CRUD 完整 |
| AI 修改後自動產生 diff | Tool 修改檔案 → diff_ready event |
| Reject + comment → 回饋 AI | AI 收到回饋後重改 |
| Client: Diff page | Unified diff view，行號 + 紅綠色 |
| Client: File-by-file navigation | 左右滑動或 dots 切換 |
| Client: Approve/Reject/Comment buttons | 大按鈕，觸控友善 |
| Client: Approve All | 一鍵全部 approve |
| Diff review 狀態持久化 | SQLite diff_reviews 表 |

**驗收場景**：
1. AI 修改了 3 個檔案
2. 收到 diff_ready → Diff tab 顯示 badge (3)
3. 點進去 → 逐檔瀏覽 diff
4. Approve 2 個、Reject 1 個（附 comment）
5. AI 根據 comment 重改
6. 新 diff 推送 → review 新版本
7. 全部 approve

---

### Sprint 1.5 — Git Actions + Voice + PWA（Week 5-6）

**目標**：可以 commit + push、語音輸入、安裝為 PWA。

| Task | 驗收標準 |
|------|---------|
| Git commit API（含 AI 自動 message） | 一鍵 commit |
| Git push API | 一鍵 push |
| Git pull API | 一鍵 pull |
| Git branch API (create/switch) | 可切換/建立 branch |
| Create PR API (GitHub) | AI 產生 PR description |
| Discard changes API（二次確認） | 可還原改動 |
| Client: Quick Actions | Repos page 展開操作按鈕 |
| Client: Commit sheet | 全部 approved 後顯示 commit UI |
| Voice input (Web Speech API) | 🎤 按鈕 → 語音轉文字 → 輸入框 |
| Prompt templates | 水平捲動的快速 prompt 按鈕 |
| PWA manifest + service worker | 可「加到主畫面」 |
| Push notifications | Task/diff 完成時推送 |
| 連線狀態指示器 | 斷線顯示紅色條 |

**驗收場景（完整 flow）**：
1. 📱 打開 PWA（已安裝到桌面）
2. 🎤 語音輸入：「幫我在 auth service 加上 rate limiting」
3. AI 在背景工作
4. 📝 收到通知 → 看 diff → 逐檔 approve
5. 📦 一鍵 commit（AI 自動產生 message）
6. 🚀 一鍵 push
7. 💻 回到電腦 → git pull → 改動都在

---

## Phase 2 — Task Queue：非同步 Vibe Coding

**目標**：可以丟任務給 AI → AI 在背景做 → 你稍後 review。

**預估時間**：3-4 週

| Sprint | 內容 |
|--------|------|
| 2.1 | Task CRUD API + in-memory queue + 自動 branch |
| 2.2 | Task runner（AI 執行 task → 產生 diff → 更新狀態） |
| 2.3 | Task dependencies + batch create |
| 2.4 | Client: Tasks page (Kanban UI) + task create form |

**驗收場景**：
1. 早上通勤丟 3 個 tasks
2. AI 按順序/依賴執行
3. 每個 task 在獨立 branch
4. 晚上通勤 review → approve → commit
5. 回家 merge branches

---

## Phase 3 — 進階功能

**目標**：讓 Vibe Remote 成為完整的 mobile coding workflow。

**預估時間**：持續迭代

| Feature | Priority | 描述 |
|---------|----------|------|
| Multi-model | 高 | Settings 可切換 Sonnet/Opus |
| GitHub Issues → Tasks | 高 | 從 issue 一鍵建立 task |
| CI/CD status | 中 | 顯示 GitHub Actions 狀態 |
| PR review comments sync | 中 | GitHub PR comments 同步到 chat |
| Read-only terminal viewer | 中 | 手機上看 terminal output |
| Custom system prompt per workspace | 中 | 每個專案設定不同 AI 指令 |
| MCP server integration | 中 | 連接你的 security MCP tools |
| RAG over codebase | 低 | AI 索引 codebase 做 semantic search |
| Multi-repo dashboard | 低 | 一次看所有 repo 狀態 |
| Multi-user collaboration | 低 | 兩人共用 task queue |
| Offline mode | 低 | 離線時可 queue tasks（上線後送出） |

---

## Dogfooding 策略

### 里程碑 1：Chat + Diff（Sprint 1.3 + 1.4 完成後）

```
可以開始用 Vibe Remote 開發 Vibe Remote：
- 通勤時用手機 chat → review → （回家 commit）
- 記錄每次使用的 friction points
- 每週修 2-3 個 UX 問題
```

### 里程碑 2：Git Actions（Sprint 1.5 完成後）

```
完整的通勤 coding flow：
- chat → diff → approve → commit → push
- 不需要回到電腦就能完成簡單任務
- 開始紀錄每天在手機上完成的任務數
```

### 里程碑 3：Task Queue（Phase 2 完成後）

```
非同步工作流：
- 睡前丟 tasks → 早上通勤 review
- 週末在咖啡店用手機完成一整個 feature
- 統計每月透過手機完成的 commits
```

## 成功指標

| 指標 | MVP 目標 | Phase 2 目標 |
|------|---------|-------------|
| 每日手機 coding 時間 | 30 min | 60 min |
| 手機 → commit 平均時間 | < 10 min | < 5 min |
| AI 修改 first-time approve rate | 60% | 80% |
| 通勤利用率 | 50% | 80% |
| 每週手機 commits | 5 | 15 |
