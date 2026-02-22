# [ADR-001]: 初始技術棧選型

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 是一個 mobile-first PWA，讓工程師在通勤時用手機透過自然語言驅動 AI 完成 coding 任務。需要選定 Server、Client、Database、AI Engine 等核心技術棧。核心需求：低延遲 streaming、離線可用（PWA）、單人/小團隊使用、零外部服務依賴。

---

## 評估選項（Options Considered）

### 選項 A：Full-Stack JS Monorepo（Express + React + SQLite）

- **優點**：前後端共用 TypeScript；SQLite 零維護；Express 生態成熟
- **缺點**：SQLite 無法水平擴展
- **風險**：better-sqlite3 原生模組需 Docker build 環境

### 選項 B：Next.js + PostgreSQL + Prisma

- **優點**：SSR/SSG、ORM 方便、PostgreSQL 功能強
- **缺點**：需要獨立 DB 服務；SSR 對私有工具無意義（無 SEO）；Prisma 增加抽象層
- **風險**：過度工程化，維護成本高

### 選項 C：Go/Rust Backend + React Frontend

- **優點**：高效能、低記憶體
- **缺點**：前後端語言不同；Claude Agent SDK 僅支援 Node.js
- **風險**：無法使用 Agent SDK 內建工具

---

## 決策（Decision）

選擇 **選項 A**：Express.js + React 19 + SQLite + Tailwind CSS v4 + Zustand + Vite 6。

- **Server**: Node.js 22 + Express + express-ws + TypeScript strict
- **Client**: React 19 + Vite 6 + Tailwind CSS v4 + Zustand + React Router v7
- **Database**: SQLite via better-sqlite3（同步 API）
- **AI Engine**: Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）
- **Validation**: Zod（server + shared）

原因：個人/小團隊工具不需要分散式架構；Claude Agent SDK 僅支援 Node.js；SQLite 零維護且足夠快。

---

## 後果（Consequences）

**正面影響：**
- 前後端共用 TypeScript 型別（`shared/types.ts`）
- 零外部服務依賴（無 Redis、PostgreSQL、message queue）
- Docker 單容器部署即可運行

**負面影響 / 技術債：**
- better-sqlite3 需要 python3 + make + g++ 編譯環境（Docker build 較慢）
- SQLite 無法支援多實例水平擴展
- 同步 API 在極端高併發下可能阻塞 event loop（但實務上不會發生）

**後續追蹤：**
- [x] Phase 1 MVP 驗證技術棧可行性
- [ ] 若用戶數超過 5 人，評估是否遷移至 PostgreSQL

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-002（SQLite 選型細節）、ADR-003（Claude Agent SDK）
