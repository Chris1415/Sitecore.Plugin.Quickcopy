/**
 * T024b — `getShareLinkUrl` — Live → Preview fallback selector.
 *
 * Source of truth: ADR-0006 + ADR-0010 + US-005 + § 4c-6.
 *
 * Returns the URL the Share Link should copy (Live preferred, Preview as
 * healthy fallback per US-005), plus two flags for the consumer:
 *  - `isPreviewFallback` → render the "Page not live — link points to preview" tooltip
 *  - `isError`           → both URLs unrecoverable; render the persistent-error tooltip
 *
 * Per QA's adjustment of the original "string | null" return shape: the
 * richer return shape avoids the consumer doing redundant cache-state
 * inspection (the caller does NOT need to peek at `publishing` / `liveHost`
 * to decide whether the result is a fallback or a hard error).
 *
 * Semantics — pinned by T024a:
 *  - `liveUrl=string`                                                   → live wins
 *  - `liveUrl=null`, `previewUrl=string`                                → preview fallback
 *  - `liveUrl=null`, `previewUrl=null`                                  → loading
 *  - `liveUrl=null`, `previewUrl={error}`, AND any other slot also {error} → hard error
 *  - `liveUrl=null`, `previewUrl={error}`, no other slot in error       → still loading (Live could still resolve)
 */

import type { PageDerivedState } from "@/lib/cache/types";

export interface ShareLinkUrlResult {
  url: string | null;
  isPreviewFallback: boolean;
  isError: boolean;
}

const isError = <T>(slot: T | null | { error: Error }): boolean =>
  slot !== null &&
  typeof slot === "object" &&
  slot !== undefined &&
  "error" in (slot as Record<string, unknown>);

export function getShareLinkUrl(state: PageDerivedState): ShareLinkUrlResult {
  // 1. Live wins.
  if (typeof state.liveUrl === "string" && state.liveUrl.length > 0) {
    return { url: state.liveUrl, isPreviewFallback: false, isError: false };
  }

  // 2. Preview fallback when liveUrl is null and previewUrl resolved.
  if (typeof state.previewUrl === "string" && state.previewUrl.length > 0) {
    return {
      url: state.previewUrl,
      isPreviewFallback: true,
      isError: false,
    };
  }

  // 3. Hard error: previewUrl is in error AND at least one of the live-side
  //    slots is also in error → there is nothing more to wait for.
  if (
    isError(state.previewUrl) &&
    (isError(state.publishing) || isError(state.liveHost))
  ) {
    return { url: null, isPreviewFallback: false, isError: true };
  }

  // 4. Still loading (or only previewUrl errored — Live could resolve).
  return { url: null, isPreviewFallback: false, isError: false };
}
