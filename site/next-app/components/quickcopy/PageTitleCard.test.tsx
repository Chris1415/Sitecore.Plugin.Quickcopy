/**
 * T021a — RED tests for `<PageTitleCard>`.
 *
 * Spec source: task-breakdown § 10 (T021a) + B-068..B-070 + § 4c-8 + FR-004.
 *
 * Reads `displayName ?? name` per FR-004. Whitespace-only displayName is
 * treated as missing (falls back to name). NO SDK call.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboardMock = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn<(t: string) => Promise<void>>().mockResolvedValue(undefined),
}));
vi.mock("@/lib/clipboard", () => clipboardMock);

const sdkClientMock = vi.hoisted(() => ({
  query: vi.fn(),
}));

const providerMock = vi.hoisted(() => ({
  usePagesContext: vi.fn(),
  useMarketplaceClient: vi.fn(() => sdkClientMock),
  useAppContext: vi.fn(() => ({})),
}));
vi.mock("@/components/providers/marketplace", () => providerMock);

import { PageTitleCard } from "./PageTitleCard";

const setPageInfo = (pageInfo: Record<string, unknown> | undefined) => {
  providerMock.usePagesContext.mockReturnValue({ pageInfo });
};

beforeEach(() => {
  clipboardMock.copyTextToClipboard.mockReset();
  clipboardMock.copyTextToClipboard.mockResolvedValue(undefined);
  providerMock.usePagesContext.mockReset();
  sdkClientMock.query.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<PageTitleCard /> (T021)", () => {
  it("copies displayName when present", async () => {
    setPageInfo({ displayName: "Spring Campaign", name: "spring" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "Spring Campaign",
    );
  });

  it("falls back to name when displayName is undefined", async () => {
    setPageInfo({ displayName: undefined, name: "spring-campaign" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "spring-campaign",
    );
  });

  it("falls back to name when displayName is empty string", async () => {
    setPageInfo({ displayName: "", name: "spring" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith("spring");
  });

  it("falls back to name when displayName is whitespace-only", async () => {
    setPageInfo({ displayName: "   ", name: "spring" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith("spring");
  });

  it("renders disabled with not-ready tooltip when both displayName and name are missing", () => {
    setPageInfo({ displayName: "", name: "" });
    render(<PageTitleCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe("Page context not ready — wait or reload.");
  });

  it("does NOT invoke the SDK client", () => {
    setPageInfo({ displayName: "Foo", name: "foo" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(sdkClientMock.query).not.toHaveBeenCalled();
  });

  it("flips to persistent error when clipboard rejects", async () => {
    clipboardMock.copyTextToClipboard.mockRejectedValueOnce(new Error("nope"));
    setPageInfo({ displayName: "Foo" });
    render(<PageTitleCard />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });
});
