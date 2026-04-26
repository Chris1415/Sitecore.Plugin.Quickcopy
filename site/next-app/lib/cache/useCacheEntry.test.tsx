/**
 * Regression test for `useCacheEntry`.
 *
 * Pinned by code-review 2026-04-26 finding C-1: prior to the subscription
 * fix, the hook only re-derived on `pageInfo.id` / `pageInfo.version` change.
 * When the parallel pre-fetch resolved AFTER the first render, the action
 * cards stayed stuck on `Loading…` indefinitely because the singleton cache
 * Map was mutated outside React's awareness. This test exercises the
 * prefetch→setEntry→re-render flow directly.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providerMock = vi.hoisted(() => ({
  usePagesContext: vi.fn(),
}));
vi.mock("@/components/providers/marketplace", () => providerMock);

import { clearAll, setEntry } from "@/lib/cache/store";
import { buildCacheKey } from "@/lib/cache/types";
import { useCacheEntry } from "@/lib/cache/useCacheEntry";

function Probe() {
  const { key, state } = useCacheEntry();
  return (
    <div>
      <span data-testid="key">{key ?? "(no key)"}</span>
      <span data-testid="state">
        {state ? "has-state" : "no-state"}
      </span>
      <span data-testid="liveUrl">
        {typeof state?.liveUrl === "string" ? state.liveUrl : "(none)"}
      </span>
    </div>
  );
}

beforeEach(() => {
  clearAll();
  providerMock.usePagesContext.mockReset();
});

afterEach(() => {
  clearAll();
});

describe("useCacheEntry — cache-mutation subscription", () => {
  it("returns { key: null, state: undefined } when pages.context has no id", () => {
    providerMock.usePagesContext.mockReturnValue(null);
    render(<Probe />);
    expect(screen.getByTestId("key").textContent).toBe("(no key)");
    expect(screen.getByTestId("state").textContent).toBe("no-state");
  });

  it("returns the cached slot synchronously when one is already present", () => {
    providerMock.usePagesContext.mockReturnValue({
      pageInfo: { id: "page-1", version: 2 },
    });
    setEntry(buildCacheKey("page-1", 2), {
      previewUrl: "https://preview/x",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/x",
    });
    render(<Probe />);
    expect(screen.getByTestId("liveUrl").textContent).toBe(
      "https://www.example.com/x",
    );
  });

  it("re-renders when setEntry mutates the active slot AFTER first paint", () => {
    providerMock.usePagesContext.mockReturnValue({
      pageInfo: { id: "page-1", version: 2 },
    });
    render(<Probe />);
    // Initial paint: cache empty, hook returns state=undefined.
    expect(screen.getByTestId("state").textContent).toBe("no-state");
    expect(screen.getByTestId("liveUrl").textContent).toBe("(none)");

    // Simulate prefetch resolving → writes the slot.
    act(() => {
      setEntry(buildCacheKey("page-1", 2), {
        previewUrl: "https://preview/x",
        publishing: { isPublished: true },
        liveHost: "https://www.example.com",
        liveUrl: "https://www.example.com/x",
      });
    });

    // Hook must observe the mutation and re-render with the resolved slot.
    expect(screen.getByTestId("state").textContent).toBe("has-state");
    expect(screen.getByTestId("liveUrl").textContent).toBe(
      "https://www.example.com/x",
    );
  });

  it("re-renders when clearAll wipes the active slot", () => {
    providerMock.usePagesContext.mockReturnValue({
      pageInfo: { id: "page-1", version: 2 },
    });
    setEntry(buildCacheKey("page-1", 2), {
      previewUrl: "https://preview/x",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/x",
    });
    render(<Probe />);
    expect(screen.getByTestId("state").textContent).toBe("has-state");

    act(() => {
      clearAll();
    });

    expect(screen.getByTestId("state").textContent).toBe("no-state");
  });
});
