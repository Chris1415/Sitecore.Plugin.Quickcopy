"use client";

/**
 * T016b — `copyTextToClipboard` — local copy of pageshot's clipboard pattern,
 * specialized for string payloads.
 *
 * Source of truth: ADR-0004 (local copy, no shared package, no edits to
 * pageshot) + § 4c-6 + reference at
 * `products/pageshot/site/next-app/components/use-copy-image.ts`.
 *
 * QuickCopy copies plain text (URLs, IDs, titles), not images, so we use
 * `navigator.clipboard.writeText(text)` directly instead of pageshot's
 * `ClipboardItem` + `write([item])` path. Errors propagate to the caller —
 * the action card maps the rejection into ADR-0009 persistent error state.
 */

/**
 * Copy `text` to the system clipboard via `navigator.clipboard.writeText`.
 *
 * - Throws `Error('clipboard-unavailable')` synchronously (as a rejected
 *   promise) when the API is missing — server-side rendering, locked-down
 *   contexts, very old browsers.
 * - Re-throws the original rejection (e.g. `DOMException('NotAllowedError')`)
 *   on failure so the caller can react with ADR-0009 persistent error.
 * - Empty strings are valid payloads (Markdown share link with empty title
 *   is still a well-formed string).
 * - No length-clamping. Browsers cap at their own discretion.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator?.clipboard?.writeText !== "function"
  ) {
    throw new Error("clipboard-unavailable");
  }
  await navigator.clipboard.writeText(text);
}
