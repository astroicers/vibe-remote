# SPEC-011：遞迴掃描 Workspace Git 專案

> 追溯規格書——修復已於當前 session 完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-011 |
| **關聯 ADR** | 無 |
| **估算複雜度** | 低 |
| **建議模型** | Sonnet |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 讓 `GET /api/workspaces/scan` 遞迴搜尋指定路徑下最多 5 層的子目錄，找出所有 Git 專案。解決使用者專案位於巢狀資料夾（如 `org/team/project`）時無法被掃描發現的問題。

---

## 輸入規格（Inputs）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| path | string | Query | 必填，目錄絕對路徑 |
| depth | int | Query | 選填，預設 5，範圍 1-10 |

---

## 輸出規格（Expected Output）

**成功情境：**
```json
[
  {
    "name": "project-a",
    "path": "/home/ubuntu/projects/project-a",
    "hasGit": true,
    "isRegistered": false
  },
  {
    "name": "project-b",
    "path": "/home/ubuntu/projects/org-name/project-b",
    "hasGit": true,
    "isRegistered": true
  }
]
```

**失敗情境：**

| 錯誤類型 | HTTP Code | 處理方式 |
|----------|-----------|----------|
| path 缺失 | 400 | MISSING_PATH |
| 路徑不存在 | 404 | PATH_NOT_FOUND |
| 掃描失敗 | 500 | SCAN_ERROR |

---

## 邊界條件（Edge Cases）

- Case 1：遇到無權限的目錄 → 靜默跳過，不中斷掃描
- Case 2：`node_modules` 目錄 → 跳過，避免效能問題
- Case 3：找到 `.git` 後不繼續往下（不掃描 git submodule）
- Case 4：隱藏目錄（`.` 開頭） → 跳過
- Case 5：達到 maxDepth → 停止遞迴

---

## 驗收標準（Done When）

- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `npm --prefix server run test:run` 全數通過（155 tests）
- [x] `npm --prefix client run test:run` 全數通過（139 tests）
- [x] Client modal 顯示相對路徑以區分巢狀專案

---

## 禁止事項（Out of Scope）

- 不修改 `ScannedRepo` interface schema
- 不修改 `workspace/manager.ts`
- 不新增 client 端 depth 參數控制

---

## 參考資料（References）

- 現有實作：`server/src/routes/workspaces.ts` GET /scan handler
- Client 顯示：`client/src/pages/ReposPage.tsx` Add Workspace modal
