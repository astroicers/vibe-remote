# [ADR-010]: PWA 實作（vite-plugin-pwa + Workbox）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 的核心使用情境是通勤時用手機操作。需要 app-like 體驗：加到主畫面、離線 shell 載入、push notification。需決定 PWA 實作方式。

---

## 評估選項（Options Considered）

### 選項 A：vite-plugin-pwa（Workbox + auto-generate SW）

- **優點**：自動產生 manifest + service worker；Workbox runtime caching 成熟
- **缺點**：Workbox 設定較複雜；SW 更新策略需注意
- **風險**：離線快取過期問題

### 選項 B：手動 Service Worker

- **優點**：完全控制
- **缺點**：大量 boilerplate；需自行處理 cache invalidation
- **風險**：容易出錯

### 選項 C：不做 PWA（純 web app）

- **優點**：無額外複雜度
- **缺點**：無法加到主畫面；無 push notification；無離線載入
- **風險**：UX 差（通勤地鐵無網路時白屏）

---

## 決策（Decision）

選擇 **選項 A**：vite-plugin-pwa + Workbox `generateSW` 模式。

PWA 設定：
- **Manifest**：name "Vibe Remote"、theme_color "#000000"、background_color "#000000"
- **Icons**：192x192 + 512x512 SVG（maskable）
- **Shortcuts**：New Chat、Review Diff
- **Runtime caching**：`/api/*` 使用 NetworkFirst 策略（1h TTL、max 50 entries）
- **SW 更新**：`registerType: 'autoUpdate'`（自動更新無需使用者確認）

---

## 後果（Consequences）

**正面影響：**
- 加到主畫面後 app-like 全螢幕體驗（standalone display mode）
- API 回應快取提升再次載入速度
- Push notification 支援（配合 web-push + VAPID）

**負面影響 / 技術債：**
- iOS 需 16.4+ 且「加到主畫面」才支援 push notification
- SW auto-update 可能在使用者操作中刷新（需注意 UX）
- 離線模式僅載入 shell，API 呼叫仍需網路

**後續追蹤：**
- [x] PWA manifest + service worker 產生
- [x] API runtime caching
- [ ] 完整離線模式（queue requests offline）

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001
