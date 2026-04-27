# Changelog

All notable changes to QuickCopy are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [PRD-000 cycle 2 — design-polish-1] — 2026-04-27

**Ship status:** `shipped` — real-tenant smoke passing for URL composition once the operator populates `targetHostname` per host record. See [`project-planning/plans/ship-report-20260427T124015Z.md`](project-planning/plans/ship-report-20260427T124015Z.md).

Follow-up shipment on top of the merged PRD-000 v0.1 (PR #1). Fixes the Live URL / Preview URL `Failed` state observed during real-tenant smoke (Dog Feeding App tenant) and lands the polish work that had been queued on `design-polish-1`.

### Fixed

- **Real-tenant URL fetch failures** — `lib/url-resolver/prefetch.ts` now parses Marketplace SDK responses using real types from `@sitecore-marketplace-sdk/xmc` instead of the inferred shapes used in v0.1. Removes the `as never` cast that was tracked as m-3 in the prior ship report.
- **Live URL card no longer reflects Preview URL errors** (and vice versa). Per-card error isolation per ADR-0006.

### Added

- **Operator prerequisite documented in `README.md`** — section "Backend prerequisite — `targetHostname`" walks the tenant administrator through populating `targetHostname` under **Sitecore XM Cloud → Sites → Hosts**. Without this, `xmc.sites.listHosts` returns placeholder values (e.g. `example.com`) and Live URL composition does not point at the real public site.
- **Multi-host fallback rule** — QuickCopy reads (never writes) `targetHostname`; picks the first host with a non-empty value; falls back to first non-empty `hostnames[]` entry if no host has `targetHostname`.
- **Diagnostic write-up** at `project-planning/plans/diagnostic-2026-04-26-real-tenant-url-failures.md` — root-cause analysis of the v0.1 real-tenant URL fetch failures.
- **Header screenshot** in README from a real Sitecore Pages session (Dog Feeding App tenant).

### Changed (polish)

- Compact one-line legend labels in the panel; long-form labels preserved for screen readers and in tests.
- Panel density refined; theme pill + legend chip layout.
- Share Link strip readable in dark mode; every state explicitly labeled.
- Monochrome U+2715 replaces colour-emoji X in card error state for theme-neutrality.

### Carried over (still open)

- OQ-003 / OQ-004 / OQ-005 — UX-writing pass on tooltip copy, theme switcher placement, legend visual treatment. Now that the panel renders correctly in a real tenant, these are unblocked.
- m-1, m-2, m-4, m-5, m-6 — minor findings from prior cycle remain open. m-3 (`as never` casts in `prefetch.ts`) **resolved** by the SDK-types refactor.
- Full nine-section `SMOKE_TEST.md` walkthrough remains advisory until a complete recorded smoke run.

## [PRD-000] — 2026-04-26

**Ship status:** `shipped_with_caveats` — code complete, all automated gates green; manual real-portal smoke (T037 install + T038 in-tenant verification) is the final ship gate before tagging a public release. See [`project-planning/plans/ship-report-20260426T000000Z.md`](project-planning/plans/ship-report-20260426T000000Z.md).

First version of QuickCopy.

### Added

- **Five copy buttons** — Live URL, Preview URL, Item ID, Page Title, and a Share Link split-button (Markdown default, dropdown for plain text)
- **Dark and light themes** — dark is the first-class default; the theme toggle persists the user's choice in iframe-scoped local storage under `quickcopy.theme`
- **Keyboard shortcuts** — `Alt+L / Alt+P / Alt+I / Alt+T / Alt+S` with a visible legend at the bottom of the panel; iframe-scoped listeners; suppressed when an editable element is focused; `Shift+Alt+<letter>` does not fire (cross-platform safety)
- **Persistent per-button error state** — failed API calls and clipboard rejections leave the affected button in a red `❌` state with an explanatory tooltip; the state clears only when the cache key changes (page navigation or version bump). No auto-retry, no backoff, no retry button
- **Honest disabled state** — Live URL is disabled with the tooltip "Not published to Edge yet — publish the page first" when the page has no published version
- **Item ID brace-stripping and trim** — `{ABC-123-DEF}` becomes `ABC-123-DEF`; whitespace-only IDs disable the button
- **Page Title fallback** — empty `displayName` falls back to `name`; both empty disables the button
- **Status live region** for success-only screen-reader announcements (errors are visual-only per ADR-0009)
- **Accessibility smoke** — `jest-axe` zero-violations in both themes; correct ARIA on the split-button (`role="group"`, `aria-haspopup="menu"`, `aria-expanded`, focus restoration on Escape)
- **Cloud Portal registration paste-sheet** at `site/next-app/PORTAL_REGISTRATION.md`
- **Manual real-portal smoke checklist** at `site/next-app/SMOKE_TEST.md`

### Architecture

- **Marketplace Client-Side scaffold** (Scaffold 2, mirror pageshot) at `site/next-app/`, Mode A portal-brokered auth (no Auth0, no PKCE)
- **Version-keyed in-memory cache** — `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`, no TTL, no manual refresh; publish bumps version and triggers automatic re-fetch + sticky-error clear
- **Parallel pre-fetch on page change** — `xmc.agent.pagesGetPagePreviewUrl`, `xmc.pages.retrievePage`, and `xmc.sites.listHosts` fire via `Promise.allSettled` so click handlers read resolved state synchronously
- **`useSyncExternalStore` cache subscription** so cache mutations trigger React re-renders (regression-pinned)
- **Blok semantic tokens only** — no raw hex outside `globals.css`; Geist Sans + Geist Mono via `next/font/google`
- **Local clipboard module** at `lib/clipboard.ts` (copy of pageshot's pattern, no shared package, no pageshot refactor)
- **Regression audit** at `lib/regression-audit.test.ts` — guards against `setTimeout`/retry leaks, `aria-live` on errors, `as string`/`as any` casts, and raw hex outside the token block

### Notes

- v0.1 ships pending **T037** (Cloud Portal registration in dogfood tenant) and **T038** (in-portal manual smoke). Both are documented at `site/next-app/SMOKE_TEST.md`.
- Six minor findings from `/test` are deferred to v0.2 (full detail in `project-planning/plans/test-report-20260426T000000Z.md`):
  - **m-1** — Item ID and Page Title cards key sticky errors on the trimmed copy value rather than the canonical page cache key
  - **m-2** — `prefetch.ts` uses `as never` casts on SDK request payloads; the regression audit allows them but the rule is broad
  - **m-3** — `<ShortcutLegend>` declares both `<ul>` and `role="list"` (redundant but harmless)
  - **m-4** — `useCopyAction` re-issues the clipboard write on rapid re-click during the 1500ms morph window (writes the same value)
  - **m-5** — no dedicated `<QuickCopyPanel>` integration test file; cross-component flows are covered piecewise plus T038 manual smoke
  - **m-6** — bundle-size NFR (≤150KB gzipped) is verified manually, not as a programmatic gate

### Test counts at this entry

- 24 test files, 172 cases (167 baseline + 5 added by the post-QA `Shift+Alt+<letter>` fix)
- Lint, typecheck, Vitest, and Next build all pass
