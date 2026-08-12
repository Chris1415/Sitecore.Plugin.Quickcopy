# Build decisions — QuickCopy

Why this code is shaped the way it is, at component grain. Source files link here
instead of carrying the reasoning inline (rule `87-comment-economy`).

Architecture decisions live in `../project-planning/ADR/`.

Anchors are a contract — source comments point at them. Never rename one; supersede it.

> **Provenance.** Harvested 2026-08-12 from source-file header comments (154 lines, 5 blocks).

---

### SDK response shapes come from the declared types, not the skill catalogue {#sdk-envelope}

**Decision.** Every response shape is derived from the `@sitecore-marketplace-sdk/xmc` declared
types on disk (`node_modules/.../dist/xmc/src/`). The hey-api client-fetch envelope is a
**single-level unwrap**:

```
{ data: TData | undefined, error?: TError, request, response }
```

where `TData` is exactly the SDK response type.

**Why this is stated rather than assumed.** The v0.1 GA build had it wrong — it assumed
**double-wrapped** `{ data: { data: T } }` envelopes and invented host fields (`kind: "delivery"`,
`hostName`) that do not exist on the real `Sites.Host` type. The skill catalogue does not
document response envelopes, so it cannot be the source. Post-mortem:
`../project-planning/plans/diagnostic-2026-04-26-real-tenant-url-failures.md`.

### Pre-fetch in parallel, isolate failures per slot {#prefetch-isolation}

**Decision.** Three queries issue in parallel via `Promise.allSettled` on `pageInfo.id` change:
the page preview URL, the page record (for `publishing.{hasPublishableVersion,isPublishable}`
and `url`), and the host list (`targetHostname || hostnames[0]`). `liveUrl` composes eagerly
when the page is published **and** a host resolves.

**Click handlers are synchronous cache reads — no fetch on click.**

**A failing `listHosts` does not corrupt `previewUrl`.** Each slot fails independently and stays
`{ error }` until the cache key changes (id or version bump). The cache is **version-keyed with
no TTL**.

### No retry, anywhere — and the audit enforces it {#no-retry}

**Decision.** Errors are **persistent**: a failed action stays failed until the cache key
changes. There is no retry, no backoff, and no error `aria-live` region — errors are visual-only.

**A test-only regression audit walks the production source tree** and asserts five contracts:

1. **No `setTimeout`/`setInterval`** outside the documented morph-revert path. The 1500ms
   "Copied" morph is the *only* allowed timer, and only in two named files. The URL resolver must
   contain zero timers.
2. **No `retry` keyword in production code.** Reading the error paths should never reveal a retry
   concept.
3. **No `aria-live` outside `StatusLiveRegion.tsx`.**
4. **No `as string` / `as any` casts on SDK return values.** `as never` on a request **payload**
   is an established workaround for a narrow generic on `client.query` and is *not* a
   return-value cast, so it is permitted — gated separately, restricted to call sites on `xmc.*`
   results (zero today).
5. **No raw hex outside `globals.css`.** Blok semantic tokens are the only colour surface.

**The audit strips comments before scanning**, so a doc string that explicitly disclaims "no
auto-retry" does not trip contracts 2, 3 or 5. It is deliberately simple — `readdirSync` +
`readFileSync` + string scans on a comment-stripped view — because the goal is regression
detection at the same fidelity as a manual grep, not a real lexer.

### One keydown listener, matched on `event.key` {#shortcuts}

**Decision.** A **single** `window`-level `keydown` listener. No per-card key handlers.

**Why single.** Multiple listeners stomp each other on `preventDefault()` and duplicate the
editable-element guard.

**Match on `event.key.toLowerCase()`, never `event.code`.** `event.code` is layout-dependent;
`event.key` is the user's *perceived* character and is what their muscle memory expects.

**The editable-element guard bails without `preventDefault`.** If `document.activeElement` is an
input, textarea, select, or is `contenteditable`, the keystroke must reach the editor
**unmodified**.

**Modifier collision suppression:** require `altKey`, forbid `ctrlKey` and `metaKey`.
`Ctrl+Alt+L`, `Meta+Alt+L` and Shift-anything are treated as not-our-combo.

**On a match, `preventDefault()` + `stopPropagation()` fire *before* the handler** — stopping
propagation prevents Pages-editor accelerators outside the iframe from also firing. **On an
unbound `Alt+X`, bail silently** so surrounding accelerators still work.

**Handlers live in a ref**, read by the listener, so a fresh handlers object each render does not
tear down and re-attach the listener.

**`Alt+S` triggers the share handler and does not open the dropdown** — the hook is
intentionally agnostic of menu state.

### Disabled states use `aria-disabled`, not `disabled` {#aria-disabled}

**Decision.** Disabled and error states set `aria-disabled="true"` rather than the `disabled`
attribute, so the control **stays focusable** and its tooltip is reachable. The tooltip renders
as a hidden sibling with an `id`, wired via `aria-describedby`.

Click, Enter and Space all invoke the action while idle. `prefers-reduced-motion: reduce` strips
the rotation/scale morph class.

**The card does not own its morph timer** — callers do. It makes no SDK calls; `onActivate` is
its only outbound side effect.

**The share split-button's error state disables *both* halves** — primary and caret — and clicks
become no-ops. Escape closes the menu **and restores focus to the caret**; an outside click
closes it without focus restoration.
