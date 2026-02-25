# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Recursive workspace scan: `GET /api/workspaces/scan` now searches up to 5 levels deep for git repos (SPEC-011)
- 8 new environment variables for runtime configuration: `MAX_CONCURRENT_RUNNERS`, `MAX_TURNS_CHAT`, `MAX_TURNS_TASK`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `CORS_ORIGIN`, `TOOL_APPROVAL_TIMEOUT_MS`, `CONTEXT_HISTORY_COUNT` (SPEC-012)
- Client displays relative paths in Add Workspace modal for nested repos
- `.env.example` now documents all 25 configurable parameters

### Fixed
- Android PWA install: added PNG icons (192x192, 512x512, maskable variants) required by Android Chrome
- Removed service worker force-unregister script that prevented PWA installation

## [0.1.0] — 2026-02-22

### Added
- Phase 1 MVP: chat with AI, review diff, approve, commit, push
- Phase 1.5: QR pairing API, system prompt per workspace, Docker single-container, prompt templates, badges, feedback
- Phase 2 (partial): task queue with auto-branch (SPEC-001), task dependencies (SPEC-002), diff comment AI feedback (SPEC-003), task runner WS streaming (SPEC-004), multi-model settings (SPEC-005), settings persistence (SPEC-006), task status WS client wiring (SPEC-007)
- Multi-workspace parallel development (up to 3 concurrent AI runners)
- ASP (AI-SOP-Protocol) integration for development governance

### Fixed
- Message deduplication for React StrictMode double-mount (SPEC-008)
- Runner timeout + abort mechanism (SPEC-009)
- Tool approval SDK integration (SPEC-010)
