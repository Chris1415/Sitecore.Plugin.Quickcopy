"use client";

/**
 * T019b — `<PreviewUrlCard>` — Preview URL action card.
 *
 * Source of truth: task-breakdown § 4c-6 + § 10 (T019) + FR-003 + ADR-0009.
 *
 * Reads `previewUrl` from the cache (NEVER `pageInfo.url`) — the authoritative
 * Agent API field per FR-003. Persistent error per ADR-0009.
 */

import { ActionCard, type ActionCardState } from "./ActionCard";
import { useCacheEntry } from "@/lib/cache/useCacheEntry";
import { useCopyAction } from "./useCopyAction";

const TOOLTIP_LOADING = "Loading…";
const TOOLTIP_ERROR =
  "Couldn't fetch Preview URL — try switching pages or reloading.";

const isError = (slot: unknown): boolean =>
  slot !== null &&
  typeof slot === "object" &&
  slot !== undefined &&
  "error" in (slot as Record<string, unknown>);

export function PreviewUrlCard() {
  const { key, state } = useCacheEntry();
  const previewUrl =
    typeof state?.previewUrl === "string" ? state.previewUrl : null;
  const copy = useCopyAction(previewUrl, key);

  let cardState: ActionCardState = "idle";
  let tooltip: string | undefined;

  if (!state) {
    cardState = "disabled";
    tooltip = TOOLTIP_LOADING;
  } else if (isError(state.previewUrl)) {
    cardState = "error";
    tooltip = TOOLTIP_ERROR;
  } else if (state.previewUrl === null) {
    cardState = "disabled";
    tooltip = TOOLTIP_LOADING;
  } else {
    cardState = copy.uiState === "error" ? "error" : copy.uiState;
    if (copy.uiState === "error") tooltip = TOOLTIP_ERROR;
  }

  return (
    <ActionCard
      glyph="◉"
      label="Preview URL"
      shortcut="P"
      state={cardState}
      tooltip={tooltip}
      aria-label="Copy Preview URL — shortcut Alt+P"
      onActivate={copy.onActivate}
    />
  );
}
