/**
 * T010b — Typed `sitecoreContextId` helper.
 *
 * Source of truth: § 4c-1 ("No `as string` casts on SDK return values"),
 * § 4c-6 (sitecoreContextId capture), `client.md § 4`.
 *
 * Reads `ctx.resourceAccess[0].context.live` (the delivery context — what
 * QuickCopy reads), falling back to `.preview` only if `.live` is absent.
 * Throws if neither is present so consumers branch / surface an error
 * instead of letting `undefined` land in an XMC call's
 * `params.query.sitecoreContextId`.
 *
 * **No `as string` cast anywhere.** This is the single helper every XMC
 * call uses to obtain `sitecoreContextId`.
 */

import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";

export function requireContextId(ctx: ApplicationContext | null): string {
  if (!ctx) {
    throw new Error(
      "[quickcopy] Application context is unavailable; cannot resolve sitecoreContextId.",
    );
  }

  const resourceAccess = ctx.resourceAccess;
  const first = Array.isArray(resourceAccess) ? resourceAccess[0] : undefined;
  const context = first?.context;

  const live = context?.live;
  if (typeof live === "string" && live.length > 0) {
    return live;
  }

  const preview = context?.preview;
  if (typeof preview === "string" && preview.length > 0) {
    return preview;
  }

  throw new Error(
    "[quickcopy] Neither resourceAccess[0].context.live nor .preview is set; cannot resolve sitecoreContextId.",
  );
}
