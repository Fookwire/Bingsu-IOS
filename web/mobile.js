/* Onigiri on iPhone/iPad (Kioku): touch and phone-layout support shared by
 * every Onigiri page. Loaded in <head>, before Onigiri's other scripts.
 *
 * - <html> classes: onigiri-touch (coarse pointer, no hover),
 *   onigiri-phone (<= 600px wide), onigiri-tablet (touch, wider), kept up to
 *   date on rotation / split view.
 * - Long-press -> contextmenu. iOS WKWebView never fires `contextmenu`, and
 *   Onigiri opens every deck/tag/favorite action menu from it. A 500 ms press
 *   that does not move dispatches a synthetic contextmenu at the touch point
 *   on elements registered with OnigiriMobile.longPress(selector), and
 *   swallows the click that follows the finger lifting.
 * - Deck list on touch: a visible "more" button per deck row, and a
 *   Select mode that turns taps into multi-selection (desktop uses
 *   Ctrl/Shift+click).
 * - Phone home screen: a bottom tab bar switching between the deck sidebar
 *   and the widget dashboard, which no longer fit side by side.
 * - App feel on Onigiri's own screens (<html class="onigiri-app">, set by
 *   __init__.inject_mobile_assets): no sticky :hover (hover rules are
 *   removed on screens without a mouse or trackpad), instant press
 *   feedback, the screen edges in the page's colour, no rubber band and
 *   haptics through Kioku (core/ios_native.py, "onigiri_native:*").
 */
(function () {
    'use strict';
    if (window.OnigiriMobile) return;

    var root = document.documentElement;
    var PHONE_MAX = 600;
    var LONG_PRESS_MS = 500;
    var MOVE_TOLERANCE = 10;

    function mq(query) {
        try { return window.matchMedia(query).matches; } catch (e) { return false; }
    }

    function isTouch() {
        return mq('(pointer: coarse)') || mq('(hover: none)') ||
            root.classList.contains('onigiri-mobile');
    }

    function isPhone() {
        return Math.min(window.innerWidth || 9999, (window.screen && screen.width) || 9999) <= PHONE_MAX ||
            (window.innerWidth || 9999) <= PHONE_MAX;
    }

    function updateClasses() {
        var touch = isTouch();
        var phone = isPhone();
        root.classList.toggle('onigiri-touch', touch);
        root.classList.toggle('onigiri-phone', phone);
        root.classList.toggle('onigiri-tablet', touch && !phone);
    }

    updateClasses();
    window.addEventListener('resize', updateClasses, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(updateClasses, 50); });

    // --- Long-press -> contextmenu ------------------------------------------------

    var longPressSelectors = [
        '#deck-list-container tr.deck',
        '[oncontextmenu]',
        '[data-onigiri-longpress]',
    ];
    var press = null;
    var suppressClickUntil = 0;

    function longPressTarget(el) {
        if (!el || !el.closest) return null;
        for (var i = 0; i < longPressSelectors.length; i++) {
            var hit = el.closest(longPressSelectors[i]);
            if (hit) return hit;
        }
        return null;
    }

    function cancelPress() {
        if (press) {
            clearTimeout(press.timer);
            if (press.el) press.el.classList.remove('onigiri-pressing');
        }
        press = null;
    }

    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse') return;
        if (event.target.closest && event.target.closest('.drag-handle, input, textarea, select, [contenteditable="true"]')) return;
        var el = longPressTarget(event.target);
        if (!el) return;
        cancelPress();
        var origin = event.target;
        press = {
            el: el,
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(function () {
                if (!press) return;
                var p = press;
                press = null;
                p.el.classList.remove('onigiri-pressing');
                suppressClickUntil = Date.now() + 800;
                haptic('medium');
                var evt = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: p.x,
                    clientY: p.y,
                    screenX: p.x,
                    screenY: p.y,
                    button: 2,
                    buttons: 2,
                });
                evt.onigiriLongPress = true;
                origin.dispatchEvent(evt);
            }, LONG_PRESS_MS),
        };
        el.classList.add('onigiri-pressing');
    }, true);

    document.addEventListener('pointermove', function (event) {
        if (!press) return;
        if (Math.abs(event.clientX - press.x) > MOVE_TOLERANCE ||
            Math.abs(event.clientY - press.y) > MOVE_TOLERANCE) {
            cancelPress();
        }
    }, true);
    ['pointerup', 'pointercancel', 'scroll'].forEach(function (type) {
        document.addEventListener(type, cancelPress, true);
    });

    // The finger lifting after a long-press produces a click on the row,
    // which would open the deck and close the menu that just opened.
    document.addEventListener('click', function (event) {
        if (Date.now() < suppressClickUntil) {
            suppressClickUntil = 0;
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    // A native contextmenu (iPad trackpad/mouse right click) means no
    // synthetic one is needed for this press.
    document.addEventListener('contextmenu', function (event) {
        if (!event.onigiriLongPress) cancelPress();
    }, true);


    // --- App feel: native bridge (core/ios_native.py) ----------------------------

    function nativeCmd(what) {
        if (!root.classList.contains('onigiri-ios')) return;
        try { if (typeof pycmd === 'function') pycmd('onigiri_native:' + what); } catch (e) {}
    }

    function haptic(kind) {
        if (root.classList.contains('onigiri-ios')) {
            nativeCmd('haptic:' + (kind || 'light'));
        } else {
            try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
        }
    }

    // --- App feel: no sticky hover -------------------------------------------------
    // On a touch screen a tap leaves :hover on the element until the next tap
    // somewhere else: tapped rows stayed highlighted, buttons stayed lit.
    // Without a mouse or trackpad, :hover rules are dropped from Onigiri's
    // stylesheets (`:not(:hover)` always holds then, so it is just removed).

    function hasMousePointer() {
        return mq('(any-hover: hover)') || mq('(any-pointer: fine)');
    }

    function splitSelectors(text) {
        var out = [];
        var depth = 0;
        var start = 0;
        for (var i = 0; i < text.length; i++) {
            var c = text.charAt(i);
            if (c === '(' || c === '[') depth++;
            else if (c === ')' || c === ']') depth--;
            else if (c === ',' && depth === 0) {
                out.push(text.slice(start, i));
                start = i + 1;
            }
        }
        out.push(text.slice(start));
        return out;
    }

    function stripHoverRules(list) {
        if (!list) return 0;
        var removed = 0;
        for (var i = list.length - 1; i >= 0; i--) {
            var rule = list[i];
            try {
                if (rule.cssRules && rule.type !== 1) {
                    // @media/@supports/@layer: leave explicit hover queries alone
                    var cond = rule.conditionText || (rule.media && rule.media.mediaText) || '';
                    if (!/hover\s*:\s*hover|pointer\s*:\s*fine/.test(cond)) removed += stripHoverRules(rule.cssRules);
                    continue;
                }
                if (rule.type === 3 && rule.styleSheet) { // @import
                    removed += stripHoverRules(rule.styleSheet.cssRules);
                    continue;
                }
                var sel = rule.selectorText;
                if (!sel || sel.indexOf(':hover') < 0) continue;
                var keep = splitSelectors(sel).map(function (part) {
                    return part.replace(/:not\(\s*:hover\s*\)/g, '');
                }).filter(function (part) {
                    return part.trim() && part.indexOf(':hover') < 0;
                });
                if (!keep.length) {
                    (rule.parentRule || rule.parentStyleSheet).deleteRule(i);
                } else {
                    rule.selectorText = keep.map(function (p) {
                        p = p.trim();
                        return /^[>+~]/.test(p) || p === '' ? '*' + p : p;
                    }).join(', ');
                }
                removed++;
            } catch (e) {}
        }
        return removed;
    }

    var strippedSheets = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

    function stripHover() {
        if (!root.classList.contains('onigiri-app') || !root.classList.contains('onigiri-touch')) return;
        if (hasMousePointer()) return;
        var sheets = document.styleSheets;
        for (var i = 0; i < sheets.length; i++) {
            var sheet = sheets[i];
            if (strippedSheets && strippedSheets.has(sheet)) continue;
            var rules;
            try { rules = sheet.cssRules; } catch (e) { continue; } // not loaded / cross-origin
            if (!rules) continue;
            stripHoverRules(rules);
            if (strippedSheets) strippedSheets.add(sheet);
        }
    }

    function watchStylesheets() {
        if (typeof MutationObserver === 'undefined') return;
        var pending = false;
        var obs = new MutationObserver(function (records) {
            for (var r = 0; r < records.length; r++) {
                var nodes = records[r].addedNodes;
                for (var n = 0; n < nodes.length; n++) {
                    var node = nodes[n];
                    if (node.nodeName === 'LINK') node.addEventListener('load', stripHover);
                    if ((node.nodeName === 'STYLE' || node.nodeName === 'LINK') && !pending) {
                        pending = true;
                        setTimeout(function () { pending = false; stripHover(); }, 0);
                    }
                }
            }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- App feel: press feedback --------------------------------------------------
    // iOS WebKit applies :active only when a touch listener exists, and a
    // web page lights a button only after the finger lifts. Native controls
    // dim the moment they are touched.

    var PRESSABLE = 'button, a[href], a[onclick], [role="button"], [role="tab"], [role="menuitem"], summary, ' +
        '.menu-item, tr.deck, .quick-menu-item, .osw-nav-item, .deck-header-btn, [onclick]';
    var pressed = null;
    var pressedAt = null;

    function clearPressed(delay) {
        var el = pressed;
        pressed = null;
        pressedAt = null;
        if (!el) return;
        if (delay) setTimeout(function () { el.classList.remove('onigiri-pressed'); }, delay);
        else el.classList.remove('onigiri-pressed');
    }

    document.addEventListener('touchstart', function () {}, { passive: true });

    document.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse' || !root.classList.contains('onigiri-app')) return;
        var el = event.target.closest && event.target.closest(PRESSABLE);
        if (!el || el.closest('#qa') || el.disabled) return;
        // a whole panel with an onclick is not a button
        var r = el.getBoundingClientRect();
        if (r.height > 160 && r.width > window.innerWidth * 0.6) return;
        clearPressed();
        pressed = el;
        pressedAt = { x: event.clientX, y: event.clientY };
        el.classList.add('onigiri-pressed');
    }, true);

    document.addEventListener('pointermove', function (event) {
        if (!pressedAt) return;
        if (Math.abs(event.clientX - pressedAt.x) > 8 || Math.abs(event.clientY - pressedAt.y) > 8) clearPressed();
    }, true);
    document.addEventListener('pointerup', function () { clearPressed(90); }, true);
    document.addEventListener('pointercancel', function () { clearPressed(); }, true);
    document.addEventListener('scroll', function () { clearPressed(); }, true);

    // --- App feel: screen edges ------------------------------------------------------
    // Kioku pads <html> by the home indicator / notch and the main window's
    // margins fill the status bar strip: both showed Anki grey. <html> takes
    // the page's own colour and the main screens report it to the window.

    function opaqueBackground(el) {
        if (!el) return '';
        var bg = '';
        try { bg = getComputedStyle(el).backgroundColor; } catch (e) { return ''; }
        if (!bg || bg === 'transparent') return '';
        var m = bg.match(/rgba?\(([^)]+)\)/);
        if (m) {
            var parts = m[1].split(/[\s,\/]+/).filter(Boolean);
            if (parts.length > 3 && parseFloat(parts[3]) < 0.5) return '';
        }
        return bg;
    }

    var MAIN_SCREEN = '.container.modern-main-menu, .ba-home, .ba-side, body.onigiri-overview, #qa';
    var lastEdge = '';

    function paintEdges() {
        if (!root.classList.contains('onigiri-app') || !document.body) return;
        root.style.backgroundColor = '';
        var color = opaqueBackground(document.body) ||
            opaqueBackground(document.querySelector('.container.modern-main-menu, .ba-home, #outer')) ||
            opaqueBackground(root);
        if (!color) return;
        root.style.backgroundColor = color;
        if (document.querySelector(MAIN_SCREEN) && color !== lastEdge) {
            lastEdge = color;
            nativeCmd('edge:' + color.replace(/\s+/g, ''));
        }
    }

    // --- Debug: what is wider than the screen? ----------------------------------------

    function findOverflow() {
        var w = document.documentElement.clientWidth;
        var out = [];
        document.querySelectorAll('body *').forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.width && (r.right > w + 1 || r.left < -1)) {
                var style = getComputedStyle(el);
                if (style.position === 'fixed' && style.visibility === 'hidden') return;
                out.push({
                    el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                        (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
                    left: Math.round(r.left),
                    right: Math.round(r.right),
                });
            }
        });
        return out;
    }

    // --- Deck list: "more" buttons and Select mode -------------------------------

    var MORE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
        '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' +
        '<circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';

    function t(key, fallback) {
        try {
            if (typeof window.ONIGIRI_T === 'function') return window.ONIGIRI_T(key, fallback);
        } catch (e) {}
        return fallback;
    }

    function openRowMenu(row, anchor) {
        var rect = anchor.getBoundingClientRect();
        var evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left,
            clientY: rect.bottom,
            button: 2,
        });
        evt.onigiriLongPress = true;
        row.dispatchEvent(evt);
    }

    function decorateDeckRows() {
        if (!root.classList.contains('onigiri-touch')) return;
        var rows = document.querySelectorAll('#deck-list-container tr.deck[data-did]');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.querySelector(':scope > .onigiri-row-more-cell')) continue;
            var cell = document.createElement('td');
            cell.className = 'onigiri-row-more-cell';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'onigiri-row-more';
            btn.setAttribute('aria-label', t('more', 'More'));
            btn.innerHTML = MORE_SVG;
            cell.appendChild(btn);
            row.appendChild(cell);
        }
    }

    document.addEventListener('click', function (event) {
        var btn = event.target.closest && event.target.closest('.onigiri-row-more');
        if (!btn) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var row = btn.closest('tr.deck');
        if (row) openRowMenu(row, btn);
    }, true);

    var selectMode = false;

    function setSelectMode(on) {
        selectMode = !!on;
        root.classList.toggle('onigiri-select-mode', selectMode);
        var btn = document.getElementById('onigiri-select-toggle');
        if (btn) btn.setAttribute('aria-pressed', selectMode ? 'true' : 'false');
        if (!selectMode && window.OnigiriEngine && OnigiriEngine.clearMultiSelection) {
            try { OnigiriEngine.clearMultiSelection(); } catch (e) {}
        }
    }

    function addSelectToggle() {
        if (!root.classList.contains('onigiri-touch')) return;
        var actions = document.querySelector('#deck-list-header .deck-header-actions');
        if (!actions || document.getElementById('onigiri-select-toggle')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'onigiri-select-toggle';
        btn.className = 'deck-header-btn onigiri-select-toggle';
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = t('select', 'Select');
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            setSelectMode(!selectMode);
        });
        actions.insertBefore(btn, actions.firstChild);
    }

    // In Select mode a tap selects instead of opening the deck. Runs in the
    // capture phase so it wins over the deck link's own onclick.
    document.addEventListener('click', function (event) {
        if (!selectMode) return;
        var container = document.getElementById('deck-list-container');
        if (!container || !container.contains(event.target)) return;
        if (event.target.closest('a.collapse, .onigiri-row-more, .drag-handle')) return;
        var row = event.target.closest('tr.deck[data-did]');
        if (!row || !window.OnigiriEngine || !OnigiriEngine.toggleMultiSelection) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        OnigiriEngine.toggleMultiSelection(row, event);
    }, true);

    // --- Phone tab bar (deck browser) --------------------------------------------

    var TAB_KEY = 'onigiriPhoneTab';

    function readTab() {
        try { return sessionStorage.getItem(TAB_KEY) || 'decks'; } catch (e) { return 'decks'; }
    }

    function applyTab(tab) {
        root.classList.toggle('onigiri-phone-tab-decks', tab !== 'home');
        root.classList.toggle('onigiri-phone-tab-home', tab === 'home');
        var bar = document.getElementById('onigiri-phone-tabs');
        if (bar) {
            bar.querySelectorAll('button[data-tab]').forEach(function (b) {
                b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
            });
        }
        try { sessionStorage.setItem(TAB_KEY, tab); } catch (e) {}
        // Widgets measure themselves (heatmap, grids): let them reflow now
        // that they are visible.
        setTimeout(function () {
            try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        }, 0);
    }

    var DECKS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M7 4h10"/></svg>';
    var HOME_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/></svg>';

    var MENU_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';

    function addPhoneTabs() {
        // Classic/Shima home (.modern-main-menu) or the Kome theme (.ba-side).
        var container = document.querySelector('.container.modern-main-menu, .ba-side');
        if (!container || document.getElementById('onigiri-phone-tabs')) return;
        var bar = document.createElement('nav');
        bar.id = 'onigiri-phone-tabs';
        bar.setAttribute('role', 'tablist');
        [
            ['decks', DECKS_SVG, t('decks', 'Decks')],
            ['home', HOME_SVG, t('home', 'Home')],
            ['menu', MENU_SVG, t('menu', 'Menu')],
        ].forEach(function (spec) {
            var b = document.createElement('button');
            b.type = 'button';
            b.dataset.tab = spec[0];
            b.setAttribute('role', 'tab');
            b.innerHTML = spec[1] + '<span>' + spec[2] + '</span>';
            if (spec[0] === 'menu') {
                // Not a tab: Anki's menus (File, Tools, Help, ...) as a
                // popup, since the desktop menu row is hidden on phones.
                b.removeAttribute('role');
                b.addEventListener('click', function () {
                    if (typeof pycmd === 'function') pycmd('onigiri_app_menu');
                });
            } else {
                b.addEventListener('click', function () { applyTab(spec[0]); });
            }
            bar.appendChild(b);
        });
        document.body.appendChild(bar);
        root.classList.add('onigiri-has-phone-tabs');
        applyTab(readTab());
    }

    // --- Onigiri Settings on phones: list -> page drill-down --------------------

    var BACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

    function setupSettingsDrillDown() {
        var shell = document.querySelector('.osw-shell');
        if (!shell || shell.dataset.onigiriDrill) return;
        shell.dataset.onigiriDrill = '1';
        var row = document.querySelector('.osw-page-head-row');
        if (row && !row.querySelector('.onigiri-settings-back')) {
            var back = document.createElement('button');
            back.type = 'button';
            back.className = 'onigiri-settings-back';
            back.innerHTML = BACK_SVG + '<span>' + t('settings_title', 'Settings') + '</span>';
            back.addEventListener('click', function () {
                root.classList.remove('onigiri-settings-page');
            });
            row.insertBefore(back, row.firstChild);
        }
        // Opening a page (nav item or search result) shows it full width.
        shell.addEventListener('click', function (event) {
            if (event.target.closest('[data-nav-item], .osw-search-results [data-page], .osw-search-result')) {
                root.classList.add('onigiri-settings-page');
            }
        });
        var search = shell.querySelector('.osw-search input');
        if (search) {
            search.addEventListener('input', function () {
                if (search.value.trim()) root.classList.add('onigiri-settings-page');
            });
        }
    }

    // --- App feel: no pinch-zoom on Onigiri's own screens ----------------------
    // A pinch or a drag moved the whole home screen around like a web page.
    // Reviewer cards (#qa) keep pinch-zoom (images, small print). Kioku keeps
    // the page's own viewport in data-kioku-viewport and scales it by its
    // "User interface size" (kioku/webscripts.py ZOOM_JS), so the limits are
    // set there and in the live tag, scaled by the current zoom.
    var NO_ZOOM = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';

    function lockZoom() {
        if (!root.classList.contains('onigiri-mobile')) return;
        if (document.getElementById('qa')) return;
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            if (!document.head) return;
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }
        if (meta.hasAttribute('data-kioku-viewport')) meta.setAttribute('data-kioku-viewport', NO_ZOOM);
        var z = Number(window.__kiokuZoom) || 1;
        meta.content = z === 1 ? NO_ZOOM
            : 'initial-scale=' + z + ', minimum-scale=' + z + ', maximum-scale=' + z + ', user-scalable=no';
    }

    function onReady() {
        updateClasses();
        lockZoom();
        stripHover();
        watchStylesheets();
        paintEdges();
        nativeCmd('ready');
        setupSettingsDrillDown();
        addPhoneTabs();
        addSelectToggle();
        decorateDeckRows();
        // Kome builds its sidebar after load: add the tabs once it appears.
        if (!document.getElementById('onigiri-phone-tabs') && typeof MutationObserver !== 'undefined' && document.body) {
            var tabsObserver = new MutationObserver(function () {
                if (document.querySelector('.container.modern-main-menu, .ba-side')) {
                    tabsObserver.disconnect();
                    addPhoneTabs();
                }
            });
            tabsObserver.observe(document.body, { childList: true, subtree: true });
            setTimeout(function () { tabsObserver.disconnect(); }, 10000);
        }
        var container = document.getElementById('deck-list-container');
        if (container && typeof MutationObserver !== 'undefined') {
            new MutationObserver(function () {
                decorateDeckRows();
            }).observe(container, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
    window.addEventListener('load', function () {
        stripHover();
        paintEdges();
        // themes and backgrounds settle after load
        setTimeout(paintEdges, 600);
    });

    window.OnigiriMobile = {
        isTouch: function () { return root.classList.contains('onigiri-touch'); },
        isPhone: function () { return root.classList.contains('onigiri-phone'); },
        longPress: function (selector) {
            if (selector && longPressSelectors.indexOf(selector) < 0) longPressSelectors.push(selector);
        },
        setSelectMode: setSelectMode,
        showTab: applyTab,
        refresh: function () { updateClasses(); decorateDeckRows(); addSelectToggle(); stripHover(); paintEdges(); },
        haptic: haptic,
        paintEdges: paintEdges,
        findOverflow: findOverflow,
    };
})();
