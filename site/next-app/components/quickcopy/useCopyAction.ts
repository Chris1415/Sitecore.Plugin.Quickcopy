"use client";

/**
 * `useCopyAction` — shared click-handler primitive for the four action cards.
 *
 * Encapsulates:
 *  1. Calling `copyTextToClipboard(text)`.
 *  2. Flipping local UI state to `'copied'` for exactly 1500ms then reverting
 *     to `'idle'` (FR-008). Subsequent clicks within the morph window reset
 *     the timer (per B-062).
 *  3. On clipboard rejection: flipping to a persistent local-error state for
 *     the current cache key. Subsequent clicks are no-ops while the error
 *     sticks.
 *
 * The "current cache key" comes from the caller — typically derived from
 * `usePagesContext()` so navigation away clears the local error naturally.
 *
 * Per ADR-0009 there is no auto-retry, no backoff, no manual retry button.
 * The error remains until the cache key changes.
 *
 * Per task-breakdown § 4c-4 + ADR-0009, a SUCCESSFUL copy may also feed an
 * `aria-live` announcement (T034 in Phase 4) — for Phase 2 we expose an
 * `onAnnounce` no-op stub the caller can ignore. ERRORS are visual-only
 * (per ADR-0009 + QA's T034 correction) — no announcement.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { copyTextToClipboard } from "@/lib/clipboard";

const COPIED_MS = 1500;

export type CopyUiState = "idle" | "copied" | "error";

export interface UseCopyActionResult {
  /** UI state to feed `<ActionCard state={...} />`. */
  uiState: CopyUiState;
  /**
   * Click handler. No-op when local error is active (or `text` is null).
   */
  onActivate: () => void;
}

/**
 * @param text       value to copy on activation; `null` => button is "loading" upstream
 * @param cacheKey   current cache key for sticky-error scoping; null when not ready
 * @param onSuccess  optional success callback (e.g. announce to live region)
 */
export function useCopyAction(
  text: string | null,
  cacheKey: string | null,
  onSuccess?: () => void,
): UseCopyActionResult {
  const [ui, setUi] = useState<CopyUiState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorKeyRef = useRef<string | null>(null);

  // Reset local error if the cache key changes (per ADR-0009).
  useEffect(() => {
    if (errorKeyRef.current && errorKeyRef.current !== cacheKey) {
      errorKeyRef.current = null;
      setUi("idle");
    }
  }, [cacheKey]);

  // Cleanup any pending morph timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onActivate = useCallback(() => {
    if (errorKeyRef.current === cacheKey && cacheKey !== null) return;
    if (text === null) return;

    void (async () => {
      try {
        await copyTextToClipboard(text);
        setUi("copied");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setUi("idle");
          timerRef.current = null;
        }, COPIED_MS);
        onSuccess?.();
      } catch {
        // Persistent error per ADR-0009.
        errorKeyRef.current = cacheKey;
        setUi("error");
      }
    })();
  }, [text, cacheKey, onSuccess]);

  return { uiState: ui, onActivate };
}
