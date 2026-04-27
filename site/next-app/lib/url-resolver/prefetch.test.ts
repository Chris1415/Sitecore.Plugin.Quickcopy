/**
 * Tests for `prefetchPageUrls`.
 *
 * Spec source: task-breakdown § 10 / B-026..B-033 + § 4c-6 + ADR-0006.
 * Mock fixtures use the REAL SDK envelopes derived from the
 * `@sitecore-marketplace-sdk/xmc` declared types — not the invented
 * double-wrap + `kind: "delivery"` shapes that v0.1 GA shipped with.
 * See `project-planning/plans/diagnostic-2026-04-26-real-tenant-url-failures.md`.
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
  return { client: { query: query as unknown as MockClientLike["query"] }, calls };
}

// --- Real SDK envelope fixtures (single-wrap per @hey-api/client-fetch) ---

/** `{ data: Agent.GetPagePreviewUrlResponse, request, response }` */
function previewOk(previewUrl: string) {
  return async () => ({
    data: { pageId: "page-1", previewUrl },
  });
}

/**
 * `{ data: Pages.Page, request, response }` — only the fields prefetch reads
 * (publishing flags + url) are populated.
 */
function pageOk(opts: {
  hasPublishableVersion?: boolean;
  isPublishable?: boolean;
  url?: string;
}) {
  return async () => ({
    data: {
      publishing: {
        hasPublishableVersion: opts.hasPublishableVersion,
        isPublishable: opts.isPublishable,
      },
      url: opts.url,
    },
  });
}

/** `{ data: Sites.Host[], request, response }` */
function hostsOk(targetHostname: string) {
  return async () => ({
    data: [
      {
        id: "host-1",
        name: "marketing",
        hostnames: [targetHostname],
        targetHostname,
      },
    ],
  });
}

const PAGE_INFO = {
  id: "page-1",
  version: 2,
  url: "/products/spring",
  language: "en",
};
const SITE_INFO = { id: "site-1", name: "marketing", language: "en" };
const CTX = "ctx-live";

describe("prefetchPageUrls", () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues exactly three SDK queries with the correct keys + params", async () => {
    const { client, calls } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

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

  it("happy path — composes liveUrl from targetHostname + page slug", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
        url: "/products/spring",
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toBe("https://preview.example.com/foo");
    expect(slot.publishing).toEqual({ isPublished: true });
    expect(slot.liveHost).toBe("https://www.example.com");
    expect(slot.liveUrl).toBe("https://www.example.com/products/spring");
  });

  it("falls back to pageInfo.url when retrievePage omits .url", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
        // url undefined — slug should fall back to pageInfo.url
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.liveUrl).toBe("https://www.example.com/products/spring");
  });

  it("publishing.hasPublishableVersion=false → liveUrl null, isPublished false", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: false,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.publishing).toEqual({ isPublished: false });
    expect(slot.liveUrl).toBeNull();
  });

  it("publishing.isPublishable=false → liveUrl null, isPublished false", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: false,
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.publishing).toEqual({ isPublished: false });
    expect(slot.liveUrl).toBeNull();
  });

  it("xmc.sites.listHosts rejects → liveHost is { error }; preview/publishing still resolve", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
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
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
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
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
        url: "/",
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
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
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": async () => ({ data: [] }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.liveHost).toMatchObject({
      error: expect.objectContaining({ message: "no live host" }),
    });
    expect(slot.liveUrl).toBeNull();
  });

  it("falls back to hostnames[0] when targetHostname is absent", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": previewOk("https://preview.example.com/foo"),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": async () => ({
        data: [
          {
            id: "host-1",
            name: "marketing",
            hostnames: ["www.fallback.example.com", "alt.example.com"],
            // targetHostname intentionally omitted
          },
        ],
      }),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.liveHost).toBe("https://www.fallback.example.com");
  });

  it("preview-url returns empty string → previewUrl is { error: 'preview-url empty' }", async () => {
    const { client } = buildClient({
      "xmc.agent.pagesGetPagePreviewUrl": async () => ({
        data: { pageId: "page-1", previewUrl: "" },
      }),
      "xmc.pages.retrievePage": pageOk({
        hasPublishableVersion: true,
        isPublishable: true,
      }),
      "xmc.sites.listHosts": hostsOk("www.example.com"),
    });

    await prefetchPageUrls(client as never, CTX, PAGE_INFO, SITE_INFO);

    const slot = getEntry("page-1:2") as PageDerivedState;
    expect(slot.previewUrl).toMatchObject({
      error: expect.objectContaining({ message: "preview-url empty" }),
    });
  });
});
