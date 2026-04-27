"use client";

/**
 * T017b — `<ActionCard>` Blok-composed reusable card primitive.
 *
 * Source of truth: task-breakdown § 4c-4 (visual states) + § 10 (T017a) +
 * ADR-0009 (persistent error) + UI § 5 (interaction states).
 *
 * Composes a Blok ghost button + Geist Mono glyph + Geist Sans label +
 * Kbd shortcut chip into a square 2x2 cell. Five states:
 *  - `idle`     — clickable, primary glyph
 *  - `copied`   — morph "Copied" label, glyph swap to ✓ — held 1500ms by caller
 *  - `disabled` — hatched overlay, `aria-disabled` (NOT `disabled`), tooltip
 *  - `error`    — inset destructive ring, ❌ + "Failed", `aria-disabled`,
 *                  tooltip carries the reason. Persistent per ADR-0009.
 *
 * The component does NOT manage the morph timer itself — owners do (per
 * card spec). It also does NOT make SDK calls — `onActivate` is the only
 * outbound side effect.
 *
 * Accessibility:
 *  - Disabled & error states use `aria-disabled="true"` (focusable for tooltip).
 *  - Click + Enter + Space all invoke `onActivate` while idle.
 *  - `tooltip` prop renders a hidden sibling element with `id`, wired via
 *    `aria-describedby`.
 *  - `prefers-reduced-motion: reduce` strips the rotation/scale morph class.
 */

import { useId, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export type ActionCardState = "idle" | "copied" | "disabled" | "error";

export interface ActionCardProps {
  glyph: string;
  label: string;
  shortcut: string;
  state: ActionCardState;
  tooltip?: string;
  onActivate: () => void;
  "aria-label": string;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  // `useSyncExternalStore`-shaped subscribe pattern avoids the
  // "setState in effect" lint warning while remaining SSR-safe (the
  // server snapshot is `false`).
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function ActionCard(props: ActionCardProps) {
  const {
    glyph,
    label,
    shortcut,
    state,
    tooltip,
    onActivate,
    className,
  } = props;
  const ariaLabel = props["aria-label"];
  const tipId = useId();
  const reducedMotion = usePrefersReducedMotion();

  const isInteractive = state === "idle" || state === "copied";
  const isAriaDisabled = state === "disabled" || state === "error";

  const handleClick = () => {
    if (!isInteractive) return;
    onActivate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onActivate();
    }
  };

  // Visible glyph + label depend on state (per UI § 5).
  // Error glyph: ✕ (U+2715 HEAVY MULTIPLICATION X) — a TEXT glyph that obeys
  // `color: hsl(var(--destructive))`. The previous ❌ (U+274C) is a color
  // emoji that browsers render as a built-in red square + white X bitmap,
  // ignoring CSS color and producing a "full-bleed red" look that dominated
  // the destructive ring + Failed label. ✕ keeps the visual semantic (an X
  // crossing out the action) while honoring Blok semantic-token colour.
  const visibleGlyph =
    state === "copied" ? "✓" : state === "error" ? "✕" : glyph;
  const visibleLabel =
    state === "copied" ? "Copied" : state === "error" ? "Failed" : label;

  // Compose semantic-token classes only.
  const stateClasses = (() => {
    switch (state) {
      case "copied":
        return [
          "bg-primary/10",
          "shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.5)]",
          // Animation morph utility — stripped under prefers-reduced-motion.
          reducedMotion ? "" : "qc-card-morph",
        ];
      case "disabled":
        return ["cursor-not-allowed", "qc-card-hatched"];
      case "error":
        return [
          "shadow-[inset_0_0_0_2px_hsl(var(--destructive))]",
          "text-destructive",
        ];
      case "idle":
      default:
        return [
          "hover:bg-primary/[0.08]",
          "hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]",
        ];
    }
  })();

  const glyphClasses = cn(
    "font-mono text-[32px] leading-none font-semibold",
    state === "error" ? "text-destructive" : "text-primary",
    state === "disabled" && "opacity-50",
  );

  const labelClasses = cn(
    "font-sans text-[12px] font-medium tracking-tight",
    state === "error" ? "text-destructive" : "text-foreground/80",
    state === "disabled" && "opacity-60",
  );

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-disabled={isAriaDisabled || undefined}
        aria-describedby={tooltip ? tipId : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex h-[120px] w-full flex-col items-center justify-center gap-1 overflow-hidden",
          "border-0 bg-background text-foreground",
          "transition-[background-color,transform,box-shadow] duration-150",
          "outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:[outline-offset:-2px]",
          "active:scale-[0.98]",
          ...stateClasses,
          className,
        )}
      >
        <span className="absolute top-2 left-2">
          <span
            className="inline-block rounded border border-border bg-muted px-[5px] py-[3px] font-mono text-[10px] font-medium text-muted-foreground leading-none"
            aria-hidden="true"
          >
            {shortcut}
          </span>
        </span>

        <span aria-hidden="true" className={glyphClasses}>
          {visibleGlyph}
        </span>

        <span className={labelClasses}>{visibleLabel}</span>
      </button>

      {tooltip ? (
        <span
          id={tipId}
          role="tooltip"
          className="sr-only"
        >
          {tooltip}
        </span>
      ) : null}
    </>
  );
}
