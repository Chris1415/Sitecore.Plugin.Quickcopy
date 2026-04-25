# ADR-0004: Local copy of clipboard module — no shared package, no pageshot refactor

## Status

Accepted

## Context

The shipped pageshot Marketplace app (`products/pageshot/`) already solved the iframe-clipboard challenge: `navigator.clipboard.writeText` in a Marketplace iframe needs explicit handling for permission failures, fallback paths, and visible error surfacing. QuickCopy needs the same behavior.

Three options for sharing this code:

1. **Shared package** — extract pageshot's clipboard logic into a published or workspace package (e.g. `@hahn-solo/marketplace-app-utils`). Both apps depend on it.
2. **Refactor pageshot in place** — turn pageshot's clipboard inline code into a clean module, then have QuickCopy import directly from pageshot's path.
3. **Local copy** — copy pageshot's clipboard pattern verbatim into QuickCopy at `site/lib/clipboard.ts`. No edits to pageshot. Two copies coexist.

Option 1 introduces a new package to publish, version, and consume — meaningful overhead for a single-utility extraction across two apps. Option 2 forces cross-product scope creep on a deliberately XS dogfood app and couples pageshot's release timing to QuickCopy's. Option 3 accepts duplication today but defers the consolidation question until a third app exists (rule of three).

## Decision

QuickCopy v0.1 uses **option 3**: copy pageshot's clipboard pattern into a local module at `site/lib/clipboard.ts`. Pageshot's source is not edited. No shared package is created. The two apps will have parallel-but-independent clipboard implementations until a third Marketplace app exists and the duplication is genuinely costly.

## Consequences

**Easier:**
- QuickCopy's scope stays inside `products/quickcopy/` — no cross-product changes, no coordination with pageshot's release cadence.
- pageshot's tests and shipped behavior are unaffected.
- Faster to deliver QuickCopy v0.1 (no package extraction work).
- If pageshot's clipboard pattern needs to evolve for Safari/Firefox quirks, that learning can be backported to QuickCopy at the maintainer's convenience, not synchronously.

**Harder:**
- Two copies of the same logic must be kept compatible by hand if browser quirks emerge.
- A bug fix in one app does not automatically benefit the other.
- A future "shared utilities" package will need to retroactively absorb both copies.

**Trigger for revisiting this decision:** when a third Marketplace app needs the same clipboard pattern, evaluate whether to extract `@hahn-solo/marketplace-app-utils` (or similar). Until then, duplication is the explicit, accepted cost.

## Date

2026-04-25
