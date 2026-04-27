# Diagnostic: Real-tenant URL fetch failures

**Date:** 2026-04-26
**Tenant observed:** "Dog feeding App" Sitecore Pages session
**Symptom:** Both Live URL and Preview URL action cards show persistent `Failed` state
**Investigator:** Software Architect (04) — main-context analysis

---

## TL;DR

QuickCopy v0.1 was built on the assumption that the Marketplace SDK's `xmc.agent.*`, `xmc.pages.*`, and `xmc.sites.*` query keys would work from inside the `xmc:pages:contextpanel` iframe. **Pageshot — the sibling Marketplace app QuickCopy explicitly mirrors per ADR-0005 — proves that assumption is wrong.** Pageshot does NOT call any `xmc.agent.*` / `xmc.pages.*` / `xmc.sites.*` keys from the panel iframe. Instead, it has a **server-side Next.js API route** running on the Node runtime that calls the Sitecore AI Agent API directly using **OAuth client-credentials** (server-only env vars).

QuickCopy's panel currently fires three iframe-side `client.query("xmc.…")` calls in `lib/url-resolver/prefetch.ts`. In real tenants those calls reject (or return empty), so all three slots land in error state, and both Live URL + Preview URL cards render `Failed`. **The architectural choice — not the visual treatment — is the bug.**

---

## 1. What QuickCopy attempts (call graph)

`lib/url-resolver/prefetch.ts:125-148` issues three parallel `client.query(...)` calls inside the panel iframe whenever the cache key (`${pageInfo.id}:${pageInfo.version}`) changes:

| Call | SDK key | Param shape (matches `.agent/skills/sitecore/marketplace-sdk/xmc.md`) |
|------|---------|------|
| Preview URL | `xmc.agent.pagesGetPagePreviewUrl` | `path: { pageId }, query: { sitecoreContextId }` |
| Page details (live status proxy) | `xmc.pages.retrievePage` | `path: { pageId }, query: { site, language, sitecoreContextId }` |
| Live host list | `xmc.sites.listHosts` | `path: { siteId }, query: { sitecoreContextId }` |

The expectation per ADR-0006 was: parallel pre-fetch on cache-key change, results land in the cache, click handlers are synchronous reads. Item ID and Page Title cards work fine because they read from `pageInfo` directly without any pre-fetch.

The skill catalogue documents all three keys with exactly these param shapes (xmc.md lines 184, 206, 240). So the keys + param shapes are not where the bug lives.

---

## 2. What pageshot actually does (the working precedent)

`grep -r "xmc\.\|client\.query" products/pageshot/site/next-app` returns **zero** matches for `xmc.agent.*`, `xmc.pages.*`, or `xmc.sites.*` in pageshot's panel code. Pageshot only uses two SDK queries from the iframe:

- `client.query('pages.context', { subscribe: true, … })` — Path A subscription (works fine — QuickCopy uses this too and it works in the screenshot)
- `client.query('application.context')` — one-shot read (works fine)

**For the actual Agent API call (page screenshot), pageshot uses a server-side Next.js route handler:**

`products/pageshot/site/next-app/app/api/screenshot/[pageId]/route.ts:32-34`:

```ts
export const runtime = 'nodejs';

const AGENT_BASE =
  'https://edge-platform.sitecorecloud.io/stream/ai-agent-api/api/v1/pages';
```

The route:
1. Runs on Node runtime (not Edge — needs module-scope OAuth token cache)
2. Reads `SITECORE_DEPLOY_CLIENT_ID` / `SITECORE_DEPLOY_CLIENT_SECRET` from env (server-only — must NEVER be `NEXT_PUBLIC_`-prefixed)
3. Uses OAuth client-credentials grant to obtain a bearer token (`lib/sitecore-token.ts`)
4. Calls the Agent API directly via fetch with the bearer token
5. Returns the result to the iframe

The pattern is: **iframe → fetch('/api/screenshot/' + pageId) → Node route handler → OAuth → Agent API → response back through the chain.**

`pageshot/.env.example` documents this explicitly:

> SERVER-ONLY. These two variables are consumed exclusively by the Node-runtime route handler … They must NEVER be prefixed with `NEXT_PUBLIC_` — that would inline them into the client bundle.

---

## 3. Why the iframe-side `xmc.agent.*` keys appear to fail

The `xmc.md` skill catalogue lists `xmc.agent.pagesGetPagePreviewUrl` and friends as if they were available SDK queries. They likely **are** registered SDK keys at the type level — but **availability in a given extension point depends on the parent portal's permission grants**, and the Marketplace SDK appears not to expose the Agent API surface to the `xmc:pages:contextpanel` iframe in production tenants. The most likely failure modes (in order of probability):

### Hypothesis 1 (most likely — 70%) — Agent API surface not available from iframe SDK
The `xmc.agent.*` namespace works in tooling/Sandbox/CLI contexts but not from a Marketplace app iframe in production tenants. Pageshot's existence as a server-side OAuth proxy is strong circumstantial evidence — they wouldn't ship that complexity if the iframe SDK could just call those endpoints directly.

**Confirm by:** Open browser dev tools while the panel is loaded → Network tab → filter for `xmc` or for the parent origin → look for the actual outgoing requests. If you see CORS rejection, `403 Forbidden`, or "No matching SDK module registered", this is the failure mode.

### Hypothesis 2 (likely — 20%) — `xmc.pages.retrievePage` response shape doesn't have `publishing.{hasPublishableVersion, isPublishable}`
ADR-0006's planning explicitly called this out as an "approximation since `xmc.md` ships no dedicated `pagesGetPageLive` SDK key." The shape was inferred from the underlying REST API documented in `pages-api.md`, not verified against the SDK module. If `xmc.pages.retrievePage` either:
- Resolves but returns a different shape than `{ publishing: { hasPublishableVersion, isPublishable } }`
- OR isn't available from the panel iframe (Hypothesis 1 collapse)

…then `publishing` lands in error, and the Live URL card renders `Failed` even when preview happens to work.

**Confirm by:** Network tab → check the request to `xmc.pages.retrievePage` → if it returns 200 but the body is shaped differently, fix our parsing. If it returns 4xx/5xx, this is Hypothesis 1.

### Hypothesis 3 (possible — 5%) — `xmc.sites.listHosts` needs `siteName` not `siteId`
We pass `path: { siteId: siteInfo.id }` but the actual endpoint may key on site name. Some Sitecore APIs interchange `siteId` and `siteName` inconsistently.

**Confirm by:** Network tab → check `listHosts` → 404 with "site not found" suggests this.

### Hypothesis 4 (possible — 5%) — Marketplace app install lacks permission scope
The Marketplace app registration at install time may need to declare specific permission scopes (`pages:read`, `sites:read`, `agent:invoke`) for these keys to resolve. QuickCopy's `PORTAL_REGISTRATION.md` lists "read-only, no write scopes needed" — but doesn't enumerate specific scopes. The Cloud Portal install may have defaulted to scopes that don't grant `xmc.agent.*`.

**Confirm by:** Open Cloud Portal → app details → check declared scopes vs what `xmc.md` says is needed for these endpoints.

---

## 4. Diagnostic step the user can run RIGHT NOW

Open the panel inside the Pages editor where the failures are visible, then:

1. **Open browser dev tools** (F12 or Cmd+Option+I)
2. Go to the **Network tab** and clear it
3. Reload the panel iframe (refresh the Pages editor page or close/reopen the panel)
4. Filter the Network panel by **`xmc`** OR by **`agent`** OR by **`marketplace-sdk`**
5. Look at:
   - Are any requests being fired at all? If **no** outgoing HTTPS requests appear when the panel loads, the SDK is rejecting the queries before they hit the wire (likely "no module registered for key xmc.agent.*").
   - If requests fire, what's the **response status**? `403` / `401` / `404` / `5xx` each pointing to a different fix.
   - If status `200`, what's the **response body shape**? May confirm or refute Hypothesis 2.
6. Also check the **Console tab** for any thrown errors from `@sitecore-marketplace-sdk/client` — those messages usually name the failed key.

Screenshot or copy/paste the findings back to me and I can localize the fix exactly.

---

## 5. Proposed code fixes (depending on diagnostic outcome)

### Outcome A: Hypothesis 1 confirmed (SDK keys not available from iframe)

**Adopt pageshot's pattern.** This is a meaningful architectural shift:

1. Add Node-runtime API routes to `products/quickcopy/site/next-app/app/api/`:
   - `GET /api/preview-url/[pageId]` — proxies `GET /api/v1/pages/{pageId}/preview-url`
   - `GET /api/page-status/[pageId]` — proxies `GET /api/v1/pages/{pageId}` and returns `{ isPublished }`
   - `GET /api/site-hosts/[siteId]` — proxies `GET /api/v1/sites/{siteId}/hosts`
2. Copy `lib/sitecore-token.ts` from pageshot (OAuth client-credentials with module-scope cache + invalidate-on-401-retry-once).
3. Add `SITECORE_DEPLOY_CLIENT_ID` / `SITECORE_DEPLOY_CLIENT_SECRET` to `.env.local` and document in `.env.example` (server-only, NEVER `NEXT_PUBLIC_`).
4. Rewrite `lib/url-resolver/prefetch.ts` to call these three `/api/...` endpoints via `fetch()` instead of `client.query("xmc.…")`. Keep the cache shape, the parallel pattern, and the cache-key invalidation untouched.
5. Update `PORTAL_REGISTRATION.md` and `SMOKE_TEST.md` to enumerate the env vars needed at install/deploy time.
6. New ADR (ADR-0011): "Server-side OAuth proxy for Agent API calls — supersedes ADR-0006's iframe-side `xmc.agent.*` assumption."
7. Update prd-minimal-000.md Key Constraints section to reflect the new fetch model.

**Estimated effort:** 1-2 days. Substantial but follows a proven pattern (pageshot's working code).

### Outcome B: Hypothesis 2 confirmed (response shape mismatch only)

Adjust the unwrap logic in `lib/url-resolver/prefetch.ts:163-177` to match the actual response shape returned by `xmc.pages.retrievePage`. Quick fix — minutes, not days.

### Outcome C: Hypothesis 3 confirmed (siteName vs siteId)

One-line fix in `lib/url-resolver/prefetch.ts:144`: change `path: { siteId: siteInfo.id }` to `path: { siteId: siteInfo.name }` — but verify `xmc.md` allows that param name. (The catalogue explicitly says `siteId`, so this is unlikely the only issue but worth checking.)

### Outcome D: Hypothesis 4 confirmed (permission scopes)

Update Marketplace app registration in Cloud Portal to declare needed scopes; document in `PORTAL_REGISTRATION.md`. Re-install the app.

---

## 6. Skill memory updates (the highest-leverage learnings)

Regardless of which hypothesis confirms, this run revealed gaps in the agentic skill library that future Marketplace builds should not re-encounter.

### A. `.agent/skills/sitecore/marketplace-sdk/xmc.md` — add an availability matrix

The current catalogue lists keys but does NOT distinguish:
- Which keys are guaranteed-available from `xmc:pages:contextpanel`
- Which keys require `standalone` or `fullscreen` to resolve
- Which keys are practically only available via server-side OAuth proxy (regardless of SDK type-level registration)

**Proposed addition** at the top of `xmc.md`:

```markdown
## ⚠ Availability per extension point — verify before committing in code

The keys below are SDK-registered, but **availability at runtime depends on
which extension point hosts the call AND which permission scopes the Marketplace
app declared at install time.** In particular:

| Surface | What's reliably available |
|---------|---------------------------|
| `xmc:pages:contextpanel` | `pages.context`, `application.context`, mutations like `pages.reloadCanvas` and `pages.context` (navigation). Read-only `xmc.agent.*` and `xmc.pages.*` queries are **NOT reliably available from iframe** in production tenants — sibling app `pageshot` proxies via server-side OAuth instead. |
| `standalone` | Full breadth of `xmc.*` queries — this is the umbrella surface. |
| `xmc:fullscreen` | Most `xmc.*` queries — bound to single tenant. |

**Verification protocol before you commit `client.query("xmc.…")` in panel code:**

1. Search `products/pageshot/site/next-app/` for the key — does the working
   sibling app use it from the iframe, or does it proxy via `app/api/…`?
2. If pageshot proxies, you must too. Iframe `xmc.*` queries are not a free pass.
3. If you must use the iframe call, confirm in a real tenant via Network tab
   BEFORE writing tests against the call. Stub-tests don't reveal that the
   parent SDK rejects the key.
```

### B. `.agent/skills/sitecore/marketplace-sdk/lifecycle.md` — add a "server-side proxy pattern" section

Document the pageshot OAuth proxy pattern as the canonical approach for any Marketplace app that needs Agent API access:

```markdown
## Server-side OAuth proxy for Agent API access

When a Marketplace app needs to call the SitecoreAI Agent API
(`/api/v1/pages/…`, `/api/v1/sites/…`, etc.), the iframe-side
`client.query("xmc.agent.…")` SDK keys are NOT a reliable pathway — they
work in tooling/CLI contexts but not consistently from `xmc:pages:contextpanel`
in production tenants. The proven pattern (pageshot v0.1 in production):

1. **Node-runtime API routes** in `app/api/<endpoint>/route.ts` (NOT Edge —
   the OAuth token cache uses module-scope state).
2. **Server-only env vars** for OAuth client-credentials:
   `SITECORE_DEPLOY_CLIENT_ID`, `SITECORE_DEPLOY_CLIENT_SECRET`. NEVER prefix
   `NEXT_PUBLIC_` (would inline into client bundle — security incident).
3. **Module-scope OAuth token cache** with invalidate-on-401-retry-once.
4. **Strict response envelope** — `{ ok: true, data } | { ok: false, error: { code, message } }`
   — so the iframe consumer never has to parse upstream variations.
5. **No bearer token or client secret in logs** (NFR-S-01 in pageshot's PRD).

See `products/pageshot/site/next-app/app/api/screenshot/[pageId]/route.ts` and
`lib/sitecore-token.ts` for the canonical implementation.
```

### C. `.agent/skills/sitecore/marketplace-sdk/testing-debug.md` — add SDK key verification checklist

```markdown
## Verifying SDK keys before code commits

When the task breakdown's § 4c-6 names an `xmc.<module>.<verb>` key, verify
all three of the following BEFORE writing the implementation:

1. **Catalogue check** — the key appears in `xmc.md` with documented param shape.
2. **Real-tenant check** — pageshot (or another shipped sibling app) actually
   issues this call from the panel iframe in production. If pageshot proxies
   via `app/api/...` instead, that's a strong signal that you should too.
3. **Stub harness check** — your Vitest mock of `client.query` accurately
   represents the rejection mode that real tenants exhibit (404 / 403 / network /
   "module not found"). A stub that always resolves with mock data hides the
   failure mode that will bite in production.

The third one is what bit QuickCopy v0.1: 167+ tests passed because the mock
SDK always resolved. The real tenant rejects the call and the panel shows
"Failed" — none of the regression tests caught it.
```

### D. New section in `.agent/commands/project/dev-flow/04-architect.md`

When `platform_target` is `marketplace`, add an explicit step:

```markdown
**Marketplace surface verification (mandatory):** Before locking any
architecture that depends on `xmc.<module>.<verb>` SDK queries from the
panel iframe, the architect MUST:

1. Search the existing Marketplace apps under `products/` for usage of the
   same key. If the sibling app proxies via `app/api/...` instead of using
   the iframe SDK, the new app's architecture should follow that pattern
   and document it as an ADR.
2. Note in the architecture / ADR which calls happen iframe-side vs
   server-side, and why. Don't leave the choice implicit.

This is a guardrail against the QuickCopy v0.1 bug pattern: assuming
iframe SDK availability based on `xmc.md` listings alone.
```

### E. New rule file `.agent/rules/40-marketplace-sdk.mdc`

```markdown
---
glob: products/*/site/next-app/**/*.{ts,tsx}
description: Marketplace app SDK usage guardrails
---

When Marketplace app code uses `client.query("xmc.<module>.<verb>", …)` from
within the panel iframe, verify that a sibling shipped app uses the same call
the same way. If sibling apps proxy via server-side `app/api/…` routes
instead, follow that pattern — iframe-side `xmc.agent.*`/`xmc.pages.*`/
`xmc.sites.*` queries are NOT reliably available in production tenants from
the `xmc:pages:contextpanel` extension point.

Server-side proxy pattern: see `.agent/skills/sitecore/marketplace-sdk/lifecycle.md`
"Server-side OAuth proxy for Agent API access".
```

---

## 7. ADR / PRD recommendations

Pending the diagnostic outcome:

- **If Hypothesis 1 confirms** (most likely): write **PRD-001 — Server-side Agent API proxy** that re-architects QuickCopy's Live/Preview URL fetching. Includes new ADR-0011 superseding ADR-0006's iframe-fetch model. Effort: 1-2 days.
- **If Hypothesis 2 confirms only**: a small ADR-0011 amendment + bugfix commit. Effort: hours.
- **If Hypothesis 3 confirms only**: bugfix commit, no ADR change. Effort: minutes.
- **If Hypothesis 4 confirms only**: PORTAL_REGISTRATION.md update + re-install. Effort: minutes once the right scopes are known.

In all cases, **the skill memory updates in §6 should ship regardless** — they prevent the next Marketplace app from hitting the same trap.

---

## 8. Recommended next action

1. **Run the diagnostic in §4** (Network tab in browser dev tools while the panel loads in the real tenant). Send me the result.
2. Based on the outcome, I'll execute the appropriate fix from §5 in a focused micro-run.
3. Apply the skill memory updates in §6 to the agentic skill library — the highest-leverage learning loop, regardless of outcome.

The bug is real, the fix is well-scoped, and the lessons are captured. Let's land them.
