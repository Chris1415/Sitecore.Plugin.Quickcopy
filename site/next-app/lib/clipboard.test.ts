/**
 * T016a — RED tests for the clipboard module.
 *
 * Spec source: task-breakdown § 10 / B-040..B-044.
 *
 * The module does not yet exist — every test fails with "module not found"
 * until T016b lands the local copy of pageshot's clipboard pattern adapted
 * for `string` payloads (text-only, ADR-0004).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "./clipboard";

const ORIGINAL_NAVIGATOR = globalThis.navigator;

function installClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText } },
    configurable: true,
    writable: true,
  });
}

function removeClipboard() {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: undefined },
    configurable: true,
    writable: true,
  });
}

function removeNavigator() {
  Object.defineProperty(globalThis, "navigator", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  // restore default jsdom navigator for each test
  Object.defineProperty(globalThis, "navigator", {
    value: ORIGINAL_NAVIGATOR,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: ORIGINAL_NAVIGATOR,
    configurable: true,
    writable: true,
  });
});

describe("copyTextToClipboard (T016)", () => {
  it("writes the exact string via navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);

    await copyTextToClipboard("hello");

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("propagates rejection (DOMException NotAllowedError)", async () => {
    const err = new Error("NotAllowedError");
    const writeText = vi.fn().mockRejectedValue(err);
    installClipboard(writeText);

    await expect(copyTextToClipboard("x")).rejects.toBe(err);
  });

  it("throws Error('clipboard-unavailable') when navigator.clipboard.writeText is undefined", async () => {
    removeClipboard();
    await expect(copyTextToClipboard("x")).rejects.toThrow(
      /clipboard-unavailable/,
    );
  });

  it("resolves for empty string", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);

    await expect(copyTextToClipboard("")).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith("");
  });

  it("resolves for very large strings (>100k chars)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const big = "a".repeat(200_000);

    await copyTextToClipboard(big);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect((writeText.mock.calls[0]?.[0] as string).length).toBe(200_000);
  });

  it("throws when navigator itself is undefined (server-side)", async () => {
    removeNavigator();
    await expect(copyTextToClipboard("x")).rejects.toThrow(
      /clipboard-unavailable/,
    );
  });
});
