# ADR-0007: Cache invalidation — version-based key (`pageInfo.id` + `pageInfo.version`), no TTL, no manual refresh

## Status

Accepted

## Context

PRD § 13 R-007 raises the API cache coherency problem: a marketer publishes a page inside the same Pages session, then clicks Copy Live URL. If the cached `/live` result still says "unpublished," the button is wrongly disabled. Three options were on the table:

1. **Short-TTL** (e.g. 30 seconds). Simple but probabilistic — a user who publishes and immediately clicks within 30s still sees the wrong state. Adds API hammering on long-dwell pages.
2. **Version-based key** (`pageInfo.id` + `pageInfo.version`). The Marketplace SDK's `PagesContext.pageInfo.version` field exists (`marketplace-sdk/client.md § 4` — verified in the published `PagesContext` shape). When Pages bumps `pageInfo.version` after a publish (or any save that bumps version), the cache key changes and the next click re-fetches.
3. **Panel-reload-only** invalidation. Simplest. Wrong on its face — a publish is a normal in-session action, not a "reload the panel" trigger.

The decisive question for option 2 is: **does the Pages editor actually bump `pageInfo.version` after a publish?** The Marketplace SDK skill documents `pageInfo.version: number` as part of the subscribable `pages.context` shape, alongside `displayName`, `path`, `template`, etc. The publish lifecycle in XM Cloud creates a new version when the user publishes from the editor — this is the standard XM Cloud workflow. The `pages.context` subscription delivers updated `pageInfo` snapshots whenever the editor's view changes, including version bumps.

Two practical caveats apply:

- **The version field may be absent in some edge cases.** The `PagesContext` type marks `version` as optional. If absent (e.g. unpublished new pages with no version yet, or a transient state), the cache key collapses to `pageInfo.id` alone — same behavior as the simplest possible cache.
- **Some publish flows may not bump version visibly to the panel.** If a customer reports "I published, the button is still disabled" in field testing, the fallback is to drop into a 30-second TTL on the `/live` slot only (option 1 narrowed). This is a documented v0.2 follow-up, not a v0.1 hedge.

The PRD allows the architect to choose between version-keying and short-TTL. Version-keying is the architecturally cleaner choice: cache invalidation follows the data's actual identity rather than a wall-clock guess. The alternative — a manual "refresh" affordance on the Live URL button — was explicitly rejected during PRD discovery (FR-007: "no auto-retry, no backoff timer, no manual retry button in v0.1") and is reaffirmed here.

## Decision

**Cache key = `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`.**

**Cache invalidation policy:**

- A new `pages.context` event with a different cache key triggers a fresh parallel pre-fetch (per ADR-0006). The old cache entry is left in place — it costs almost nothing and may be re-hit if the user navigates back.
- The cache has **no TTL** in v0.1.
- The cache has **no manual refresh affordance** in v0.1 (no "retry" or "refresh" button).
- The cache clears when the panel unmounts.

**Error-state interaction:**

- Per ADR-0009, an error state on a button persists until `pageInfo.id` changes (FR-007). For consistency, an error state also clears when the cache key changes — i.e. when either `pageInfo.id` or `pageInfo.version` changes. This means: if a fetch fails, the user publishes (bumping version), then clicks the button → the version change triggers a fresh pre-fetch and clears the persistent error state. This is the correct user-visible behavior even though it slightly broadens the "context change" trigger from id-only to (id, version).
- The `pages.context.pageInfo.id changes` language in FR-007 is preserved as the primary trigger; this ADR adds version-bumps as an equivalent context change. If field testing finds version-bump-without-id-change scenarios that produce confusing UX, the trigger can be narrowed back to id-only — but for v0.1 the broader trigger is the safer default.

**Worked example:**

| Step | `pageInfo.id` | `pageInfo.version` | Cache key | Behavior |
|------|---------------|---------------------|-----------|----------|
| User opens page A (unpublished) | `A` | `1` | `A:1` | Fetches `/live` → unpublished, button disabled |
| User publishes page A | `A` | `2` (bumped by Pages) | `A:2` | New cache key — fresh pre-fetch fires automatically; `/live` returns published; button enabled |
| User clicks Copy Live URL | `A` | `2` | `A:2` | Cache hit, no fetch, clipboard write |
| User navigates to page B | `B` | `1` | `B:1` | Fresh pre-fetch for B; A stays cached |
| User navigates back to A | `A` | `2` | `A:2` | Cache hit, no fetch |
| Page A's `/live` fetch had failed at step 1 | `A` | `1` | `A:1` | Error sticky on `A:1` slot |
| User publishes A from another tab → version becomes `2` | `A` | `2` | `A:2` | New cache key, fresh fetch, error cleared |

## Consequences

**Easier:**

- Cache invalidation follows data identity, not wall-clock heuristics. A user who publishes and immediately copies sees the correct (published) state.
- No timer logic in the panel — no `setTimeout`, no TTL bookkeeping. The cache is a plain `Map` whose keys change when the underlying data changes.
- Error-state clearing automatically tracks publish events without a "retry" button. The pattern (cache key change → fresh fetch → error clears) is one mechanism, not two.

**Harder:**

- Depends on Pages bumping `pageInfo.version` after publish. If a particular publish flow doesn't bump version, the cache stays stale until the user navigates to another page and back. Mitigation: documented v0.2 fallback to a 30s TTL on `/live` if field reports surface this. Not in v0.1.
- A page that genuinely has no version (e.g. a brand-new draft never saved) collapses to id-only keying. This is identical to having no version-keying at all — it's not worse than the baseline; it just doesn't get the version-based bonus.
- Cross-session changes (someone else publishes the page in another tab or another user's session) may not produce a `pageInfo.version` change visible to QuickCopy until the user re-selects the page in Pages. v0.1 accepts this.

**Neutral:**

- The cache key string is internal — no user-visible artifact, no exposed URL. Future evolution (e.g. dropping back to id-only, or adding TTL on the `/live` slot only) is a one-function change inside the cache module.
- The cache's bound on memory is "number of distinct page versions visited in a single panel mount" — a marketer typically views fewer than 50 pages per session, and each entry is a few hundred bytes. No eviction is needed.

## Date

2026-04-25
