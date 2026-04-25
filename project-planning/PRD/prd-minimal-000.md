# PRD Minimal (execution orientation)

---
document_type: prd_minimal
artifact_name: prd-minimal-000.md
pairs_with_prd: products/quickcopy/project-planning/PRD/prd-000.md
generated_at: 2026-04-25T00:00:00Z
run_manifest: products/quickcopy/project-planning/workflow/run-20260424T193446Z.json
consumed_by:
  - Developer (08) under `/implement`
purpose: |
  Condensed north-star for QuickCopy implementation. The Developer reads this plus the
  enriched task breakdown only — not the full PRD or architecture doc.
---

## Problem (one short paragraph)

Marketers in the Sitecore Pages editor share page references (URLs, page titles, Item IDs) into Slack/Teams/Jira/email all day, and the data already exists in `pages.context` plus one Agent-API call — but there is no one-click surface for it. QuickCopy is a Page Context Panel app with five copy buttons that eliminates the URL hunt and "find the Item ID" friction.

## Goal (one short paragraph)

Ship a Marketplace Page Context Panel app that puts Live URL, Preview URL, Item ID, Page Title, and a Markdown/Plain-text Share Link on five buttons — Blok UI, dark-mode default, keyboard-shortcut accessible, with honest disabled/error states. Five buttons. No more, no less.

## Non-negotiables (bullets)

- Extension point: **`xmc:pages:contextpanel`** only (ADR-0002).
- UI framework: **Blok** — no ad-hoc Tailwind, no custom design tokens (ADR-0003).
- Five buttons exactly: Live URL, Preview URL, Item ID, Page Title, Share Link (split-button: Markdown default, dropdown for Plain text).
- Dark mode is the default theme; light mode is full-fidelity, persisted in iframe-scoped localStorage under `quickcopy.theme`.
- Success feedback = **in-place button morph** "Copied!" for **exactly 1500ms**. **No toast notifications.**
- Failure feedback = **persistent error state** until `pages.context.pageInfo.id` changes. **No auto-retry, no backoff, no manual retry button** in v0.1.
- Live URL button is **disabled** with an explanatory tooltip when `GET /api/v1/pages/{id}/live` reports unpublished.
- Preview URL always uses the authoritative Agent API `GET /api/v1/pages/{id}/preview-url` — never `pageInfo.url`.
- Multi-site / multi-language ambiguity is resolved **silently** using current `pages.context` site + language. No picker UI.
- Keyboard shortcuts default to `Alt+L/P/I/T/S` with a **visible legend** at the bottom of the panel. Conflict check + final scheme is an architect deliverable; if changed, gets an ADR.
- Clipboard module = **local copy** of pageshot's pattern at `site/lib/clipboard.ts`. **No pageshot refactor.** No shared package (ADR-0004).
- **Zero telemetry, zero analytics, zero third-party scripts** in v0.1.
- WCAG AA contrast in both themes; full keyboard operability; ARIA on disabled and split-button.

## In scope / out of scope (very short)

- **In scope:**
  - The five buttons + theme switcher + shortcut legend.
  - `pages.context` subscription, parallel pre-fetch of `/preview-url` and `/live` on page change, in-memory cache keyed by `pageInfo.id` (+ `pageInfo.version` if available, see R-007).
  - Live URL composition via `/live` + `/sites/{siteId}/hosts` + `pageInfo.url` slug (architect picks call graph).
  - Share Link split-button: primary = Markdown, dropdown also offers Plain text.
  - Persistent per-button error state on API or clipboard failure.
  - Accessibility (WCAG AA, keyboard, ARIA, screen reader smoke).
  - English UI only; strings isolated for future localization.

- **Out of scope:**
  - Item Path / Template ID / Template Name / Version / Site Name / Language code buttons.
  - Multi-site or multi-language pickers.
  - Telemetry, analytics, usage counters.
  - Toast notifications.
  - Auto-retry / retry button / backoff for failed API calls.
  - Refactor of pageshot's clipboard code.
  - Shared utilities package across Marketplace apps.
  - Localization of UI chrome.
  - Dashboard widget / standalone / full-screen variants.
  - Edit, publish, or unpublish actions.
  - Onboarding wizard / feature tour.
  - Smart-paste-target detection.

## Success criteria (3–7 bullets)

- All five buttons copy the correct value in both published and unpublished page scenarios, in both themes.
- Live URL button is disabled with the correct tooltip on unpublished pages; not silently broken.
- Persistent error state appears on every failed API or clipboard call and clears only when `pageInfo.id` changes (or panel reload).
- Keyboard navigation reaches every interactive control (5 buttons + theme switcher + split-button caret + dropdown items) in a coherent tab order.
- Theme preference persists across panel reloads.
- Clipboard works in Chrome and Edge on Windows; Safari and Firefox validated manually before ship.
- Bundle ≤150KB gzipped (target NFR-008).

## Key constraints & assumptions

- **Scaffold pattern follows `products/pageshot/`** — Marketplace App, NOT Content SDK / head-app. Read pageshot before locking the scaffold (architect step). (ADR-0001 generic decisioning principle; ADR-0002 extension point; ADR-0003 UI framework.)
- **Clipboard duplication is intentional** for v0.1 — local copy of pageshot's pattern. Cross-product consolidation deferred until rule-of-three (ADR-0004).
- **Live URL composition complexity** is absorbed inside v0.1 scope — there is no fallback plan to defer Live URL. Architect commits the call graph in an ADR.
- **Cache key:** `pageInfo.id` plus `pageInfo.version` if Pages exposes version on publish; else short-TTL on `/live` status. Architect decides (R-007).
- **Keyboard shortcut scheme** is `Alt+L/P/I/T/S` unless conflict check forces a change — that change is documented as an ADR.
- **Single tenant** per install (panel runs in `xmc:pages:contextpanel`, not standalone) — no multi-tenant logic in v0.1.

## Handoff

- **Full PRD:** `products/quickcopy/project-planning/PRD/prd-000.md` (for humans, architect, lead developer, QA — not loaded by Developer 08 in normal flow).
- **Executable contract:** `products/quickcopy/project-planning/plans/task-breakdown-<timestamp>.md` after QA (07) enrichment under `/task-breakdown`.
