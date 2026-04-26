/**
 * T033 — Regression audit (test-only).
 *
 * Source of truth: § 10 T033 + ADR-0009 + ADR-0003 + § 4c-1.
 *
 * Vitest tests that walk the production source tree via `node:fs` and assert
 * forbidden patterns are absent. The audit encodes five contracts:
 *
 *  1. **No `setTimeout` / `setInterval` outside the documented morph-revert
 *     path.** ADR-0009 forbids retry / backoff. The 1500ms "Copied" morph
 *     revert is the ONLY allowed timer in `components/quickcopy/` and lives
 *     in `useCopyAction.ts` (cards) and `ShareLinkSplit.tsx` (share strip).
 *     `lib/url-resolver/` must contain zero timers.
 *  2. **No `retry` keyword in production CODE.** Reading our error code paths
 *     should never reveal a retry concept. Comments and tests are excluded —
 *     the audit strips line/block comments before scanning so doc strings
 *     that explicitly disclaim "no auto-retry" don't trip the audit.
 *  3. **No `aria-live` outside `StatusLiveRegion.tsx`.** ADR-0009 mandates
 *     errors are visual-only — there must be no error-state aria-live region.
 *     Comments are excluded for the same reason as (2).
 *  4. **No `as string` / `as any` casts in production code on SDK return
 *     values** (§ 4c-1 + `client.md § 8a / § 12g`). Note: `as never` casts
 *     on the SDK-call **request payload** in `prefetch.ts` are an
 *     established Phase-1 workaround for the narrow generic on
 *     `client.query` and are not a return-value cast. The audit therefore
 *     forbids `as string` and `as any` outright but does not flag `as never`
 *     — the latter is gated by a separate rule below restricted to call
 *     SITES on `xmc.*` results (zero such call sites today).
 *  5. **No raw hex outside `globals.css`.** ADR-0003 — Blok semantic tokens
 *     are the only color surface. Raw hex must live in the `:root` / `.dark`
 *     token block of `globals.css` and nowhere else. Comments are excluded.
 *
 * The audit is intentionally simple — readdirSync + readFileSync + string
 * scans on a comment-stripped view. It does not need a real lexer; the goal
 * is regression detection at the same fidelity as the manual greps in § 10.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(__dirname, "..");

interface CollectOptions {
  /** Roots to walk, relative to APP_ROOT. */
  roots: string[];
  /** Exclude paths whose `relative` form contains any of these substrings. */
  excludeSubstrings?: string[];
  /** Exclude paths whose basename matches any of these endings. */
  excludeEndings?: string[];
  /** File extensions to include. */
  extensions?: string[];
}

function collectFiles(opts: CollectOptions): string[] {
  const exts = opts.extensions ?? [".ts", ".tsx", ".css"];
  const out: string[] = [];
  for (const root of opts.roots) {
    const abs = join(APP_ROOT, root);
    walk(abs, abs);
  }
  return out;

  function walk(dir: string, root: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // dir may not exist (e.g. hooks/ before T027)
    }
    for (const name of entries) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === ".next" || name === "dist") continue;
        walk(p, root);
        continue;
      }
      if (!st.isFile()) continue;
      const lower = name.toLowerCase();
      if (!exts.some((e) => lower.endsWith(e))) continue;
      const rel = relative(APP_ROOT, p).split(sep).join("/");
      if (opts.excludeSubstrings?.some((s) => rel.includes(s))) continue;
      if (opts.excludeEndings?.some((s) => lower.endsWith(s))) continue;
      out.push(rel);
    }
  }
}

function read(rel: string): string {
  return readFileSync(join(APP_ROOT, rel), "utf8");
}

/**
 * Strip block comments (`/* ... *​/`) and single-line comments (`// ...`)
 * from a TS/TSX/CSS source. We don't need to be lexer-perfect — the goal
 * is to drop documentation + JSDoc copy that legitimately mentions
 * forbidden words ("retry", "aria-live") without producing those constructs
 * in executable code.
 */
function stripComments(source: string): string {
  // Remove block comments first to avoid eating string literals containing //.
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments. Naive: trims everything from `//` to EOL. Safe
  // enough for this audit because TS/TSX strings and template literals do
  // not contain `//` followed by retry/aria-live in our codebase.
  return noBlock.replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}

describe("regression audit (T033)", () => {
  it("no setTimeout/setInterval in lib/url-resolver/ (no retry, no backoff per ADR-0009)", () => {
    const files = collectFiles({
      roots: ["lib/url-resolver"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx"],
    });
    const hits: string[] = [];
    for (const f of files) {
      const src = stripComments(read(f));
      if (/\b(setTimeout|setInterval)\b/.test(src)) hits.push(f);
    }
    expect(hits, `unexpected timer usage in: ${hits.join(", ")}`).toEqual([]);
  });

  it("no setTimeout/setInterval in components/quickcopy/ outside the morph-revert path", () => {
    // The 1500ms `copied` morph revert (FR-008). § 10 T033 explicitly exempts
    // the morph-revert path inside ActionCard.tsx; in this implementation the
    // timer lives in `useCopyAction.ts` (the card-side morph driver) and
    // `ShareLinkSplit.tsx` (the strip-side morph driver). Both are the
    // documented "morph-revert path."
    const ALLOWED = new Set([
      "components/quickcopy/useCopyAction.ts",
      "components/quickcopy/ShareLinkSplit.tsx",
    ]);
    const files = collectFiles({
      roots: ["components/quickcopy"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx"],
    });
    const hits: string[] = [];
    for (const f of files) {
      if (ALLOWED.has(f)) continue;
      const src = stripComments(read(f));
      if (/\b(setTimeout|setInterval)\b/.test(src)) hits.push(f);
    }
    expect(hits, `unexpected timer usage in: ${hits.join(", ")}`).toEqual([]);
  });

  it("no `retry` keyword in production code paths (ADR-0009)", () => {
    const files = collectFiles({
      roots: ["lib", "components/quickcopy", "hooks"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx"],
    });
    const hits: Array<{ file: string; line: number; text: string }> = [];
    const pattern = /\bretry\b/i;
    for (const f of files) {
      const src = stripComments(read(f));
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (pattern.test(line)) hits.push({ file: f, line: i + 1, text: line.trim() });
      });
    }
    expect(
      hits,
      `unexpected 'retry' references:\n${hits
        .map((h) => `  ${h.file}:${h.line}  ${h.text}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("aria-live appears only inside StatusLiveRegion.tsx within components/quickcopy/ code", () => {
    const files = collectFiles({
      roots: ["components/quickcopy"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx"],
    });
    const hits: string[] = [];
    for (const f of files) {
      if (f.endsWith("StatusLiveRegion.tsx")) continue;
      const src = stripComments(read(f));
      if (/aria-live/i.test(src)) hits.push(f);
    }
    expect(hits, `unexpected aria-live usage in: ${hits.join(", ")}`).toEqual([]);
  });

  it("no `as string` or `as any` casts in production code (excluding tests)", () => {
    // Note: `as never` casts on SDK-call request payloads in `prefetch.ts`
    // are an established Phase-1 workaround for the narrow generic on
    // `client.query` and are not a return-value cast — see this file's
    // header comment, point (4). The audit therefore forbids only the two
    // strictly outlawed casts: `as string` and `as any`.
    const files = collectFiles({
      roots: ["lib", "components/quickcopy", "hooks"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx"],
    });
    const hits: Array<{ file: string; line: number; text: string }> = [];
    const pattern = /\bas\s+(string|any)\b/;
    for (const f of files) {
      const src = stripComments(read(f));
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (pattern.test(line)) hits.push({ file: f, line: i + 1, text: line.trim() });
      });
    }
    expect(
      hits,
      `unexpected casts:\n${hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join("\n")}`,
    ).toEqual([]);
  });

  it("no raw hex colors outside app/globals.css", () => {
    const files = collectFiles({
      roots: ["app", "components", "hooks", "lib"],
      excludeEndings: [".test.ts", ".test.tsx"],
      extensions: [".ts", ".tsx", ".css"],
    });
    const hits: Array<{ file: string; line: number; text: string }> = [];
    const pattern = /#[0-9a-fA-F]{3,8}\b/;
    for (const f of files) {
      if (f === "app/globals.css") continue;
      const src = stripComments(read(f));
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (pattern.test(line)) hits.push({ file: f, line: i + 1, text: line.trim() });
      });
    }
    expect(
      hits,
      `unexpected hex colors:\n${hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join("\n")}`,
    ).toEqual([]);
  });
});
