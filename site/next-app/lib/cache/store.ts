/**
 * T012b — Module-singleton in-memory cache `Map<CacheKey, PageDerivedState>`.
 *
 * Source of truth: ADR-0006 / ADR-0007. No TTL, no eviction. The cache is
 * cleared exactly once on `<MarketplaceProvider>` unmount via `clearAll()`
 * (T015).
 *
 * Pure module — no React imports. Safe to call from server-side code paths
 * (the underlying `Map` initialises eagerly at module load).
 */

import type { CacheKey, PageDerivedState } from "./types";

const cache = new Map<CacheKey, PageDerivedState>();

const FRESH: PageDerivedState = Object.freeze({
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
});

export function getEntry(key: CacheKey): PageDerivedState | undefined {
  return cache.get(key);
}

export function setEntry(key: CacheKey, state: PageDerivedState): void {
  cache.set(key, state);
}

/**
 * Merge `partial` into the existing slot. If the key is missing, create a
 * new slot seeded from `FRESH` so partial writes are well-defined (pinned
 * by T012a's "missing-key patch" test).
 */
export function patchEntry(
  key: CacheKey,
  partial: Partial<PageDerivedState>,
): void {
  const existing = cache.get(key) ?? { ...FRESH };
  cache.set(key, { ...existing, ...partial });
}

export function clearAll(): void {
  cache.clear();
}
