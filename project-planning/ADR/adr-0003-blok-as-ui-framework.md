# ADR-0003: Use Blok as the only UI framework

## Status

Accepted

## Context

QuickCopy needs a UI framework decision before implementation begins. Options considered:

- **Blok** — Sitecore's own design system, aligned with the Pages editor visual language and theme. Marketplace apps that use Blok feel native to Sitecore users.
- **Tailwind CSS + custom components** — fast to write, but produces an app that visually clashes with the surrounding Pages editor. Risks looking like a foreign body in the sidebar.
- **Radix / shadcn / Headless UI primitives + custom theme** — flexible, but duplicates work that Blok already does and forces ongoing visual drift maintenance.
- **Roll-our-own from scratch** — out of scope for an XS dogfood app.

The stakeholder explicitly committed to Blok during PRD discovery: "decision it has to use blok, primarily dark mode with switcher."

## Decision

QuickCopy uses **Blok exclusively** for all UI. No Tailwind, no custom CSS variables outside Blok tokens, no third-party component libraries. Components needed (Button, IconButton, Tooltip, Toggle, Kbd-equivalent, Menu/Dropdown for split-button) are sourced from Blok or composed from lower-level Blok tokens.

If Blok lacks a primitive QuickCopy needs (e.g. a true split-button component), the architect composes it from Blok's lower-level building blocks rather than reaching outside the system.

## Consequences

**Easier:**
- Visual coherence with Pages editor — the panel feels native, not bolted on.
- Dark/light theming is consistent with Sitecore's own surfaces; users get the same theme switching behavior they expect.
- Accessibility primitives (focus rings, ARIA roles, contrast) inherit Blok's defaults.
- Future Marketplace apps can copy QuickCopy's Blok-only pattern.

**Harder:**
- Any missing Blok primitive becomes a composition exercise, not a "grab a library off the shelf" task.
- Tied to Blok's release cadence — breaking changes in Blok ripple into QuickCopy.
- Onboarding new contributors who know Tailwind/Material/etc. requires a brief Blok ramp.

## Date

2026-04-25
