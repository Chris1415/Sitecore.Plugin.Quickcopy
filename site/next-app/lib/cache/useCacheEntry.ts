"use client";

/**
 * `useCacheEntry()` — read the current `PageDerivedState` for the active
 * `pages.context`. Subscribes to the Provider's `pages.context` value via
 * `usePagesContext()` and re-derives the cache key (`${id}:${version}`)
 * whenever the page identity changes.
 *
 * This is a thin synchronous read of the module-level cache (no fetch on
 * click — ADR-0006). Returns `undefined` when the page context hasn't
 * resolved yet, or the cache slot is missing.
 *
 * The cache writes happen inside the Provider's pre-fetch effect (T014b)
 * and inside the action cards' clipboard-failure handlers (T018b–T021b).
 * Because the cache module is a singleton `Map`, this hook would not
 * automatically re-render when a slot mutates — to keep tests deterministic,
 * the cards subscribe to a tiny version-bump signal exposed alongside the
 * `Map` (`getCacheVersion` / `bumpCacheVersion`). For Phase 2 we keep it
 * simple: cards re-derive on each render and use a ref+effect to refresh
 * after their own mutations.
 */

import { useMemo } from "react";

import { getEntry } from "@/lib/cache/store";
import { buildCacheKey, type PageDerivedState } from "@/lib/cache/types";
import { usePagesContext } from "@/components/providers/marketplace";

export interface UseCacheEntryResult {
  key: string | null;
  state: PageDerivedState | undefined;
}

export function useCacheEntry(): UseCacheEntryResult {
  const ctx = usePagesContext();
  const id = ctx?.pageInfo?.id;
  const version = ctx?.pageInfo?.version;
  return useMemo(() => {
    if (!id) return { key: null, state: undefined };
    const key = buildCacheKey(id, version);
    return { key, state: getEntry(key) };
  }, [id, version]);
}
