# [ADR-007]: Monorepo 但不使用 npm workspaces

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

專案包含 `server/`、`client/`、`shared/` 三個子目錄。需決定如何管理多套件架構。

---

## 評估選項（Options Considered）

### 選項 A：Root concurrently + `npm --prefix`

- **優點**：各套件獨立 `node_modules`，互不干擾；指令簡單直覺
- **缺點**：共用依賴不 hoist（磁碟較大）；需分別 type check
- **風險**：shared types 需透過相對路徑引用

### 選項 B：npm workspaces

- **優點**：dependency hoisting 減少磁碟空間；workspace protocol 跨套件引用
- **缺點**：hoisting 可能造成幽靈依賴；lock file 衝突
- **風險**：better-sqlite3 native module hoisting 問題

### 選項 C：pnpm / Turborepo

- **優點**：更好的 workspace 管理；build cache
- **缺點**：額外工具學習成本；CI 需安裝 pnpm
- **風險**：過度工程化

---

## 決策（Decision）

選擇 **選項 A**：Root `package.json` 使用 `concurrently` 並行執行 `npm --prefix server` 和 `npm --prefix client`。

Shared types 透過 TypeScript `paths` alias 引用：`../../shared/types.ts`。

---

## 後果（Consequences）

**正面影響：**
- 零學習成本；任何 npm 使用者皆可上手
- 各套件完全獨立安裝、測試、建構
- 不受 hoisting 相關 bug 影響

**負面影響 / 技術債：**
- 共用依賴（如 zod）在 server 和 client 各安裝一份
- type check 需分別執行（`cd server && npx tsc --noEmit`）

**後續追蹤：**
- [x] Root dev script 使用 concurrently
- [x] shared/types.ts 透過相對路徑共用

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001
