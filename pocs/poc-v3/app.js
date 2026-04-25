/* QuickCopy POC v3 — Action Wheel
   Vanilla JS, no dependencies. All state local.
*/
(() => {
  'use strict';

  // -------- Mocked values --------
  const VALUES = {
    live:    'https://www.example.com/products/spring-campaign',
    preview: 'https://preview.example.com/products/spring-campaign',
    item:    '8E5F4A3B-2C1D-4F9A-9B7E-1A2B3C4D5E6F',
    title:   'Spring Campaign Landing Page',
    site:    'Northwind Marketing',
    language:'en',
  };

  const SHORTCUT_MAP = { l: 'live', p: 'preview', i: 'item', t: 'title', s: 'share' };
  const ACTION_LABELS = {
    live: 'Live URL', preview: 'Preview URL', item: 'Item ID',
    title: 'Page Title', share: 'Share Link',
  };

  // -------- State --------
  const state = {
    published: true,           // Live URL availability
    errors: new Set(),         // action keys with persistent error (ADR-0009)
    activeMorph: null,         // pending revert timer
    hubMorphTimer: null,
    shareMenuOpen: false,
  };

  // -------- DOM --------
  const $ = (sel) => document.querySelector(sel);
  const html = document.documentElement;
  const hub = $('#hub');
  const hubTitleEl = $('#hub-title');
  const hubSiteEl = $('#hub-site');
  const tooltip = $('#tooltip');
  const liveRegion = $('#live-region');
  const shareEl = $('.share');
  const shareMain = $('#share-main');
  const shareCaret = $('#share-caret');
  const shareMenu = $('#share-menu');
  const shareLabelEl = $('#share-label');

  const sats = Array.from(document.querySelectorAll('.sat'));
  const hairlines = Array.from(document.querySelectorAll('.hairline'));

  // -------- Theme --------
  const THEME_KEY = 'quickcopy.poc.theme.v3';
  const applyTheme = (theme) => {
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
  };
  try {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved || 'dark');
  } catch (_) { applyTheme('dark'); }

  $('#theme-toggle').addEventListener('click', () => {
    const next = html.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });

  // -------- Helpers --------
  const announce = (msg) => {
    liveRegion.textContent = '';
    setTimeout(() => { liveRegion.textContent = msg; }, 30);
  };

  const getValue = (action, format = 'markdown') => {
    if (action === 'share') {
      if (format === 'markdown') return `[${VALUES.title}](${VALUES.live})`;
      return `${VALUES.title} — ${VALUES.live}`;
    }
    return VALUES[action];
  };

  const truncateMid = (s, max) => {
    if (s.length <= max) return s;
    const half = Math.floor((max - 1) / 2);
    return s.slice(0, half) + '…' + s.slice(s.length - half);
  };

  const previewFor = (action) => {
    if (action === 'live')    return truncateMid(VALUES.live, 22);
    if (action === 'preview') return truncateMid(VALUES.preview, 22);
    if (action === 'item')    return VALUES.item.slice(0, 8) + '…' + VALUES.item.slice(-4);
    if (action === 'title')   return VALUES.title;
    if (action === 'share')   return 'Markdown link';
    return '';
  };

  // -------- Hub rendering --------
  const setHubDefault = () => {
    hubTitleEl.classList.remove('mono', 'tiny', 'shrink');
    hubTitleEl.textContent = VALUES.title;
    fitHubTitle();
    hubSiteEl.textContent = VALUES.site;
    hubSiteEl.style.visibility = 'visible';
    hub.classList.remove('is-error');
  };

  const setHubPreview = (action) => {
    hubTitleEl.classList.remove('shrink', 'tiny');
    hubTitleEl.classList.add('mono');
    hubTitleEl.textContent = previewFor(action);
    if (state.errors.has(action)) {
      hub.classList.add('is-error');
      hubTitleEl.textContent = 'Failed';
    } else {
      hub.classList.remove('is-error');
    }
    hubSiteEl.style.visibility = 'hidden';
  };

  const setHubCopied = () => {
    hubTitleEl.classList.remove('mono', 'shrink', 'tiny');
    hubTitleEl.textContent = 'Copied';
    hub.classList.remove('is-error');
    hubSiteEl.style.visibility = 'hidden';
  };

  const fitHubTitle = () => {
    const t = hubTitleEl.textContent || '';
    hubTitleEl.classList.remove('shrink', 'tiny');
    if (t.length > 22) hubTitleEl.classList.add('tiny');
    else if (t.length > 14) hubTitleEl.classList.add('shrink');
  };

  // -------- Hairline state sync --------
  const syncHairline = (action) => {
    const line = hairlines.find((h) => h.dataset.action === action);
    if (!line) return;
    line.classList.remove('is-disabled', 'is-error', 'is-active');
    if (action === 'live' && !state.published) line.classList.add('is-disabled');
    else if (state.errors.has(action)) line.classList.add('is-error');
  };
  const syncAllHairlines = () => Object.keys(VALUES)
    .filter((k) => k in {live:1,preview:1,item:1,title:1})
    .forEach(syncHairline);

  // -------- Satellite state sync --------
  const syncSatellite = (action) => {
    const sat = sats.find((s) => s.dataset.action === action);
    if (!sat) return;
    sat.classList.remove('is-disabled', 'is-error');
    sat.querySelector('.sat-glyph').textContent = defaultGlyph(action);
    if (action === 'live' && !state.published) {
      sat.classList.add('is-disabled');
      sat.setAttribute('aria-disabled', 'true');
    } else {
      sat.removeAttribute('aria-disabled');
    }
    if (state.errors.has(action)) {
      sat.classList.add('is-error');
      sat.querySelector('.sat-glyph').textContent = '❌';
    }
  };

  const defaultGlyph = (action) => ({
    live: '↗', preview: '◉', item: '#', title: 'Aa',
  }[action]);

  const syncAll = () => {
    ['live', 'preview', 'item', 'title'].forEach((a) => {
      syncSatellite(a); syncHairline(a);
    });
  };

  // -------- Tooltip --------
  let tooltipTarget = null;
  const showTooltip = (target, text) => {
    tooltipTarget = target;
    tooltip.textContent = text;
    tooltip.hidden = false;
    const r = target.getBoundingClientRect();
    const tr = tooltip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    let top = r.top - tr.height - 8;
    if (top < 4) top = r.bottom + 8;
    left = Math.max(4, Math.min(left, window.innerWidth - tr.width - 4));
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  };
  const hideTooltip = () => { tooltip.hidden = true; tooltipTarget = null; };

  // -------- Copy + morph --------
  const copyToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  };

  const triggerCopy = async (action, format) => {
    // Disabled guard
    if (action === 'live' && !state.published) {
      announce(`${ACTION_LABELS[action]} not available — page is unpublished.`);
      return;
    }

    // Forced error guard
    if (state.errors.has(action)) {
      announce(`Copy failed for ${ACTION_LABELS[action]}.`);
      return;
    }

    const text = getValue(action, format);
    try {
      await copyToClipboard(text);
    } catch (e) {
      // Persistent error per ADR-0009
      state.errors.add(action);
      syncSatellite(action); syncHairline(action);
      announce(`Copy failed for ${ACTION_LABELS[action]}.`);
      return;
    }

    // Success morph
    if (action === 'share') {
      shareEl.classList.remove('is-copied');
      void shareEl.offsetWidth;
      shareEl.classList.add('is-copied');
      const prev = shareLabelEl.textContent;
      shareLabelEl.textContent = 'Copied';
      setHubCopied();
      announce(`Copied ${ACTION_LABELS[action]}.`);
      setTimeout(() => {
        shareEl.classList.remove('is-copied');
        shareLabelEl.textContent = prev;
        setHubDefault();
      }, 1500);
    } else {
      const sat = sats.find((s) => s.dataset.action === action);
      sat.classList.remove('is-copied');
      void sat.offsetWidth;
      sat.classList.add('is-copied');
      const glyph = sat.querySelector('.sat-glyph');
      glyph.textContent = '✓';
      setHubCopied();
      announce(`Copied ${ACTION_LABELS[action]}.`);
      setTimeout(() => {
        sat.classList.remove('is-copied');
        glyph.textContent = defaultGlyph(action);
        // re-apply error glyph if errored mid-flight (paranoia)
        if (state.errors.has(action)) glyph.textContent = '❌';
        setHubDefault();
      }, 1500);
    }
  };

  // -------- Satellite events --------
  sats.forEach((sat) => {
    const action = sat.dataset.action;

    sat.addEventListener('mouseenter', () => {
      if (action === 'live' && !state.published) {
        showTooltip(sat, 'Not published to Edge yet — publish the page first');
        return;
      }
      setHubPreview(action);
    });
    sat.addEventListener('focus', () => {
      if (action === 'live' && !state.published) {
        showTooltip(sat, 'Not published to Edge yet — publish the page first');
        return;
      }
      setHubPreview(action);
    });
    sat.addEventListener('mouseleave', () => {
      hideTooltip();
      // do not interrupt copied morph
      if (!hubTitleEl.textContent.startsWith('Copied')) setHubDefault();
    });
    sat.addEventListener('blur', () => {
      hideTooltip();
      if (!hubTitleEl.textContent.startsWith('Copied')) setHubDefault();
    });

    sat.addEventListener('click', () => {
      if (action === 'live' && !state.published) return;
      triggerCopy(action);
    });
  });

  // -------- Share split-button --------
  shareMain.addEventListener('click', () => triggerCopy('share', 'markdown'));
  shareMain.addEventListener('mouseenter', () => setHubPreview('share'));
  shareMain.addEventListener('focus', () => setHubPreview('share'));
  shareMain.addEventListener('mouseleave', () => {
    if (!hubTitleEl.textContent.startsWith('Copied')) setHubDefault();
  });
  shareMain.addEventListener('blur', () => {
    if (!hubTitleEl.textContent.startsWith('Copied')) setHubDefault();
  });

  const closeShareMenu = () => {
    state.shareMenuOpen = false;
    shareMenu.hidden = true;
    shareCaret.setAttribute('aria-expanded', 'false');
  };
  const openShareMenu = () => {
    state.shareMenuOpen = true;
    shareMenu.hidden = false;
    shareCaret.setAttribute('aria-expanded', 'true');
    const first = shareMenu.querySelector('.menu-item');
    if (first) first.focus();
  };

  shareCaret.addEventListener('click', (e) => {
    e.stopPropagation();
    state.shareMenuOpen ? closeShareMenu() : openShareMenu();
  });

  shareMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    const fmt = item.dataset.format;
    closeShareMenu();
    triggerCopy('share', fmt);
  });

  document.addEventListener('click', (e) => {
    if (!state.shareMenuOpen) return;
    if (e.target.closest('.share')) return;
    closeShareMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (state.shareMenuOpen && e.key === 'Escape') {
      closeShareMenu();
      shareCaret.focus();
    }
  });

  // -------- Keyboard shortcuts (ADR-0008) --------
  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  };

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isEditableTarget(e.target)) return;
    const k = (e.key || '').toLowerCase();
    const action = SHORTCUT_MAP[k];
    if (!action) return;
    e.preventDefault();
    // Alt+S = Markdown default, does NOT open dropdown
    if (action === 'share') triggerCopy('share', 'markdown');
    else triggerCopy(action);
  });

  // -------- Demo controls --------
  $('#toggle-published').addEventListener('click', () => {
    state.published = !state.published;
    syncAll();
    announce(state.published ? 'Page is now published.' : 'Page is now unpublished.');
  });

  $('#force-error').addEventListener('click', () => {
    state.errors.add('preview');
    syncSatellite('preview');
    syncHairline('preview');
    announce('Forced error on Preview URL.');
  });

  $('#reset-states').addEventListener('click', () => {
    state.published = true;
    state.errors.clear();
    state.shareMenuOpen = false;
    shareMenu.hidden = true;
    shareCaret.setAttribute('aria-expanded', 'false');
    syncAll();
    setHubDefault();
    announce('States reset.');
  });

  // -------- Initial render --------
  setHubDefault();
  syncAll();
})();
