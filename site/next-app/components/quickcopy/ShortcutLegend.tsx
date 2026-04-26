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

import { SHORTCUTS } from "@/lib/shortcuts/config";
import { cn } from "@/lib/utils";

export interface ShortcutLegendProps {
  className?: string;
}

export function ShortcutLegend(props: ShortcutLegendProps) {
  return (
    <ul
      role="list"
      aria-label="Keyboard shortcuts"
      className={cn(
        "flex items-center justify-between gap-1.5 px-2 pt-2.5 mt-3",
        "border-t border-border",
        "font-sans text-[10px] text-muted-foreground",
        props.className,
      )}
    >
      {SHORTCUTS.map((binding, index) => (
        <li
          key={binding.id}
          data-testid="shortcut-legend-chip"
          className="flex flex-1 items-center justify-center gap-1.5"
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
            className={cn(
              "font-sans text-[9px] font-medium uppercase tracking-wide",
            )}
          >
            {binding.label}
          </span>
          {index < SHORTCUTS.length - 1 ? (
            <span aria-hidden="true" className="text-[10px] opacity-50 ml-1.5">
              ·
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
