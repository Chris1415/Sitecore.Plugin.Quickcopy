/**
 * T035 — `jest-axe` smoke against the panel composition in BOTH themes.
 *
 * Source of truth: § 10 T035 (B-148 + B-149) + ADR-0003 (Blok semantic tokens
 * carry the contrast budget) + UI § 6.
 *
 * Strategy:
 *  - Mock `@/components/providers/marketplace` so `usePagesContext` returns a
 *    happy payload without bootstrapping the real SDK. The panel composition
 *    is the unit under test — not the Provider.
 *  - Seed the cache with a healthy `PageDerivedState` entry so the four cards
 *    render in `idle` state (not `Loading…`). Otherwise three of the five
 *    interactive controls would be `aria-disabled` and the test would only
 *    cover the loading skeleton.
 *  - Render the actual `app/panel/page.tsx` route component, run `axe()` in
 *    dark mode (the default — `<html className="dark">`), then toggle the
 *    `dark` class off and re-run axe for the light theme.
 *
 * The assertion is `toHaveNoViolations` (registered in `vitest.setup.ts`).
 */

import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/providers/marketplace", () => {
  const happyContext = {
    pageInfo: {
      id: "PAGE-123",
      version: 1,
      displayName: "Spring Promo",
      name: "spring-promo",
      url: "/products/spring",
      language: "en",
    },
    siteInfo: {
      id: "SITE-1",
      name: "marketing",
      displayName: "Marketing",
      language: "en",
    },
  };
  return {
    usePagesContext: () => happyContext,
    useMarketplaceClient: () => ({}),
    useAppContext: () => ({
      resourceAccess: [{ context: { live: "ctx-live" } }],
    }),
  };
});

import { setEntry, clearAll } from "@/lib/cache/store";
import { buildCacheKey } from "@/lib/cache/types";
import QuickCopyPanelRoute from "@/app/panel/page";

beforeAll(() => {
  // jsdom doesn't implement `matchMedia`; jest-axe checks for it during
  // colour-contrast inspection. Provide a permissive stub.
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

beforeEach(() => {
  clearAll();
  // Healthy cache slot so all five action surfaces render in `idle`.
  setEntry(buildCacheKey("PAGE-123", 1), {
    previewUrl: "https://preview.example.com/products/spring?sc_mode=preview",
    publishing: { isPublished: true },
    liveHost: "https://www.example.com",
    liveUrl: "https://www.example.com/products/spring",
  });
  // Default theme is dark — mirror app/layout.tsx + useTheme.
  document.documentElement.classList.add("dark");
});

afterEach(() => {
  clearAll();
  document.documentElement.classList.remove("dark");
});

describe("a11y smoke (T035)", () => {
  it("panel has no axe violations in dark theme (B-148)", async () => {
    const { container } = render(<QuickCopyPanelRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("panel has no axe violations in light theme (B-149)", async () => {
    document.documentElement.classList.remove("dark");
    const { container } = render(<QuickCopyPanelRoute />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
