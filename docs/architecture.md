# QuickCopy — Architecture

A narrative overview of how QuickCopy is built and why. For decision rationale at the level of individual ADRs, see [decisions.md](./decisions.md). For the underlying records, see `../project-planning/ADR/`.

## System overview

QuickCopy is a Sitecore Marketplace app that provides one-click copy actions for the five pieces of page metadata marketers paste most often: Live URL, Preview URL, Item ID, Page Title, and a Share Link composite. It is intentionally narrow in scope — five buttons and a theme toggle — and ships first as a v0.1 with no telemetry, no analytics, and no third-party scripts.

The app sits inside the Sitecore Cloud Portal as a Custom App registered against a single extension point. It is hosted as an iframe inside the Pages editor, reads page identity from the Marketplace SDK, and makes read-only API calls against XMC Sites, Agent, and Pages. It never writes to Sitecore — the only side effect of any action is a clipboard write in the user's browser.

## Surface and lifecycle

QuickCopy registers at the **`xmc:pages:contextpanel`** extension point and only there. There is no dashboard widget, no full-screen surface, and no standalone variant. This single-surface stance keeps the app's mental model trivial — every UX decision is made knowing the panel renders inside a roughly 320px right-rail iframe, embedded in a parent window the app cannot influence.

Authorization is **Mode A** — portal-brokered. The Sitecore Cloud Portal performs the OAuth flow and delivers an `application.context` payload to the iframe. There is no Auth0 client, no PKCE handshake, and no client secret in the bundle. The app reads exactly one `resourceAccess[]` entry (single-tenant per install) via the typed `requireContextId()` helper at `lib/marketplace/require-context-id.ts`; raw `as string` casts are forbidden by the regression audit.

The Next.js root layout wraps every route in a `<MarketplaceProvider>` that performs the SDK handshake on mount, surfaces a `role="status"` "Connecting…" message during init, and a clean `role="alert"` initialization-error UI if the handshake fails. The handshake never completes outside the Pages-editor iframe, so the dev panel at `http://localhost:3000/panel` reaches the error state by design — the full panel is only visible after install (see `site/next-app/SMOKE_TEST.md`).

## Data flow

The data path is short and intentionally synchronous at the click site:

1. The provider subscribes to `pages.context` (Path A subscription) and stores the latest `pageInfo` in React state.
2. Whenever the cache key — `${pageInfo.id}:${pageInfo.version ?? 'noversion'}` — changes, a separate `<MarketplaceProvider.prefetch>` effect kicks off three SDK calls in parallel via `Promise.allSettled`:
   - `xmc.agent.pagesGetPagePreviewUrl` — the authoritative preview URL
   - `xmc.pages.retrievePage` — read for `publishing.{hasPublishableVersion, isPublishable}` to derive live status
   - `xmc.sites.listHosts` — the live host candidate set
3. Each settled result writes a slice of `PageDerivedState` into the singleton cache at `lib/cache/store.ts`, keyed by the cache key. The Live URL is composed eagerly via `new URL(slug, host).toString()` when status is published AND a host string is available; otherwise the slot stores `null` (disabled) or an `Error` (persistent error).
4. Each card subscribes to its slot via `useCacheEntry(cacheKey)`, which is a `useSyncExternalStore` adapter over the cache. Mutations bump a monotonic counter and notify listeners, so a prefetch that resolves milliseconds after first paint correctly re-renders the cards.
5. Click handlers — and the `Alt+<letter>` keyboard shortcut handlers — read the slot synchronously and dispatch a clipboard write. There is **no fetch on click**; the first click on any button is warm.

The Item ID and Page Title cards skip the cache entirely because both values are present in `pageInfo` itself. Item ID is brace-stripped and trimmed; Page Title falls back from `displayName` to `name` and disables when both are empty.

## UI architecture

The panel composition lives at `app/panel/page.tsx` and is deliberately flat:

```
<MarketplaceProvider>           ← in app/layout.tsx, wraps every route
  <main data-quickcopy="panel">
    <header>
      QUICKCOPY wordmark        ← Geist Mono, uppercase, 0.18em tracking
      <ThemeToggle />
    </header>
    <ActionGrid>                ← 2x2: Live, Preview, Item ID, Page Title
      <LiveUrlCard /> <PreviewUrlCard />
      <ItemIdCard /> <PageTitleCard />
    </ActionGrid>
    <ShareLinkSplit />          ← split-button strip: Markdown primary + caret
    <ShortcutLegend />          ← Alt+L · Alt+P · Alt+I · Alt+T · Alt+S
    <ShortcutsBinding />        ← mounts useShortcuts inside provider tree
    <StatusLiveRegion />        ← SR-only, success announcements only
  </main>
</MarketplaceProvider>
```

Every interactive element is composed from Blok primitives. There is no ad-hoc Tailwind colour, no custom design tokens, and no raw hex outside the `:root` / `.dark` token block in `globals.css` — the regression audit at `lib/regression-audit.test.ts` enforces this. Geist Sans (`--font-sans`) and Geist Mono (`--font-mono`) are wired via `next/font/google` and consumed through Tailwind's default `font-sans` / `font-mono` utilities.

The Share Link split-button is composed from a Blok `Button` (primary, Markdown default) plus a Blok `IconButton` caret with `aria-haspopup="menu"`, both wrapped in a `role="group"` container. Blok ships no native split-button primitive; the composition is documented in detail in ADR-0010.

The shortcut binding (`<ShortcutsBinding>`) installs a single window-level keydown listener that dispatches a synthetic `click` to the appropriate button by accessibility-name suffix (`shortcut Alt+L`, etc.). This keeps the shortcut layer decoupled from the cache module — the cards already own their enabled/disabled/error logic, so `click()` is the minimal-coupling activation primitive.

## Error model

Errors are persistent, per-button, and visual-only. Per ADR-0009:

- A failed pre-fetch or clipboard write marks the cache slot (or the card's local error key for Item ID and Page Title) as `Error`.
- The affected button shows a red `❌` glyph, swaps its label to "Failed", and surfaces the failure reason in a tooltip on hover or focus.
- The button is `aria-disabled="true"` (still focusable so screen-reader users can read the tooltip).
- The state clears only when the cache key changes — the user navigates to another page, the version bumps after a publish, or the panel reloads.

There is no auto-retry, no backoff timer, and no manual retry button. The other four buttons keep working independently when one fails. There is **no `aria-live` announcement of errors**; the regression audit rejects `aria-live` outside `components/quickcopy/StatusLiveRegion.tsx` (which announces successes only) and now also covers `components/providers/` so the loading-status `aria-live` in `MarketplaceProvider` cannot expand into an error path without explicit opt-in.

## Accessibility

- **WCAG AA contrast** is delivered by Blok semantic tokens in both themes. The token block in `globals.css` is the only place raw HSL is allowed.
- A `jest-axe` smoke at `__tests__/a11y.test.tsx` runs zero-violations in both dark and light themes with a pre-seeded cache.
- All interactive elements are keyboard-operable. The Tab order is theme toggle → Live → Preview → Item ID → Page Title → Share Link primary → Share Link caret → menu items.
- The split-button follows the W3C ARIA menu-button pattern: `aria-haspopup="menu"` + `aria-expanded` on the caret, `role="menuitem"` on the dropdown items, focus moves to the first item on open, Escape closes and restores focus to the caret.
- Disabled buttons use `aria-disabled="true"` rather than the `disabled` attribute so screen-reader users can still focus them and hear the tooltip explanation.
- Successful copies announce via `<StatusLiveRegion>` (`role="status"` `aria-live="polite"`); errors are visual-only by policy.

## Testing approach

The task breakdown was authored in **TDD style** (`task_breakdown_style: tdd`) — every Lead Developer task has a paired RED/GREEN test specification, and tests were written before the implementation they pin. The current Vitest suite contains 24 test files and 172 cases:

- **Unit tests** — `lib/cache/`, `lib/clipboard.ts`, `lib/share-link/`, `hooks/useTheme.ts`, `lib/marketplace/require-context-id.ts`
- **Component tests** — every card, the split-button, the theme toggle, the shortcut hook and legend, the status live region, both Provider variants
- **Integration coverage** — distributed across per-card tests plus the a11y smoke; cross-component flows (cache-key bump clears errors, single-card-isolated-errors) rely on T038 manual smoke as the safety net
- **Regression audit** — `lib/regression-audit.test.ts` walks the source tree and asserts forbidden patterns: no `setTimeout` for retries (an explicit allowlist exists for the morph-revert timer in `useCopyAction`, `ShareLinkSplit`, and `StatusLiveRegion`), no `retry` keyword in production code, no `aria-live` for errors, no `as string` / `as any` casts, no raw hex outside `globals.css`
- **Manual smoke** — `site/next-app/SMOKE_TEST.md` covers nine sections of in-portal verification including the cross-browser matrix

The full test contract is documented in `../project-planning/plans/task-breakdown-20260424T193446Z.md` § 10.

## Tech choices with rationale

The eight load-bearing decisions, each linked to its ADR:

- **Marketplace Client-Side scaffold (Scaffold 2)** — chosen because pageshot already proved this pattern works end-to-end. Mirroring its layout (nested `next-app/`, Mode A portal-brokered auth, P-019 lint patches, P-027 Nova Badge API patches, Vitest stack, Chrome PNA dev headers) cuts scaffold uncertainty to zero. See [ADR-0005](../project-planning/ADR/adr-0005-marketplace-scaffold-client-side-flattened.md).
- **Single extension point (`xmc:pages:contextpanel`)** — chosen so every UX decision is made for one surface at one viewport. No dashboard variant, no full-screen mode, no compatibility branches. See [ADR-0002](../project-planning/ADR/adr-0002-extension-point-pages-contextpanel.md).
- **Blok as the only UI framework** — chosen for visual coherence with the rest of the Sitecore Marketplace. Semantic tokens guarantee theme parity in both light and dark; Geist Sans/Mono ship in the Nova preset and avoid a custom font budget. See [ADR-0003](../project-planning/ADR/adr-0003-blok-as-ui-framework.md).
- **Local clipboard module, no shared package** — chosen because pageshot is the only other consumer right now. The rule of three says wait for a third use case before extracting. See [ADR-0004](../project-planning/ADR/adr-0004-clipboard-local-copy-no-shared-package.md).
- **Live URL via parallel pre-fetch** — chosen so click handlers read synchronously from the cache. Three SDK calls fire in parallel on every page change; results land in an in-memory map; the Live URL is composed eagerly when status is published. The first click is warm; subsequent clicks on the same page do not re-fetch. See [ADR-0006](../project-planning/ADR/adr-0006-live-url-composition-parallel-prefetch.md).
- **Version-keyed cache, no TTL** — chosen because the cache key includes `pageInfo.version`, so a publish bumps the key and the next read automatically re-fetches. No timers, no stale-while-revalidate, no manual refresh affordance. A 30s TTL fallback is documented for v0.2 if field data shows the version bump does not always fire. See [ADR-0007](../project-planning/ADR/adr-0007-cache-invalidation-version-keyed.md).
- **Keyboard scheme `Alt+L/P/I/T/S`** — chosen because the letters mnemonically match the actions. Listeners are iframe-scoped, suppressed when an editable element is focused, and the modifier guard now also rejects `Shift+Alt` to avoid macOS Option-Shift typing collisions. A named fallback `Ctrl+Alt+<letter>` is one constant edit away if the in-portal smoke surfaces a Pages-editor conflict. See [ADR-0008](../project-planning/ADR/adr-0008-keyboard-shortcut-scheme.md).
- **Persistent error state, no retry** — chosen because honesty beats noise. A failed call leaves a visible mark that clears only when context changes. Five buttons each emitting auto-retries or `aria-live` errors would be intrusive; a quiet visual cue plus a tooltip is enough. See [ADR-0009](../project-planning/ADR/adr-0009-error-state-policy-no-retry.md).
- **Share Link split-button via Blok composition** — chosen because Blok ships no native split-button primitive. Two real Blok buttons in a `role="group"` wrapper, with the caret holding the menu state, satisfies the W3C ARIA menu-button pattern without inventing a custom abstraction. See [ADR-0010](../project-planning/ADR/adr-0010-share-link-split-button-composition.md).

For the index of all ten ADRs and a one-line summary of each, see [decisions.md](./decisions.md).
