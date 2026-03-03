# SPEC-017：視覺打磨

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-017 |
| **關聯 ADR** | 無 |
| **估算複雜度** | 中 |
| **建議模型** | Opus |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 統一按鈕/卡片/badge 樣式系統、改善 code block 可讀性、統一 input focus 樣式。

---

## 🔗 副作用與連動（Side Effects）

| 本功能的狀態變動 | 受影響的既有功能 | 預期行為 |
|-----------------|----------------|---------|
| 無跨模組影響 | — | 僅修改 CSS 樣式和元件視覺 |

### 回退方案（Rollback Plan）

- **回退方式**：revert commit
- **不可逆評估**：無不可逆變更，純視覺修改
- **資料影響**：無

---

## 驗收標準（Done When）

- [ ] `cd client && npx tsc --noEmit` 無錯誤
- [ ] `npm --prefix client run test:run` 全數通過
- [ ] `.btn` 有 `min-h-[44px]`
- [ ] 新增 `.card-static` 樣式並套用於靜態卡片
- [ ] badge 系統有 `.badge-sm` / `.badge-accent` / `.badge-success` / `.badge-warning` variant
- [ ] Code block `text-[13px]` + `leading-relaxed` + 左側 accent 邊線
- [ ] ActionButton loading 時底部有 progress bar
- [ ] ChatInput textarea `focus:shadow-glow`
- [ ] BranchSelector input `min-h-[44px]` + `focus:shadow-glow`

---

## 禁止事項（Out of Scope）

- 不修改 server 端
- 不修改路由結構
- 不修改資料 store 邏輯
