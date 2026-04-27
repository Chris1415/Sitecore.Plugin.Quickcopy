/**
 * T018a — RED tests for `<LiveUrlCard>`.
 *
 * Spec source: task-breakdown § 10 (T018a) + B-057..B-062 + § 4c-8.
 *
 * Stubs `useCacheEntry`, `usePagesContext`, and `copyTextToClipboard` to
 * exercise the cache-state branches without touching the SDK or real
 * clipboard. The component file does not yet exist — every test fails with
 * "module not found" until T018b lands.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageDerivedState } from "@/lib/cache/types";

const clipboardMock = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined),
}));
vi.mock("@/lib/clipboard", () => clipboardMock);

const cacheMock = vi.hoisted(() => ({
  useCacheEntry: vi.fn(),
}));
vi.mock("@/lib/cache/useCacheEntry", () => cacheMock);

import { LiveUrlCard } from "./LiveUrlCard";

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

describe("<LiveUrlCard /> (T018)", () => {
  it("renders idle and copies the live URL on click", async () => {
    cacheState({
      liveUrl: "https://www.example.com/products/spring",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      previewUrl: "https://preview.example.com/spring",
    });
    render(<LiveUrlCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "https://www.example.com/products/spring",
    );
  });

  it("renders aria-disabled with the unpublished tooltip when publishing.isPublished is false", () => {
    cacheState({
      publishing: { isPublished: false },
      liveHost: "https://www.example.com",
      previewUrl: "https://preview.example.com/spring",
      liveUrl: null,
    });
    render(<LiveUrlCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe(
      "Not published to Edge yet — publish the page first.",
    );
  });

  it("does NOT call clipboard when click while publishing.isPublished is false", () => {
    cacheState({
      publishing: { isPublished: false },
      liveHost: "https://x",
      previewUrl: "https://y",
      liveUrl: null,
    });
    render(<LiveUrlCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(clipboardMock.copyTextToClipboard).not.toHaveBeenCalled();
  });

  it.each([
    ["publishing", { publishing: errorVal() }],
    ["liveHost", { liveHost: errorVal() }],
  ])(
    "renders persistent error tooltip when %s is in error",
    (_label, slot) => {
      cacheState({ ...(slot as Partial<PageDerivedState>), liveUrl: null });
      render(<LiveUrlCard />);
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute("aria-disabled", "true");
      const describedBy = btn.getAttribute("aria-describedby");
      const tip = document.getElementById(describedBy as string);
      expect(tip?.textContent).toBe(
        "Couldn't fetch Live URL — try switching pages or reloading.",
      );
    },
  );

  it("does NOT enter error state when previewUrl alone is in error (slots are independent per ADR-0006)", () => {
    // Polish micro-run regression: a Preview URL fetch failure must not
    // cascade into the Live URL card. Live URL composition depends only on
    // `publishing` + `liveHost`. With both healthy and `liveUrl` resolved,
    // the card stays interactive even if `previewUrl` errored.
    cacheState({
      previewUrl: errorVal(),
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/products/spring",
    });
    render(<LiveUrlCard />);
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveAttribute("aria-disabled", "true");
  });

  it("renders disabled with Loading… tooltip when all slots are null", () => {
    cacheState({});
    render(<LiveUrlCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toContain("Loading");
  });

  it("flips to persistent error when copyTextToClipboard rejects, and subsequent clicks are no-ops", async () => {
    clipboardMock.copyTextToClipboard.mockRejectedValueOnce(
      new Error("NotAllowed"),
    );
    cacheState({
      liveUrl: "https://www.example.com/products/spring",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      previewUrl: "https://preview.example.com/spring",
    });
    render(<LiveUrlCard />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    // Second click: clipboard NOT called again.
    fireEvent.click(btn);
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledTimes(1);
  });

  it("shows visible 'Copied' after successful copy and reverts after 1500ms", async () => {
    vi.useFakeTimers();
    cacheState({
      liveUrl: "https://x",
      publishing: { isPublished: true },
      liveHost: "https://x",
      previewUrl: "https://y",
    });
    render(<LiveUrlCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      // flush the awaited copyText promise
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Copied/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText(/Copied/)).toBeNull();
    expect(screen.getByText(/Live URL/)).toBeInTheDocument();
  });
});
