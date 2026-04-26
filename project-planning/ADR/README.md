# Architecture Decision Records

This directory holds ADRs for this product workspace.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0001 | Use ADRs as architecture backbone | Accepted |
| ADR-0002 | Use `xmc:pages:contextpanel` as the only extension point | Accepted |
| ADR-0003 | Use Blok as the only UI framework | Accepted |
| ADR-0004 | Local copy of clipboard module — no shared package, no pageshot refactor | Accepted |
| ADR-0005 | Use the Marketplace Client-Side scaffold (Scaffold 2), nested `next-app/`, mirror pageshot | Accepted |
| ADR-0006 | Live URL composition — parallel pre-fetch on `pageInfo.id` change, in-memory map cache | Accepted |
| ADR-0007 | Cache invalidation — version-based key (`pageInfo.id` + `pageInfo.version`), no TTL, no manual refresh | Accepted |
| ADR-0008 | Keyboard shortcut scheme — `Alt+L/P/I/T/S` provisional, `Ctrl+Alt+<letter>` named fallback, iframe-scoped listeners | Accepted |
| ADR-0009 | Error-state policy — persistent per-button, no auto-retry, no backoff, no manual retry button | Accepted |
| ADR-0010 | Share Link split-button — compose from Blok Button + DropdownMenu (no native split-button primitive) | Accepted |

## Next number

Use the next free four-digit id after the highest existing `adr-*.md`. Next: ADR-0011.
