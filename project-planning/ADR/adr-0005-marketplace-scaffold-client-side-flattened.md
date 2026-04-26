# ADR-0005: Use the Marketplace **Client-Side** scaffold (Scaffold 2), keep nested `next-app/` layout (mirror pageshot)

## Status

Accepted

## Context

QuickCopy must commit to a scaffold pattern before implementation. The Sitecore Marketplace SDK skill (`.agent/skills/sitecore/setup/scaffold.md`) offers three scaffolds:

1. **Content SDK** (`create-content-sdk-app@latest nextjs`) — for headless rendering hosts. Wrong category — QuickCopy is not a head app.
2. **Marketplace Client-Side** (`shadcn add … quickstart-with-client-side-xmc.json`) — Next.js + `@sitecore-marketplace-sdk/client` + `@sitecore-marketplace-sdk/xmc`, browser-only, **Mode A** (portal-brokered auth via postMessage). No server routes, no SSR for SDK calls, no Auth0.
3. **Marketplace Full-Stack** (`shadcn add … quickstart-with-full-stack-xmc.json`) — same as Client-Side plus Auth0 PKCE, server-side `experimental_createXMCClient`, HTTPS local dev with mkcert, `Secure; SameSite=None` cookie config, Mode B server-to-server. Justified only when the app needs server routes that call XMC outside the iframe.

QuickCopy's data needs (per PRD § 9 and FR-002 / FR-003 / FR-004):

- `pages.context` subscription via `client.query('pages.context', { subscribe: true })` — Mode A only.
- `GET /api/v1/pages/{id}/preview-url` — exposed via `xmc.agent.pagesGetPagePreviewUrl` (Marketplace SDK XMC module, Mode A).
- `GET /api/v1/pages/{id}/live` and `GET /sites/{siteId}/hosts` — exposed via `xmc.sites.listHosts` and Agent-API equivalents (Mode A).
- Clipboard write — runs entirely in the browser; needs no server route.
- Theme persistence — `localStorage` in the iframe; needs no server route.

QuickCopy has **zero requirements for own server logic**. The "Agent API" calls referenced in the PRD are Marketplace SDK calls, not raw OAuth REST calls — pageshot needed Mode B server proxy because pageshot's `/screenshot` endpoint takes a binary PNG and requires server-held OAuth credentials. QuickCopy reads metadata and URLs only, all of which the Client SDK exposes via the postMessage bridge with portal-brokered auth. The full-stack scaffold's overhead (Auth0 PKCE, mkcert, HTTPS dev loop, four `.env.local` values, `withAuthenticationRequired` redirect loop debug surface) is pure cost for QuickCopy.

The reference pattern from pageshot (`products/pageshot/site/next-app/`) keeps the **nested `next-app/` subdirectory** that the shadcn quickstart produces by default. The scaffold skill calls out a flatten option (P-043) but lists it as optional and notes the nested layout is fine when not under heavy downstream-path pressure. QuickCopy mirrors pageshot for consistency — both apps deploy from `products/<slug>/site/next-app/`, which keeps Vercel project roots, task-breakdown § 4c-5 paths, and READMEs symmetrical across the two products.

The scaffold skill warns (P-019, P-027) about lint nits and Nova Badge API drift the quickstart ships with — these must be patched immediately after scaffold so `npm run lint` and `npm run typecheck` pass.

## Decision

QuickCopy uses **Scaffold 2 — Marketplace Client-Side**, nested `next-app/` layout, mirroring pageshot.

### Scaffold command (non-interactive, agent-runnable)

```bash
yes '' | npx --yes shadcn@latest add \
  https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json \
  --yes \
  --cwd C:/Projects/agentic/agentic.hahn-solo/products/quickcopy/site
```

Quickstart prompt answers (recommended defaults):

| Prompt | Answer |
|--------|--------|
| Framework | Next.js |
| Project name | `next-app` (default — DO NOT rename) |
| Component library | Radix |
| Preset | Nova (Lucide / Geist) |

Result: `products/quickcopy/site/next-app/` containing Next.js 16 + React 19 + `@sitecore-marketplace-sdk/client` + `@sitecore-marketplace-sdk/xmc` + shadcn/Radix/Nova primitives. **Do NOT flatten the `next-app/` subdirectory** — match pageshot.

### Mandatory post-scaffold patches (apply before first `npm run lint` / `npm run typecheck`)

1. **P-019 lint nits in `components/providers/marketplace.tsx`:**
   - Fix typo `extention` → `extension`.
   - Replace unescaped `your app's` → `your app&apos;s` (or switch to a double-quoted string literal).
2. **P-027 Nova Badge API drift in `components/ui/badge.tsx`:** Nova's `Badge` uses `colorScheme` (`'neutral' | 'primary' | 'success' | 'danger' | 'warning' | …`) for status, not the standard shadcn `variant="destructive" | "secondary"` union. Any code copied from generic shadcn examples must use `colorScheme="danger"` etc. QuickCopy's use of Badge (if any — likely the per-button error indicator) follows Nova's contract.
3. **Install the test stack** (the quickstart ships no test runner):
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
   ```
   Plus `vitest.config.ts`, `vitest.setup.ts`, `package.json` `test` / `test:watch` scripts, and `tsconfig.json` `"types": ["vitest/globals", "@testing-library/jest-dom"]` — verbatim from `setup/scaffold.md § Scaffold 2 step 5`.
4. **Chrome Local Network Access headers** in `next.config.mjs` (or `.ts`) — required so the portal iframe (`https://portal.sitecorecloud.io`) can load `localhost:3000` during local dev:
   ```js
   async headers() {
     return [{
       source: "/:path*",
       headers: [
         { key: "Access-Control-Allow-Private-Network", value: "true" },
         { key: "Access-Control-Allow-Origin", value: "*" },
         { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
         { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Access-Control-Request-Private-Network" },
       ],
     }];
   }
   ```
   Do **not** also set `Access-Control-Allow-Credentials: true` — the spec forbids combining `Origin: *` with credentials and Mode A apps don't need it.
5. **HTTP is fine for local dev.** Mode A apps set no cookies at their own origin; auth is portal-brokered. No mkcert, no `--experimental-https`, no cert-trust dance.

### Marketplace SDK provider + hooks

Use the React Context pattern shipped by the quickstart (`marketplace-sdk/client.md § 2`). Wrap `app/layout.tsx` with `<MarketplaceProvider>`. Consumers call `useMarketplaceClient()` and `useAppContext()`. Do **not** mix in a parallel singleton init path.

For `pages.context` subscription, use **Path A** (subscribe-via-query, `client.query('pages.context', { subscribe: true, onSuccess })`) — `pages.context` is a `QueryMap` key with `subscribable: yes` (`marketplace-sdk/client.md § 6a`). Do not call `client.subscribe('pages.context', …)` — it will not typecheck (`pages.context` is not in the `SubscribeMap`).

### Extension point registration

Single extension point: `xmc:pages:contextpanel`. Route URL: `/panel` (mirrors pageshot). Single `app/panel/page.tsx` file. Cloud Portal registration values:

| Field | Value |
|-------|-------|
| App name | QuickCopy *(append "Test application" suffix for the dogfood install)* |
| Extension point | `xmc:pages:contextpanel` |
| Route URL | `/panel` |
| Dev URL | `http://localhost:3000/panel` |
| Prod URL | `https://<vercel-deployment>.vercel.app/panel` (set during Finish phase) |
| API access | XMC (sites + agent + pages — narrow to what FR-002/003/004 actually call) |
| Authorization | Portal-brokered (Mode A) — no Auth0 config |

### Hosting

Vercel previews + production (matches pageshot ADR-0003). HTTPS auto-issued by Vercel; the dev URL stays HTTP (Mode A allows it).

## Consequences

**Easier:**

- No Auth0, no PKCE, no mkcert, no `withAuthenticationRequired` redirect loop debugging. The full-stack scaffold's dominant failure mode (`Product codes in request do not match client Product codes. AUTH-APL50-56`) cannot occur because QuickCopy never owns an Auth0 client.
- The Marketplace SDK's portal-brokered auth means **zero secrets in QuickCopy's bundle or env** — `NFR-006` and `NFR-007` (no telemetry, no client-side secrets) become almost free guarantees.
- The Vercel deployment matches pageshot's pattern exactly — same Next.js version, same SDK versions, same project root (`site/next-app/`), same registration shape in Cloud Portal. The Lead Developer's § 4c-3 reuses pageshot's recipe nearly verbatim.
- Bundle stays well under the `NFR-008` 150 KB gzipped target — Mode A's footprint is `@sitecore-marketplace-sdk/client` + `/xmc` + Blok primitives + Lucide icons; no Auth0 SDK weight.
- Dev loop: `npm run dev` over HTTP, register `http://localhost:3000/panel` as the dev URL, install into a test tenant, hot-reload works through the portal iframe.

**Harder:**

- If QuickCopy ever needs server-side logic (e.g. a shared analytics endpoint, a paste-target detector that requires server context), it must either upgrade to Scaffold 3 or add isolated Next.js Route Handlers without changing the SDK auth mode (Route Handlers can coexist with Mode A as long as they don't require XMC). For v0.1 this is not in scope.
- Tied to the shadcn quickstart's release cadence — when Blok bumps the quickstart, QuickCopy's scaffold patches (P-019, P-027) need re-verification on the next greenfield run. Mitigation: log resolved package versions in `marketplace-sdk/CATALOG.md` after dogfood per the catalog policy.
- The nested `next-app/` directory means every downstream path (Vercel project root, task-breakdown § 4c-5, README references, test-runner cwd) must include `site/next-app/`. Mirroring pageshot keeps this consistent across both apps; the cost is paid once.

**Neutral:**

- No multi-tenant logic in v0.1 (`xmc:pages:contextpanel` is single-tenant by definition — `marketplace-sdk/client.md § 7`). `application.context.resourceAccess[]` will have exactly one entry; QuickCopy reads `resourceAccess[0].context.live` for the `sitecoreContextId` used in XMC calls. Use the `requireContextId()` typed-helper pattern (`marketplace-sdk/client.md § 4`) — never `as string` casts.
- iframe-scoped `localStorage` for theme persistence (FR-010, ADR-0007) is straightforward in this scaffold — the iframe runs at QuickCopy's own origin (`localhost:3000` dev / `*.vercel.app` prod), so `localStorage` is same-origin and uncomplicated.

## Date

2026-04-25
