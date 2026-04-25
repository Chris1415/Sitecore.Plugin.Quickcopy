"use client";

/**
 * T020b — `<ItemIdCard>` — Item ID action card.
 *
 * Source of truth: task-breakdown § 4c-6 + § 10 (T020) + § 4c-8 (brace
 * handling) + ADR-0009.
 *
 * NO SDK call — reads `pageInfo.id` directly from the Provider. Strips a
 * single leading `{` paired with a single trailing `}`, then trims whitespace.
 * Disabled with "Page context not ready — wait or reload." when id is
 * missing or empty (post-trim).
 */

import { useMemo } from "react";

import { ActionCard, type ActionCardState } from "./ActionCard";
import { usePagesContext } from "@/components/providers/marketplace";
import { useCopyAction } from "./useCopyAction";

const TOOLTIP_NOT_READY = "Page context not ready — wait or reload.";

/**
 * Strip wrapping braces and trim — per § 4c-8.
 *  `'{ABC-123}'`     → `'ABC-123'`
 *  `'  abc-123  '`   → `'abc-123'`
 *  `'{ abc-123 }'`   → `'abc-123'` (trim happens after brace strip and again after)
 */
export function normalizeItemId(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  if (s.startsWith("{") && s.endsWith("}")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function ItemIdCard() {
  const ctx = usePagesContext();
  const rawId = ctx?.pageInfo?.id;
  const id = useMemo(() => normalizeItemId(rawId), [rawId]);
  const cacheKey = id || null;
  const copy = useCopyAction(id || null, cacheKey);

  let cardState: ActionCardState = "idle";
  let tooltip: string | undefined;

  if (!id) {
    cardState = "disabled";
    tooltip = TOOLTIP_NOT_READY;
  } else if (copy.uiState === "error") {
    cardState = "error";
    tooltip = "Couldn't copy Item ID — try switching pages or reloading.";
  } else {
    cardState = copy.uiState;
  }

  return (
    <ActionCard
      glyph="#"
      label="Item ID"
      shortcut="I"
      state={cardState}
      tooltip={tooltip}
      aria-label="Copy Item ID — shortcut Alt+I"
      onActivate={copy.onActivate}
    />
  );
}
