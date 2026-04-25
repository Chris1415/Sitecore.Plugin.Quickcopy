/**
 * T011a — RED tests for cache key + state types.
 *
 * Spec source: task-breakdown § 10 / B-020..B-022.
 */

import { describe, expect, it } from "vitest";

import {
  buildCacheKey,
  type CacheValue,
  type PageDerivedState,
} from "./types";

describe("buildCacheKey (T011)", () => {
  it("formats id+version with a colon", () => {
    expect(buildCacheKey("p1", 2)).toBe("p1:2");
  });

  it("uses 'noversion' when version is undefined", () => {
    expect(buildCacheKey("p1", undefined)).toBe("p1:noversion");
  });

  it("treats version 0 as a real version (NOT noversion)", () => {
    expect(buildCacheKey("p1", 0)).toBe("p1:0");
  });

  it("yields distinct keys for different ids with the same version", () => {
    expect(buildCacheKey("p1", 2)).not.toBe(buildCacheKey("p2", 2));
  });
});

describe("CacheValue<T> + PageDerivedState type shapes (T011)", () => {
  it("CacheValue<string> accepts string, null, and { error: Error }", () => {
    // Smoke checks at runtime (TS compile validates the union itself).
    const ok: CacheValue<string> = "hello";
    const pending: CacheValue<string> = null;
    const failed: CacheValue<string> = { error: new Error("nope") };

    expect(typeof ok).toBe("string");
    expect(pending).toBeNull();
    expect((failed as { error: Error }).error).toBeInstanceOf(Error);
  });

  it("PageDerivedState shape compiles with all four slots", () => {
    const state: PageDerivedState = {
      previewUrl: null,
      publishing: null,
      liveHost: null,
      liveUrl: null,
    };
    expect(state.previewUrl).toBeNull();
    expect(state.liveUrl).toBeNull();
  });
});
