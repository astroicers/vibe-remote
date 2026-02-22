# SPEC-005：Multi-model Settings

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-005 |
| **關聯 ADR** | ADR-006（Claude Agent SDK） |
| **估算複雜度** | 低 |
| **建議模型** | Sonnet |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 讓使用者在 Settings 頁面選擇 AI 模型（Sonnet / Opus / Haiku），並確保選擇正確套用於 Chat 和 Task 執行。目前 client 硬編碼了兩組 model ID，且 task runner 完全不吃使用者選擇——本 SPEC 統一 model 對映為 server-side single source of truth，消除 client 端硬編碼，並補齊 task runner 的 model 支援。

---

## 輸入規格（Inputs）

### 1. `GET /api/models` — 取得可用模型列表

無 request body。

**Response:**
```json
{
  "models": [
    { "key": "haiku", "name": "Claude Haiku", "description": "Fastest, for simple tasks", "modelId": "claude-haiku-4-5-20251001" },
    { "key": "sonnet", "name": "Claude Sonnet", "description": "Fast, efficient for most tasks", "modelId": "claude-sonnet-4-20250514" },
    { "key": "opus", "name": "Claude Opus", "description": "Most capable, for complex tasks", "modelId": "claude-opus-4-20250514" }
  ],
  "default": "sonnet"
}
```

### 2. Chat WebSocket `chat_send` 訊息（既有）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| model | string \| undefined | WS message body | 必須是有效 model key（`haiku` / `sonnet` / `opus`），無效則 fallback 到 server default |

> 注意：目前 client 傳的是完整 model ID（如 `claude-opus-4-20250514`），改版後改傳 model key（如 `opus`）。

### 3. Task 建立（既有 `POST /api/tasks`，無新增欄位）

Task runner 改為讀取 request 時夾帶的 model key。為避免 API 變更過大，**Phase 1 task runner 直接從 `config.CLAUDE_MODEL` 讀取 server default**，不新增 API 欄位。Task 的 per-task model 選擇為 future scope。

---

## 輸出規格（Expected Output）

### `GET /api/models` 成功回應

```json
{
  "models": [
    { "key": "haiku", "name": "Claude Haiku", "description": "Fastest, for simple tasks", "modelId": "claude-haiku-4-5-20251001" },
    { "key": "sonnet", "name": "Claude Sonnet", "description": "Fast, efficient for most tasks", "modelId": "claude-sonnet-4-20250514" },
    { "key": "opus", "name": "Claude Opus", "description": "Most capable, for complex tasks", "modelId": "claude-opus-4-20250514" }
  ],
  "default": "sonnet"
}
```

### Chat 行為變更

| Before | After |
|--------|-------|
| Client `chat.ts` 硬編碼 `'claude-opus-4-20250514'` / `'claude-sonnet-4-20250514'` | Client 傳 model key（`'opus'` / `'sonnet'` / `'haiku'`） |
| Server `chat-handler.ts` 直接把 `data.model`（完整 ID）傳給 runner | Server 收到 model key 後透過 `resolveModelId()` 解析為完整 ID 再傳給 runner |

### Settings UI 變更

| Before | After |
|--------|-------|
| 兩個按鈕：Sonnet / Opus | 三個按鈕：Haiku / Sonnet / Opus（從 API 動態載入） |
| store type: `'sonnet' \| 'opus'` | store type: `string`（model key，預設 `'sonnet'`） |

**失敗情境：**

| 錯誤類型 | HTTP Code | 處理方式 |
|----------|-----------|----------|
| `GET /api/models` 失敗 | 500 | Client fallback 使用硬編碼的 3 模型列表 |
| WS 傳入不明 model key | N/A | Server log warning，fallback 到 `config.CLAUDE_MODEL` |

---

## 實作範圍

### 1. Server — `server/src/ai/models.ts`（NEW）

新增 model 對映常數和 helper：

```typescript
export interface ModelInfo {
  key: string;
  name: string;
  description: string;
  modelId: string;
}

export const MODELS: ModelInfo[] = [
  { key: 'haiku', name: 'Claude Haiku', description: 'Fastest, for simple tasks', modelId: 'claude-haiku-4-5-20251001' },
  { key: 'sonnet', name: 'Claude Sonnet', description: 'Fast, efficient for most tasks', modelId: 'claude-sonnet-4-20250514' },
  { key: 'opus', name: 'Claude Opus', description: 'Most capable, for complex tasks', modelId: 'claude-opus-4-20250514' },
];

export const DEFAULT_MODEL_KEY = 'sonnet';

/** 將 model key 或完整 model ID 解析為完整 model ID；找不到時回傳 config default */
export function resolveModelId(keyOrId?: string): string {
  if (!keyOrId) return config.CLAUDE_MODEL;
  // 先查 key
  const byKey = MODELS.find(m => m.key === keyOrId);
  if (byKey) return byKey.modelId;
  // 再查是否本身就是有效 model ID
  const byId = MODELS.find(m => m.modelId === keyOrId);
  if (byId) return byId.modelId;
  // Fallback: 如果是任意 model ID 字串（未列入清單），仍然放行
  // 這支援 CLAUDE_MODEL env 設定為非列表內模型的情境
  return keyOrId;
}
```

### 2. Server — `server/src/routes/models.ts`（NEW）

```typescript
import { Router } from 'express';
import { MODELS, DEFAULT_MODEL_KEY } from '../ai/models.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ models: MODELS, default: DEFAULT_MODEL_KEY });
});

export default router;
```

- 此端點 **不需要 auth middleware**（模型列表是公開資訊）
- 在 `server/src/routes/index.ts` 註冊 `router.use('/models', modelRoutes);`

### 3. Server — `server/src/ws/chat-handler.ts`

修改 chat message 處理邏輯：

```diff
+ import { resolveModelId } from '../ai/models.js';

  // 在 handleChatMessage 中，呼叫 runner.run() 之前
- model: data.model,
+ model: resolveModelId(data.model),
```

### 4. Server — `server/src/ai/claude-sdk.ts`

`ClaudeSdkRunner.run()` 和 `runSimplePrompt()` 中使用 `resolveModelId`：

```diff
+ import { resolveModelId } from './models.js';

  // ClaudeSdkRunner.run()
  const sdkOptions: Options = {
-   model: options.model || config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
+   model: resolveModelId(options.model),
    ...
  };

  // runSimplePrompt()
  const sdkOptions: Options = {
-   model: config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
+   model: resolveModelId(),
    ...
  };
```

### 5. Server — `server/src/tasks/runner.ts`

不新增欄位，但確保用 `resolveModelId` 走統一路徑：

```diff
+ import { resolveModelId } from '../ai/models.js';

  const response = await runner.run(prompt, {
    workspacePath: workspace.path,
    systemPrompt: workspace.systemPrompt || undefined,
    permissionMode: 'bypassPermissions',
    maxTurns: 30,
+   model: resolveModelId(),  // 使用 server default
  });
```

### 6. Client — `client/src/services/api.ts`

新增 models API：

```typescript
// Models API
export interface ModelInfo {
  key: string;
  name: string;
  description: string;
  modelId: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string;
}

export const models = {
  list: () => request<ModelsResponse>('/models'),
};
```

### 7. Client — `client/src/stores/settings.ts`

```diff
  interface SettingsState {
-   model: 'sonnet' | 'opus';
+   model: string;  // model key, e.g. 'sonnet', 'opus', 'haiku'
    ...
-   setModel: (model: 'sonnet' | 'opus') => void;
+   setModel: (model: string) => void;
    ...
  }
```

預設值維持 `'sonnet'`。既有 localStorage 資料中的 `'sonnet'` / `'opus'` 值與新格式相容，無需 migration。

### 8. Client — `client/src/stores/chat.ts`

移除硬編碼的 model ID 對映：

```diff
  const modelSetting = useSettingsStore.getState().model;
- const modelId = modelSetting === 'opus'
-   ? 'claude-opus-4-20250514'
-   : 'claude-sonnet-4-20250514';
- sendChatMessage(content, workspaceId, wsChat.currentConversationId || undefined, selectedFiles, modelId);
+ // 直接傳 model key，由 server 解析為完整 model ID
+ sendChatMessage(content, workspaceId, wsChat.currentConversationId || undefined, selectedFiles, modelSetting);
```

### 9. Client — `client/src/pages/SettingsPage.tsx`

- 在 component mount 時呼叫 `models.list()` 取得可用模型列表
- 若 API 失敗，使用 hardcoded fallback：`[{ key: 'haiku', ... }, { key: 'sonnet', ... }, { key: 'opus', ... }]`
- 將現有兩個 model 選擇按鈕替換為 `.map()` 動態渲染
- 每個按鈕根據 `model.key` 顯示不同 icon：
  - haiku：閃電 icon（speed）
  - sonnet：閃電 icon（現有）
  - opus：星星 icon（現有）
- 選中狀態邏輯不變（比較 `settings.model === model.key`）

---

## 邊界條件（Edge Cases）

- **既有 localStorage 資料**：`'sonnet'` / `'opus'` 值與新型別 `string` 相容，無需 migration。若 localStorage 有不認識的值（極端情況），仍會當作 model key 傳給 server，server 會 fallback
- **`GET /api/models` 失敗或超時**：Client 使用 hardcoded fallback 列表，UI 正常顯示 3 個選項
- **WS 傳入完整 model ID 而非 key（向後相容）**：`resolveModelId()` 同時檢查 key 和 modelId，兩種格式都能解析。這確保若有其他 client 仍傳完整 ID 也不會壞
- **`CLAUDE_MODEL` env 設為非列表模型**：`resolveModelId()` 在找不到匹配時直接回傳原字串，允許使用自訂模型 ID
- **Server 無 CLAUDE_MODEL env**：`config.ts` 已有 default `'claude-sonnet-4-20250514'`，`resolveModelId()` 呼叫 `config.CLAUDE_MODEL` 永遠有值
- **並行 chat 使用不同模型**：每次 WS message 攜帶獨立 model key，各 runner 各自解析，互不影響
- **Model ID 版本更新**：只需修改 `server/src/ai/models.ts` 中的 `MODELS` 陣列，所有 client 自動生效（透過 API）

---

## 驗收標準（Done When）

- [ ] `npm --prefix server run test:run` 全數通過（含新增 `models.ts` 的 `resolveModelId` 單元測試）
- [ ] `npm --prefix client run test:run` 全數通過
- [ ] `cd server && npx tsc --noEmit` 無錯誤
- [ ] `cd client && npx tsc --noEmit` 無錯誤
- [ ] `GET /api/models` 回傳 3 個模型的 JSON（haiku、sonnet、opus）
- [ ] Settings 頁面顯示 3 個模型選項（Haiku、Sonnet、Opus）
- [ ] 選擇 Haiku 後在 Chat 發送訊息，WS message 的 `model` 欄位為 `'haiku'`
- [ ] Server chat-handler 收到 `'haiku'` 後解析為 `'claude-haiku-4-5-20251001'` 傳給 SDK runner
- [ ] `client/src/stores/chat.ts` 不再包含任何硬編碼的 model ID 字串
- [ ] Task runner 使用 `resolveModelId()` 取得 model（從 server config default）
- [ ] 舊版 localStorage（含 `model: 'sonnet'`）升級後 Settings 顯示正常

---

## 禁止事項（Out of Scope）

- 不要實作：per-workspace model override（未來功能，需 DB schema 變更）
- 不要實作：per-task model selection（需新增 API 欄位，留待 Phase 3）
- 不要實作：model cost 顯示或 token 預算控制
- 不要修改：DB schema（本功能純設定層，無 DB 欄位需求）
- 不要引入新依賴：使用現有 Express route + fetch 機制即可
- 不要修改：`config.ts` 的 `CLAUDE_MODEL` env 變數定義（維持為 fallback default）

---

## 參考資料（References）

- 相關 ADR：ADR-006（Claude Agent SDK 技術選型）
- 現有實作：
  - `server/src/ai/claude-sdk.ts` — 當前 model 選擇邏輯（`options.model || config.CLAUDE_MODEL || hardcoded`）
  - `server/src/ws/chat-handler.ts` L541 — 已將 `data.model` 傳給 runner
  - `server/src/tasks/runner.ts` L69 — 未傳 model 參數（使用 SDK default）
  - `client/src/stores/chat.ts` L342-345 — 硬編碼 model ID 對映
  - `client/src/stores/settings.ts` — `model: 'sonnet' | 'opus'` 定義
  - `client/src/pages/SettingsPage.tsx` L320-367 — 兩按鈕 model 選擇 UI
  - `client/src/services/websocket.ts` L163 — `sendChatMessage()` 已支援 model 參數
- WS schema：`chatMessageSchema` 已含 `model: z.string().optional()`（`chat-handler.ts` L31）
