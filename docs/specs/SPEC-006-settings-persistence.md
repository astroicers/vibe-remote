# SPEC-006：Settings Persistence

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-006 |
| **關聯 ADR** | — |
| **估算複雜度** | 低 |
| **建議模型** | Sonnet |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 將使用者的 app 設定（model、voice、projectsPath 等）持久化到 server 端，綁定至裝置（device），使設定在瀏覽器清除資料或重新配對後不會遺失，並支援跨裝置同步。

**現況問題：**
- `client/src/stores/settings.ts` 僅使用 zustand `persist` middleware 存入 `localStorage`（key: `vibe-remote-settings`）
- 使用者清除瀏覽器資料、重新配對裝置、或換裝置登入時，所有設定丟失
- `projectsPath` 尤其關鍵——沒有它，repo 掃描功能無法運作

---

## 輸入規格（Inputs）

### GET /api/settings

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| （無 query params） | — | — | 由 JWT 中的 `deviceId` 識別裝置 |

### PUT /api/settings

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| settings | `Record<string, string>` | HTTP Body (JSON) | 每個 key 長度 1-100，value 長度 0-2000，最多 50 個 key |

### PATCH /api/settings/:key

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| key | string | URL param | 長度 1-100，僅允許 `a-z`、`A-Z`、`0-9`、`_`、`-` |
| value | string | HTTP Body (JSON) | 長度 0-2000 |

### DELETE /api/settings/:key

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| key | string | URL param | 長度 1-100，僅允許 `a-z`、`A-Z`、`0-9`、`_`、`-` |

**已知 settings key 列表：**

| Key | 型別（JSON 序列化） | 預設值 | 說明 |
|-----|---------------------|--------|------|
| `model` | `"sonnet"` \| `"opus"` | `"sonnet"` | AI model 偏好 |
| `voiceEnabled` | `"true"` \| `"false"` | `"true"` | 語音輸入開關 |
| `voiceLanguage` | string（BCP 47 language tag） | `"en-US"` | 語音識別語言 |
| `autoCommitMsg` | `"true"` \| `"false"` | `"true"` | 自動產生 commit message |
| `projectsPath` | string（絕對路徑） | `""` | Projects 掃描根目錄 |

> 注意：所有 value 在 server 端皆以 `TEXT` 儲存。Client 負責型別轉換（boolean ↔ string）。

---

## 輸出規格（Expected Output）

### GET /api/settings — 成功
```json
{
  "settings": {
    "model": "sonnet",
    "voiceEnabled": "true",
    "voiceLanguage": "en-US",
    "autoCommitMsg": "true",
    "projectsPath": "/home/user/projects"
  }
}
```

### PUT /api/settings — 成功
```json
{
  "settings": {
    "model": "opus",
    "voiceEnabled": "true",
    "voiceLanguage": "zh-TW",
    "autoCommitMsg": "true",
    "projectsPath": "/home/user/projects"
  }
}
```

### PATCH /api/settings/:key — 成功
```json
{
  "key": "model",
  "value": "opus",
  "updated_at": "2026-02-22T10:30:00.000Z"
}
```

### DELETE /api/settings/:key — 成功
```json
{
  "success": true
}
```

### 失敗情境

| 錯誤類型 | HTTP Code | 回傳格式 |
|----------|-----------|----------|
| 未授權（無 token / token 無效） | 401 | `{ error: "...", code: "UNAUTHORIZED" }` |
| key 格式不合法 | 400 | `{ error: "Invalid setting key", code: "VALIDATION_ERROR" }` |
| value 過長 | 400 | `{ error: "Setting value too long", code: "VALIDATION_ERROR" }` |
| settings 數量超過限制 | 400 | `{ error: "Too many settings", code: "VALIDATION_ERROR" }` |

---

## 實作範圍

### 1. Server — DB schema：`server/src/db/schema.ts`

在 `SCHEMA` 字串中新增 `device_settings` table 與 index：

```sql
-- Device settings (per-device key-value preferences)
CREATE TABLE IF NOT EXISTS device_settings (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_id, key)
);

CREATE INDEX IF NOT EXISTS idx_device_settings_device ON device_settings(device_id);
```

> DB 使用 `CREATE TABLE IF NOT EXISTS`，無需 migration 機制——app 啟動時自動建立。

### 2. Server — 新增路由：`server/src/routes/settings.ts`

建立新的 Express Router，使用 `authMiddleware` 保護所有端點。

```typescript
// server/src/routes/settings.ts
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getDb } from '../db/index.js';

const router = Router();
router.use(authMiddleware);

// Zod schemas
const settingKeySchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const settingValueSchema = z.string().max(2000);
const bulkSettingsSchema = z.object({
  settings: z.record(settingKeySchema, settingValueSchema).refine(
    (obj) => Object.keys(obj).length <= 50,
    { message: 'Too many settings (max 50)' }
  ),
});

// GET /api/settings — 取得當前裝置所有設定
router.get('/', (req, res) => { /* ... */ });

// PUT /api/settings — 批量更新設定（upsert）
router.put('/', (req, res) => { /* ... */ });

// PATCH /api/settings/:key — 更新單一設定
router.patch('/:key', (req, res) => { /* ... */ });

// DELETE /api/settings/:key — 刪除單一設定
router.delete('/:key', (req, res) => { /* ... */ });

export default router;
```

**實作要點：**
- `GET /` — `SELECT key, value FROM device_settings WHERE device_id = ?`，回傳 `Record<string, string>`
- `PUT /` — 使用 `INSERT OR REPLACE INTO device_settings (device_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))` 搭配 `better-sqlite3` 的 transaction，批量 upsert 後回傳全部設定
- `PATCH /:key` — 單筆 `INSERT OR REPLACE`
- `DELETE /:key` — `DELETE FROM device_settings WHERE device_id = ? AND key = ?`
- `deviceId` 從 `req.device!.deviceId` 取得（由 `authMiddleware` 注入）

### 3. Server — 註冊路由：`server/src/routes/index.ts`

```typescript
import settingsRoutes from './settings.js';
// ...
router.use('/settings', settingsRoutes);
```

### 4. Client — API service：`client/src/services/api.ts`

新增 `settings` namespace：

```typescript
export const settings = {
  get: () =>
    request<{ settings: Record<string, string> }>('/settings'),

  update: (settings: Record<string, string>) =>
    request<{ settings: Record<string, string> }>('/settings', {
      method: 'PUT',
      json: { settings },
    }),

  updateOne: (key: string, value: string) =>
    request<{ key: string; value: string; updated_at: string }>(
      `/settings/${encodeURIComponent(key)}`,
      { method: 'PATCH', json: { value } }
    ),

  remove: (key: string) =>
    request<{ success: boolean }>(
      `/settings/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    ),
};
```

### 5. Client — Settings store 改造：`client/src/stores/settings.ts`

**新增 state 欄位：**
- `_serverSynced: boolean` — 是否已完成首次 server 同步
- `_syncError: string | null` — 最近一次同步失敗的原因

**新增 actions：**
- `loadFromServer()` — App 初始化時呼叫，從 server 取回設定並 merge（server wins）
- `_pushToServer(settings: Record<string, string>)` — 內部方法，debounced 500ms，將設定推送到 server

**修改現有 setter（`setModel`、`setVoiceEnabled` 等）：**
- 保留原本的 zustand `set()` 更新 localStorage
- 額外呼叫 `_pushToServer()` 將變更同步到 server（debounced）

**Merge 策略（`loadFromServer`）：**
1. 呼叫 `settings.get()` 取得 server 端設定
2. 若 server 端有值：覆蓋 localStorage 中的對應值（server wins）
3. 若 server 端無值但 localStorage 有值：將 localStorage 值推送到 server（首次遷移）
4. 設定 `_serverSynced = true`

**Debounce 實作：**
- 使用簡單的 `setTimeout` / `clearTimeout`（不引入新依賴）
- 500ms debounce window
- 累積多次變更後一次 `PUT /api/settings` 批量送出

**離線容錯：**
- 若 server 不可達，`_pushToServer` 靜默失敗並設定 `_syncError`
- localStorage 持續作為 primary cache，app 功能不受影響
- 下次 `loadFromServer()` 時會重新同步

### 6. Client — App 初始化觸發同步

在 `client/src/App.tsx`（或 auth 成功的回呼中）：
- 當 auth token 存在且有效時，呼叫 `useSettingsStore.getState().loadFromServer()`
- 確保只在認證成功後觸發，避免 401 錯誤

---

## 邊界條件（Edge Cases）

- **首次使用（server 無設定）**：`loadFromServer()` 從 server 取回空 map；localStorage 的現有值推送到 server 完成遷移
- **瀏覽器資料被清除後重新登入**：`loadFromServer()` 從 server 取回完整設定，覆蓋 zustand 預設值，使用者設定完全恢復
- **Server 不可達（離線或網路異常）**：`loadFromServer()` 靜默失敗，使用 localStorage 快取值；`_pushToServer()` 靜默失敗，設定 `_syncError`；下次連線時同步
- **快速連續變更設定**：Debounce 500ms 後批量送出，避免短時間大量 API 呼叫
- **裝置被撤銷（device revoked）**：`device_settings` 表設定 `ON DELETE CASCADE`，裝置刪除時設定自動清除
- **並發裝置同時修改同一設定**：Last-write-wins 語意（server 端 `INSERT OR REPLACE`），無衝突解決機制——此為個人工具，可接受
- **settings key 未知（未來擴展）**：Server 不驗證 key 是否在已知列表中，允許 client 自由儲存新 key（前向相容）
- **value 為空字串**：合法——空字串代表「已設定但值為空」，與「從未設定」（key 不存在）語意不同
- **`projectsPath` 含特殊字元**：value 儲存為 TEXT，不做路徑驗證（server 不關心路徑語意，僅存文字）

---

## 驗收標準（Done When）

- [ ] `npm --prefix server run test:run` 全數通過（含新增 settings 相關測試）
- [ ] `npm --prefix client run test:run` 全數通過
- [ ] `cd server && npx tsc --noEmit` 無錯誤
- [ ] `cd client && npx tsc --noEmit` 無錯誤
- [ ] `GET /api/settings` 回傳當前裝置的所有設定（已認證）
- [ ] `PUT /api/settings` 批量更新設定後回傳完整設定 map
- [ ] `PATCH /api/settings/:key` 更新單一設定
- [ ] `DELETE /api/settings/:key` 刪除單一設定
- [ ] 未認證的請求回傳 401
- [ ] `device_settings` 表在 app 啟動時自動建立（`CREATE TABLE IF NOT EXISTS`）
- [ ] Client 在認證成功後自動從 server 載入設定（server wins merge）
- [ ] Client 首次遷移：localStorage 有值但 server 無值時，自動推送至 server
- [ ] Client 設定變更後 500ms 內 debounce 推送至 server
- [ ] Server 不可達時，client 仍可正常使用 localStorage 中的設定
- [ ] 裝置撤銷後，`device_settings` 記錄自動清除（CASCADE）

---

## 禁止事項（Out of Scope）

- 不要實作：跨裝置即時同步推送（WebSocket broadcast）——下次 `loadFromServer()` 時自然同步即可
- 不要實作：設定版本衝突解決機制——last-write-wins 足夠
- 不要實作：設定加密——設定內容非敏感資料（無密碼、無 token）
- 不要實作：`system_prompt` 的設定同步——它是 per-workspace 設定，已由 `PATCH /api/workspaces/:id` 處理
- 不要引入新依賴：debounce 用原生 `setTimeout`，驗證用現有 `zod`
- 不要修改：`SettingsPage.tsx` 的 UI（本 SPEC 僅處理持久化管道，UI 不變）
- 不要修改：現有 `devices` table schema

---

## 參考資料（References）

- 現有實作：
  - `client/src/stores/settings.ts` — 當前 zustand persist store（localStorage only）
  - `client/src/services/api.ts` — REST API client（需新增 `settings` namespace）
  - `server/src/routes/index.ts` — 路由註冊入口
  - `server/src/db/schema.ts` — 現有 DB schema（需新增 `device_settings` table）
  - `server/src/auth/middleware.ts` — `authMiddleware`（`req.device.deviceId` 取得裝置 ID）
  - `server/src/auth/jwt.ts` — `JwtPayload` 結構（`deviceId`, `deviceName`）
- 設計文件：
  - `docs/ARCHITECTURE.md` — 系統架構
  - `docs/API_SPEC.md` — API 規格
  - `docs/DATABASE.md` — 資料模型
  - `docs/SECURITY.md` — 認證設計
