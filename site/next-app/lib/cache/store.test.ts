/**
 * T012a — RED tests for the in-memory cache store.
 *
 * Spec source: task-breakdown § 10 / B-023..B-025.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAll,
  getEntry,
  patchEntry,
  setEntry,
} from "./store";
import type { PageDerivedState } from "./types";

const FRESH: PageDerivedState = {
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
};

const RESOLVED: PageDerivedState = {
  previewUrl: "https://preview.example.com/foo",
  publishing: { isPublished: true },
  liveHost: "https://www.example.com",
  liveUrl: "https://www.example.com/foo",
};

describe("cache store (T012)", () => {
  beforeEach(() => {
    clearAll();
  });

  it("getEntry returns undefined for missing keys", () => {
    expect(getEntry("missing")).toBeUndefined();
  });

  it("setEntry then getEntry returns deep-equal state", () => {
    setEntry("k", RESOLVED);
    expect(getEntry("k")).toEqual(RESOLVED);
  });

  it("patchEntry merges into an existing slot, preserving other fields", () => {
    setEntry("k", FRESH);
    patchEntry("k", { previewUrl: "X" });
    const after = getEntry("k");
    expect(after?.previewUrl).toBe("X");
    expect(after?.publishing).toBeNull();
    expect(after?.liveHost).toBeNull();
    expect(after?.liveUrl).toBeNull();
  });

  it("patchEntry against a missing key creates a new partial slot (pinned behavior)", () => {
    patchEntry("ghost", { previewUrl: "Y" });
    const after = getEntry("ghost");
    expect(after?.previewUrl).toBe("Y");
  });

  it("clearAll empties all previously-set keys", () => {
    setEntry("a", RESOLVED);
    setEntry("b", FRESH);
    clearAll();
    expect(getEntry("a")).toBeUndefined();
    expect(getEntry("b")).toBeUndefined();
  });

  it("beforeEach reset isolates tests (sanity check)", () => {
    expect(getEntry("a")).toBeUndefined();
  });
});
