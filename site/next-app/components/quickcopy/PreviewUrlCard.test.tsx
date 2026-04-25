/**
 * T019a — RED tests for `<PreviewUrlCard>`.
 *
 * Spec source: task-breakdown § 10 (T019a) + B-063..B-064 + § 4c-8 + FR-003.
 *
 * Cache slot READ must be `previewUrl`, NOT `pageInfo.url` — this is the
 * authoritative Agent-API field per FR-003.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageDerivedState } from "@/lib/cache/types";

const clipboardMock = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(async (_t: string) => undefined),
}));
vi.mock("@/lib/clipboard", () => clipboardMock);

const cacheMock = vi.hoisted(() => ({
  useCacheEntry: vi.fn(),
}));
vi.mock("@/lib/cache/useCacheEntry", () => cacheMock);

import { PreviewUrlCard } from "./PreviewUrlCard";

const errorVal = (): { error: Error } => ({ error: new Error("boom") });

const cacheState = (
  overrides: Partial<PageDerivedState> = {},
  key = "page-1:noversion",
) => {
  cacheMock.useCacheEntry.mockReturnValue({
    key,
    state: {
      previewUrl: null,
      publishing: null,
      liveHost: null,
      liveUrl: null,
      ...overrides,
    },
  });
};

beforeEach(() => {
  clipboardMock.copyTextToClipboard.mockReset();
  clipboardMock.copyTextToClipboard.mockResolvedValue(undefined);
  cacheMock.useCacheEntry.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<PreviewUrlCard /> (T019)", () => {
  it("renders idle and copies the previewUrl on click (NOT pageInfo.url)", async () => {
    cacheState({ previewUrl: "https://preview.example.com/foo" });
    render(<PreviewUrlCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "https://preview.example.com/foo",
    );
  });

  it("renders persistent error tooltip when previewUrl is in error", () => {
    cacheState({ previewUrl: errorVal() });
    render(<PreviewUrlCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe(
      "Couldn't fetch Preview URL — try switching pages or reloading.",
    );
  });

  it("renders disabled with Loading… tooltip when previewUrl is null", () => {
    cacheState({ previewUrl: null });
    render(<PreviewUrlCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toContain("Loading");
  });

  it("flips to persistent error on clipboard rejection", async () => {
    clipboardMock.copyTextToClipboard.mockRejectedValueOnce(
      new Error("NotAllowed"),
    );
    cacheState({ previewUrl: "https://preview.example.com/foo" });
    render(<PreviewUrlCard />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });

  it("morphs to 'Copied' on success and reverts after 1500ms", async () => {
    vi.useFakeTimers();
    cacheState({ previewUrl: "https://preview.example.com/foo" });
    render(<PreviewUrlCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Copied/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText(/Copied/)).toBeNull();
    expect(screen.getByText(/Preview URL/)).toBeInTheDocument();
  });
});
