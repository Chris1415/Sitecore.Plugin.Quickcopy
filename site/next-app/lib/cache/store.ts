/**
 * T012b — Module-singleton in-memory cache `Map<CacheKey, PageDerivedState>`.
 *
 * Source of truth: ADR-0006 / ADR-0007. No TTL, no eviction. The cache is
 * cleared exactly once on `<MarketplaceProvider>` unmount via `clearAll()`
 * (T015).
 *
 * Pure module — no React imports. Safe to call from server-side code paths
 * (the underlying `Map` initialises eagerly at module load).
 *
 * `subscribe(listener)` exposes a tiny pub-sub so React consumers can
 * re-render when a slot mutates. `useCacheEntry` wires this into
 * `useSyncExternalStore`. Every mutation (`setEntry` / `patchEntry` /
 * `clearAll`) bumps a monotonic version counter and notifies listeners.
 */

import type { CacheKey, PageDerivedState } from "./types";

const cache = new Map<CacheKey, PageDerivedState>();

const FRESH: PageDerivedState = Object.freeze({
  previewUrl: null,
  publishing: null,
  liveHost: null,
  liveUrl: null,
});

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const l of listeners) l();
}

/**
 * Subscribe to cache mutations. Returns an unsubscribe handle. The listener
 * fires after every `setEntry` / `patchEntry` / `clearAll` — a single
 * notification per operation, regardless of slot count.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Monotonic version counter. Incremented on every mutation. Stable across
 * renders that did not see a mutation, so `useSyncExternalStore`'s identity
 * check yields a no-op re-render only when something actually changed.
 */
export function getVersion(): number {
  return version;
}

export function getEntry(key: CacheKey): PageDerivedState | undefined {
  return cache.get(key);
}

export function setEntry(key: CacheKey, state: PageDerivedState): void {
  cache.set(key, state);
  notify();
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
  notify();
}

export function clearAll(): void {
  cache.clear();
  notify();
}
