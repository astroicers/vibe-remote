# [ADR-015]: Zod 統一驗證（環境變數 + API 輸入）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

需要驗證環境變數（啟動時）和 API request body（每次請求）。需決定驗證策略和工具。

---

## 評估選項（Options Considered）

### 選項 A：Zod（全面採用）

- **優點**：TypeScript-first；schema 即型別（`z.infer<typeof schema>`）；啟動時 fail-fast；結構化錯誤訊息
- **缺點**：額外依賴（~50KB）
- **風險**：minor

### 選項 B：手動驗證（if/else + typeof）

- **優點**：零依賴
- **缺點**：大量 boilerplate；無型別推導
- **風險**：容易遺漏驗證

### 選項 C：Joi / Yup

- **優點**：成熟生態
- **缺點**：TypeScript 整合較差（非 TypeScript-first）
- **風險**：型別推導不精確

---

## 決策（Decision）

選擇 **選項 A**：Zod。

使用方式：
- **環境變數**（`config.ts`）：`envSchema.safeParse(process.env)` → 啟動失敗即 `process.exit(1)`
- **API request**（每個 route）：`schema.safeParse(req.body)` → 回傳 `{ error, code: 'VALIDATION_ERROR' }`
- **統一 error format**：`{ error: string, code: string, details?: unknown }`

---

## 後果（Consequences）

**正面影響：**
- 環境變數錯誤在啟動時即發現（非 runtime crash）
- API 輸入驗證與 TypeScript 型別完全一致
- 錯誤訊息結構化，方便 client 處理

**負面影響 / 技術債：**
- 每個 route 需定義 zod schema（少量 boilerplate）

**後續追蹤：**
- [x] 環境變數 zod schema
- [x] 所有 API route 使用 zod 驗證

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001
