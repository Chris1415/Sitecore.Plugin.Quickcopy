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

/**
 * `<URL|Title>` — Slack mrkdwn shape. Slack does NOT render standard Markdown
 * `[Title](URL)` as a hyperlink in messages — it uses its own pseudo-Markdown
 * where angle-bracketed `<URL|label>` is the link form. See
 * https://api.slack.com/reference/surfaces/formatting#linking-urls.
 */
export const shareLinkSlack = (title: string, url: string): string =>
  `<${url}|${title}>`;

/**
 * `<a href="URL">Title</a>` — HTML anchor for pasting into rich-text fields,
 * email signatures, or any HTML-aware editor. The title is HTML-escaped
 * (just the five XML-significant chars) so a title containing `<`, `>`, `&`,
 * `"`, or `'` doesn't break the markup. The URL is NOT escaped — it must
 * already be a valid URL (we only ever feed it `liveUrl` or `previewUrl`,
 * both produced by `URL.toString()` / the SDK).
 */
const escapeHtmlText = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const shareLinkHtml = (title: string, url: string): string =>
  `<a href="${url}">${escapeHtmlText(title)}</a>`;
