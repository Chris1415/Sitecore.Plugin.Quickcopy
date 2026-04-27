"use client";

/**
 * Parallel pre-fetch orchestrator.
 *
 * Source of truth: ADR-0006 (parallel pre-fetch on pageInfo.id change) +
 * ADR-0007 (version-keyed cache, no TTL). Response shapes are derived from the
 * `@sitecore-marketplace-sdk/xmc` declared types (Agent / Pages / Sites
 * namespaces in `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/`)
 * — NOT from the agent skill catalogue, which doesn't document response
 * envelopes. The QuickCopy v0.1 GA build had this wrong (assumed double-wrapped
 * `{ data: { data: T } }` envelopes and invented host fields like
 * `kind: "delivery"`/`hostName` that don't exist on the real `Sites.Host`
 * type). Diagnostic post-mortem:
 * `project-planning/plans/diagnostic-2026-04-26-real-tenant-url-failures.md`.
 *
 * The hey-api client-fetch envelope is:
 *
 *     { data: TData | undefined, error?: TError, request, response }
 *
 * where `TData` is exactly the SDK response type (`Agent.GetPagePreviewUrlResponse`,
 * `Pages.Page`, `Sites.Host[]`). Single-level unwrap.
 *
 * Issues three parallel queries via `Promise.allSettled`:
 *   - `xmc.agent.pagesGetPagePreviewUrl` → `{ pageId, previewUrl }`
 *   - `xmc.pages.retrievePage`           → `Pages.Page` (reads `publishing.{hasPublishableVersion,isPublishable}` + `url`)
 *   - `xmc.sites.listHosts`              → `Sites.Host[]` (reads `targetHostname` || `hostnames[0]`)
 *
 * Composes `liveUrl` eagerly when `publishing.isPublished === true` AND a host
 * resolves. Click handlers are synchronous cache reads — no fetch on click.
 *
 * Failures are isolated per slot — a failing `listHosts` does NOT corrupt
 * `previewUrl`. Per ADR-0009 the failed slot stays `{ error }` until the cache
 * key changes (id or version bump).
 */

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { Agent, Pages, Sites } from "@sitecore-marketplace-sdk/xmc";

import { setEntry } from "@/lib/cache/store";
import {
  buildCacheKey,
  type CacheValue,
  type PageDerivedState,
} from "@/lib/cache/types";

interface PageInfoLike {
  id?: string;
  version?: number;
  url?: string;
  language?: string;
}

interface SiteInfoLike {
  id?: string;
  name?: string;
  language?: string;
}

const FRESH: PageDerivedState = {
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
};

/**
 * The Marketplace `client.query(...)` resolves to a wrapper whose `.data` is
 * the underlying hey-api/client-fetch result: `{ data?: TData, request, response }`.
 * Net effect: the actual payload sits at `value.data.data` (double-unwrap).
 * The previous single-unwrap was a misread of the SDK type — verified by the
 * 2026-04-27 real-tenant diagnostic logs, where `value.data` was the hey-api
 * envelope, not the payload.
 */
type SdkResult<TData> = {
  data?: { data?: TData } | TData;
};

function readData<TData>(value: unknown): TData | undefined {
  const outer = (value as SdkResult<TData> | undefined)?.data;
  if (outer && typeof outer === "object" && "data" in (outer as object)) {
    return (outer as { data?: TData }).data;
  }
  return outer as TData | undefined;
}

/**
 * Pick a hostname from `Sites.Host[]`. Prefers `targetHostname` (the canonical
 * delivery hostname per the SDK examples), falls back to the first entry of
 * `hostnames[]`, then to the first non-empty hostname across the whole array.
 * Returns `{ error }` only when nothing usable is found.
 *
 * IMPORTANT — backend setup requirement:
 *   `targetHostname` must be set on the Site's host record in XM Cloud
 *   (Sites → <site> → Hosts → Target hostname) so that this function returns
 *   the real public delivery hostname. If it's left blank, `xmc.sites.listHosts`
 *   may return a placeholder hostname (e.g. `example.com` from the OpenAPI
 *   sample), which produces a Live URL that does NOT point at the real site.
 *   The Sitecore admin owns this — QuickCopy reads, it does not write.
 */
function pickLiveHost(hosts: Sites.Host[]): string | { error: Error } {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return { error: new Error("no live host") };
  }
  for (const h of hosts) {
    const target = h?.targetHostname?.trim();
    if (target) return `https://${target}`;
  }
  for (const h of hosts) {
    const first = h?.hostnames?.find((n) => typeof n === "string" && n.trim().length > 0);
    if (first) return `https://${first.trim()}`;
  }
  return { error: new Error("no live host") };
}

function composeLiveUrl(
  publishing: CacheValue<{ isPublished: boolean }>,
  liveHost: CacheValue<string>,
  slug: string | null | undefined,
): string | null {
  if (
    publishing &&
    typeof publishing === "object" &&
    "isPublished" in publishing &&
    publishing.isPublished &&
    typeof liveHost === "string"
  ) {
    try {
      const path = slug && slug.length > 0 ? slug : "/";
      return new URL(path, liveHost).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fire all three queries in parallel and write the resolved slot.
 * Idempotent — callers should `getEntry(key)` first and bail on cache hit.
 */
export async function prefetchPageUrls(
  client: ClientSDK,
  contextId: string,
  pageInfo: PageInfoLike,
  siteInfo: SiteInfoLike,
): Promise<void> {
  const pageId = pageInfo.id;
  if (!pageId) {
    return;
  }
  const key = buildCacheKey(pageId, pageInfo.version);

  // Seed the slot eagerly so consumers see a "pending" state instead of
  // `undefined` while the queries are in flight.
  setEntry(key, { ...FRESH });

  const previewParams = {
    params: {
      path: { pageId },
      query: { sitecoreContextId: contextId },
    },
  };
  const pageParams = {
    params: {
      path: { pageId },
      query: {
        site: siteInfo.name,
        language: pageInfo.language ?? siteInfo.language ?? "en",
        sitecoreContextId: contextId,
      },
    },
  };
  const hostsParams = {
    params: {
      path: { siteId: siteInfo.id },
      query: { sitecoreContextId: contextId },
    },
  };

  // DIAG-2026-04-27: REMOVE after fix — L5 (request configs going to SDK).
  if (process.env.NODE_ENV !== "production") {
    console.log("[qc:preview] L5 request", {
      key,
      preview: previewParams,
      page: pageParams,
      hosts: hostsParams,
    });
  }

  const [previewRes, pageRes, hostsRes] = await Promise.allSettled([
    client.query("xmc.agent.pagesGetPagePreviewUrl", previewParams as never),
    client.query("xmc.pages.retrievePage", pageParams as never),
    client.query("xmc.sites.listHosts", hostsParams as never),
  ]);

  // DIAG-2026-04-27: REMOVE after fix — L6 (raw envelopes / rejection reasons).
  if (process.env.NODE_ENV !== "production") {
    console.log("[qc:preview] L6 settled", {
      preview:
        previewRes.status === "fulfilled"
          ? { status: "fulfilled", value: previewRes.value }
          : { status: "rejected", reason: previewRes.reason },
      page:
        pageRes.status === "fulfilled"
          ? { status: "fulfilled", value: pageRes.value }
          : { status: "rejected", reason: pageRes.reason },
      hosts:
        hostsRes.status === "fulfilled"
          ? { status: "fulfilled", value: hostsRes.value }
          : { status: "rejected", reason: hostsRes.reason },
    });
  }

  // --- Preview URL ---
  let previewUrl: CacheValue<string>;
  if (previewRes.status === "fulfilled") {
    const payload = readData<Agent.GetPagePreviewUrlResponse>(previewRes.value);
    const url = payload?.previewUrl;
    // DIAG-2026-04-27: REMOVE after fix — L7 (extracted preview payload).
    if (process.env.NODE_ENV !== "production") {
      console.log("[qc:preview] L7 extracted", {
        payload,
        urlType: typeof url,
        urlLength: typeof url === "string" ? url.length : null,
      });
    }
    previewUrl =
      typeof url === "string" && url.length > 0
        ? url
        : { error: new Error("preview-url empty") };
  } else {
    previewUrl =
      previewRes.reason instanceof Error
        ? { error: previewRes.reason }
        : { error: new Error(String(previewRes.reason)) };
  }

  // --- Publishing flags + live URL slug source ---
  let publishing: CacheValue<{ isPublished: boolean }>;
  let liveSlug: string | null = null;
  if (pageRes.status === "fulfilled") {
    const page = readData<Pages.Page>(pageRes.value);
    const flags = page?.publishing;
    const isPublished =
      !!flags?.hasPublishableVersion && !!flags?.isPublishable;
    publishing = { isPublished };
    // Prefer the path returned by retrievePage (canonical, e.g. "/about");
    // fall back to whatever pages.context surfaced as the page URL slug.
    liveSlug = page?.url ?? pageInfo.url ?? null;
  } else {
    publishing =
      pageRes.reason instanceof Error
        ? { error: pageRes.reason }
        : { error: new Error(String(pageRes.reason)) };
  }

  // --- Live host ---
  let liveHost: CacheValue<string>;
  if (hostsRes.status === "fulfilled") {
    const hosts = readData<Sites.Host[]>(hostsRes.value);
    liveHost = pickLiveHost(hosts ?? []);
  } else {
    liveHost =
      hostsRes.reason instanceof Error
        ? { error: hostsRes.reason }
        : { error: new Error(String(hostsRes.reason)) };
  }

  // --- Compose liveUrl eagerly ---
  const liveUrl = composeLiveUrl(publishing, liveHost, liveSlug);

  // Per ADR-0007 the cache is keyed by id+version so concurrent navigation
  // is safe — just write the final resolved state.
  const finalState = { previewUrl, publishing, liveHost, liveUrl };
  // DIAG-2026-04-27: REMOVE after fix — L8 (final cache write the cards see).
  if (process.env.NODE_ENV !== "production") {
    console.log("[qc:preview] L8 setEntry", { key, state: finalState });
  }
  setEntry(key, finalState);
}
