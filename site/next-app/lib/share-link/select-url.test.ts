/**
 * T024a — RED tests for `getShareLinkUrl(state)`.
 *
 * Spec source: task-breakdown § 10 (T024a) + B-084..B-088 + § 4c-6 + ADR-0006
 * + ADR-0010 + US-005.
 *
 * The selector resolves Live → Preview fallback semantics for the Share Link
 * split-button. Returns `{ url, isPreviewFallback, isError }`:
 *  - `url=string`              → safe to copy
 *  - `isPreviewFallback=true`  → caller renders "Page not live — link points to preview" tooltip
 *  - `isError=true`            → caller renders the persistent-error tooltip
 *
 * The function does not yet exist — every test fails with "module not found"
 * until T024b lands.
 */

import { describe, expect, it } from "vitest";

import type { PageDerivedState } from "@/lib/cache/types";

import { getShareLinkUrl } from "./select-url";

const errorVal = (): { error: Error } => ({ error: new Error("boom") });

const baseState = (
  overrides: Partial<PageDerivedState> = {},
): PageDerivedState => ({
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
  ...overrides,
});

describe("getShareLinkUrl (T024)", () => {
  it("returns Live URL when liveUrl is a non-null string (Live wins)", () => {
    const result = getShareLinkUrl(
      baseState({ liveUrl: "https://live", previewUrl: "https://preview" }),
    );
    expect(result).toEqual({
      url: "https://live",
      isPreviewFallback: false,
      isError: false,
    });
  });

  it("falls back to Preview when liveUrl is null and previewUrl is a string (US-005)", () => {
    const result = getShareLinkUrl(
      baseState({ liveUrl: null, previewUrl: "https://preview" }),
    );
    expect(result).toEqual({
      url: "https://preview",
      isPreviewFallback: true,
      isError: false,
    });
  });

  it("returns null url when both liveUrl and previewUrl are null (loading)", () => {
    const result = getShareLinkUrl(
      baseState({ liveUrl: null, previewUrl: null }),
    );
    expect(result).toEqual({
      url: null,
      isPreviewFallback: false,
      isError: false,
    });
  });

  it("falls back to Preview even when liveUrl is irrelevant and previewUrl resolved (US-005 healthy fallback)", () => {
    // The cache `liveUrl` field is `string | null` only — never holds an
    // error directly. The error story for the Live composition lives in the
    // three underlying slots (publishing / liveHost / previewUrl). For this
    // selector we treat `liveUrl=null` + `previewUrl=string` as a healthy
    // preview fallback regardless of whether one of the upstream slots is
    // in error.
    const result = getShareLinkUrl(
      baseState({
        liveUrl: null,
        previewUrl: "https://preview",
        publishing: errorVal(),
      }),
    );
    expect(result).toEqual({
      url: "https://preview",
      isPreviewFallback: true,
      isError: false,
    });
  });

  it("returns isError when both Live AND Preview are unresolvable (Live=null, Preview={error})", () => {
    const result = getShareLinkUrl(
      baseState({
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: errorVal(),
        liveHost: errorVal(),
      }),
    );
    expect(result).toEqual({
      url: null,
      isPreviewFallback: false,
      isError: true,
    });
  });

  it("treats {error} previewUrl as still loading when liveUrl is null and other live slots haven't errored", () => {
    // liveUrl=null, previewUrl={error} but no upstream error → caller should
    // treat as still-loading, not as full error. This pins the chosen
    // semantics described in T024a scenario 6: Preview alone errored is not
    // a Share-Link-level failure if Live could still resolve.
    const result = getShareLinkUrl(
      baseState({
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: null,
        liveHost: null,
      }),
    );
    expect(result).toEqual({
      url: null,
      isPreviewFallback: false,
      isError: false,
    });
  });
});
