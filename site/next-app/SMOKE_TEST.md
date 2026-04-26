# QuickCopy — real-portal smoke test

Manual checklist for verifying QuickCopy in a live Sitecore Cloud tenant
after the app is registered (see `PORTAL_REGISTRATION.md`). The whole
checklist is runnable by a marketer in one sitting (~15 minutes).

Run this **before** declaring v0.1 ship-ready. Every item must pass.

## Pre-flight

- [ ] App registered in Sitecore Cloud Portal per `PORTAL_REGISTRATION.md`.
- [ ] App installed into the dogfood XM Cloud environment / tenant.
- [ ] Dev server running locally (`npm run dev`) **OR** a deployed build
      reachable at the Production URL on file.
- [ ] You have access to **two pages** in that tenant: one published
      (live), one unpublished (no live URL yet).

## 1. Panel renders

- [ ] Open the Pages editor and navigate to **any** page in the tenant.
- [ ] The right-side context panel shows the QuickCopy header
      ("QUICKCOPY" wordmark on the left, theme toggle on the right).
- [ ] The 2x2 action grid shows Live URL, Preview URL, Item ID, Page
      Title cards.
- [ ] The Share Link split-button strip sits below the grid.
- [ ] The shortcut legend (`L / P / I / T / S` chips) sits at the bottom.

## 2. Five buttons copy correctly — published page

Open a **published** page. For each button:

- [ ] **Live URL** — click → clipboard contains the composed live URL
      (e.g. `https://www.example.com/products/spring`). Card flashes
      "Copied" for ~1.5s.
- [ ] **Preview URL** — click → clipboard contains the Agent API preview
      URL (NOT `pageInfo.url`). The URL typically includes a
      `?sc_mode=preview` query.
- [ ] **Item ID** — click → clipboard contains the bare GUID, **no
      wrapping `{}` braces**, **no whitespace** padding.
- [ ] **Page Title** — click → clipboard contains the page's display
      name (or `pageInfo.name` if `displayName` is empty).
- [ ] **Share Link primary** — click → clipboard contains
      `[<Page Title>](<Live URL>)` (Markdown — default per ADR-0010).

## 3. Disabled state — unpublished page

Open the **unpublished** page.

- [ ] **Live URL** card is visibly disabled (hatched overlay, dimmed).
- [ ] Hovering or focusing the Live URL card shows the tooltip:
      *"Not published to Edge yet — publish the page first."*
- [ ] Clicking it does nothing (no clipboard write, no error flash).
- [ ] Preview URL, Item ID, Page Title still work.
- [ ] Share Link strip shows the *"Page not live — link points to
      preview"* hint and copies a Markdown link pointing at the preview
      URL (not a broken link).

## 4. Persistent error state — no auto-retry

- [ ] Open Chrome DevTools → Network tab. Right-click → **Block request
      domain** for the Agent API host **OR** temporarily revoke the
      app's API access in the Cloud Portal.
- [ ] Reload the panel (or navigate to a different page so the cache key
      changes).
- [ ] Confirm Live URL card enters the persistent error state: red
      accent, ❌ glyph, "Failed" label, tooltip:
      *"Couldn't fetch Live URL — try switching pages or reloading."*
- [ ] Click the errored card several times — **nothing** happens. No
      retry, no toast, no console spam beyond a single `[quickcopy]`
      log line per failure.
- [ ] Restore network access. Click the same card — still no-op (sticky
      per ADR-0009). Navigate to a **different page** OR reload — error
      clears automatically.

## 5. Theme toggle + persistence

- [ ] Click the theme pill in the header. Panel flips dark ↔ light;
      every card, the Share Link strip, the legend, and the wordmark
      flip cleanly with no half-rendered colours.
- [ ] Close the panel (navigate to a different XM Cloud area, or
      reload the Pages editor entirely).
- [ ] Re-open the panel — the previously selected theme is restored
      (persisted in iframe-scoped `localStorage` under `quickcopy.theme`).

## 6. Keyboard shortcuts — five plus dropdown

With focus inside the panel iframe (click anywhere on the panel first):

- [ ] **Alt+L** → copies the Live URL (or no-ops if disabled).
- [ ] **Alt+P** → copies the Preview URL.
- [ ] **Alt+I** → copies the Item ID.
- [ ] **Alt+T** → copies the Page Title.
- [ ] **Alt+S** → copies the **Markdown** Share Link (default per
      ADR-0010). The dropdown does **not** open.
- [ ] None of the five shortcuts trigger any side effect in the
      surrounding Pages editor (no item save, no navigation, no panel
      collapse).
- [ ] Click in any text input *inside* the Pages editor (outside the
      iframe). Press `Alt+L`. QuickCopy must NOT fire (iframe-scoped
      listener — confirms the suppression boundary).

## 7. Share Link dropdown — Markdown + Plain text

- [ ] Click the small caret on the right side of the Share Link strip.
      A two-item menu opens: "Copy as Markdown", "Copy as Plain text".
- [ ] First menu item is auto-focused.
- [ ] Press `Esc` → menu closes, focus returns to the caret.
- [ ] Re-open the menu. Click "Copy as Markdown" → clipboard contains
      `[<Title>](<URL>)`. Menu closes.
- [ ] Re-open the menu. Click "Copy as Plain text" → clipboard contains
      `<Title> — <URL>` (em-dash U+2014, single space either side).
      Menu closes.

## 8. Console hygiene

- [ ] Open DevTools console. Walk through items 1–7 again at speed.
- [ ] Confirm: zero red errors, zero React warnings, zero hydration
      warnings. Acceptable: a single `[quickcopy][pages.context]` info
      line if `pages.context` rebroadcasts during the session, and a
      single `[quickcopy] <error>` line for any deliberately injected
      failure in step 4.

## 9. Browser matrix

- [ ] **Chrome (Windows)** — full pass on items 1–8.
- [ ] **Edge (Windows)** — full pass on items 1–8.
- [ ] **Safari (macOS)** — clipboard pattern at `lib/clipboard.ts`
      mirrors pageshot's. If any Safari-specific failure surfaces during
      smoke (typically permission-related), document the exact symptom
      here and file a v0.2 ticket — v0.1 ships if Chrome + Edge pass.
- [ ] **Firefox (any OS)** — same clipboard caveat. Document Firefox-
      specific tweaks here if any are needed.

## Sign-off

- [ ] Tester name + date: `_______________________ / __________`
- [ ] Build commit short-SHA tested: `_______________`
- [ ] All items above ticked → ship.

If any item failed, **do not loosen the contract** (don't add retry,
don't lengthen the morph, don't auto-clear errors, don't downgrade
tooltips). Open a bug against the specific task ID instead and re-run
the smoke after the fix.
