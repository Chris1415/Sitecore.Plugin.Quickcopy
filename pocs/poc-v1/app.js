/* QuickCopy POC v1 — Page Card Hub
   Self-contained behavior: no build, no network, mocked Marketplace SDK.
   ADRs honored: 0008 (Alt+L/P/I/T/S, iframe-scoped, suppressed in editables),
                 0009 (persistent error, no auto-retry),
                 0010 (split-button share, dark default + light toggle, 1500ms morph).

   No use of innerHTML with dynamic content; all DOM mutations build nodes via
   document.createElement / cloneNode from trusted templates.
*/
(function () {
  "use strict";

  // ---------- Mocked context ----------
  var MOCK = {
    live:    "https://www.example.com/products/spring-campaign",
    preview: "https://preview.example.com/products/spring-campaign",
    itemid:  "8E5F4A3B-2C1D-4F9A-9B7E-1A2B3C4D5E6F",
    title:   "Spring Campaign Landing Page",
    site:    "Northwind Marketing",
    lang:    "en"
  };

  var STATE = {
    published: true,
    forcedError: { preview: false },
    morphTimer: new Map()
  };

  // ---------- DOM helpers ----------
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(width, height) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", String(width));
    s.setAttribute("height", String(height));
    s.setAttribute("aria-hidden", "true");
    return s;
  }
  function path(d, opts) {
    opts = opts || {};
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", String(opts.width || 1.5));
    if (opts.linecap)  p.setAttribute("stroke-linecap",  opts.linecap);
    if (opts.linejoin) p.setAttribute("stroke-linejoin", opts.linejoin);
    return p;
  }
  function circle(cx, cy, r) {
    var c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r",  String(r));
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", "currentColor");
    c.setAttribute("stroke-width", "1.5");
    return c;
  }
  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  // Glyph builders (return a fresh node each call)
  function glyphCheck() {
    var s = svg(16, 16);
    s.appendChild(path("M5 12.5l4.5 4.5L19 7", { width: 2, linecap: "round", linejoin: "round" }));
    return s;
  }
  function glyphCross() {
    var s = svg(16, 16);
    s.appendChild(path("M6 6l12 12M18 6L6 18", { width: 2, linecap: "round" }));
    return s;
  }
  function glyphLive() {
    var s = svg(16, 16);
    s.appendChild(circle(12, 12, 8.5));
    s.appendChild(path("M3.5 12h17M12 3.5c2.6 3 4 5.7 4 8.5s-1.4 5.5-4 8.5c-2.6-3-4-5.7-4-8.5s1.4-5.5 4-8.5z", { linejoin: "round" }));
    return s;
  }
  function glyphPreview() {
    var s = svg(16, 16);
    s.appendChild(path("M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", { linejoin: "round" }));
    s.appendChild(circle(12, 12, 2.75));
    return s;
  }
  function glyphHash() {
    var t = document.createTextNode("#");
    return t;
  }
  function glyphAA() {
    var t = document.createTextNode("aA");
    return t;
  }
  function setGlyph(chip, node) {
    var slot = chip.querySelector(".qc-chip__glyph");
    clearChildren(slot);
    slot.appendChild(node);
  }

  // ---------- Refs ----------
  var rootEl     = document.documentElement;
  var themeBtn   = $("#themeToggle");
  var metaSlot   = $("#metaSlot");
  var metaText   = $("#metaText");
  var liveRegion = $("#liveRegion");
  var preview    = $("#hoverPreview");
  var previewLbl = $("#previewLabel");
  var previewVal = $("#previewValue");
  var shareMain  = $("#shareMain");
  var shareCaret = $("#shareCaret");
  var shareMenu  = $("#shareMenu");
  var shareLabel = $("#shareLabel");
  var shareWrap  = shareMain.closest(".qc-share");
  var chips      = $$(".qc-chip");

  // Map action -> default glyph builder so we can restore safely.
  var DEFAULT_GLYPH = {
    live:    glyphLive,
    preview: glyphPreview,
    itemid:  glyphHash,
    title:   glyphAA
  };
  function restoreDefaultGlyph(chip) {
    var action = chip.dataset.action;
    var builder = DEFAULT_GLYPH[action];
    if (builder) setGlyph(chip, builder());
  }

  // Render metadata caption safely (text nodes + middot span).
  function renderMeta(textOverride, copied) {
    clearChildren(metaText);
    if (typeof textOverride === "string") {
      metaText.appendChild(document.createTextNode(textOverride));
    } else {
      metaText.appendChild(document.createTextNode(MOCK.site + " "));
      var dot = document.createElement("span");
      dot.className = "qc__meta-dot";
      dot.textContent = "·";
      metaText.appendChild(dot);
      metaText.appendChild(document.createTextNode(" " + MOCK.lang));
    }
    metaSlot.classList.toggle("qc__meta--copied", !!copied);
  }

  // ---------- Theme ----------
  var THEME_KEY = "quickcopy.poc.theme.v1";
  function applyTheme(t) {
    rootEl.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    var t = "dark";
    try { t = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
    applyTheme(t === "light" ? "light" : "dark");
  })();
  themeBtn.addEventListener("click", function () {
    var next = rootEl.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
  });

  // ---------- Mocked Marketplace SDK ----------
  function sdkCopy(action) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (action === "live" && !STATE.published) {
          return reject({ code: "UNPUBLISHED", message: "Not published to Edge yet — publish the page first" });
        }
        if (action === "preview" && STATE.forcedError.preview) {
          return reject({ code: "SDK_TIMEOUT", message: "Marketplace SDK timed out — try again" });
        }
        var value = valueFor(action);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).catch(function () {});
          }
        } catch (e) {}
        resolve(value);
      }, 80);
    });
  }

  function valueFor(action) {
    switch (action) {
      case "live":    return MOCK.live;
      case "preview": return MOCK.preview;
      case "itemid":  return MOCK.itemid;
      case "title":   return MOCK.title;
      case "share-md":    return "[" + MOCK.title + "](" + MOCK.live + ")";
      case "share-plain": return MOCK.title + " — " + MOCK.live;
      default: return "";
    }
  }

  function labelFor(action) {
    var map = {
      live: "Live URL",
      preview: "Preview URL",
      itemid: "Item ID",
      title: "Page Title",
      "share-md": "Share Link (Markdown)",
      "share-plain": "Share Link (Plain text)"
    };
    return map[action] || "";
  }

  // ---------- Hover preview card ----------
  var previewAnchor = null;
  function showPreviewFor(chip) {
    var action = chip.dataset.action;
    var tone = chip.dataset.state === "error"
      ? "error"
      : (action === "live" && !STATE.published) ? "warn" : "default";

    previewLbl.textContent = labelFor(action);
    if (tone === "warn") {
      previewVal.textContent = "Not published to Edge yet — publish the page first";
    } else if (tone === "error") {
      previewVal.textContent = chip.dataset.errorMsg || "Something went wrong.";
    } else {
      previewVal.textContent = valueFor(action);
    }
    preview.dataset.tone = tone === "default" ? "" : tone;

    var panel = $(".quickcopy");
    var panelRect = panel.getBoundingClientRect();
    var r = chip.getBoundingClientRect();
    preview.dataset.open = "true";
    var pw = preview.offsetWidth;
    var ph = preview.offsetHeight;
    var left = (r.left - panelRect.left) + r.width / 2 - pw / 2;
    var minLeft = 12;
    var maxLeft = panel.clientWidth - pw - 12;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;
    var top = (r.top - panelRect.top) - ph - 8;
    if (top < 12) top = (r.top - panelRect.top) + r.height + 8;
    preview.style.left = left + "px";
    preview.style.top  = top  + "px";
    previewAnchor = chip;
  }
  function hidePreview() {
    preview.dataset.open = "false";
    previewAnchor = null;
  }

  chips.forEach(function (chip) {
    chip.addEventListener("mouseenter", function () { showPreviewFor(chip); });
    chip.addEventListener("mouseleave", function () { if (previewAnchor === chip) hidePreview(); });
    chip.addEventListener("focus",      function () { showPreviewFor(chip); });
    chip.addEventListener("blur",       function () { if (previewAnchor === chip) hidePreview(); });
  });

  // ---------- Copy + morph ----------
  function announce(text) {
    liveRegion.textContent = "";
    setTimeout(function () { liveRegion.textContent = text; }, 30);
  }

  function morphChip(chip, action) {
    var t = STATE.morphTimer.get(chip);
    if (t) clearTimeout(t);

    chip.dataset.state = "copied";
    setGlyph(chip, glyphCheck());
    renderMeta("Copied", true);

    if (previewAnchor === chip) showPreviewFor(chip);

    var timer = setTimeout(function () {
      chip.dataset.state = "";
      restoreDefaultGlyph(chip);
      renderMeta(null, false);
      if (previewAnchor === chip) showPreviewFor(chip);
    }, 1500);
    STATE.morphTimer.set(chip, timer);

    announce(labelFor(action) + " copied");
  }

  function errorChip(chip, action, errMsg) {
    chip.dataset.state = "error";
    chip.dataset.errorMsg = errMsg;
    setGlyph(chip, glyphCross());
    chip.setAttribute("aria-invalid", "true");
    if (previewAnchor === chip) showPreviewFor(chip);
    announce(labelFor(action) + " failed. " + errMsg);
  }

  function clearError(chip) {
    if (chip.dataset.state !== "error") return;
    chip.dataset.state = "";
    chip.removeAttribute("aria-invalid");
    delete chip.dataset.errorMsg;
    restoreDefaultGlyph(chip);
  }

  function setDisabled(chip, on, reason) {
    if (on) {
      chip.dataset.state = "disabled";
      chip.setAttribute("aria-disabled", "true");
      chip.dataset.disabledReason = reason || "Disabled";
    } else {
      if (chip.dataset.state === "disabled") chip.dataset.state = "";
      chip.removeAttribute("aria-disabled");
      delete chip.dataset.disabledReason;
    }
  }

  function activateChip(chip) {
    var action = chip.dataset.action;
    if (chip.dataset.state === "disabled") {
      announce(chip.dataset.disabledReason || "Disabled");
      if (previewAnchor === chip) showPreviewFor(chip);
      return;
    }
    sdkCopy(action).then(function () {
      clearError(chip);
      morphChip(chip, action);
    }).catch(function (err) {
      errorChip(chip, action, err.message || "Failed");
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () { activateChip(chip); });
  });

  // ---------- Share split-button ----------
  function morphShare(variant) {
    var t = STATE.morphTimer.get(shareWrap);
    if (t) clearTimeout(t);
    var originalLabel = shareWrap.dataset.originalLabel || shareLabel.textContent;
    shareWrap.dataset.originalLabel = originalLabel;
    shareWrap.dataset.state = "copied";
    shareLabel.textContent = "Copied!";
    announce(labelFor(variant) + " copied");
    var timer = setTimeout(function () {
      shareWrap.dataset.state = "";
      shareLabel.textContent = originalLabel;
    }, 1500);
    STATE.morphTimer.set(shareWrap, timer);
  }

  function copyShare(variant) {
    var value = valueFor(variant);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(function () {});
      }
    } catch (e) {}
    morphShare(variant);
  }

  shareMain.addEventListener("click", function () {
    closeShareMenu();
    copyShare("share-md");
  });

  function openShareMenu() {
    shareMenu.hidden = false;
    shareCaret.setAttribute("aria-expanded", "true");
    setTimeout(function () {
      var first = shareMenu.querySelector('[role="menuitem"]');
      if (first) first.focus();
    }, 0);
  }
  function closeShareMenu() {
    shareMenu.hidden = true;
    shareCaret.setAttribute("aria-expanded", "false");
  }
  shareCaret.addEventListener("click", function (e) {
    e.stopPropagation();
    if (shareMenu.hidden) openShareMenu(); else closeShareMenu();
  });
  document.addEventListener("click", function (e) {
    if (!shareMenu.hidden && !shareMenu.contains(e.target) && e.target !== shareCaret) {
      closeShareMenu();
    }
  });
  shareMenu.addEventListener("click", function (e) {
    var item = e.target.closest('[role="menuitem"]');
    if (!item) return;
    closeShareMenu();
    if (item.dataset.share === "markdown") copyShare("share-md");
    else if (item.dataset.share === "plain") copyShare("share-plain");
  });
  shareMenu.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeShareMenu(); shareCaret.focus(); }
  });

  // ---------- Keyboard shortcuts (ADR-0008) ----------
  function isEditableTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }
  // Scoped to this document only (the iframe document); never window.top.
  document.addEventListener("keydown", function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isEditableTarget(e.target)) return;
    var k = e.key.toLowerCase();
    var map = { l: "live", p: "preview", i: "itemid", t: "title" };
    if (map[k]) {
      var chip = chips.filter(function (c) { return c.dataset.action === map[k]; })[0];
      if (chip) {
        e.preventDefault();
        chip.focus();
        activateChip(chip);
      }
    } else if (k === "s") {
      e.preventDefault();
      // Always default action; never opens dropdown.
      closeShareMenu();
      copyShare("share-md");
    }
  });

  // ---------- Demo controls ----------
  $('[data-demo="toggle-published"]').addEventListener("click", function () {
    STATE.published = !STATE.published;
    var liveChip = chips.filter(function (c) { return c.dataset.action === "live"; })[0];
    if (!STATE.published) {
      setDisabled(liveChip, true, "Not published to Edge yet — publish the page first");
    } else {
      setDisabled(liveChip, false);
      clearError(liveChip);
    }
    if (previewAnchor === liveChip) showPreviewFor(liveChip);
    announce(STATE.published ? "Page is published" : "Page is unpublished");
  });

  $('[data-demo="force-error"]').addEventListener("click", function () {
    STATE.forcedError.preview = !STATE.forcedError.preview;
    var previewChip = chips.filter(function (c) { return c.dataset.action === "preview"; })[0];
    if (STATE.forcedError.preview) {
      activateChip(previewChip);
    } else {
      clearError(previewChip);
      if (previewAnchor === previewChip) showPreviewFor(previewChip);
      announce("Preview URL error cleared");
    }
  });

  $('[data-demo="reset"]').addEventListener("click", function () {
    STATE.published = true;
    STATE.forcedError.preview = false;
    chips.forEach(function (chip) {
      var t = STATE.morphTimer.get(chip);
      if (t) clearTimeout(t);
      STATE.morphTimer.delete(chip);
      clearError(chip);
      setDisabled(chip, false);
      chip.dataset.state = "";
      restoreDefaultGlyph(chip);
    });
    renderMeta(null, false);
    shareWrap.dataset.state = "";
    shareLabel.textContent = "Share this page";
    closeShareMenu();
    hidePreview();
    announce("All states reset");
  });
})();
