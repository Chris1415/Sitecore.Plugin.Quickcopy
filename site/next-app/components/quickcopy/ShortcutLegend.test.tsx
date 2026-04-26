/**
 * T031a — RED tests for `<ShortcutLegend>`.
 *
 * Pinned by § 10 T031a + § 4c-1 + ADR-0008 + FR-012.
 *
 * Cases:
 *  1. Renders exactly five chip elements (one per SHORTCUTS entry).
 *  2. Each chip's text content includes its `legendKey` AND label.
 *  3. DOM order matches Live → Preview → Item → Title → Share.
 *  4. The legend container is always visible (no aria-hidden on parent,
 *     no display:none ancestor — assert via getByRole / visible text query).
 *  5. No expand/collapse affordance — getAllByRole('button') inside the
 *     legend returns zero buttons.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortcutLegend } from "./ShortcutLegend";

describe("<ShortcutLegend>", () => {
  it("renders exactly five chips matching the SHORTCUTS constant", () => {
    render(<ShortcutLegend />);
    const chips = screen.getAllByTestId("shortcut-legend-chip");
    expect(chips).toHaveLength(5);
  });

  it("each chip's text content includes legendKey AND label", () => {
    render(<ShortcutLegend />);
    const chips = screen.getAllByTestId("shortcut-legend-chip");
    const expected: Array<{ legendKey: string; label: string }> = [
      { legendKey: "L", label: "Live URL" },
      { legendKey: "P", label: "Preview URL" },
      { legendKey: "I", label: "Item ID" },
      { legendKey: "T", label: "Page Title" },
      { legendKey: "S", label: "Share Link" },
    ];
    expected.forEach(({ legendKey, label }, i) => {
      const text = chips[i].textContent ?? "";
      expect(text).toContain(legendKey);
      expect(text).toContain(label);
    });
  });

  it("DOM order matches Live → Preview → Item → Title → Share", () => {
    render(<ShortcutLegend />);
    const chips = screen.getAllByTestId("shortcut-legend-chip");
    const labels = ["Live URL", "Preview URL", "Item ID", "Page Title", "Share Link"];
    chips.forEach((chip, i) => {
      expect(chip.textContent).toContain(labels[i]);
    });
  });

  it("legend container is always visible (no aria-hidden, no display:none)", () => {
    render(<ShortcutLegend />);
    const container = screen.getByRole("list", { name: /shortcuts/i });
    expect(container.getAttribute("aria-hidden")).not.toBe("true");
    expect(container).toBeVisible();
  });

  it("has no expand/collapse affordance — zero buttons inside the legend", () => {
    render(<ShortcutLegend />);
    const container = screen.getByRole("list", { name: /shortcuts/i });
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
  });
});
