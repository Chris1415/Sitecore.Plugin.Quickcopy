/**
 * T029 — Keyboard shortcut binding registry.
 *
 * Source of truth: ADR-0008 + § 4c-5 + FR-012.
 *
 * Both `useShortcuts` (T030) and `<ShortcutLegend>` (T031) import from this
 * module so the Alt-letter scheme has exactly one source of truth — change a
 * binding here and listener + legend stay in sync.
 *
 * `keyLower` is matched against `event.key.toLowerCase()` (NEVER `event.code`
 * per ADR-0008). `altKey: true` is required for both schemes; the primary
 * scheme additionally requires `ctrlKey: false` and `metaKey: false` so that
 * `Ctrl+Alt+L` and `Meta+Alt+L` do NOT trigger the primary scheme — the
 * listener (T030) verifies these flags explicitly.
 *
 * `legendKey` is the chip glyph rendered by `<ShortcutLegend>`. `label` is
 * the human-readable action name surfaced in chips and accessibility names.
 */

export type ShortcutId = "live" | "preview" | "item" | "title" | "share";

export interface ShortcutBinding {
  id: ShortcutId;
  altKey: true;
  /**
   * `false` for the primary `Alt+<letter>` scheme; `true` for the documented
   * `Ctrl+Alt+<letter>` fallback. The listener compares to `event.ctrlKey`.
   */
  ctrlKey: boolean;
  /** Always `false` — `Meta+Alt+<letter>` is not a recognized combo. */
  metaKey: false;
  keyLower: "l" | "p" | "i" | "t" | "s";
  /** Human-readable label, e.g. "Live URL". */
  label: string;
  /** Chip glyph for the legend strip — single-letter accelerator. */
  legendKey: "L" | "P" | "I" | "T" | "S";
}

/** Primary scheme — `Alt+L/P/I/T/S`. Active in v0.1 (ADR-0008). */
export const SHORTCUTS: readonly ShortcutBinding[] = [
  { id: "live", altKey: true, ctrlKey: false, metaKey: false, keyLower: "l", label: "Live URL", legendKey: "L" },
  { id: "preview", altKey: true, ctrlKey: false, metaKey: false, keyLower: "p", label: "Preview URL", legendKey: "P" },
  { id: "item", altKey: true, ctrlKey: false, metaKey: false, keyLower: "i", label: "Item ID", legendKey: "I" },
  { id: "title", altKey: true, ctrlKey: false, metaKey: false, keyLower: "t", label: "Page Title", legendKey: "T" },
  { id: "share", altKey: true, ctrlKey: false, metaKey: false, keyLower: "s", label: "Share Link", legendKey: "S" },
] as const;

/**
 * Documented fallback — `Ctrl+Alt+<letter>`. Not active in v0.1; switch
 * `useShortcuts` to consume this constant if QA finds a real-world conflict
 * with the primary scheme (ADR-0008 R-3 mitigation).
 */
export const SHORTCUTS_FALLBACK: readonly ShortcutBinding[] = SHORTCUTS.map(
  (binding) => ({ ...binding, ctrlKey: true }),
);
