/**
 * T034a — RED tests for `<StatusLiveRegion>` + `useStatusAnnouncer`.
 *
 * Source of truth: § 10 T034a + § 4c-8 (announcement strings) + ADR-0009
 * (errors are NOT announced).
 *
 * Cases:
 *  1. Region renders with `role="status"` AND `aria-live="polite"`.
 *  2. Region is visually hidden (`sr-only` class).
 *  3. `announce("Live URL copied")` updates region text.
 *  4. After 1500ms (fake timers) the region clears.
 *  5. Re-announcing within the 1500ms window resets the timer cleanly.
 *  6. (Regression / encoded in T033) — errors are NOT announced; covered by
 *     the existing `aria-live` regression assertion plus the success-only
 *     surface area below.
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  StatusLiveRegion,
  useStatusAnnouncer,
} from "@/components/quickcopy/StatusLiveRegion";

describe("<StatusLiveRegion> (T034)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with role=status and aria-live=polite", () => {
    render(<StatusLiveRegion />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });

  it("is visually hidden via sr-only", () => {
    render(<StatusLiveRegion />);
    const region = screen.getByRole("status");
    expect(region.className).toMatch(/sr-only/);
  });

  it("announce(label) updates region text content", () => {
    render(<StatusLiveRegion />);
    const { result } = renderHook(() => useStatusAnnouncer());

    act(() => {
      result.current.announce("Live URL copied");
    });

    expect(screen.getByRole("status").textContent).toBe("Live URL copied");
  });

  it("clears region text after 1500ms", () => {
    render(<StatusLiveRegion />);
    const { result } = renderHook(() => useStatusAnnouncer());

    act(() => {
      result.current.announce("Item ID copied");
    });
    expect(screen.getByRole("status").textContent).toBe("Item ID copied");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("re-announcing inside the 1500ms window resets the timer cleanly", () => {
    render(<StatusLiveRegion />);
    const { result } = renderHook(() => useStatusAnnouncer());

    act(() => {
      result.current.announce("A");
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      result.current.announce("B");
    });

    // 500ms after the second announcement — well within the new 1500ms.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status").textContent).toBe("B");

    // A further 1000ms (1500ms total since the second announcement) → cleared.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
