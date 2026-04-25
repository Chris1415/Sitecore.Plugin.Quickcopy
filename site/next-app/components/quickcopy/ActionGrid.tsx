"use client";

/**
 * T022b — `<ActionGrid>` — 2x2 grid of action cards.
 *
 * Source of truth: task-breakdown § 4c-4 (layout) + § 10 (T022) + UI § 2.
 *
 * Outer: `gap-px bg-border` to draw 1px hairline gridlines through the gaps.
 * Inner cells inherit `bg-background` so the gridline shows through. Order:
 *   TL=Live   TR=Preview
 *   BL=Item   BR=Title
 */

import { ItemIdCard } from "./ItemIdCard";
import { LiveUrlCard } from "./LiveUrlCard";
import { PageTitleCard } from "./PageTitleCard";
import { PreviewUrlCard } from "./PreviewUrlCard";

export function ActionGrid() {
  return (
    <div
      data-quickcopy="action-grid"
      role="group"
      aria-label="Quick copy actions"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border"
    >
      <LiveUrlCard />
      <PreviewUrlCard />
      <ItemIdCard />
      <PageTitleCard />
    </div>
  );
}
