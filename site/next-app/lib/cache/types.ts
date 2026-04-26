/**
 * T011b — Cache key + state types.
 *
 * Source of truth: ADR-0006 (parallel pre-fetch) + ADR-0007 (version-keyed
 * cache, no TTL, no manual refresh) + § 4c-6 (cache key composition).
 */

/** `${pageId}:${version ?? 'noversion'}` */
export type CacheKey = string;

/**
 * Three-state per slot:
 * - `T`        → resolved value
 * - `null`     → pending (pre-fetch in flight, or never started)
 * - `{ error }`→ sticky error per ADR-0009 (cleared only on cache-key change)
 */
export type CacheValue<T> = T | null | { error: Error };

export interface PageDerivedState {
  previewUrl: CacheValue<string>;
  publishing: CacheValue<{ isPublished: boolean }>;
  liveHost: CacheValue<string>;
  /**
   * Composed eagerly via `new URL(slug, host)` when `publishing.isPublished`
   * is true AND `liveHost` is a string. Stays `null` otherwise.
   */
  liveUrl: string | null;
}

/**
 * Compose the cache key. Version `0` is a real version — only `undefined`
 * becomes `'noversion'`.
 */
export const buildCacheKey = (
  pageId: string,
  version: number | undefined,
): CacheKey => `${pageId}:${version ?? "noversion"}`;
