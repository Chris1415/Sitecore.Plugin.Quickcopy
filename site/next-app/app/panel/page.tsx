"use client";

/**
 * `/panel` route — Cloud Portal `xmc:pages:contextpanel` extension point.
 *
 * Phase 3 composition: panel header (wordmark + theme toggle), action grid,
 * Share Link split-button, shortcut legend, and the shortcut listener wired
 * via a tiny child component so the listener mounts INSIDE the
 * `<MarketplaceProvider>` tree (set up by `app/layout.tsx`) and can therefore
 * see the cache + click handlers via DOM dispatch.
 *
 * Per ADR-0008 + § 4c-1: ONE window-level keydown listener. The shortcut
 * handler dispatches a synthetic `click` to the existing card / share-link
 * primary button using each control's accessibility name. We deliberately
 * avoid coupling the shortcut layer to the cache module — the cards already
 * own their own enabled / disabled / error logic, so `click()` is the
 * minimal-coupling activation primitive. `Alt+S` clicks the primary share
 * button (Markdown default per ADR-0010) — never the caret.
 *
 * Phase 4 (T034) wires `<StatusLiveRegion>` at the panel root. Each card and
 * the share-link split-button call `useStatusAnnouncer().announce(...)` on
 * SUCCESSFUL copy only — errors are visual-only per ADR-0009.
 */

import { ActionGrid } from "@/components/quickcopy/ActionGrid";
import { ShareLinkSplit } from "@/components/quickcopy/ShareLinkSplit";
import { ShortcutLegend } from "@/components/quickcopy/ShortcutLegend";
import { StatusLiveRegion } from "@/components/quickcopy/StatusLiveRegion";
import { ThemeToggle } from "@/components/quickcopy/ThemeToggle";
import { useShortcuts, type ShortcutHandlers } from "@/hooks/useShortcuts";

/**
 * Click an accessible button in the panel by its aria-label suffix. We
 * search inside `[data-quickcopy="panel"]` so a stray button outside the
 * panel (in the SDK loading region for example) cannot intercept.
 */
function clickShortcutTarget(suffix: string): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector('[data-quickcopy="panel"]');
  if (!root) return;
  const target = root.querySelector(
    `button[aria-label*="${suffix}"]:not([aria-disabled="true"])`,
  );
  if (target instanceof HTMLElement) target.click();
}

/**
 * Mounts `useShortcuts` inside the panel tree. Kept as a separate component
 * so the parent stays a pure layout shell — easier to read AND easier to
 * exclude from future tests that don't want the listener attached.
 */
function ShortcutsBinding() {
  const handlers: ShortcutHandlers = {
    live: () => clickShortcutTarget("shortcut Alt+L"),
    preview: () => clickShortcutTarget("shortcut Alt+P"),
    item: () => clickShortcutTarget("shortcut Alt+I"),
    title: () => clickShortcutTarget("shortcut Alt+T"),
    share: () => clickShortcutTarget("shortcut Alt+S"),
  };
  useShortcuts(handlers);
  return null;
}

export default function QuickCopyPanelRoute() {
  return (
    <main
      data-quickcopy="panel"
      className="relative mx-auto flex w-[320px] flex-col bg-background px-3 py-3 text-foreground"
    >
      <header className="flex items-center justify-between">
        <span
          aria-label="QuickCopy"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/85"
        >
          QUICKCOPY
        </span>
        <ThemeToggle />
      </header>

      <div className="mt-3">
        <ActionGrid />
      </div>

      <ShareLinkSplit />

      <ShortcutLegend />

      <ShortcutsBinding />

      <StatusLiveRegion />
    </main>
  );
}
