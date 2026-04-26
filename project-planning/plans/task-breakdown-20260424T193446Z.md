# Development Execution Plan — QuickCopy v0.1

---
document_type: task_breakdown
artifact_name: task-breakdown-20260424T193446Z.md
generated_at: 2026-04-24T19:34:46Z
run_manifest: products/quickcopy/project-planning/workflow/run-20260424T193446Z.json
source_inputs:
  - products/quickcopy/project-planning/PRD/prd-000.md
  - products/quickcopy/project-planning/PRD/prd-minimal-000.md
  - products/quickcopy/project-planning/ADR/ (ADR-0001..ADR-0010 — minimal track, ADRs are the architecture)
  - products/quickcopy/project-planning/ui-design/ui-design-20260424T193446Z-v2.md (Spotlight Compass — winning variant)
  - products/quickcopy/pocs/poc-v2/ (visual source of truth — index.html, styles.css, app.js)
consumed_by:
  - Developer (08) implements from this file + prd-minimal-000.md only
qa_enriched_at: 2026-04-25T17:00:00Z
qa_enriched_by: 07-qa-specialist
task_breakdown_style: tdd
next_input:
  - this file (task-breakdown-20260424T193446Z.md) — Developer reads § 4b + § 4c + § 9 + § 10 as the test-first contract
---

## 1. Implementation Overview

QuickCopy is a Sitecore Marketplace **Page Context Panel** app (extension point `xmc:pages:contextpanel`) built with **Next.js + Marketplace Client-Side SDK (Mode A) + Blok**. It exposes **five copy actions** — Live URL, Preview URL, Item ID, Page Title, Share Link (split-button: Markdown / Plain text) — driven from a live `pages.context` subscription, with **dark-default + light-toggle** theming, **iframe-scoped keyboard shortcuts** (`Alt+L/P/I/T/S`), a **persistent error policy** (no retry, no backoff), and a **version-keyed in-memory cache** of pre-fetched URLs.

**Layout direction (UI):** Spotlight Compass — slim header + page-title kicker, **2×2 grid of square action cards** (Live / Preview / Item / Title) under a diagonal Blok gradient mesh, **wide Share Link strip** below the grid, **shortcut legend** at the bottom. Strict-Blok: Geist Sans + Geist Mono via `next/font/google`, semantic tokens only (no raw hex), 280ms copied morph with 4° rotation + scale, persistent error ring on failure.

**Delta vs PRD.** None of substance. PRD OQ-001/OQ-002/OQ-006/OQ-007 were resolved by ADR-0008/0010/0007/0004 respectively. PRD R-001 (Live URL composition) is absorbed into ADR-0006 (parallel pre-fetch on `pageInfo.id` change with version-keyed cache and eager URL composition via `new URL(slug, host)`). The "live status" SDK key — flagged generically in ADR-0006 — is **resolved here** to `xmc.pages.retrievePage` (returns `publishing.hasPublishableVersion` + `publishing.isPublishable`) since `xmc.md` does not expose a dedicated `xmc.agent.pagesGetPageLive` key. Animation timing in § 4c-4 follows the UI variant's 280ms morph (which sits under the PRD FR-008 1500ms hold envelope — both numbers coexist: morph is the entrance animation, 1500ms is the total "Copied!" dwell).

## 2. Epics

| Epic | Purpose |
|------|---------|
| **E1 — Scaffold & Bootstrap** | Run Marketplace Client-Side scaffold (Scaffold 2), apply mandatory P-019 / P-027 / Vitest / PNA patches, register the `/panel` route, get `npm run lint && typecheck && test && build` green. |
| **E2 — Page Context Subscription** | Wrap `app/layout.tsx` in `MarketplaceProvider`; subscribe to `pages.context` via Path A; expose `pageInfo` + `siteInfo` + `sitecoreContextId` via React context. |
| **E3 — URL Resolution & Caching** | Parallel pre-fetch of Preview URL, page state (publishing), and Sites/Hosts on every `pageInfo.id` (or version) change. Version-keyed in-memory `Map`. Eager Live URL composition. |
| **E4 — Clipboard & Local Copy Module** | Port `lib/clipboard.ts` from pageshot's clipboard pattern (text-only — pageshot does image, QuickCopy does string). Local copy, no shared package. |
| **E5 — Action Cards (Live / Preview / Item / Title)** | Four Blok-composed action cards in 2×2 grid; Geist Mono glyphs (↗ ◉ # Aa); idle / hover / focus / active / copied / disabled / error states. |
| **E6 — Share Link Split-Button** | Compose Blok Button + DropdownMenu per ADR-0010. Markdown (default) + Plain text. Resolved URL = Live ?? Preview. |
| **E7 — Theme & Persistence** | Dark default + Light toggle. Persist to `localStorage['quickcopy.theme']`. Blok semantic-token theming via `:root` / `.dark` blocks. |
| **E8 — Keyboard Shortcuts & Legend** | Single `keydown` listener, iframe-scoped, editable-element guard, `preventDefault` on every recognized combo. Bottom-strip legend rendered from the same constant. |
| **E9 — Error & Disabled States** | Persistent per-button error (cleared only by cache-key change). Disabled-with-tooltip for unpublished Live and missing context fields. ARIA-correct via `aria-disabled` + `aria-describedby`. |
| **E10 — Accessibility & Polish** | WCAG AA contrast, focus rings, screen-reader names, `aria-live="polite"` status region, reduced-motion fallback, touch-target sizing. |
| **E11 — Ship Prep** | Manual smoke in real portal (per `testing-debug.md`), README + CHANGELOG via `/document`, Vercel deploy, app card copy. (Out of this file's scope — `/ship` handles it.) |

## 3. Feature Breakdown — Task list

**ID format:** `T###` (zero-padded three digits, stable across reorderings; suffix `a/b/...` if a task is later split). Every task lists **Title**, **Description**, **Expected Output**, **Depends on**.

---

### E1 — Scaffold & Bootstrap

#### T001 — Run Marketplace Client-Side scaffold
- **Title:** Scaffold the Next.js app via shadcn quickstart
- **Description:** From the products directory, run the **non-interactive** Marketplace Client-Side scaffold per ADR-0005 / `setup/scaffold.md § Scaffold 2`. **Do NOT flatten** the `next-app/` subdir — mirror pageshot. Exact command:
  ```bash
  yes '' | npx --yes shadcn@latest add \
    https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json \
    --yes \
    --cwd C:/Projects/agentic/agentic.hahn-solo/products/quickcopy/site
  ```
  Prompt answers (already injected by `--yes`): Framework = Next.js, Project name = `next-app` (do NOT rename), Component library = Radix, Preset = Nova (Lucide / Geist).
- **Expected Output:** `products/quickcopy/site/next-app/` containing `package.json`, `app/layout.tsx`, `app/page.tsx`, `components/providers/marketplace.tsx`, `components/examples/...`, `components/ui/...`. `npm install` already completed by shadcn (verify `package-lock.json` exists).
- **Depends on:** none

#### T002 — Apply P-019 lint patch (`marketplace.tsx`)
- **Title:** Fix scaffolded provider's lint nits
- **Description:** Edit `components/providers/marketplace.tsx`: (a) `extention` → `extension`, (b) `your app's` → `your app&apos;s` (or switch the surrounding string to double-quoted). Both fail `npm run lint` out of the box.
- **Expected Output:** `npm run lint` no longer fails on those two lines.
- **Depends on:** T001

#### T003 — Apply P-027 Nova Badge audit
- **Title:** Verify Nova Badge `colorScheme` contract
- **Description:** Inspect `components/ui/badge.tsx`. Nova preset uses `colorScheme="danger"|"success"|"neutral"|...` (NOT shadcn `variant="destructive"`). QuickCopy may not need Badge at all (the persistent error state is rendered as inset-ring + glyph swap on the action card itself, not a Badge). If we use Badge anywhere, use `colorScheme`. Document the contract as a code comment near any Badge usage.
- **Expected Output:** No `variant="destructive"` / `variant="secondary"` references in repo. If no Badge usage planned, mark this task complete after the audit.
- **Depends on:** T001

#### T004 — Install Vitest test stack
- **Title:** Add Vitest + Testing Library + jsdom
- **Description:** From `products/quickcopy/site/next-app/`:
  ```bash
  npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
  ```
  Add `vitest.config.ts` (verbatim from `setup/scaffold.md § Scaffold 2 step 5`), `vitest.setup.ts` (`import '@testing-library/jest-dom/vitest';`), and `package.json` scripts `"test": "vitest run"` + `"test:watch": "vitest"`. Add to `tsconfig.json` `compilerOptions`: `"types": ["vitest/globals", "@testing-library/jest-dom"]`.
- **Expected Output:** `npm run test` runs Vitest (no tests yet — should report "no test files"). `npm run typecheck` succeeds.
- **Depends on:** T001

#### T005 — Add Chrome PNA headers to `next.config.mjs`
- **Title:** Wire Local Network Access response headers for portal-iframe loading
- **Description:** Add `async headers()` to the Next config returning the four PNA headers (`Access-Control-Allow-Private-Network: true`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization, Access-Control-Request-Private-Network`). **Do NOT** add `Access-Control-Allow-Credentials: true` — the spec forbids combining it with `Origin: *`. HTTP is fine for Mode A; do NOT enable `--experimental-https`.
- **Expected Output:** `next.config.mjs` updated; `npm run build` still passes.
- **Depends on:** T001

#### T006 — Geist fonts via `next/font/google` in `app/layout.tsx`
- **Title:** Wire Geist Sans + Geist Mono to `--font-sans` / `--font-mono`
- **Description:** Per Blok `setup.md` and pageshot's reference `app/layout.tsx`: import `Geist` and `Geist_Mono` from `next/font/google`, instantiate each with `variable: '--font-sans'` and `variable: '--font-mono'`, attach both `.variable` className tokens to `<body>`, and set `<html lang="en" className="h-full">`. This makes the Spotlight Compass typography rules (UI § 4b) work without external font links.
- **Expected Output:** `app/layout.tsx` updated; Geist applied at runtime (verify on `npm run dev` against `app/page.tsx`).
- **Depends on:** T001

#### T007 — Register `/panel` route as the contextpanel surface
- **Title:** Add `app/panel/page.tsx` for the `xmc:pages:contextpanel` extension point
- **Description:** Create `app/panel/page.tsx` as a `'use client'` component that renders the (yet-to-be-built) `<QuickCopyPanel />` composition. For now, render a placeholder `<div>QuickCopy panel — bootstrap OK</div>` to confirm routing. Per ADR-0005 the route URL is `/panel` (mirrors pageshot). Mode A app; no `.env.local` is required (no Auth0). Cloud Portal registration values are documented in § 4c-3 below — Lead Developer registers the test app during T036.
- **Expected Output:** `http://localhost:3000/panel` renders the placeholder when `npm run dev` runs.
- **Depends on:** T001

#### T008 — Bootstrap green-light gate
- **Title:** All scripts pass on the bootstrap commit
- **Description:** Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` in `products/quickcopy/site/next-app/`. All four must pass. Any failure indicates a missed P-019 / P-027 / Vitest / PNA patch.
- **Expected Output:** Four green commands. Commit the bootstrap state with message "T001-T008: scaffold + post-scaffold patches green".
- **Depends on:** T002, T003, T004, T005, T006, T007

---

### E2 — Page Context Subscription

#### T009a — RED: failing tests for `MarketplaceProvider` `pages.context` subscription
- **Title:** Write failing component tests for the extended Provider
- **Description:** Co-located test next to `components/providers/marketplace.tsx`. Stub `ClientSDK.init` to return a `mockClient` with a `query` mock typed as `vi.fn<ClientSDK['query']>()`. Test cases (full prose specs in § 10): mounts call `client.query('pages.context', { subscribe: true, ... })` exactly once even under StrictMode double-mount; `usePagesContext()` returns `null` before the first `onSuccess`; after `onSuccess({ pageInfo, siteInfo })` it returns that snapshot; on unmount, the captured `unsubscribe` AND `client.destroy()` are both invoked. All tests must FAIL before T009b runs (the scaffolded provider does not yet subscribe to `pages.context`).
- **Expected Output:** `components/providers/marketplace.test.tsx` with the four scenarios above, all RED on first run.
- **Depends on:** T008

#### T009b — GREEN: implement `MarketplaceProvider` `pages.context` subscription
- **Title:** Subscribe to `pages.context` via Path A inside `MarketplaceProvider`
- **Description:** Modify the scaffolded `components/providers/marketplace.tsx` (mirror pageshot's pattern in `products/pageshot/site/next-app/components/providers/marketplace.tsx`):
  - Add a third `Context` for `pages.context` (`PagesContextContext`).
  - In a `useEffect` keyed on `client`, call `client.query('pages.context', { subscribe: true, onSuccess, onError })` — Path A per `client.md § 6a`. **Never** `client.subscribe('pages.context', ...)` — that fails typecheck.
  - In `onSuccess`, store the full `pageInfo` + `siteInfo` (we need `pageInfo.id`, `pageInfo.version`, `pageInfo.displayName`, `pageInfo.name`, `pageInfo.url`, `pageInfo.publishing?`, `siteInfo.id`, `siteInfo.name`).
  - Capture the `unsubscribe` returned by the query promise and tear down on unmount along with `client.destroy()`.
  - Use a `useRef`-based StrictMode guard to prevent double-init (mirror pageshot's `initStartedRef`).
- **Expected Output:** Three exported hooks: `useMarketplaceClient()`, `useAppContext()`, `usePagesContext()`. `usePagesContext()` returns `{ pageInfo, siteInfo } | null` (null until first `onSuccess`). All T009a tests now GREEN.
- **Depends on:** T009a

#### T010a — RED: failing unit tests for `requireContextId`
- **Title:** Tests for the typed `sitecoreContextId` helper
- **Description:** Co-located unit test at `lib/marketplace/require-context-id.test.ts`. Test cases (full prose specs in § 10): `requireContextId(null)` throws with a useful message; `requireContextId({ resourceAccess: [{ context: { live: 'L1' } }] })` returns `'L1'`; `requireContextId({ resourceAccess: [{ context: { preview: 'P1' } }] })` falls back to `'P1'`; both missing → throws. All FAIL until T010b lands.
- **Expected Output:** Failing test file with the four cases.
- **Depends on:** T008

#### T010b — GREEN: implement `requireContextId`
- **Title:** Add `lib/marketplace/require-context-id.ts`
- **Description:** Per `client.md § 4`, expose `requireContextId(ctx: ApplicationContext | null): string` that reads `ctx?.resourceAccess?.[0]?.context?.live` (or falls back to `.preview`) and **throws** if neither is present. **No `as string` casts.** This is the single helper every XMC call uses to obtain `sitecoreContextId`.
- **Expected Output:** `lib/marketplace/require-context-id.ts` exporting a typed function. Consumers throw / branch — no silent `undefined` lands in XMC calls. T010a tests GREEN.
- **Depends on:** T010a

---

### E3 — URL Resolution & Caching

#### T011a — RED: failing unit tests for cache key + types
- **Title:** Tests for `buildCacheKey` and `PageDerivedState` shape
- **Description:** `lib/cache/types.test.ts` — assert: `buildCacheKey('p1', 2) === 'p1:2'`; `buildCacheKey('p1', undefined) === 'p1:noversion'`; `buildCacheKey('p1', 0) === 'p1:0'` (zero is a real version, NOT noversion); `CacheValue<string>` correctly accepts string, `null`, and `{ error: Error }` via TypeScript-only type assertions (`expectTypeOf` if you add it, OR runtime smoke checks). All FAIL until T011b.
- **Expected Output:** Test file with the four cases above, all red.
- **Depends on:** T009b

#### T011b — GREEN: cache key + state types (`lib/cache/types.ts`)
- **Title:** Define `CacheKey`, `PageDerivedState`, `CacheValue<T>`
- **Description:** Per ADR-0006 + ADR-0007:
  ```ts
  export type CacheKey = string;          // `${pageId}:${version ?? 'noversion'}`
  export type CacheValue<T> = T | null | { error: Error };  // null = pending, Error = sticky
  export interface PageDerivedState {
    previewUrl: CacheValue<string>;
    publishing: CacheValue<{ isPublished: boolean }>;
    liveHost:   CacheValue<string>;
    liveUrl:    string | null;             // composed eagerly when publishing.isPublished && liveHost is string
  }
  export const buildCacheKey = (pageId: string, version: number | undefined): CacheKey =>
    `${pageId}:${version ?? 'noversion'}`;
  ```
- **Expected Output:** `lib/cache/types.ts` exporting types + `buildCacheKey`. T011a tests GREEN.
- **Depends on:** T011a

#### T012a — RED: failing unit tests for cache store
- **Title:** Tests for `getEntry / setEntry / patchEntry / clearAll`
- **Description:** `lib/cache/store.test.ts` — assert: `getEntry('missing')` returns `undefined`; `setEntry(k, s)` then `getEntry(k)` returns deep-equal `s`; `patchEntry(k, { previewUrl: 'X' })` merges into the existing slot; `clearAll()` empties — `getEntry(k)` returns `undefined` for any previously-written key. Tests reset module state via `beforeEach(() => clearAll())`. All FAIL until T012b.
- **Expected Output:** Failing test file.
- **Depends on:** T011b

#### T012b — GREEN: in-memory cache (`lib/cache/store.ts`)
- **Title:** Module-level `Map<CacheKey, PageDerivedState>` with read/write/clear
- **Description:** Implement a tiny module-singleton `Map`. Exports: `getEntry(key)`, `setEntry(key, state)`, `patchEntry(key, partial)`, `clearAll()`. No TTL, no eviction (ADR-0007). `clearAll` is called once on `MarketplaceProvider` unmount.
- **Expected Output:** `lib/cache/store.ts`. Pure module, no React. T012a tests GREEN.
- **Depends on:** T012a

#### T013a — RED: failing unit tests for pre-fetch orchestrator
- **Title:** Tests for `prefetchPageUrls` (mocked SDK boundary)
- **Description:** `lib/url-resolver/prefetch.test.ts`. Build a `mockClient` with `query: vi.fn<ClientSDK['query']>()`. Test cases (full prose in § 10): three SDK keys are queried in parallel with the right `params.path`/`params.query` shapes (`xmc.agent.pagesGetPagePreviewUrl`, `xmc.pages.retrievePage`, `xmc.sites.listHosts`); a successful trio writes `previewUrl`, `publishing`, `liveHost`, and a composed `liveUrl` into the cache slot; `xmc.pages.retrievePage` returning `publishing.hasPublishableVersion=false || publishing.isPublishable=false` yields `liveUrl === null`; a failing `xmc.sites.listHosts` lands `{ error }` in `liveHost` slot WITHOUT corrupting `previewUrl`; `liveUrl` composition uses `new URL(slug, host).toString()` and handles slug `/products/spring` with host `https://www.example.com` → `https://www.example.com/products/spring`. All FAIL until T013b.
- **Expected Output:** Failing test file with the five+ scenarios.
- **Depends on:** T010b, T012b

#### T013b — GREEN: pre-fetch orchestrator (`lib/url-resolver/prefetch.ts`)
- **Title:** Parallel `Promise.allSettled` of preview-url + page-state + listHosts on cache-key change
- **Description:** Per ADR-0006:
  ```ts
  // Inside a useEffect in MarketplaceProvider keyed on (pageInfo.id, pageInfo.version, siteInfo.id, contextId)
  const key = buildCacheKey(pageInfo.id, pageInfo.version);
  if (getEntry(key)) return;          // already pre-fetched; cache hit on back-nav
  setEntry(key, { previewUrl: null, publishing: null, liveHost: null, liveUrl: null });
  const [previewRes, pageRes, hostsRes] = await Promise.allSettled([
    client.query('xmc.agent.pagesGetPagePreviewUrl', { params: { path: { pageId: pageInfo.id }, query: { sitecoreContextId: contextId } } }),
    client.query('xmc.pages.retrievePage', { params: { path: { pageId: pageInfo.id }, query: { site: siteInfo.name, language: pageInfo.language ?? 'en', sitecoreContextId: contextId } } }),
    client.query('xmc.sites.listHosts', { params: { path: { siteId: siteInfo.id }, query: { sitecoreContextId: contextId } } }),
  ]);
  ```
  Map each settled result to `{ value }` or `{ error }`. **Double-unwrap** XMC responses — `.data?.data` (`client.md § 8b`). For `xmc.pages.retrievePage`, derive `isPublished` from `publishing.hasPublishableVersion === true && publishing.isPublishable === true` (close approximation of "published to Edge"; refine if field testing shows otherwise — see § 6 R-2). For `xmc.sites.listHosts`, pick the first host whose `kind` indicates the live/delivery channel; if none, store `{ error: new Error('no live host') }`.
  Compose `liveUrl` eagerly: when `publishing.isPublished === true` AND `liveHost` is a string, set `liveUrl = new URL(pageInfo.url ?? '/', liveHost).toString()`. Otherwise `liveUrl = null`.
- **Expected Output:** `lib/url-resolver/prefetch.ts` exporting `prefetchPageUrls(client, contextId, pageInfo, siteInfo): Promise<void>` that writes its results into the cache via `lib/cache/store.ts`. T013a tests GREEN.
- **Depends on:** T013a

#### T014a — RED: failing integration test for Provider pre-fetch wiring
- **Title:** Tests that `prefetchPageUrls` is called on cache-key change and cache hit avoids re-fetch
- **Description:** Component test of `MarketplaceProvider` with stubbed `mockClient`. Scenarios (full prose in § 10): Provider mounts → first cache-key resolves → `prefetchPageUrls` is called once with correct args; advancing the test clock or re-emitting the same `pages.context` → no second `prefetchPageUrls` call (cache hit); changing `pageInfo.version` → fresh `prefetchPageUrls` call against the new key; the test reads cache via the `useCacheEntry(key)` hook to verify post-fetch state. All FAIL until T014b.
- **Expected Output:** Failing test file at `components/providers/marketplace.prefetch.test.tsx`.
- **Depends on:** T013b

#### T014b — GREEN: wire pre-fetch into `MarketplaceProvider`
- **Title:** Call `prefetchPageUrls` on every cache-key change
- **Description:** Inside `MarketplaceProvider`, in a `useEffect` keyed on `[client, appContext, pagesCtx?.pageInfo?.id, pagesCtx?.pageInfo?.version, pagesCtx?.siteInfo?.id]`, compute `key = buildCacheKey(...)`. If cache miss, call `prefetchPageUrls(client, contextId, pageInfo, siteInfo)`. Provider's render reads cache state via a separate `useCacheEntry(key)` hook (also implemented here — small wrapper over `getEntry` with a `useSyncExternalStore` subscription pattern, OR a simpler `useState` re-render trigger driven by the prefetch's resolution). Per ADR-0006 step 8: no cancellation — concurrent navigation is safe because cache is keyed by id+version.
- **Expected Output:** Provider runs pre-fetch on cache-key change; cache has fresh data by the time the user clicks any URL button. T014a tests GREEN.
- **Depends on:** T014a

#### T015 — Clear cache on Provider unmount
- **Title:** Call `clearAll()` in the Provider's effect cleanup
- **Description:** When `MarketplaceProvider` unmounts (panel close / reload), call `clearAll()` from `lib/cache/store.ts` to drop all entries. This satisfies FR-007 ("panel reload clears errors") and ADR-0007 ("cache clears when the panel unmounts"). Add a small Provider-unmount test that asserts `getEntry` returns `undefined` after re-mount (this can extend the T014a test file rather than its own RED step — a one-line addition to the existing test suite).
- **Expected Output:** Cache is empty after Provider remount; cleanup test passes.
- **Depends on:** T012b, T014b

---

### E4 — Clipboard & Local Copy Module

#### T016a — RED: failing unit tests for clipboard module
- **Title:** Tests for `copyTextToClipboard`
- **Description:** `lib/clipboard.test.ts`. Stub `navigator.clipboard.writeText` via `vi.stubGlobal` (or define on `globalThis.navigator` in `vitest.setup.ts`). Cases (full prose in § 10): success — `copyTextToClipboard('hello')` resolves and calls `writeText('hello')` exactly once; rejection — when `writeText` rejects with `DOMException('NotAllowedError')`, the function throws (or its returned promise rejects) preserving the original error; unavailable — when `navigator.clipboard?.writeText` is undefined, the function throws `Error('clipboard-unavailable')` synchronously (or a rejected promise carrying that message); empty string — `copyTextToClipboard('')` is allowed (resolves) and writes empty string; very large string (>100k chars) — function still resolves (no length-clamping). All FAIL until T016b.
- **Expected Output:** Failing test file with five+ scenarios.
- **Depends on:** T008

#### T016b — GREEN: implement `lib/clipboard.ts`
- **Title:** Port pageshot's clipboard pattern; specialize for `string` payloads
- **Description:** Per ADR-0004 — local copy, no shared package, no edits to pageshot. Open `products/pageshot/site/next-app/components/use-copy-image.ts` for reference. Adapt to a **plain function** (not a hook) at `lib/clipboard.ts` exporting:
  ```ts
  export async function copyTextToClipboard(text: string): Promise<void>
  ```
  - Uses `navigator.clipboard.writeText(text)` (not `write([ClipboardItem])` — text is simpler).
  - Throws on rejection (caller maps the throw to error state).
  - Capability check: `typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'` — throws `Error('clipboard-unavailable')` if missing.
- **Expected Output:** `lib/clipboard.ts` with `copyTextToClipboard`. T016a tests GREEN.
- **Depends on:** T016a

---

### E5 — Action Cards

#### T017a — RED: failing component tests for `<ActionCard>`
- **Title:** Tests for the reusable card primitive across all states
- **Description:** `components/quickcopy/ActionCard.test.tsx` using `@testing-library/react`. Cases (full prose in § 10): renders `glyph`, `label`, and `shortcut` chip when given props; `aria-label` matches the expected "Copy <Label> — shortcut Alt+<Letter>" pattern; clicking calls `onActivate` exactly once when `state==='idle'`; pressing `Enter` and `Space` while focused calls `onActivate` (component-level keyboard semantics from the underlying button); `state='disabled'` and `state='error'` both apply `aria-disabled="true"` (NOT the `disabled` HTML attribute — must remain focusable for tooltip); clicking a `state='disabled'` or `state='error'` card does NOT call `onActivate`; tooltip text is reachable via `aria-describedby` when supplied; in `state='copied'` the visible text shows "Copied" (or contains the "Copied!" affordance — assert user-visible string, not class names); under `prefers-reduced-motion: reduce` the rendered DOM does not include any rotation/scale CSS variable (eyeball-equivalent check via `getComputedStyle` or absence of the morph utility class). All FAIL until T017b.
- **Expected Output:** Failing component test file with eight scenarios.
- **Depends on:** T006, T008

#### T017b — GREEN: implement `<ActionCard>` Blok-composed card primitive
- **Title:** Build the reusable square card (ghost button + glyph + label + Kbd chip)
- **Description:** Compose from `@blok/button` (`variant="ghost"`), Geist Mono `<span>` glyph (32px, `text-primary`), Geist Sans `<span>` label (12px), `@blok/kbd` shortcut chip top-left. Props:
  ```ts
  interface ActionCardProps {
    glyph: string;            // ↗ ◉ # Aa
    label: string;            // "Live URL"
    shortcut: string;         // "L"
    state: 'idle'|'copied'|'disabled'|'error';
    tooltip?: string;         // disabled / error reason
    onActivate: () => void;   // click + Enter/Space same handler
    'aria-label': string;     // "Copy Live URL — shortcut Alt+L"
  }
  ```
  Visual states per UI § 5 (idle, hover, focus, active, copied morph, disabled hatched, error inset-ring + ❌). Use Blok semantic tokens only — never raw hex. The 280ms morph (4° rotate + 1.05 scale + glyph swap to `✓` + label "Copied") uses `cubic-bezier(0.34, 1.56, 0.64, 1)`. Reduced-motion fallback strips rotation + scale, keeps colour cross-fade.
- **Expected Output:** `components/quickcopy/ActionCard.tsx` rendering all states. T017a tests GREEN.
- **Depends on:** T017a

#### T018a — RED: failing component tests for `<LiveUrlCard>`
- **Title:** Tests covering published / unpublished / error / pending / clipboard-failure paths
- **Description:** `components/quickcopy/LiveUrlCard.test.tsx`. Stub `useCacheEntry` and `usePagesContext` (via context wrapper) and stub `copyTextToClipboard` from `lib/clipboard`. Cases (full prose in § 10): cache slot with `liveUrl='https://www.example.com/products/spring'` → renders idle, click writes that exact string via `copyTextToClipboard`; cache slot with `publishing={isPublished:false}` → card is `aria-disabled`, tooltip text matches **"Not published to Edge yet — publish the page first."**, click is no-op (clipboard not called); cache slot with `previewUrl={error}` OR `publishing={error}` OR `liveHost={error}` → persistent error with tooltip **"Couldn't fetch Live URL — try switching pages or reloading."**; cache slot all-`null` → disabled with "Loading…" tooltip; click on idle then `clipboard.writeText` rejects → card flips to persistent error state for the current cache key (assert subsequent click is no-op); after a successful copy, the visible text shows "Copied" within the morph window; the morph reverts after 1500ms (use `vi.useFakeTimers()` and advance). All FAIL until T018b.
- **Expected Output:** Failing test file with seven+ scenarios.
- **Depends on:** T014b, T016b, T017b

#### T018b — GREEN: implement Live URL action card
- **Title:** Wire Live URL card to cache + click handler
- **Description:** New `components/quickcopy/LiveUrlCard.tsx`:
  - Read cache state for current key. Compute UI state:
    - `pending` (cache `null`) → disabled with "Loading..." tooltip (transient, distinct from FR-013).
    - `liveUrl` is a string → `idle` (clickable).
    - `publishing.isPublished === false` → disabled with tooltip **"Not published to Edge yet — publish the page first."**
    - Any of the three slots is `Error` (preview-url, publishing, listHosts) → persistent error with tooltip **"Couldn't fetch Live URL — try switching pages or reloading."**
  - On click / `onActivate`: `await copyTextToClipboard(liveUrl); morph "Copied!" 1500ms; revert.` On rejection: switch to error state for current cache key.
  - Glyph: `↗`, shortcut chip: `L`.
- **Expected Output:** `LiveUrlCard.tsx` rendering correct state per cache + dispatching copy correctly. T018a tests GREEN.
- **Depends on:** T018a

#### T019a — RED: failing component tests for `<PreviewUrlCard>`
- **Title:** Same shape as T018a but bound to the `previewUrl` cache slot
- **Description:** `components/quickcopy/PreviewUrlCard.test.tsx`. Cases: `previewUrl='https://preview.example.com/foo'` → idle; click copies that exact string; `previewUrl={error}` → persistent error with tooltip **"Couldn't fetch Preview URL — try switching pages or reloading."**; `previewUrl=null` → disabled with "Loading…" tooltip; clipboard rejection flips card to error state. Critically: assert the cache slot READ is `previewUrl`, NOT `pageInfo.url` (the PRD-specified source per FR-003). All FAIL until T019b.
- **Expected Output:** Failing test file.
- **Depends on:** T014b, T016b, T017b

#### T019b — GREEN: implement Preview URL action card
- **Title:** Wire Preview URL card
- **Description:** Same shape as T018b but bound to `previewUrl` cache slot. Glyph `◉`, shortcut `P`. Disabled-pending tooltip if cache slot is `null`. Error tooltip **"Couldn't fetch Preview URL — try switching pages or reloading."**
- **Expected Output:** `components/quickcopy/PreviewUrlCard.tsx`. T019a tests GREEN.
- **Depends on:** T019a

#### T020a — RED: failing component tests for `<ItemIdCard>`
- **Title:** Tests for Item ID card (no-fetch path)
- **Description:** `components/quickcopy/ItemIdCard.test.tsx`. Cases: `pageInfo.id='abc-123-DEF'` → click writes the EXACT string with no wrapping braces and no whitespace (`copyTextToClipboard` called with `'abc-123-DEF'`); `pageInfo.id=undefined` → card is disabled with tooltip **"Page context not ready — wait or reload."**, click is no-op; `pageInfo.id=''` → also disabled (empty string treated as missing); no SDK / network is invoked under any branch (assert `mockClient.query` was never called for any reason during this card's render+click); clipboard rejection flips card to persistent error. All FAIL until T020b.
- **Expected Output:** Failing test file.
- **Depends on:** T009b, T016b, T017b

#### T020b — GREEN: implement Item ID action card
- **Title:** Wire Item ID card (no fetch)
- **Description:** Reads `pageInfo.id` directly from `usePagesContext()`. Disabled with tooltip **"Page context not ready — wait or reload."** if id is missing. Click writes `pageInfo.id` to clipboard with no braces, no whitespace. Glyph `#`, shortcut `I`.
- **Expected Output:** `components/quickcopy/ItemIdCard.tsx`. T020a tests GREEN.
- **Depends on:** T020a

#### T021a — RED: failing component tests for `<PageTitleCard>`
- **Title:** Tests for Page Title card with displayName-then-name fallback
- **Description:** `components/quickcopy/PageTitleCard.test.tsx`. Cases: `displayName='Spring Campaign'` → click copies `'Spring Campaign'` (NOT `pageInfo.name`); `displayName=undefined, name='spring-campaign'` → click copies `'spring-campaign'` (fallback); both missing/empty → disabled with **"Page context not ready — wait or reload."**; whitespace-only displayName (`'   '`) treated as missing → falls back to name; no SDK call; clipboard rejection flips to persistent error. All FAIL until T021b.
- **Expected Output:** Failing test file.
- **Depends on:** T009b, T016b, T017b

#### T021b — GREEN: implement Page Title action card
- **Title:** Wire Page Title card (no fetch, displayName fallback)
- **Description:** Reads `pageInfo.displayName ?? pageInfo.name` per FR-004. Disabled with tooltip **"Page context not ready — wait or reload."** if both are missing/empty. Glyph `Aa`, shortcut `T`.
- **Expected Output:** `components/quickcopy/PageTitleCard.tsx`. T021a tests GREEN.
- **Depends on:** T021a

#### T022a — RED: failing layout test for `<ActionGrid>`
- **Title:** Tests that the grid renders all four cards in the correct order
- **Description:** `components/quickcopy/ActionGrid.test.tsx`. Cases: rendering the grid yields exactly four `data-testid="action-card"` (or accessible-name-based) elements; their accessible names appear in DOM order matching Live → Preview → Item → Title; the grid container has the hairline-gridlines class (or `gap-px` token) — assert via DOM class or computed style; no horizontal overflow at a 320px viewport (set `Object.defineProperty(window, 'innerWidth', { value: 320 })` and assert `scrollWidth <= clientWidth` after rendering, OR a snapshot pinned at 320px). All FAIL until T022b.
- **Expected Output:** Failing test file.
- **Depends on:** T018b, T019b, T020b, T021b

#### T022b — GREEN: implement 2×2 grid layout
- **Title:** Compose the four cards in CSS-grid 2×2 with hairline gridlines
- **Description:** Per UI § 2:
  - Outer: `gap-px bg-border` to draw 1px hairlines.
  - Inner: `gap-2` inside cards for content padding.
  - Order: Live (TL), Preview (TR), Item (BL), Title (BR).
  - Container width: 320px panel - 32px outer padding = 288px → two ~140px cells.
- **Expected Output:** `components/quickcopy/ActionGrid.tsx` rendering the four cards. T022a tests GREEN.
- **Depends on:** T022a

---

### E6 — Share Link Split-Button

#### T023a — RED: failing unit tests for share-link format builders
- **Title:** Tests that pin Markdown + Plain-text shapes including the em-dash codepoint
- **Description:** `lib/share-link/formats.test.ts`. Cases (full prose in § 10): `shareLinkMarkdown('Foo', 'https://x') === '[Foo](https://x)'` (assert no trailing whitespace, no escaping); `shareLinkMarkdown('A) B', 'https://x')` keeps the title verbatim including the literal closing paren (FR-005 says "no escaping" — exact string); `shareLinkPlainText('Foo', 'https://x') === 'Foo \u2014 https://x'`; the separator is **U+2014 EM DASH** specifically, asserted via `result.charCodeAt(4) === 0x2014` (NOT 0x2013 en-dash, NOT 0x002D hyphen-minus); single space either side of the em-dash; both functions handle empty title / empty url without throwing (return predictable strings). All FAIL until T023b.
- **Expected Output:** Failing test file with five+ scenarios.
- **Depends on:** T008

#### T023b — GREEN: implement share-link format builders
- **Title:** Pure functions for Markdown + Plain-text composition
- **Description:** Per FR-005 + ADR-0010:
  ```ts
  export const shareLinkMarkdown = (title: string, url: string): string =>
    `[${title}](${url})`;                                         // no trailing whitespace
  export const shareLinkPlainText = (title: string, url: string): string =>
    `${title} \u2014 ${url}`;                                     // em-dash U+2014, single space either side
  ```
  No template variations, no escaping inside the title (FR-005 is explicit — exact strings). Pure, easy to unit-test.
- **Expected Output:** `lib/share-link/formats.ts`. T023a tests GREEN.
- **Depends on:** T023a

#### T024a — RED: failing unit tests for `getShareLinkUrl`
- **Title:** Tests for the Live-then-Preview fallback selector
- **Description:** `lib/share-link/select-url.test.ts`. Cases (full prose in § 10): `liveUrl='https://live'` and `previewUrl='https://preview'` → returns `'https://live'` (Live wins); `liveUrl=null, previewUrl='https://preview'` → returns `'https://preview'` (preview fallback per US-005); both `null` → returns `null` (caller handles disabled); `liveUrl={error}, previewUrl='https://preview'` → returns `'https://preview'` (preview is still a healthy fallback when only Live errored — IMPORTANT: this is the US-005 behavior, the Share Link works as long as preview is healthy); both `{error}` → returns `null` (caller flips to persistent error); explicit case for the publishing-not-published path: `liveUrl=null` because `publishing.isPublished===false`, `previewUrl='https://preview'` → returns `'https://preview'` AND a separate `isPreviewFallback` flag (or second return value / wrapper object) so the card knows to render the **"Page not live — link points to preview"** tooltip. All FAIL until T024b.
- **Expected Output:** Failing test file with six scenarios.
- **Depends on:** T011b

#### T024b — GREEN: implement `getShareLinkUrl`
- **Title:** `getShareLinkUrl(state: PageDerivedState): { url: string | null; isPreviewFallback: boolean; isError: boolean }`
- **Description:** Per US-005 / ADR-0006: returns `{ url: state.liveUrl, isPreviewFallback: false, isError: false }` when liveUrl is a non-null string; else returns the previewUrl when that cache slot is a string with `isPreviewFallback: true` (the consumer renders the "Page not live — link points to preview" tooltip); returns `{ url: null, isPreviewFallback: false, isError: true }` when both slots carry `Error`; else `{ url: null, isPreviewFallback: false, isError: false }` (loading). The richer return shape (vs the original "string | null") is a QA-recommended adjustment that avoids the consumer doing redundant cache-state inspection — see § 10 explanation.
- **Expected Output:** `lib/share-link/select-url.ts`. T024a tests GREEN.
- **Depends on:** T024a

#### T025a — RED: failing component tests for `<ShareLinkSplit>`
- **Title:** Tests covering split-button ARIA + Markdown/Plain-text dispatch + Alt+S contract
- **Description:** `components/quickcopy/ShareLinkSplit.test.tsx`. Cases (full prose in § 10): the container has `role="group"` and `aria-label="Share link"`; primary button click writes the Markdown shape `[Title](URL)` via `copyTextToClipboard`; caret button has `aria-haspopup="menu"` and `aria-expanded` toggles when opened; opening the dropdown moves focus to the first menu item (Markdown) — assert `document.activeElement` matches; `Escape` closes the menu and returns focus to the caret button; menu item "Copy as Plain text" → click copies `'Title \u2014 URL'`; menu item "Copy as Markdown" → copies `'[Title](URL)'`; **`Alt+S` triggers the primary action (Markdown) and does NOT open the dropdown** (mount the component inside a parent that wires `useShortcuts`, fire `keydown` with `altKey:true, key:'s'`, assert `clipboard.writeText('[Title](URL)')` was called and the menu is NOT open); when the page is unpublished AND preview is healthy → primary's tooltip text matches **"Page not live — link points to preview"**; when both URLs error → BOTH primary AND caret are `aria-disabled="true"` and clicks are no-ops, tooltip on primary matches **"Couldn't compose Share Link — try switching pages or reloading."**; menu items have `role="menuitem"` (Radix default — assert via `getAllByRole('menuitem')`). All FAIL until T025b.
- **Expected Output:** Failing test file with ten+ scenarios.
- **Depends on:** T014b, T016b, T017b, T023b, T024b

#### T025b — GREEN: implement `<ShareLinkSplit>`
- **Title:** Build the split-button per ADR-0010
- **Description:** Two adjacent Blok `Button`s wrapped in `<div role="group" aria-label="Share link">`:
  - Primary `<Button variant="default">` — `flex-1`, rounded-left only, label "Share Link", glyph `↑` (Geist Mono 16px), shortcut chip `S`. `onClick` = copy default Markdown.
  - Caret `<Button variant="default" size="sm">` — `w-8`, rounded-right only, `aria-label="Choose share-link format"`, `aria-haspopup="menu"`. Wrapped in `<DropdownMenu>` (Blok primitive — Radix wrapper). Menu items: "Copy as Markdown" (default — checked indicator), "Copy as Plain text".
  - Disabled / error states: BOTH primary and caret disabled. `aria-disabled="true"` (not `disabled`) so tooltip remains readable.
  - Tooltip on primary when not live: **"Page not live — link points to preview"** (per US-005).
  - Tooltip on persistent error: **"Couldn't compose Share Link — try switching pages or reloading."**
  - Both copy paths read the resolved URL from `getShareLinkUrl(state)` and call `copyTextToClipboard(...)`. Morph on success — strip-shaped morph (no rotation, scale 1.02 only, label flips to "Copied") per UI § 5e.
- **Expected Output:** `components/quickcopy/ShareLinkSplit.tsx`. T025a tests GREEN.
- **Depends on:** T025a

---

### E7 — Theme & Persistence

#### T026 — Theme tokens in `globals.css`
- **Title:** Define Blok semantic-token palette in `:root` + `.dark`
- **Description:** Per UI § 4a, in `app/globals.css` define HSL values for `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--ring`, `--grain-color` — once for `:root` (light) and once for `.dark` (dark). Every other rule **must** reference via `hsl(var(--token))` or `hsl(var(--token) / <alpha>)`. **No raw hex anywhere outside this token block.** Use Blok-default values (the scaffold may already provide some — extend rather than replace).
- **Expected Output:** Updated `globals.css`. `grep` for `#[0-9a-f]{3,8}` outside `globals.css` returns nothing.
- **Depends on:** T001

#### T027a — RED: failing tests for `useTheme`
- **Title:** Tests for default-dark, persistence, and `<html class="dark">` mutation
- **Description:** `hooks/useTheme.test.ts` using `renderHook` + `act` from `@testing-library/react`. Stub `localStorage` per test (`vi.stubGlobal('localStorage', ...)` or `localStorage.clear()` in `beforeEach`). Cases (full prose in § 10): empty localStorage on mount → `theme === 'dark'` AND `document.documentElement.classList.contains('dark') === true`; localStorage `{ 'quickcopy.theme': 'light' }` on mount → `theme === 'light'` AND the `dark` class is REMOVED; calling `toggle()` flips `theme` to `'light'`, removes the `dark` class, and writes `'light'` to localStorage under key `quickcopy.theme`; calling `toggle()` again flips back to `'dark'` and writes `'dark'`; calling `useTheme` server-side (no `window`) does not throw — initial value is `'dark'` per default. All FAIL until T027b.
- **Expected Output:** Failing test file.
- **Depends on:** T008

#### T027b — GREEN: implement `useTheme` hook + `localStorage` persistence
- **Title:** `hooks/useTheme.ts` — read / write `<html class="dark">`, persist
- **Description:**
  ```ts
  export type Theme = 'dark' | 'light';
  export function useTheme(): { theme: Theme; toggle: () => void };
  ```
  - On mount: read `localStorage['quickcopy.theme']` (key per FR-010); default to `'dark'` if absent.
  - Apply by toggling `document.documentElement.classList.add/remove('dark')`.
  - `toggle()` flips and writes back to localStorage.
  - SSR-safe: read inside `useEffect`, not at render. Initial server render uses `'dark'` (default per UI variant); client hydration may re-apply if user had picked light.
- **Expected Output:** `hooks/useTheme.ts`. T027a tests GREEN.
- **Depends on:** T027a

#### T028a — RED: failing component tests for `<ThemeToggle>`
- **Title:** Tests for the toggle pill's user-visible behavior
- **Description:** `components/quickcopy/ThemeToggle.test.tsx`. Cases (full prose in § 10): mount with default dark → button text contains "Dark" (or shows the dark glyph); `aria-pressed` reflects current theme (e.g. `aria-pressed="true"` when dark, `"false"` when light — pick one and pin it); clicking the pill calls `useTheme().toggle()` (assert via spy) and the `<html>` element's class flips; the displayed label updates from "Dark" to "Light" after click; the pill is keyboard-activatable (Space and Enter both fire toggle). All FAIL until T028b.
- **Expected Output:** Failing test file.
- **Depends on:** T027b

#### T028b — GREEN: implement Theme toggle pill in panel header
- **Title:** Render the `<ThemeToggle>` Blok ghost-button pill
- **Description:** Per UI § 5h: `@blok/button variant="ghost" size="xs"` pill, shows current mode label + glyph (`Dark ⏾` / `Light ☀`). `onClick` calls `toggle()` from `useTheme()`. `aria-pressed` reflects state. Crossfade body bg/fg over 180ms via CSS transition on `body { transition: background-color 180ms, color 180ms }`.
- **Expected Output:** `components/quickcopy/ThemeToggle.tsx` mounted in the panel header (top-right). T028a tests GREEN.
- **Depends on:** T028a

---

### E8 — Keyboard Shortcuts & Legend

#### T029 — Shortcut config constant (`lib/shortcuts/config.ts`)
- **Title:** Single source of truth for the `Alt+L/P/I/T/S` scheme
- **Description:** Per ADR-0008. Export:
  ```ts
  export type ShortcutId = 'live' | 'preview' | 'item' | 'title' | 'share';
  export interface ShortcutBinding {
    id: ShortcutId;
    altKey: true;
    ctrlKey?: false;
    keyLower: 'l' | 'p' | 'i' | 't' | 's';
    label: string;       // "Live URL"
    legendKey: string;   // "L" — what the legend chip shows
  }
  export const SHORTCUTS: readonly ShortcutBinding[] = [...];   // primary scheme
  // Documented fallback (not active in v0.1):
  export const SHORTCUTS_FALLBACK: readonly ShortcutBinding[] = [...]; // Ctrl+Alt+<letter>
  ```
- **Expected Output:** `lib/shortcuts/config.ts`. Both listener and legend import from this file.
- **Depends on:** T008

#### T030a — RED: failing tests for `useShortcuts`
- **Title:** Tests for the single keydown listener (match, guard, preventDefault)
- **Description:** `hooks/useShortcuts.test.ts` using `renderHook` + `fireEvent.keyDown(window, ...)`. Cases (full prose in § 10): pressing `Alt+L` invokes the `live` handler exactly once; pressing `Alt+P` invokes `preview`; `Alt+I`, `Alt+T`, `Alt+S` invoke their respective handlers; **`Alt+S` triggers the share handler — does NOT open a dropdown** (the test only validates that the share handler fires, not the menu — that's T025a's territory); when `document.activeElement` is an `<input>`, `<textarea>`, `<select>`, or a `[contenteditable="true"]` element, NONE of the five combos fire their handlers (suppression contract); `event.preventDefault()` AND `event.stopPropagation()` are called for every recognized combo (assert via spy on the dispatched `KeyboardEvent`); pressing `Ctrl+Alt+L` does NOT fire (we match on altKey AND ctrlKey===false); pressing `Alt+L` while holding `Meta` does NOT fire; pressing keys NOT in the binding (e.g. `Alt+X`) does nothing AND does not call preventDefault; unmount removes the listener (re-fire `Alt+L` after unmount → no handler invocation). All FAIL until T030b.
- **Expected Output:** Failing test file with eight+ scenarios.
- **Depends on:** T029

#### T030b — GREEN: implement `useShortcuts` hook
- **Title:** Single window-level `keydown` listener with editable-element guard
- **Description:** Per ADR-0008:
  - One `useEffect` registers ONE `keydown` listener on `window`.
  - Check `document.activeElement` against `INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable="true"]` — bail without intercepting.
  - Match on `event.altKey === true` AND `event.ctrlKey === false` AND `event.metaKey === false` AND `event.key.toLowerCase() === binding.keyLower`. (Do NOT use `event.code`.)
  - On match: `event.preventDefault()` + `event.stopPropagation()`, then call the registered handler for that `ShortcutId`.
  - On error-state buttons: handler reads cache state and no-ops (consistent with click).
  - Cleanup removes the listener.
- **Expected Output:** `hooks/useShortcuts.ts` taking a `Record<ShortcutId, () => void>` map. Mounted once at the panel root. T030a tests GREEN.
- **Depends on:** T030a

#### T031a — RED: failing component tests for `<ShortcutLegend>`
- **Title:** Tests that the legend renders all five bindings from the constant
- **Description:** `components/quickcopy/ShortcutLegend.test.tsx`. Cases (full prose in § 10): renders exactly five chips matching the `SHORTCUTS` constant; each chip's text content includes the legendKey (`L`, `P`, `I`, `T`, `S`) AND its label (`Live URL`, `Preview URL`, `Item ID`, `Page Title`, `Share Link`); chips render in the canonical order Live → Preview → Item → Title → Share; the legend element is always visible (no `aria-hidden`, no `display: none` on the parent — assert via `getByRole` or visible text query); legend is not behind a "help" or "expand" affordance — `getAllByRole('button')` returns zero buttons inside the legend. All FAIL until T031b.
- **Expected Output:** Failing test file.
- **Depends on:** T029

#### T031b — GREEN: implement `<ShortcutLegend>` bottom strip
- **Title:** Compact legend rendered from `SHORTCUTS`
- **Description:** Per UI § 2 / FR-012: a single line at the bottom rendering each binding as `<Kbd>{legendKey}</Kbd> {label}` separated by `·`. Always visible; not collapsible. Uses Blok `@blok/kbd`. Geist Sans 9px uppercase tracking-wide.
- **Expected Output:** `components/quickcopy/ShortcutLegend.tsx`. T031a tests GREEN.
- **Depends on:** T031a

---

### E9 — Error & Disabled States

#### T032 — Error/disabled tooltip copy module
- **Title:** Centralize all tooltip strings in `lib/i18n/strings.ts`
- **Description:** Per NFR-009 ("Localization readiness — strings isolated in a single module"). Export:
  ```ts
  export const STRINGS = {
    liveUrl: { label: 'Live URL', errorTooltip: '...', disabledUnpublished: '...' },
    previewUrl: { label: 'Preview URL', errorTooltip: '...' },
    itemId: { label: 'Item ID', disabledNoContext: '...' },
    pageTitle: { label: 'Page Title', disabledNoContext: '...' },
    shareLink: {
      label: 'Share Link',
      tooltipPreviewFallback: 'Page not live — link points to preview',
      errorTooltip: '...',
    },
    common: { copied: 'Copied!', loading: 'Loading…' },
  } as const;
  ```
  Exact tooltip wording is finalized during `/test` (UX writing pass). For task-breakdown stage: use the wording from PRD US-001..US-007 verbatim.
- **Expected Output:** `lib/i18n/strings.ts`. All cards import from here.
- **Depends on:** T008

#### T033 — Persistent error policy enforcement audit (no-test — code-review-only)
- **Title:** Audit all card click handlers for the no-retry contract
- **Description:** Per ADR-0009: every click handler must check the cache slot and **no-op** if it's an `Error`. No `setTimeout`, no exponential backoff, no retry button. The error clears only when cache key changes (id or version) — automatic, no UI affordance. Confirm by reviewing T018b-T021b, T025b handlers. **Audit checks** (also encoded as a regression test in § 10): grep for `setTimeout|setInterval` inside `components/quickcopy/` and `lib/url-resolver/` returns zero matches outside the morph-revert path (which is allowed and is in `ActionCard` only); grep for `\bretry\b` (case-insensitive) returns zero matches in production code; grep for `aria-live` returns matches ONLY inside `StatusLiveRegion.tsx` (per ADR-0009, errors are NOT announced via aria-live).
- **Expected Output:** Audit checklist run + zero non-conformant findings. `console.error('[quickcopy]', err)` calls present (PRD § 9 + NFR-006) but no other side effects.
- **Depends on:** T018b, T019b, T020b, T021b, T025b

---

### E10 — Accessibility & Polish

#### T034a — RED: failing tests for `<StatusLiveRegion>` + `useStatusAnnouncer`
- **Title:** Tests that announcements appear in the live region and clear after 1500ms
- **Description:** `components/quickcopy/StatusLiveRegion.test.tsx`. Cases (full prose in § 10): the rendered region has `role="status"` and `aria-live="polite"`; calling `announce("Live URL copied")` updates the region's text content to that exact string; using `vi.useFakeTimers()` and advancing 1500ms clears the region back to empty; calling `announce(...)` a second time within the 1500ms window resets the timer cleanly (region holds the second message for the full 1500ms from the second call); the region uses `sr-only` (or equivalent visually-hidden class) — assert by checking computed style `position: absolute` + `width: 1px` OR by class assertion. NOTE per ADR-0009: error states are NOT announced via aria-live (this is a SUCCESS-only announcer — assert that calling `announce` with a "failed" message is a CONSCIOUS choice; for v0.1 the announcer only fires on success). All FAIL until T034b.
- **Expected Output:** Failing test file.
- **Depends on:** T032

#### T034b — GREEN: implement `aria-live` status region
- **Title:** Add a polite status region for copy success
- **Description:** Per UI § 6 + ADR-0009 (no aria-live for errors): a single `<div role="status" aria-live="polite" className="sr-only">` mounted at panel root. On copy SUCCESS: announce `"<Label> copied"`. **Per ADR-0009 errors are NOT announced** (the visible button error state is the error surface). Reset to empty after 1500ms.
- **Expected Output:** `components/quickcopy/StatusLiveRegion.tsx` + a `useStatusAnnouncer()` hook returning `{ announce(message: string) }`. T034a tests GREEN.
- **Depends on:** T034a

#### T035 — Reduced-motion + focus-ring + AA-contrast verification (snapshot + jest-axe smoke)
- **Title:** Polish pass against UI § 5 + § 6
- **Description:** Verify all interactive elements:
  - `outline: 2px solid hsl(var(--ring))` with `outline-offset: -2px` on focus (no `outline: none` without replacement).
  - `@media (prefers-reduced-motion: reduce)` strips rotation + scale on the morph.
  - Tab order: theme toggle → Live → Preview → Item → Title → Share Link primary → Share Link caret.
  - Cards ≥120×120px; Share Link strip ≥36px tall × full panel width — meets WCAG AA touch target.
  - **AA contrast check** — install `jest-axe` (or `@axe-core/react`) as dev dep; run a smoke `axe(panel)` against the rendered `<QuickCopyPanel>` in BOTH themes (toggle the `dark` class via `document.documentElement` in the test) and assert zero violations. Eyeball check for any Blok-default contrast that axe doesn't catch.
- **Expected Output:** Polish commit; integration `axe` smoke test added at `components/quickcopy/QuickCopyPanel.a11y.test.tsx`; both themes pass with zero axe violations.
- **Depends on:** T022b, T025b, T028b, T031b

#### T036a — RED: failing integration test for `<QuickCopyPanel>`
- **Title:** End-to-end (jsdom) test of all five actions through one mounted panel
- **Description:** `components/quickcopy/QuickCopyPanel.test.tsx`. Mount `<QuickCopyPanel />` inside a test `<MarketplaceProvider>` wrapper that injects a stubbed `mockClient` + canned `pages.context` `onSuccess` payload + canned XMC query results. Cases (full prose in § 10): all five action cards render with the correct accessible labels; clicking each card writes the PRD-correct payload to `copyTextToClipboard` (Live URL → composed live URL string; Preview URL → previewUrl from `xmc.agent.pagesGetPagePreviewUrl`; Item ID → `pageInfo.id`; Page Title → `pageInfo.displayName`; Share Link primary → `[Title](LiveURL)`); the five `Alt+L/P/I/T/S` shortcuts produce identical clipboard writes; tab order is theme-toggle → Live → Preview → Item → Title → Share-primary → Share-caret (assert by walking `userEvent.tab()` and reading `document.activeElement`); a `pageInfo.version` bump (re-fire `pages.context.onSuccess` with version+1) re-fetches and clears any prior error; a single faked `xmc.pages.retrievePage` rejection puts only the Live URL card into persistent error — Preview, Item, Title, Share (via preview fallback) keep working; this integration suite is the single behavioral guarantee that the slim assembly works before T037 / T038 manual smoke. All FAIL until T036b.
- **Expected Output:** Failing integration test file with seven scenarios.
- **Depends on:** T022b, T025b, T028b, T031b, T034b

#### T036b — GREEN: compose `<QuickCopyPanel>` and replace `/panel` placeholder
- **Title:** Final composition in `app/panel/page.tsx`
- **Description:** New `components/quickcopy/QuickCopyPanel.tsx`:
  ```tsx
  <main className="quickcopy-panel">
    <header><Wordmark /><ThemeToggle /></header>
    <Kicker pageTitle={pageInfo.displayName} siteName={siteInfo.displayName ?? siteInfo.name} />
    <ActionGrid />              {/* T022 */}
    <ShareLinkSplit />          {/* T025 */}
    <ShortcutLegend />          {/* T031 */}
    <StatusLiveRegion />        {/* T034 */}
  </main>
  ```
  Mount `useShortcuts({ live, preview, item, title, share })` at this level — handlers delegate to the same activate functions the cards use. `app/panel/page.tsx` now renders `<QuickCopyPanel />`.
- **Expected Output:** Full panel renders in dev iframe; all five copy actions work end-to-end with `/panel` route. T036a tests GREEN.
- **Depends on:** T036a

#### T037 — Cloud Portal test app registration (manual)
- **Title:** Register QuickCopy as a custom test app
- **Description:** Per ADR-0005 + `marketplace-sdk/testing-debug.md § 2`. In Cloud Portal → App Studio:
  - **App name:** "QuickCopy Test application"
  - **Extension point:** `xmc:pages:contextpanel`
  - **Route URL:** `/panel`
  - **Dev URL:** `http://localhost:3000/panel`
  - **Prod URL:** (empty until `/ship`)
  - **API access:** XMC (Sites, Agent, Pages — narrow to what we use)
  - **Authorization:** Portal-brokered (Mode A)
  - **Install** into the dogfood XM Cloud environment.
- **Expected Output:** App installed; opening Pages editor on a real page shows QuickCopy in the right context panel.
- **Depends on:** T036b

#### T038 — Real-portal smoke against an unpublished + published page
- **Title:** Verify two pages, two themes, all five buttons, error injection
- **Description:** With `npm run dev` + portal install:
  - Open an **unpublished** page → Live URL card disabled with correct tooltip; Preview URL works; Item ID works; Title works; Share Link uses preview URL with the "not live" tooltip.
  - Open a **published** page → all five buttons work.
  - Toggle dark ↔ light → all colours flip cleanly; theme persists across panel reload.
  - Inject an error: temporarily change `xmc.pages.retrievePage` key to an invalid one, confirm Live URL card enters persistent error; revert.
  - Run all five `Alt+<letter>` shortcuts; confirm no Pages-editor side effects (per ADR-0008's QA-conflict pass).
  - Run `npm run lint`, `typecheck`, `test`, `build` once more.
- **Expected Output:** Smoke PASS; commit. (Failure here = back to specific task; do NOT add retry / loosen contracts.)
- **Depends on:** T037

---

## 4a. User stories mapping

Tests (a-suffix tasks) and implementations (b-suffix tasks) both contribute to each user story; the table lists the b-suffix where applicable since `a` always precedes `b` in the dependency graph.

| User story | Tasks |
|------------|-------|
| **US-001 — Marketer copies Live URL** | T009b, T011b, T012b, T013b, T014b, T016b, T017b, T018b, T032, T034b, T038 |
| **US-002 — Marketer copies Preview URL** | T009b, T011b, T012b, T013b, T014b, T016b, T017b, T019b, T032, T034b, T038 |
| **US-003 — Marketer copies Item ID** | T009b, T016b, T017b, T020b, T032, T034b |
| **US-004 — Marketer copies Page Title** | T009b, T016b, T017b, T021b, T032, T034b |
| **US-005 — PM/ops copies Share Link** | T011b, T014b, T016b, T023b, T024b, T025b, T032, T034b |
| **US-006 — Power user keyboard activation** | T029, T030b, T031b, T035, T036b |
| **US-007 — Theme toggle** | T026, T027b, T028b, T035, T036b |

## 4b. Important Test Cases (QA-strengthened, traceable to Task IDs)

Each line is one case: **scenario → expected outcome (test type, Task ID)**. Detailed prose specs and file locations are in § 10.

### E1 — Scaffold & Bootstrap (no behavioral tests — green-light gate only)
- B-001 — Run `npm run lint && typecheck && test && build` after each scaffold patch → all four scripts pass. (regression, T001-T008)

### E2 — Page Context Subscription
- B-010 — `MarketplaceProvider` mounts under StrictMode → `client.query('pages.context', { subscribe: true })` is called exactly once. (component, T009a/b)
- B-011 — `usePagesContext()` before any `onSuccess` → returns `null`. (component, T009a/b)
- B-012 — After `onSuccess({ pageInfo, siteInfo })` → `usePagesContext()` returns the same payload. (component, T009a/b)
- B-013 — Provider unmount → captured `unsubscribe` invoked AND `client.destroy()` invoked. (component, T009a/b)
- B-014 — `requireContextId(null)` → throws with a useful message. (unit, T010a/b)
- B-015 — `requireContextId({ resourceAccess: [{ context: { live: 'L1' } }] })` → returns `'L1'`. (unit, T010a/b)
- B-016 — `requireContextId({ resourceAccess: [{ context: { preview: 'P1' } }] })` → returns `'P1'` (fallback). (unit, T010a/b)
- B-017 — `requireContextId({ resourceAccess: [{ context: {} }] })` → throws. (unit, T010a/b)
- B-018 — `grep` for `as string|as never|as any` excluding test files → returns no matches except the documented Vitest mock pattern. (regression, T010a/b)

### E3 — URL Resolution & Caching
- B-020 — `buildCacheKey('p1', 2) === 'p1:2'`. (unit, T011a/b)
- B-021 — `buildCacheKey('p1', undefined) === 'p1:noversion'`. (unit, T011a/b)
- B-022 — `buildCacheKey('p1', 0) === 'p1:0'` — zero is a real version, not "noversion". (unit, T011a/b)
- B-023 — `getEntry('missing')` → `undefined`; after `setEntry(k, s)` → returns deep-equal `s`. (unit, T012a/b)
- B-024 — `patchEntry(k, { previewUrl: 'X' })` → merges into existing slot, other fields preserved. (unit, T012a/b)
- B-025 — `clearAll()` → all subsequent `getEntry` reads return `undefined`. (unit, T012a/b)
- B-026 — `prefetchPageUrls` happy path → exactly three SDK keys queried in parallel (`xmc.agent.pagesGetPagePreviewUrl`, `xmc.pages.retrievePage`, `xmc.sites.listHosts`) with the correct `params.path`/`params.query` shapes. (unit, T013a/b)
- B-027 — Successful trio → cache slot shows `previewUrl` string, `publishing.isPublished===true`, `liveHost` string, composed `liveUrl` via `new URL(slug, host).toString()`. (unit, T013a/b)
- B-028 — `xmc.pages.retrievePage` returns `publishing.hasPublishableVersion=false` → `liveUrl===null` AND `publishing.isPublished===false`. (unit, T013a/b)
- B-029 — `xmc.pages.retrievePage` returns `publishing.isPublishable=false` → same as B-028. (unit, T013a/b)
- B-030 — Failed `xmc.sites.listHosts` → `liveHost={error}` AND `previewUrl` still resolves correctly (failures are isolated). (unit, T013a/b)
- B-031 — Failed `xmc.agent.pagesGetPagePreviewUrl` → `previewUrl={error}` AND `liveHost` still resolves. (unit, T013a/b)
- B-032 — Live URL composition `new URL('/products/spring', 'https://www.example.com').toString() === 'https://www.example.com/products/spring'`. (unit, T013a/b)
- B-033 — Live URL composition `new URL('/', 'https://www.example.com').toString() === 'https://www.example.com/'` (root slug). (unit, T013a/b)
- B-034 — Provider mounts → `prefetchPageUrls` called once for the initial cache key. (component, T014a/b)
- B-035 — Provider re-renders with same cache key → `prefetchPageUrls` NOT called again (cache hit). (component, T014a/b)
- B-036 — Same `pageInfo.id`, version `1 → 2` → fresh `prefetchPageUrls` call against the new key. (component, T014a/b)
- B-037 — Provider unmount → `clearAll()` invoked; subsequent `getEntry` for any key returns `undefined`. (component, T015)

### E4 — Clipboard
- B-040 — `copyTextToClipboard('hello')` → `navigator.clipboard.writeText('hello')` called exactly once. (unit, T016a/b)
- B-041 — `writeText` rejects with `DOMException('NotAllowedError')` → `copyTextToClipboard` throws/rejects with the same error preserved. (unit, T016a/b)
- B-042 — `navigator.clipboard?.writeText` is `undefined` → `copyTextToClipboard` throws `Error('clipboard-unavailable')`. (unit, T016a/b)
- B-043 — `copyTextToClipboard('')` → resolves; empty string is a valid payload. (unit, T016a/b)
- B-044 — `copyTextToClipboard(largeString)` (>100k chars) → resolves; no length-clamping. (unit, T016a/b)

### E5 — Action Cards
- B-050 — `<ActionCard>` rendered with `state='idle'` and clicked → `onActivate` called once. (component, T017a/b)
- B-051 — `<ActionCard state='disabled'>` → `aria-disabled="true"` (NOT `disabled` attribute), button still focusable. (component, T017a/b)
- B-052 — `<ActionCard state='disabled'>` clicked → `onActivate` NOT called. (component, T017a/b)
- B-053 — `<ActionCard state='error'>` clicked → `onActivate` NOT called. (component, T017a/b)
- B-054 — `<ActionCard state='copied'>` → visible text shows "Copied" (user-visible behavior, NOT `::after content`). (component, T017a/b)
- B-055 — Tooltip prop passed → reachable via `aria-describedby`. (component, T017a/b)
- B-056 — `prefers-reduced-motion: reduce` set → rendered DOM lacks rotation/scale CSS variables. (component, T017a/b)
- B-057 — Live URL card: cache slot has `liveUrl='https://www.example.com/products/spring'` → card idle, click writes that exact string. (component, T018a/b)
- B-058 — Live URL card: cache slot has `publishing.isPublished===false` → `aria-disabled`, tooltip text exactly **"Not published to Edge yet — publish the page first."**, click is no-op. (component, T018a/b)
- B-059 — Live URL card: cache slot `previewUrl` OR `publishing` OR `liveHost` is `{error}` → persistent error, tooltip exactly **"Couldn't fetch Live URL — try switching pages or reloading."** (component, T018a/b)
- B-060 — Live URL card: clipboard write rejection → card flips to persistent error for current cache key; subsequent click is no-op. (component, T018a/b)
- B-061 — Live URL card: morph "Copied" appears for exactly 1500ms then reverts. (component with fake timers, T018a/b)
- B-062 — Live URL card: second click during morph window → resets the timer (full 1500ms from second click). (component, T018a/b)
- B-063 — Preview URL card reads from `previewUrl` cache slot, NOT from `pageInfo.url`. (component, T019a/b)
- B-064 — Preview URL card: error tooltip text exactly **"Couldn't fetch Preview URL — try switching pages or reloading."** (component, T019a/b)
- B-065 — Item ID card: `pageInfo.id='abc-123-DEF'` → click writes `'abc-123-DEF'` (no braces, no whitespace). (component, T020a/b)
- B-066 — Item ID card: `pageInfo.id` missing → disabled with **"Page context not ready — wait or reload."** (component, T020a/b)
- B-067 — Item ID card: no SDK call invoked under any branch (assert `mockClient.query` never called). (component, T020a/b)
- B-068 — Page Title card: `displayName='Spring Campaign'` → click copies `'Spring Campaign'`. (component, T021a/b)
- B-069 — Page Title card: `displayName=undefined, name='spring'` → click copies `'spring'` (fallback). (component, T021a/b)
- B-070 — Page Title card: both missing → disabled with **"Page context not ready — wait or reload."** (component, T021a/b)
- B-071 — Grid renders exactly four action cards in DOM order Live → Preview → Item → Title. (component, T022a/b)
- B-072 — Grid: no horizontal overflow at 320px viewport. (component, T022a/b)

### E6 — Share Link Split-Button
- B-080 — `shareLinkMarkdown('Foo', 'https://x') === '[Foo](https://x)'`. (unit, T023a/b)
- B-081 — `shareLinkPlainText('Foo', 'https://x') === 'Foo \u2014 https://x'` — em-dash codepoint U+2014 verified via `charCodeAt`. (unit, T023a/b)
- B-082 — Plain-text separator is NEITHER `\u2013` (en-dash) NOR `\u002D` (hyphen-minus). (unit, T023a/b)
- B-083 — Markdown shape: `shareLinkMarkdown('A) B', 'https://x') === '[A) B](https://x)'` — title verbatim, no escaping per FR-005. (unit, T023a/b)
- B-084 — `getShareLinkUrl` with `liveUrl='https://live'` and `previewUrl='https://preview'` → returns Live (Live wins). (unit, T024a/b)
- B-085 — `getShareLinkUrl` with `liveUrl=null, previewUrl='https://preview'` → returns Preview AND `isPreviewFallback===true`. (unit, T024a/b)
- B-086 — `getShareLinkUrl` with both `null` → `url===null, isError===false` (loading). (unit, T024a/b)
- B-087 — `getShareLinkUrl` with both `{error}` → `url===null, isError===true`. (unit, T024a/b)
- B-088 — `getShareLinkUrl` with `liveUrl={error}, previewUrl='https://preview'` → returns Preview (Preview is a healthy fallback per US-005). (unit, T024a/b)
- B-089 — `<ShareLinkSplit>` container has `role="group"` and `aria-label="Share link"`. (component, T025a/b)
- B-090 — Primary click → copies Markdown shape `[Title](URL)`. (component, T025a/b)
- B-091 — Caret button has `aria-haspopup="menu"` and `aria-expanded` toggles when opened. (component, T025a/b)
- B-092 — Opening the dropdown moves focus to first menu item. (component, T025a/b)
- B-093 — `Escape` in open menu → closes menu, returns focus to caret. (component, T025a/b)
- B-094 — Menu item "Copy as Plain text" click → copies `'Title \u2014 URL'`. (component, T025a/b)
- B-095 — Menu items have `role="menuitem"` (Radix default). (component, T025a/b)
- B-096 — `Alt+S` triggers primary action (Markdown) AND does NOT open the dropdown. (component, T025a/b + T030a/b)
- B-097 — Page unpublished, preview healthy → primary tooltip exactly **"Page not live — link points to preview"**. (component, T025a/b)
- B-098 — Both URLs error → primary AND caret both `aria-disabled="true"`; tooltip exactly **"Couldn't compose Share Link — try switching pages or reloading."** (component, T025a/b)
- B-099 — Disabled split-button: clicks (primary or menu) are no-ops; clipboard not invoked. (component, T025a/b)

### E7 — Theme & Persistence
- B-100 — Empty localStorage on mount → `theme==='dark'`, `<html>` has `dark` class. (unit, T027a/b)
- B-101 — `localStorage['quickcopy.theme']='light'` on mount → `theme==='light'`, `<html>` lacks `dark` class. (unit, T027a/b)
- B-102 — `toggle()` from dark → flips to light, removes class, writes `'light'` to localStorage key `quickcopy.theme`. (unit, T027a/b)
- B-103 — `toggle()` from light → flips to dark, adds class, writes `'dark'`. (unit, T027a/b)
- B-104 — Server-side render (no `window`) → no throw, initial value `'dark'`. (unit, T027a/b)
- B-105 — `<ThemeToggle>` mounted with default dark → button text contains "Dark" (or appropriate label). (component, T028a/b)
- B-106 — `<ThemeToggle>` `aria-pressed` reflects theme state. (component, T028a/b)
- B-107 — Click on toggle → calls `useTheme().toggle()`, label flips. (component, T028a/b)
- B-108 — Theme toggle keyboard-activatable (Space and Enter both fire toggle). (component, T028a/b)

### E8 — Keyboard Shortcuts & Legend
- B-110 — `Alt+L` fires `live` handler exactly once. (component, T030a/b)
- B-111 — `Alt+P` fires `preview`; `Alt+I` fires `item`; `Alt+T` fires `title`; `Alt+S` fires `share`. (component, T030a/b)
- B-112 — `Alt+L` while `<input>` has focus → handler NOT called. (component, T030a/b)
- B-113 — `Alt+L` while `<textarea>` has focus → handler NOT called. (component, T030a/b)
- B-114 — `Alt+L` while `[contenteditable="true"]` has focus → handler NOT called. (component, T030a/b)
- B-115 — `Alt+L` while `<select>` has focus → handler NOT called. (component, T030a/b)
- B-116 — Recognized combo → `event.preventDefault()` AND `event.stopPropagation()` called. (component, T030a/b)
- B-117 — `Ctrl+Alt+L` → `live` handler NOT called (we require ctrlKey===false). (component, T030a/b)
- B-118 — `Meta+Alt+L` → handler NOT called. (component, T030a/b)
- B-119 — `Alt+X` (unbound key) → no handler called, no preventDefault. (component, T030a/b)
- B-120 — Listener uses `event.key.toLowerCase()`, not `event.code` (verified by passing `key:'L'` and `key:'l'` — both fire). (component, T030a/b)
- B-121 — Hook unmount → `Alt+L` no longer triggers any handler. (component, T030a/b)
- B-122 — Legend renders exactly five chips. (component, T031a/b)
- B-123 — Each chip's text contains the legendKey (`L/P/I/T/S`) and label (Live URL, Preview URL, Item ID, Page Title, Share Link). (component, T031a/b)
- B-124 — Legend chip order matches Live → Preview → Item → Title → Share. (component, T031a/b)
- B-125 — Legend always visible — no `aria-hidden`, no expand/collapse affordance. (component, T031a/b)

### E9 — Error & Disabled States
- B-130 — Click on a card whose cache slot is `Error` → no-op (clipboard not called). (component, covered in T018a/T019a/T020a/T021a/T025a)
- B-131 — Tooltip on error-state button remains readable on hover/focus (`aria-describedby` resolves). (component, T017a/b)
- B-132 — `grep -r 'setTimeout\|setInterval' lib/url-resolver/ components/quickcopy/` outside the morph-revert path → zero matches. (regression, T033)
- B-133 — `grep -ri '\bretry\b' lib/ components/quickcopy/` excluding tests → zero matches. (regression, T033)
- B-134 — `grep -r 'aria-live' components/quickcopy/` → matches only inside `StatusLiveRegion.tsx`. (regression, T033)
- B-135 — Error on Live URL card does NOT affect Preview, Item, Title, Share (NFR-005). (component, T036a/b)
- B-136 — `pageInfo.version` bump while a card was in error → fresh prefetch fires, error clears automatically. (component, T036a/b)

### E10 — Accessibility & Polish
- B-140 — `<StatusLiveRegion>` has `role="status"` and `aria-live="polite"`. (component, T034a/b)
- B-141 — `announce("Live URL copied")` updates region text exactly. (component, T034a/b)
- B-142 — Region clears after 1500ms (fake timers). (component, T034a/b)
- B-143 — `announce(...)` again within 1500ms → resets timer cleanly. (component, T034a/b)
- B-144 — Errors are NOT announced via `aria-live` (per ADR-0009 — verify no error-path code calls `announce`). (regression, T034a/b)
- B-145 — All interactive elements show a visible focus ring against both themes. (component, T035)
- B-146 — `prefers-reduced-motion: reduce` strips rotation + scale on the morph. (component, T035 / T017a/b)
- B-147 — Tab order: theme-toggle → Live → Preview → Item → Title → Share-primary → Share-caret. (integration, T036a/b)
- B-148 — `jest-axe` smoke against `<QuickCopyPanel>` in dark theme → zero violations. (a11y smoke, T035)
- B-149 — `jest-axe` smoke against `<QuickCopyPanel>` in light theme → zero violations. (a11y smoke, T035)
- B-150 — Real-portal smoke covers both themes, both publication states, all five shortcuts, error injection. (manual E2E, T038)

## 4c. Implementation execution contract (for Developer 08)

### 4c-1. Non-negotiable technical boundaries

- **Extension point lock:** the app registers ONLY at `xmc:pages:contextpanel` (ADR-0002). No other surfaces in v0.1. Route URL is `/panel`.
- **Mode A (portal-brokered) ONLY:** no Auth0, no PKCE, no `.env.local` for SDK auth, no `experimental_createXMCClient`. ADR-0005.
- **Blok-only UI:** every component is a Blok primitive or composed from Blok primitives + Blok semantic tokens. No Tailwind ad-hoc colours, no third-party icons outside Lucide (Nova preset), no raw hex in CSS outside the `:root`/`.dark` token block. ADR-0003.
- **No telemetry / analytics:** zero third-party scripts, zero usage counters in v0.1. NFR-006.
- **No persisted page data:** only `localStorage['quickcopy.theme']` is persisted. No URL caching to localStorage. NFR-007.
- **Clipboard module is local:** `lib/clipboard.ts` is a copy of pageshot's pattern. No edits to pageshot. No shared package. ADR-0004.
- **Persistent error, no retry:** ADR-0009. No `setTimeout` retry, no exponential backoff, no "try again" button, no `aria-live` for errors (the visible button state is the error surface). The error clears only when cache key changes.
- **Version-keyed cache, no TTL, no manual refresh:** ADR-0007. Cache key is `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`.
- **Iframe-scoped keyboard listeners, single `keydown` handler, editable-element guard:** ADR-0008. Match on `event.key.toLowerCase()`, NOT `event.code`. `preventDefault()` on every recognized combo.
- **Split-button is composed**, not a single element with two click zones: ADR-0010 (a single button with two click zones is an a11y anti-pattern).
- **No `as string` / `as never` / `as any` casts on SDK return values:** use `requireContextId` typed helper for `sitecoreContextId`; use guard clauses elsewhere. `client.md § 8a`, `xmc.md § 12g`. The only allowed cast is on Vitest mock resolved values (`as never`) per `client.md § 9b`.
- **SDK is client-only:** every file that touches `ClientSDK` is `'use client'`. No SDK in server components or API routes. `client.md § 8d`.

### 4c-2. ADR one-liners

- **ADR-0001 — Use ADRs as architecture backbone:** ADRs ARE the architecture for QuickCopy v0.1. Treat them as authoritative.
- **ADR-0002 — Extension point `xmc:pages:contextpanel` (only):** register at this point alone; no fullscreen, no dashboard, no customfield, no standalone in v0.1.
- **ADR-0003 — Blok as the only UI framework:** every primitive is `@blok/*` or composed from Blok tokens. No Tailwind colours, no shadcn outside the Blok-shipped components.
- **ADR-0004 — Local clipboard module, no shared package, no pageshot edits:** copy pageshot's pattern into `lib/clipboard.ts`. Don't edit pageshot. Don't extract a shared package.
- **ADR-0005 — Marketplace Client-Side scaffold (Scaffold 2), nested `next-app/` (no flatten), mirror pageshot:** `npx shadcn@latest add ... quickstart-with-client-side-xmc.json`. Apply P-019 + P-027 + Vitest stack + Chrome PNA headers. App root is `products/quickcopy/site/next-app/`.
- **ADR-0006 — Live URL composition: parallel pre-fetch on `pageInfo.id` change, in-memory `Map` cache:** issue three parallel SDK calls (`pagesGetPagePreviewUrl`, `pages.retrievePage`, `sites.listHosts`) via `Promise.allSettled` on every cache-key change. Compose `liveUrl` eagerly via `new URL(slug, host)`. Click is a no-fetch cache read.
- **ADR-0007 — Cache invalidation: version-based key (`pageInfo.id` + `pageInfo.version`), no TTL, no manual refresh:** key is `${id}:${version ?? 'noversion'}`. New cache slot on key change auto-clears errors. Cache empties on Provider unmount.
- **ADR-0008 — Keyboard shortcut scheme `Alt+L/P/I/T/S` (primary), `Ctrl+Alt+<letter>` (named fallback):** iframe-scoped, editable-element guard, `preventDefault()` on every recognized combo. Match `event.key.toLowerCase()` (NOT `event.code`). Single `keydown` handler.
- **ADR-0009 — Error-state policy: persistent per-button, no auto-retry, no backoff, no manual retry button:** click on error-state button is a no-op. Error clears only on cache-key change. Use `aria-disabled` (not `disabled`) for screen-reader access to the tooltip.
- **ADR-0010 — Share Link split-button: compose Blok Button + DropdownMenu, NOT a custom split primitive:** two real buttons in `<div role="group" aria-label="Share link">`. Primary copies Markdown (default). Caret opens a Blok DropdownMenu. `Alt+S` triggers the primary action — does NOT open the dropdown. Both primary and caret share disabled / error states.

### 4c-3. Stack / tooling specifics

- **Workspace path:** all dev runs from `products/quickcopy/site/next-app/` — the nested `next-app/` is intentional (mirror pageshot, ADR-0005).
- **Package manager:** `npm` (matches pageshot — `package-lock.json`, not `pnpm-lock.yaml`).
- **Node:** 18+ (per scaffold prerequisites).
- **Test runner:** **Vitest** (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`).
- **Lint:** ESLint 9 (`eslint-config-next`).
- **Typecheck:** `tsc --noEmit`.
- **Scripts** (in `package.json` after T004):
  ```json
  {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
  ```
- **Scaffold command (Scaffold 2 — Marketplace Client-Side, agent-runnable):**
  ```bash
  yes '' | npx --yes shadcn@latest add \
    https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json \
    --yes \
    --cwd C:/Projects/agentic/agentic.hahn-solo/products/quickcopy/site
  ```
  Prompt answers: Framework=Next.js, Project name=`next-app` (do NOT rename), Component library=Radix, Preset=Nova (Lucide / Geist).
- **Mandatory post-scaffold patches** (T002–T005):
  - **P-019** — fix `extention` → `extension` and `your app's` → `your app&apos;s` in `components/providers/marketplace.tsx`.
  - **P-027** — Nova Badge uses `colorScheme="danger"` etc., NOT shadcn `variant="destructive"`. Audit any Badge usage; QuickCopy may need none.
  - **Vitest stack** — install Vitest + Testing Library + jsdom + plugin-react; add `vitest.config.ts` + `vitest.setup.ts`; add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `tsconfig.json`.
  - **Chrome PNA headers** in `next.config.mjs` — four headers (`Access-Control-Allow-Private-Network: true`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: ...`, `Access-Control-Allow-Headers: ...`). Do NOT combine `Origin: *` with `Allow-Credentials: true`. HTTP is fine for Mode A.
- **Dev loop:**
  ```bash
  cd products/quickcopy/site/next-app
  npm run dev
  # then in Cloud Portal: install QuickCopy Test application → opens iframe at http://localhost:3000/panel
  ```
- **Cloud Portal registration (test app):** App name `QuickCopy Test application` · Extension point `xmc:pages:contextpanel` · Route URL `/panel` · Dev URL `http://localhost:3000/panel` · API access XMC (Sites + Agent + Pages, narrow) · Authorization Mode A (portal-brokered).

### 4c-4. UI implementation notes

- **Visual source of truth:** `products/quickcopy/pocs/poc-v2/` — open `index.html`, `styles.css`, `app.js` while implementing to match the intended look-and-feel. **The clickdummy wins on visual details when the design spec text and the clickdummy diverge.** Reimplement in Blok-native primitives — semantic tokens map 1:1; Geist mappings come from `next/font/google`.
- **Layout:** 320px-wide panel; slim header (32px) with wordmark "QUICKCOPY" + theme toggle pill; kicker line `<page title> · <site name>`; **2×2 grid** of square action cards over a diagonal gradient mesh (hairline `bg-border` gridlines via `gap-px` + `gap-2` cell padding); **wide Share Link strip** (slightly inset, `mx-2`); shortcut **legend strip** at the bottom. Vertical budget ~432px — fits the typical 480-560px Marketplace right-rail without scroll.
- **Blok semantic tokens used:** `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--ring`. Plus `--grain-color` for the SVG turbulence overlay. Reference via `hsl(var(--token))` or `hsl(var(--token) / <alpha>)` — no raw hex outside the `:root` / `.dark` blocks in `globals.css`.
- **Gradient mesh:** behind the 2×2 grid only. CSS `radial-gradient` with three lobes — `--primary @ 0.10/0.18` (top-left), `--accent @ 0.08/0.12` (mid), `--primary @ 0.06/0.10` (bottom-right). Light/dark alphas differ per UI § 4a.
- **Grain overlay:** inline SVG `<feTurbulence>` data-URI, `opacity-[0.022]` light / `0.03` dark, `pointer-events-none`.
- **Typography (`next/font/google`):**
  - **Geist Sans** → `--font-sans` (variable axis 300..900): wordmark uppercase 11px/500 tracking 0.18em; kicker title 13px/600 tracking-tight; kicker site (after `·`) 12px/400 at `--foreground/0.7`; card label 12px/500 tracking-tight; Share Link label 13px/600; legend captions 9px/500 uppercase tracking-wide.
  - **Geist Mono** → `--font-mono` (variable axis 400..700): card glyphs (↗ ◉ # Aa) at 32px/600 in `--primary`; Share Link glyph (↑) 16px/500; Kbd chips 10px/500; demo-status / value previews 11px/500.
  - Mono rule: glyphs, Kbd chips, value previews, environmental labels (status, caption, wordmark). Everything else is Geist Sans.
- **Components (Blok primitives):**
  - `@blok/button` — action cards (`variant="ghost"` base) + Share Link primary + caret + theme toggle (`variant="ghost"`).
  - `@blok/icon-button` — alternative for caret if needed.
  - `@blok/dropdown` — Share Link format menu (Radix wrapper, `align="end"`, `sideOffset={4}`).
  - `@blok/tooltip` — disabled / error reasons.
  - `@blok/kbd` — shortcut chips on cards + legend strip.
- **Interaction states (per UI § 5):**
  - **Idle:** card hairline `--border`; mesh shows through. Glyph `--primary`. Label `--foreground/0.8`.
  - **Hover:** inset 1px ring `--primary/0.4`, bg `--primary/0.08`. Glyph nudges `+0.5px Y` over 120ms `cubic-bezier(0.2, 0.8, 0.2, 1)`. No scale.
  - **Focus:** `outline: 2px solid hsl(var(--ring))`, `outline-offset: -2px`.
  - **Active:** card scales `0.98` over 80ms.
  - **Copied morph (cards):** rotate `4deg` + scale `1.05` peak at 140ms, settle to 0/1 at 280ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`. Glyph swaps to `✓`. Bg tints `--primary/0.14`, inset ring `--primary/0.5`. Label swaps to "Copied". Hold 1500ms (FR-008). Cross-fade revert over 120ms.
  - **Copied morph (Share Link):** scale `1.02` (no rotation — strip is wide). Label flips "Share Link" → "Copied". Strip retains `bg-primary`; inset ring `--primary-foreground/0.4`.
  - **Disabled:** diagonal hatched overlay via `repeating-linear-gradient(45deg, transparent 0 6px, hsl(var(--muted-foreground) / 0.18) 6px 7px)`. Glyph `opacity-50`, label `opacity-60`. `aria-disabled="true"`. `cursor-not-allowed`. Tooltip on hover/focus (FR-013).
  - **Error (persistent — ADR-0009):** `box-shadow: inset 0 0 0 2px hsl(var(--destructive))`. Glyph swaps to `❌` in `--destructive`. Label swaps to "Failed". Tooltip carries the error reason. **No auto-retry.** Persists until cache key changes.
  - **Theme switch:** crossfade body bg/fg over 180ms; toggle pill flips `<html class="dark">`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` strips rotation + scale; the morph becomes a colour + label cross-fade only.

### 4c-5. File / module structure and naming conventions

App root: `products/quickcopy/site/next-app/`.

```
products/quickcopy/site/next-app/
├── app/
│   ├── layout.tsx                        # Geist fonts + <MarketplaceProvider>
│   ├── globals.css                       # Blok semantic tokens (:root + .dark)
│   ├── page.tsx                          # scaffold default — leave or thin marketing landing
│   └── panel/
│       └── page.tsx                      # `xmc:pages:contextpanel` route — renders <QuickCopyPanel />
├── components/
│   ├── providers/
│   │   └── marketplace.tsx               # extends scaffold to subscribe pages.context (Path A)
│   ├── ui/                               # shadcn / Blok primitives shipped by scaffold
│   └── quickcopy/                        # all QuickCopy components live here
│       ├── QuickCopyPanel.tsx            # top composition (T036)
│       ├── Wordmark.tsx
│       ├── Kicker.tsx
│       ├── ThemeToggle.tsx               # T028
│       ├── ActionCard.tsx                # reusable card (T017)
│       ├── ActionGrid.tsx                # 2×2 grid (T022)
│       ├── LiveUrlCard.tsx               # T018
│       ├── PreviewUrlCard.tsx            # T019
│       ├── ItemIdCard.tsx                # T020
│       ├── PageTitleCard.tsx             # T021
│       ├── ShareLinkSplit.tsx            # T025
│       ├── ShortcutLegend.tsx            # T031
│       └── StatusLiveRegion.tsx          # T034
├── hooks/
│   ├── useTheme.ts                       # T027
│   ├── useShortcuts.ts                   # T030
│   └── useStatusAnnouncer.ts             # T034
├── lib/
│   ├── clipboard.ts                      # T016 — local copy of pageshot pattern (text only)
│   ├── marketplace/
│   │   └── require-context-id.ts         # T010 — typed helper, no `as string`
│   ├── cache/
│   │   ├── types.ts                      # T011 — CacheKey, PageDerivedState, CacheValue<T>, buildCacheKey
│   │   └── store.ts                      # T012 — Map + getEntry/setEntry/patchEntry/clearAll
│   ├── url-resolver/
│   │   └── prefetch.ts                   # T013 — parallel SDK calls + eager liveUrl composition
│   ├── share-link/
│   │   ├── formats.ts                    # T023 — shareLinkMarkdown, shareLinkPlainText
│   │   └── select-url.ts                 # T024 — getShareLinkUrl
│   ├── shortcuts/
│   │   └── config.ts                     # T029 — SHORTCUTS, SHORTCUTS_FALLBACK
│   └── i18n/
│       └── strings.ts                    # T032 — all tooltip/label copy
├── next.config.mjs                        # PNA headers (T005)
├── package.json                           # scripts + deps
├── tsconfig.json                          # types: ["vitest/globals", "@testing-library/jest-dom"]
├── vitest.config.ts
└── vitest.setup.ts
```

**Naming conventions:**
- Components: `PascalCase.tsx`. Co-located test: `PascalCase.test.tsx`.
- Hooks: `useFoo.ts` + `useFoo.test.ts`.
- Library modules: `kebab-case.ts` + `kebab-case.test.ts` co-located.
- All SDK-touching files start with `'use client';`.
- All exported strings live in `lib/i18n/strings.ts` (NFR-009 localization readiness).

### 4c-6. Integration and API contract notes

All SDK calls run via `client.query(...)` or `client.mutate(...)` from `@sitecore-marketplace-sdk/client` with module `XMC` registered in `ClientSDK.init({ modules: [XMC] })`. Mode A — wrapped in `params:`. Double-unwrap responses (`result.data?.data` for XMC keys). Get `sitecoreContextId` via `requireContextId(appCtx)` (T010).

**`pages.context` subscription (Path A — `client.md § 6a`):**
```ts
const res = await client.query('pages.context', {
  subscribe: true,
  onSuccess: (data) => { /* data: PagesContext { siteInfo, pageInfo } */ },
  onError:   (err)  => { console.error('[quickcopy][pages.context]', err); },
});
const teardown = res.unsubscribe;        // optional; only present when subscribe: true
```
- `PagesContext` shape (per `client.md § 4 PagesContext`):
  - `siteInfo?: { id?: string; name?: string; displayName?: string; language?: string; supportedLanguages?: string[]; ... }`
  - `pageInfo?: { id?: string; name?: string; version?: number; displayName?: string; path?: string; url?: string; template?: { ... }; permissions?: { ... }; publishing?: { hasPublishableVersion?: boolean; isPublishable?: boolean } }`
- All fields are optional; guard before use. Never `as string`.

**Preview URL — `xmc.agent.pagesGetPagePreviewUrl` (`xmc.md § 6`):**
```ts
const res = await client.query('xmc.agent.pagesGetPagePreviewUrl', {
  params: {
    path: { pageId: pageInfo.id },
    query: { sitecoreContextId: contextId },
  },
});
const previewUrl = res.data?.data;       // typed string-ish; treat as `string | undefined`
```

**Live publication status — `xmc.pages.retrievePage` (`xmc.md § 5`):**
The SDK does not expose a dedicated `pagesGetPageLive` key. We use `xmc.pages.retrievePage` and read its `publishing` field to decide if the page is live. Note the **lowercase** `site` / `language` (NOT capitalized — `retrievePageState` is the only key with capitalized casing per `xmc.md § 5` warning).
```ts
const res = await client.query('xmc.pages.retrievePage', {
  params: {
    path: { pageId: pageInfo.id },
    query: {
      site: siteInfo.name,
      language: pageInfo.language ?? siteInfo.language ?? 'en',
      sitecoreContextId: contextId,
    },
  },
});
const publishing = res.data?.data?.publishing;      // { hasPublishableVersion?, isPublishable? }
const isPublished = !!publishing?.hasPublishableVersion && !!publishing?.isPublishable;
```
**Note for QA / field testing:** these flags are an approximation of "published to Edge". If field testing surfaces false positives/negatives, narrow the rule (e.g. require ALSO `pageInfo.publishing.hasPublishableVersion === true` from the live `pages.context` event) or escalate to a dedicated endpoint discovery. See § 6 R-2.

**Live host — `xmc.sites.listHosts` (`xmc.md § 4`):**
```ts
const res = await client.query('xmc.sites.listHosts', {
  params: {
    path: { siteId: siteInfo.id },
    query: { sitecoreContextId: contextId },
  },
});
const hosts = res.data?.data ?? [];
// Pick the first host whose `kind` indicates the live/delivery channel.
// Field shape: hosts[i] has at minimum { name?: string, hostName?: string, kind?: string, ... }.
// ADR-0006: pick the first delivery host; if none, mark liveHost as Error.
const live = hosts.find(h => h.kind === 'delivery') ?? hosts[0];
const liveHost = live?.hostName ? `https://${live.hostName}` : null;
```
*(Verify the exact field name — `hostName` vs `host` vs `name` — at implementation time by logging the first response. The shape is type-checked by the SDK; let TypeScript guide the property name.)*

**`sitecoreContextId` capture (every XMC call):**
```ts
const appCtx = useAppContext();                                    // from MarketplaceProvider
const contextId = requireContextId(appCtx);                         // throws if missing — T010
// pass contextId to every XMC call's params.query.sitecoreContextId
```
Use `.live` (delivery context) — QuickCopy reads published content. Falls back to `.preview` only if `.live` is absent.

**Cache key (ADR-0007):**
```ts
const key = `${pageInfo.id}:${pageInfo.version ?? 'noversion'}`;
```

**Share Link format strings (FR-005, ADR-0010):**
- **Markdown:** ``[`${title}`](`${url}`)`` → e.g. `[Spring Campaign Landing Page](https://www.example.com/products/spring)`. No trailing whitespace.
- **Plain text:** `` `${title} \u2014 ${url}` `` → e.g. `Spring Campaign Landing Page — https://www.example.com/products/spring`. Em-dash codepoint U+2014, single space either side. **NOT a hyphen-minus, NOT an en-dash.**

**Live URL composition (ADR-0006):**
```ts
const liveUrl = (publishing.isPublished && typeof liveHost === 'string')
  ? new URL(pageInfo.url ?? '/', liveHost).toString()
  : null;
// `new URL` handles slug leading/trailing slash + percent-encoding correctly. Never raw concatenation.
```

**`localStorage` key:** `quickcopy.theme` (FR-010). Values: `'dark' | 'light'`. Default on missing: `'dark'`. NO other keys are persisted.

**SDK error codes (`client.md § 8f`):** `TIMEOUT`, `CONNECTION_ERROR`, `HANDSHAKE_FAILED`, `NOT_CONNECTED`, `TOKEN_ERROR`, `HOST_NOT_READY`. v0.1 logs to `console.error` only; no UI affordance for SDK-level errors beyond what the per-button error states already convey. Per ADR-0009: no reconnection logic.

**SDK testing stub pattern (`client.md § 9`):** unit tests use typed `vi.fn<ClientSDK['query']>()` etc., with `as never` allowed only on `mockResolvedValueOnce({ data: ... } as never)`. Never `vi.fn() as any`.

### 4c-7. Parity / rebuild pointers

`N/A — greenfield`. QuickCopy is a brand-new app; there is no source-analysis artifact to crawl, no per-route parity to enforce, no content dump. The only reference codebase is **pageshot** (`products/pageshot/site/next-app/`), referenced from § 4c-3 / § 4c-5 / § 4c-6 — Developer may *peek* at pageshot to understand the proven scaffold + provider + clipboard pattern but **MUST NOT** copy code wholesale. The clipboard module is the one explicit copy (ADR-0004) and is already specified in T016b.

### 4c-8. User-visible string contracts (test-pinned, copy verbatim)

Every string below is asserted **literally** in the QA-enriched test suite (§ 10). Production code reads from `lib/i18n/strings.ts` (T032). The strings are reproduced here so the Developer never needs to open the PRD or the user-stories file to write a passing test.

**Tooltip — disabled (FR-013):**

| Card | Trigger | Exact string |
|------|---------|--------------|
| Live URL | `publishing.isPublished===false` | `Not published to Edge yet — publish the page first.` |
| Preview URL | `previewUrl===null` (loading) | `Loading…` (transient) |
| Live URL / Preview URL | cache slot `===null` (loading) | `Loading…` (transient) |
| Item ID | `pageInfo.id` missing/empty | `Page context not ready — wait or reload.` |
| Page Title | both `displayName` and `name` missing/empty | `Page context not ready — wait or reload.` |
| Share Link | unpublished page, preview healthy | `Page not live — link points to preview` (US-005) |

**Tooltip — persistent error (per ADR-0009):**

| Card | Exact string |
|------|--------------|
| Live URL | `Couldn't fetch Live URL — try switching pages or reloading.` |
| Preview URL | `Couldn't fetch Preview URL — try switching pages or reloading.` |
| Item ID | `Couldn't copy Item ID — try switching pages or reloading.` (used only on clipboard failure) |
| Page Title | `Couldn't copy Page Title — try switching pages or reloading.` (clipboard failure only) |
| Share Link | `Couldn't compose Share Link — try switching pages or reloading.` |

All tooltip strings use the **em-dash** U+2014 (NOT en-dash, NOT hyphen-minus).

**Success morph label (FR-008):** `Copied` (without exclamation; the punctuation in PRD § 5 is descriptive, but the test assertion pins the visible string `Copied` to keep tests resilient to design tweaks of the punctuation).

**aria-live announcements (T034b — success only, per ADR-0009):**

| Trigger | Announcement |
|---------|--------------|
| Live URL copy success | `Live URL copied` |
| Preview URL copy success | `Preview URL copied` |
| Item ID copy success | `Item ID copied` |
| Page Title copy success | `Page Title copied` |
| Share Link (Markdown) copy success | `Share Link copied` |
| Share Link (Plain text) copy success | `Share Link copied` |
| ANY error path | (no announcement — per ADR-0009 errors are visual-only) |

**Item ID brace handling (test-pinned per T020a scenario 2):**

`pageInfo.id` arriving as `'{ABC-123-DEF}'` (wrapped in curly braces) → click writes `'ABC-123-DEF'` (braces stripped). `pageInfo.id` arriving as `'  abc-123  '` (whitespace) → click writes `'abc-123'` (trimmed). The Item ID handler trims surrounding whitespace and strips a single leading `{` paired with a single trailing `}`. This pins the FR-001/US-003 "no wrapping braces and no whitespace" requirement to a deterministic behavior.

**Share Link format strings (FR-005, restated for visibility):**

- **Markdown:** `[<displayName>](<resolvedUrl>)` — no escape inside title.
- **Plain text:** `<displayName> \u2014 <resolvedUrl>` — em-dash U+2014, single space either side.

**localStorage key (FR-010):** `quickcopy.theme`. Values: `'dark' | 'light'`. Default on missing: `'dark'`.

## 5. Dependencies

### Ordering constraints (test-first where applicable)

- **Scaffold before everything** (T001 must run first; nothing else compiles without `package.json`).
- **Bootstrap green-light gate (T008) before E2 onwards** — patches must land before adding feature code that depends on them.
- **`a` before `b` for every paired task** (RED → GREEN). The `a` task is the failing-test seed; the `b` task makes it pass.
- **Subscription (E2) before pre-fetch (E3)** — pre-fetch reads `pageInfo` + `siteInfo` from the Provider. T009b before T011a.
- **Cache types (T011b) before cache store (T012b) before pre-fetch (T013b) before Provider wire-up (T014b).**
- **Action cards (T018a/b–T021a/b) depend on pre-fetch wire-up (T014b) + clipboard (T016b) + ActionCard primitive (T017b).**
- **Grid (T022b) depends on all four card b-tasks.**
- **Share Link (T025b) depends on cache wire-up + clipboard + format builders (T023b) + URL selector (T024b).**
- **Theme (T026/T027a/b/T028a/b) is independent of E2-E6** but must complete before final composition (T036b).
- **Shortcut config (T029) before listener (T030a/b) and legend (T031a/b).**
- **Final composition (T036b) depends on grid + share-link + theme toggle + legend + status region (all b-tasks).**
- **Real-portal smoke (T038) depends on portal registration (T037) which depends on T036b.**

### Execution order (TDD — RED before GREEN)

For every paired task, the `a` (RED — failing tests) MUST run before the `b` (GREEN — implementation). Trivial config / scaffold / audit tasks remain single-step.

```
# Bootstrap (no test-first — scaffold/config)
T001, T002, T003, T004, T005, T006, T007, T008,

# Provider extension (RED → GREEN)
T009a → T009b,

# Context-id helper (RED → GREEN)
T010a → T010b,

# Cache types + store (RED → GREEN, sequential)
T011a → T011b → T012a → T012b,

# Pre-fetch orchestrator + Provider wiring + cleanup
T013a → T013b → T014a → T014b → T015,

# Clipboard (RED → GREEN)
T016a → T016b,

# Action card primitive (RED → GREEN)
T017a → T017b,

# Per-action cards (RED → GREEN, can run in parallel batches once dependencies are met)
T018a → T018b,  T019a → T019b,  T020a → T020b,  T021a → T021b,

# Grid layout
T022a → T022b,

# Share Link path (RED → GREEN)
T023a → T023b → T024a → T024b → T025a → T025b,

# Theme tokens (no test) + theme hook + toggle
T026,  T027a → T027b → T028a → T028b,

# Shortcut config (no test — pure data) + listener + legend
T029,  T030a → T030b,  T031a → T031b,

# Strings (no test — pure data)
T032,

# Audit + live region + polish
T033,  T034a → T034b,  T035,

# Final composition + portal smoke
T036a → T036b → T037 → T038
```

### Parallel groups

```
Group 1 (sequential — scaffold foundation): T001 → T002, T003, T004, T005, T006, T007 (parallel after T001) → T008 (gate)
Group 2 (parallel after T008 — RED+GREEN pairs that share only T008 as prerequisite):
  - {T009a → T009b}
  - {T016a → T016b}
  - {T017a → T017b}
  - T026
  - T029
  - T032
Group 3 (sequential after T009b): T010a → T010b → T011a → T011b → T012a → T012b → T013a → T013b → T014a → T014b → T015
Group 4 (parallel after T014b + T016b + T017b + T032 — per-card pairs): {T018a→b}, {T019a→b}, {T020a→b}, {T021a→b}
Group 5 (sequential after Group 4): T022a → T022b
Group 6 (sequential after T011b + T016b + T017b + T032): T023a → T023b → T024a → T024b → T025a → T025b
Group 7 (sequential after T026): T027a → T027b → T028a → T028b
Group 8 (sequential after T029): T030a → T030b; in parallel T031a → T031b
Group 9 (sequential — audit + polish — after T018b-T021b, T025b): T033 → T034a → T034b → T035
Group 10 (sequential — final composition + ship-prep): T036a → T036b → T037 → T038
```

Within parallel groups Team Lead MAY spawn multiple Developer agents. The group must complete fully before moving to the next. **Critical TDD rule:** an `a` task is "complete" only when its tests are written, runnable, and FAILING. The `b` task is "complete" only when those same tests run GREEN and the broader suite still passes (no regressions).

## 6. Suggested Milestones

1. **M1 — Bootstrap green** (T001-T008): scaffold + patches + `/panel` placeholder; all four scripts pass.
2. **M2 — Page context live** (T009a-T010b): real `pageInfo` + `siteInfo` flow into the Provider; `/panel` shows page id/displayName as a debug dump. All Provider/helper tests GREEN.
3. **M3 — URL resolution online** (T011a-T015): cache + pre-fetch wired; debug overlay shows cache contents per page navigation. All cache + prefetch tests GREEN.
4. **M4 — All five buttons** (T016a-T025b): full functional UI (no theme yet, no shortcuts, no legend). All card + share-link tests GREEN.
5. **M5 — Theme + Shortcuts + Polish** (T026-T035): full app behavior at parity with PRD AC. All theme + shortcut + a11y tests GREEN.
6. **M6 — Real-portal smoke green** (T036a-T038): installed in dogfood tenant, all five buttons + both themes + error injection verified. Final integration suite GREEN; manual portal smoke PASS.

## 7. Risk Areas

- **R-1 — Live host kind discriminator field name.** `xmc.sites.listHosts` returns multiple hosts with a discriminator (`kind` per ADR-0006). Exact field name (e.g. `kind`, `type`) and value (e.g. `'delivery'`, `'live'`, `'cm'`) must be confirmed at implementation time by logging one response. **Mitigation:** TypeScript types from `@sitecore-marketplace-sdk/xmc` resolve the field; trust the compiler. If multiple delivery hosts exist, `[0]` per ADR-0006 — no picker UI in v0.1.
- **R-2 — `xmc.pages.retrievePage` `publishing` semantics.** The mapping `isPublished := publishing.hasPublishableVersion && publishing.isPublishable` is an approximation. If field testing finds the Live URL gate is wrong (e.g. button disabled when page is actually live, or vice versa), narrow the rule using `pageInfo.publishing` from the `pages.context` event (more authoritative — comes from Pages editor) before reaching for a different SDK key. **Mitigation:** smoke test (T038) covers both published + unpublished pages explicitly.
- **R-3 — Keyboard shortcut conflict in real Pages editor.** ADR-0008 documents the swap path to `Ctrl+Alt+<letter>` if any of `Alt+L/P/I/T/S` collides. **Mitigation:** T038 covers conflict detection. If hit, change `SHORTCUTS` constant to `SHORTCUTS_FALLBACK`, redeploy.
- **R-4 — Blok split-button visual cohesion at the join.** ADR-0010 acknowledges that two buttons must look like one control. **Mitigation:** match POC's CSS treatment in `pocs/poc-v2/styles.css` for the exact corner-radius + divider treatment.
- **R-5 — `pages.context.pageInfo.version` not bumping after publish.** ADR-0007 fallback is a v0.2 30s TTL on `/live`. **Mitigation:** v0.1 ships with version-keying; field reports drive v0.2 fallback if needed.
- **R-6 — `localStorage` access in iframe.** Mode A iframes run at QuickCopy's own origin (localhost:3000 dev / `*.vercel.app` prod) so `localStorage` is same-origin. **Mitigation:** none needed; ADR-0005 + FR-010 already accounted.
- **R-7 — Reduced-motion media query missed for one transition.** **Mitigation:** code-review pass (T035) explicitly grep for `transition` / `animation` in styles.

## 8. Suggested Team Structure

Single Developer agent suffices for v0.1. Parallel groups in § 5 allow Team Lead to spawn multiple Developer agents if scheduling demands faster wall-clock — most natural splits:
- **Dev-A** runs E1+E2+E3 (scaffold → page-context → URL resolution)
- **Dev-B** runs E4+E5 in parallel after T014+T017 are green (cards + clipboard)
- **Dev-C** runs E7+E8 in parallel from T008 (theme + shortcuts)
- Single Developer reconverges at T022 / T025 / T036.

QA Specialist (07) enriches § 9 + § 10 after this file is handed off; the bullets in § 4b are the seed.

## 9. TDD and quality contract

This section is the contract that governs how the Developer (08) produces every implementation task in this plan. It is enforced by the `task_breakdown_style: tdd` flag on the run manifest and by the `a` (RED) → `b` (GREEN) split applied to every behavioral task in § 3.

### 9.1 RED → GREEN → REFACTOR mandate

- **No production code is written before a failing test asserts the behavior that production code is meant to deliver.** This applies to unit, integration, component, contract, and accessibility-smoke layers. A "behavior" is anything the user, the SDK consumer, or another module can observe.
- For every paired task `Tnnna` (RED) and `Tnnnb` (GREEN):
  1. The Developer writes the test file from the spec in § 10. Run `npm run test`. The new tests MUST be RED (failing for the right reason — i.e. "module not found" or "function returned undefined" — not "syntax error" or "test framework misconfigured").
  2. The Developer writes the minimum implementation that makes those tests GREEN.
  3. The Developer refactors with tests staying GREEN — extract helpers, rename, simplify. Refactor passes do not require new tests, but a meaningful refactor often surfaces a test gap that earns one.
- A `b` task is incomplete if the corresponding `a`-suffix tests would pass against a stub implementation, OR if `b` introduces tests for behaviors that did not exist as `a`-tests. In both cases, return to RED first.

### 9.2 Coverage expectations

Coverage is **behavioral**, not line-count. The expectations below are MINIMUM:

- **`lib/cache/types.ts`, `lib/cache/store.ts`, `lib/clipboard.ts`, `lib/share-link/formats.ts`, `lib/share-link/select-url.ts`, `lib/marketplace/require-context-id.ts`** — all exported functions covered by unit tests; all branches covered including error paths.
- **`lib/url-resolver/prefetch.ts`** — covered by unit tests with the SDK boundary mocked at `mockClient`. Happy path AND each per-key failure path.
- **All React components in `components/quickcopy/`** — covered by component tests with `@testing-library/react`. Test the user-visible behavior (text content, ARIA attributes, click outcomes) — NOT internal class names or `::after` pseudo-element content.
- **All hooks in `hooks/`** — covered with `renderHook` + `act`. Test inputs, returned values, side effects (DOM mutation, localStorage writes, listener registration/removal).
- **`<QuickCopyPanel>`** — covered by an integration suite (T036a) that mounts the panel inside a stubbed Provider and walks every primary user path.
- **Accessibility** — `jest-axe` smoke at the panel level in both themes (T035). Component-level a11y attributes (`role`, `aria-disabled`, `aria-haspopup`, `aria-expanded`, `aria-pressed`, `aria-label`, `aria-describedby`) are asserted in the per-component tests.

### 9.3 Test-first exemptions (label "no test (scaffold/config)")

The following tasks are exempt from RED → GREEN ordering. They produce no behavioral surface that benefits from a failing-test seed:

- **T001-T008** — scaffold, lint patches, Nova Badge audit, Vitest install, PNA headers, Geist font wiring, `/panel` placeholder, green-light gate. The "test" for these tasks IS `npm run lint && typecheck && test && build` passing.
- **T015** — single-line `clearAll` cleanup invocation; covered as an extension of the T014a tests rather than its own RED step.
- **T026** — Blok semantic-token CSS in `globals.css`. No behavior; the regression check is "no raw hex outside this file" (a `grep` regression in § 10).
- **T029** — `SHORTCUTS` constant in `lib/shortcuts/config.ts`. Pure data; behavior is exercised in T030a/b and T031a/b.
- **T032** — `STRINGS` constant in `lib/i18n/strings.ts`. Pure data.
- **T033** — Audit task. Behavior is the absence of disallowed patterns, encoded as regression greps in § 10.
- **T037** — Manual Cloud Portal registration.
- **T038** — Manual real-portal smoke.

### 9.4 Test runner and tooling

- **Test runner:** Vitest (per ADR-0005 patches; configured in T004). Scripts: `npm run test` (`vitest run` — single pass) and `npm run test:watch` (`vitest` — watch mode).
- **Component testing:** `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` environment.
- **Accessibility smoke:** `jest-axe` (or `@axe-core/react`) added as a dev-dependency during T035 (the only addition beyond the T004 stack).
- **Fake timers:** `vi.useFakeTimers()` for the 1500ms morph hold and the 1500ms aria-live region clear.
- **SDK mocks:** typed `vi.fn<ClientSDK['query']>()` / `vi.fn<ClientSDK['mutate']>()` per `client.md § 9b`. The ONLY allowed cast on mocked resolved values is `as never` — never `as any`.
- **Test discovery patterns:** Vitest picks up `**/*.test.ts` and `**/*.test.tsx` co-located next to the unit under test (the convention in § 4c-5 "Naming conventions"). No separate `__tests__` directory; no separate `tests/` folder at the app root.

### 9.5 Fast feedback loop

- Developer keeps `npm run test:watch` running during implementation. Each `a` task seeds new RED tests; each `b` task brings them to GREEN. The watch's per-file reruns make the inner loop sub-second.
- Before committing each milestone (M1-M6), run the full quartet `npm run lint && npm run typecheck && npm run test && npm run build`. All four must pass.
- In CI / `/test` stage, the same quartet is the pass/fail gate. No "skipped" tests except those documented as skip-with-reason in this file.

### 9.6 Behavioral test discipline

- **Meaningful tests only.** Forbidden patterns:
  - Identity tests (`expect(2).toBe(2)`).
  - Tests that assert the implementation rather than the behavior (e.g. asserting a component renders a specific class name when the user-visible behavior is "the button is disabled").
  - Snapshot tests that snap the entire component tree without inspection.
  - Tests that pass against a stubbed-empty implementation (the RED was not RED for the right reason).
- **User-visible behavior over implementation details.** When testing the copied morph, assert the visible text "Copied" appears, NOT that a `::after` content equals `'✓'`. When testing the disabled tooltip, assert the tooltip's text content matches the PRD-specified string verbatim, NOT that a class name `is-disabled` is present.
- **Mock at the SDK boundary, not below.** Stub `mockClient.query` to return canned XMC payloads. Do not stub `XMC.query` internals or the postMessage bridge — that's testing the SDK, not QuickCopy.
- **Real timers when waiting for things, fake timers when waiting for time.** A 1500ms morph deserves fake timers + `vi.advanceTimersByTime(1500)`. A `Promise.allSettled` resolution deserves real timers + `await` because the promise resolves on the microtask queue.

### 9.7 Test-first does not mean redundant

- Trivial scaffold/config tasks (T001-T008, T015, T026, T029, T032, T033, T037, T038) are single-step. The verification surface is `lint+typecheck+test+build` for code-touching tasks and "manual smoke + commit" for portal tasks.
- The single-step exemption is NOT a license to skip tests for tasks that DO have behavioral surface but are "small." If you can write a meaningful failing test, write it.

## 10. Per-task test specifications

For each `a` (RED) task — and for the regression / a11y smoke tasks that don't follow the a/b split — the table below lists the scenarios the failing tests must cover. Test type abbreviations: **U** = unit, **C** = component (Testing Library), **I** = integration, **A** = accessibility smoke (jest-axe), **R** = regression (grep / build-only).

### T009a — `MarketplaceProvider` `pages.context` subscription (file: `components/providers/marketplace.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Mount Provider under StrictMode (double-render) | `mockClient.query` is called with `('pages.context', { subscribe: true, ... })` exactly ONCE | C |
| 2 | Render `usePagesContext()` consumer before any `onSuccess` fires | Returns `null` | C |
| 3 | After `onSuccess({ pageInfo: P, siteInfo: S })` is invoked from the captured callback | `usePagesContext()` returns `{ pageInfo: P, siteInfo: S }` deep-equal | C |
| 4 | Unmount the Provider | The captured `unsubscribe` function is invoked once AND `mockClient.destroy` is invoked once | C |
| 5 | `onError` invoked with an SDK error | The error is logged via `console.error` (spy) AND `usePagesContext()` still returns the last successful payload (does not regress to null) | C |

### T010a — `requireContextId` (file: `lib/marketplace/require-context-id.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `requireContextId(null)` | Throws `Error` with a message that mentions context | U |
| 2 | `requireContextId({ resourceAccess: [{ context: { live: 'L1' } }] })` | Returns `'L1'` | U |
| 3 | `requireContextId({ resourceAccess: [{ context: { preview: 'P1' } }] })` | Returns `'P1'` (live → preview fallback) | U |
| 4 | `requireContextId({ resourceAccess: [{ context: { live: 'L1', preview: 'P1' } }] })` | Returns `'L1'` (live wins over preview) | U |
| 5 | `requireContextId({ resourceAccess: [{ context: {} }] })` | Throws | U |
| 6 | `requireContextId({ resourceAccess: [] })` | Throws | U |

### T011a — Cache key + types (file: `lib/cache/types.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `buildCacheKey('p1', 2)` | Returns `'p1:2'` | U |
| 2 | `buildCacheKey('p1', undefined)` | Returns `'p1:noversion'` | U |
| 3 | `buildCacheKey('p1', 0)` | Returns `'p1:0'` (zero is a real version, NOT `noversion`) | U |
| 4 | Two distinct ids with same version | Yield distinct keys (`'p1:2' !== 'p2:2'`) | U |
| 5 | TypeScript-only type assertion: `CacheValue<string>` accepts `string | null | { error: Error }` | Compiles | U |

### T012a — In-memory cache store (file: `lib/cache/store.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `getEntry('missing')` on fresh module | Returns `undefined` | U |
| 2 | `setEntry(k, s)` then `getEntry(k)` | Returns deep-equal `s` | U |
| 3 | `patchEntry(k, { previewUrl: 'X' })` after a prior `setEntry` | Merges `previewUrl: 'X'` while preserving other fields | U |
| 4 | `patchEntry` against a missing key | Either creates a new partial slot OR throws — pin the chosen behavior in the test | U |
| 5 | `clearAll()` after multiple `setEntry` calls | All previously-set keys read `undefined` | U |
| 6 | Tests reset state via `beforeEach(() => clearAll())` | No cross-test leakage | U |

### T013a — Pre-fetch orchestrator (file: `lib/url-resolver/prefetch.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Happy path: all three SDK queries resolve | `mockClient.query` is called THREE times, with keys `xmc.agent.pagesGetPagePreviewUrl`, `xmc.pages.retrievePage`, `xmc.sites.listHosts`, with the correct `params.path` and `params.query.sitecoreContextId` shapes | U |
| 2 | All three queries resolve with valid data | Cache slot has `previewUrl` string, `publishing.isPublished===true`, `liveHost` string, composed `liveUrl` string | U |
| 3 | `xmc.pages.retrievePage` returns `publishing.hasPublishableVersion=false` | `liveUrl===null` AND `publishing.isPublished===false` | U |
| 4 | `xmc.pages.retrievePage` returns `publishing.isPublishable=false` | Same as case 3 | U |
| 5 | `xmc.sites.listHosts` rejects | `liveHost = { error }`; `previewUrl` and `publishing` slots still resolve correctly (failures isolated) | U |
| 6 | `xmc.agent.pagesGetPagePreviewUrl` rejects | `previewUrl = { error }`; `liveHost` still resolves | U |
| 7 | All three reject | All three slots are `{ error }`; `liveUrl===null` | U |
| 8 | Live URL composition: slug `/products/spring`, host `https://www.example.com` | `liveUrl === 'https://www.example.com/products/spring'` | U |
| 9 | Live URL composition: slug `/`, host `https://www.example.com` | `liveUrl === 'https://www.example.com/'` | U |
| 10 | `xmc.sites.listHosts` returns empty array | `liveHost = { error: new Error('no live host') }` (per task description) | U |

### T014a — Provider pre-fetch wiring (file: `components/providers/marketplace.prefetch.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Provider mounts with first `pages.context` snapshot | `prefetchPageUrls` is called once with `(client, contextId, pageInfo, siteInfo)` matching the snapshot | C |
| 2 | Same `pages.context` snapshot re-fired (no key change) | `prefetchPageUrls` NOT called a second time (cache hit) | C |
| 3 | Same id, `pageInfo.version` 1 → 2 | Fresh `prefetchPageUrls` call against the new key `'id:2'` | C |
| 4 | Different id, same version | Fresh `prefetchPageUrls` call against the new key | C |
| 5 | A consumer of `useCacheEntry(key)` re-renders when the prefetch resolves the slot | Consumer reads the resolved cache value | C |
| 6 | Provider unmounts after several pre-fetches | `clearAll()` is invoked (covers T015) | C |

### T016a — Clipboard module (file: `lib/clipboard.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `copyTextToClipboard('hello')` with healthy `navigator.clipboard.writeText` | Resolves; `writeText` called exactly once with `'hello'` | U |
| 2 | `writeText` rejects with `DOMException('NotAllowedError')` | The same error propagates (rejected promise OR thrown) — caller receives the original error | U |
| 3 | `navigator.clipboard?.writeText` is `undefined` | Throws `Error('clipboard-unavailable')` | U |
| 4 | `copyTextToClipboard('')` | Resolves; `writeText` called with `''` | U |
| 5 | `copyTextToClipboard(string of length 200_000)` | Resolves; no length-clamping | U |
| 6 | `navigator` itself is `undefined` (server-side) | Throws `Error('clipboard-unavailable')` | U |

### T017a — `<ActionCard>` primitive (file: `components/quickcopy/ActionCard.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Render with `glyph='↗', label='Live URL', shortcut='L', state='idle'` | All three pieces of text/glyph visible in the DOM; accessible name (`aria-label`) matches "Copy Live URL — shortcut Alt+L" | C |
| 2 | Click while `state='idle'` | `onActivate` called once | C |
| 3 | Press `Enter` while focused, `state='idle'` | `onActivate` called once | C |
| 4 | Press `Space` while focused, `state='idle'` | `onActivate` called once | C |
| 5 | `state='disabled'` | `aria-disabled="true"` (NOT `disabled` HTML attribute); element is still focusable | C |
| 6 | Click while `state='disabled'` | `onActivate` NOT called | C |
| 7 | `state='error'` | `aria-disabled="true"`; visible text shows error glyph (❌) or "Failed" label per UI § 5 | C |
| 8 | Click while `state='error'` | `onActivate` NOT called | C |
| 9 | `state='copied'` | Visible text contains "Copied" | C |
| 10 | `tooltip='X'` prop supplied | `aria-describedby` resolves to text content "X" | C |
| 11 | `prefers-reduced-motion: reduce` (set via `matchMedia` mock) and `state='copied'` | No rotation/scale CSS variable on the element (assert via class absence or computed style) | C |

### T018a — Live URL card (file: `components/quickcopy/LiveUrlCard.test.tsx`)

Mock the cache via `useCacheEntry` stub, mock `useShareLinkUrl`/etc as needed, and stub `copyTextToClipboard` (`vi.mock('lib/clipboard', ...)`).

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Cache slot `liveUrl='https://www.example.com/products/spring'` | Card is `idle`; click writes `'https://www.example.com/products/spring'` via `copyTextToClipboard` exactly once | C |
| 2 | Cache slot `publishing.isPublished===false` | Card is `aria-disabled`; tooltip text matches **exactly** "Not published to Edge yet — publish the page first." | C |
| 3 | Click in scenario 2 | `copyTextToClipboard` NOT called | C |
| 4 | Cache slot `previewUrl={error}` (any one of three slots in error) | Card is in persistent error state; tooltip text matches **exactly** "Couldn't fetch Live URL — try switching pages or reloading." | C |
| 5 | Cache slot `publishing={error}` | Persistent error state with same tooltip | C |
| 6 | Cache slot `liveHost={error}` | Persistent error state with same tooltip | C |
| 7 | Cache slot all `null` (loading) | Disabled with "Loading…" tooltip (transient state, distinct from FR-013 disabled-tooltip messages) | C |
| 8 | Click on `idle` then `copyTextToClipboard` rejects | Card flips to persistent error state for the current cache key | C |
| 9 | Subsequent click after scenario 8's failure | `copyTextToClipboard` NOT called (no-op) | C |
| 10 | After successful copy | Visible text contains "Copied" within the morph window | C |
| 11 | After successful copy + `vi.advanceTimersByTime(1500)` | Visible text reverts to "Live URL" (or original label) | C |
| 12 | Second click within morph window | Timer resets; "Copied" visible for full 1500ms from second click | C |

### T019a — Preview URL card (file: `components/quickcopy/PreviewUrlCard.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Cache slot `previewUrl='https://preview.example.com/foo'` | Card is `idle`; click writes that exact string | C |
| 2 | Source-of-truth check: PRD FR-003 requires preview URL from `xmc.agent.pagesGetPagePreviewUrl`, NOT from `pageInfo.url` | Test wires the cache slot only with `previewUrl`; no path reads from `pageInfo.url` | C |
| 3 | Cache slot `previewUrl={error}` | Persistent error; tooltip text matches **exactly** "Couldn't fetch Preview URL — try switching pages or reloading." | C |
| 4 | Cache slot `previewUrl===null` | Disabled with "Loading…" tooltip | C |
| 5 | Click on idle then `copyTextToClipboard` rejects | Card flips to persistent error | C |
| 6 | Successful copy → 1500ms morph → revert | Same morph timing as Live URL card | C |

### T020a — Item ID card (file: `components/quickcopy/ItemIdCard.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `pageInfo.id='abc-123-DEF'` | Click writes `'abc-123-DEF'` exactly (no `{}` braces, no whitespace) | C |
| 2 | `pageInfo.id='{ABC-123}'` (stakeholder accidentally sets braces) | Click writes the GUID with braces stripped — verify by extracting with a `BRACE_RE` if applicable, OR the test pins the actual behavior the implementation should have. (Initial decision: strip leading `{` and trailing `}` if present.) | C |
| 3 | `pageInfo.id=undefined` | Card disabled; tooltip exactly "Page context not ready — wait or reload." | C |
| 4 | `pageInfo.id=''` | Card disabled with same tooltip | C |
| 5 | No SDK call invoked under any branch | Assert `mockClient.query` was never called by this card's code path | C |
| 6 | Clipboard rejection on click | Card flips to persistent error | C |

### T021a — Page Title card (file: `components/quickcopy/PageTitleCard.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `displayName='Spring Campaign'` | Click writes `'Spring Campaign'` (NOT machine name) | C |
| 2 | `displayName=undefined, name='spring-campaign'` | Click writes `'spring-campaign'` (fallback) | C |
| 3 | `displayName='', name='spring'` | Falls back to `'spring'` (empty string treated as missing) | C |
| 4 | `displayName='   ', name='spring'` | Falls back to `'spring'` (whitespace-only treated as missing) | C |
| 5 | Both missing/empty | Disabled with "Page context not ready — wait or reload." | C |
| 6 | No SDK call invoked | Assert `mockClient.query` never called | C |
| 7 | Clipboard rejection | Card flips to persistent error | C |

### T022a — Action grid (file: `components/quickcopy/ActionGrid.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Render the grid with stubbed cards | Exactly four card elements present (locate by accessible name OR `data-testid`) | C |
| 2 | DOM order of cards | Live → Preview → Item → Title (top-left, top-right, bottom-left, bottom-right) | C |
| 3 | Container has hairline-gridlines class | `gap-px` token present OR computed gap is 1px | C |
| 4 | At 320px viewport width | `scrollWidth <= clientWidth` (no horizontal overflow) | C |

### T023a — Share Link format builders (file: `lib/share-link/formats.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `shareLinkMarkdown('Foo', 'https://x')` | Returns `'[Foo](https://x)'` (no trailing whitespace, no escaping) | U |
| 2 | `shareLinkMarkdown('A) B', 'https://x')` | Returns `'[A) B](https://x)'` — title verbatim, FR-005 says no escaping | U |
| 3 | `shareLinkPlainText('Foo', 'https://x')` | Returns `'Foo \u2014 https://x'` | U |
| 4 | Em-dash codepoint check | `result.charCodeAt(4) === 0x2014` (verify it is U+2014 EM DASH) | U |
| 5 | Em-dash is NOT en-dash | `result.charCodeAt(4) !== 0x2013` | U |
| 6 | Em-dash is NOT hyphen-minus | `result.charCodeAt(4) !== 0x002D` | U |
| 7 | Single space either side of em-dash | `result.includes(' \u2014 ')` (literal: space-emdash-space) | U |
| 8 | Empty title or empty url | Both functions resolve without throwing — exact strings: `'[](https://x)'`, `'[Foo]()'`, ` \u2014 https://x`, etc. | U |

### T024a — Share Link URL selector (file: `lib/share-link/select-url.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `liveUrl='https://live', previewUrl='https://preview'` | Returns `{ url: 'https://live', isPreviewFallback: false, isError: false }` (Live wins) | U |
| 2 | `liveUrl=null, previewUrl='https://preview'` (page not live) | Returns `{ url: 'https://preview', isPreviewFallback: true, isError: false }` (US-005 preview fallback) | U |
| 3 | `liveUrl=null, previewUrl=null` | Returns `{ url: null, isPreviewFallback: false, isError: false }` (loading) | U |
| 4 | `liveUrl={error}, previewUrl='https://preview'` | Returns `{ url: 'https://preview', isPreviewFallback: true, isError: false }` — preview is a healthy fallback even when Live errored (per US-005) | U |
| 5 | `liveUrl={error}, previewUrl={error}` | Returns `{ url: null, isPreviewFallback: false, isError: true }` | U |
| 6 | `liveUrl=null, previewUrl={error}` | Returns `{ url: null, isPreviewFallback: false, isError: false }` (still loading Live; not fully errored) — pin the chosen semantics | U |

### T025a — `<ShareLinkSplit>` (file: `components/quickcopy/ShareLinkSplit.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Render | Container has `role="group"` and `aria-label="Share link"` | C |
| 2 | Primary button click with healthy `liveUrl` | `copyTextToClipboard` called with `'[Title](https://live)'` (Markdown shape) | C |
| 3 | Caret button | Has `aria-haspopup="menu"` and `aria-expanded="false"` initially | C |
| 4 | Click caret to open dropdown | `aria-expanded` flips to `"true"` AND focus moves to first menu item | C |
| 5 | Press `Escape` while menu is open | Menu closes (`aria-expanded="false"`) AND focus returns to caret | C |
| 6 | Click "Copy as Plain text" menu item | `copyTextToClipboard` called with `'Title \u2014 https://live'` | C |
| 7 | Click "Copy as Markdown" menu item | `copyTextToClipboard` called with `'[Title](https://live)'` | C |
| 8 | Menu items have correct ARIA | `getAllByRole('menuitem')` returns two items | C |
| 9 | `Alt+S` keyboard shortcut (mounted with `useShortcuts` wrapper) | Triggers primary action (Markdown copy); `aria-expanded` STAYS `"false"` (does NOT open menu) | C |
| 10 | Page unpublished, preview healthy | Primary tooltip text matches **exactly** "Page not live — link points to preview" | C |
| 11 | Both URLs error | Primary AND caret both `aria-disabled="true"` | C |
| 12 | Both URLs error — primary tooltip | Matches **exactly** "Couldn't compose Share Link — try switching pages or reloading." | C |
| 13 | Click on disabled primary or caret | `copyTextToClipboard` NOT called; menu does NOT open | C |
| 14 | Successful copy from primary | Visible text shows "Copied" within morph window; reverts after 1500ms | C |

### T027a — `useTheme` hook (file: `hooks/useTheme.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Mount with empty localStorage | `theme==='dark'`; `document.documentElement.classList.contains('dark')===true` | U |
| 2 | Mount with `localStorage['quickcopy.theme']='light'` | `theme==='light'`; the `dark` class is REMOVED | U |
| 3 | Mount with `localStorage['quickcopy.theme']='dark'` | `theme==='dark'`; class present | U |
| 4 | Call `toggle()` from dark | `theme==='light'`; class removed; `localStorage.setItem('quickcopy.theme', 'light')` was called | U |
| 5 | Call `toggle()` from light | `theme==='dark'`; class added; localStorage write `'dark'` | U |
| 6 | Server-side render path (no `window`) | No throw; initial `theme==='dark'` | U |
| 7 | Invalid value in localStorage (`'purple'`) | Falls back to `'dark'` default | U |

### T028a — `<ThemeToggle>` (file: `components/quickcopy/ThemeToggle.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Mount with default dark | Button text contains "Dark" (or visible glyph indicator) | C |
| 2 | `aria-pressed` reflects theme | Pinned semantics: `aria-pressed="true"` when dark, `"false"` when light | C |
| 3 | Click toggle | `useTheme().toggle()` invoked (spy); `<html>` class flips; visible label updates from "Dark" to "Light" | C |
| 4 | `Space` key while focused | Toggle fires (browser default for buttons) | C |
| 5 | `Enter` key while focused | Toggle fires | C |

### T030a — `useShortcuts` hook (file: `hooks/useShortcuts.test.ts`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `Alt+L` keydown on window (panel focused, no editable element) | `live` handler called once | C |
| 2 | `Alt+P` | `preview` handler called once | C |
| 3 | `Alt+I` | `item` handler called once | C |
| 4 | `Alt+T` | `title` handler called once | C |
| 5 | `Alt+S` | `share` handler called once (Markdown default per ADR-0010) | C |
| 6 | `Alt+L` while `<input>` has focus | NO handler called | C |
| 7 | `Alt+L` while `<textarea>` has focus | NO handler called | C |
| 8 | `Alt+L` while `<select>` has focus | NO handler called | C |
| 9 | `Alt+L` while `[contenteditable="true"]` element has focus | NO handler called | C |
| 10 | Recognized combo dispatch | `event.preventDefault()` AND `event.stopPropagation()` both called (verified via spies on the dispatched event) | C |
| 11 | `Ctrl+Alt+L` | NO handler called (we require ctrlKey===false) | C |
| 12 | `Meta+Alt+L` | NO handler called | C |
| 13 | `Alt+X` (unbound) | NO handler called; `preventDefault` NOT called | C |
| 14 | `Alt+L` with `key:'L'` (uppercase) | `live` handler called (lowercase match per ADR-0008) | C |
| 15 | Hook unmount, then dispatch `Alt+L` | NO handler called (listener removed) | C |
| 16 | Re-mount the hook | Listener re-registered; handlers fire again | C |

### T031a — `<ShortcutLegend>` (file: `components/quickcopy/ShortcutLegend.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Render | Exactly five chip elements present | C |
| 2 | Each chip's text content includes its `legendKey` (`L/P/I/T/S`) and label | All five labels present: "Live URL", "Preview URL", "Item ID", "Page Title", "Share Link" | C |
| 3 | DOM order | Matches Live → Preview → Item → Title → Share | C |
| 4 | Legend is always visible | No `aria-hidden` on the legend container; no `display: none` ancestor | C |
| 5 | No expand/collapse affordance | `getAllByRole('button')` inside the legend returns zero | C |

### T034a — `<StatusLiveRegion>` + `useStatusAnnouncer` (file: `components/quickcopy/StatusLiveRegion.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Render | Region has `role="status"` AND `aria-live="polite"` | C |
| 2 | Visually hidden | Class is `sr-only` (or computed style places it off-screen) | C |
| 3 | Call `announce("Live URL copied")` | Region text content === `"Live URL copied"` | C |
| 4 | After 1500ms (fake timers) | Region text content === `""` (empty) | C |
| 5 | `announce("A")` then 800ms later `announce("B")` | At t=1300ms (before 1500ms from second call) text === `"B"`; at t=2300ms (after 1500ms from second call) text === `""` | C |
| 6 | Errors are NOT announced (per ADR-0009) | The codebase has zero call-sites that pass an error message to `announce` — verified by code-review and a grep regression in T033 | R |

### T036a — `<QuickCopyPanel>` integration (file: `components/quickcopy/QuickCopyPanel.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | Mount with stubbed Provider that emits `pages.context` `onSuccess` and canned XMC results (Live + Preview both healthy) | All five action cards render with correct accessible labels; legend renders five chips; theme toggle visible | I |
| 2 | Click Live URL card | `copyTextToClipboard` called with the composed live URL string | I |
| 3 | Click Preview URL card | `copyTextToClipboard` called with `previewUrl` from the canned `xmc.agent.pagesGetPagePreviewUrl` payload (NOT `pageInfo.url`) | I |
| 4 | Click Item ID card | `copyTextToClipboard` called with `pageInfo.id` (no braces, no whitespace) | I |
| 5 | Click Page Title card | `copyTextToClipboard` called with `pageInfo.displayName` | I |
| 6 | Click Share Link primary | `copyTextToClipboard` called with `[Title](LiveURL)` | I |
| 7 | Press each of `Alt+L/P/I/T/S` while panel focused | Same five clipboard writes as the click paths (1:1 parity per US-006) | I |
| 8 | Tab order | theme-toggle → Live → Preview → Item → Title → Share-primary → Share-caret (assert by `userEvent.tab()` walk) | I |
| 9 | Inject a `pageInfo.version` bump (re-fire `onSuccess` with version+1) | Cache-key change triggers fresh prefetch; any prior error is cleared from the user's view | I |
| 10 | Inject `xmc.pages.retrievePage` rejection | ONLY Live URL card enters persistent error; Preview, Item, Title, Share-via-preview-fallback all keep working (NFR-005) | I |
| 11 | `Alt+L` while focus is inside a (test-injected) `<input>` inside the panel | Handler suppressed; the input receives the keystroke | I |

### T035 — Polish + a11y smoke (file: `components/quickcopy/QuickCopyPanel.a11y.test.tsx`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `axe(panel)` in dark theme | Zero violations | A |
| 2 | `axe(panel)` in light theme (toggle the `dark` class on `document.documentElement` before re-running axe) | Zero violations | A |
| 3 | All interactive elements have a visible focus ring | Tab through each interactive element; assert each has `outline` style or focus-ring class applied — combined with eyeball during `/test` | C+manual |
| 4 | `prefers-reduced-motion: reduce` | The morph element (Active card during `state='copied'`) has no rotation/scale CSS — assert via class absence or computed style | C |
| 5 | Touch target size | Cards ≥120×120px; Share Link strip ≥36px tall — assert via `getBoundingClientRect()` after rendering at 320px panel width | C |

### T033 — Regression audit (no code; greps run as part of `/test`)

| # | Scenario | Expected | Type |
|---|----------|----------|------|
| 1 | `grep -r 'setTimeout\|setInterval' lib/url-resolver/ components/quickcopy/` excluding the morph-revert path inside `ActionCard.tsx` | Zero matches | R |
| 2 | `grep -ri '\bretry\b' lib/ components/quickcopy/ hooks/` excluding `*.test.*` | Zero matches | R |
| 3 | `grep -r 'aria-live' components/quickcopy/` | Matches only inside `StatusLiveRegion.tsx` | R |
| 4 | `grep -rE 'as (string|never|any)' lib/ components/quickcopy/ hooks/` excluding tests and the documented Vitest mock pattern | Zero matches | R |
| 5 | `grep -rE '#[0-9a-fA-F]{3,8}' app/ components/ hooks/ lib/` excluding `globals.css` | Zero matches (semantic tokens only per ADR-0003) | R |

### T038 — Real-portal manual smoke (E2E, manual)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open an unpublished page in Pages editor with QuickCopy installed | Live URL card disabled with the FR-013 tooltip; Preview, Item, Title work; Share Link uses preview URL with the "Page not live — link points to preview" tooltip |
| 2 | Open a published page | All five buttons work end-to-end |
| 3 | Toggle dark ↔ light | All colours flip cleanly; theme persists across panel reload (close + re-open) |
| 4 | Inject an SDK error (temporarily change `xmc.pages.retrievePage` to an invalid key) | Live URL card enters persistent error with the error tooltip; Preview, Item, Title still work |
| 5 | Press each of `Alt+L/P/I/T/S` from inside the panel | Each clipboard action fires; no Pages editor side-effects |
| 6 | Press `Alt+L` while focus is inside a Pages editor text field (outside the iframe) | NO QuickCopy action fires (iframe-scoped listener) |
| 7 | Verify the lint+typecheck+test+build quartet | All four commands pass on the M6 commit |

---

### Coverage summary

| Layer | Test files | Approx scenario count |
|-------|------------|------------------------|
| Unit | 8 (`require-context-id`, `cache/types`, `cache/store`, `prefetch`, `clipboard`, `share-link/formats`, `share-link/select-url`, `useTheme`) | ~46 |
| Component | 14 (`marketplace`, `marketplace.prefetch`, `ActionCard`, `LiveUrlCard`, `PreviewUrlCard`, `ItemIdCard`, `PageTitleCard`, `ActionGrid`, `ShareLinkSplit`, `ThemeToggle`, `useShortcuts`, `ShortcutLegend`, `StatusLiveRegion`, `QuickCopyPanel`) | ~85 |
| Integration | 1 (`QuickCopyPanel`) | 11 |
| Accessibility smoke | 1 (`QuickCopyPanel.a11y`) | 2 axe runs + 3 component assertions |
| Regression / grep | encoded in T033 | 5 grep checks |
| Manual E2E | 1 (T038 portal smoke) | 7 manual scenarios |

Total ~155 distinct assertions / scenarios across roughly 25 test files. The "60-90 cases" target in § 4b is met (approximately 145 enumerated cases B-001..B-150 plus per-task table rows).

## Handoff Metadata

- Canonical run manifest: `products/quickcopy/project-planning/workflow/run-20260424T193446Z.json`
- Source PRD: `products/quickcopy/project-planning/PRD/prd-000.md`
- Source architecture: ADRs only — minimal track. Index at `products/quickcopy/project-planning/ADR/README.md`. ADR-0001..ADR-0010 all referenced inline in § 4c-2.
- Source UI design: `products/quickcopy/project-planning/ui-design/ui-design-20260424T193446Z-v2.md`
- Source POC (visual source of truth): `products/quickcopy/pocs/poc-v2/`
- Recommended next command: `/implement` — Developer (08) reads `prd-minimal-000.md` + this file's § 4b + § 4c + § 9 + § 10 only
- Recommended next input file: this file (`task-breakdown-20260424T193446Z.md`) + `products/quickcopy/project-planning/PRD/prd-minimal-000.md`
- QA enrichment completed: `task_breakdown_style: tdd` set in `run-20260424T193446Z.json` and `current-run.json`
