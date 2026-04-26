# Sitecore Cloud Portal — QuickCopy registration values

This document is the paste-sheet for whoever registers QuickCopy in the
Sitecore Cloud Portal during install. Keep it next to the build artifact —
the values below are pinned to the architecture decisions captured in
`project-planning/ADR/` and the canonical task breakdown.

## App Studio → Custom App registration

| Field                | Value                                                           |
|----------------------|-----------------------------------------------------------------|
| App name             | `QuickCopy`                                                     |
| Description          | One-click copy panel for Sitecore Pages — Live URL, Preview URL, Item ID, Page Title, Share Link |
| Extension point      | `xmc:pages:contextpanel` (per ADR-0002 — only this surface)      |
| Route URL            | `<deployed-host>/panel` (e.g. `https://quickcopy.example.com/panel`) |
| Dev URL              | `http://localhost:3000/panel`                                   |
| Production URL       | `<deployed-host>/panel` (filled in at `/ship`)                  |
| API access           | XMC — Sites + Agent + Pages, read-only (no write scopes)        |
| Authorization        | Portal-brokered (Mode A per ADR-0005). **No Auth0**, no PKCE, no client secret. |
| Tenant binding       | Single-tenant per install (ADR-0002 consequences). The panel reads `application.context.resourceAccess[0].context.live` via the typed `requireContextId()` helper. |
| Permissions surface  | Read-only. The app never writes to Sitecore — it only reads page context, queries `/preview-url`, `/live`, `/sites/{siteId}/hosts`, and copies values to the user's clipboard. |
| Telemetry            | None. Zero analytics, zero third-party scripts (PRD non-negotiable). |

## Iframe sandbox / browser headers

The Pages editor embeds the panel in a sandboxed iframe served from the
public Cloud Portal origin. Two browser-level concerns are already handled
by the build:

1. **Chrome Private Network Access (PNA).** When the parent origin is
   `https://portal.sitecorecloud.io` and the iframe loads
   `http://localhost:3000`, Chrome enforces PNA consent. The dev server
   responds with `Access-Control-Allow-Private-Network: true` plus the
   matching CORS triple — see `next.config.mjs`. Production hosts on
   `https://` skip the PNA layer entirely.
2. **Cross-origin iframe permissions.** No special `allow="..."` policy is
   required. The clipboard write uses `navigator.clipboard.writeText`,
   which is granted automatically inside a same-origin iframe AND inside
   a cross-origin iframe AS LONG AS the click is user-initiated (which
   ours always is — five buttons + five keyboard shortcuts, all
   user-driven).

## Verification after install

After saving the registration and granting the app to a tenant:

1. Open Pages editor on any page in that tenant.
2. The right-side context panel should show the QuickCopy header
   ("QUICKCOPY" wordmark + theme toggle), a 2x2 grid with Live URL,
   Preview URL, Item ID, Page Title, the Share Link split-button, and
   the keyboard-shortcut legend at the bottom.
3. If the panel is blank, check the dev console for an
   `Error initializing Marketplace SDK` banner — that means the parent
   window did not deliver an `application.context` payload, which is
   usually a permissions or extension-point misconfiguration.

For the runnable smoke checklist after install, see `SMOKE_TEST.md`.

## Cross-references

- ADR-0002 — Marketplace extension point (`xmc:pages:contextpanel` only)
- ADR-0005 — Mode A (portal-brokered auth, no Auth0)
- `project-planning/plans/task-breakdown-<timestamp>.md` § E11 / T037
