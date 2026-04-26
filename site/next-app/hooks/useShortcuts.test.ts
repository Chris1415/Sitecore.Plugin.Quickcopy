/**
 * T030a — RED tests for `useShortcuts` hook.
 *
 * Pinned by § 10 T030a + ADR-0008 + § 4c-1 (iframe-scoped, single keydown
 * handler, editable-element guard).
 *
 * Cases:
 *  1-5   Each `Alt+L/P/I/T/S` fires its handler exactly once.
 *  6-9   Suppression while focus is inside <input>, <textarea>, <select>,
 *        or `[contenteditable="true"]`.
 *  10    Recognized combo dispatches `preventDefault()` AND `stopPropagation()`.
 *  11    `Ctrl+Alt+L` does NOT fire (we require ctrlKey === false).
 *  12    `Meta+Alt+L` does NOT fire.
 *  13    `Alt+X` is unbound — no handler, no preventDefault.
 *  14    `Alt+L` with `key: 'L'` (uppercase) fires (we lowercase per ADR-0008).
 *  15    Hook unmount removes the listener.
 *  16    Re-mount re-registers the listener.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShortcuts, type ShortcutHandlers } from "./useShortcuts";

function makeHandlers(): ShortcutHandlers {
  return {
    live: vi.fn(),
    preview: vi.fn(),
    item: vi.fn(),
    title: vi.fn(),
    share: vi.fn(),
  };
}

function dispatchKey(init: KeyboardEventInit & { key: string }): void {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
}

function clearBody() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

beforeEach(() => {
  clearBody();
});

afterEach(() => {
  clearBody();
  vi.restoreAllMocks();
});

describe("useShortcuts", () => {
  it("Alt+L fires the live handler exactly once", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "l", altKey: true });
    expect(handlers.live).toHaveBeenCalledTimes(1);
    expect(handlers.preview).not.toHaveBeenCalled();
  });

  it("Alt+P fires preview", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "p", altKey: true });
    expect(handlers.preview).toHaveBeenCalledTimes(1);
  });

  it("Alt+I fires item", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "i", altKey: true });
    expect(handlers.item).toHaveBeenCalledTimes(1);
  });

  it("Alt+T fires title", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "t", altKey: true });
    expect(handlers.title).toHaveBeenCalledTimes(1);
  });

  it("Alt+S fires share — does NOT open a dropdown (handler-only contract)", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "s", altKey: true });
    expect(handlers.share).toHaveBeenCalledTimes(1);
    // Per ADR-0010 + § 4c-1: Alt+S triggers the Markdown default — never the
    // menu. The hook only knows about the share handler; it does NOT touch
    // any menu state. (Menu-open behavior is owned by ShareLinkSplit.)
  });

  it.each([
    ["INPUT", () => document.createElement("input")],
    ["TEXTAREA", () => document.createElement("textarea")],
    ["SELECT", () => document.createElement("select")],
  ])("Alt+L while %s has focus → no handler called", (_label, factory) => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    const el = factory();
    document.body.appendChild(el);
    el.focus();
    dispatchKey({ key: "l", altKey: true });
    expect(handlers.live).not.toHaveBeenCalled();
  });

  it("Alt+L while [contenteditable=true] has focus → no handler called", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    el.tabIndex = 0;
    document.body.appendChild(el);
    el.focus();
    dispatchKey({ key: "l", altKey: true });
    expect(handlers.live).not.toHaveBeenCalled();
  });

  it("recognized combo calls preventDefault AND stopPropagation", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    const event = new KeyboardEvent("keydown", {
      key: "l",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const pd = vi.spyOn(event, "preventDefault");
    const sp = vi.spyOn(event, "stopPropagation");
    window.dispatchEvent(event);
    expect(pd).toHaveBeenCalled();
    expect(sp).toHaveBeenCalled();
  });

  it("Ctrl+Alt+L does NOT fire", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "l", altKey: true, ctrlKey: true });
    expect(handlers.live).not.toHaveBeenCalled();
  });

  it("Meta+Alt+L does NOT fire", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "l", altKey: true, metaKey: true });
    expect(handlers.live).not.toHaveBeenCalled();
  });

  it("Alt+X does nothing AND does NOT preventDefault", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    const event = new KeyboardEvent("keydown", {
      key: "x",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const pd = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);
    Object.values(handlers).forEach((h) => expect(h).not.toHaveBeenCalled());
    expect(pd).not.toHaveBeenCalled();
  });

  it("Alt+L with uppercase key fires (case-insensitive match per ADR-0008)", () => {
    const handlers = makeHandlers();
    renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "L", altKey: true });
    expect(handlers.live).toHaveBeenCalledTimes(1);
  });

  it("unmount removes the listener", () => {
    const handlers = makeHandlers();
    const { unmount } = renderHook(() => useShortcuts(handlers));
    unmount();
    dispatchKey({ key: "l", altKey: true });
    expect(handlers.live).not.toHaveBeenCalled();
  });

  it("re-mount re-registers the listener", () => {
    const handlers = makeHandlers();
    const first = renderHook(() => useShortcuts(handlers));
    first.unmount();
    const second = renderHook(() => useShortcuts(handlers));
    dispatchKey({ key: "l", altKey: true });
    expect(handlers.live).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
