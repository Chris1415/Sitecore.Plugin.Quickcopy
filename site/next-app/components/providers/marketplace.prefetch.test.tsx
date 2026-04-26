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
