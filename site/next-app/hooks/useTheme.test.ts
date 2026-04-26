/**
 * T027a — RED tests for `useTheme` hook.
 *
 * Pinned by § 10 T027a + § 4c-8 (FR-010 localStorage key).
 *
 * Cases:
 *  1. Empty localStorage → theme === 'dark' AND <html> has `dark` class.
 *  2. localStorage 'light' → theme === 'light' AND `dark` class absent.
 *  3. localStorage 'dark'  → theme === 'dark' AND `dark` class present.
 *  4. toggle() from dark   → flips to 'light', removes class, writes 'light'.
 *  5. toggle() from light  → flips to 'dark',  adds class, writes 'dark'.
 *  6. SSR-safe: no throw when `window` is undefined; default theme === 'dark'.
 *  7. Invalid value ('purple') → falls back to 'dark'.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useTheme } from "./useTheme";

const KEY = "quickcopy.theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("defaults to dark when localStorage is empty and applies the dark class", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads 'light' from localStorage and removes the dark class", () => {
    localStorage.setItem(KEY, "light");
    document.documentElement.classList.add("dark"); // pre-existing dark
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads 'dark' from localStorage and applies the dark class", () => {
    localStorage.setItem(KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggle() from dark flips to light, removes the class, writes 'light'", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("light");
  });

  it("toggle() from light flips to dark, adds the class, writes 'dark'", () => {
    localStorage.setItem(KEY, "light");
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("dark");
  });

  it("falls back to 'dark' when localStorage holds an invalid value", () => {
    localStorage.setItem(KEY, "purple");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
