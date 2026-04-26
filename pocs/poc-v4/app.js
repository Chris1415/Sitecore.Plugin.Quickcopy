/* QuickCopy POC v4 — Content-Forward Stack
 * Strict Blok adherence: tokens-only colors, Geist Sans/Mono, no external deps beyond Google Fonts.
 * State is purely local; no real Marketplace SDK calls.
 */

(() => {
  "use strict";

  const VALUES = {
    live:    "https://www.example.com/products/spring-campaign",
    preview: "https://preview.example.com/products/spring-campaign",
    item:    "8E5F4A3B-2C1D-4F9A-9B7E-1A2B3C4D5E6F",
    title:   "Spring Campaign Landing Page",
  };

  const LABELS = {
    live: "LIVE URL",
    preview: "PREVIEW URL",
    item: "ITEM ID",
    title: "PAGE TITLE",
  };

  const ERROR_MSG = {
    live:    "Couldn't fetch Live URL — try switching pages or reloading",
    preview: "Couldn't fetch Preview URL — try switching pages or reloading",
    item:    "Page context not ready — wait or reload",
    title:   "Page context not ready — wait or reload",
  };

  const DISABLED_MSG = {
    live: "Not published to Edge yet — publish the page first",
  };

  const GLYPH_MOON = "\u263E";
  const GLYPH_SUN  = "\u2600";

  const state = {
    published: true,
    errors: { live: false, preview: false, item: false, title: false, share: false },
    copyTimers: { live: 0, preview: 0, item: 0, title: 0, share: 0 },
    shareFormat: "md",
    theme: localStorage.getItem("quickcopy.poc.theme.v4") || "dark",
  };

  const html = document.documentElement;
  const themeBtn = document.getElementById("theme-toggle");
  const themeLabel = themeBtn.querySelector(".theme-pill__label");
  const themeGlyph = themeBtn.querySelector(".theme-pill__glyph");
  const srLive = document.getElementById("sr-live");
  const demoStatus = document.getElementById("demo-status");

  const rowEls = {};
  document.querySelectorAll(".row").forEach((el) => {
    const action = el.dataset.action;
    rowEls[action] = {
      btn: el,
      value: el.querySelector('[data-role="value"]'),
      label: el.querySelector(".row__label"),
    };
  });

  const shareEl = document.querySelector('[data-action="share"]');
  const shareBtn = shareEl.querySelector(".share__primary");
  const shareCaret = document.getElementById("share-caret");
  const shareMenu = document.getElementById("share-menu");
  const shareLabel = shareEl.querySelector(".share__label");
  const shareChip = document.getElementById("share-format-chip");
  const shareMenuItems = shareEl.querySelectorAll(".share__menu-item");

  function applyTheme() {
    if (state.theme === "dark") {
      html.classList.add("dark");
      themeBtn.setAttribute("aria-pressed", "true");
      themeLabel.textContent = "Dark";
      themeGlyph.textContent = GLYPH_MOON;
    } else {
      html.classList.remove("dark");
      themeBtn.setAttribute("aria-pressed", "false");
      themeLabel.textContent = "Light";
      themeGlyph.textContent = GLYPH_SUN;
    }
    localStorage.setItem("quickcopy.poc.theme.v4", state.theme);
  }
  themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
  });
  applyTheme();

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_e) { /* fallback */ }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setRowError(action, isError) {
    state.errors[action] = isError;
    const row = rowEls[action];
    if (!row) return;
    row.btn.classList.toggle("is-error", isError);
    if (isError) {
      row.btn.setAttribute("aria-disabled", "true");
      row.value.textContent = ERROR_MSG[action];
    } else {
      row.btn.removeAttribute("aria-disabled");
      row.value.textContent = VALUES[action];
    }
  }

  function setLivePublished(published) {
    state.published = published;
    const row = rowEls.live;
    if (!row) return;
    if (published) {
      row.btn.classList.remove("is-disabled");
      row.btn.removeAttribute("aria-disabled");
      if (!state.errors.live) row.value.textContent = VALUES.live;
    } else {
      row.btn.classList.add("is-disabled");
      row.btn.setAttribute("aria-disabled", "true");
      row.value.textContent = DISABLED_MSG.live;
    }
  }

  function showCopiedRow(action) {
    const row = rowEls[action];
    if (!row) return;
    clearTimeout(state.copyTimers[action]);
    row.btn.classList.add("is-copied");
    row.value.textContent = "Copied to clipboard \u2713";
    state.copyTimers[action] = setTimeout(() => {
      row.btn.classList.remove("is-copied");
      if (action === "live" && !state.published) {
        row.value.textContent = DISABLED_MSG.live;
      } else if (state.errors[action]) {
        row.value.textContent = ERROR_MSG[action];
      } else {
        row.value.textContent = VALUES[action];
      }
    }, 1500);
  }

  function showCopiedShare() {
    clearTimeout(state.copyTimers.share);
    shareEl.classList.add("is-copied");
    const orig = shareLabel.textContent;
    shareLabel.dataset.orig = orig;
    shareLabel.textContent = "Copied!";
    state.copyTimers.share = setTimeout(() => {
      shareEl.classList.remove("is-copied");
      shareLabel.textContent = shareLabel.dataset.orig || "Share Link";
    }, 1500);
  }

  function announce(msg) {
    srLive.textContent = "";
    requestAnimationFrame(() => { srLive.textContent = msg; });
  }

  async function handleRowAction(action) {
    if (action === "live" && !state.published) return;
    if (state.errors[action]) return;
    const value = VALUES[action];
    const ok = await copyToClipboard(value);
    if (ok) {
      showCopiedRow(action);
      announce(`${LABELS[action]} copied to clipboard`);
    } else {
      setRowError(action, true);
      announce(`${LABELS[action]} copy failed`);
    }
  }

  function buildShareLink(format) {
    const url = state.published ? VALUES.live : VALUES.preview;
    if (format === "md") return `[${VALUES.title}](${url})`;
    return `${VALUES.title} \u2014 ${url}`;
  }

  async function handleShare(format) {
    const fmt = format || state.shareFormat;
    const text = buildShareLink(fmt);
    const ok = await copyToClipboard(text);
    if (ok) {
      showCopiedShare();
      announce(`Share link copied to clipboard as ${fmt === "plain" ? "plain text" : "Markdown"}`);
    } else {
      shareEl.classList.add("is-error");
      announce("Share link copy failed");
    }
  }

  function setShareDefault(format) {
    state.shareFormat = format;
    shareChip.textContent = format === "md" ? "MD" : "TXT";
  }

  Object.entries(rowEls).forEach(([action, row]) => {
    row.btn.addEventListener("click", (e) => {
      if (row.btn.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        return;
      }
      handleRowAction(action);
    });
  });

  shareBtn.addEventListener("click", () => handleShare(state.shareFormat));

  let menuOpen = false;
  function openMenu() {
    menuOpen = true;
    shareMenu.hidden = false;
    shareCaret.setAttribute("aria-expanded", "true");
    const first = shareMenu.querySelector(".share__menu-item");
    if (first) first.focus();
  }
  function closeMenu(restoreFocus = false) {
    menuOpen = false;
    shareMenu.hidden = true;
    shareCaret.setAttribute("aria-expanded", "false");
    if (restoreFocus) shareCaret.focus();
  }
  shareCaret.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menuOpen) closeMenu(); else openMenu();
  });
  shareMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      const fmt = item.dataset.format;
      setShareDefault(fmt);
      closeMenu();
      handleShare(fmt);
    });
  });
  document.addEventListener("click", (e) => {
    if (menuOpen && !shareEl.contains(e.target)) closeMenu();
  });
  shareMenu.addEventListener("keydown", (e) => {
    const items = Array.from(shareMenuItems);
    const idx = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    }
  });
  shareCaret.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!menuOpen) openMenu();
    }
  });

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isEditable(document.activeElement)) return;
    const key = e.key.toLowerCase();
    const map = { l: "live", p: "preview", i: "item", t: "title" };
    if (key in map) {
      e.preventDefault();
      handleRowAction(map[key]);
    } else if (key === "s") {
      e.preventDefault();
      handleShare(state.shareFormat);
    }
  });

  document.getElementById("demo-toggle-published").addEventListener("click", () => {
    setLivePublished(!state.published);
    demoStatus.textContent = state.published ? "Published" : "Unpublished";
  });
  document.getElementById("demo-force-error").addEventListener("click", () => {
    setRowError("preview", !state.errors.preview);
    demoStatus.textContent = state.errors.preview ? "Preview URL forced into error" : "Preview URL cleared";
  });
  document.getElementById("demo-reset").addEventListener("click", () => {
    Object.keys(state.errors).forEach((k) => { state.errors[k] = false; });
    Object.keys(rowEls).forEach((action) => setRowError(action, false));
    setLivePublished(true);
    shareEl.classList.remove("is-error");
    Object.values(rowEls).forEach((row) => {
      row.btn.classList.remove("is-copied");
    });
    shareEl.classList.remove("is-copied");
    Object.keys(state.copyTimers).forEach((k) => clearTimeout(state.copyTimers[k]));
    demoStatus.textContent = "Reset";
  });

  setShareDefault("md");
  setLivePublished(true);
})();
