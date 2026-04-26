/**
 * T017a — RED tests for the reusable `<ActionCard>` Blok-composed primitive.
 *
 * Spec source: task-breakdown § 10 (T017a) + § 4c-4 (interaction states) +
 * B-050..B-056 + B-131.
 *
 * The component does not yet exist — every test fails with "module not found"
 * until T017b lands. The tests cover:
 *  - Renders glyph + label + Kbd shortcut chip; aria-label matches the
 *    "Copy <Label> — shortcut Alt+<Letter>" pattern.
 *  - Click + Enter + Space all call `onActivate` once when state is `idle`.
 *  - `state='disabled'` and `state='error'` apply `aria-disabled="true"`
 *    (NOT the `disabled` HTML attribute — must remain focusable for tooltip).
 *  - Click in `disabled` / `error` state does NOT call `onActivate`.
 *  - `state='copied'` shows the visible string `Copied`.
 *  - `tooltip` prop wires `aria-describedby` to a sibling element with that
 *    text content.
 *  - Under `prefers-reduced-motion: reduce` the rendered DOM omits the
 *    rotation/scale morph utility (no `qc-card-morph` class).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionCard } from "./ActionCard";

const baseProps = {
  glyph: "↗",
  label: "Live URL",
  shortcut: "L",
  state: "idle" as const,
  onActivate: vi.fn(),
  "aria-label": "Copy Live URL — shortcut Alt+L",
};

beforeEach(() => {
  baseProps.onActivate = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<ActionCard /> (T017)", () => {
  it("renders glyph, label, and shortcut chip", () => {
    render(<ActionCard {...baseProps} />);
    expect(screen.getByText("↗")).toBeInTheDocument();
    expect(screen.getByText("Live URL")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("uses the supplied aria-label exactly", () => {
    render(<ActionCard {...baseProps} />);
    const btn = screen.getByRole("button", {
      name: "Copy Live URL — shortcut Alt+L",
    });
    expect(btn).toBeInTheDocument();
  });

  it("calls onActivate once on click in idle state", () => {
    render(<ActionCard {...baseProps} />);
    fireEvent.click(screen.getByRole("button"));
    expect(baseProps.onActivate).toHaveBeenCalledTimes(1);
  });

  it("calls onActivate on Enter key in idle state", () => {
    render(<ActionCard {...baseProps} />);
    const btn = screen.getByRole("button");
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(baseProps.onActivate).toHaveBeenCalledTimes(1);
  });

  it("calls onActivate on Space key in idle state", () => {
    render(<ActionCard {...baseProps} />);
    const btn = screen.getByRole("button");
    btn.focus();
    fireEvent.keyDown(btn, { key: " " });
    expect(baseProps.onActivate).toHaveBeenCalledTimes(1);
  });

  it("applies aria-disabled (NOT disabled attribute) when state='disabled'", () => {
    render(<ActionCard {...baseProps} state="disabled" />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).not.toHaveAttribute("disabled");
    // still focusable for tooltip
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("does NOT call onActivate on click when state='disabled'", () => {
    render(<ActionCard {...baseProps} state="disabled" />);
    fireEvent.click(screen.getByRole("button"));
    expect(baseProps.onActivate).not.toHaveBeenCalled();
  });

  it("applies aria-disabled when state='error' and shows error affordance", () => {
    render(<ActionCard {...baseProps} state="error" />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    // The error state surfaces a destructive X glyph (U+2715) AND a "Failed"
    // label per UI § 5g. ✕ is used instead of ❌ (U+274C) because the latter
    // renders as a colour emoji bitmap that ignores CSS colour — see
    // ActionCard.tsx for the rationale.
    expect(btn.textContent ?? "").toMatch(/✕|Failed/);
  });

  it("does NOT call onActivate on click when state='error'", () => {
    render(<ActionCard {...baseProps} state="error" />);
    fireEvent.click(screen.getByRole("button"));
    expect(baseProps.onActivate).not.toHaveBeenCalled();
  });

  it("shows visible 'Copied' text when state='copied'", () => {
    render(<ActionCard {...baseProps} state="copied" />);
    expect(screen.getByText(/Copied/)).toBeInTheDocument();
  });

  it("wires aria-describedby to a sibling element with the tooltip text when tooltip prop is supplied", () => {
    render(<ActionCard {...baseProps} state="disabled" tooltip="Why disabled" />);
    const btn = screen.getByRole("button");
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy as string);
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toContain("Why disabled");
  });

  it("strips the morph rotation/scale utility class under prefers-reduced-motion: reduce", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    render(<ActionCard {...baseProps} state="copied" />);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toMatch(/qc-card-morph/);
  });
});
