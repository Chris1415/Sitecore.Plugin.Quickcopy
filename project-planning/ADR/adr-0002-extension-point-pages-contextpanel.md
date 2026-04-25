# ADR-0002: Use `xmc:pages:contextpanel` as the only extension point

## Status

Accepted

## Context

The Sitecore Marketplace SDK exposes several extension points (`xmc:fullscreen`, `xmc:pages:contextpanel`, `xmc:pages:customfield`, `xmc:dashboardblocks`, `standalone`). Each has different available data, different UI affordances, and different deployment semantics. QuickCopy's value proposition is "copy the page reference I'm currently looking at" — which requires live access to the page being edited.

Among the extension points:
- `xmc:fullscreen` — does not have `pages.context`; only `application.context`. Wrong surface for "the page I'm editing."
- `xmc:pages:customfield` — field-level, narrow viewport; over-constrained for a five-button palette.
- `xmc:dashboardblocks` — dashboard scope, no Pages editor context.
- `standalone` — umbrella surface across organisation; not bound to a single Pages session.
- `xmc:pages:contextpanel` — Pages editor right sidebar with subscribable `pages.context`. Exact fit.

## Decision

QuickCopy registers **only** at `xmc:pages:contextpanel`. No other extension points are exposed in v0.1.

## Consequences

**Easier:**
- Single subscription model — `pages.context` is the source of truth for the entire app.
- Live updates as the user navigates in Pages re-render the buttons automatically.
- No multi-tenant logic, no `application.context.resourceAccess[]` enumeration, no install picker UI.
- Smaller bundle, faster boot.

**Harder:**
- The app is invisible outside the Pages editor — a marketer working in the dashboard or a full-screen surface cannot reach QuickCopy. Future variants (dashboard widget, standalone) would be separate ADRs and likely separate apps.
- If Sitecore deprecates or restructures the contextpanel extension point, QuickCopy has no fallback surface.

## Date

2026-04-25
