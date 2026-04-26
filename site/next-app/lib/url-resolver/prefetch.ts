"use client";

/**
 * T013b — Parallel pre-fetch orchestrator.
 *
 * Source of truth: ADR-0006 (parallel pre-fetch on pageInfo.id change) +
 * ADR-0007 (version-keyed cache, no TTL) + § 4c-6 (XMC SDK signatures).
 *
 * Issues three parallel queries via `Promise.allSettled`:
 *   - `xmc.agent.pagesGetPagePreviewUrl` → preview URL
 *   - `xmc.pages.retrievePage`           → publishing flags (live status proxy)
 *   - `xmc.sites.listHosts`              → delivery host list
 *
 * Composes `liveUrl` eagerly via `new URL(slug, host)` when both
 * `publishing.isPublished === true` AND `liveHost` is a string. Click handlers
 * are synchronous cache reads — no fetch on click.
 *
 * Failures are isolated per slot — a failing `listHosts` does NOT corrupt
 * `previewUrl`. Per ADR-0009 the failed slot stays `{ error }` until the cache
 * key changes (id or version bump).
 */

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

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

interface HostShape {
  kind?: string;
  hostName?: string;
}

const FRESH: PageDerivedState = {
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
};

function unwrap<T>(res: unknown): T | undefined {
  // XMC responses are double-wrapped: `{ data: { data: <T> } }` per
  // `client.md § 8b`. Tolerate single-wrap and missing-data shapes too.
  const r = res as { data?: { data?: T } | T } | undefined;
  if (!r) return undefined;
  const inner = (r as { data?: unknown }).data;
  if (
    inner &&
    typeof inner === "object" &&
    "data" in (inner as Record<string, unknown>)
  ) {
    return (inner as { data?: T }).data;
  }
  return inner as T | undefined;
}

function pickLiveHost(hosts: HostShape[]): string | { error: Error } {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return { error: new Error("no live host") };
  }
  const live = hosts.find((h) => h?.kind === "delivery") ?? hosts[0];
  if (!live?.hostName) {
    return { error: new Error("no live host") };
  }
  return `https://${live.hostName}`;
}

function composeLiveUrl(
  publishing: CacheValue<{ isPublished: boolean }>,
  liveHost: CacheValue<string>,
  slug: string | undefined,
): string | null {
  if (
    publishing &&
    typeof publishing === "object" &&
    "isPublished" in publishing &&
    publishing.isPublished &&
    typeof liveHost === "string"
  ) {
    try {
      return new URL(slug && slug.length > 0 ? slug : "/", liveHost).toString();
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

  const [previewRes, pageRes, hostsRes] = await Promise.allSettled([
    client.query("xmc.agent.pagesGetPagePreviewUrl", {
      params: {
        path: { pageId },
        query: { sitecoreContextId: contextId },
      },
    } as never),
    client.query("xmc.pages.retrievePage", {
      params: {
        path: { pageId },
        query: {
          site: siteInfo.name,
          language: pageInfo.language ?? siteInfo.language ?? "en",
          sitecoreContextId: contextId,
        },
      },
    } as never),
    client.query("xmc.sites.listHosts", {
      params: {
        path: { siteId: siteInfo.id },
        query: { sitecoreContextId: contextId },
      },
    } as never),
  ]);

  // --- Preview URL ---
  let previewUrl: CacheValue<string>;
  if (previewRes.status === "fulfilled") {
    const v = unwrap<string>(previewRes.value);
    previewUrl = typeof v === "string" ? v : { error: new Error("preview-url empty") };
  } else {
    previewUrl =
      previewRes.reason instanceof Error
        ? { error: previewRes.reason }
        : { error: new Error(String(previewRes.reason)) };
  }

  // --- Publishing flags ---
  let publishing: CacheValue<{ isPublished: boolean }>;
  if (pageRes.status === "fulfilled") {
    const page = unwrap<{
      publishing?: { hasPublishableVersion?: boolean; isPublishable?: boolean };
    }>(pageRes.value);
    const flags = page?.publishing;
    const isPublished =
      !!flags?.hasPublishableVersion && !!flags?.isPublishable;
    publishing = { isPublished };
  } else {
    publishing =
      pageRes.reason instanceof Error
        ? { error: pageRes.reason }
        : { error: new Error(String(pageRes.reason)) };
  }

  // --- Live host ---
  let liveHost: CacheValue<string>;
  if (hostsRes.status === "fulfilled") {
    const hosts = unwrap<HostShape[]>(hostsRes.value);
    const picked = pickLiveHost(hosts ?? []);
    liveHost = picked;
  } else {
    liveHost =
      hostsRes.reason instanceof Error
        ? { error: hostsRes.reason }
        : { error: new Error(String(hostsRes.reason)) };
  }

  // --- Compose liveUrl eagerly ---
  const liveUrl = composeLiveUrl(publishing, liveHost, pageInfo.url);

  // Per ADR-0007 the cache is keyed by id+version so concurrent navigation
  // is safe — just write the final resolved state.
  setEntry(key, { previewUrl, publishing, liveHost, liveUrl });
}
