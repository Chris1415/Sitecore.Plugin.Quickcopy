"use client";

/**
 * T034b — `<StatusLiveRegion>` + `useStatusAnnouncer`.
 *
 * Source of truth: § 4c-8 (announcement strings), § 10 T034, ADR-0009 (errors
 * are visual-only — no aria-live announcement on failure paths), UI § 6.
 *
 * Surface:
 *  - `<StatusLiveRegion />` — single `role="status"` `aria-live="polite"`
 *    region mounted at the panel root. Visually hidden via `sr-only`.
 *  - `useStatusAnnouncer()` — returns `{ announce(label: string) }`. Calling
 *    `announce` updates the region text and schedules a 1500ms reset to "".
 *    Repeated calls reset the timer (the latest message holds for 1500ms
 *    from its own announcement).
 *
 * Coupling: a small module-level pub/sub. The region subscribes on mount;
 * `useStatusAnnouncer` publishes on every `announce`. There is exactly ONE
 * region per panel — Phase 4 wires it once at `app/panel/page.tsx`.
 *
 * SUCCESS-only contract per ADR-0009:
 *  - Error code paths in `useCopyAction` and `ShareLinkSplit` deliberately do
 *    NOT call `announce`. The visible error state IS the error surface.
 *  - The T033 regression audit asserts `aria-live` appears only inside this
 *    file — DO NOT add `aria-live` to other components for any reason.
 */

import { useCallback, useEffect, useState } from "react";

const RESET_MS = 1500;

type Listener = (text: string) => void;

const listeners = new Set<Listener>();

function publish(text: string): void {
  for (const l of listeners) l(text);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The visually-hidden polite live region. Mount exactly one per panel.
 */
export function StatusLiveRegion() {
  const [text, setText] = useState("");

  useEffect(() => {
    return subscribe((next) => setText(next));
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-quickcopy="status-live-region"
    >
      {text}
    </div>
  );
}

export interface StatusAnnouncer {
  announce: (label: string) => void;
}

/**
 * Hook returning a stable `announce(label)` function. SUCCESS messages only —
 * see file header. Each call publishes the new text and schedules a 1500ms
 * reset; calling again before the reset cancels the previous timer cleanly.
 */
export function useStatusAnnouncer(): StatusAnnouncer {
  // Module-scoped timer is correct here: there is exactly one announcer
  // surface per panel (the singleton region) and we want the timer behavior
  // to be relative to the *latest* announcement regardless of which call
  // site fired it. We avoid per-hook state to keep `announce` referentially
  // stable for memoized consumers (`useCopyAction`'s `onSuccess`).
  const announce = useCallback((label: string) => {
    publish(label);
    if (currentTimer !== null) clearTimeout(currentTimer);
    currentTimer = setTimeout(() => {
      publish("");
      currentTimer = null;
    }, RESET_MS);
  }, []);

  return { announce };
}

let currentTimer: ReturnType<typeof setTimeout> | null = null;
