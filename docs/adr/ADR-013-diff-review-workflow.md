# [ADR-013]: Diff Review 工作流程設計

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 的核心流程是「對話 → diff review → approve → commit」。AI 修改檔案後，使用者需要在手機上 review 每個檔案的變更，決定接受或拒絕。需設計 diff review 的資料模型和互動流程。

---

## 評估選項（Options Considered）

### 選項 A：Per-File Approve/Reject + Status 狀態機

- **優點**：細粒度控制（可只接受部分檔案）；清晰狀態（pending → approved/rejected/partial）
- **缺點**：UI 複雜度較高；需追蹤每個檔案的決策
- **風險**：部分 approve 可能造成程式碼不一致

### 選項 B：All-or-Nothing（全部接受或全部拒絕）

- **優點**：UI 簡單；不會部分 commit
- **缺點**：一個 AI 生成的爛檔案就得全部重做
- **風險**：浪費 AI token

---

## 決策（Decision）

選擇 **選項 A**：Per-File Approve/Reject。

設計：
- **Diff parsing**：自訂 regex-based parser 解析 `git diff` 輸出，產出 `FileDiff[]`（含 hunks、insertions、deletions）
- **File actions**：`approve`（stage）/ `reject`（discard）per file
- **Review statuses**：`pending` → `approved`（全部 approve）/ `rejected`（全部 reject）/ `partial`（混合）
- **Comment thread**：可對 file + line_number 留言（audit trail）
- **File filter**：`.claude/`、`.vscode/`、`.idea/` 路徑自動過濾，不顯示在 review 中
- **Synthetic diffs**：未追蹤的新檔案也會產生 pseudo-diff 供 review
- **Binary detection**：null byte 偵測，binary 檔案顯示 "Binary files differ"

Storage：`files_json` TEXT 欄位存完整 `FileDiff[]` JSON（含 hunk 內容）。

---

## 後果（Consequences）

**正面影響：**
- 使用者可精確控制哪些 AI 變更要保留
- Comment thread 提供 feedback 記錄
- 自動過濾 IDE config 減少雜訊

**負面影響 / 技術債：**
- `files_json` 可能很大（大量 hunk 資料）
- Comment 尚未回饋至 AI 重新修改（feedback loop 未完成）
- Partial approve 可能造成程式碼編譯錯誤（使用者需自行判斷）

**後續追蹤：**
- [x] Per-file approve/reject
- [x] File filter（.claude/.vscode/.idea）
- [x] Comment API
- [ ] Comment → AI feedback loop（Phase 2）
- [ ] Diff 大小限制 / 分頁

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-003（AI 產生的變更）、ADR-006（diff event streaming）
