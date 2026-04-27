## Title

PRD-000 polish + real-tenant URL fetch fix

## Body

## Summary

- **Ship status:** `shipped`
- Fixes the persistent `Failed` state on Live URL and Preview URL cards observed during real-tenant smoke (Dog Feeding App tenant) by parsing Marketplace SDK responses using real types from `@sitecore-marketplace-sdk/xmc` instead of the inferred shapes used in v0.1.
- Adds operator prerequisite to `README.md`: tenant administrator must populate `targetHostname` under **Sitecore XM Cloud → Sites → Hosts**. Without this, `xmc.sites.listHosts` returns placeholder values and Live URL composition does not point at the real public site. QuickCopy reads, never writes, this value.
- Carries seven prior polish commits already on this branch: legend compaction with long-form preserved for screen readers, dark-mode Share Link readability, monochrome U+2715 error glyph, panel density + theme pill + legend chip layout, and isolation of the Live URL card from Preview URL errors per ADR-0006.

## Artifacts

- PRD: `products/quickcopy/project-planning/PRD/prd-000.md` (closed by PR #1; this PR ships the post-merge bug fix + polish)
- Ship report (cycle 2): `products/quickcopy/project-planning/plans/ship-report-20260427T124015Z.md`
- Ship report (cycle 1, prior): `products/quickcopy/project-planning/plans/ship-report-20260426T000000Z.md`
- Diagnostic: `products/quickcopy/project-planning/plans/diagnostic-2026-04-26-real-tenant-url-failures.md`
- Run manifest snapshot: `products/quickcopy/project-planning/workflow/run-20260427T124015Z.json`
- Task breakdown (carried): `products/quickcopy/project-planning/plans/task-breakdown-20260424T193446Z.md`

## ADR compliance

All ten ADRs unchanged. ADR-0006 (Live URL parallel pre-fetch composition) is strengthened by the per-card error isolation in `8930b5d`. ADR-0009 (persistent error state, no retry) compliance unchanged — the error-isolation improvement is per-card, not retry behaviour.

## Test plan

- [x] Unit + component + integration suite: 172 tests still passing locally
- [x] `marketplace.test.tsx` and `ShareLinkSplit.test.tsx` updated to align with the SDK-types refactor
- [x] `as never` cast removed from `prefetch.ts` (resolves prior cycle m-3 debt)
- [ ] Real-tenant smoke: full nine-section `SMOKE_TEST.md` walkthrough with `targetHostname` populated for the canonical delivery host
- [ ] Verify host-fallback rule: when `targetHostname` is empty across all hosts, falls back to first non-empty `hostnames[]` entry
- [ ] Cross-browser: Chrome / Edge / Firefox / Safari latest + latest-1

## Known limitations carried into this ship

- Operator must set `targetHostname` per host record (documented in README "Backend prerequisite — `targetHostname`")
- Open OQ-003 / OQ-004 / OQ-005 (UX-writing pass, theme switcher placement, legend visual treatment) — carried over for stakeholder decision in real-tenant context
- Six minor findings (m-1..m-6) from prior cycle remain open; m-3 is resolved by the SDK-types refactor

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Manual PR creation

```
https://github.com/Chris1415/Sitecore.Plugin.Quickcopy/pull/new/design-polish-1
```

Targeting `main`. Use the title above, paste everything from "## Summary" through "🤖 Generated…" as the body.
