/**
 * T032 — User-visible string contracts.
 *
 * Source of truth: § 4c-8 (test-pinned strings) + ADR-0009 + ADR-0010 +
 * NFR-009 (localization readiness — strings isolated in a single module).
 *
 * Every string surfaced to the user lives here. Phase 2 cards inline these
 * literals as private constants for self-containment; Phase 3 introduces this
 * module as the canonical reference and Phase 4's `<StatusLiveRegion>` reads
 * `STRINGS.announcements.*` directly. New components MUST import from here
 * instead of redeclaring the strings.
 *
 * Em-dash glyph in tooltips is U+2014 (NOT en-dash, NOT hyphen-minus). The
 * Plain-text Share Link format also uses U+2014 with a single space either
 * side per FR-005 — see `lib/share-link/formats.ts`.
 *
 * Per ADR-0009, error states are visual-only — `STRINGS.announcements` only
 * contains SUCCESS messages. There is intentionally no `error` namespace
 * inside `announcements`.
 */

export const STRINGS = {
  liveUrl: {
    label: "Live URL",
    /** Disabled — `publishing.isPublished===false`. */
    disabledUnpublished: "Not published to Edge yet — publish the page first.",
    /** Persistent error per ADR-0009. */
    errorTooltip: "Couldn't fetch Live URL — try switching pages or reloading.",
  },
  previewUrl: {
    label: "Preview URL",
    /** Persistent error per ADR-0009. */
    errorTooltip: "Couldn't fetch Preview URL — try switching pages or reloading.",
  },
  itemId: {
    label: "Item ID",
    /** Disabled — `pageInfo.id` missing/empty. */
    disabledNoContext: "Page context not ready — wait or reload.",
    /** Persistent error per ADR-0009 (clipboard failure only). */
    errorTooltip: "Couldn't copy Item ID — try switching pages or reloading.",
  },
  pageTitle: {
    label: "Page Title",
    /** Disabled — both `displayName` and `name` missing/empty. */
    disabledNoContext: "Page context not ready — wait or reload.",
    /** Persistent error per ADR-0009 (clipboard failure only). */
    errorTooltip: "Couldn't copy Page Title — try switching pages or reloading.",
  },
  shareLink: {
    label: "Share Link",
    /** US-005 — unpublished page, preview healthy → URL falls back to preview. */
    tooltipPreviewFallback: "Page not live — link points to preview",
    /** Persistent error per ADR-0009. */
    errorTooltip: "Couldn't compose Share Link — try switching pages or reloading.",
  },
  common: {
    /** FR-008 — visible morph label for the 1500ms hold. */
    copied: "Copied",
    /** FR-013 — transient placeholder while pre-fetch resolves. */
    loading: "Loading…",
  },
  /**
   * Aria-live announcements — SUCCESS only per ADR-0009. Read by
   * `<StatusLiveRegion>` (T034). The announcer is wired in Phase 4; the
   * strings are pinned now so the test suite can reference them.
   */
  announcements: {
    liveUrlCopied: "Live URL copied",
    previewUrlCopied: "Preview URL copied",
    itemIdCopied: "Item ID copied",
    pageTitleCopied: "Page Title copied",
    shareLinkCopied: "Share Link copied",
  },
} as const;

export type Strings = typeof STRINGS;
