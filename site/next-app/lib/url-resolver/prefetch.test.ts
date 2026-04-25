/**
 * T013a — RED tests for `prefetchPageUrls`.
 *
 * Spec source: task-breakdown § 10 / B-026..B-033 + § 4c-6.
 *
 * The orchestrator does not yet exist — every test fails with "module not
 * found" until T013b lands.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAll, getEntry } from "@/lib/cache/store";
import type { PageDerivedState } from "@/lib/cache/types";

import { prefetchPageUrls } from "./prefetch";

interface QueryArgs {
  key: string;
  options: { params?: { path?: Record<string, unknown>; query?: Record<string, unknown> } };
}

interface MockClientLike {
  query: (key: string, options?: unknown) => Promise<unknown>;
}

function buildClient(handlers: Record<string, () => Promise<unknown>>): {
  client: MockClientLike;
  calls: QueryArgs[];
} {
  const calls: QueryArgs[] = [];
  const query = vi
    .fn()
    .mockImplementation(async (key: string, options: unknown) => {
      calls.push({
        key,
        options:
          (options as QueryArgs["options"]) ?? ({} as QueryArgs["options"]),
      });
      const handler = handlers[key];
      if (!handler) {
        throw new Error(`unexpected SDK key in mock: ${key}`);
      }
      return handler();
    });
  // Cast through unknown so we don't bring the full ClientSDK shape in.
  return { client: { query: query as unknown as MockClientLike["query"] }, calls };
}

const PAGE_INFO = {
  id: "page-1",
  version: 2,
  url: "/products/spring",
  language: "en",
};
const SITE_INFO = { id: "site-1", name: "marketing", language: "en" };
const CTX = "ctx-live";

describe("prefetchPageUrls (T013)", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues exactly three SDK queries with the correct keys + params", async () => {
    const { client, calls } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: {
              hasPublishableVersion: true,
              isPublishable: true,
            },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: {
          data: [{ kind: "delivery", hostName: "www.example.com" }],
        },
      }),
    });

    await prefetchPageUrls(
      client as never,
      CTX,
      PAGE_INFO,
      SITE_INFO,
    );

    const keys = calls.map((c) => c.key).sort();
    expect(keys).toEqual([
      "xmc.agent.pagesGetPagePreviewUrl",
      "xmc.pages.retrievePage",
      "xmc.sites.listHosts",
    ]);

    const previewCall = calls.find(
      (c) => c.key === "xmc.agent.pagesGetPagePreviewUrl",
    );
    expect(previewCall?.options.params?.path).toEqual({ pageId: "page-1" });
    expect(previewCall?.options.params?.query).toMatchObject({
      sitecoreContextId: CTX,
    });

    const retrieveCall = calls.find((c) => c.key === "xmc.pages.retrievePage");
    expect(retrieveCall?.options.params?.path).toEqual({ pageId: "page-1" });
    expect(retrieveCall?.options.params?.query).toMatchObject({
      site: "marketing",
      language: "en",
      sitecoreContextId: CTX,
    });

    const hostsCall = calls.find((c) => c.key === "xmc.sites.listHosts");
    expect(hostsCall?.options.params?.path).toEqual({ siteId: "site-1" });
    expect(hostsCall?.options.params?.query).toMatchObject({
      sitecoreContextId: CTX,
    });
  });

  it("happy path — composes liveUrl from delivery host and slug", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: {
          data: [{ kind: "delivery", hostName: "www.example.com" }],
        },
      }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toBe("https://preview.example.com/foo");
    expect(slot.publishing).toEqual({ isPublished: true });
    expect(slot.liveHost).toBe("https://www.example.com");
    expect(slot.liveUrl).toBe("https://www.example.com/products/spring");
  });

  it("publishing.hasPublishableVersion=false → liveUrl null, isPublished false", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: false, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: {
          data: [{ kind: "delivery", hostName: "www.example.com" }],
        },
      }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.publishing).toEqual({ isPublished: false });
    expect(slot.liveUrl).toBeNull();
  });

  it("publishing.isPublishable=false → liveUrl null, isPublished false", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: false },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: { data: [{ kind: "delivery", hostName: "www.example.com" }] },
      }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.publishing).toEqual({ isPublished: false });
    expect(slot.liveUrl).toBeNull();
  });

  it("xmc.sites.listHosts rejects → liveHost is { error }; preview/publishing still resolve", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => {
        throw new Error("network down");
      },
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toBe("https://preview.example.com/foo");
    expect(slot.publishing).toEqual({ isPublished: true });
    expect(slot.liveHost).toMatchObject({ error: expect.any(Error) });
    expect(slot.liveUrl).toBeNull();
  });

  it("preview-url query rejects → previewUrl is { error }; liveHost still resolves", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => {
        throw new Error("nope");
      },
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: { data: [{ kind: "delivery", hostName: "www.example.com" }] },
      }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toMatchObject({ error: expect.any(Error) });
    expect(slot.liveHost).toBe("https://www.example.com");
  });

  it("all three reject → all three slots are { error }; liveUrl null", async () => {
    const boom = async () => {
      throw new Error("boom");
    };
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": boom,
      "xmc.pages.retrievePage": boom,
      "xmc.sites.listHosts": boom,
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toMatchObject({ error: expect.any(Error) });
    expect(slot.publishing).toMatchObject({ error: expect.any(Error) });
    expect(slot.liveHost).toMatchObject({ error: expect.any(Error) });
    expect(slot.liveUrl).toBeNull();
  });

  it("liveUrl composition for slug '/'", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({
        data: { data: [{ kind: "delivery", hostName: "www.example.com" }] },
      }),
    });

    await prefetchPageUrls(
      client as never,
      CTX,
      { ...PAGE_INFO, url: "/" },
      SITE_INFO,
    );
    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.liveUrl).toBe("https://www.example.com/");
  });

  it("listHosts returns empty array → liveHost is { error: 'no live host' }", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { data: "https://preview.example.com/foo" },
      }),
      "xmc.pages.retrievePage": async () => ({
        data: {
          data: {
            publishing: { hasPublishableVersion: true, isPublishable: true },
          },
        },
      }),
      "xmc.sites.listHosts": async () => ({ data: { data: [] } }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.liveHost).toMatchObject({
      error: expect.objectContaining({ message: "no live host" }),
    });
    expect(slot.liveUrl).toBeNull();
  });
});
