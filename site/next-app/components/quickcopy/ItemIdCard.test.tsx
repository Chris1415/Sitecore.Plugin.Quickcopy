/**
 * T020a — RED tests for `<ItemIdCard>`.
 *
 * Spec source: task-breakdown § 10 (T020a) + B-065..B-067 + § 4c-8 (Item ID
 * brace handling).
 *
 * The Item ID card reads `pageInfo.id` directly from the Provider — there is
 * NO SDK call (assert `mockClient.query` never invoked). Brace stripping +
 * whitespace trim per § 4c-8.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboardMock = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(async (_t: string) => undefined),
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

import { ItemIdCard } from "./ItemIdCard";

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

describe("<ItemIdCard /> (T020)", () => {
  it("copies the raw id when click and id is a clean GUID", async () => {
    setPageInfo({ id: "abc-123-DEF" });
    render(<ItemIdCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "abc-123-DEF",
    );
  });

  it("strips wrapping braces from the id (per § 4c-8)", async () => {
    setPageInfo({ id: "{ABC-123-DEF}" });
    render(<ItemIdCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "ABC-123-DEF",
    );
  });

  it("trims surrounding whitespace from the id (per § 4c-8)", async () => {
    setPageInfo({ id: "  abc-123  " });
    render(<ItemIdCard />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith("abc-123");
  });

  it("renders disabled with the not-ready tooltip when pageInfo.id is undefined", () => {
    setPageInfo({});
    render(<ItemIdCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    const describedBy = btn.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe("Page context not ready — wait or reload.");
  });

  it("renders disabled with the not-ready tooltip when pageInfo.id is empty string", () => {
    setPageInfo({ id: "" });
    render(<ItemIdCard />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("does NOT invoke the SDK client at all", () => {
    setPageInfo({ id: "abc-123" });
    render(<ItemIdCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(sdkClientMock.query).not.toHaveBeenCalled();
  });

  it("flips to persistent error when clipboard rejects", async () => {
    clipboardMock.copyTextToClipboard.mockRejectedValueOnce(new Error("nope"));
    setPageInfo({ id: "abc-123" });
    render(<ItemIdCard />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });
});
