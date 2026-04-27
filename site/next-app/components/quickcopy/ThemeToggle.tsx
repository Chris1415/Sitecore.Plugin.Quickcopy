"use client";

/**
 * T028b — `<ThemeToggle>` — Blok ghost-button pill for the panel header.
 *
 * Source of truth: § 4c-4 (UI § 5h) + § 4c-5 + ADR-0008 (we own the panel
 * keyboard scheme; native button keyboard activation is fine for this
 * widget — Enter/Space are not part of the Alt-letter map).
 *
 * Visual: small rounded-pill ghost button — sun/moon glyph + current mode
 * label. Border + hairline focus ring use Blok semantic tokens. The button's
 * `aria-pressed` reflects the active theme: `"true"` when dark, `"false"`
 * when light. We pin this semantic to keep the test stable; switching the
 * polarity later requires a test update too.
 *
 * The `<html class="dark">` toggle and localStorage write happen inside
 * `useTheme` (T027); this component is a thin keyboard-friendly Blok pill
 * around `useTheme().toggle`.
 */

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle(props: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  // Native <button> already fires `click` on Enter/Space, but jsdom does not
  // simulate the Space-keyup → click bridge. Wiring an explicit keydown
  // handler keeps the contract testable AND keeps real-browser behavior
  // unchanged (the click runs once because we preventDefault Space to stop
  // the page-scroll that some browsers also fire).
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      aria-pressed={isDark ? "true" : "false"}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={cn(
        // Pill sized to feel anchored to the wordmark, not floating: tighter
        // 1px vertical padding and a token-tinted muted bg so it reads as a
        // peer of the QUICKCOPY label. Hover + focus visible against the
        // dark panel bg.
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px]",
        "border border-border bg-muted/60 text-foreground",
        "font-sans text-[11px] font-medium leading-none",
        "transition-[background-color,border-color,color] duration-150",
        "hover:border-[hsl(var(--primary)/0.45)] hover:bg-muted",
        "outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:[outline-offset:2px]",
        "cursor-pointer",
        props.className,
      )}
    >
      <span aria-hidden="true" className="text-[12px] leading-none">
        {isDark ? "\u23FE" : "\u2600"}
      </span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
