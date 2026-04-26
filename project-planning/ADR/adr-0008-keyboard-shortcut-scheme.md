# ADR-0008: Keyboard shortcut scheme — `Alt+L/P/I/T/S` provisional, `Ctrl+Alt+<letter>` named fallback, iframe-scoped listeners

## Status

Accepted

## Context

PRD FR-011 binds five keyboard shortcuts (Live URL, Preview URL, Item ID, Title, Share Link) to the QuickCopy panel and asks the architect to pick a scheme that does not conflict with the Sitecore Pages editor's own hotkeys. PRD OQ-001 explicitly defers the final scheme to this stage. PRD FR-012 requires a visible legend; PRD US-006 requires shortcut activation to produce identical behavior to a click.

Three failure modes were considered:

1. **Listener leakage** — a shortcut bound on `document` inside the iframe still fires when the user is typing in the parent Pages editor's text fields, because postMessage doesn't carry keyboard events but the iframe's own listeners do trigger when focus is inside the iframe. Conversely, parent-window shortcuts cannot reach the iframe. The risk is shortcuts firing when the user didn't mean them to (e.g. typing `Alt+L` in a content field that happens to be inside the iframe).
2. **Shortcut conflict with Pages editor** — if Pages binds `Alt+L` for "Lock layout" or similar, the parent window's listener wins for events that bubble out of the iframe, but events that originate inside the iframe stay local. The conflict only matters when both sides bind the same combo and the user is unsure which one fired. Sitecore Pages editor's documented shortcuts (per Pages docs available via `marketplace-sdk/client.md` and the broader Sitecore documentation set) center on `Ctrl+S` (save), arrow-key navigation in the canvas, and a small set of `Ctrl+<letter>` combos for editor mode toggles. There is no documented use of `Alt+<letter>` shortcuts in Pages editor at the time of this ADR (verified during architecture stage by checking the Marketplace SDK skill files; the SDK documentation does not surface any host-level hotkey contract that QuickCopy must avoid).
3. **OS-level / browser-level collision** — `Alt+<letter>` is the standard browser modifier for menu activation on Windows/Linux (e.g. Chrome's `Alt+F` opens the File menu). On macOS, `Alt` (Option) typically inserts a special character (`Alt+L` → `¬`). For an iframe-scoped panel, browser menus are out of focus when the iframe has focus — so `Alt+<letter>` mostly works. macOS character insertion is suppressed by `event.preventDefault()` in the listener. This is the dominant pragmatic concern.

The shortcut combo `Alt+<letter>` was chosen by the PRD as the strong default because it's a mnemonic match (L=Live, P=Preview, I=Item, T=Title, S=Share) and `Alt` is a less-loaded modifier than `Ctrl` for Marketplace apps that already coexist with the Pages editor's `Ctrl`-heavy shortcut set.

The architect cannot **positively** confirm zero conflicts — Sitecore does not publish an exhaustive Pages-editor hotkey contract, and the host's hotkey behavior may evolve. So the scheme is documented as **provisional**, with a named fallback ready if any conflict surfaces during testing or field use. This ADR records both the primary and the fallback so a swap is a one-line edit, not a re-design.

## Decision

### Primary scheme (v0.1)

| Shortcut | Action |
|----------|--------|
| `Alt+L` | Copy Live URL |
| `Alt+P` | Copy Preview URL |
| `Alt+I` | Copy Item ID |
| `Alt+T` | Copy Page Title |
| `Alt+S` | Copy Share Link (default format = Markdown — see ADR-0010 / OQ-002) |

### Fallback scheme (named — swap target if conflict found)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+L` | Copy Live URL |
| `Ctrl+Alt+P` | Copy Preview URL |
| `Ctrl+Alt+I` | Copy Item ID |
| `Ctrl+Alt+T` | Copy Page Title |
| `Ctrl+Alt+S` | Copy Share Link |

`Ctrl+Alt+<letter>` is documented as a fallback because it is robustly free across Pages editor, browser, and OS conventions on both Windows/Linux and macOS (where `Ctrl+Option` maps cleanly without character-insertion side effects). The cost is a three-key combo, which is slower for power users.

### Listener implementation contract

1. **Iframe-scoped, not document-global.** Bind `keydown` on the panel's root element (or on `window` inside the iframe — these are equivalent for an iframe-scoped Marketplace app since `window` IS the iframe content window). **Do not** attach listeners that cross the postMessage bridge into the parent — there is no API for that, and the SDK does not expose host-key forwarding (`marketplace-sdk/client.md`).
2. **Active only when the panel has focus, OR when no editable element inside the iframe has focus.** Specifically, before invoking the action, check `event.target` against `document.activeElement`: if the active element is `<input>`, `<textarea>`, or any element with `contenteditable=true`, **do not** intercept the keystroke — let the browser handle it. This prevents the legend's keyboard hints from accidentally firing when the user is typing.
3. **`event.preventDefault()` and `event.stopPropagation()` on every recognized combo** — prevents the browser's default (e.g. macOS character insertion, browser menu activation) and stops bubbling.
4. **Match on `event.altKey`, `event.ctrlKey`, `event.shiftKey`, `event.metaKey`, and `event.key.toLowerCase()`.** Do not use `event.code` — `KeyL` differs across keyboard layouts in ways that hurt internationalization. Match the resolved character.
5. **One `useEffect` in the panel root** registers all five listeners as a single `keydown` handler with a switch on the matched combo; same handler returns a single cleanup that removes the listener. No per-button hook.
6. **Visible legend** (FR-012) renders the same keys the listener matches — `Alt + L`, `Alt + P`, etc. — using Blok's `Kbd` primitive (verified present in Blok components catalog under Layout primitives). The legend always reflects the active scheme. If the fallback is adopted, the legend updates automatically because both come from the same constant.
7. **Storage of the active scheme:** a constant in code, not a configuration value. v0.1 ships with the primary scheme. Switching to the fallback requires a code change + redeploy, which is the correct gate — the scheme is an architectural decision, not a runtime preference.

### Conflict-detection plan (test phase, not architecture)

QA's `/test` plan includes a dedicated keyboard-conflict pass (PRD § 12, Release Criteria #3 — "Keyboard-only navigation… works end-to-end"). Specifically:

- For each of the five primary combos: open Pages editor, focus a page in the canvas, press the combo, observe that QuickCopy's clipboard action fires AND no Pages editor side-effect fires.
- Repeat with focus on different Pages editor regions (canvas, left tree, right sidebar, top bar) — confirm the combo only fires QuickCopy when QuickCopy's iframe has focus.
- If any combo triggers a Pages editor action OR fails to trigger QuickCopy's action: switch the active scheme to the fallback, update the legend constant, redeploy, re-test.

If the fallback also conflicts (unlikely but possible), the ADR is updated with a third scheme (e.g. `Ctrl+Shift+<letter>`).

## Consequences

**Easier:**

- One central constant defines both the listener match-table and the legend display — no drift between what the keyboard does and what the legend shows.
- The "in editable-element" guard means QuickCopy never accidentally consumes a user's typing, even if a future Marketplace iframe nests an editor.
- Switching schemes is a constant-edit and a redeploy — no runtime UI for shortcut customization (which would be FR-creep against the marketer-first scope).

**Harder:**

- Cannot positively guarantee zero conflicts — the architect's diligence is "checked the documented host-shortcut surface, found nothing collides." Real-world conflicts may surface in QA or post-ship; the ADR documents the swap path so resolution is fast.
- macOS users must use `event.preventDefault()` to suppress Option-key character insertion. The listener's preventDefault on every recognized combo handles this, but a missed combo would silently insert a special character. Mitigation: every combo in the match-table preventDefaults; combos that aren't in the match-table fall through unchanged.
- The legend uses Blok `Kbd`. If Blok ships an unhelpful visual treatment for the `Kbd` primitive (e.g. too small to read, wrong contrast in dark mode), the UI Designer absorbs the fix during their stage — but per ADR-0003 the answer is to compose from Blok tokens, not reach outside Blok.

**Neutral:**

- The shortcut scheme does NOT compete with Pages editor at the listener level — listeners on a child iframe and listeners on the parent window do not see each other's events. The conflict surface is purely "does the user expect this combo to do something else when they're focused inside QuickCopy's panel."

## Date

2026-04-25
