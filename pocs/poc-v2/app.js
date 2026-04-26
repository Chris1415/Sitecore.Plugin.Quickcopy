/* QuickCopy POC v2 — Spotlight Compass
 * Mocked Marketplace SDK; all state local.
 * Theme persisted to localStorage[quickcopy.poc.theme.v2].
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Mocked context (would come from Marketplace SDK in production)
  // ---------------------------------------------------------------
  var ctx = {
    liveUrl: 'https://www.example.com/products/spring-campaign',
    previewUrl: 'https://preview.example.com/products/spring-campaign',
    itemId: '8E5F4A3B-2C1D-4F9A-9B7E-1A2B3C4D5E6F',
    pageTitle: 'Spring Campaign Landing Page',
    site: 'Northwind Marketing',
    language: 'en',
    isPublished: true,
    forcedErrors: { preview: false }
  };

  // ---------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------
  var cards = {
    live:    document.querySelector('.card[data-action="live"]'),
    preview: document.querySelector('.card[data-action="preview"]'),
    item:    document.querySelector('.card[data-action="item"]'),
    title:   document.querySelector('.card[data-action="title"]')
  };
  var share = {
    root:    document.querySelector('.share'),
    primary: document.querySelector('.share__primary'),
    caret:   document.getElementById('share-caret'),
    menu:    document.getElementById('share-menu'),
    label:   document.querySelector('.share__label'),
    glyph:   document.querySelector('.share__glyph')
  };
  var demo = {
    togglePub: document.getElementById('demo-toggle-published'),
    forceErr:  document.getElementById('demo-force-error'),
    reset:     document.getElementById('demo-reset'),
    status:    document.getElementById('demo-status')
  };
  var themeBtn = document.getElementById('theme-toggle');
  var srLive = document.getElementById('sr-live');

  var GLYPHS = {
    live: '\u2197', preview: '\u25C9', item: '#', title: 'Aa'
  };
  var LABELS = {
    live: 'Live URL', preview: 'Preview URL', item: 'Item ID', title: 'Page Title'
  };

  var copyTimers = {};       // per-action revert timer
  var errorState = {};       // persistent until cache key changes
  var shareFormat = 'md';    // 'md' | 'plain'

  // ---------------------------------------------------------------
  // Theme persistence
  // ---------------------------------------------------------------
  var THEME_KEY = 'quickcopy.poc.theme.v2';
  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.querySelector('.theme-pill__label').textContent = dark ? 'Dark' : 'Light';
    themeBtn.querySelector('.theme-pill__glyph').textContent = dark ? '\u23FE' : '\u2600';
  }
  try {
    var saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === 'light' ? 'light' : 'dark');
  } catch (e) {
    applyTheme('dark');
  }
  themeBtn.addEventListener('click', function () {
    var nextDark = !document.documentElement.classList.contains('dark');
    applyTheme(nextDark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, nextDark ? 'dark' : 'light'); } catch (e) {}
  });

  // ---------------------------------------------------------------
  // Disabled state (Live URL when unpublished)
  // ---------------------------------------------------------------
  function refreshLiveDisabled() {
    var c = cards.live;
    if (!ctx.isPublished) {
      c.classList.add('is-disabled');
      c.setAttribute('aria-disabled', 'true');
      c.setAttribute('data-tooltip', 'Not published to Edge yet \u2014 publish the page first.');
    } else {
      c.classList.remove('is-disabled');
      c.removeAttribute('aria-disabled');
      c.removeAttribute('data-tooltip');
    }
  }

  // ---------------------------------------------------------------
  // Error state (per ADR-0009 — persistent, no auto-retry)
  // ---------------------------------------------------------------
  function setError(action, message) {
    errorState[action] = message;
    var c = cards[action];
    if (!c) return;
    c.classList.add('is-error');
    c.classList.remove('is-copied');
    c.querySelector('.card__glyph').textContent = '\u274C';
    c.querySelector('.card__label').textContent = 'Failed';
    c.setAttribute('data-tooltip', message);
    announce(LABELS[action] + ' failed: ' + message);
  }
  function clearError(action) {
    delete errorState[action];
    var c = cards[action];
    if (!c) return;
    c.classList.remove('is-error');
    c.querySelector('.card__glyph').textContent = GLYPHS[action];
    c.querySelector('.card__label').textContent = LABELS[action];
    c.removeAttribute('data-tooltip');
  }

  // ---------------------------------------------------------------
  // Copy + morph
  // ---------------------------------------------------------------
  function announce(msg) {
    srLive.textContent = '';
    setTimeout(function () { srLive.textContent = msg; }, 30);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }
  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function morphCard(action) {
    var c = cards[action];
    if (!c) return;
    // re-trigger animation: remove + reflow + add
    c.classList.remove('is-copied');
    void c.offsetWidth;
    c.classList.add('is-copied');
    var glyphEl = c.querySelector('.card__glyph');
    var labelEl = c.querySelector('.card__label');
    glyphEl.textContent = '\u2713';
    labelEl.textContent = 'Copied';

    clearTimeout(copyTimers[action]);
    copyTimers[action] = setTimeout(function () {
      c.classList.remove('is-copied');
      if (!errorState[action]) {
        glyphEl.textContent = GLYPHS[action];
        labelEl.textContent = LABELS[action];
      }
    }, 1500);
  }

  function morphShare() {
    share.root.classList.add('is-copied');
    share.label.textContent = 'Copied';
    share.glyph.textContent = '\u2713';
    clearTimeout(copyTimers.share);
    copyTimers.share = setTimeout(function () {
      share.root.classList.remove('is-copied');
      share.label.textContent = 'Share Link';
      share.glyph.textContent = '\u2191';
    }, 1500);
  }

  function buildShareLink(format) {
    if (format === 'plain') {
      return ctx.pageTitle + ' \u2014 ' + ctx.liveUrl;
    }
    return '[' + ctx.pageTitle + '](' + ctx.liveUrl + ')';
  }

  function performCopy(action) {
    // Disabled guard
    if (action === 'live' && !ctx.isPublished) return;

    // Forced error simulation
    if (action === 'preview' && ctx.forcedErrors.preview) {
      setError('preview', 'Couldn\u2019t read Preview URL \u2014 try again or refresh the panel.');
      return;
    }

    // Clear any prior error for this action (cache key changes on success)
    if (errorState[action]) clearError(action);

    var value;
    switch (action) {
      case 'live':        value = ctx.liveUrl; break;
      case 'preview':     value = ctx.previewUrl; break;
      case 'item':        value = ctx.itemId; break;
      case 'title':       value = ctx.pageTitle; break;
      case 'share-md':    value = buildShareLink('md'); break;
      case 'share-plain': value = buildShareLink('plain'); break;
      default: return;
    }

    copyToClipboard(value).then(function () {
      if (action.indexOf('share') === 0) {
        morphShare();
        announce('Share Link copied');
      } else {
        morphCard(action);
        announce(LABELS[action] + ' copied');
      }
    }).catch(function () {
      if (action.indexOf('share') !== 0) {
        setError(action, 'Clipboard unavailable in this context.');
      }
    });
  }

  // ---------------------------------------------------------------
  // Card click wiring
  // ---------------------------------------------------------------
  Object.keys(cards).forEach(function (key) {
    cards[key].addEventListener('click', function () { performCopy(key); });
  });

  // ---------------------------------------------------------------
  // Share Link split-button
  // ---------------------------------------------------------------
  share.primary.addEventListener('click', function () {
    performCopy(shareFormat === 'plain' ? 'share-plain' : 'share-md');
  });
  share.caret.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = share.menu.hasAttribute('hidden') === false;
    if (open) closeShareMenu(); else openShareMenu();
  });
  function openShareMenu() {
    share.menu.removeAttribute('hidden');
    share.caret.setAttribute('aria-expanded', 'true');
    var first = share.menu.querySelector('.share__menu-item');
    if (first) first.focus();
  }
  function closeShareMenu() {
    share.menu.setAttribute('hidden', '');
    share.caret.setAttribute('aria-expanded', 'false');
  }
  share.menu.querySelectorAll('.share__menu-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var act = item.getAttribute('data-action');
      shareFormat = (act === 'share-plain') ? 'plain' : 'md';
      share.menu.querySelectorAll('.share__menu-item').forEach(function (it) {
        it.setAttribute('aria-checked', String(it === item));
      });
      closeShareMenu();
      performCopy(act);
    });
  });
  document.addEventListener('click', function (e) {
    if (!share.menu.hasAttribute('hidden') && !share.menu.contains(e.target) && e.target !== share.caret) {
      closeShareMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !share.menu.hasAttribute('hidden')) {
      closeShareMenu();
      share.caret.focus();
    }
  });

  // ---------------------------------------------------------------
  // Keyboard shortcuts (ADR-0008)
  // Iframe-scoped; suppressed in editable elements.
  // ---------------------------------------------------------------
  function isEditableTarget(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }
  window.addEventListener('keydown', function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (isEditableTarget(e.target)) return;
    var key = (e.key || '').toLowerCase();
    var action = null;
    if (key === 'l') action = 'live';
    else if (key === 'p') action = 'preview';
    else if (key === 'i') action = 'item';
    else if (key === 't') action = 'title';
    else if (key === 's') action = 'share-md'; // Alt+S: Markdown default, no dropdown
    if (!action) return;
    e.preventDefault();
    performCopy(action);
  });

  // ---------------------------------------------------------------
  // Demo controls
  // ---------------------------------------------------------------
  function refreshDemoStatus() {
    var pub = ctx.isPublished ? 'Published' : 'Unpublished';
    var err = ctx.forcedErrors.preview ? 'Preview URL forced error' : 'No forced errors';
    demo.status.textContent = pub + ' \u00B7 ' + err;
  }
  demo.togglePub.addEventListener('click', function () {
    ctx.isPublished = !ctx.isPublished;
    refreshLiveDisabled();
    refreshDemoStatus();
  });
  demo.forceErr.addEventListener('click', function () {
    ctx.forcedErrors.preview = !ctx.forcedErrors.preview;
    if (!ctx.forcedErrors.preview) clearError('preview');
    refreshDemoStatus();
  });
  demo.reset.addEventListener('click', function () {
    ctx.isPublished = true;
    ctx.forcedErrors.preview = false;
    Object.keys(cards).forEach(function (k) {
      clearError(k);
      cards[k].classList.remove('is-copied', 'is-disabled');
      cards[k].querySelector('.card__glyph').textContent = GLYPHS[k];
      cards[k].querySelector('.card__label').textContent = LABELS[k];
      cards[k].removeAttribute('data-tooltip');
      cards[k].removeAttribute('aria-disabled');
    });
    share.root.classList.remove('is-copied');
    share.label.textContent = 'Share Link';
    share.glyph.textContent = '\u2191';
    refreshLiveDisabled();
    refreshDemoStatus();
  });

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  refreshLiveDisabled();
  refreshDemoStatus();
})();
