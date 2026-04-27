# QuickCopy

A Sitecore Marketplace Page Context Panel app that gives marketers and content authors one-click copy buttons for the five pieces of page metadata they paste most often.

## What this project does

QuickCopy lives inside the Sitecore Pages editor as a right-hand context panel. While a marketer is editing or reviewing a page, the panel surfaces five copy actions that match the data they actually paste into Slack, Teams, Jira, email, or release notes:

- **Live URL** — the absolute public URL of the published page
- **Preview URL** — the authoritative preview URL from the Agent API
- **Item ID** — the page's GUID, with no wrapping braces or whitespace
- **Page Title** — the page's display name as plain text
- **Share Link** — a split-button that copies a `[Title](URL)` Markdown link by default, with a dropdown for a `Title — URL` plain-text variant

The panel defaults to dark mode, ships a first-class light theme, and the choice is persisted in iframe-scoped local storage. Every action is keyboard-operable via `Alt+L / Alt+P / Alt+I / Alt+T / Alt+S`, with a visible legend at the bottom of the panel. Success is communicated by an in-place button morph for 1500ms — there are no toast notifications. Failure is communicated by a persistent per-button error state that clears only when the user navigates to a different page; there is no auto-retry, no manual retry button, and no error spam in the live region.

QuickCopy is deliberately small. It is not a dashboard, not a publishing tool, and not a content-management surface. It is five buttons and a theme toggle, built honestly: the Live URL button is disabled with an explanatory tooltip when the page is not published to Edge, and any failed API call leaves a visible mark instead of pretending to succeed.

## Tech stack

- **Next.js 16** with the App Router and Turbopack
- **React 19** + **TypeScript**
- **Sitecore Marketplace SDK** — `@sitecore-marketplace-sdk/client` and `@sitecore-marketplace-sdk/xmc`, Mode A (portal-brokered auth, no Auth0)
- **Blok** design system — semantic tokens only, no raw hex outside the token block
- **Geist Sans + Geist Mono** loaded via `next/font/google` (Blok Nova preset)
- **Vitest 4** + **@testing-library/react** + **jest-axe** for unit, component, and accessibility tests

## Getting started

### Prerequisites

- Node.js 20 or later
- A Sitecore Cloud Portal account with Marketplace admin access (only required to install and verify QuickCopy in a real tenant)

### Install and run

```bash
cd site/next-app
npm install
npm run dev          # http://localhost:3000/panel
```

The dev server runs at `http://localhost:3000`. The panel route is `/panel`. Outside the Sitecore Pages iframe the SDK handshake cannot complete, so the panel will surface its loading state and then its initialization-error state — this is expected. To see the full panel, install the app into a tenant per `site/next-app/PORTAL_REGISTRATION.md`.

### Useful scripts

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode (TDD inner loop)
npm run build        # Next production build
npm run start        # Run the production build
```

## Project structure

```
products/quickcopy/
  site/next-app/                  # The implementation
    app/
      layout.tsx                  # Root layout, Geist fonts, MarketplaceProvider
      panel/page.tsx              # The /panel route — composes the panel
      globals.css                 # Blok semantic token block (light + dark)
    components/
      providers/marketplace.tsx   # MarketplaceProvider — SDK init, pages.context
      quickcopy/                  # Action cards, split-button, theme toggle, legend
      ui/                         # shadcn/Blok primitives
    hooks/
      useShortcuts.ts             # Alt+L/P/I/T/S keyboard shortcuts
      useTheme.ts                 # Dark/light persistence
    lib/
      cache/                      # Version-keyed cache + useCacheEntry hook
      clipboard.ts                # Local copy of pageshot's clipboard pattern
      share-link/                 # Markdown + plain-text format builders
      url-resolver/prefetch.ts    # Parallel pre-fetch of preview/live/host
      marketplace/                # requireContextId helper
    __tests__/a11y.test.tsx       # jest-axe smoke (dark + light)
    PORTAL_REGISTRATION.md        # Cloud Portal registration values
    SMOKE_TEST.md                 # Manual real-portal verification checklist
  pocs/poc-v2/                    # Visual source of truth (HTML/CSS/JS clickdummy)
  project-planning/               # PRD, ADRs, plans (referenced by docs/)
  docs/
    architecture.md               # Narrative architecture overview
    decisions.md                  # Curated ADR summary
  README.md                       # You are here
  CHANGELOG.md
```

## Architecture summary

QuickCopy is a single-surface Marketplace app. It registers at the `xmc:pages:contextpanel` extension point and renders inside an iframe in the Sitecore Pages editor right sidebar. There is no standalone or full-screen variant.

The panel subscribes to `pages.context` for page identity (`pageInfo.id`, `pageInfo.version`, `pageInfo.displayName`). Whenever the cache key `${pageInfo.id}:${pageInfo.version}` changes, the panel kicks off a parallel pre-fetch of three SDK calls — `xmc.agent.pagesGetPagePreviewUrl`, `xmc.pages.retrievePage` (for live status), and `xmc.sites.listHosts` (for live host) — and writes the results into an in-memory map keyed by the cache key. Click handlers read the resolved state synchronously: there is no fetch on click, and the first click on any button is warm.

The UI is composed from Blok primitives only. Geist Sans and Geist Mono are wired to `--font-sans` and `--font-mono` via `next/font/google`. Failed pre-fetches mark the cache slot as an `Error`, the affected button shows a persistent red state with a tooltip, and the entry clears automatically when the cache key changes — no retry timers, no backoff, no manual retry button.

For the full narrative including data-flow diagrams, the error-state lifecycle, and the rationale behind each major decision, see `docs/architecture.md`.

## Sitecore Marketplace integration

QuickCopy is an iframe app per ADR-0002. It is installed via the Sitecore Cloud Portal and surfaces only at the Pages editor right-sidebar extension point. Authorization is portal-brokered (Mode A per ADR-0005) — there is no Auth0, no PKCE, and no client secret in the bundle. API access is read-only against XMC Sites, Agent, and Pages.

The exact registration values (App name, Extension point, Route URL, API access scopes, tenant binding) are documented in `site/next-app/PORTAL_REGISTRATION.md`. That file is the paste-sheet for whoever performs the install.

## Verification

After installing into a tenant, run the manual smoke checklist at `site/next-app/SMOKE_TEST.md`. It walks through nine sections — panel render, all five buttons on a published page, disabled state on an unpublished page, persistent error state, theme toggle and persistence, keyboard shortcuts, the Share Link dropdown, console hygiene, and a Chrome/Edge/Safari/Firefox browser matrix.

## Backend prerequisite — `targetHostname`

The Live URL (and the Markdown / plain-text Share Link when the page is published) is composed as `https://<targetHostname><page.url>`. The `targetHostname` value comes from XM Cloud:

> Sitecore XM Cloud → **Sites** → *(your site)* → **Hosts** → **Target hostname**

QuickCopy reads this value via `xmc.sites.listHosts`. **It does not write it.** If `targetHostname` is left blank on a host record, the API may return a placeholder (e.g. `example.com` from the OpenAPI sample), which produces a Live URL that does not point at the real public site. Set `targetHostname` to the real CDN / Edge hostname (e.g. `www.dogfeeding.com`, `xmc-…sitecorecloud.io`) before relying on the Live URL or the Share Link's live variant.

If multiple hosts exist QuickCopy picks the first one with a non-empty `targetHostname`; if none have one it falls back to the first non-empty entry of `hostnames[]`. Order the hosts so the canonical delivery host comes first.

## Links

- [CHANGELOG.md](./CHANGELOG.md)
- [docs/architecture.md](./docs/architecture.md)
- [docs/decisions.md](./docs/decisions.md)
- [Cloud Portal registration values](./site/next-app/PORTAL_REGISTRATION.md)
- [Manual smoke checklist](./site/next-app/SMOKE_TEST.md)
