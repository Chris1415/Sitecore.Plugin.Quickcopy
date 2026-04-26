"use client";

/**
 * T025b — `<ShareLinkSplit>` — Share Link split-button.
 *
 * Source of truth: ADR-0010 + FR-005 + § 4c-4 + § 4c-6 + § 4c-8 + § 10 (T025).
 *
 * Composition:
 *  - `role="group" aria-label="Share link"` wraps two adjacent buttons.
 *  - Primary "Share Link" button — copies the default Markdown shape.
 *  - Caret button with `aria-haspopup="menu"` + `aria-expanded` — opens
 *    a `role="menu"` with two `role="menuitem"` entries:
 *      1. "Copy as Markdown"   → `[<title>](<url>)`
 *      2. "Copy as Plain text" → `<title> <U+2014> <url>`
 *  - On menu open: focus first menu item.
 *  - Escape closes the menu AND restores focus to the caret.
 *  - Outside click closes the menu (no focus restoration).
 *
 * State sync:
 *  - "Page not live — link points to preview" tooltip when liveUrl is null
 *    AND previewUrl resolved (per US-005).
 *  - Persistent error per ADR-0009 when both URLs unrecoverable —
 *    `aria-disabled="true"` on BOTH primary AND caret; clicks are no-ops.
 *
 * Morph:
 *  - Successful copy → "Copied" label for 1500ms (FR-008). The strip-shaped
 *    morph (no rotation, scale 1.02) per UI § 5e is implemented as a
 *    transient label swap; further visual polish lives behind a CSS class.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { copyTextToClipboard } from "@/lib/clipboard";
import { useCacheEntry } from "@/lib/cache/useCacheEntry";
import { usePagesContext } from "@/components/providers/marketplace";
import { cn } from "@/lib/utils";
import { useStatusAnnouncer } from "./StatusLiveRegion";
import { STRINGS } from "@/lib/i18n/strings";

import {
  shareLinkMarkdown,
  shareLinkPlainText,
} from "@/lib/share-link/formats";
import { getShareLinkUrl } from "@/lib/share-link/select-url";

const TOOLTIP_PREVIEW_FALLBACK = "Page not live — link points to preview";
const TOOLTIP_ERROR =
  "Couldn't compose Share Link — try switching pages or reloading.";

const COPIED_MS = 1500;

type Mode = "idle" | "copied" | "error";

function resolveTitle(
  displayName: string | undefined | null,
  name: string | undefined | null,
): string {
  const dn = typeof displayName === "string" ? displayName.trim() : "";
  if (dn.length > 0) return dn;
  const n = typeof name === "string" ? name.trim() : "";
  return n;
}

export function ShareLinkSplit() {
  const ctx = usePagesContext();
  const title = useMemo(
    () => resolveTitle(ctx?.pageInfo?.displayName, ctx?.pageInfo?.name),
    [ctx?.pageInfo?.displayName, ctx?.pageInfo?.name],
  );
  const { key: cacheKey, state } = useCacheEntry();
  const { announce } = useStatusAnnouncer();

  const selection = useMemo(() => {
    const fallback = state ?? {
      previewUrl: null,
      publishing: null,
      liveHost: null,
      liveUrl: null,
    };
    return getShareLinkUrl(fallback);
  }, [state]);

  const url = selection.url;
  const isError = selection.isError;
  const isPreviewFallback = selection.isPreviewFallback;
  const isLoading = !isError && !url;

  // Local UI state (morph + sticky-error keyed by cache key).
  const [mode, setMode] = useState<Mode>("idle");
  const morphTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorKeyRef = useRef<string | null>(null);

  // Reset local sticky error if cache key flips.
  useEffect(() => {
    if (errorKeyRef.current && errorKeyRef.current !== cacheKey) {
      errorKeyRef.current = null;
      setMode("idle");
    }
  }, [cacheKey]);

  // Cleanup morph timer on unmount.
  useEffect(() => {
    return () => {
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    };
  }, []);

  // Effective disabled: cache-derived error OR clipboard sticky error OR loading.
  const effectiveError = isError || mode === "error";
  const effectiveDisabled = effectiveError || isLoading;

  const tipId = useId();
  const tooltipText: string | undefined = effectiveError
    ? TOOLTIP_ERROR
    : isPreviewFallback
      ? TOOLTIP_PREVIEW_FALLBACK
      : undefined;

  // ----- Menu state -----
  const [open, setOpen] = useState(false);
  const caretRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  // Focus first menu item once it mounts (after `open` flips true).
  useEffect(() => {
    if (open) {
      // schedule one tick so React has committed the menu DOM
      Promise.resolve().then(() => {
        firstItemRef.current?.focus();
      });
    }
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if (caretRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const doCopy = useCallback(
    async (kind: "md" | "plain") => {
      if (effectiveDisabled || !url) return;
      const text =
        kind === "md"
          ? shareLinkMarkdown(title, url)
          : shareLinkPlainText(title, url);
      try {
        await copyTextToClipboard(text);
        setMode("copied");
        if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
        morphTimerRef.current = setTimeout(() => {
          setMode("idle");
          morphTimerRef.current = null;
        }, COPIED_MS);
        // SUCCESS-only announcement per ADR-0009 (errors are visual-only).
        announce(STRINGS.announcements.shareLinkCopied);
      } catch {
        errorKeyRef.current = cacheKey;
        setMode("error");
      }
    },
    [effectiveDisabled, url, title, cacheKey, announce],
  );

  const onPrimaryClick = useCallback(() => {
    if (effectiveDisabled) return;
    void doCopy("md");
  }, [effectiveDisabled, doCopy]);

  const onCaretClick = useCallback(() => {
    if (effectiveDisabled) return;
    setOpen((v) => !v);
  }, [effectiveDisabled]);

  const onMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      caretRef.current?.focus();
    }
  }, []);

  const onMenuItemClick = useCallback(
    (kind: "md" | "plain") => {
      setOpen(false);
      void doCopy(kind);
    },
    [doCopy],
  );

  const primaryLabel = mode === "copied" ? "Copied" : "Share Link";
  // aria-label is stable across the `copied` morph window so the panel-level
  // `Alt+S` shortcut (which dispatches a synthetic click via aria-label
  // substring match) keeps working even while the visible label flips to
  // "Copied" for the 1500ms hold. Mirrors the ActionCard pattern, which
  // never re-renders its aria-label.
  const primaryAriaLabel = "Copy Share Link as Markdown — shortcut Alt+S";

  return (
    <div
      role="group"
      aria-label="Share link"
      data-quickcopy="share-link-split"
      className={cn(
        "relative mx-2 mt-3 flex overflow-hidden rounded-lg",
        "bg-primary text-primary-foreground",
        mode === "copied" && "shadow-[inset_0_0_0_2px_hsl(var(--primary-foreground)/0.4)]",
      )}
    >
      <button
        type="button"
        data-quickcopy="share-link-primary"
        aria-label={primaryAriaLabel}
        aria-disabled={effectiveDisabled || undefined}
        aria-describedby={tooltipText ? tipId : undefined}
        onClick={onPrimaryClick}
        className={cn(
          "flex flex-1 items-center gap-2 border-0 bg-transparent px-3 py-2.5",
          "font-sans text-[13px] font-semibold text-primary-foreground",
          "outline-none focus-visible:outline-2 focus-visible:outline-primary-foreground focus-visible:[outline-offset:-2px]",
          "hover:bg-[hsl(var(--primary-foreground)/0.08)]",
          effectiveDisabled && "cursor-not-allowed opacity-70",
        )}
      >
        <span aria-hidden="true" className="font-mono text-[16px] leading-none">
          ↑
        </span>
        <span className="flex-1 text-center">{primaryLabel}</span>
        <span
          aria-hidden="true"
          className="rounded border border-[hsl(var(--primary-foreground)/0.3)] bg-[hsl(var(--primary-foreground)/0.18)] px-[5px] py-[3px] font-mono text-[10px] font-medium leading-none text-primary-foreground"
        >
          S
        </span>
      </button>

      <button
        type="button"
        ref={caretRef}
        aria-label="Choose share-link format"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        aria-disabled={effectiveDisabled || undefined}
        onClick={onCaretClick}
        className={cn(
          "w-9 border-0 border-l border-[hsl(var(--primary-foreground)/0.25)] bg-transparent",
          "font-mono text-[14px] text-primary-foreground",
          "outline-none focus-visible:outline-2 focus-visible:outline-primary-foreground focus-visible:[outline-offset:-2px]",
          "hover:bg-[hsl(var(--primary-foreground)/0.08)]",
          effectiveDisabled && "cursor-not-allowed opacity-70",
        )}
      >
        <span aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Share-link formats"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute right-0 top-full z-20 mt-1 min-w-[180px]",
            "rounded-md border border-border bg-background p-1 text-foreground",
            "shadow-[0_16px_36px_-12px_hsl(var(--primary)/0.35)]",
          )}
        >
          <button
            type="button"
            role="menuitem"
            ref={firstItemRef}
            onClick={() => onMenuItemClick("md")}
            className="block w-full rounded px-2.5 py-2 text-left font-sans text-[12px] font-medium text-foreground hover:bg-muted focus:bg-muted focus:outline-none"
          >
            Copy as Markdown
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => onMenuItemClick("plain")}
            className="block w-full rounded px-2.5 py-2 text-left font-sans text-[12px] font-medium text-foreground hover:bg-muted focus:bg-muted focus:outline-none"
          >
            Copy as Plain text
          </button>
        </div>
      ) : null}

      {tooltipText ? (
        <span id={tipId} role="tooltip" className="sr-only">
          {tooltipText}
        </span>
      ) : null}
    </div>
  );
}
