/**
 * T009a — RED tests for `MarketplaceProvider`'s `pages.context` subscription.
 *
 * Spec source: task-breakdown-20260424T193446Z.md § 10 / B-010..B-013.
 *
 * The scaffolded Provider does NOT yet subscribe to `pages.context` (only
 * `application.context`). These tests fail until T009b lands the Path A
 * subscription per `client.md § 6a`.
 */

import { act, render, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the SDK at the module boundary so the Provider import picks up the
// stub. We use `vi.hoisted` because `ClientSDK.init` is called inside a
// `useEffect` at mount time and the import order matters.
const sdkMocks = vi.hoisted(() => {
  const queryFn = vi.fn();
  const destroyFn = vi.fn();
  const initFn = vi.fn();
  return { queryFn, destroyFn, initFn };
});

vi.mock("@sitecore-marketplace-sdk/client", () => ({
  ClientSDK: {
    init: sdkMocks.initFn,
  },
}));

vi.mock("@sitecore-marketplace-sdk/xmc", () => ({
  XMC: { id: "XMC" },
}));

import {
  MarketplaceProvider,
  usePagesContext,
} from "./marketplace";

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

function setupHealthyClient() {
  const unsubscribe = vi.fn();
  sdkMocks.queryFn.mockImplementation(
    (key: string, options?: PagesContextSubscribeOptions) => {
      if (key === "application.context") {
        return Promise.resolve({ data: { resourceAccess: [] } });
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

function Wrapper({ children }: { children: ReactNode }) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}

beforeEach(() => {
  captured = undefined;
  sdkMocks.initFn.mockReset();
  sdkMocks.queryFn.mockReset();
  sdkMocks.destroyFn.mockReset();
  setupHealthyClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketplaceProvider — pages.context subscription (T009)", () => {
  it("calls client.query('pages.context', { subscribe: true }) exactly once under StrictMode", async () => {
    render(
      <StrictMode>
        <MarketplaceProvider>
          <div>child</div>
        </MarketplaceProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      const calls = sdkMocks.queryFn.mock.calls.filter(
        (c) => c[0] === "pages.context",
      );
      expect(calls.length).toBe(1);
      expect(calls[0]?.[1]).toMatchObject({ subscribe: true });
    });
  });

  it("usePagesContext() returns null before any onSuccess fires", async () => {
    const { result } = renderHook(() => usePagesContext(), {
      wrapper: Wrapper,
    });

    // Allow init + first effect to settle, but DO NOT trigger onSuccess.
    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    expect(result.current).toBeNull();
  });

  it("usePagesContext() returns the snapshot after onSuccess({ pageInfo, siteInfo })", async () => {
    const { result } = renderHook(() => usePagesContext(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    const snapshot = {
      pageInfo: {
        id: "page-1",
        name: "spring-campaign",
        version: 2,
        displayName: "Spring Campaign",
        url: "/products/spring",
      },
      siteInfo: { id: "site-1", name: "marketing" },
    };

    act(() => {
      captured?.options.onSuccess?.(snapshot);
    });

    await waitFor(() => {
      expect(result.current).toEqual(snapshot);
    });
  });

  it("invokes the captured unsubscribe AND client.destroy() on unmount", async () => {
    const { unmount } = render(
      <MarketplaceProvider>
        <div>child</div>
      </MarketplaceProvider>,
    );

    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    unmount();

    await waitFor(() => {
      expect(captured?.unsubscribe).toHaveBeenCalledTimes(1);
      expect(sdkMocks.destroyFn).toHaveBeenCalledTimes(1);
    });
  });

  it("logs onError via console.error and keeps the last successful payload", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => usePagesContext(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(captured).toBeDefined();
    });

    const snapshot = {
      pageInfo: { id: "p", name: "n" },
      siteInfo: { id: "s", name: "site" },
    };
    act(() => {
      captured?.options.onSuccess?.(snapshot);
    });

    await waitFor(() => {
      expect(result.current).toEqual(snapshot);
    });

    act(() => {
      captured?.options.onError?.(new Error("boom"));
    });

    expect(errSpy).toHaveBeenCalled();
    // Last successful payload preserved (no regression to null).
    expect(result.current).toEqual(snapshot);
  });
});
