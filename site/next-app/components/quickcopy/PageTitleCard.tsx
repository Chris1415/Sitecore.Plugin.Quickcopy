"use client";

/**
 * T021b — `<PageTitleCard>` — Page Title action card.
 *
 * Source of truth: task-breakdown § 4c-6 + § 10 (T021) + FR-004 + § 4c-8.
 *
 * NO SDK call — reads `displayName ?? name` from `pageInfo`. Whitespace-only
 * `displayName` is treated as missing and falls back to `name`.
 */

import { useMemo } from "react";

import { ActionCard, type ActionCardState } from "./ActionCard";
import { usePagesContext } from "@/components/providers/marketplace";
import { useCopyAction } from "./useCopyAction";

const TOOLTIP_NOT_READY = "Page context not ready — wait or reload.";

export function resolveTitle(
  displayName: string | undefined | null,
  name: string | undefined | null,
): string {
  const dn = typeof displayName === "string" ? displayName.trim() : "";
  if (dn.length > 0) return dn;
  const n = typeof name === "string" ? name.trim() : "";
  return n;
}

export function PageTitleCard() {
  const ctx = usePagesContext();
  const title = useMemo(
    () => resolveTitle(ctx?.pageInfo?.displayName, ctx?.pageInfo?.name),
    [ctx?.pageInfo?.displayName, ctx?.pageInfo?.name],
  );
  const cacheKey = title || null;
  const copy = useCopyAction(title || null, cacheKey);

  let cardState: ActionCardState = "idle";
  let tooltip: string | undefined;

  if (!title) {
    cardState = "disabled";
    tooltip = TOOLTIP_NOT_READY;
  } else if (copy.uiState === "error") {
    cardState = "error";
    tooltip = "Couldn't copy Page Title — try switching pages or reloading.";
  } else {
    cardState = copy.uiState;
  }

  return (
    <ActionCard
      glyph="Aa"
      label="Page Title"
      shortcut="T"
      state={cardState}
      tooltip={tooltip}
      aria-label="Copy Page Title — shortcut Alt+T"
      onActivate={copy.onActivate}
    />
  );
}
