# Implementation Runbook

---
document_type: implementation_runbook
artifact_name: implementation-runbook-20260424T193446Z.md
generated_at: 2026-04-25T16:30:00Z
run_manifest: products/quickcopy/project-planning/workflow/run-20260424T193446Z.json
source_inputs:
  - products/quickcopy/project-planning/PRD/prd-minimal-000.md
  - products/quickcopy/project-planning/plans/task-breakdown-20260424T193446Z.md
  - products/quickcopy/pocs/poc-v2/ (visual source of truth)
consumed_by:
  - Engineering Team
next_input:
  - products/quickcopy/site/
---

## 1. Implementation Scope

QuickCopy v0.1 — a Sitecore Marketplace Page Context Panel app with five copy buttons (Live URL, Preview URL, Item ID, Page Title, Share Link split-button). Dark default + theme switcher, keyboard shortcuts, persistent error state, no telemetry. Built on the Marketplace Client-Side scaffold (Scaffold 2, mirror pageshot per ADR-0005), Blok semantic tokens + Geist fonts only (ADR-0003), Vitest + jest-axe for tests (TDD style per the QA-enriched task breakdown).

Total: 60 tasks (38 Lead Developer tasks split into 22 RED/GREEN `a/b` pairs by QA), 11 epics, 25 test files, 150 traceable test cases.

## 2. Canonical Inputs

The Developer (08) reads only:

- `products/quickcopy/project-planning/PRD/prd-minimal-000.md` — non-negotiables, scope, success criteria
- `products/quickcopy/project-planning/plans/task-breakdown-20260424T193446Z.md` — § 4c execution contract + per-task descriptions + per-task test specs (§ 10) + § 4b 150 test cases + § 5 execution order

May also open as visual reference (POC clickdummy is the canonical look-and-feel source):

- `products/quickcopy/pocs/poc-v2/index.html` + `styles.css` + `app.js`

The Developer does NOT load: full PRD, ADRs (their commitments are in § 4c-2), architecture (none on minimal track), rejected UI variants v1/v3/v4, brain-dump, source-analysis.

## 3. Target Directory Decision

**Implementation target:** `products/quickcopy/site/`

Rationale: PRD-minimal § Key constraints names `site/` as the implementation root. § 4c-3 of the task breakdown puts the scaffolded Next.js app at `products/quickcopy/site/next-app/` (Scaffold 2 nested layout per ADR-0005, mirroring pageshot). `site/` does not yet exist; the Phase 1 scaffold task creates it.

## 4. Planned Delivery Order

Per § 5 of the task breakdown, execution is **sequential** (TDD style — `task_breakdown_style: tdd` — explicitly disqualifies parallel groups per the implement command). The Team Lead orchestrates **four phases** of sequential work, each delivered by a focused Developer sub-agent, with lint + build verification between phases.

### Phase 1 — Foundation (E1-E4, T001-T016)
- E1 Scaffold & Bootstrap (T001-T008) — `npx shadcn@latest add … quickstart-with-client-side-xmc.json` per § 4c-3, P-019/P-027 patches, Vitest stack, Chrome PNA headers
- E2 Page Context Subscription (T009-T010, with `a/b` splits)
- E3 URL Resolution & Caching (T011-T015)
- E4 Clipboard local module (T016)

Verification: `npm run lint`, `npm run build`, `npm run test` (only the tests written in this phase) all pass.

### Phase 2 — Main UX (E5-E6, T017-T025)
- E5 Action Cards: Live, Preview, Item ID, Page Title (T017-T022)
- E6 Share Link Split-Button (T023-T025)

Verification: lint + build + test pass.

### Phase 3 — Additions (E7-E9, T026-T033)
- E7 Theme & Persistence (T026-T028)
- E8 Keyboard Shortcuts & Legend (T029-T031)
- E9 Error & Disabled States (T032-T033)

Verification: lint + build + test pass.

### Phase 4 — A11y & Ship Prep (E10-E11, T034-T038)
- E10 Accessibility & Polish (T034-T036) — including `jest-axe` smoke for WCAG AA
- E11 Ship Prep (T037-T038) — Cloud Portal registration values, manual real-portal smoke

Verification: full lint + build + test suite green.

## 5. Verification Checklist

Between every phase:
- [ ] `npm run lint` passes (or failures explicitly reported)
- [ ] `npm run build` passes
- [ ] `npm run test` passes for all tests written through this phase
- [ ] No regression in previously-completed epics

After Phase 4:
- [ ] All 60 tasks in § 5 Execution Order have implementations or are explicitly N/A (manual tasks)
- [ ] All 150 § 4b cases have a corresponding test or are explicitly noted as manual smoke
- [ ] `jest-axe` smoke runs zero violations in dark and light themes
- [ ] Bundle size within NFR-008 target (≤150KB gzipped client)
- [ ] Both POC parity check: visual sweep against `pocs/poc-v2/index.html`

## 6. Risks To Watch During Implementation

- **R-001 — Live URL composition.** Per ADR-0006, `xmc.pages.retrievePage` reading `publishing.{hasPublishableVersion,isPublishable}` is the chosen approximation for live status (no dedicated `pagesGetPageLive` SDK key). Watch for empty-host arrays from `xmc.sites.listHosts` — store `{ error: new Error('no live host') }` per § 4c-6.
- **R-002 — Keyboard shortcut conflicts.** ADR-0008 commits to `Alt+L/P/I/T/S` provisional. If Pages editor swallows any combo during the manual smoke (T038), swap to the named fallback `Ctrl+Alt+<letter>` and update ADR-0008 status note + this runbook + the prd-minimal.
- **R-003 — Clipboard in iframe.** Per ADR-0004, copy of pageshot's pattern. Watch for browsers where `navigator.clipboard.writeText` silently rejects — error state must surface persistently per ADR-0009.
- **R-004 — Blok split-button composition.** Per ADR-0010, compose from Button + DropdownMenu. Watch for ARIA semantics drift if Blok's DropdownMenu doesn't expose `aria-haspopup` on the trigger by default.
- **R-005 — Cache key on publish.** Per ADR-0007, version-keyed cache assumes Pages editor bumps `pageInfo.version` on publish. If observation shows it doesn't fire, adopt the documented short-TTL (30s) fallback as a v0.2 follow-up — do not silently switch in v0.1.

## 7. Completion Criteria

Implementation is complete when, on branch `prd-000`:

1. All 60 tasks in § 5 of the task breakdown have been executed (or marked N/A for manual smokes T037-T038).
2. Lint + build + Vitest + jest-axe all pass.
3. The app installs cleanly into a dogfood Sitecore tenant per ADR-0005 (manual smoke; T038).
4. All 12 mandated critical scenarios (per QA enrichment summary) have automated tests except T038's portal-only flows.
5. The implementation runbook has its actual execution sequence recorded in § 4 (Planned Delivery Order).
6. The run manifest's `implementation.status` is `completed` and `stage_history` has an `implemented` entry.

## 8. What Needs To Be Tested (global testing runbook)

The QA-enriched task breakdown is the test contract. Highlights:

- **Unit tests** (~46 cases) — `lib/cache/`, `lib/clipboard.ts`, `lib/share-link/`, `hooks/useTheme.ts`, `lib/require-context-id.ts`. Vitest, no framework rendering.
- **Component tests** (~85 cases) — `<MarketplaceProvider>`, `<MarketplaceProvider.prefetch>`, `<ActionCard>`, `<LiveCard>`, `<PreviewCard>`, `<ItemIdCard>`, `<TitleCard>`, `<ActionGrid>`, `<ShareLinkSplit>`, `<ThemeToggle>`, `useShortcuts` hook, `<ShortcutLegend>`, `<StatusLiveRegion>`. Vitest + `@testing-library/react`. SDK queries stubbed at the `mockClient` boundary.
- **Integration tests** (~11 cases) — `<QuickCopyPanel>` end-to-end with stubbed SDK Provider, covers cross-component state (cache invalidation on `pageInfo.version` bump, persistent error per ADR-0009, theme persistence).
- **A11y smoke** — `jest-axe` zero-violations in dark + light themes (B-148, B-149); plus 3 component-level ARIA assertions.
- **Regression / grep checks** (5) — no `setTimeout`/`setInterval` for retry, no `retry` keyword, no `aria-live` for errors per ADR-0009, no `as string` casts, no raw hex.
- **Manual E2E** (T037-T038, 7 portal scenarios) — Cloud Portal install, panel registration, both themes in real Sitecore Pages editor, all five buttons, disabled and error states, keyboard shortcut conflict-check.

**Test commands** (Vitest per ADR-0005 patches):
- `cd products/quickcopy/site/next-app && npm run test` — full Vitest suite
- `npm run test:watch` — TDD inner loop
- `npm run lint` — ESLint
- `npm run build` — Next.js build

## Handoff Metadata
- Canonical run manifest: `products/quickcopy/project-planning/workflow/run-20260424T193446Z.json`
- Implementation target directory: `products/quickcopy/site/`
- Recommended next command: `/code-review` after implementation completes
- Recommended next input file: `products/quickcopy/project-planning/plans/implementation-runbook-20260424T193446Z.md`
