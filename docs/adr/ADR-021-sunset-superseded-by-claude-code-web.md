# ADR-021：專案退役 — 被第一方 Claude Code 網頁版取代（Sunset）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-06-10 |
| **決策者** | 專案維護者 |

---

## 背景（Context）

> Vibe Remote 的核心價值主張是「**手機 → AI 背景執行 → review diff → approve → commit**」這個迴圈（見 [README](../../README.md)、ADR-005 多 workspace 分割、ADR-013 diff review 工作流）。
>
> 2026/6 的事實查證確認：**Claude Code 網頁版（claude.ai/code，目前 research preview）已由 Anthropic 第一方商品化了這個迴圈**：
>
> - 寫 prompt → 連 GitHub repo → 在 **Anthropic 託管雲端 VM** 執行 → 產生 branch/PR
> - session 持久化（關瀏覽器仍續跑）、官方 **Claude iOS app** 監看/觸發
> - **Routines**：排程 / webhook / API 觸發的雲端自動化
> - 憑證隔離在 sandbox 之外（安全模型優於本專案的 `bypassPermissions` + 掛載 `~/.claude`）
> - 零維運、自動跟上最新 Claude Code 功能
>
> 本專案原本唯一的護城河是：**自架、直接對伺服器上「活的」本機工作目錄動作**（未 commit 變更、非 Git 專案、內網/不可外傳程式碼、本機正在跑的服務）。Claude 雲端版採「從 GitHub 做乾淨 clone in cloud」模型，**做不到對活的本機環境動作**——這是唯一的差異點。
>
> 然而維護者的實際情境讓這條護城河不成立：
> - **定位 = 個人/自用工具**（無產品或社群維護義務）
> - **驅動的程式碼大多在 GitHub repo**（正好是雲端版能完整覆蓋的情境）
> - **維護意願 = 傾向收掉**
>
> 在「核心迴圈已被第一方取代」且「唯一差異化對本使用者不適用」的前提下，繼續自架維護的投報率為負。

---

## 評估選項（Options Considered）

### 選項 A：繼續維護為產品/自架服務

- **優點**：完全掌控；保留既有功能
- **缺點**：與第一方產品正面競爭一個已被商品化的迴圈；需持續追上 Claude Code 演進、自行維護 sandbox 安全、Docker/Caddy/Tailscale footprint;個人用途投報率為負
- **風險**：半活的維護狀態——既無產品動能、又持續耗費心力

### 選項 B：優雅退役，遷移至第一方（claude.ai/code + Routines + iOS app）

- **優點**：零維運；更佳安全模型；自動跟上新功能；對「程式碼在 GitHub」的情境完整覆蓋。退役而非刪除 → 保留 21 篇 ADR、blog 素材、架構資產
- **缺點**：失去「對活的本機/非 Git 環境動作」能力（對本使用者不重要）；倚賴 research preview 的成熟度與 rate limit
- **風險**：低——退役前以 Step 0 試用作為 GO/NO-GO 閘門驗證官方方案接得住日常迴圈

### 選項 C：Pivot 到本機/團隊利基（自架版 Claude Code，對活環境動作）

- **優點**：守住雲端版做不到的差異點（本機/內網/air-gapped/未 commit 狀態、團隊合規）
- **缺點**：與本使用者實際情境（個人、GitHub）不匹配；需投入產品化心力
- **風險**：為一個自己用不到的差異化持續投入——錯置資源

---

## 決策（Decision）

> 我們選擇 **選項 B（優雅退役，遷移至第一方）**，因為：
>
> 1. **核心迴圈已被第一方取代**：claude.ai/code 完整覆蓋「手機 → 雲端執行 → PR」，且維護者程式碼大多在 GitHub
> 2. **唯一護城河對本使用者不成立**：對活的本機環境動作的能力，個人 + GitHub 情境用不到
> 3. **投報率**：個人自用工具不值得與第一方產品競爭一個商品化迴圈
> 4. **保值而非銷毀**：退役採「存檔 + 榨乾剩餘價值」，保留 ADR 決策史與 blog 素材
>
> **退役為決策層級的 Accepted；實際拆除服務（teardown）以 Step 0 遷移驗證為前置閘門**——先確認官方方案接得住日常迴圈，再停服務，避免衝動拆除。
>
> **未來重啟條件**：若維護者的程式碼移向本機/內網/air-gapped，或轉為團隊工具有合規需求 → 選項 C（pivot）重新成立，本 ADR 可被新 ADR 取代。

---

## 後果（Consequences）

**正面影響：**
- 卸下自架維護負擔（Docker / Caddy / Tailscale / sandbox 安全 / 追功能）
- 採用更佳安全模型（憑證不進 sandbox）與零維運
- ADR/blog/架構決策史完整保留，轉為作品集與回顧素材

**負面影響 / 技術債：**
- 失去對活的本機/非 Git 環境動作的能力（對本使用者影響極小）
- 倚賴 claude.ai/code research preview 的成熟度與共享 rate limit

**後續追蹤：**
- [ ] **Step 0（前置閘門）**：以真實 GitHub repo 任務試用官方三件組約 1 週，驗證手機→PR、diff review、通知/持久化、rate limit
- [ ] README 加 Sunset banner，指向 claude.ai/code 與本 ADR
- [ ] blog 文補「退役回顧」段落
- [ ] Step 0 通過後：`docker compose down`、`git tag` 封存、GitHub repo 設 Archived
- [ ] 安全：確認 `.env` 的 `CLAUDE_CODE_OAUTH_TOKEN` 從未進版控；停用後以 `claude setup-token` 撤換舊 token

---

## 成功指標（Success Metrics）

| 指標 | 目標值 | 驗證方式 | 檢查時間 |
|------|--------|----------|----------|
| 官方方案接手日常迴圈 | 手機→PR / diff / 通知 / rate limit 全數可接受 | Step 0 約 1 週實測清單 | 退役前 |
| 決策入帳 | 本 ADR 狀態 Accepted 且 README banner 正確顯示 | GitHub repo 頁面檢視 | 文件提交後 |
| 服務乾淨停止 | 無執行中容器、port/憑證釋出 | `docker compose ps` | teardown 後 |
| 無憑證外洩 | `.env` token 從未進版控、舊 token 已撤換 | `git log -p` / `git grep` | teardown 後 |
| 價值留存 | repo 設 Archived（唯讀可讀）、blog 回顧文已更新 | GitHub / blog 檢視 | 退役完成後 |

---

## 關聯（Relations）

- 取代：無（這是專案層級的退役決策）
- 被取代：無（未來若 pivot 至本機/團隊利基，可由新 ADR 取代本 ADR）
- 參考：ADR-003（Claude Agent SDK）、ADR-005（per-workspace 分割）、ADR-013（diff review 工作流）、ADR-014（Tailscale）、ADR-020（Caddy HTTPS）；外部：claude.ai/code（Claude Code on the web）、Claude Code Routines
