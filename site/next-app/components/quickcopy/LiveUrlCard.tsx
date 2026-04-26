"use client";

/**
 * T018b — `<LiveUrlCard>` — Live URL action card.
 *
 * Source of truth: task-breakdown § 4c-6 + § 10 (T018) + ADR-0006 + ADR-0009 +
 * § 4c-8 (verbatim tooltip strings).
 *
 * Reads the cache slot for the current `pages.context` page and renders the
 * appropriate `<ActionCard>` state:
 *  - all slots null              → disabled + "Loading…" tooltip
 *  - any of `publishing` / `liveHost` is `{error}` → persistent error
 *    (`previewUrl` is intentionally NOT a Live URL dependency — per ADR-0006
 *    each slot is independent, so a Preview URL fetch failure must not
 *    cascade into the Live URL card. Only the live composition inputs
 *    `publishing` and `liveHost` count.)
 *  - `publishing.isPublished===false`  → disabled + "Not published…" tooltip
 *  - `liveUrl` is a string                → idle, click copies it
 *
 * On clipboard rejection: persistent local error per ADR-0009 (cleared only
 * when cache key changes).
 */

import { useCallback } from "react";

import { ActionCard, type ActionCardState } from "./ActionCard";
import { useCacheEntry } from "@/lib/cache/useCacheEntry";
import { useCopyAction } from "./useCopyAction";
import { useStatusAnnouncer } from "./StatusLiveRegion";
import { STRINGS } from "@/lib/i18n/strings";

const TOOLTIP_LOADING = "Loading…";
const TOOLTIP_UNPUBLISHED =
  "Not published to Edge yet — publish the page first.";
const TOOLTIP_ERROR =
  "Couldn't fetch Live URL — try switching pages or reloading.";

const isError = (slot: unknown): boolean =>
  slot !== null &&
  typeof slot === "object" &&
  slot !== undefined &&
  "error" in (slot as Record<string, unknown>);

export function LiveUrlCard() {
  const { key, state } = useCacheEntry();
  const liveUrl = typeof state?.liveUrl === "string" ? state.liveUrl : null;
  const { announce } = useStatusAnnouncer();
  const onSuccess = useCallback(
    () => announce(STRINGS.announcements.liveUrlCopied),
    [announce],
  );
  const copy = useCopyAction(liveUrl, key, onSuccess);

  let cardState: ActionCardState = "idle";
  let tooltip: string | undefined;

  if (!state) {
    cardState = "disabled";
    tooltip = TOOLTIP_LOADING;
  } else if (isError(state.publishing) || isError(state.liveHost)) {
    // Live URL composition depends only on `publishing` + `liveHost` per
    // ADR-0006. A `previewUrl` error must NOT cascade — each slot is
    // independent. (Polish micro-run: removed `previewUrl` from this branch.)
    cardState = "error";
    tooltip = TOOLTIP_ERROR;
  } else if (
    state.publishing &&
    typeof state.publishing === "object" &&
    "isPublished" in state.publishing &&
    state.publishing.isPublished === false
  ) {
    cardState = "disabled";
    tooltip = TOOLTIP_UNPUBLISHED;
  } else if (typeof state.liveUrl === "string") {
    cardState = copy.uiState === "error" ? "error" : copy.uiState;
    if (copy.uiState === "error") tooltip = TOOLTIP_ERROR;
  } else {
    // All slots loading or partially resolved without a final liveUrl yet.
    cardState = "disabled";
    tooltip = TOOLTIP_LOADING;
  }

  return (
    <ActionCard
      glyph="↗"
      label="Live URL"
      shortcut="L"
      state={cardState}
      tooltip={tooltip}
      aria-label="Copy Live URL — shortcut Alt+L"
      onActivate={copy.onActivate}
    />
  );
}
