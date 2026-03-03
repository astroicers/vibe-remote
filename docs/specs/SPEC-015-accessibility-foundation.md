# SPEC-015：無障礙基礎 (Accessibility Foundation)

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-015 |
| **關聯 ADR** | 無 |
| **估算複雜度** | 中 |
| **建議模型** | Opus |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 修正觸控目標不足 44px、ARIA labels 缺失、色彩對比度不足、動畫未尊重 reduced-motion、Modal/Sheet 缺少 focus trap 等無障礙基礎問題。

---

## 輸入規格（Inputs）

### 觸控目標 < 44px
- 多處 icon button 使用 `w-10 h-10` (40px) 或 `w-8 h-8` (32px)
- WCAG 2.5.8 要求最小觸控目標 44×44px

### ARIA Labels 缺失
- icon-only 按鈕缺少 `aria-label`
- BottomSheet/ConfirmDialog 缺少 `role="dialog"` / `aria-modal`
- Toast 缺少 `role="alert"`

### 色彩對比度
- `--text-muted: #52525b` 在 `#000` 背景上為 4.6:1，在 11px 字級邊界不足
- 建議提升至 `#71717a` (6.4:1)

### prefers-reduced-motion
- 所有 CSS 動畫未提供 reduced-motion 替代方案

### Focus Trap
- ConfirmDialog/BottomSheet 缺少 Tab 循環 focus trap

---

## 輸出規格（Expected Output）

- 所有 icon button ≥ 44×44px
- 所有 icon-only 按鈕有 `aria-label`
- Dialog/Sheet 有 `role`/`aria-modal`/focus trap
- `--text-muted` 對比度 ≥ 6:1
- `prefers-reduced-motion` 時動畫被抑制

---

## 邊界條件（Edge Cases）

- Focus trap 在 container 內無可聚焦元素時不應 crash
- `prefers-reduced-motion: reduce` 應保留 `0.01ms` 而非 `0ms`（避免 animationend 事件失效）

---

## 驗收標準（Done When）

- [ ] `cd client && npx tsc --noEmit` 無錯誤
- [ ] `npm --prefix client run test:run` 全數通過
- [ ] 所有 icon button ≥ w-11 h-11 (44px)
- [ ] 所有 icon-only 按鈕有 aria-label
- [ ] BottomSheet/ConfirmDialog 有 role + aria-modal + focus trap
- [ ] Toast 有 role="alert"
- [ ] `--text-muted` = `#71717a`
- [ ] globals.css 有 prefers-reduced-motion 規則
- [ ] 新增 useFocusTrap hook + 測試

---

## 禁止事項（Out of Scope）

- 不新增 light mode
- 不修改 layout 結構
- 不新增元件（僅修改既有元件 + 1 個 hook）

---

## 參考資料（References）

- WCAG 2.5.8 Target Size
- WCAG 1.4.3 Contrast (Minimum)
- WCAG 2.3.3 Animation from Interactions
