/**
 * T023a — RED tests for the Share Link format builders.
 *
 * Spec source: task-breakdown § 10 / B-080..B-083 + § 4c-8 + FR-005.
 *
 * The module does not yet exist — every test fails with "module not found"
 * until T023b lands. The em-dash codepoint is pinned via `charCodeAt` so
 * future refactors cannot silently downgrade U+2014 to a hyphen-minus or
 * en-dash.
 */

import { describe, expect, it } from "vitest";

import { shareLinkMarkdown, shareLinkPlainText } from "./formats";

describe("shareLinkMarkdown (T023)", () => {
  it("returns `[title](url)` exactly — no escaping, no trailing whitespace", () => {
    expect(shareLinkMarkdown("Foo", "https://x")).toBe("[Foo](https://x)");
  });

  it("does NOT escape characters in the title (FR-005 — exact strings)", () => {
    // A literal closing paren in the title would normally be ambiguous in
    // markdown, but FR-005 pins the behavior — copy verbatim.
    expect(shareLinkMarkdown("A) B", "https://x")).toBe("[A) B](https://x)");
  });

  it("handles empty title", () => {
    expect(shareLinkMarkdown("", "https://x")).toBe("[](https://x)");
  });

  it("handles empty url", () => {
    expect(shareLinkMarkdown("Foo", "")).toBe("[Foo]()");
  });
});

describe("shareLinkPlainText (T023)", () => {
  it("returns `<title> <em-dash> <url>` with em-dash codepoint U+2014", () => {
    expect(shareLinkPlainText("Foo", "https://x")).toBe(
      "Foo \u2014 https://x",
    );
  });

  it("uses U+2014 EM DASH at index 4 (between space and space)", () => {
    const result = shareLinkPlainText("Foo", "https://x");
    expect(result.charCodeAt(4)).toBe(0x2014);
  });

  it("is NOT a U+2013 EN DASH", () => {
    const result = shareLinkPlainText("Foo", "https://x");
    expect(result.charCodeAt(4)).not.toBe(0x2013);
  });

  it("is NOT a U+002D HYPHEN-MINUS", () => {
    const result = shareLinkPlainText("Foo", "https://x");
    expect(result.charCodeAt(4)).not.toBe(0x002d);
  });

  it("places a single space on either side of the em-dash", () => {
    expect(shareLinkPlainText("Foo", "https://x")).toContain(" \u2014 ");
  });

  it("handles empty title without throwing", () => {
    expect(() => shareLinkPlainText("", "https://x")).not.toThrow();
    expect(shareLinkPlainText("", "https://x")).toBe(" \u2014 https://x");
  });

  it("handles empty url without throwing", () => {
    expect(() => shareLinkPlainText("Foo", "")).not.toThrow();
    expect(shareLinkPlainText("Foo", "")).toBe("Foo \u2014 ");
  });
});
