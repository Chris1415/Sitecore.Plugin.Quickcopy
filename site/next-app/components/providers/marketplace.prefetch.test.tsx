/**
 * T014a — RED tests for `MarketplaceProvider` pre-fetch wiring.
 * T015  — Provider unmount triggers `clearAll()` (extends T014a per § 9.3).
 *
 * Spec source: task-breakdown § 10 / B-034..B-037 + § 4c-6.
 *
 * The Provider does not yet call `prefetchPageUrls` on cache-key change —
 * these tests fail until T014b lands the wiring.
 */

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => {
  const queryFn = vi.fn();
  const destroyFn = vi.fn();
  const initFn = vi.fn();
  return { queryFn, destroyFn, initFn };
});

vi.mock("@sitecore-marketplace-sdk/client", () => ({
  ClientSDK: { init: sdkMocks.initFn },
}));
vi.mock("@sitecore-marketplace-sdk/xmc", () => ({
  XMC: { id: "XMC" },
}));

const prefetchSpy = vi.hoisted(() =>
  vi.fn<
    (
      client: unknown,
      contextId: string,
      pageInfo: unknown,
      siteInfo: unknown,
    ) => Promise<void>
  >(),
);

vi.mock("@/lib/url-resolver/prefetch", () => ({
  prefetchPageUrls: prefetchSpy,
}));

import { MarketplaceProvider } from "./marketplace";
import { clearAll, getEntry, setEntry } from "@/lib/cache/store";

interface PagesContextSubscribeOptions {
  subscribe?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (err: unknown) => void;
}

interface CapturedSubscription {
  options: PagesContextSubscribeOptions;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let captured: CapturedSubscription | undefined;

function setupHealthyClient(appCtx?: unknown) {
  const unsubscribe = vi.fn();
  sdkMocks.queryFn.mockImplementation(
    (key: string, options?: PagesContextSubscribeOptions) => {
      if (key === "application.context") {
        return Promise.resolve({
          data:
            appCtx ??
            ({
              resourceAccess: [{ context: { live: "ctx-live" } }],
            } as unknown),
        });
      }
      if (key === "pages.context") {
        captured = { options: options ?? {}, unsubscribe };
        return Promise.resolve({ unsubscribe });
      }
      return Promise.resolve({ data: undefined });
    },
  );
  sdkMocks.initFn.mockResolvedValue({
    query: sdkMocks.queryFn,
    destroy: sdkMocks.destroyFn,
  });
}

const SNAPSHOT = (version: number, id = "page-1") => ({
  pageInfo: {
    id,
    version,
    name: "spring-campaign",
    displayName: "Spring Campaign",
    url: "/products/spring",
    language: "en",
  },
  siteInfo: { id: "site-1", name: "marketing", language: "en" },
});

beforeEach(() => {
  captured = undefined;
  prefetchSpy.mockReset();
  prefetchSpy.mockImplementation(async () => {});
  sdkMocks.initFn.mockReset();
  sdkMocks.queryFn.mockReset();
  sdkMocks.destroyFn.mockReset();
  setupHealthyClient();
  clearAll();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketplaceProvider — prefetch wiring (T014, T015)", () => {
  it("calls prefetchPageUrls once on the first cache-key resolve", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );

    await waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });

    await waitFor(() => {
      expect(prefetchSpy).toHaveBeenCalledTimes(1);
      const args = prefetchSpy.mock.calls[0]!;
      expect(args[1]).toBe("ctx-live");
      expect((args[2] as { id?: string }).id).toBe("page-1");
      expect((args[3] as { id?: string }).id).toBe("site-1");
    });
  });

  it("does NOT call prefetchPageUrls a second time when the same cache-key re-fires (cache hit)", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledTimes(1));

    // Simulate the cache being populated (real prefetch would write here).
    setEntry("page-1:2", {
      previewUrl: "X",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/products/spring",
    });

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });

    // Give effects a chance to run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fires a fresh prefetch when pageInfo.version bumps (1 -> 2)", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(1));
    });
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledTimes(1));

    // Mark the v1 slot as resolved.
    setEntry("page-1:1", {
      previewUrl: "X",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/products/spring",
    });

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledTimes(2));
  });

  it("fires a fresh prefetch when pageInfo.id changes", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2, "page-A"));
    });
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledTimes(1));

    setEntry("page-A:2", {
      previewUrl: "X",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/products/spring",
    });

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2, "page-B"));
    });
    await waitFor(() => expect(prefetchSpy).toHaveBeenCalledTimes(2));
  });

  it("clears the cache on Provider unmount (T015)", async () => {
    const { unmount } = render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });
    setEntry("page-1:2", {
      previewUrl: "X",
      publishing: { isPublished: true },
      liveHost: "https://www.example.com",
      liveUrl: "https://www.example.com/products/spring",
    });

    expect(getEntry("page-1:2")).toBeDefined();

    unmount();

    await waitFor(() => {
      expect(getEntry("page-1:2")).toBeUndefined();
    });
  });
});

/**
 * FRD-001 / T001 — RED tests for the prefetch debounce.
 *
 * Spec: frd-001.md § 3 (AC1, AC2) + task-breakdown-20260620T122930Z.md
 * § 10. These assert that rapid `pageInfo.id` changes within the debounce
 * window collapse to ONE settled prefetch trio (for the LAST id), that a
 * settled single page still fires exactly once, and that an unmount mid-window
 * cancels the pending timer.
 *
 * These use Vitest fake timers so the test controls the ~200 ms debounce
 * clock rather than waiting wall-clock. They FAIL until T002 wraps the
 * prefetch dispatch in a debounced `setTimeout` — today each distinct id
 * fires immediately (N calls, not 1).
 *
 * The debounce window constant is intentionally NOT imported from the
 * Provider — these tests advance by a value comfortably larger than the
 * default (200 ms) so they stay correct if the constant is tuned upward
 * within reason.
 */
describe("MarketplaceProvider — prefetch debounce (FRD-001 / T001)", () => {
  // A value safely past the default 200 ms debounce window. Advancing by this
  // flushes a trailing-edge timer regardless of minor tuning.
  const PAST_WINDOW_MS = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain any leftover timers, then hand the clock back to real time so
    // the real-timer describe block above is unaffected.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /**
   * `waitFor` under fake timers cannot rely on the real event loop, so we
   * flush React's microtask queue + advance the fake clock together inside
   * `act`. Repeated a few times to let chained effects settle.
   */
  async function flush(advanceMs = 0) {
    await act(async () => {
      if (advanceMs > 0) {
        await vi.advanceTimersByTimeAsync(advanceMs);
      } else {
        await vi.advanceTimersByTimeAsync(0);
      }
    });
  }

  it("collapses rapid distinct id changes to ONE settled prefetch (last id wins)", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );

    // The init + subscription effects resolve via awaited promises; flush
    // microtasks under the fake clock until the subscription is captured.
    await vi.waitFor(() => expect(captured).toBeDefined());

    // Fire three DISTINCT page ids in quick succession, all within the window.
    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2, "page-A"));
    });
    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2, "page-B"));
    });
    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2, "page-C"));
    });

    // Before the window elapses, no prefetch should have fired (debounced).
    await flush(0);
    expect(prefetchSpy).not.toHaveBeenCalled();

    // Advance past the window: exactly one settled prefetch — for the LAST id.
    await flush(PAST_WINDOW_MS);

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    const args = prefetchSpy.mock.calls[0]!;
    expect((args[2] as { id?: string }).id).toBe("page-C");
  });

  it("still fires exactly once for a settled single page after the window", async () => {
    render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await vi.waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });

    await flush(PAST_WINDOW_MS);

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect((prefetchSpy.mock.calls[0]![2] as { id?: string }).id).toBe(
      "page-1",
    );
  });

  it("cancels the pending prefetch when the Provider unmounts mid-window", async () => {
    const { unmount } = render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );
    await vi.waitFor(() => expect(captured).toBeDefined());

    act(() => {
      captured?.options.onSuccess?.(SNAPSHOT(2));
    });

    // Unmount BEFORE the debounce window elapses.
    act(() => {
      unmount();
    });

    // Advancing past the window must NOT fire a prefetch into a torn-down
    // Provider — the pending timer was cleared on unmount.
    await flush(PAST_WINDOW_MS);

    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
