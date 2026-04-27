"use client";

/**
 * T031b — `<ShortcutLegend>` — bottom legend strip.
 *
 * Source of truth: § 4c-4 + § 10 T031a + FR-012 + ADR-0008.
 *
 * One row at the bottom of the panel rendering every binding from `SHORTCUTS`
 * as a Blok-styled chip: `<kbd>{legendKey}</kbd>` + label, separated visually
 * by `·`. Always visible — no expand/collapse affordance per FR-012. Geist
 * Sans 9px uppercase tracking-wide for the labels; Geist Mono for the kbd.
 *
 * Accessibility: rendered as `<ul role="list" aria-label="Keyboard shortcuts">`
 * with five `<li>` children. The dot separators are decorative (`aria-hidden`).
 */

import { SHORTCUTS, type ShortcutId } from "@/lib/shortcuts/config";
import { cn } from "@/lib/utils";

export interface ShortcutLegendProps {
  className?: string;
}

/**
 * Compact single-word labels for the legend strip — keeps every cell on a
 * single line at the panel's narrow sidebar width. The long-form label from
 * `SHORTCUTS` is kept in screen-reader text so accessible names + assertion
 * tests still see "Live URL", "Preview URL", etc.
 */
const COMPACT_LABEL: Record<ShortcutId, string> = {
  live: "Live",
  preview: "Preview",
  item: "Item",
  title: "Title",
  share: "Share",
};

export function ShortcutLegend(props: ShortcutLegendProps) {
  return (
    <ul
      role="list"
      aria-label="Keyboard shortcuts"
      className={cn(
        "mt-4 flex items-center justify-between gap-1 px-1 pt-3",
        "border-t border-border",
        "font-sans text-[10px] text-muted-foreground",
        props.className,
      )}
    >
      {SHORTCUTS.map((binding) => (
        <li
          key={binding.id}
          data-testid="shortcut-legend-chip"
          className="flex flex-1 flex-col items-center gap-1"
        >
          <kbd
            className={cn(
              "inline-block rounded border border-border bg-muted",
              "px-[5px] py-[2px] font-mono text-[9px] font-medium leading-none",
              "text-foreground",
            )}
          >
            Alt+{binding.legendKey}
          </kbd>
          <span
            aria-hidden="true"
            className={cn(
              "whitespace-nowrap font-sans text-[9px] font-medium uppercase tracking-wide",
            )}
          >
            {COMPACT_LABEL[binding.id]}
          </span>
          <span className="sr-only">{binding.label}</span>
        </li>
      ))}
    </ul>
  );
}
