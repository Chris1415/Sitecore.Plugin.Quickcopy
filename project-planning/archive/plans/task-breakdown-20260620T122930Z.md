# Development Execution Plan

---
document_type: task_breakdown
artifact_name: task-breakdown-20260620T122930Z.md
generated_at: 2026-06-20T12:39:52Z
run_manifest: project-planning/workflow/run-20260620T122930Z.json
source_inputs:
  - project-planning/PRD/frd-001.md
  - project-planning/PRD/frd-minimal-001.md (Developer 08 orientation only; Lead Developer 06 used full FRD)
  - project-planning/ADR/adr-0006-live-url-composition-parallel-prefetch.md
  - project-planning/ADR/adr-0007-cache-invalidation-version-keyed.md
consumed_by:
  - QA Specialist (07) enriches this file; Developer (08) implements from this file + frd-minimal only
next_input:
  - N/A (minimal track — enriched task breakdown is the test contract; no standalone qa-report.md)
---

<!-- work_item_type: frd · scope_dial: light/minimal · task_breakdown_review: skip_gate -->

## 0. Quick orientation (absorbed from former implementation-runbook)

### Implementation target directory

- **Target:** `site/next-app/` — the existing Next.js App Router app at the product root. The debounce lands in `components/providers/marketplace.tsx`; the new test lands beside the existing prefetch test at `components/providers/marketplace.prefetch.test.tsx` (or a sibling `*.debounce.test.tsx`).
- **Container convention:** `site/next-app` already exists with committed source — use it. No scaffold step (this is an incremental refinement of an existing app, not a new app).

### Canonical inputs (Developer 08 normal flow loads ONLY these)

- **`frd-minimal-001.md`** — primary scope/orientation.
- **This task breakdown** — execution contract (§ 4c, tasks, tests, order).
- No POC clickdummy (no UI surface changes in this FRD — `ui_design.proposal_count: 0`).

**NOT loaded** in Developer normal flow: full FRD, raw ADR files (use § 4c-2 one-liners), architecture (none — minimal track).

### Planned delivery order

```
T001  (RED test — rapid pageInfo.id changes collapse to ONE settled prefetch trio; fails today)
T002  (GREEN — add the ~200 ms debounce around the existing prefetch effect; make T001 pass)
```

Single build tranche per FRD § 4a — no probe tranche needed (the one unknown, the prefetch call site, is confirmed by reading code: see § 4c-6).

### Actual delivery (updated by Developer 08 at /implement)

- **Executed in order:** T001 → T002, strictly sequential (TDD), single Developer pass.
- **T001 RED observed:** new debounce tests added to `components/providers/marketplace.prefetch.test.tsx`; "collapses rapid distinct id changes to ONE" failed with "called 3 times" and the unmount test failed (immediate call) — correct RED.
- **T002 GREEN:** added `const PREFETCH_DEBOUNCE_MS = 200;` and wrapped the existing `prefetchPageUrls(...)` dispatch in a trailing-edge `setTimeout` inside the existing cache-key effect, with `clearTimeout` in the effect cleanup. Cache-hit short-circuit, missing-input bails, and `requireContextId` try/catch all left in place and ordering preserved. `prefetchPageUrls`, cache keying, and invalidation untouched.
- **Files changed (site/):** `site/next-app/components/providers/marketplace.tsx`, `site/next-app/components/providers/marketplace.prefetch.test.tsx`. No new files, no new dependency (lean budget honored).
- **Gates:** full suite 179/179 pass (24 files); lint clean; `next build` (16.1.7) green; git-status clean in `site/` (only the two intended modifications).

### Completion criteria

- **Pre-completion validation gate** (per `06-implement.md` § 9): lint passes, build passes, git-status clean (or untracked files have explicit operator dispositions).
- **Smoke gate** (`platform_target: marketplace`): host-frame / real-tenant smoke recorded under manifest `smoke_outcomes`. Autonomous run cannot perform real-tenant smoke → recorded `deferred` (WARN); ship status `shipped_with_caveats`.
- **§ 9 TDD contract green** (`task_breakdown_style: tdd`): T001 RED before T002 GREEN; full suite green after.

## 1. Implementation Overview

Add a single debounce on `pageInfo.id` (and version/siteId) change before the three-slot URL prefetch trio fires in `MarketplaceProvider`. Today the prefetch effect (`marketplace.tsx` ~L181–212) runs synchronously on every cache-key change, so a marketer tabbing rapidly through N pages fires up to 3×N SDK calls for pages they pass over. The debounce defers the prefetch by a single named constant (default 200 ms), so only the page the user settles on issues its trio. The per-id cache (ADR-0007) is untouched — back/forward to an already-fetched id still resolves from cache with zero new calls.

## 2. Epics

- **E1 — Prefetch debounce** (the whole FRD; one epic).

## 3. Feature Breakdown

- **F1.1** — Named debounce constant (default ~200 ms), tunable in one place.
- **F1.2** — Debounced scheduling of the existing `prefetchPageUrls` call inside the existing cache-key effect; timer cleared/rescheduled on each cache-key change; cache-hit short-circuit preserved.

## 4. Task Breakdown

### T001 — RED test: rapid id changes collapse to one settled prefetch

- **Task ID:** T001
- **Title:** RED test asserting rapid `pageInfo.id` changes debounce to a single settled prefetch trio.
- **Description:** Add a test (fake timers) that drives several rapid `onSuccess` events with *distinct* `pageInfo.id`s within the debounce window through `MarketplaceProvider`, advances timers past the window once, and asserts `prefetchPageUrls` was called exactly **once** — for the last (settled) id. Mirror the existing harness in `marketplace.prefetch.test.tsx` (hoisted `prefetchSpy`, `captured.options.onSuccess(...)`, `SNAPSHOT(version, id)`). With no debounce in place today, each distinct id fires immediately → spy called N times → **test fails (RED)**.
- **Expected Output:** A failing test that, once the debounce lands, will assert the collapse-to-one behavior (and a companion assertion that the surviving call carries the LAST id, proving the settled page — not a transient one — is the one fetched).
- **Depends on:** none

### T002 — GREEN: add the ~200 ms debounce around the prefetch effect

- **Task ID:** T002
- **Title:** Debounce the prefetch trigger on cache-key change with a single named constant.
- **Description:** In `marketplace.tsx`, wrap the existing `prefetchPageUrls(...)` dispatch inside the cache-key effect in a `setTimeout` of `PREFETCH_DEBOUNCE_MS` (a single module-level named constant, default `200`). On each effect re-run (cache-key change), clear the pending timer (effect cleanup) and schedule a new one — standard trailing-edge debounce. Preserve EVERY existing guard in their current positions relative to the cache-key check: the `!client || !appContext` bail, the `!pageId || !siteId` bail, the `getEntry(key)` cache-hit short-circuit, and the `requireContextId` try/catch. The cache-hit short-circuit may run before scheduling (cheap, sync) so an already-fetched id never even schedules a timer. Do NOT change cache keying, cache invalidation, slot composition, or `prefetchPageUrls` itself.
- **Expected Output:** T001 passes; all existing tests in `marketplace.prefetch.test.tsx` still pass; full suite green; lint + build clean.
- **Depends on:** T001

## 4b. Important Test Cases (by epic / feature)

- **E1 — Prefetch debounce**
  - Rapid *distinct* id changes within the window → exactly one settled prefetch trio, for the LAST id (unit, RED→GREEN — T001). **The DoD-backbone test.**
  - Settled single page → prefetch still fires exactly once after the window (unit — covered by existing "calls prefetchPageUrls once on the first cache-key resolve" once it tolerates the timer).
  - Back/forward to an already-fetched id → cache hit → zero new prefetch calls (regression — existing "does NOT call … second time when the same cache-key re-fires (cache hit)").
  - Version bump (1→2) and id change each still trigger a fresh prefetch after the window (regression — existing version-bump + id-change tests).
  - Provider unmount mid-window → pending timer cleared, no stray prefetch after unmount, `clearAll()` still runs (unit — extends existing T015 unmount test).

## 4c. Implementation execution contract (for Developer 08)

### 4c-1. Non-negotiable technical boundaries

- The per-id cache stays intact — back/forward to an already-fetched id MUST NOT trigger a new network call. The `getEntry(key)` short-circuit (`marketplace.tsx` current L188) must remain. (FRD non-negotiable; ADR-0007.)
- No change to cache invalidation — version-keyed behavior (`buildCacheKey(pageId, version)`) is untouched. (ADR-0007.)
- A settled page must still resolve copy / live / share — no dropped fetches; `prefetchPageUrls` itself is NOT modified. (FRD non-negotiable.)
- Out of scope, do NOT touch: cache strategy, `/live`-slot TTL (that is TASK-002 / FRD-002), slot composition, share-link formats.
- **`architecture_budget: lean`** — the smallest change that satisfies the AC. A hand-rolled `setTimeout`/`clearTimeout` inside the existing effect is the expected shape. Do NOT add a new dependency, a generic `useDebounce` hook, or any abstraction — there is exactly one debounced call site (Rule of Three: no extraction until a second consumer exists).

### 4c-2. ADR one-liners (delta from baseline)

- ADR-0006: prefetch trio fires on `pageInfo.id` change via `Promise.allSettled`; click handlers are sync cache reads. The "Harder" section explicitly names "a debounce on `pageInfo.id` change (e.g. 200ms) is a low-risk follow-up" — **this FRD is that follow-up**. No ADR change; this is a consistent refinement.
- ADR-0007: cache keyed by `${pageId}:${version ?? 'noversion'}`, no TTL, no eviction, cleared on unmount. Untouched by this FRD.
- No new ADR (FRD § 6 — implementation refinement, not an ADR-worthy decision).

### 4c-3. Stack / tooling specifics

- Package manager: **npm** (no `packageManager` field; `package-lock.json` present).
- Test runner: **Vitest** (`npm run test` = `vitest run`); jsdom + Testing Library; setup at `vitest.setup.ts`.
- Build: `npm run build` (`next build`). Lint: `npm run lint` (`eslint`). Typecheck: `npm run typecheck` (`tsc --noEmit`).
- Run all three commands from `site/next-app/`.
- **Fake timers:** use `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync(...)` in the new test (Vitest). Restore real timers in `afterEach`. Because `setTimeout` is the debounce mechanism, the test controls the clock rather than waiting wall-clock time. Be careful interleaving fake timers with `@testing-library/react` `act()` / `waitFor` — prefer `await act(async () => { await vi.advanceTimersByTimeAsync(PREFETCH_DEBOUNCE_MS) })` to flush both the timer and the React effect/microtasks together.

### 4c-4. UI implementation notes

- **N/A** — no UI surface change. `ui_design.proposal_count: 0`. The debounce is invisible to markup; the only user-perceptible effect is fewer in-flight requests during rapid navigation and an imperceptible (~200 ms) delay before a settled page's trio starts.

### 4c-5. File / module structure and naming conventions

- Production change: `components/providers/marketplace.tsx` only. Add the constant near the top of the module (after imports), e.g. `const PREFETCH_DEBOUNCE_MS = 200;` with a one-line comment citing ADR-0006 / FRD-001.
- Test: extend `components/providers/marketplace.prefetch.test.tsx` with a new `describe`/`it`, OR add a co-located `components/providers/marketplace.debounce.test.tsx`. Either is acceptable; co-locating in the existing file keeps the shared harness DRY. Follow the existing `*.test.tsx` co-located convention.
- TypeScript-first; small functions; follow existing patterns (rule 10-language).

### 4c-6. Integration and API contract notes

- **Prefetch call site (FRD assumption — CONFIRMED by reading code):** the prefetch fires from a `useEffect` in `MarketplaceProvider` (`components/providers/marketplace.tsx`, currently L181–212) whose dependency array is `[client, appContext, pagesCtx?.pageInfo?.id, pagesCtx?.pageInfo?.version, pagesCtx?.siteInfo?.id]`. Inside it: bail on missing client/appContext → bail on missing pageId/siteId → `buildCacheKey` → `getEntry(key)` cache-hit bail → `requireContextId` try/catch → `void prefetchPageUrls(client, contextId, pageInfo, siteInfo)`. The assumption in FRD § 5 ("the prefetch currently fires from an effect/hook on `pageInfo.id`") is **true**. Wire the debounce here.
- No SDK request/response shape changes — `prefetchPageUrls` and its three `client.query(...)` calls are untouched. (No `40-sdk-contracts.mdc` surface touched.)
- The debounce is a trailing-edge timer: schedule on effect run, clear on effect cleanup (React re-runs the effect → cleanup fires → previous timer cleared → new timer scheduled). On the final settled cache-key the timer survives the window and fires the prefetch once.

### 4c-7. Parity / rebuild pointers

- **N/A — greenfield** (existing app; incremental refinement; `source.analysis_mode: greenfield`).

## 5. Dependencies

- **Ordering constraints:** T001 (RED test) must land and be observed failing before T002 (the fix) — TDD RED→GREEN.
- **Execution order:** T001, T002.
- **Tranches (probe-first):** Single build tranche (FRD § 4a). No 🔍 probe tranche — the only unknown (the prefetch call site) is confirmed by reading code (§ 4c-6), not by a runtime probe.
- **Parallel groups:** None — two tasks, strictly sequential (TDD). Fewer than 6 tasks → single sequential group.

## 6. Suggested Milestones

- **M1:** T001 RED observed → T002 GREEN → full suite + lint + build green. (One milestone — the whole FRD.)

## 7. Risk Areas

- **Fake-timer / React-effect interleaving** in the new test — the highest-friction part. The debounce is a `setTimeout` inside an effect that then dispatches an async `prefetchPageUrls`. Flushing the timer AND the resulting React state/microtasks needs `await act(async () => { await vi.advanceTimersByTimeAsync(...) })`. If the existing tests use real timers and only `waitFor`, confirm they still pass with the debounce (a ~200 ms trailing timer is well within `waitFor`'s default 1000 ms poll window, so real-timer tests should remain green without modification). If any existing test goes flaky, the minimal fix is to let it keep real timers and rely on `waitFor` — do NOT convert the whole file to fake timers.
- **Too-long debounce feels laggy** when the user settles (FRD § 7). Mitigation: default 200 ms, single named constant, tunable during smoke.
- **Stale-timer-after-unmount** — the unmount cleanup must clear the pending debounce timer so no prefetch fires into a torn-down provider. Covered by an unmount test case (§ 4b / § 10).

## 8. What Needs To Be Tested (global testing runbook)

- **Unit tests:** the debounce behavior (collapse-to-one for rapid distinct ids; surviving call carries the last id), the settled-single-page still-fires case, the cache-hit no-call regression, the version-bump / id-change fresh-fetch regressions, and the unmount-clears-timer case. All in `components/providers/marketplace.prefetch.test.tsx` (Vitest, jsdom).
- **UI / component tests:** N/A — no UI change. Existing component tests must remain green (regression).
- **E2E tests:** none in the repo. N/A.
- **Regression:** the FULL existing suite (baseline 24 files / 176 tests, all green pre-change) must stay green.
- **Test commands:** `npm run test` (vitest run), `npm run lint`, `npm run build`, `npm run typecheck` — all from `site/next-app/`.
- **Smoke gates:** `platform_target: marketplace` → host-frame / real-tenant smoke (panel inside Cloud Portal, observe far fewer SDK calls under rapid page-switching, settled page still resolves copy/live/share, ~200 ms feel acceptable). Requires a live tenant + host URL → **deferred** in autonomous runs; recorded in `smoke_outcomes` as `host_frame_smoke: deferred` (WARN). This is the single category that forces `shipped_with_caveats`.

## 9. TDD and quality contract

- **RED → GREEN → REFACTOR is mandatory** for the debounce. No production change to `marketplace.tsx` before T001 exists and is observed failing.
- T001 is the FRD's definition-of-done backbone test (FRD § 3.5 / § 3.1): rapid id changes collapse to one settled prefetch trio.
- Tests assert **behavior users care about** (call-count under rapid navigation; the settled id is the one fetched), not implementation details (do not assert on the timer handle).
- After GREEN: the full suite, lint, and build must all pass. `task_breakdown_style` is set to `tdd`.

## 10. Per-task test specifications

- **T001 — RED debounce test** (`marketplace.prefetch.test.tsx`, unit/integration, Vitest + Testing Library + fake timers):
  - **Scenario "rapid distinct ids collapse to one settled prefetch":** render `<MarketplaceProvider>`; `await waitFor` the captured subscription; with fake timers active, fire `onSuccess(SNAPSHOT(2, "page-A"))`, `onSuccess(SNAPSHOT(2, "page-B"))`, `onSuccess(SNAPSHOT(2, "page-C"))` in quick succession (each well within the window); advance timers once past `PREFETCH_DEBOUNCE_MS`; assert `prefetchSpy` called **exactly once**, and that the surviving call's `pageInfo.id` arg is `"page-C"` (the settled page). Expected outcome: FAILS today (3 immediate calls), PASSES after T002.
  - **Scenario "settled single page still fires once after the window":** fire one `onSuccess(SNAPSHOT(2))`, advance past the window, assert `prefetchSpy` called once with id `page-1`. (Guards the "no dropped fetch" non-negotiable.)
- **T002 — GREEN wiring** — no new test of its own; T001 + the existing prefetch tests are its contract. After T002, run the FULL suite to confirm the existing cache-hit / version-bump / id-change / unmount tests still pass (they assert the non-negotiables: cache preserved, fresh fetch on real change, unmount clears cache). If any existing test relies on the prefetch firing *synchronously*, adjust it minimally to advance/flush the debounce window (prefer keeping it on real timers + `waitFor` so it polls past the ~200 ms timer).
- **Unmount-clears-timer scenario** (extend, `marketplace.prefetch.test.tsx`, unit + fake timers): fire `onSuccess(SNAPSHOT(2))`, then `unmount()` BEFORE advancing past the window; advance timers; assert `prefetchSpy` was NOT called after unmount (pending timer was cleared) and `clearAll()` still ran (cache empty). Guards risk § 7 "stale-timer-after-unmount".

## 10a. Requirement-to-test evidence map

`work_item_type: frd` → one row per FRD acceptance criterion (§ 1.5 success criteria + § 3 authoritative).

| Requirement / AC | Task ID(s) | Test type | Test location / command | Coverage status |
|------------------|------------|-----------|-------------------------|-----------------|
| AC1 — Rapid switching across N pages issues ≪ 3×N calls; only the settled trio fires | T001, T002 | unit (fake timers) | `components/providers/marketplace.prefetch.test.tsx` → "collapses rapid distinct id changes to ONE settled prefetch (last id wins)" | covered |
| AC2 — Settled page resolves all three slots (copy/live/share) exactly as before | T002 | unit + regression | `marketplace.prefetch.test.tsx` "still fires exactly once for a settled single page"; full suite (prefetch.ts / cards unchanged, all green) | covered |
| AC3 — Back/forward to a previously-fetched id resolves from cache, zero new calls | T002 | regression | existing "does NOT call … second time when same cache-key re-fires (cache hit)" — still green | covered |
| AC4 — Debounce interval is a single named constant (default ~200 ms) | T002 | code inspection | `PREFETCH_DEBOUNCE_MS = 200` in `marketplace.tsx` | covered |
| AC5 — Existing suite stays green + new test asserts rapid-id collapse | T001, T002 | full suite | `npm run test` → 24 files / 179 tests pass (176 baseline + 3 new) | covered |
| AC (host-frame) — far fewer SDK calls under real rapid navigation; settled page resolves; ~200 ms feels acceptable | — | manual smoke (real tenant) | host-frame walkthrough in Cloud Portal | deferred (no live tenant in autonomous run; `smoke_outcomes.host_frame_smoke: deferred`) |

**Coverage status** legend per template: `pending` before implement; `covered` after a passing automated test; `manual-only` / `not applicable` / `deferred` with reason.

## Handoff Metadata
- Canonical run manifest: `project-planning/workflow/run-20260620T122930Z.json`
- Source FRD: `project-planning/PRD/frd-001.md` (+ `frd-minimal-001.md` for Developer 08)
- Source architecture: ADRs only — minimal track (ADR-0006, ADR-0007)
- Recommended next command: `/implement` (pipeline mode)
- Recommended next input file: N/A (no standalone qa-report.md on this minimal track)
