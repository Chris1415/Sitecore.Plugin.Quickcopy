"use client";

/**
 * `useCacheEntry()` — read the current `PageDerivedState` for the active
 * `pages.context`. Subscribes to the Provider's `pages.context` value via
 * `usePagesContext()` AND to the cache module's mutation pub-sub (via
 * `useSyncExternalStore`) so that consumers re-render when the prefetch
 * orchestrator writes a resolved slot — even if `pageInfo` hasn't changed.
 *
 * This is a synchronous read of the module-level cache (no fetch on click —
 * ADR-0006). Returns `{ key: null, state: undefined }` when the page context
 * hasn't resolved yet; `{ key, state: undefined }` when the slot is missing.
 *
 * The cache writes happen inside the Provider's pre-fetch effect (T014b)
 * and inside the action cards' clipboard-failure handlers (T018b–T021b).
 * The cache module exposes `subscribe(listener)` + `getVersion()` to drive
 * deterministic re-renders without leaking React imports into the cache
 * itself.
 */

import { useSyncExternalStore } from "react";

import { getEntry, getVersion, subscribe } from "@/lib/cache/store";
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

  // Subscribe to cache-mutation notifications. The version counter is the
  // snapshot — `useSyncExternalStore` re-renders whenever it changes, which
  // happens on every `setEntry` / `patchEntry` / `clearAll`. Server snapshot
  // is `0` so SSR doesn't crash.
  useSyncExternalStore(subscribe, getVersion, () => 0);

  if (!id) return { key: null, state: undefined };
  const key = buildCacheKey(id, version);
  return { key, state: getEntry(key) };
}
