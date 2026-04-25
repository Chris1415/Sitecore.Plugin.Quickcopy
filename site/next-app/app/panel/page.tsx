"use client";

/**
 * T007 — `/panel` route. The Cloud Portal registers QuickCopy at the
 * `xmc:pages:contextpanel` extension point with this route URL (per ADR-0002 +
 * ADR-0005, mirroring pageshot). Phase-1 placeholder; the real composition
 * (`<QuickCopyPanel />`) lands in T036.
 */
export default function QuickCopyPanelRoute() {
  return <div>QuickCopy panel — bootstrap OK</div>;
}
