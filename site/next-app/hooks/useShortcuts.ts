"use client";

/**
 * One window-level `keydown` listener for the whole tree, matched on
 * `event.key` (never `event.code`). Every rule here is load-bearing —
 * see docs/build-decisions.md#shortcuts.
 */

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  SHORTCUTS,
  type ShortcutId,
} from "@/lib/shortcuts/config";

export type ShortcutHandlers = Record<ShortcutId, () => void>;

/**
 * Use the layout-effect variant on the client and fall back to a no-op on
 * the server so SSR doesn't try to invoke a layout hook. This keeps the
 * "store latest handlers in a ref before paint" pattern correct AND
 * SSR-safe.
 */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function isEditableTarget(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  // `el.isContentEditable` is the canonical browser API but jsdom does not
  // implement it consistently — fall back to the attribute check so the
  // editable-element guard works in tests AND production.
  if (el.isContentEditable) return true;
  const ce = el.getAttribute?.("contenteditable");
  if (ce !== null && ce !== "false") return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef<ShortcutHandlers>(handlers);

  // Update the ref BEFORE paint so the listener always sees the latest
  // handlers without re-attaching on every render.
  useIsoLayoutEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // Editable guard FIRST — before we look at modifiers, so that even a
      // collision-free `Alt+L` while typing in an input lets the editor see
      // the keystroke.
      if (isEditableTarget()) return;

      // Required modifiers: Alt only — no Ctrl, no Meta, no Shift.
      // ADR-0008 § 4 explicitly enumerates all four modifier flags. The
      // Shift guard is what makes `Shift+Alt+L` (and the rest of the family)
      // fall through to the surrounding accelerators / browser defaults
      // instead of triggering our copy actions.
      if (!event.altKey) return;
      if (event.ctrlKey) return;
      if (event.metaKey) return;
      if (event.shiftKey) return;

      const key = event.key.toLowerCase();
      const binding = SHORTCUTS.find((b) => b.keyLower === key);
      if (!binding) return;

      event.preventDefault();
      event.stopPropagation();
      const handler = handlersRef.current[binding.id];
      if (handler) handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
