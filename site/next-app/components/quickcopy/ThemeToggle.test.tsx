/**
 * T028a — RED tests for `<ThemeToggle>`.
 *
 * Pinned by § 10 T028a + § 4c-4 (UI § 5h).
 *
 * Cases:
 *  1. Default dark → button text contains "Dark".
 *  2. aria-pressed reflects theme: "true" when dark, "false" when light.
 *  3. Click → label flips "Dark" ↔ "Light"; <html class="dark"> flips.
 *  4. Space key fires toggle (browser default for buttons).
 *  5. Enter key fires toggle.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("<ThemeToggle>", () => {
  it("renders 'Dark' label and aria-pressed='true' on default dark", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    expect(btn.textContent).toMatch(/Dark/);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders 'Light' label and aria-pressed='false' when persisted theme is light", () => {
    localStorage.setItem("quickcopy.theme", "light");
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    expect(btn.textContent).toMatch(/Light/);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("flips label and <html class='dark'> when clicked", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(btn);
    expect(btn.textContent).toMatch(/Light/);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("fires toggle on Space key", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    btn.focus();
    // The browser default is to fire `click` on Space-keyup for <button>;
    // jsdom does not simulate that path, so we exercise the explicit
    // keydown handler the component must register.
    fireEvent.keyDown(btn, { key: " " });
    expect(btn.textContent).toMatch(/Light/);
  });

  it("fires toggle on Enter key", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(btn.textContent).toMatch(/Light/);
  });
});
