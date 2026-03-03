# SPEC-016：UX 體驗改善

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-016 |
| **關聯 ADR** | 無 |
| **估算複雜度** | 中 |
| **建議模型** | Opus |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 新增 scroll-to-bottom 按鈕、Skeleton loaders、Error retry 機制、修正 DiffPage 標題排版、SettingsPage 段落分隔、ReposPage Modal 溢出。

---

## 🔗 副作用與連動（Side Effects）

| 本功能的狀態變動 | 受影響的既有功能 | 預期行為 |
|-----------------|----------------|---------|
| 無跨模組影響 | — | 僅修改 UI 元件（scroll、skeleton、retry） |

### 回退方案（Rollback Plan）

- **回退方式**：revert commit
- **不可逆評估**：無不可逆變更，純 UI 修改
- **資料影響**：無

---

## 驗收標準（Done When）

- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `npm --prefix client run test:run` 全數通過
- [x] MessageList 向上捲動時出現 scroll-to-bottom 按鈕
- [x] ChatInput toolbar 不在窄螢幕斷行 (flex-nowrap)
- [x] Loading 狀態使用 Skeleton 而非 "Loading..." 文字
- [x] DiffPage/ReposPage/TasksPage error 有 Retry 按鈕
- [x] DiffPage 檔案標題為兩行排版
- [x] SettingsPage 各段有視覺分隔
- [x] ReposPage Modal Close 按鈕不被捲走

---

## 禁止事項（Out of Scope）

- 不修改 server 端
- 不修改路由結構
- 不修改資料 store 邏輯
