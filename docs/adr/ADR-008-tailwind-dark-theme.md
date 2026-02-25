# [ADR-008]: Tailwind CSS v4 + 深色主題優先

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Mobile-first PWA 需要高效的 styling 方案。通勤場景（低光環境）優先考慮深色主題。需支援 safe area（notch/home indicator）。

---

## 評估選項（Options Considered）

### 選項 A：Tailwind CSS v4（utility-first）

- **優點**：快速迭代；無 CSS-in-JS runtime overhead；原生 CSS custom properties 支援主題
- **缺點**：HTML 中大量 class name；初學者不直覺
- **風險**：v4 為較新版本，生態尚在追趕

### 選項 B：styled-components / Emotion

- **優點**：CSS-in-JS 動態主題切換
- **缺點**：runtime overhead；bundle size 增加；PWA 離線快取較複雜
- **風險**：SSR hydration 問題（雖本專案非 SSR）

### 選項 C：CSS Modules

- **優點**：標準 CSS；scope 隔離
- **缺點**：無 utility 系統；需更多 CSS 檔案
- **風險**：開發速度較慢

---

## 決策（Decision）

選擇 **選項 A**：Tailwind CSS v4 + CSS custom properties 定義深色主題色系。

主題色定義（`globals.css`）：
- Background 層級：`--bg-primary` (#000) → `--bg-secondary` (#18181b) → `--bg-tertiary` (#27272a) → `--bg-elevated` (#1c1c1e)
- Text 層級：`--text-primary` (#e4e4e7) → `--text-secondary` (#a1a1aa) → `--text-muted` (#71717a)
- Accent：`--accent` (#3b82f6, blue-500)
- Safe area：`env(safe-area-inset-*)` 支援 iPhone notch

Layout 設計：
- `100dvh`（dynamic viewport height）避免 virtual keyboard 問題
- 三層垂直結構：WorkspaceTabs → Page Content → BottomNav

---

## 後果（Consequences）

**正面影響：**
- 深色主題在通勤場景（黑暗環境）減少眼睛疲勞
- CSS custom properties 未來可擴展為 light/dark 切換
- Safe area 支援確保 iPhone X 以上機型正常顯示

**負面影響 / 技術債：**
- 目前僅深色主題，無 light mode 切換
- Message bubble 使用 arbitrary values（`rounded-[4px_16px_16px_16px]`）可讀性較差

**後續追蹤：**
- [x] 深色主題 CSS variables 定義
- [x] Safe area support
- [ ] Light mode 主題（低優先）

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001
