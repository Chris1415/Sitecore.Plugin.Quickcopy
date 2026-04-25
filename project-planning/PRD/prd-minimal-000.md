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

- **Scaffold = Marketplace Client-Side (Scaffold 2), nested `next-app/`, mirror pageshot.** Run `npx shadcn@latest add … quickstart-with-client-side-xmc.json` against `products/quickcopy/site`. Apply the P-019 lint nits + P-027 Nova Badge API patches + Vitest stack + Chrome PNA headers immediately after scaffold. **Mode A only** — portal-brokered auth, no Auth0, no mkcert, HTTP dev loop. (ADR-0005; companions: ADR-0001 ADR-backbone, ADR-0002 extension point, ADR-0003 Blok UI.)
- **Clipboard duplication is intentional** for v0.1 — local copy of pageshot's pattern. Cross-product consolidation deferred until rule-of-three (ADR-0004).
- **Live URL composition** = parallel pre-fetch on `pageInfo.id` change. Three calls fire in parallel via `Promise.allSettled`: `xmc.agent.pagesGetPagePreviewUrl`, the live-status equivalent, and `xmc.sites.listHosts`. Results land in an in-memory `Map<cacheKey, PageDerivedState>`. Click handlers are synchronous cache reads — no fetch on click. Live URL composed eagerly via `new URL(slug, host).toString()` when status=published AND host is a string. (ADR-0006.)
- **Cache key = `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`.** No TTL, no manual refresh affordance. Version bump after publish triggers automatic re-fetch and clears sticky error state. (ADR-0007 — supersedes the "or short-TTL" hedge in PRD R-007.)
- **Error state = persistent per-button, no auto-retry, no backoff, no retry button.** Failed pre-fetches and clipboard writes mark the cache slot as `Error`; button enters error state until cache key changes (id or version). `aria-disabled="true"` (focusable for tooltip), red accent + ❌ icon + tooltip per US wording. `console.error` logs failures in dev only. The other four buttons keep working independently. (ADR-0009.)
- **Keyboard shortcuts** = `Alt+L/P/I/T/S` provisional, named fallback `Ctrl+Alt+<letter>` if QA finds a conflict. Iframe-scoped listeners, suppressed when an editable element has focus, `event.preventDefault()` on every recognized combo. `Alt+S` triggers Share Link default format (Markdown), NOT the dropdown. Legend uses Blok `Kbd`. (ADR-0008.)
- **Share Link split-button** = composed from Blok `Button` + Blok `DropdownMenu` (Blok ships no native split-button primitive). Two real buttons in a `role="group"` wrapper — primary is Markdown action, caret IconButton with `aria-haspopup="menu"` opens the dropdown. Disabled / error states sync across both zones. Format strings exact per FR-005 (em-dash U+2014 with single space either side for plain text). (ADR-0010.)
- **Single tenant** per install (panel runs in `xmc:pages:contextpanel`, not standalone) — no multi-tenant logic in v0.1. `application.context.resourceAccess[]` has exactly one entry; use `requireContextId()` typed helper to read `resourceAccess[0].context.live` — never `as string` casts.

## Handoff

- **Full PRD:** `products/quickcopy/project-planning/PRD/prd-000.md` (for humans, architect, lead developer, QA — not loaded by Developer 08 in normal flow).
- **Executable contract:** `products/quickcopy/project-planning/plans/task-breakdown-<timestamp>.md` after QA (07) enrichment under `/task-breakdown`.
