# ADR-0010: Share Link split-button — compose from Blok Button + DropdownMenu (no native split-button primitive)

## Status

Accepted

## Context

PRD FR-006 and US-005 specify a split-button for the Share Link action: a primary clickable area that triggers the default format (Markdown), plus an adjacent caret area that opens a dropdown menu offering Markdown and Plain text options. PRD R-004 flags the risk that Blok may not ship a true split-button primitive.

Verification against the Blok components catalog (`.agent/skills/sitecore/blok/components.md`) confirms:

- Blok ships `button`, `icon-button`, and `dropdown` (Radix Dropdown wrapper) as separate primitives.
- Blok also ships `popover`, `context-menu`, and `kbd`.
- Blok does **not** ship a `split-button`, `button-group-with-menu`, or any composite that combines a default-action button with a dropdown caret. This is consistent with shadcn/Radix conventions — Radix offers `DropdownMenu` and a base `Button`, expecting consumers to compose the split shape themselves.

Two composition shapes are viable:

| Shape | Layout | Pros | Cons |
|-------|--------|------|------|
| **Two-button group** (chosen) | `<div>` containing two adjacent buttons: primary `<Button>` (label + action) and secondary `<IconButton>` with caret icon (opens `<DropdownMenu>`). Visual treatment makes them look like a single split control. | Each interactive zone is a real, focusable button. ARIA semantics are clean (two buttons, second has `aria-haspopup="menu"`). Keyboard navigation: Tab into primary, Tab again into caret, Arrow keys inside menu when open. | Requires careful styling to match Blok's Button visual language at the join (no double-border between primary and caret). |
| **Single button with embedded caret-region** | One `<button>` element with two child `<span>` regions; click handler discriminates by `event.target`. Caret region opens the menu. | One element, one focus stop. | Bad ARIA — the menu's `aria-haspopup` either applies to the whole button (so the primary action looks like a menu trigger) or doesn't exist, breaking screen-reader expectations. Two distinct actions on one button is an accessibility anti-pattern. |

The two-button group is the standard Radix DropdownMenu split-button pattern, the WAI-ARIA recommended shape for split buttons (the "Menu Button" pattern combined with an adjacent default-action button), and the natural composition out of Blok's existing primitives.

This ADR exists because the composition has implementation consequences: keyboard mapping (PRD OQ-002), ARIA roles, focus order, visual styling at the join, and how the keyboard shortcut `Alt+S` (ADR-0008) interacts with the dropdown.

PRD OQ-002 asks: "Does `Alt+S` trigger the default format (Markdown) immediately, or open the dropdown?" The architect's call: **`Alt+S` triggers the default format (Markdown) immediately — same behavior as clicking the primary button.** Opening the dropdown via keyboard requires Tab into the caret button, then `Enter` or `ArrowDown`. Rationale: Markdown is the default; power users on the keyboard who want it should not be forced through a menu. Plain-text format is the secondary option — picking it is intentionally a two-step interaction (mouse click on caret OR Tab+Enter to caret + Arrow+Enter on menu item).

## Decision

### Composition

```
<div role="group" aria-label="Share link" class="quickcopy-split">
  <Button onClick={copyShareLinkMarkdown} kbd-shortcut="Alt+S">
    Share Link
  </Button>
  <DropdownMenu>
    <DropdownMenu.Trigger asChild>
      <IconButton aria-label="Choose share-link format" aria-haspopup="menu">
        <CaretIcon />
      </IconButton>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content>
      <DropdownMenu.Item onSelect={copyShareLinkMarkdown}>Copy as Markdown</DropdownMenu.Item>
      <DropdownMenu.Item onSelect={copyShareLinkPlainText}>Copy as Plain text</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu>
</div>
```

**Component sources (Blok):**

- `Button` and `IconButton` — Blok primitives (`blok/components.md` Layout primitives).
- `DropdownMenu` — Blok primitive (Radix Dropdown wrapper, `blok/components.md` Overlay primitives).
- `CaretIcon` — Lucide `ChevronDown` (Nova preset ships Lucide).
- The `<div role="group" aria-label="Share link">` container is plain HTML wrapping two Blok primitives — no custom design tokens, no ad-hoc CSS variables outside Blok (ADR-0003).

### Visual treatment

- The two buttons share visual edges: the primary has rounded-left corners, the caret has rounded-right; no border between them.
- The caret IconButton's width is constrained (e.g. ~28–32px) so the primary button dominates visually — a marketer at a glance reads it as one control with a small dropdown.
- Hover and focus states apply to each button independently. Active focus on either zone shows a Blok focus ring on that zone only.
- Disabled state: when the Share Link is unavailable (both Live and Preview URLs failed — PRD US-005 last AC), **both** the primary and caret are disabled. Tooltip on the primary explains why; the caret button has `aria-disabled="true"` and its menu cannot open.
- Error state (per ADR-0009): same as Disabled, with the red accent + ❌ icon on the primary. Caret is disabled. The user navigates to another page to clear.

### Keyboard contract

| Event | Behavior |
|-------|----------|
| Tab into primary | Primary focused |
| `Enter` or `Space` on primary | Copy default format (Markdown) — same as click |
| Tab from primary | Caret focused |
| `Enter` or `Space` on caret | Opens dropdown menu, focus moves to first menu item |
| `ArrowDown` on caret | Opens dropdown menu, focus moves to first menu item |
| `Escape` in open menu | Closes menu, returns focus to caret |
| `ArrowDown` / `ArrowUp` in menu | Moves focus between menu items |
| `Enter` on menu item | Selects that format, closes menu, fires copy action |
| `Alt+S` (keyboard shortcut, ADR-0008) | Copies default format (Markdown) — same as `Enter` on primary. Does NOT open the dropdown |

This is the standard Radix DropdownMenu keyboard contract; QuickCopy does not customize it. The `Alt+S` shortcut behavior matches the primary button's click behavior, satisfying PRD US-006 ("Activating a shortcut triggers the same behavior … as a click") and resolving OQ-002 in favor of "default format on keyboard shortcut, dropdown for explicit menu access."

### ARIA contract

- The container `<div>` has `role="group" aria-label="Share link"` to group the two buttons semantically.
- The primary button has its own accessible name from its label text; no extra ARIA needed.
- The caret IconButton has `aria-label="Choose share-link format"` (concrete copy may be tightened by UX writing — OQ-003) and `aria-haspopup="menu"`.
- DropdownMenu items have `role="menuitem"` (Radix default) and accessible names from their text.
- When the menu is open, the caret has `aria-expanded="true"` (Radix default).
- Disabled / error states use `aria-disabled` (not the `disabled` attribute) so the button stays focusable for tooltip access (NFR-003 + ADR-0009).

### Format-string contract (binding to FR-005)

The `copyShareLinkMarkdown` and `copyShareLinkPlainText` handlers MUST produce the exact strings specified in PRD FR-005:

- **Markdown:** `[<displayName>](<resolvedUrl>)` — no trailing whitespace.
- **Plain text:** `<displayName> — <resolvedUrl>` — em-dash U+2014, single space either side.

`<resolvedUrl>` is the Live URL when `liveUrl` is a non-null cache value; otherwise the Preview URL (per US-005 AC). When both are unavailable, the buttons are disabled (above).

## Consequences

**Easier:**

- Composition out of existing Blok primitives — no custom component to maintain, no upstream Blok dependency to lobby for.
- ARIA semantics are correct out of the box (Radix handles `aria-haspopup`, `aria-expanded`, focus management, escape to close, etc.).
- Keyboard contract is conventional — power users who know Radix or Material split-buttons are not surprised.
- The composition is documented in this ADR and (per ADR-0003 consequences) becomes a reusable pattern for future Marketplace apps that need a split-button.

**Harder:**

- Visual cohesion at the join (no double-border, matching corner radii, consistent hover / focus states across both zones) is a styling task that the UI Designer must explicitly produce in their design proposals. A naive composition will look like two adjacent buttons with a visible seam.
- Two real buttons mean the user can Tab to "the caret" as a separate stop. This is correct accessibility but adds one tab stop compared to the conventional "five buttons, five Tab stops" panel — total stops become five primary + one caret + theme switcher = seven. The visible legend (FR-012) does not list the caret as a separate shortcut; the caret is a mouse / Tab affordance only.
- Disabled-state synchronization between primary and caret must be explicit. A bug where one is disabled but the other isn't would let the user open a menu for an unavailable action.

**Neutral:**

- The IconButton width and the primary's right-radius matter for visual quality but not for behavior. The UI Designer's job; the Lead Developer's job is to keep the structure as documented above.
- The DropdownMenu's portal render target should be inside the iframe (Radix default) so the menu doesn't try to render in the parent Pages window — verified safe in standard Radix usage; no special config needed.

## Date

2026-04-25
