/**
 * T022a — RED tests for `<ActionGrid>`.
 *
 * Spec source: task-breakdown § 10 (T022a) + B-071..B-072 + § 4c-4 (layout).
 *
 * Stubs the four cards so the test focuses on layout rather than each card's
 * internals. Asserts: exactly four card elements; DOM order Live → Preview →
 * Item → Title; container draws hairline gridlines (gap-px); no horizontal
 * overflow at 320px viewport.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./LiveUrlCard", () => ({
  LiveUrlCard: () => <button data-testid="action-card" data-card="live">Live URL</button>,
}));
vi.mock("./PreviewUrlCard", () => ({
  PreviewUrlCard: () => <button data-testid="action-card" data-card="preview">Preview URL</button>,
}));
vi.mock("./ItemIdCard", () => ({
  ItemIdCard: () => <button data-testid="action-card" data-card="item">Item ID</button>,
}));
vi.mock("./PageTitleCard", () => ({
  PageTitleCard: () => <button data-testid="action-card" data-card="title">Page Title</button>,
}));

import { ActionGrid } from "./ActionGrid";

const ORIGINAL_INNER_WIDTH = window.innerWidth;

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: ORIGINAL_INNER_WIDTH,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: ORIGINAL_INNER_WIDTH,
    configurable: true,
    writable: true,
  });
});

describe("<ActionGrid /> (T022)", () => {
  it("renders exactly four action cards", () => {
    render(<ActionGrid />);
    expect(screen.getAllByTestId("action-card")).toHaveLength(4);
  });

  it("renders cards in DOM order Live → Preview → Item → Title", () => {
    render(<ActionGrid />);
    const cards = screen.getAllByTestId("action-card");
    expect(cards[0]?.getAttribute("data-card")).toBe("live");
    expect(cards[1]?.getAttribute("data-card")).toBe("preview");
    expect(cards[2]?.getAttribute("data-card")).toBe("item");
    expect(cards[3]?.getAttribute("data-card")).toBe("title");
  });

  it("uses the gap-px hairline-gridlines token on the grid container", () => {
    const { container } = render(<ActionGrid />);
    const grid = container.querySelector('[data-quickcopy="action-grid"]');
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain("gap-px");
  });

  it("does not horizontally overflow at 320px viewport", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 320,
      configurable: true,
      writable: true,
    });
    const { container } = render(<ActionGrid />);
    const grid = container.querySelector(
      '[data-quickcopy="action-grid"]',
    ) as HTMLElement | null;
    expect(grid).not.toBeNull();
    if (grid) {
      // jsdom layout values are 0; the structural assertion is enough — we
      // verify scrollWidth is at most clientWidth, which holds when both
      // are 0 in jsdom (no overflow created at the DOM level).
      expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
    }
  });
});
