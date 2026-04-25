/**
 * T023b — Share Link format builders.
 *
 * Source of truth: FR-005 + ADR-0010 + § 4c-6 / § 4c-8.
 *
 * Two pure functions, no template variations, no escaping inside the title
 * — FR-005 pins exact strings. The em-dash in `shareLinkPlainText` is
 * codepoint **U+2014** (NOT U+2013 en-dash, NOT U+002D hyphen-minus); the
 * unit tests assert the codepoint via `charCodeAt`.
 */

/**
 * `[<title>](<url>)` — Markdown shape per FR-005. No escaping. No trailing
 * whitespace.
 */
export const shareLinkMarkdown = (title: string, url: string): string =>
  `[${title}](${url})`;

/**
 * `<title> <U+2014> <url>` — em-dash with single space either side per FR-005.
 */
export const shareLinkPlainText = (title: string, url: string): string =>
  `${title} \u2014 ${url}`;
