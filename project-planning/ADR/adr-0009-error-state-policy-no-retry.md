# ADR-0009: Error-state policy — persistent per-button, no auto-retry, no backoff, no manual retry button

## Status

Accepted

## Context

PRD FR-007 specifies the error-state lifecycle in unusually firm language: "When an API call or clipboard write fails, the affected button enters a persistent error state… The state clears only when `pages.context.pageInfo.id` changes… There is no auto-retry, no backoff timer, no manual retry button in v0.1."

This is a deliberate architectural stance, not a default. The conventional pattern for a copy-button-with-API-call would be exponential backoff retry plus a "try again" button. QuickCopy explicitly rejects that pattern. The reasons are worth recording as an ADR because every implementer who joins the project will instinctively reach for retry, and the ADR is the contract that says "no, deliberately."

The reasoning chain:

1. **Honest by default (PRD § 3, Goal 3).** The product goal is "the app never hands the user a broken link." A retry-with-spinner pattern hides the failure: the user clicks, sees a spinner, eventually gets a result they may not have time to verify. A persistent error converts a silent partial failure into a visible "this is broken right now" surface that the user can act on (switch pages, reload, contact support).
2. **The failure modes are not transient in the way retry assumes.** The expected failure modes are: (a) Sitecore platform auth issue (bad/expired session), (b) Sitecore-side outage on the SDK postMessage bridge, (c) the requested page genuinely has no host registered (live URL impossible). None of these get better by retrying within seconds. If the user wants to retry, they navigate to another page and back, which clears the cache slot per ADR-0007 and triggers a fresh fetch.
3. **Retry adds load to the SDK bridge.** Backoff of 1s/2s/4s/… across five buttons across many panels in many tabs adds up to meaningful traffic against the postMessage bridge and the underlying XMC endpoints. With no retry, traffic is bounded by user navigation events.
4. **Retry buttons add UI surface.** A "try again" button changes per-button shape, complicates the disabled-state visual (currently one disabled style, with retry it becomes two — disabled-because-unpublished vs disabled-because-error-with-retry). Marketer-first scope (PRD § 4) wants fewer affordances, not more.
5. **The "navigate to another page and back" recovery path is fast.** It's what users naturally do when something looks broken. The cache key change (ADR-0007) clears the error and re-fetches.
6. **Clipboard failures (FR-009) are subject to the same policy.** A clipboard write that fails — typically because the Marketplace iframe sandbox blocks `navigator.clipboard.writeText` in a hardened browser — is not going to start working on retry within the same `pageInfo.id`. The user must change context (different page, panel reload, browser permission change). A retry button would be cargo-cult UX.

This decision interacts with three other ADRs:

- **ADR-0006** (parallel pre-fetch): a pre-fetch failure populates the cache slot with `Error`; the click handler reads `Error` and shows the persistent error state. No retry inside the click handler.
- **ADR-0007** (cache key = `pageInfo.id` + `pageInfo.version`): the error clears when the cache key changes. A version bump (e.g. user publishes the page from another tab) is a valid clear trigger; an id change (user navigates) is the canonical clear trigger.
- **ADR-0008** (keyboard shortcuts): pressing a shortcut on a button in error state is treated identically to clicking — i.e. nothing happens (the button is non-interactive). The shortcut listener checks the cached state and no-ops on `Error`.

## Decision

**Error state lifecycle:**

| Event | State change |
|-------|--------------|
| Pre-fetch for `(pageId, version)` fails | Cache slot for that button receives `Error`; button enters persistent error state |
| Clipboard write fails on a click | Button enters persistent error state for the current `(pageId, version)` cache slot |
| `pageInfo.id` changes | Pre-fetch fires for the new id; new state lives in a new cache slot. Old slot's error is left in place but is no longer rendered (the button now shows the new slot's state) |
| `pageInfo.version` changes (same id) | Same as id change — fresh cache slot, fresh pre-fetch, error implicitly cleared from the user's perspective |
| Panel unmounts and re-mounts | Cache cleared, all errors cleared, pre-fetch fires fresh for the current page |
| User clicks an error-state button | No-op. The button is non-interactive (per FR-007 wording "disabled for clicks"). Tooltip remains visible on hover |
| User presses the keyboard shortcut for an error-state button | No-op (same as click) |

**Visual contract per FR-007:**

- Red / error accent on the button, plus an `❌` icon (Blok IconButton variant — exact icon choice deferred to UI design).
- Tooltip text per error reason — see PRD US-001 / US-002 / US-003 / US-004 / US-005 wording. Tooltip is `aria-describedby` on the button (NFR-003).
- `aria-disabled="true"` on the button — distinct from `disabled` attribute, because we want the button focusable so screen readers can read the tooltip explanation. The keyboard listener's check-cache-state pattern handles the no-op.

**What this ADR explicitly excludes from v0.1:**

- No `setTimeout`-based retry.
- No exponential backoff.
- No "try again" button affordance.
- No global error banner.
- No `aria-live` announcement of errors (would be intrusive — five buttons each potentially erroring would create announcement spam).
- No telemetry of error rates (NFR-006: zero telemetry in v0.1).
- No SDK reconnection logic. If the postMessage bridge dies (`NOT_CONNECTED` per `marketplace-sdk/client.md § 8f`), the panel renders nothing meaningful. The user reloads. v0.2 may add reconnection.

**What error-state behavior implementers MUST preserve:**

- The other four buttons keep working. Item ID, Title, Theme switcher, and any non-erroring URL button stay functional (NFR-005).
- `console.error` logs the failure for developer debugging (PRD § 9 — "Log to `console.error` for developer debugging (removed in prod builds)"). Lead Developer's § 4c-3 specifies a `process.env.NODE_ENV` guard.

## Consequences

**Easier:**

- Implementation is small: each cache slot stores `value | null | Error`; the button reads the slot and renders one of three branches. No retry timer, no abort controller, no in-flight tracking.
- No subtle state machine. The button has exactly three states from the cache's perspective: pending (`null`), ready (`value`), errored (`Error`). The morph state ("Copied!" for 1500ms) is a fourth, orthogonal, transient state managed by the click handler.
- The persistent error is visible and actionable — the user knows immediately that something broke and that switching pages is the recovery action.
- Shortcut listeners and click handlers share one cache check; same code path.

**Harder:**

- A user who hits a transient outage (e.g. 5-second SDK bridge hiccup) has to either wait and switch pages or reload the panel. There is no "try again in 5 seconds" affordance. This is acceptable for a marketer-first XS app; it would be wrong for a critical-path content-management tool.
- Field reports of "the button broke and I had to reload" cannot be distinguished from "the button broke and stayed broken until I reloaded" without telemetry. v0.2 telemetry will close this gap.
- Implementers will instinctively want to add retry. The ADR is the back-stop. Code reviews must reject retry additions that don't carry an ADR amendment.

**Neutral:**

- The error-state policy is identical for API failures and clipboard failures — one mental model, not two. The tooltip wording differs (per the per-US copy in the PRD), but the lifecycle is the same.
- The "no manual retry button" rule resolves the ambiguity that would otherwise exist about where on the button the retry would live and what its visual treatment would be. By saying no, the design space collapses.

## Date

2026-04-25
