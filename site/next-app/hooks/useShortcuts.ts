"use client";

/**
 * T030b — `useShortcuts` hook.
 *
 * Source of truth: ADR-0008 + § 4c-1 (iframe-scoped) + § 10 T030a.
 *
 * Design rules pinned by ADR-0008:
 *  - **Single** `keydown` listener at the `window` level. The component tree
 *    keeps using ONE shared listener — no per-card key handlers — because
 *    multiple listeners stomp each other on `event.preventDefault()` and
 *    duplicate the editable-element guard.
 *  - Match on `event.key.toLowerCase()` — never `event.code`. `event.code`
 *    is layout-dependent; `event.key` is the user's perceived character and
 *    matches what their muscle memory expects. The breakdown's case 14 pins
 *    this contract.
 *  - **Editable-element guard:** if `document.activeElement` is `<input>`,
 *    `<textarea>`, `<select>`, or has `contenteditable="true"`, the listener
 *    bails WITHOUT calling `preventDefault` — the keystroke must reach the
 *    editor unmodified.
 *  - **Modifier collision suppression:** require `event.altKey === true`,
 *    `event.ctrlKey === false`, `event.metaKey === false`. `Ctrl+Alt+L`,
 *    `Meta+Alt+L`, and Shift-anything are treated as not-our-combo.
 *  - On match: `event.preventDefault()` + `event.stopPropagation()` BEFORE
 *    invoking the handler. Stopping propagation prevents Pages-editor
 *    accelerators outside the iframe from also firing.
 *  - On unbound `Alt+X`: bail silently — do NOT preventDefault, so any
 *    surrounding accelerators still work.
 *  - The hook accepts a fresh `handlers` object on each render and stores it
 *    in a ref; the listener reads from the ref so we don't tear down and
 *    re-attach the listener on every parent re-render.
 *
 * `Alt+S` triggers the share handler — it does NOT open the dropdown
 * (per ADR-0010 + § 4c-1). The hook is intentionally agnostic of menu state.
 */

import { useEffect, useRef } from "react";

import {
  SHORTCUTS,
  type ShortcutId,
} from "@/lib/shortcuts/config";

export type ShortcutHandlers = Record<ShortcutId, () => void>;

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
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // Editable guard FIRST — before we look at modifiers, so that even a
      // collision-free `Alt+L` while typing in an input lets the editor see
      // the keystroke.
      if (isEditableTarget()) return;

      // Required modifiers: Alt only — no Ctrl, no Meta.
      if (!event.altKey) return;
      if (event.ctrlKey) return;
      if (event.metaKey) return;

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
