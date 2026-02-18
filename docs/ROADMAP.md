# Roadmap — Vibe Remote

## Phase 1 — MVP：通勤時可以 Vibe Code ✅ 完成

**目標**：能在手機上與 AI 對話、review diff、commit + push。

**狀態**：✅ 全部完成（2026-02-18）

---

### Sprint 1.1 — 基礎骨架 ✅

| Task | 狀態 |
|------|------|
| 初始化 monorepo 結構 | ✅ |
| Server: Express + WebSocket server | ✅ |
| Client: React + Vite + Tailwind | ✅ |
| Shared types 設定 | ✅ |
| SQLite 初始化 + migration runner | ✅ |
| .env + config 管理 | ✅ |
| Docker + docker-compose | ✅ |

---

### Sprint 1.2 — Auth + Workspace ✅

| Task | 狀態 |
|------|------|
| JWT 簽發/驗證/refresh | ✅ |
| QR code pairing flow | ✅ |
| Auth middleware | ✅ |
| Workspace CRUD API | ✅ |
| File tree API | ✅ |
| Git status API | ✅ |
| Client: Repos page | ✅ |
| Client: Bottom navigation | ✅ |

---

### Sprint 1.3 — Chat 核心 ✅

| Task | 狀態 |
|------|------|
| Claude Agent SDK 串接 (streaming) | ✅ |
| Context builder（含 Token 優化） | ✅ |
| Session Resume 支援 | ✅ |
| Tool definitions + executor | ✅ |
| Tool 安全驗證 | ✅ |
| Chat REST API + WebSocket | ✅ |
| 對話持久化 (SQLite) | ✅ |
| Client: Chat page | ✅ |
| Client: ChatInput | ✅ |
| Context file 選擇 | ✅ |

**Token 優化措施**：
- Session Resume（減少 60-80% token）
- 訊息截斷（2000 字元 / 5 條歷史）
- 檔案大小限制（1MB）
- Context Builder 精簡（深度 2、commits 3）

---

### Sprint 1.4 — Diff Review ✅

| Task | 狀態 |
|------|------|
| Diff API (get/approve/reject/approve-all) | ✅ |
| AI 修改後自動產生 diff | ✅ |
| Reject + comment → 回饋 AI | ✅ |
| Client: Diff page | ✅ |
| Client: File-by-file navigation | ✅ |
| Client: Approve/Reject/Comment buttons | ✅ |
| Client: Approve All | ✅ |
| Diff review 狀態持久化 | ✅ |

---

### Sprint 1.5 — Git Actions + PWA ✅

| Task | 狀態 |
|------|------|
| Git commit API | ✅ |
| Git push API | ✅ |
| Git pull API | ✅ |
| Git branch API (create/switch) | ✅ |
| Discard changes API | ✅ |
| Client: Quick Actions | ✅ |
| Client: Commit sheet | ✅ |
| PWA manifest + service worker | ✅ |
| Push notifications | ✅ |
| 連線狀態指示器 | ✅ |

**暫緩項目**：
- Voice input (Web Speech API) — 需要更多 UX 設計
- Create PR API — Phase 3 再處理

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
