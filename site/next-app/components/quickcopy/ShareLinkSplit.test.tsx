/**
 * T025a — RED tests for `<ShareLinkSplit>`.
 *
 * Spec source: task-breakdown § 10 (T025a) + B-089..B-099 + ADR-0010 + FR-005
 * + § 4c-8 (verbatim tooltip strings) + § 4c-6 (Share Link format strings).
 *
 * The component composes a primary "Share Link" button (Markdown copy) and
 * a caret button (dropdown with two format menu items) into a single
 * `role="group"` zone. Disabled / error states sync across both zones.
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

const sdkClientMock = vi.hoisted(() => ({
  query: vi.fn(),
}));

const providerMock = vi.hoisted(() => ({
  usePagesContext: vi.fn(),
  useMarketplaceClient: vi.fn(() => sdkClientMock),
  useAppContext: vi.fn(() => ({})),
}));
vi.mock("@/components/providers/marketplace", () => providerMock);

import { ShareLinkSplit } from "./ShareLinkSplit";

const errorVal = (): { error: Error } => ({ error: new Error("boom") });

function setup(args: {
  pageTitle?: string;
  cacheState?: Partial<PageDerivedState>;
}) {
  providerMock.usePagesContext.mockReturnValue({
    pageInfo: { displayName: args.pageTitle ?? "Title" },
  });
  cacheMock.useCacheEntry.mockReturnValue({
    key: "page-1:noversion",
    state: {
      previewUrl: null,
      publishing: null,
      liveHost: null,
      liveUrl: null,
      ...(args.cacheState ?? {}),
    },
  });
}

beforeEach(() => {
  clipboardMock.copyTextToClipboard.mockReset();
  clipboardMock.copyTextToClipboard.mockResolvedValue(undefined);
  cacheMock.useCacheEntry.mockReset();
  providerMock.usePagesContext.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<ShareLinkSplit /> (T025)", () => {
  it("renders a role=group container with aria-label='Share link'", () => {
    setup({
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const group = screen.getByRole("group", { name: "Share link" });
    expect(group).toBeInTheDocument();
  });

  it("primary click copies the Markdown shape `[Title](URL)`", async () => {
    setup({
      pageTitle: "Title",
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const primary = screen.getByRole("button", {
      name: /Copy Share Link as Markdown/,
    });
    fireEvent.click(primary);
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "[Title](https://live)",
    );
  });

  it("caret button has aria-haspopup='menu' and aria-expanded='false' initially", () => {
    setup({
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    expect(caret).toHaveAttribute("aria-haspopup", "menu");
    expect(caret).toHaveAttribute("aria-expanded", "false");
  });

  it("opening the menu flips aria-expanded to true and moves focus to first menu item", async () => {
    setup({
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    await act(async () => {
      fireEvent.click(caret);
      // allow state update + post-open focus tick
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(caret).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(document.activeElement).toBe(items[0]);
  });

  it("Escape closes the menu and returns focus to caret", async () => {
    setup({
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    await act(async () => {
      fireEvent.click(caret);
      await Promise.resolve();
      await Promise.resolve();
    });
    const menu = screen.getByRole("menu");
    await act(async () => {
      fireEvent.keyDown(menu, { key: "Escape" });
      await Promise.resolve();
    });
    expect(caret).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(caret);
  });

  it("Copy as Plain text menu item copies plain-text shape with em-dash", async () => {
    setup({
      pageTitle: "Title",
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    await act(async () => {
      fireEvent.click(caret);
      await Promise.resolve();
      await Promise.resolve();
    });
    const plain = screen.getByRole("menuitem", { name: /Plain text/ });
    fireEvent.click(plain);
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "Title \u2014 https://live",
    );
  });

  it("Copy as Markdown menu item copies markdown shape", async () => {
    setup({
      pageTitle: "Title",
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    await act(async () => {
      fireEvent.click(caret);
      await Promise.resolve();
      await Promise.resolve();
    });
    const md = screen.getByRole("menuitem", { name: /Markdown/ });
    fireEvent.click(md);
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).toHaveBeenCalledWith(
      "[Title](https://live)",
    );
  });

  it("renders exactly two menu items with role=menuitem", async () => {
    setup({
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    await act(async () => {
      fireEvent.click(caret);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("renders the unpublished tooltip when liveUrl is null but previewUrl is healthy", () => {
    setup({
      cacheState: {
        liveUrl: null,
        publishing: { isPublished: false },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    const describedBy = primary.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe("Page not live — link points to preview");
  });

  it("disables both primary and caret with aria-disabled=true when both URLs error", () => {
    setup({
      cacheState: {
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: errorVal(),
        liveHost: errorVal(),
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    expect(primary).toHaveAttribute("aria-disabled", "true");
    expect(caret).toHaveAttribute("aria-disabled", "true");
  });

  it("renders 'Failed' as the visible primary label when both URLs error (never an empty bar)", () => {
    setup({
      cacheState: {
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: errorVal(),
        liveHost: errorVal(),
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    expect(primary.textContent ?? "").toMatch(/Failed/);
    // Shortcut chip "S" stays visible across every state so the strip is
    // never an empty coloured block.
    expect(primary.textContent ?? "").toMatch(/S/);
  });

  it("renders the persistent error tooltip on the primary when both URLs error", () => {
    setup({
      cacheState: {
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: errorVal(),
        liveHost: errorVal(),
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    const describedBy = primary.getAttribute("aria-describedby");
    const tip = document.getElementById(describedBy as string);
    expect(tip?.textContent).toBe(
      "Couldn't compose Share Link — try switching pages or reloading.",
    );
  });

  it("disabled split-button is a no-op for clicks (clipboard not invoked, menu does not open)", async () => {
    setup({
      cacheState: {
        liveUrl: null,
        previewUrl: errorVal(),
        publishing: errorVal(),
        liveHost: errorVal(),
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    const caret = screen.getByRole("button", {
      name: /Choose share-link format/,
    });
    fireEvent.click(primary);
    fireEvent.click(caret);
    await Promise.resolve();
    expect(clipboardMock.copyTextToClipboard).not.toHaveBeenCalled();
    expect(caret).toHaveAttribute("aria-expanded", "false");
  });

  it("morphs to 'Copied' on primary click success and reverts after 1500ms", async () => {
    vi.useFakeTimers();
    setup({
      pageTitle: "Title",
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector('[data-quickcopy="share-link-primary"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(primary);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Copied/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText(/Copied/)).toBeNull();
  });

  it("primary aria-label is stable across the 'Copied' morph window (Alt+S keeps working)", async () => {
    // Regression: prior to the code-review fix the primary's aria-label
    // flipped to "Copied" during the 1500ms hold. The panel-level Alt+S
    // shortcut dispatches a synthetic click via aria-label substring match
    // ("shortcut Alt+S"), so a flipped label silently broke Alt+S during
    // the morph window. Pin the aria-label as state-invariant.
    vi.useFakeTimers();
    setup({
      pageTitle: "Title",
      cacheState: {
        liveUrl: "https://live",
        publishing: { isPublished: true },
        liveHost: "https://live",
        previewUrl: "https://preview",
      },
    });
    render(<ShareLinkSplit />);
    const primary = document.querySelector(
      '[data-quickcopy="share-link-primary"]',
    ) as HTMLButtonElement;
    const idleAriaLabel = primary.getAttribute("aria-label");
    expect(idleAriaLabel).toMatch(/shortcut Alt\+S/);

    await act(async () => {
      fireEvent.click(primary);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Visible label flipped to "Copied"…
    expect(screen.getByText(/Copied/)).toBeInTheDocument();
    // …but aria-label stayed identical so Alt+S can still find the button.
    expect(primary.getAttribute("aria-label")).toBe(idleAriaLabel);
  });
});
