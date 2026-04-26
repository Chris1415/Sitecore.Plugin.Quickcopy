# QuickCopy — Architecture Decisions

A curated summary of the ten Architecture Decision Records (ADRs) that govern QuickCopy v0.1, grouped by theme. Each row links to the canonical ADR file under `../project-planning/ADR/`. For the architecture narrative built on top of these decisions, see [architecture.md](./architecture.md).

## Process / Foundation

| ADR | Title | Status | Why |
|-----|-------|--------|-----|
| [ADR-0001](../project-planning/ADR/adr-0001-use-adrs-as-architecture-backbone.md) | ADRs as architecture backbone | Accepted | Minimal-track project — no full architecture blueprint. ADRs are the only durable record of "why we built it this way" alongside the PRD. One decision per ADR, numbered, immutable once accepted. |
| [ADR-0002](../project-planning/ADR/adr-0002-extension-point-pages-contextpanel.md) | `xmc:pages:contextpanel` only | Accepted | Single-surface app. Every UX decision is made for one viewport (~320px right-rail iframe) on one extension point. No dashboard widget, no full-screen variant, no compatibility branches. |
| [ADR-0003](../project-planning/ADR/adr-0003-blok-as-ui-framework.md) | Blok as the only UI framework | Accepted | Visual coherence with the rest of Sitecore Marketplace. Blok ships AA-compliant tokens, Geist Sans + Geist Mono via the Nova preset, and the primitives this app needs (Button, IconButton, DropdownMenu, Tooltip, Toggle, Kbd). No raw hex outside the token block; the regression audit enforces it. |

## Implementation Strategy

| ADR | Title | Status | Why |
|-----|-------|--------|-----|
| [ADR-0004](../project-planning/ADR/adr-0004-clipboard-local-copy-no-shared-package.md) | Local clipboard module — no shared package | Accepted | Pageshot is the only other consumer. Rule of three: wait for a third use case before extracting `@hahn-solo/marketplace-app-utils`. v0.1 copies pageshot's pattern into `lib/clipboard.ts` with no pageshot refactor. |
| [ADR-0005](../project-planning/ADR/adr-0005-marketplace-scaffold-client-side-flattened.md) | Marketplace Client-Side scaffold (mirror pageshot) | Accepted | Pageshot proved the pattern. Nested `next-app/`, Mode A portal-brokered auth (no Auth0, no PKCE, no client secret), P-019 lint patches and P-027 Nova Badge API patches applied immediately after scaffold, Vitest stack, Chrome PNA dev headers. |
| [ADR-0008](../project-planning/ADR/adr-0008-keyboard-shortcut-scheme.md) | Keyboard shortcuts `Alt+L/P/I/T/S` (provisional) | Accepted | Letters mnemonically match Live, Preview, Item, Title, Share. Iframe-scoped listeners, suppressed in editable elements, modifier guard rejects `Ctrl+Alt`, `Meta+Alt`, and `Shift+Alt`. Named fallback `Ctrl+Alt+<letter>` is one constant edit away if the in-portal smoke surfaces a Pages-editor conflict. |
| [ADR-0010](../project-planning/ADR/adr-0010-share-link-split-button-composition.md) | Share Link split-button via Blok composition | Accepted | Blok ships no native split-button primitive. Two real Blok buttons in a `role="group"` wrapper — primary copies Markdown, caret IconButton with `aria-haspopup="menu"` opens the dropdown — satisfies the W3C ARIA menu-button pattern without inventing a custom abstraction. |

## Data and Behaviour

| ADR | Title | Status | Why |
|-----|-------|--------|-----|
| [ADR-0006](../project-planning/ADR/adr-0006-live-url-composition-parallel-prefetch.md) | Live URL parallel pre-fetch | Accepted | Three SDK calls (`pagesGetPagePreviewUrl`, `pages.retrievePage` for live status, `sites.listHosts` for live host) fire in parallel via `Promise.allSettled` on every cache-key change. Results land in an in-memory map. Click handlers read synchronously — no fetch on click, the first click is warm. |
| [ADR-0007](../project-planning/ADR/adr-0007-cache-invalidation-version-keyed.md) | Version-keyed cache, no TTL | Accepted | Cache key is `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`. A publish bumps the version, the cache key changes, and the next read automatically re-fetches and clears any sticky error state. No timers, no stale-while-revalidate, no manual refresh button. A 30s TTL fallback on `/live` is documented for v0.2 if field data shows the version bump does not always fire. |
| [ADR-0009](../project-planning/ADR/adr-0009-error-state-policy-no-retry.md) | Persistent error state, no retry | Accepted | Honesty beats noise. A failed pre-fetch or clipboard write leaves the affected button in a red `❌` state with a tooltip; the state clears only when the cache key changes. No auto-retry, no backoff, no manual retry button, no `aria-live` for errors. The other four buttons keep working independently. |

## Reading order

If you have ten minutes and want to understand QuickCopy from scratch, read in this order:

1. **ADR-0002** — what surface this is
2. **ADR-0003** — what it looks like
3. **ADR-0006** — how data gets to the buttons
4. **ADR-0007** — when the cache invalidates
5. **ADR-0009** — what happens when something fails
6. **ADR-0010** — the one composed primitive
7. **ADR-0008** — keyboard layer
8. **ADR-0005** — scaffold and auth mode
9. **ADR-0004** — why clipboard isn't a shared package
10. **ADR-0001** — why we use ADRs at all

Then walk [architecture.md](./architecture.md) for the narrative that ties them together.
