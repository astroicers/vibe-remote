# [ADR-002]: 選用 SQLite + better-sqlite3 同步 API

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

專案需要持久化 workspaces、conversations、messages、diff reviews、tasks 等資料。需決定使用何種資料庫及存取方式。目標：零維護、單檔案、低延遲。

---

## 評估選項（Options Considered）

### 選項 A：SQLite + better-sqlite3（同步 API）

- **優點**：零設定、單檔案、同步 API 更簡單（無 callback/Promise 巢狀）、WAL 模式支援讀寫併發
- **缺點**：原生模組需編譯環境；無法多進程寫入
- **風險**：Docker 需要 build tools

### 選項 B：SQLite + sql.js / sqlite3（非同步 API）

- **優點**：非同步符合 Node.js 慣例
- **缺點**：SQLite 本身是本地磁碟操作，async wrapper 增加不必要的複雜度
- **風險**：Promise chain 增加程式碼複雜度

### 選項 C：PostgreSQL + Prisma

- **優點**：支援多連線、完整 SQL 功能、Prisma type-safe ORM
- **缺點**：需要獨立服務；維護 migration；個人工具 overkill
- **風險**：增加部署複雜度

---

## 決策（Decision）

選擇 **選項 A**：better-sqlite3 同步 API + WAL mode。

關鍵設計：
- WAL mode（`journal_mode = WAL`）允許讀寫併發
- Foreign keys 啟用 `ON DELETE CASCADE`，刪除 workspace 自動清理所有關聯資料
- Timestamps 使用 ISO 8601 TEXT（`datetime('now')`）
- 複雜結構（token_usage、tool_calls）存為 JSON TEXT 欄位
- 啟動時同步執行 `initDb()` + `runMigrations()`

---

## 後果（Consequences）

**正面影響：**
- 程式碼極度簡潔（`db.prepare(...).run(...)` 一行搞定）
- 無 connection pool、無 async/await 地獄
- 資料庫即單檔案，備份只需複製 `vibe-remote.db`

**負面影響 / 技術債：**
- Docker 需安裝 python3 + make + g++（better-sqlite3 是 C++ addon）
- 無法多進程寫入（但單進程 server 足夠）
- JSON 欄位無 DB 層 schema 驗證

**後續追蹤：**
- [x] WAL mode 已啟用
- [x] CASCADE delete 已覆蓋所有 FK
- [ ] Phase 2 評估是否需要 migration 框架

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001
