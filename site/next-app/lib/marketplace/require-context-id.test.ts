/**
 * T010a — RED tests for `requireContextId`.
 *
 * Spec source: task-breakdown § 10 / B-014..B-018.
 *
 * The helper does not yet exist — every case fails with "module not found"
 * (the canonical RED reason).
 */

import { describe, expect, it } from "vitest";

import { requireContextId } from "./require-context-id";

describe("requireContextId (T010)", () => {
  it("throws on null with a useful message", () => {
    expect(() => requireContextId(null)).toThrow(/context/i);
  });

  it("returns live when present", () => {
    const ctx = {
      resourceAccess: [{ context: { live: "L1" } }],
    } as unknown as Parameters<typeof requireContextId>[0];
    expect(requireContextId(ctx)).toBe("L1");
  });

  it("falls back to preview when live is missing", () => {
    const ctx = {
      resourceAccess: [{ context: { preview: "P1" } }],
    } as unknown as Parameters<typeof requireContextId>[0];
    expect(requireContextId(ctx)).toBe("P1");
  });

  it("prefers live when both live and preview are present", () => {
    const ctx = {
      resourceAccess: [{ context: { live: "L1", preview: "P1" } }],
    } as unknown as Parameters<typeof requireContextId>[0];
    expect(requireContextId(ctx)).toBe("L1");
  });

  it("throws when both live and preview are missing", () => {
    const ctx = {
      resourceAccess: [{ context: {} }],
    } as unknown as Parameters<typeof requireContextId>[0];
    expect(() => requireContextId(ctx)).toThrow();
  });

  it("throws when resourceAccess is empty", () => {
    const ctx = { resourceAccess: [] } as unknown as Parameters<
      typeof requireContextId
    >[0];
    expect(() => requireContextId(ctx)).toThrow();
  });
});
