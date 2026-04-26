"use client";

/**
 * T027b — `useTheme` hook.
 *
 * Source of truth: § 4c-3 + § 4c-5 + FR-010 + ADR-0008.
 *
 * Replaces `next-themes` for the QuickCopy `/panel` route per the rationale
 * documented in the implementation runbook: `next-themes` ships with a
 * default `Alt+D` hotkey that collides with QuickCopy's reserved `Alt+<key>`
 * shortcut namespace, and the panel only needs a 2-state toggle persisted
 * under a single localStorage key — there is no system-preference following,
 * no SSR-flash mitigation worth the dependency.
 *
 * Contract:
 *  - Default theme: 'dark' (panel is dark-by-design per UI § 4a).
 *  - localStorage key: 'quickcopy.theme' (FR-010 — the ONLY persisted state).
 *  - Applies the active theme by toggling `<html class="dark">` — Tailwind's
 *    `@custom-variant dark (&:is(.dark *))` consumes that class.
 *  - SSR-safe: the initial render returns the default ('dark'); the effect
 *    re-applies the persisted value on mount. There is no flash mitigation —
 *    the panel renders inside a Marketplace iframe so the perceived flash is
 *    bound to the iframe's load anyway.
 */

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "quickcopy.theme";
const DEFAULT_THEME: Theme = "dark";

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    // localStorage may throw in privacy modes — fall through to default.
  }
  return DEFAULT_THEME;
}

function applyTheme(next: Theme): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (next === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

export interface UseThemeResult {
  theme: Theme;
  toggle: () => void;
}

export function useTheme(): UseThemeResult {
  // Lazy initializer reads localStorage on the first client render
  // (jsdom + browser). Server renders use the default — that's fine because
  // the panel runs inside an iframe where the SSR/client mismatch is bound
  // to the iframe's load anyway.
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  // Sync `<html class="dark">` whenever theme changes (initial mount + every
  // toggle). This is the legitimate "synchronize state with an external
  // system" case `useEffect` is designed for.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // best-effort persistence; the in-memory toggle still works.
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
