# ADR-0006: Live URL composition — parallel pre-fetch on `pageInfo.id` change, in-memory map cache

## Status

Accepted

## Context

The Live URL is the single largest effort risk in QuickCopy v0.1 (PRD § 13, R-001). Producing a Live URL requires three pieces of data:

1. **Publication status** — `xmc.agent.pagesGetPagePreviewUrl`'s sibling endpoint, conceptually `GET /api/v1/pages/{id}/live`. Returns whether the page is published to Edge.
2. **Edge host** — `xmc.sites.listHosts` (`path: { siteId }`, `query: { sitecoreContextId }`) returns the host(s) bound to the current site for the live channel.
3. **Page slug** — `pageInfo.url` from `pages.context`, joined to the host.

Three call-graph options were considered:

| Option | Behavior | First-click latency | API hammering |
|--------|----------|---------------------|---------------|
| **Serial-on-click** | First click on Live URL fires `/live` → if published, fires `/sites/{siteId}/hosts` → composes URL → writes clipboard | High — two round trips inside the click handler | Lowest — requests only fire when needed |
| **Parallel-on-click** | First click fires `/live` and `/sites/{siteId}/hosts` in parallel; if `/live` says unpublished, the host result is discarded | Medium — single round trip, two requests | Slight waste when unpublished |
| **Parallel pre-fetch on `pageInfo.id` change** (chosen) | When `pages.context` resolves a new `pageInfo.id`, kick off `/live` and `/sites/{siteId}/hosts` in parallel before the user clicks. First click reads from the in-memory cache | Lowest — click is no-fetch, just clipboard write | Slight waste on pages the user never copies a Live URL from |

The PRD § 9 already states: "On `pageInfo.id` change: kick off parallel pre-fetches of `/preview-url` and `/live` so the first click is warm." The architect commits to that strategy and extends it: `/sites/{siteId}/hosts` is also pre-fetched, in parallel with `/live` and `/preview-url`, on `pageInfo.id` change.

NFR-002 sets a fetch-action click-to-clipboard budget of ≤800ms p95 with warm auth. With pre-fetch, the click-to-clipboard path collapses to "read the cached composed URL → clipboard write" — well inside the 50ms no-fetch budget.

The Share Link button (FR-005, US-005) depends on Live URL when the page is published, Preview URL otherwise. Pre-fetching both removes the Share Link button's logic from "wait for the URL" to "branch on which cache slot has a value." This is the architectural simplification that makes Share Link feel instantaneous regardless of the underlying URL freshness.

There is a subtle host-resolution question: `xmc.sites.listHosts` may return multiple hosts. The PRD does not specify multi-host handling. The architect's call: pick the **first host whose `kind` indicates the live/published channel** (Sites API exposes a `kind` discriminator on host entries — `delivery` or `cm` etc.; look up the actual values from the SDK type at implementation time). If multiple delivery hosts exist, pick `[0]`. If none, treat it as an error and put the Live URL button into the persistent error state (ADR-0009). Multi-host disambiguation is a future-opportunity concern (PRD § 15) — v0.1 does not surface a host picker.

The `pageInfo.url` slug is used **only** for the path portion (e.g. `/products/spring-campaign`). The host comes from `listHosts`, never from `pageInfo`. PRD R-005 explicitly forbids exposing `pageInfo.url` raw as Live URL — this ADR honors that by always combining a fresh `/live` confirmation with a fresh host lookup.

## Decision

**Strategy:** parallel pre-fetch on `pageInfo.id` change.

**Implementation contract:**

1. The `pages.context` subscription (Path A — `client.query('pages.context', { subscribe: true, onSuccess })`) fires `onSuccess` on initial resolve and on every navigation update.
2. Inside `onSuccess`, when `pageInfo.id` differs from the previously-tracked id, the panel dispatches three parallel calls via `Promise.allSettled`:
   - `client.query('xmc.agent.pagesGetPagePreviewUrl', { params: { path: { pageId: pageInfo.id }, query: { sitecoreContextId } } })`
   - `client.query('<live-status-key>', { params: { path: { pageId: pageInfo.id }, query: { sitecoreContextId } } })` — exact key resolved at implementation time from `xmc.md`; candidates are an `xmc.agent.pages*` or `xmc.pages.*` endpoint that returns publication state.
   - `client.query('xmc.sites.listHosts', { params: { path: { siteId: siteInfo.id }, query: { sitecoreContextId } } })`
3. Results are stored in a module-level `Map<pageId, PageDerivedState>` keyed by `pageInfo.id` (combined with version per ADR-0007). Shape:
   ```ts
   type PageDerivedState = {
     previewUrl: string | null | Error;
     liveStatus: 'published' | 'unpublished' | null | Error;
     liveHost: string | null | Error;
     liveUrl: string | null;  // composed eagerly when liveStatus='published' AND liveHost is a string
   };
   ```
4. `liveUrl` is **composed eagerly** when both `liveStatus === 'published'` and `liveHost` is a string: `liveUrl = new URL(pageInfo.url ?? '/', liveHost).toString()`. Use `URL` constructor — it handles trailing/leading slash combinations and percent-encoding correctly.
5. Click handlers are **synchronous reads from the cache**. They never re-fetch. If the cached entry is `Error` (one of the three pre-fetches failed), the button is in error state (ADR-0009) and the click does nothing. If the cached entry is `null` (still resolving), the button is disabled with a "Loading…" tooltip (a transient state, distinct from FR-013's persistent disabled-with-reason).
6. **No retry, no backoff, no manual refresh.** Pre-fetch failures are sticky for the lifetime of that `pageInfo.id` (ADR-0009).
7. Cache size: bounded by user navigation within a single panel mount. No LRU eviction in v0.1 — the panel's lifetime is short (page editor session), and entries are one tiny string each. The cache clears on panel unmount and is re-created on next mount.
8. Concurrent navigation guard: if a second `pageInfo.id` change arrives while the first is still resolving, the in-flight `Promise.allSettled` for the older id continues and writes to its own map slot — there is no cancellation. The newer id starts its own parallel triplet. This is safe because the cache is keyed by id; old results land in old slots that the user no longer sees.

## Consequences

**Easier:**

- Click-to-clipboard for Live URL and Share Link collapses to a no-fetch path inside the NFR-002 50ms budget.
- The Share Link button's "live or preview?" branch is a pure cache lookup with no async indirection — `liveUrl ?? previewUrl ?? null`.
- Three independent pre-fetches via `Promise.allSettled` mean a failure in one doesn't break the others (NFR-005 — Item ID, Title, Theme stay functional even if all HTTP endpoints fail; with this ADR, Preview and Live degrade independently of each other too).
- The single "page navigation" event triggers all the work — no lazy / on-demand state machine, no "did the user hover the button to warm the fetch" tricks.

**Harder:**

- Pages the user never copies a URL from still trigger three API calls. For a marketer who tabs through many pages quickly, this is a small but real cost. Mitigation: the calls are cached per id, so backwards/forwards navigation hits the cache. If field reports show this is a problem, a debounce on `pageInfo.id` change (e.g. 200ms) is a low-risk follow-up — but v0.1 ships without it.
- The cache is an in-memory `Map`, scoped to panel lifetime. A panel reload invalidates everything. This is acceptable per FR-007 — the same behavior already clears error state — and matches the PRD's "no persisted page data" stance (NFR-007).
- Multi-host sites get the `[0]` host without a picker. If a customer reports "we have prod.example.com and stg.example.com both bound as live hosts," the architect's hand is forced into either a picker UI or a per-tenant config. v0.1 ships with the documented `[0]` choice.

**Neutral:**

- The Live URL composition uses `new URL(slug, host).toString()` rather than naive string concatenation. This is the only correct way to handle slugs that may or may not start with `/` and hosts that may or may not end with `/`.
- Preview URL caching uses the same map slot — the SDK call (`xmc.agent.pagesGetPagePreviewUrl`) is one of the three parallel pre-fetches.

## Date

2026-04-25
