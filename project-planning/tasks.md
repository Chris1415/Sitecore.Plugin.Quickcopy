# Tasks — QuickCopy

<!--
Intake queue for this product. One entry = one prospective pipeline run (bug / feature→FRD / prd).
Picked up via `/triage`. NOT the research `initiatives.md` (those are bets). NOT a granular subtask
list (those live in the task-breakdown after `/create-*`). Operator-editable; `/triage` updates
status / spawned_as in place. See `.agent/glossary.md` § "Intake queue".

Fields: id · type (bug|feature|prd) · status (todo→in_progress→done / blocked / wont_do) ·
priority (high|medium|low) · source (local|github#N) · created (YYYY-MM-DD) · spawned_as.
-->

## Open

### TASK-002 — TTL fallback on the /live slot for invisible publish flows
- **type:** feature · **status:** todo · **priority:** low
- **source:** local · **created:** 2026-06-20 · **spawned_as:** —

**User value:** as a user who just published, I want the Live URL button to enable even when the publish flow didn't bump the version visibly, so I'm not stuck on a disabled button.
**Scope bound:** in: a 30 s TTL on the `/live` slot only (narrowed option 1). out: a global TTL or cache rewrite.
**Acceptance hint:** after a publish that doesn't bump version, the button enables within ~30 s without a manual refresh.
**Provenance:** ADR-0007 (documented v0.2 follow-up, "not a v0.1 hedge").

## Closed

<!-- Shipped / wont_do items land here newest-first, with the spawned_as link. -->

### TASK-001 — Debounce panel data fetches on rapid page navigation
- **type:** feature · **status:** done · **priority:** high
- **source:** local · **created:** 2026-06-20 · **spawned_as:** FRD-001 @ branch `frd-001` (via /triage 2026-06-20)
- **ship outcome:** `shipped_with_caveats` (2026-06-20) — ~200 ms trailing-edge debounce (`PREFETCH_DEBOUNCE_MS`) on the prefetch trigger in `marketplace.tsx`; all 5 FRD acceptance criteria delivered + test-covered (179 tests green); real-tenant host-frame smoke deferred. See `project-planning/plans/ship-report-20260620T122930Z.md`.

**User value:** as a marketer tabbing quickly through many pages, I want the panel to avoid firing three API calls per page so it stays responsive and cheap.
**Scope bound:** in: a ~200 ms debounce on `pageInfo.id` change before the prefetch trio fires. out: changing the cache strategy itself.
**Acceptance hint:** rapidly switching across N pages issues far fewer than 3×N calls; landing on a page still resolves the URLs.
**Provenance:** ADR-0006 ("low-risk follow-up — but v0.1 ships without it").
